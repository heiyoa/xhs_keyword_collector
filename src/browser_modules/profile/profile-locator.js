import { existsSync } from "node:fs";
import path from "node:path";

import { ProfilePathNotFoundError } from "../core/browser-errors.js";

const DEFAULT_ROXY_ROOT = path.resolve(process.env.APPDATA || "", "RoxyBrowser");

export class ProfileLocator {
  constructor({ roxyRoot = DEFAULT_ROXY_ROOT } = {}) {
    this.roxyRoot = roxyRoot;
  }

  locateProfilePath(dirId) {
    const attemptedPaths = [
      path.join(this.roxyRoot, "browser-cache", dirId),
      path.join(this.roxyRoot, "browser-cache", String(dirId).toLowerCase()),
      path.join(this.roxyRoot, "browser-cache", String(dirId).toUpperCase()),
    ];

    for (const candidate of attemptedPaths) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new ProfilePathNotFoundError(dirId, attemptedPaths);
  }
}
