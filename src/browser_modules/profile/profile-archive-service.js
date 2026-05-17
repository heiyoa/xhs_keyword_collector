import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { CredentialResolver } from "../bindings/credential-resolver.js";
import { BindingService } from "../bindings/binding-service.js";
import { BrowserModuleError } from "../core/browser-errors.js";
import { BrowserResourceService } from "../core/browser-resource-service.js";
import { RoxyApiClient } from "../core/roxy-client.js";
import { ProfileLocator } from "./profile-locator.js";

const DEFAULT_ARCHIVE_ROOT = path.resolve("artifacts", "profile-archives");
const VOLATILE_NAMES = new Set([
  "DevToolsActivePort",
  "Crashpad",
  "BrowserMetrics",
  "lockfile",
  "SingletonCookie",
  "SingletonLock",
  "SingletonSocket",
]);

export class ProfileArchiveService {
  constructor({
    bindingService = new BindingService({ credentialResolver: new CredentialResolver() }),
    credentialResolver = new CredentialResolver(),
    profileLocator = new ProfileLocator(),
    archiveRoot = process.env.BROWSER_PROFILE_ARCHIVE_ROOT || DEFAULT_ARCHIVE_ROOT,
  } = {}) {
    this.bindingService = bindingService;
    this.credentialResolver = credentialResolver;
    this.profileLocator = profileLocator;
    this.archiveRoot = archiveRoot;
  }

  locateProfilePath(dirId) {
    return this.profileLocator.locateProfilePath(dirId);
  }

  async saveProfileSnapshot({
    bindingKey,
    sourceDirId,
    waitForFlushMs = 5_000,
    snapshotType = "full-profile",
  }) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    const dirId = sourceDirId || binding.profile.current_dir_id;
    if (!dirId) {
      throw new BrowserModuleError(`Binding ${bindingKey} does not have current_dir_id; pass --source-dir-id.`);
    }

    const profilePath = this.locateProfilePath(dirId);
    const browserService = this.#createBrowserService(binding);
    await browserService.closeIfOpen(dirId);
    if (waitForFlushMs > 0) {
      await sleep(waitForFlushMs);
    }

    const snapshotKey = buildSnapshotKey(binding.profile.profile_key);
    const snapshotDir = path.join(this.#resolveArchiveRoot(binding), snapshotKey);
    const archivePath = path.join(snapshotDir, "profile");
    const metadataPath = path.join(snapshotDir, "metadata.json");

    await mkdir(snapshotDir, { recursive: true });
    await copyProfileDirectory(profilePath, archivePath);

    const metadata = {
      snapshot_key: snapshotKey,
      binding_key: bindingKey,
      captured_at: new Date().toISOString(),
      source_dir_id: dirId,
      source_profile_path: profilePath,
      profile_key: binding.profile.profile_key,
      create_payload: buildCreatePayloadFromBinding(binding),
    };

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
    const sizeBytes = await getDirectorySize(archivePath);

    const record = this.bindingService.createProfileSnapshotRecord({
      profile_id: binding.profile.id,
      snapshot_key: snapshotKey,
      snapshot_type: snapshotType,
      archive_path: archivePath,
      metadata_path: metadataPath,
      source_dir_id: dirId,
      source_profile_path: profilePath,
      cookie_count: null,
      storage_origin_count: null,
      size_bytes: sizeBytes,
      status: "created",
    });

    return {
      snapshotKey,
      archivePath,
      metadataPath,
      sizeBytes,
      snapshotRecord: record,
    };
  }

  async restoreProfileSnapshot({
    bindingKey,
    snapshotKey,
    openAfterRestore = true,
    deleteExistingCurrentDir = false,
  }) {
    const binding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    const snapshot = this.bindingService.getProfileSnapshotByKey(snapshotKey);
    if (!snapshot) {
      throw new BrowserModuleError(`Profile snapshot not found: ${snapshotKey}`);
    }

    const browserService = this.#createBrowserService(binding);
    if (deleteExistingCurrentDir && binding.profile.current_dir_id) {
      await browserService.closeIfOpen(binding.profile.current_dir_id);
      await browserService.deleteBrowsers(
        binding.api_credential.workspace_id || binding.profile.workspace_id,
        [binding.profile.current_dir_id],
      );
      await sleep(3_000);
    }

    const payload = buildCreatePayloadFromBinding(binding);
    const created = await browserService.createBrowser(payload);
    const newDirId = created?.data?.dirId;

    await browserService.openBrowser({
      workspaceId: payload.workspaceId,
      dirId: newDirId,
    });
    await browserService.closeBrowser(newDirId);
    await sleep(3_000);

    const targetProfilePath = this.locateProfilePath(newDirId);
    await clearDirectory(targetProfilePath);
    await copyProfileDirectory(snapshot.archive_path, targetProfilePath);

    if (openAfterRestore) {
      await browserService.openBrowser({
        workspaceId: payload.workspaceId,
        dirId: newDirId,
      });
    }

    this.bindingService.updateProfileCurrentDir(binding.profile.profile_key, newDirId);

    return {
      bindingKey,
      snapshotKey,
      newDirId,
      targetProfilePath,
      opened: openAfterRestore,
    };
  }

  #resolveArchiveRoot(binding) {
    return binding.profile.archive_root_path || path.join(this.archiveRoot, binding.profile.profile_key);
  }

  #createBrowserService(binding) {
    const apiKey = binding.api_credential.resolved_api_key || this.credentialResolver.resolve(binding.api_credential.api_key_ref);
    const client = new RoxyApiClient({
      host: binding.api_credential.api_host,
      token: apiKey,
    });
    return new BrowserResourceService(client);
  }
}

function buildCreatePayloadFromBinding(binding) {
  const workspaceId = binding.api_credential.workspace_id || binding.profile.workspace_id;
  const projectId = binding.api_credential.project_id || binding.profile.project_id;
  const payload = {
    workspaceId,
    projectId,
    windowName: binding.profile.display_name || binding.profile.profile_key,
    os: binding.profile.os_name,
    osVersion: binding.profile.os_version,
    userAgent: binding.profile.user_agent,
    coreVersion: binding.profile.browser_core_version,
    defaultOpenUrl: binding.profile.default_open_urls || [],
    proxyInfo: buildProxyInfo(binding),
    fingerInfo: binding.profile.fingerprint || undefined,
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

async function copyProfileDirectory(sourceDir, targetDir) {
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => !VOLATILE_NAMES.has(path.basename(source)),
    force: true,
    errorOnExist: false,
  });
}

async function clearDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    await rm(path.join(dirPath, entry.name), { recursive: true, force: true });
  }
}

async function getDirectorySize(dirPath) {
  let total = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath);
      continue;
    }
    const fileStat = await stat(fullPath);
    total += fileStat.size;
  }
  return total;
}

function buildSnapshotKey(profileKey) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(16).slice(2, 8);
  return `${profileKey}-${stamp}-${random}`;
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
