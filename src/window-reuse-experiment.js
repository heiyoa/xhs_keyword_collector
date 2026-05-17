import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

import { RoxyApiClient, RoxyApiError, buildMinimalCreatePayload } from "./roxy-client.js";

const BILIBILI_URL = "https://www.bilibili.com/";
const ROOT_DIR = path.resolve("artifacts", "window-reuse");
const STATE_PATH = path.join(ROOT_DIR, "experiment-state.json");
const SNAPSHOT_PATH = path.join(ROOT_DIR, "snapshot.json");
const EXPERIMENT_WINDOW_PREFIX = "codex-bilibili-";

async function main() {
  await mkdir(ROOT_DIR, { recursive: true });

  const action = process.argv[2];
  switch (action) {
    case "start":
      await startExperiment();
      return;
    case "capture":
      await captureExperiment();
      return;
    case "restore":
      await restoreExperiment();
      return;
    case "cleanup":
      await cleanupExperiment();
      return;
    default:
      throw new Error("Usage: node src/window-reuse-experiment.js <start|capture|restore|cleanup> [--strategy=cookie-only|full-web-state]");
  }
}

async function startExperiment() {
  const client = new RoxyApiClient();
  const workspaceId = await resolveCurrentWorkspaceId(client);
  const projectId = await resolveDefaultProjectId(client, workspaceId);
  await cleanupStaleExperimentWindows(client, workspaceId);

  const payload = buildMinimalCreatePayload(workspaceId, {
    windowName: "codex-bilibili-source",
    projectId,
    defaultOpenUrl: [BILIBILI_URL],
    fingerInfo: {
      openWidth: "1440",
      openHeight: "900",
      randomFingerprint: false,
      clearCacheFile: false,
      clearCookie: false,
      clearLocalStorage: false,
      syncCookie: false,
      syncLocalStorage: false,
      syncIndexedDb: false,
    },
  });

  const created = await client.createBrowser(payload);
  const dirId = created?.data?.dirId;
  const opened = await client.openBrowser({
    workspaceId,
    dirId,
    forceOpen: false,
    headless: false,
  });

  await writeJson(STATE_PATH, {
    source: {
      workspaceId,
      projectId,
      dirId,
      createPayload: payload,
      openResult: opened,
      bilibiliUrl: BILIBILI_URL,
    },
    clones: [],
  });

  console.log(JSON.stringify({
    step: "start",
    message: "Source browser is ready. Complete Bilibili login manually, then run capture.",
    statePath: STATE_PATH,
    dirId,
    workspaceId,
    ws: opened?.data?.ws,
    http: opened?.data?.http,
  }, null, 2));
}

async function captureExperiment() {
  const client = new RoxyApiClient();
  const state = await readJson(STATE_PATH);
  const source = state?.source;
  ensure(source, "Missing source state. Run start first.");

  const detailResponse = await client.request("GET", "/browser/detail", {
    query: {
      workspaceId: source.workspaceId,
      dirId: source.dirId,
    },
  });
  const sourceDetail = detailResponse?.data?.rows?.[0];
  ensure(sourceDetail, "Could not load source browser detail.");

  const connectionResponse = await client.getConnectionInfo([source.dirId]);
  const sourceConnection = (connectionResponse?.data || []).find((item) => item.dirId === source.dirId);
  ensure(sourceConnection?.ws, "Source browser is not open. Please reopen or rerun start.");

  const liveState = await captureLiveBrowserState(sourceConnection.ws);
  const snapshot = {
    capturedAt: new Date().toISOString(),
    source: {
      workspaceId: source.workspaceId,
      dirId: source.dirId,
    },
    sourceDetail,
    sourceConnection,
    portableCreatePayload: buildPortableCreatePayload(sourceDetail),
    liveCookies: sanitizeCookies(liveState.storageState.cookies),
    storageState: {
      cookies: sanitizeCookies(liveState.storageState.cookies),
      origins: liveState.storageState.origins,
    },
    sessionStorageByOrigin: liveState.sessionStorageByOrigin,
    pages: liveState.pages,
    evidence: liveState.evidence,
  };

  await writeJson(SNAPSHOT_PATH, snapshot);
  await safeCloseAndDelete(client, source.workspaceId, source.dirId);

  state.snapshotPath = SNAPSHOT_PATH;
  state.capturedAt = snapshot.capturedAt;
  await writeJson(STATE_PATH, state);

  console.log(JSON.stringify({
    step: "capture",
    message: "Snapshot captured and source browser deleted.",
    snapshotPath: SNAPSHOT_PATH,
    savedCookies: snapshot.liveCookies.length,
    savedOrigins: snapshot.storageState.origins.length,
    savedSessionOrigins: Object.keys(snapshot.sessionStorageByOrigin).length,
    sourceDirId: source.dirId,
  }, null, 2));
}

async function restoreExperiment() {
  const strategy = getArgValue("--strategy") || "cookie-only";
  const client = new RoxyApiClient();
  const snapshot = await readJson(SNAPSHOT_PATH);
  ensure(snapshot?.portableCreatePayload, "Missing snapshot. Run capture first.");

  const workspaceId = await resolveCurrentWorkspaceId(client);
  const projectId = await resolveDefaultProjectId(client, workspaceId);
  await cleanupStaleExperimentWindows(client, workspaceId);

  const createPayload = {
    ...snapshot.portableCreatePayload,
    workspaceId,
    projectId,
    windowName: `codex-bilibili-${strategy}`,
    defaultOpenUrl: [BILIBILI_URL],
    cookie: snapshot.liveCookies,
  };

  const created = await client.createBrowser(createPayload);
  const dirId = created?.data?.dirId;
  const opened = await client.openBrowser({
    workspaceId,
    dirId,
    forceOpen: false,
    headless: false,
  });

  const ws = opened?.data?.ws;
  ensure(ws, "Restore browser opened without WS endpoint.");

  const restoreEvidence = await restoreAndInspect(ws, snapshot, strategy, dirId);
  const state = await readJson(STATE_PATH);
  state.clones ||= [];
  state.clones.push({
    strategy,
    workspaceId,
    projectId,
    dirId,
    openResult: opened,
    createdAt: new Date().toISOString(),
    evidence: restoreEvidence,
  });
  await writeJson(STATE_PATH, state);

  console.log(JSON.stringify({
    step: "restore",
    strategy,
    workspaceId,
    dirId,
    message: "Clone browser created and inspected.",
    evidence: restoreEvidence,
  }, null, 2));
}

async function cleanupExperiment() {
  const client = new RoxyApiClient();
  const state = await readJsonIfExists(STATE_PATH);
  if (!state) {
    console.log(JSON.stringify({ step: "cleanup", message: "No experiment state found." }, null, 2));
    return;
  }

  const targets = [];
  if (state.source?.dirId && state.source?.workspaceId) {
    targets.push({ workspaceId: state.source.workspaceId, dirId: state.source.dirId });
  }
  for (const clone of state.clones || []) {
    if (clone.workspaceId && clone.dirId) {
      targets.push({ workspaceId: clone.workspaceId, dirId: clone.dirId });
    }
  }

  for (const target of targets) {
    await safeCloseAndDelete(client, target.workspaceId, target.dirId);
  }

  await rm(ROOT_DIR, { recursive: true, force: true });
  console.log(JSON.stringify({ step: "cleanup", removedTargets: targets.length }, null, 2));
}

async function captureLiveBrowserState(wsEndpoint) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  try {
    const context = browser.contexts()[0];
    ensure(context, "No browser context available from CDP.");

    let page = context.pages().find((item) => item.url().startsWith(BILIBILI_URL));
    if (!page) {
      page = await context.newPage();
      await page.goto(BILIBILI_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
    }

    await page.bringToFront();
    await page.waitForTimeout(3000);

    const storageState = await context.storageState();
    const sessionStorageByOrigin = {};
    for (const currentPage of context.pages()) {
      const url = currentPage.url();
      if (!url.startsWith("http")) {
        continue;
      }
      const origin = new URL(url).origin;
      if (sessionStorageByOrigin[origin]) {
        continue;
      }
      try {
        const entries = await currentPage.evaluate(() => Object.entries(window.sessionStorage));
        sessionStorageByOrigin[origin] = entries.map(([name, value]) => ({ name, value }));
      } catch {}
    }

    const screenshotPath = path.join(ROOT_DIR, `source-${Date.now()}.png`);
    await safeScreenshot(page, screenshotPath);

    return {
      storageState,
      sessionStorageByOrigin,
      pages: context.pages().map((p) => ({ url: p.url() })),
      evidence: {
        screenshotPath,
        pageUrl: page.url(),
      },
    };
  } finally {
    await browser.close();
  }
}

async function restoreAndInspect(wsEndpoint, snapshot, strategy, dirId) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  try {
    const context = browser.contexts()[0];
    ensure(context, "No browser context available from clone browser.");

    if (snapshot.liveCookies.length > 0) {
      await context.addCookies(snapshot.liveCookies);
    }

    const page = await context.newPage();
    if (strategy === "full-web-state") {
      await installWebStateInitScript(page, snapshot);
    }

    await page.goto(BILIBILI_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(5000);

    if (strategy === "full-web-state") {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(5000);
    }

    const marker = await page.evaluate(async () => {
      const bodyText = document.body?.innerText || "";
      const cookieText = document.cookie || "";
      let navApi = null;
      try {
        const response = await fetch("https://api.bilibili.com/x/web-interface/nav", {
          credentials: "include",
        });
        navApi = await response.json();
      } catch {}
      return {
        hasLoginText: bodyText.includes("\u767b\u5f55"),
        hasUploadText: bodyText.includes("\u6295\u7a3f"),
        hasMessageText: bodyText.includes("\u6d88\u606f"),
        hasSessdataCookie: cookieText.includes("SESSDATA="),
        hasDedeUserIdCookie: cookieText.includes("DedeUserID="),
        hasBiliJctCookie: cookieText.includes("bili_jct="),
        navApiIsLogin: navApi?.data?.isLogin ?? null,
        navApiHasMid: Boolean(navApi?.data?.mid),
        title: document.title,
        href: location.href,
      };
    });

    const screenshotPath = path.join(ROOT_DIR, `${strategy}-${dirId}.png`);
    await safeScreenshot(page, screenshotPath);

    return {
      screenshotPath,
      pageUrl: page.url(),
      marker,
      cookieCount: snapshot.liveCookies.length,
      originCount: snapshot.storageState.origins.length,
      sessionOriginCount: Object.keys(snapshot.sessionStorageByOrigin).length,
    };
  } finally {
    await browser.close();
  }
}

async function installWebStateInitScript(page, snapshot) {
  const origins = snapshot.storageState.origins || [];
  const sessionStorageByOrigin = snapshot.sessionStorageByOrigin || {};

  await page.addInitScript(
    ({ originEntries, sessionEntriesByOrigin }) => {
      const currentOrigin = window.location.origin;
      const matchedOrigin = originEntries.find((item) => item.origin === currentOrigin);
      if (matchedOrigin?.localStorage) {
        for (const entry of matchedOrigin.localStorage) {
          window.localStorage.setItem(entry.name, entry.value);
        }
      }

      const sessionEntries = sessionEntriesByOrigin[currentOrigin] || [];
      for (const entry of sessionEntries) {
        window.sessionStorage.setItem(entry.name, entry.value);
      }
    },
    {
      originEntries: origins,
      sessionEntriesByOrigin: sessionStorageByOrigin,
    },
  );
}

function buildPortableCreatePayload(detail) {
  const payload = {
    windowName: detail.windowName || "restored-window",
    coreVersion: detail.coreVersion,
    os: detail.os,
    osVersion: detail.osVersion,
    userAgent: detail.userAgent,
    searchEngine: detail.searchEngine,
    defaultOpenUrl: Array.isArray(detail.defaultOpenUrl) ? detail.defaultOpenUrl : [BILIBILI_URL],
    windowRemark: detail.windowRemark || "",
    cookie: sanitizeCookies(detail.cookie || []),
  };

  if (detail.proxyInfo) {
    payload.proxyInfo = buildPortableProxyInfo(detail.proxyInfo);
  }
  if (detail.fingerInfo) {
    payload.fingerInfo = detail.fingerInfo;
  }

  return payload;
}

function buildPortableProxyInfo(proxyInfo) {
  if (!proxyInfo || proxyInfo.proxyCategory === "noproxy") {
    return {
      proxyMethod: "custom",
      proxyCategory: "noproxy",
      ipType: proxyInfo?.ipType || "IPV4",
    };
  }

  if (proxyInfo.proxyMethod === "custom") {
    return {
      proxyMethod: "custom",
      proxyCategory: proxyInfo.proxyCategory,
      ipType: proxyInfo.ipType || "IPV4",
      host: proxyInfo.host,
      port: proxyInfo.port,
      proxyUserName: proxyInfo.proxyUserName,
      proxyPassword: proxyInfo.proxyPassword,
      refreshUrl: proxyInfo.refreshUrl,
      checkChannel: proxyInfo.checkChannel,
    };
  }

  return {
    proxyMethod: "custom",
    proxyCategory: "noproxy",
    ipType: proxyInfo.ipType || "IPV4",
  };
}

function sanitizeCookies(cookies) {
  return (cookies || []).map((cookie) => {
    const result = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
    };
    if (cookie.path) {
      result.path = cookie.path;
    }
    return result;
  });
}

async function safeCloseAndDelete(client, workspaceId, dirId) {
  try {
    await client.closeBrowser(dirId);
  } catch {}

  try {
    await client.deleteBrowsers(workspaceId, [dirId]);
  } catch (error) {
    if (!(error instanceof RoxyApiError)) {
      throw error;
    }
  }

  await assertBrowserRemoved(client, workspaceId, dirId);
}

async function cleanupStaleExperimentWindows(client, workspaceId) {
  const browsers = await client.listBrowsers(workspaceId, { pageIndex: 1, pageSize: 100 });
  const targets = (browsers?.data?.rows || []).filter((row) =>
    typeof row.windowName === "string" && row.windowName.startsWith(EXPERIMENT_WINDOW_PREFIX),
  );

  for (const target of targets) {
    await safeCloseAndDelete(client, workspaceId, target.dirId);
  }
}

async function assertBrowserRemoved(client, workspaceId, dirId) {
  const [browsers, connections] = await Promise.all([
    client.listBrowsers(workspaceId, { dirIds: [dirId], pageIndex: 1, pageSize: 20 }),
    client.getConnectionInfo([dirId]),
  ]);

  const stillExists = (browsers?.data?.rows || []).some((row) => row.dirId === dirId);
  const stillOpen = (connections?.data || []).some((item) => item.dirId === dirId);

  if (stillExists || stillOpen) {
    throw new Error(`Browser ${dirId} is still present after close/delete.`);
  }
}

async function safeScreenshot(page, filePath) {
  try {
    await page.screenshot({
      path: filePath,
      fullPage: false,
      timeout: 15_000,
    });
  } catch (error) {
    return {
      error: error?.message || String(error),
      filePath,
    };
  }
}

async function resolveCurrentWorkspaceId(client) {
  if (process.env.ROXY_WORKSPACE_ID) {
    return Number.parseInt(process.env.ROXY_WORKSPACE_ID, 10);
  }
  const workspaces = await client.listWorkspaces();
  const workspaceId = workspaces?.data?.rows?.[0]?.id;
  ensure(workspaceId, "No workspace available.");
  return workspaceId;
}

async function resolveDefaultProjectId(client, workspaceId) {
  const workspaces = await client.listWorkspaces();
  const workspace = workspaces?.data?.rows?.find((row) => row.id === workspaceId) || workspaces?.data?.rows?.[0];
  return workspace?.project_details?.[0]?.projectId;
}

function getArgValue(prefix) {
  return process.argv.find((arg) => arg.startsWith(`${prefix}=`))?.slice(prefix.length + 1);
}

function ensure(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
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
