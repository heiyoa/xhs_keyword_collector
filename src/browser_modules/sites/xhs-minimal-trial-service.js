import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { BrowserModuleError } from "../core/browser-errors.js";
import { BrowserResourceService } from "../core/browser-resource-service.js";
import { RoxyApiClient } from "../core/roxy-client.js";
import { openDatabase, nowIso } from "../db/sqlite.js";

const DEFAULT_XHS_URL = "https://creator.xiaohongshu.com/";

export class XhsMinimalTrialService {
  constructor({
    db = openDatabase(),
    bindingService = new BindingService({
      db,
      credentialResolver: new CredentialResolver(),
    }),
    credentialResolver = new CredentialResolver(),
  } = {}) {
    this.db = db;
    this.bindingService = bindingService;
    this.credentialResolver = credentialResolver;
  }

  async run({ bindingKey, runKey, taskPayload }) {
    const payload = normalizeTaskPayload(taskPayload);
    const startedAt = nowIso();

    const runId = this.#startRun({
      runKey,
      bindingKey,
      scriptName: "xhs-minimal-trial",
      machineRole: payload.machine_browser_binding_key ? "leviathan" : "local",
      startedAt,
    });

    try {
      const result = await this.#execute(bindingKey, runKey, payload);
      this.#finishRun({
        runId,
        status: result.status === "ok" ? "success" : "failed",
        finishedAt: nowIso(),
        resultJson: result,
      });
      return result;
    } catch (error) {
      this.#finishRun({
        runId,
        status: "failed",
        finishedAt: nowIso(),
        errorText: error?.message || String(error),
      });
      throw error;
    }
  }

  async #execute(bindingKey, runKey, payload) {
    const businessBinding = this.bindingService.resolveBinding(bindingKey, { resolveSecrets: true });
    if (businessBinding.profile.platform !== "xiaohongshu") {
      throw new BrowserModuleError(`Binding ${bindingKey} is not xiaohongshu`, {
        platform: businessBinding.profile.platform,
      });
    }

    const machineBinding = payload.machine_browser_binding_key
      ? this.bindingService.resolveMachineBrowserBinding(payload.machine_browser_binding_key, { resolveSecrets: true })
      : null;

    const execution = buildExecutionContext(businessBinding, machineBinding);
    const baseResult = {
      run_key: runKey,
      binding_key: bindingKey,
      task_payload: payload,
      binding_resolved: true,
      execution_context: {
        workspace_id: execution.workspaceId,
        project_id: execution.projectId,
        machine_browser_binding_key: payload.machine_browser_binding_key || null,
        api_host: execution.apiHost,
      },
    };

    if (payload.mode === "resolve") {
      const result = {
        status: "ok",
        mode: "resolve",
        ...baseResult,
      };
      this.bindingService.updateBindingVerifyResult(bindingKey, {
        type: "xhs-resolve",
        checkedAt: nowIso(),
        result,
      });
      return result;
    }

    const browserService = new BrowserResourceService(new RoxyApiClient({
      host: execution.apiHost,
      token: execution.apiKey,
      timeoutMs: execution.timeoutMs,
    }));

    let health;
    let workspaces;
    try {
      health = await browserService.health();
      workspaces = await browserService.listWorkspaces();
    } catch (error) {
      const result = {
        status: "failed",
        mode: payload.mode,
        ...baseResult,
        failed_stage: "api-health",
        error: {
          name: error?.name || "Error",
          message: error?.message || String(error),
        },
      };
      this.bindingService.updateBindingVerifyResult(bindingKey, {
        type: "xhs-api-health-failed",
        checkedAt: nowIso(),
        result,
      });
      return result;
    }

    if (payload.mode === "preflight") {
      const result = {
        status: "ok",
        mode: "preflight",
        ...baseResult,
        preflight: {
          health,
          workspace_total: workspaces?.data?.total ?? null,
          workspace_id: execution.workspaceId,
          project_id: execution.projectId,
          machine_browser_binding_key: payload.machine_browser_binding_key || null,
        },
      };
      this.bindingService.updateBindingVerifyResult(bindingKey, {
        type: "xhs-preflight",
        checkedAt: nowIso(),
        result,
      });
      return result;
    }

    const windowName = `${businessBinding.profile.profile_key}-${runKey}`;
    const createPayload = {
      workspaceId: execution.workspaceId,
      projectId: execution.projectId,
      windowName,
      os: businessBinding.profile.os_name || "Windows",
      osVersion: businessBinding.profile.os_version || "11",
      coreVersion: businessBinding.profile.browser_core_version,
      userAgent: businessBinding.profile.user_agent,
      defaultOpenUrl: [payload.target_url || DEFAULT_XHS_URL],
      proxyInfo: execution.proxyInfo,
      fingerInfo: businessBinding.profile.fingerprint || {
        openWidth: "1280",
        openHeight: "720",
        randomFingerprint: false,
        clearCacheFile: false,
        clearCookie: false,
        clearLocalStorage: false,
      },
    };

    const created = await browserService.createBrowser(removeUndefinedDeep(createPayload));
    const dirId = created?.data?.dirId;
    const opened = await browserService.openBrowser({
      workspaceId: execution.workspaceId,
      dirId,
      forceOpen: false,
      headless: false,
    });
    const connectionInfo = await browserService.getConnectionInfo([dirId]);
    const openSession = (connectionInfo?.data || []).find((item) => item.dirId === dirId);
    const smokePassed = Boolean(openSession?.ws || opened?.data?.ws);

    if (payload.close_after_run !== false) {
      await browserService.closeBrowser(dirId);
    }
    if (payload.delete_after_run !== false) {
      await browserService.deleteBrowsers(execution.workspaceId, [dirId]);
    }
    await sleep(3_000);

    const cleanupCheck = await browserService.getConnectionInfo([dirId]);
    const cleaned = !((cleanupCheck?.data || []).some((item) => item.dirId === dirId));

    const result = {
      status: smokePassed && cleaned ? "ok" : "failed",
      mode: "smoke",
      ...baseResult,
      smoke: {
        window_name: windowName,
        dir_id: dirId,
        opened_ws: openSession?.ws || opened?.data?.ws || null,
        opened_http: openSession?.http || opened?.data?.http || null,
        smoke_passed: smokePassed,
        cleanup_passed: cleaned,
      },
    };

    this.bindingService.updateBindingVerifyResult(bindingKey, {
      type: "xhs-smoke",
      checkedAt: nowIso(),
      result,
    });
    return result;
  }

  #startRun({ runKey, bindingKey, scriptName, machineRole, startedAt }) {
    const binding = this.db.prepare("SELECT id FROM bindings WHERE binding_key = ?").get(bindingKey);
    if (!binding) {
      throw new BrowserModuleError(`Binding not found for run: ${bindingKey}`);
    }

    this.db.prepare(`
      INSERT INTO runs (
        run_key, binding_id, script_name, machine_role, status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(runKey, binding.id, scriptName, machineRole, "running", startedAt);

    return this.db.prepare("SELECT id FROM runs WHERE run_key = ?").get(runKey)?.id;
  }

  #finishRun({ runId, status, finishedAt, resultJson, errorText }) {
    this.db.prepare(`
      UPDATE runs
      SET status = ?, finished_at = ?, result_json = ?, error_text = ?
      WHERE id = ?
    `).run(
      status,
      finishedAt,
      resultJson ? JSON.stringify(resultJson) : null,
      errorText || null,
      runId,
    );
  }
}

function normalizeTaskPayload(taskPayload) {
  if (!taskPayload) {
    return {
      mode: "preflight",
      target_url: DEFAULT_XHS_URL,
      close_after_run: true,
      delete_after_run: true,
    };
  }

  return {
    mode: taskPayload.mode || "preflight",
    target_url: taskPayload.target_url || DEFAULT_XHS_URL,
    machine_browser_binding_key: taskPayload.machine_browser_binding_key || null,
    close_after_run: taskPayload.close_after_run !== false,
    delete_after_run: taskPayload.delete_after_run !== false,
  };
}

function buildExecutionContext(businessBinding, machineBinding) {
  const apiSource = machineBinding?.api_credential || businessBinding.api_credential;
  const apiKey = apiSource.resolved_api_key || apiSource.api_key_ref;
  if (!apiKey) {
    throw new BrowserModuleError("Could not resolve API key for execution context");
  }

  let proxyInfo = businessBinding.profile.proxy_template || {
    proxyMethod: "custom",
    proxyCategory: "noproxy",
    ipType: "IPV4",
  };

  if (businessBinding.ip_resource?.host) {
    proxyInfo = {
      proxyMethod: "custom",
      proxyCategory: businessBinding.ip_resource.proxy_type || "socks5",
      ipType: "IPV4",
      host: businessBinding.ip_resource.host,
      port: String(businessBinding.ip_resource.port),
      proxyUserName: businessBinding.ip_resource.resolved_username || undefined,
      proxyPassword: businessBinding.ip_resource.resolved_password || undefined,
    };
  }

  return {
    apiHost: apiSource.api_host,
    apiKey,
    workspaceId: apiSource.workspace_id || businessBinding.profile.workspace_id,
    projectId: apiSource.project_id || businessBinding.profile.project_id,
    timeoutMs: readTimeoutFromEnv(),
    proxyInfo,
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

function readTimeoutFromEnv() {
  const raw = process.env.ROXY_TIMEOUT_MS || process.env.ROXY_TIMEOUT;
  if (!raw) {
    return 120_000;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 120_000 : parsed;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
