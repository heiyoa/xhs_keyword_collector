import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { openDatabase } from "../db/sqlite.js";
import { ProfileArchiveService } from "../profile/profile-archive-service.js";
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
  const archiveService = new ProfileArchiveService({
    bindingService,
    credentialResolver,
  });

  switch (command) {
    case "locate":
      printJson({
        dirId: requireOption(options, "dir-id"),
        profilePath: archiveService.locateProfilePath(requireOption(options, "dir-id")),
      });
      return;
    case "save":
      printJson(await archiveService.saveProfileSnapshot({
        bindingKey: requireOption(options, "binding-key"),
        sourceDirId: options["source-dir-id"],
        waitForFlushMs: toInt(options["wait-for-flush-ms"], 5000),
      }));
      return;
    case "restore":
      printJson(await archiveService.restoreProfileSnapshot({
        bindingKey: requireOption(options, "binding-key"),
        snapshotKey: requireOption(options, "snapshot-key"),
        openAfterRestore: options["open-after-restore"] === undefined
          ? true
          : options["open-after-restore"] !== "false",
        deleteExistingCurrentDir: Boolean(options["delete-existing-current-dir"]),
      }));
      return;
    default:
      throw new Error("Usage: profile-archive-cli.js <locate|save|restore> [--key=value]");
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
