import { RoxyApiClient, RoxyApiError, buildMinimalCreatePayload } from "./roxy-client.js";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toInt(value) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function pickFirstWorkspaceId(workspacesResponse) {
  const first = workspacesResponse?.data?.rows?.[0];
  return typeof first?.id === "number" ? first.id : undefined;
}

async function run() {
  const client = new RoxyApiClient();
  const createEnabled = hasFlag("--create");
  const openCreated = hasFlag("--open-created");
  const cleanupCreated = hasFlag("--cleanup-created");

  const summary = {
    checkedAt: new Date().toISOString(),
    host: client.host,
    validations: {},
  };

  summary.validations.health = await client.health();
  summary.validations.connectionInfo = await client.getConnectionInfo();

  let workspaceId = toInt(process.env.ROXY_WORKSPACE_ID);

  try {
    summary.validations.workspaces = await client.listWorkspaces();
    workspaceId ||= pickFirstWorkspaceId(summary.validations.workspaces);
  } catch (error) {
    summary.validations.workspaces = {
      error: normalizeError(error),
      note: "Workspace-dependent checks were skipped because workspace listing failed.",
    };
  }

  if (workspaceId) {
    summary.workspaceId = workspaceId;
    summary.validations.browsers = await client.listBrowsers(workspaceId);
  }

  if (createEnabled) {
    if (!workspaceId) {
      throw new RoxyApiError(
        "Creation requested but no workspaceId is available. Set ROXY_WORKSPACE_ID or fix workspace listing first.",
      );
    }

    const createPayload = buildMinimalCreatePayload(workspaceId);
    summary.createPayload = createPayload;
    summary.validations.createBrowser = await client.createBrowser(createPayload);
    const dirId = summary.validations.createBrowser?.data?.dirId;

    if (openCreated) {
      summary.validations.openCreatedBrowser = await client.openBrowser({
        workspaceId,
        dirId,
      });
    }

    if (cleanupCreated) {
      if (openCreated) {
        summary.validations.closeCreatedBrowser = await client.closeBrowser(dirId);
      }
      summary.validations.deleteCreatedBrowser = await client.deleteBrowsers(workspaceId, [dirId]);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

function normalizeError(error) {
  if (error instanceof RoxyApiError) {
    return {
      name: error.name,
      message: error.message,
      details: error.details,
    };
  }

  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
  };
}

run().catch((error) => {
  console.error(JSON.stringify({ error: normalizeError(error) }, null, 2));
  process.exitCode = 1;
});
