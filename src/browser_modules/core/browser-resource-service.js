import { buildMinimalCreatePayload, RoxyApiClient } from "./roxy-client.js";

export class BrowserResourceService {
  constructor(client = new RoxyApiClient()) {
    this.client = client;
  }

  health() {
    return this.client.health();
  }

  listWorkspaces(options) {
    return this.client.listWorkspaces(options);
  }

  async resolveCurrentWorkspaceId() {
    if (process.env.ROXY_WORKSPACE_ID) {
      return Number.parseInt(process.env.ROXY_WORKSPACE_ID, 10);
    }
    const workspaces = await this.listWorkspaces();
    return workspaces?.data?.rows?.[0]?.id;
  }

  async resolveDefaultProjectId(workspaceId) {
    const workspaces = await this.listWorkspaces();
    const workspace = workspaces?.data?.rows?.find((row) => row.id === workspaceId) || workspaces?.data?.rows?.[0];
    return workspace?.project_details?.[0]?.projectId;
  }

  listBrowsers(workspaceId, options) {
    return this.client.listBrowsers(workspaceId, options);
  }

  getBrowserDetail(workspaceId, dirId) {
    return this.client.request("GET", "/browser/detail", {
      query: {
        workspaceId,
        dirId,
      },
    });
  }

  getConnectionInfo(dirIds) {
    return this.client.getConnectionInfo(dirIds);
  }

  createBrowser(payload) {
    return this.client.createBrowser(payload);
  }

  createMinimalBrowser(workspaceId, overrides = {}) {
    return this.client.createBrowser(buildMinimalCreatePayload(workspaceId, overrides));
  }

  openBrowser(options) {
    return this.client.openBrowser(options);
  }

  closeBrowser(dirId) {
    return this.client.closeBrowser(dirId);
  }

  deleteBrowsers(workspaceId, dirIds) {
    return this.client.deleteBrowsers(workspaceId, dirIds);
  }

  async closeIfOpen(dirId) {
    const response = await this.getConnectionInfo([dirId]);
    const isOpen = (response?.data || []).some((item) => item.dirId === dirId);
    if (isOpen) {
      await this.closeBrowser(dirId);
      return true;
    }
    return false;
  }
}
