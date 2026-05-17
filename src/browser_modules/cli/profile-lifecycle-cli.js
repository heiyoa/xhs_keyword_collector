import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { openDatabase } from "../db/sqlite.js";
import { ProfileLifecycleService } from "../profile/profile-lifecycle-service.js";
import { parseArgs, printJson, requireOption } from "./_cli-utils.js";

async function main() {
  const { positional, options } = parseArgs();
  const command = positional[0];
  const db = openDatabase();
  const credentialResolver = new CredentialResolver();
  const bindingService = new BindingService({
    db,
    credentialResolver,
  });
  const lifecycleService = new ProfileLifecycleService({
    db,
    bindingService,
    credentialResolver,
  });

  switch (command) {
    case "asset-status":
      printJson(lifecycleService.getProfileAssetStatus(requireOption(options, "binding-key")));
      return;
    case "create-window":
      printJson(await lifecycleService.createWindowFromProfile({
        bindingKey: requireOption(options, "binding-key"),
        openAfterCreate: options["open-after-create"] === undefined
          ? true
          : options["open-after-create"] !== "false",
        targetUrl: options["target-url"],
        windowNameSuffix: options["window-name-suffix"] || "runtime",
      }));
      return;
    case "retire-window":
      printJson(await lifecycleService.retireWindow({
        bindingKey: requireOption(options, "binding-key"),
        dirId: options["dir-id"],
        deleteWindow: options["delete-window"] === undefined
          ? true
          : options["delete-window"] !== "false",
      }));
      return;
    case "archive-retire":
      printJson(await lifecycleService.archiveAndRetireWindow({
        bindingKey: requireOption(options, "binding-key"),
        sourceDirId: options["source-dir-id"],
        waitForFlushMs: toInt(options["wait-for-flush-ms"], 120000),
        deleteAfterArchive: options["delete-after-archive"] === undefined
          ? true
          : options["delete-after-archive"] !== "false",
      }));
      return;
    case "rebuild-window":
      printJson(await lifecycleService.rebuildWindowFromLatestSnapshot({
        bindingKey: requireOption(options, "binding-key"),
        snapshotKey: options["snapshot-key"],
        openAfterRestore: options["open-after-restore"] === undefined
          ? true
          : options["open-after-restore"] !== "false",
        deleteExistingCurrentDir: options["delete-existing-current-dir"] === undefined
          ? true
          : options["delete-existing-current-dir"] !== "false",
      }));
      return;
    default:
      throw new Error("Usage: profile-lifecycle-cli.js <asset-status|create-window|retire-window|archive-retire|rebuild-window> [--key=value]");
  }
}

function toInt(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return Number.parseInt(value, 10);
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
