const DEFAULT_MIN_INTERVAL_MS = 1300;

export class RoxyApiError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "RoxyApiError";
    this.details = details;
  }
}

export class RoxyApiClient {
  constructor({
    host = process.env.ROXY_API_HOST || "http://127.0.0.1:50000",
    token = process.env.ROXY_API_KEY,
    timeoutMs = readTimeoutFromEnv(),
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  } = {}) {
    if (!token) {
      throw new RoxyApiError("Missing ROXY_API_KEY");
    }

    this.host = host.replace(/\/$/, "");
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.minIntervalMs = minIntervalMs;
    this.nextAvailableAt = 0;
  }

  async request(method, path, { query, body } = {}) {
    await this.#throttle();

    const url = new URL(`${this.host}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") {
          continue;
        }
        url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          token: this.token,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new RoxyApiError(`HTTP ${response.status}`, data);
      }
      if (typeof data?.code === "number" && data.code !== 0) {
        throw new RoxyApiError(`Roxy API error ${data.code}: ${data.msg}`, data);
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new RoxyApiError(`Request timeout after ${this.timeoutMs}ms`, {
          method,
          path,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  health() {
    return this.request("GET", "/health");
  }

  listWorkspaces({ pageIndex = 1, pageSize = 20 } = {}) {
    return this.request("GET", "/browser/workspace", {
      query: {
        page_index: pageIndex,
        page_size: pageSize,
      },
    });
  }

  listBrowsers(workspaceId, { pageIndex = 1, pageSize = 20, windowName, dirIds } = {}) {
    return this.request("GET", "/browser/list_v3", {
      query: {
        workspaceId,
        page_index: pageIndex,
        page_size: pageSize,
        windowName,
        dirIds,
      },
    });
  }

  getConnectionInfo(dirIds = []) {
    return this.request("GET", "/browser/connection_info", {
      query: {
        dirIds,
      },
    });
  }

  createBrowser(payload) {
    return this.request("POST", "/browser/create", { body: payload });
  }

  openBrowser({ workspaceId, dirId, args = [], forceOpen = false, headless = false }) {
    return this.request("POST", "/browser/open", {
      body: {
        workspaceId,
        dirId,
        args,
        forceOpen,
        headless,
      },
    });
  }

  closeBrowser(dirId) {
    return this.request("POST", "/browser/close", {
      body: { dirId },
    });
  }

  deleteBrowsers(workspaceId, dirIds) {
    return this.request("POST", "/browser/delete", {
      body: {
        workspaceId,
        dirIds,
      },
    });
  }

  async #throttle() {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.minIntervalMs;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export function buildMinimalCreatePayload(workspaceId, overrides = {}) {
  return {
    workspaceId,
    windowName: "codex-minimal-check",
    os: "Windows",
    osVersion: "11",
    proxyInfo: {
      proxyMethod: "custom",
      proxyCategory: "noproxy",
      ipType: "IPV4",
    },
    fingerInfo: {
      openWidth: "1280",
      openHeight: "720",
      randomFingerprint: false,
      clearCacheFile: false,
      clearCookie: false,
      clearLocalStorage: false,
    },
    ...overrides,
  };
}

function readTimeoutFromEnv() {
  const raw = process.env.ROXY_TIMEOUT_MS || process.env.ROXY_TIMEOUT;
  if (!raw) {
    return 30_000;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 30_000 : parsed;
}
