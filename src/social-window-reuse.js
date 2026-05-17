import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

import { RoxyApiClient, RoxyApiError } from "./roxy-client.js";

const ROOT_DIR = path.resolve("artifacts", "social-window-reuse");

const SITE_CONFIGS = {
  bilibili: {
    startUrl: "https://www.bilibili.com/",
    canonicalOrigin: "https://www.bilibili.com",
    windowPrefix: "codex-bilibili-",
    bodyMarkers: ["登录", "投稿", "消息"],
    validate: async ({ page, context }) => {
      const pageData = await page.evaluate(async () => {
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
          href: location.href,
          title: document.title,
          bodyText,
          cookieText,
          localStorageKeys: Object.keys(localStorage),
          sessionStorageKeys: Object.keys(sessionStorage),
          navApiIsLogin: navApi?.data?.isLogin ?? null,
          navApiHasMid: Boolean(navApi?.data?.mid),
        };
      });

      const contextCookies = await context.cookies();
      const cookieNames = contextCookies.map((cookie) => cookie.name);
      return {
        href: pageData.href,
        title: pageData.title,
        hasLoginText: pageData.bodyText.includes("\u767b\u5f55"),
        hasUploadText: pageData.bodyText.includes("\u6295\u7a3f"),
        hasMessageText: pageData.bodyText.includes("\u6d88\u606f"),
        hasSessdataCookie: cookieNames.includes("SESSDATA"),
        hasDedeUserIdCookie: cookieNames.includes("DedeUserID"),
        hasBiliJctCookie: cookieNames.includes("bili_jct"),
        navApiIsLogin: pageData.navApiIsLogin,
        navApiHasMid: pageData.navApiHasMid,
      };
    },
    classify: (marker) => ({
      reusable: marker.navApiIsLogin === true && marker.navApiHasMid === true,
      level:
        marker.navApiIsLogin === true && marker.navApiHasMid === true
          ? "can-reuse-directly"
          : "not-proven",
    }),
  },
  xiaohongshu: {
    startUrl: "https://creator.xiaohongshu.com/",
    canonicalOrigin: "https://creator.xiaohongshu.com",
    windowPrefix: "codex-xiaohongshu-",
    validate: async ({ page, context }) => {
      const pageData = await page.evaluate(() => ({
        href: location.href,
        title: document.title,
        bodyText: document.body?.innerText || "",
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
      }));

      const contextCookies = await context.cookies();
      const cookieNames = contextCookies.map((cookie) => cookie.name);
      return {
        href: pageData.href,
        title: pageData.title,
        hasHomePath: pageData.href.includes("/new/home"),
        hasPublishText: pageData.bodyText.includes("\u53d1\u5e03\u7b14\u8bb0"),
        hasNoteManageText: pageData.bodyText.includes("\u7b14\u8bb0\u7ba1\u7406"),
        hasDashboardText: pageData.bodyText.includes("\u6570\u636e\u770b\u677f"),
        hasCreatorSessionCookie: cookieNames.includes("galaxy_creator_session_id"),
        hasAccessTokenCookie: cookieNames.includes("access-token-creator.xiaohongshu.com"),
        hasUserIdCookie: cookieNames.includes("x-user-id-creator.xiaohongshu.com"),
        hasUserInfoStorage: pageData.localStorageKeys.includes("USER_INFO"),
        hasBizUserInfoStorage: pageData.localStorageKeys.includes("USER_INFO_FOR_BIZ"),
        localStorageKeys: pageData.localStorageKeys,
        sessionStorageKeys: pageData.sessionStorageKeys,
      };
    },
    classify: (marker) => {
      const cookieOkay =
        marker.hasCreatorSessionCookie && marker.hasAccessTokenCookie && marker.hasUserIdCookie;
      const pageOkay = marker.hasHomePath && marker.hasPublishText && marker.hasNoteManageText;
      const storageOkay = marker.hasUserInfoStorage || marker.hasBizUserInfoStorage;
      return {
        reusable: cookieOkay && pageOkay,
        level: cookieOkay && pageOkay
          ? "can-reuse-directly"
          : storageOkay
            ? "needs-more-validation"
            : "high-risk",
      };
    },
  },
  "wechat-channels": {
    startUrl: "https://channels.weixin.qq.com/",
    canonicalOrigin: "https://channels.weixin.qq.com",
    windowPrefix: "codex-wechat-channels-",
    validate: async ({ page, context }) => {
      const pageData = await page.evaluate(() => ({
        href: location.href,
        title: document.title,
        bodyText: document.body?.innerText || "",
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
      }));

      const contextCookies = await context.cookies();
      const cookieNames = contextCookies.map((cookie) => cookie.name);
      return {
        href: pageData.href,
        title: pageData.title,
        hasPlatformPath: pageData.href.includes("/platform"),
        hasContentManageText: pageData.bodyText.includes("\u5185\u5bb9\u7ba1\u7406"),
        hasInteractManageText: pageData.bodyText.includes("\u4e92\u52a8\u7ba1\u7406"),
        hasDataCenterText: pageData.bodyText.includes("\u6570\u636e\u4e2d\u5fc3"),
        hasChannelIdText: pageData.bodyText.includes("\u89c6\u9891\u53f7ID"),
        hasFollowersText: pageData.bodyText.includes("\u5173\u6ce8\u8005"),
        hasYesterdayDataText: pageData.bodyText.includes("\u6628\u65e5\u6570\u636e"),
        hasSessionidCookie: cookieNames.includes("sessionid"),
        hasWxuinCookie: cookieNames.includes("wxuin"),
        hasFinderLoginTokenStorage: pageData.localStorageKeys.includes("finder_login_token"),
        hasFinderUinStorage: pageData.localStorageKeys.includes("finder_uin"),
        hasHomeSessionStorage: pageData.sessionStorageKeys.includes("Home"),
        localStorageKeys: pageData.localStorageKeys,
        sessionStorageKeys: pageData.sessionStorageKeys,
      };
    },
    classify: (marker) => {
      const cookieOkay = marker.hasSessionidCookie && marker.hasWxuinCookie;
      const pageOkay =
        marker.hasPlatformPath &&
        marker.hasChannelIdText &&
        marker.hasFollowersText &&
        marker.hasYesterdayDataText;
      const storageOkay = marker.hasFinderLoginTokenStorage && marker.hasFinderUinStorage;
      return {
        reusable: cookieOkay && pageOkay,
        level: cookieOkay && pageOkay
          ? "can-reuse-directly"
          : storageOkay
            ? "needs-more-validation"
            : "high-risk",
      };
    },
  },
};

async function main() {
  const action = process.argv[2];
  const siteName = getRequiredArg("--site");
  const site = SITE_CONFIGS[siteName];
  if (!site) {
    throw new Error(`Unsupported site: ${siteName}`);
  }

  await mkdir(getSiteDir(siteName), { recursive: true });

  switch (action) {
    case "capture-open":
      await captureOpenSource(siteName, site);
      return;
    case "restore":
      await restoreSite(siteName, site);
      return;
    case "cleanup-site":
      await cleanupSite(siteName, site);
      return;
    default:
      throw new Error("Usage: node src/social-window-reuse.js <capture-open|restore|cleanup-site> --site=<name> [--source-dir-id=<id>] [--strategy=cookie-only|full-web-state]");
  }
}

async function captureOpenSource(siteName, site) {
  const client = new RoxyApiClient();
  const workspaceId = await resolveCurrentWorkspaceId(client);
  const dirId = getRequiredArg("--source-dir-id");

  const detailResponse = await client.request("GET", "/browser/detail", {
    query: {
      workspaceId,
      dirId,
    },
  });
  const sourceDetail = detailResponse?.data?.rows?.[0];
  ensure(sourceDetail, `Could not load detail for ${dirId}`);

  const connectionResponse = await client.getConnectionInfo([dirId]);
  const sourceConnection = (connectionResponse?.data || []).find((item) => item.dirId === dirId);
  ensure(sourceConnection?.ws, `Source browser ${dirId} is not open`);

  const liveState = await captureLiveBrowserState(site, sourceConnection.ws);
  const snapshot = {
    site: siteName,
    capturedAt: new Date().toISOString(),
    source: {
      workspaceId,
      dirId,
    },
    sourceDetail,
    sourceConnection,
    portableCreatePayload: buildPortableCreatePayload(sourceDetail, site.startUrl),
    liveCookies: sanitizeCookies(liveState.storageState.cookies),
    storageState: {
      cookies: sanitizeCookies(liveState.storageState.cookies),
      origins: liveState.storageState.origins,
    },
    sessionStorageByOrigin: liveState.sessionStorageByOrigin,
    pages: liveState.pages,
    evidence: liveState.evidence,
    sourceMarker: liveState.marker,
    sourceClassification: site.classify(liveState.marker),
  };

  await writeJson(getSnapshotPath(siteName), snapshot);
  await writeJson(getStatePath(siteName), {
    site: siteName,
    source: {
      workspaceId,
      dirId,
    },
    clones: [],
    snapshotPath: getSnapshotPath(siteName),
  });

  await safeCloseAndDelete(client, workspaceId, dirId);

  console.log(JSON.stringify({
    step: "capture-open",
    site: siteName,
    sourceDirId: dirId,
    snapshotPath: getSnapshotPath(siteName),
    savedCookies: snapshot.liveCookies.length,
    savedOrigins: snapshot.storageState.origins.length,
    savedSessionOrigins: Object.keys(snapshot.sessionStorageByOrigin).length,
    sourceMarker: snapshot.sourceMarker,
    sourceClassification: snapshot.sourceClassification,
  }, null, 2));
}

async function restoreSite(siteName, site) {
  const strategy = getArgValue("--strategy") || "cookie-only";
  const client = new RoxyApiClient();
  const snapshot = await readJson(getSnapshotPath(siteName));
  ensure(snapshot?.portableCreatePayload, `Missing snapshot for ${siteName}`);

  const workspaceId = await resolveCurrentWorkspaceId(client);
  const projectId = await resolveDefaultProjectId(client, workspaceId);
  await cleanupStaleExperimentWindows(client, workspaceId, site.windowPrefix);

  const createPayload = {
    ...snapshot.portableCreatePayload,
    workspaceId,
    projectId,
    windowName: `${site.windowPrefix}${strategy}`,
    defaultOpenUrl: [site.startUrl],
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
  ensure(opened?.data?.ws, `Restore browser for ${siteName} opened without WS endpoint.`);

  const evidence = await restoreAndInspect(site, opened.data.ws, snapshot, strategy, dirId);
  const classification = site.classify(evidence.marker);

  const state = (await readJsonIfExists(getStatePath(siteName))) || { site: siteName, clones: [] };
  state.clones ||= [];
  state.clones.push({
    strategy,
    workspaceId,
    projectId,
    dirId,
    createdAt: new Date().toISOString(),
    evidence,
    classification,
  });
  await writeJson(getStatePath(siteName), state);

  console.log(JSON.stringify({
    step: "restore",
    site: siteName,
    strategy,
    workspaceId,
    dirId,
    evidence,
    classification,
  }, null, 2));
}

async function cleanupSite(siteName, site) {
  const client = new RoxyApiClient();
  const workspaceId = await resolveCurrentWorkspaceId(client);
  await cleanupStaleExperimentWindows(client, workspaceId, site.windowPrefix);
  const purgedArtifacts = hasFlag("--purge-artifacts");
  if (purgedArtifacts) {
    await rm(getSiteDir(siteName), { recursive: true, force: true });
  }
  console.log(JSON.stringify({ step: "cleanup-site", site: siteName, workspaceId, purgedArtifacts }, null, 2));
}

async function captureLiveBrowserState(site, wsEndpoint) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  try {
    const context = browser.contexts()[0];
    ensure(context, "No browser context available from CDP.");

    let page = context.pages().find((item) => item.url().startsWith(site.canonicalOrigin));
    if (!page) {
      page = await context.newPage();
      await page.goto(site.startUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
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

    const marker = await site.validate({ page, context });
    const screenshotPath = path.join(getSiteDirFromConfig(site), `source-${Date.now()}.png`);
    await safeScreenshot(page, screenshotPath);

    return {
      storageState,
      sessionStorageByOrigin,
      pages: context.pages().map((p) => ({ url: p.url() })),
      marker,
      evidence: {
        screenshotPath,
        pageUrl: page.url(),
      },
    };
  } finally {
    await browser.close();
  }
}

async function restoreAndInspect(site, wsEndpoint, snapshot, strategy, dirId) {
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

    await page.goto(site.startUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(5000);

    if (strategy === "full-web-state") {
      try {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.waitForTimeout(5000);
      } catch {}
    }

    const marker = await site.validate({ page, context });
    const screenshotPath = path.join(getSiteDirFromConfig(site), `${strategy}-${dirId}.png`);
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

function buildPortableCreatePayload(detail, startUrl) {
  const payload = {
    windowName: detail.windowName || "restored-window",
    coreVersion: detail.coreVersion,
    os: detail.os,
    osVersion: detail.osVersion,
    userAgent: detail.userAgent,
    searchEngine: detail.searchEngine,
    defaultOpenUrl: Array.isArray(detail.defaultOpenUrl) ? detail.defaultOpenUrl : [startUrl],
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
    if (cookie.expires && Number.isFinite(cookie.expires) && cookie.expires > 0) {
      result.expires = cookie.expires;
    }
    if (typeof cookie.httpOnly === "boolean") {
      result.httpOnly = cookie.httpOnly;
    }
    if (typeof cookie.secure === "boolean") {
      result.secure = cookie.secure;
    }
    if (cookie.sameSite) {
      result.sameSite = cookie.sameSite;
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

async function cleanupStaleExperimentWindows(client, workspaceId, windowPrefix) {
  const browsers = await client.listBrowsers(workspaceId, { pageIndex: 1, pageSize: 100 });
  const targets = (browsers?.data?.rows || []).filter((row) =>
    typeof row.windowName === "string" && row.windowName.startsWith(windowPrefix),
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
  } catch {}
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

function getSiteDir(siteName) {
  return path.join(ROOT_DIR, siteName);
}

function getSiteDirFromConfig(site) {
  const siteName = Object.entries(SITE_CONFIGS).find(([, value]) => value === site)?.[0];
  return getSiteDir(siteName);
}

function getStatePath(siteName) {
  return path.join(getSiteDir(siteName), "state.json");
}

function getSnapshotPath(siteName) {
  return path.join(getSiteDir(siteName), "snapshot.json");
}

function getArgValue(prefix) {
  return process.argv.find((arg) => arg.startsWith(`${prefix}=`))?.slice(prefix.length + 1);
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getRequiredArg(prefix) {
  const value = getArgValue(prefix);
  ensure(value, `Missing required argument ${prefix}`);
  return value;
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
