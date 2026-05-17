import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { BrowserResourceService } from "../core/browser-resource-service.js";
import { RoxyApiClient } from "../core/roxy-client.js";
import { openDatabase } from "../db/sqlite.js";
import { ProfileArchiveService } from "../profile/profile-archive-service.js";
import { parseArgs, printJson, requireOption } from "./_cli-utils.js";

async function main() {
  const { positional, options } = parseArgs();
  const command = positional[0];
  if (command !== "run") {
    throw new Error("Usage: profile-smoke-cli.js run --binding-key=<binding_key>");
  }

  const bindingKey = requireOption(options, "binding-key");
  const db = openDatabase();
  const credentialResolver = new CredentialResolver();
  const bindingService = new BindingService({ db, credentialResolver });
  const archiveService = new ProfileArchiveService({ bindingService, credentialResolver });
  const binding = bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
  const browserService = createBrowserService(binding, credentialResolver);

  const workspaceId = binding.api_credential.workspace_id || binding.profile.workspace_id;
  const projectId = binding.api_credential.project_id || binding.profile.project_id;
  const createPayload = {
    workspaceId,
    projectId,
    windowName: `${binding.profile.profile_key}-smoke-source`,
    os: binding.profile.os_name || "Windows",
    osVersion: binding.profile.os_version || "11",
    coreVersion: binding.profile.browser_core_version,
    userAgent: binding.profile.user_agent,
    defaultOpenUrl: binding.profile.default_open_urls?.length
      ? binding.profile.default_open_urls
      : ["https://www.bilibili.com/"],
    proxyInfo: binding.profile.proxy_template || {
      proxyMethod: "custom",
      proxyCategory: "noproxy",
      ipType: "IPV4",
    },
    fingerInfo: binding.profile.fingerprint || {
      openWidth: "1280",
      openHeight: "720",
      randomFingerprint: false,
      clearCacheFile: false,
      clearCookie: false,
      clearLocalStorage: false,
    },
  };

  const created = await browserService.createBrowser(removeUndefinedDeep(createPayload));
  const sourceDirId = created?.data?.dirId;
  await browserService.openBrowser({ workspaceId, dirId: sourceDirId });
  await browserService.closeBrowser(sourceDirId);
  await sleep(3_000);

  bindingService.updateProfileCurrentDir(binding.profile.profile_key, sourceDirId);
  const saved = await archiveService.saveProfileSnapshot({
    bindingKey,
    sourceDirId,
    waitForFlushMs: 0,
  });

  await browserService.deleteBrowsers(workspaceId, [sourceDirId]);
  await sleep(3_000);

  const restored = await archiveService.restoreProfileSnapshot({
    bindingKey,
    snapshotKey: saved.snapshotKey,
    openAfterRestore: true,
  });

  const connections = await browserService.getConnectionInfo([restored.newDirId]);
  const restoredOpen = (connections?.data || []).some((item) => item.dirId === restored.newDirId);

  await browserService.closeBrowser(restored.newDirId);
  await browserService.deleteBrowsers(workspaceId, [restored.newDirId]);
  bindingService.clearProfileCurrentDir(binding.profile.profile_key);
  bindingService.updateBindingVerifyResult(bindingKey, {
    type: "profile-smoke",
    sourceDirId,
    restoredDirId: restored.newDirId,
    restoredOpen,
    snapshotKey: saved.snapshotKey,
    checkedAt: new Date().toISOString(),
  });

  printJson({
    status: restoredOpen ? "ok" : "failed",
    bindingKey,
    sourceDirId,
    snapshotKey: saved.snapshotKey,
    restoredDirId: restored.newDirId,
    restoredOpen,
    archivePath: saved.archivePath,
  });
}

function createBrowserService(binding, credentialResolver) {
  const apiKey = binding.api_credential.resolved_api_key || credentialResolver.resolve(binding.api_credential.api_key_ref);
  const client = new RoxyApiClient({
    host: binding.api_credential.api_host,
    token: apiKey,
  });
  return new BrowserResourceService(client);
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

main().catch((error) => {
  console.error(JSON.stringify({
    error: {
      name: error?.name || "Error",
      message: error?.message || String(error),
    },
  }, null, 2));
  process.exitCode = 1;
});
