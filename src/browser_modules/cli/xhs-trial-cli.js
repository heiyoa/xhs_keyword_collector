import { readFileSync } from "node:fs";
import { parseArgs, printJson, requireOption } from "./_cli-utils.js";
import { XhsMinimalTrialService } from "../sites/xhs-minimal-trial-service.js";

async function main() {
  const { positional, options } = parseArgs();
  const command = positional[0];
  if (command !== "run") {
    throw new Error("Usage: xhs-trial-cli.js run --binding-key=<binding_key> --run-key=<run_key> [--task-payload=<json_or_@file>]");
  }

  const service = new XhsMinimalTrialService();
  const result = await service.run({
    bindingKey: requireOption(options, "binding-key"),
    runKey: requireOption(options, "run-key"),
    taskPayload: parseTaskPayload(options["task-payload"]),
  });
  printJson(result);
}

function parseTaskPayload(raw) {
  if (!raw) {
    return null;
  }
  if (raw.startsWith("@")) {
    return JSON.parse(readFileSync(raw.slice(1), "utf8"));
  }
  return JSON.parse(raw);
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
