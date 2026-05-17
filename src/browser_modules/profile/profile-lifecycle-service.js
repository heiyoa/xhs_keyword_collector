import path from "node:path";

import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { BrowserModuleError } from "../core/browser-errors.js";
import { BrowserResourceService } from "../core/browser-resource-service.js";
import { RoxyApiClient } from "../core/roxy-client.js";
import { nowIso, openDatabase } from "../db/sqlite.js";
import { ProfileArchiveService } from "./profile-archive-service.js";

export class ProfileLifecycleService {
  constructor({
    db = openDatabase(),
    bindingService = new BindingService({
      db,
      credentialResolver: new CredentialResolver(),
    }),
    credentialResolver = new CredentialResolver(),
    archiveService,
  } = {}) {
    this.db = db;
    this.bindingService = bindingService;
    this.credentialResolver = credentialResolver;
    this.archiveService =
      archiveService ||
      new ProfileArchiveService({
        bindingService,
        credentialResolver,
      });
  }

  getProfileAssetStatus(bindingKey) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: false });
    const latestSnapshot = this.bindingService.getLatestProfileSnapshot(binding.profile.profile_key);
    const snapshots = this.bindingService.listProfileSnapshots(binding.profile.profile_key);

    return {
      binding_key: bindingKey,
      profile_asset: {
        profile_key: binding.profile.profile_key,
        platform: binding.profile.platform,
        status: binding.profile.status,
        current_dir_id: binding.profile.current_dir_id,
        archive_root_path:
          binding.profile.archive_root_path ||
          path.resolve("artifacts", "profile-archives", binding.profile.profile_key),
        login_state_strategy: "profile-first",
        window_resource_strategy: "ephemeral-window",
        snapshot_count: snapshots.length,
        latest_snapshot_key: latestSnapshot?.snapshot_key || null,
        latest_snapshot_created_at: latestSnapshot?.created_at || null,
      },
      binding_summary: {
        account_key: binding.account.account_key,
        api_credential_key: binding.api_credential.credential_key,
        ip_resource_key: binding.ip_resource?.proxy_key || null,
      },
    };
  }

  async createWindowFromProfile({
    bindingKey,
    openAfterCreate = true,
    targetUrl,
    windowNameSuffix = "runtime",
  }) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    const browserService = this.#createBrowserService(binding);
    const payload = buildCreatePayloadFromBinding(binding, {
      targetUrl,
      windowName: `${binding.profile.display_name || binding.profile.profile_key}-${windowNameSuffix}`,
    });

    const created = await browserService.createBrowser(payload);
    const dirId = created?.data?.dirId;

    let opened = null;
    if (openAfterCreate) {
      opened = await browserService.openBrowser({
        workspaceId: payload.workspaceId,
        dirId,
        forceOpen: false,
        headless: false,
      });
    }

    const localProfilePath = this.archiveService.locateProfilePath(dirId);
    this.bindingService.updateProfileAsset(binding.profile.profile_key, {
      current_dir_id: dirId,
      local_profile_path: localProfilePath,
      status: openAfterCreate ? "window_open" : "window_created",
      last_verified_at: nowIso(),
    });

    return {
      status: "ok",
      binding_key: bindingKey,
      action: "create-window",
      dir_id: dirId,
      opened: Boolean(opened),
      opened_ws: opened?.data?.ws || null,
      opened_http: opened?.data?.http || null,
      local_profile_path: localProfilePath,
    };
  }

  async retireWindow({
    bindingKey,
    dirId,
    deleteWindow = true,
  }) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    const browserService = this.#createBrowserService(binding);
    const targetDirId = dirId || binding.profile.current_dir_id;
    if (!targetDirId) {
      throw new BrowserModuleError(`Binding ${bindingKey} has no current_dir_id to retire.`);
    }

    await browserService.closeIfOpen(targetDirId);
    if (deleteWindow) {
      await browserService.deleteBrowsers(
        binding.api_credential.workspace_id || binding.profile.workspace_id,
        [targetDirId],
      );
    }

    this.bindingService.updateProfileAsset(binding.profile.profile_key, {
      current_dir_id: null,
      status: "profile_archived_ready",
      last_verified_at: nowIso(),
    });

    return {
      status: "ok",
      binding_key: bindingKey,
      action: "retire-window",
      dir_id: targetDirId,
      deleted: deleteWindow,
    };
  }

  async archiveAndRetireWindow({
    bindingKey,
    sourceDirId,
    waitForFlushMs = 120_000,
    deleteAfterArchive = true,
  }) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    const sourceLocalProfilePath = this.archiveService.locateProfilePath(
      sourceDirId || binding.profile.current_dir_id,
    );
    const snapshot = await this.archiveService.saveProfileSnapshot({
      bindingKey,
      sourceDirId,
      waitForFlushMs,
    });

    let retireResult = null;
    if (deleteAfterArchive) {
      retireResult = await this.retireWindow({
        bindingKey,
        dirId: sourceDirId || binding.profile.current_dir_id,
        deleteWindow: true,
      });
    } else {
      this.bindingService.updateProfileAsset(binding.profile.profile_key, {
        status: "profile_archived_ready",
        last_verified_at: nowIso(),
      });
    }

    this.bindingService.updateProfileAsset(binding.profile.profile_key, {
      archive_root_path: path.dirname(path.dirname(snapshot.archivePath)),
      local_profile_path: sourceLocalProfilePath,
      status: "profile_archived_ready",
      last_verified_at: nowIso(),
    });

    return {
      status: "ok",
      binding_key: bindingKey,
      action: "archive-retire",
      snapshot_key: snapshot.snapshotKey,
      archive_path: snapshot.archivePath,
      retired: Boolean(retireResult),
      retire_result: retireResult,
    };
  }

  async rebuildWindowFromLatestSnapshot({
    bindingKey,
    snapshotKey,
    openAfterRestore = true,
    deleteExistingCurrentDir = true,
  }) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    const effectiveSnapshotKey =
      snapshotKey || this.bindingService.getLatestProfileSnapshot(binding.profile.profile_key)?.snapshot_key;

    if (!effectiveSnapshotKey) {
      throw new BrowserModuleError(`No snapshot available for profile ${binding.profile.profile_key}`);
    }

    const restored = await this.archiveService.restoreProfileSnapshot({
      bindingKey,
      snapshotKey: effectiveSnapshotKey,
      openAfterRestore,
      deleteExistingCurrentDir,
    });

    const localProfilePath = this.archiveService.locateProfilePath(restored.newDirId);
    this.bindingService.updateProfileAsset(binding.profile.profile_key, {
      current_dir_id: restored.newDirId,
      local_profile_path: localProfilePath,
      status: openAfterRestore ? "window_open" : "window_restored",
      last_verified_at: nowIso(),
    });

    return {
      status: "ok",
      binding_key: bindingKey,
      action: "rebuild-window",
      snapshot_key: effectiveSnapshotKey,
      restored_dir_id: restored.newDirId,
      opened: restored.opened,
      local_profile_path: localProfilePath,
    };
  }

  #createBrowserService(binding) {
    const apiKey =
      binding.api_credential.resolved_api_key ||
      this.credentialResolver.resolve(binding.api_credential.api_key_ref);
    const client = new RoxyApiClient({
      host: binding.api_credential.api_host,
      token: apiKey,
    });
    return new BrowserResourceService(client);
  }
}

function buildCreatePayloadFromBinding(binding, overrides = {}) {
  const workspaceId = binding.api_credential.workspace_id || binding.profile.workspace_id;
  const projectId = binding.api_credential.project_id || binding.profile.project_id;

  const payload = {
    workspaceId,
    projectId,
    windowName: overrides.windowName || binding.profile.display_name || binding.profile.profile_key,
    os: binding.profile.os_name || "Windows",
    osVersion: binding.profile.os_version || "11",
    userAgent: binding.profile.user_agent,
    coreVersion: binding.profile.browser_core_version,
    defaultOpenUrl: overrides.targetUrl
      ? [overrides.targetUrl]
      : binding.profile.default_open_urls || [],
    proxyInfo: buildProxyInfo(binding),
    fingerInfo:
      binding.profile.fingerprint || {
        openWidth: "1280",
        openHeight: "720",
        randomFingerprint: false,
        clearCacheFile: false,
        clearCookie: false,
        clearLocalStorage: false,
      },
  };

  return removeUndefinedDeep(payload);
}

function buildProxyInfo(binding) {
  if (binding.ip_resource?.host) {
    return {
      proxyMethod: "custom",
      proxyCategory: binding.ip_resource.proxy_type || "socks5",
      ipType: "IPV4",
      host: binding.ip_resource.host,
      port: String(binding.ip_resource.port),
      proxyUserName: binding.ip_resource.resolved_username || undefined,
      proxyPassword: binding.ip_resource.resolved_password || undefined,
    };
  }

  return binding.profile.proxy_template || {
    proxyMethod: "custom",
    proxyCategory: "noproxy",
    ipType: "IPV4",
  };
}

function removeUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nested]) => [key, removeUndefinedDeep(nested)])
        .filter(([, nested]) => nested !== undefined),
    );
  }
  return value === undefined ? undefined : value;
}
