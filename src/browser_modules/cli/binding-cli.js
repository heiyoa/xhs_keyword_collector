import { BindingService } from "../bindings/binding-service.js";
import { CredentialResolver } from "../bindings/credential-resolver.js";
import { openDatabase } from "../db/sqlite.js";
import { parseArgs, printJson, requireOption } from "./_cli-utils.js";

async function main() {
  const { positional, options } = parseArgs();
  const command = positional[0];
  const db = openDatabase();
  const service = new BindingService({
    db,
    credentialResolver: new CredentialResolver(),
  });

  switch (command) {
    case "init-db":
      printJson({
        status: "ok",
        dbPath: process.env.BROWSER_FOUNDATION_DB_PATH || "data/browser_foundation.db",
      });
      return;
    case "register-profile":
      printJson(service.registerProfile({
        profile_key: requireOption(options, "profile-key"),
        platform: requireOption(options, "platform"),
        display_name: options["display-name"],
        workspace_id: toNullableInt(options["workspace-id"]),
        project_id: toNullableInt(options["project-id"]),
        current_dir_id: options["current-dir-id"],
        browser_core_version: options["browser-core-version"],
        user_agent: options["user-agent"],
        os_name: options["os-name"],
        os_version: options["os-version"],
        fingerprint: parseJsonOption(options.fingerprint),
        proxy_template: parseJsonOption(options["proxy-template"]),
        default_open_urls: parseJsonOption(options["default-open-urls"]) || [],
        local_profile_path: options["local-profile-path"],
        archive_root_path: options["archive-root-path"],
        status: options.status,
      }));
      return;
    case "register-account":
      printJson(service.registerAccount({
        account_key: requireOption(options, "account-key"),
        platform: requireOption(options, "platform"),
        login_name: requireOption(options, "login-name"),
        display_name: options["display-name"],
        credential_ref: options["credential-ref"],
        credential_type: options["credential-type"],
        notes: options.notes,
        status: options.status,
      }));
      return;
    case "register-proxy":
      printJson(service.registerProxy({
        proxy_key: requireOption(options, "proxy-key"),
        proxy_type: requireOption(options, "proxy-type"),
        host: options.host,
        port: toNullableInt(options.port),
        username_ref: options["username-ref"],
        password_ref: options["password-ref"],
        provider: options.provider,
        country: options.country,
        region: options.region,
        city: options.city,
        exit_ip: options["exit-ip"],
        check_url: options["check-url"],
        status: options.status,
      }));
      return;
    case "register-api":
      printJson(service.registerApiCredential({
        credential_key: requireOption(options, "credential-key"),
        provider: requireOption(options, "provider"),
        api_host: requireOption(options, "api-host"),
        api_key_ref: requireOption(options, "api-key-ref"),
        workspace_id: toNullableInt(options["workspace-id"]),
        project_id: toNullableInt(options["project-id"]),
        status: options.status,
      }));
      return;
    case "register-machine":
      printJson(service.registerMachine({
        machine_key: requireOption(options, "machine-key"),
        display_name: options["display-name"],
        role: options.role,
        os_user: options["os-user"],
        os_password_ref: options["os-password-ref"],
        internal_ip: options["internal-ip"],
        public_ip: options["public-ip"],
        notes: options.notes,
        status: options.status,
      }));
      return;
    case "register-browser-account":
      printJson(service.registerBrowserAccount({
        browser_account_key: requireOption(options, "browser-account-key"),
        provider: options.provider,
        email: requireOption(options, "email"),
        password_ref: options["password-ref"],
        notes: options.notes,
        status: options.status,
      }));
      return;
    case "bind-machine-browser":
      printJson(service.bindMachineBrowser({
        binding_key: requireOption(options, "binding-key"),
        machine_key: requireOption(options, "machine-key"),
        browser_account_key: requireOption(options, "browser-account-key"),
        api_credential_key: requireOption(options, "api-credential-key"),
        status: options.status,
      }));
      return;
    case "resolve-machine-browser":
      printJson(service.resolveMachineBrowserBinding(requireOption(options, "binding-key"), {
        resolveSecrets: Boolean(options["resolve-secrets"]),
      }));
      return;
    case "bind":
      printJson(service.bindResources({
        binding_key: requireOption(options, "binding-key"),
        profile_key: requireOption(options, "profile-key"),
        account_key: requireOption(options, "account-key"),
        proxy_key: options["proxy-key"],
        api_credential_key: requireOption(options, "api-credential-key"),
        binding_mode: options["binding-mode"],
        is_primary: options["is-primary"] === undefined ? 1 : Number(options["is-primary"]),
        status: options.status,
      }));
      return;
    case "resolve":
      printJson(service.resolveBinding(requireOption(options, "binding-key"), {
        resolveSecrets: Boolean(options["resolve-secrets"]),
      }));
      return;
    case "list":
      printJson(service.listBindings());
      return;
    case "update-current-dir":
      printJson(service.updateProfileCurrentDir(
        requireOption(options, "profile-key"),
        requireOption(options, "dir-id"),
      ));
      return;
    case "clear-current-dir":
      printJson(service.clearProfileCurrentDir(requireOption(options, "profile-key")));
      return;
    case "update-verify-result":
      printJson(service.updateBindingVerifyResult(
        requireOption(options, "binding-key"),
        parseJsonOption(requireOption(options, "result-json")),
      ));
      return;
    case "export":
      printJson(service.exportData());
      return;
    default:
      throw new Error("Usage: binding-cli.js <init-db|register-profile|register-account|register-proxy|register-api|register-machine|register-browser-account|bind-machine-browser|resolve-machine-browser|bind|resolve|list|update-current-dir|clear-current-dir|update-verify-result|export> [--key=value]");
  }
}

function parseJsonOption(value) {
  if (!value) {
    return undefined;
  }
  return JSON.parse(value);
}

function toNullableInt(value) {
  if (value === undefined || value === null || value === "") {
    return null;
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
