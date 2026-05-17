import { BindingNotFoundError } from "../core/browser-errors.js";
import { nowIso, openDatabase } from "../db/sqlite.js";

export class BindingService {
  constructor({ db = openDatabase(), credentialResolver } = {}) {
    this.db = db;
    this.credentialResolver = credentialResolver;
  }

  registerProfile(input) {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO profiles (
        profile_key, platform, display_name, workspace_id, project_id, current_dir_id,
        browser_core_version, user_agent, os_name, os_version, fingerprint_json,
        proxy_template_json, default_open_urls_json, local_profile_path, archive_root_path,
        status, last_verified_at, created_at, updated_at
      ) VALUES (
        @profile_key, @platform, @display_name, @workspace_id, @project_id, @current_dir_id,
        @browser_core_version, @user_agent, @os_name, @os_version, @fingerprint_json,
        @proxy_template_json, @default_open_urls_json, @local_profile_path, @archive_root_path,
        @status, @last_verified_at, @created_at, @updated_at
      )
      ON CONFLICT(profile_key) DO UPDATE SET
        platform = excluded.platform,
        display_name = excluded.display_name,
        workspace_id = excluded.workspace_id,
        project_id = excluded.project_id,
        current_dir_id = excluded.current_dir_id,
        browser_core_version = excluded.browser_core_version,
        user_agent = excluded.user_agent,
        os_name = excluded.os_name,
        os_version = excluded.os_version,
        fingerprint_json = excluded.fingerprint_json,
        proxy_template_json = excluded.proxy_template_json,
        default_open_urls_json = excluded.default_open_urls_json,
        local_profile_path = excluded.local_profile_path,
        archive_root_path = excluded.archive_root_path,
        status = excluded.status,
        last_verified_at = excluded.last_verified_at,
        updated_at = excluded.updated_at
    `).run({
      ...normalizeProfileInput(input),
      created_at: now,
      updated_at: now,
    });

    return this.getProfileByKey(input.profile_key);
  }

  registerAccount(input) {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO accounts (
        account_key, platform, login_name, display_name, credential_ref, credential_type,
        status, notes, created_at, updated_at
      ) VALUES (
        @account_key, @platform, @login_name, @display_name, @credential_ref, @credential_type,
        @status, @notes, @created_at, @updated_at
      )
      ON CONFLICT(account_key) DO UPDATE SET
        platform = excluded.platform,
        login_name = excluded.login_name,
        display_name = excluded.display_name,
        credential_ref = excluded.credential_ref,
        credential_type = excluded.credential_type,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run({
      ...input,
      status: input.status || "active",
      created_at: now,
      updated_at: now,
    });

    return this.getAccountByKey(input.account_key);
  }

  registerProxy(input) {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO ip_resources (
        proxy_key, proxy_type, host, port, username_ref, password_ref,
        provider, country, region, city, exit_ip, check_url, status, created_at, updated_at
      ) VALUES (
        @proxy_key, @proxy_type, @host, @port, @username_ref, @password_ref,
        @provider, @country, @region, @city, @exit_ip, @check_url, @status, @created_at, @updated_at
      )
      ON CONFLICT(proxy_key) DO UPDATE SET
        proxy_type = excluded.proxy_type,
        host = excluded.host,
        port = excluded.port,
        username_ref = excluded.username_ref,
        password_ref = excluded.password_ref,
        provider = excluded.provider,
        country = excluded.country,
        region = excluded.region,
        city = excluded.city,
        exit_ip = excluded.exit_ip,
        check_url = excluded.check_url,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run({
      ...input,
      status: input.status || "active",
      created_at: now,
      updated_at: now,
    });

    return this.getProxyByKey(input.proxy_key);
  }

  registerApiCredential(input) {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO api_credentials (
        credential_key, provider, api_host, api_key_ref, workspace_id, project_id,
        status, created_at, updated_at
      ) VALUES (
        @credential_key, @provider, @api_host, @api_key_ref, @workspace_id, @project_id,
        @status, @created_at, @updated_at
      )
      ON CONFLICT(credential_key) DO UPDATE SET
        provider = excluded.provider,
        api_host = excluded.api_host,
        api_key_ref = excluded.api_key_ref,
        workspace_id = excluded.workspace_id,
        project_id = excluded.project_id,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run({
      ...input,
      status: input.status || "active",
      created_at: now,
      updated_at: now,
    });

    return this.getApiCredentialByKey(input.credential_key);
  }

  registerMachine(input) {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO machines (
        machine_key, display_name, role, os_user, os_password_ref, internal_ip, public_ip,
        status, notes, created_at, updated_at
      ) VALUES (
        @machine_key, @display_name, @role, @os_user, @os_password_ref, @internal_ip, @public_ip,
        @status, @notes, @created_at, @updated_at
      )
      ON CONFLICT(machine_key) DO UPDATE SET
        display_name = excluded.display_name,
        role = excluded.role,
        os_user = excluded.os_user,
        os_password_ref = excluded.os_password_ref,
        internal_ip = excluded.internal_ip,
        public_ip = excluded.public_ip,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run({
      machine_key: input.machine_key,
      display_name: input.display_name || input.machine_key,
      role: input.role || "executor",
      os_user: input.os_user || null,
      os_password_ref: input.os_password_ref || null,
      internal_ip: input.internal_ip || null,
      public_ip: input.public_ip || null,
      status: input.status || "active",
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    });

    return this.getMachineByKey(input.machine_key);
  }

  registerBrowserAccount(input) {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO browser_accounts (
        browser_account_key, provider, email, password_ref, status, notes, created_at, updated_at
      ) VALUES (
        @browser_account_key, @provider, @email, @password_ref, @status, @notes, @created_at, @updated_at
      )
      ON CONFLICT(browser_account_key) DO UPDATE SET
        provider = excluded.provider,
        email = excluded.email,
        password_ref = excluded.password_ref,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run({
      browser_account_key: input.browser_account_key,
      provider: input.provider || "roxybrowser",
      email: input.email,
      password_ref: input.password_ref || null,
      status: input.status || "active",
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    });

    return this.getBrowserAccountByKey(input.browser_account_key);
  }

  bindMachineBrowser(input) {
    const now = nowIso();
    const machine = this.getMachineByKey(input.machine_key);
    const browserAccount = this.getBrowserAccountByKey(input.browser_account_key);
    const apiCredential = this.getApiCredentialByKey(input.api_credential_key);

    this.db.prepare(`
      INSERT INTO machine_browser_bindings (
        machine_id, browser_account_id, api_credential_id, binding_key, status, created_at, updated_at
      ) VALUES (
        @machine_id, @browser_account_id, @api_credential_id, @binding_key, @status, @created_at, @updated_at
      )
      ON CONFLICT(binding_key) DO UPDATE SET
        machine_id = excluded.machine_id,
        browser_account_id = excluded.browser_account_id,
        api_credential_id = excluded.api_credential_id,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run({
      machine_id: machine.id,
      browser_account_id: browserAccount.id,
      api_credential_id: apiCredential.id,
      binding_key: input.binding_key,
      status: input.status || "active",
      created_at: now,
      updated_at: now,
    });

    return this.resolveMachineBrowserBinding(input.binding_key);
  }

  resolveMachineBrowserBinding(bindingKey, { resolveSecrets = false } = {}) {
    const row = this.db.prepare(`
      SELECT
        mb.binding_key,
        mb.status AS mb_status,
        m.machine_key,
        m.display_name AS machine_display_name,
        m.role,
        m.os_user,
        m.os_password_ref,
        m.internal_ip,
        m.public_ip,
        m.status AS machine_status,
        ba.browser_account_key,
        ba.provider AS browser_provider,
        ba.email,
        ba.password_ref AS browser_password_ref,
        ba.status AS browser_account_status,
        api.credential_key AS api_credential_key,
        api.provider AS api_provider,
        api.api_host,
        api.api_key_ref,
        api.workspace_id,
        api.project_id,
        api.status AS api_status
      FROM machine_browser_bindings mb
      JOIN machines m ON m.id = mb.machine_id
      JOIN browser_accounts ba ON ba.id = mb.browser_account_id
      JOIN api_credentials api ON api.id = mb.api_credential_id
      WHERE mb.binding_key = ?
    `).get(bindingKey);

    if (!row) {
      throw new BindingNotFoundError(bindingKey);
    }

    const result = {
      binding_key: row.binding_key,
      status: row.mb_status,
      machine: {
        machine_key: row.machine_key,
        display_name: row.machine_display_name,
        role: row.role,
        os_user: row.os_user,
        os_password_ref: row.os_password_ref,
        internal_ip: row.internal_ip,
        public_ip: row.public_ip,
        status: row.machine_status,
      },
      browser_account: {
        browser_account_key: row.browser_account_key,
        provider: row.browser_provider,
        email: row.email,
        password_ref: row.browser_password_ref,
        status: row.browser_account_status,
      },
      api_credential: {
        credential_key: row.api_credential_key,
        provider: row.api_provider,
        api_host: row.api_host,
        api_key_ref: row.api_key_ref,
        workspace_id: row.workspace_id,
        project_id: row.project_id,
        status: row.api_status,
      },
    };

    if (resolveSecrets && this.credentialResolver) {
      result.machine.resolved_os_password = this.credentialResolver.resolve(row.os_password_ref);
      result.browser_account.resolved_password = this.credentialResolver.resolve(row.browser_password_ref);
      result.api_credential.resolved_api_key = this.credentialResolver.resolve(row.api_key_ref);
    }

    return result;
  }

  bindResources(input) {
    const profile = this.getProfileByKey(input.profile_key);
    const account = this.getAccountByKey(input.account_key);
    const apiCredential = this.getApiCredentialByKey(input.api_credential_key);
    const proxy = input.proxy_key ? this.getProxyByKey(input.proxy_key) : undefined;
    const now = nowIso();

    this.db.prepare(`
      INSERT INTO bindings (
        binding_key, profile_id, account_id, ip_resource_id, api_credential_id,
        binding_mode, is_primary, status, last_restore_at, last_verify_result, created_at, updated_at
      ) VALUES (
        @binding_key, @profile_id, @account_id, @ip_resource_id, @api_credential_id,
        @binding_mode, @is_primary, @status, @last_restore_at, @last_verify_result, @created_at, @updated_at
      )
      ON CONFLICT(binding_key) DO UPDATE SET
        profile_id = excluded.profile_id,
        account_id = excluded.account_id,
        ip_resource_id = excluded.ip_resource_id,
        api_credential_id = excluded.api_credential_id,
        binding_mode = excluded.binding_mode,
        is_primary = excluded.is_primary,
        status = excluded.status,
        last_restore_at = excluded.last_restore_at,
        last_verify_result = excluded.last_verify_result,
        updated_at = excluded.updated_at
    `).run({
      binding_key: input.binding_key,
      profile_id: profile.id,
      account_id: account.id,
      ip_resource_id: proxy?.id || null,
      api_credential_id: apiCredential.id,
      binding_mode: input.binding_mode || "primary",
      is_primary: input.is_primary ?? 1,
      status: input.status || "active",
      last_restore_at: input.last_restore_at || null,
      last_verify_result: input.last_verify_result || null,
      created_at: now,
      updated_at: now,
    });

    return this.resolveBinding(input.binding_key);
  }

  resolveBinding(bindingKey, { resolveSecrets = false } = {}) {
    const row = this.db.prepare(`
      SELECT
        b.*,
        p.profile_key AS p_profile_key,
        p.platform AS p_platform,
        p.display_name AS p_display_name,
        p.workspace_id AS p_workspace_id,
        p.project_id AS p_project_id,
        p.current_dir_id AS p_current_dir_id,
        p.browser_core_version AS p_browser_core_version,
        p.user_agent AS p_user_agent,
        p.os_name AS p_os_name,
        p.os_version AS p_os_version,
        p.fingerprint_json AS p_fingerprint_json,
        p.proxy_template_json AS p_proxy_template_json,
        p.default_open_urls_json AS p_default_open_urls_json,
        p.local_profile_path AS p_local_profile_path,
        p.archive_root_path AS p_archive_root_path,
        p.status AS p_status,
        a.account_key AS a_account_key,
        a.platform AS a_platform,
        a.login_name AS a_login_name,
        a.display_name AS a_display_name,
        a.credential_ref AS a_credential_ref,
        a.credential_type AS a_credential_type,
        a.status AS a_status,
        a.notes AS a_notes,
        ip.proxy_key AS ip_proxy_key,
        ip.proxy_type AS ip_proxy_type,
        ip.host AS ip_host,
        ip.port AS ip_port,
        ip.username_ref AS ip_username_ref,
        ip.password_ref AS ip_password_ref,
        ip.provider AS ip_provider,
        ip.country AS ip_country,
        ip.region AS ip_region,
        ip.city AS ip_city,
        ip.exit_ip AS ip_exit_ip,
        ip.check_url AS ip_check_url,
        ip.status AS ip_status,
        api.credential_key AS api_credential_key,
        api.provider AS api_provider,
        api.api_host AS api_api_host,
        api.api_key_ref AS api_api_key_ref,
        api.workspace_id AS api_workspace_id,
        api.project_id AS api_project_id,
        api.status AS api_status
      FROM bindings b
      JOIN profiles p ON p.id = b.profile_id
      JOIN accounts a ON a.id = b.account_id
      LEFT JOIN ip_resources ip ON ip.id = b.ip_resource_id
      JOIN api_credentials api ON api.id = b.api_credential_id
      WHERE b.binding_key = ?
    `).get(bindingKey);

    if (!row) {
      throw new BindingNotFoundError(bindingKey);
    }

    const result = {
      binding: {
        id: row.id,
        binding_key: row.binding_key,
        binding_mode: row.binding_mode,
        is_primary: Boolean(row.is_primary),
        status: row.status,
        last_restore_at: row.last_restore_at,
        last_verify_result: row.last_verify_result ? safeParseJson(row.last_verify_result) : null,
      },
      profile: {
        id: row.profile_id,
        profile_key: row.p_profile_key,
        platform: row.p_platform,
        display_name: row.p_display_name,
        workspace_id: row.p_workspace_id,
        project_id: row.p_project_id,
        current_dir_id: row.p_current_dir_id,
        browser_core_version: row.p_browser_core_version,
        user_agent: row.p_user_agent,
        os_name: row.p_os_name,
        os_version: row.p_os_version,
        fingerprint: safeParseJson(row.p_fingerprint_json),
        proxy_template: safeParseJson(row.p_proxy_template_json),
        default_open_urls: safeParseJson(row.p_default_open_urls_json) || [],
        local_profile_path: row.p_local_profile_path,
        archive_root_path: row.p_archive_root_path,
        status: row.p_status,
      },
      account: {
        id: row.account_id,
        account_key: row.a_account_key,
        platform: row.a_platform,
        login_name: row.a_login_name,
        display_name: row.a_display_name,
        credential_ref: row.a_credential_ref,
        credential_type: row.a_credential_type,
        status: row.a_status,
        notes: row.a_notes,
      },
      ip_resource: row.ip_proxy_key ? {
        id: row.ip_resource_id,
        proxy_key: row.ip_proxy_key,
        proxy_type: row.ip_proxy_type,
        host: row.ip_host,
        port: row.ip_port,
        username_ref: row.ip_username_ref,
        password_ref: row.ip_password_ref,
        provider: row.ip_provider,
        country: row.ip_country,
        region: row.ip_region,
        city: row.ip_city,
        exit_ip: row.ip_exit_ip,
        check_url: row.ip_check_url,
        status: row.ip_status,
      } : null,
      api_credential: {
        id: row.api_credential_id,
        credential_key: row.api_credential_key,
        provider: row.api_provider,
        api_host: row.api_api_host,
        api_key_ref: row.api_api_key_ref,
        workspace_id: row.api_workspace_id,
        project_id: row.api_project_id,
        status: row.api_status,
      },
    };

    if (resolveSecrets && this.credentialResolver) {
      result.account.resolved_credential = this.credentialResolver.resolve(result.account.credential_ref);
      result.api_credential.resolved_api_key = this.credentialResolver.resolve(result.api_credential.api_key_ref);
      if (result.ip_resource) {
        result.ip_resource.resolved_username = this.credentialResolver.resolve(result.ip_resource.username_ref);
        result.ip_resource.resolved_password = this.credentialResolver.resolve(result.ip_resource.password_ref);
      }
    }

    return result;
  }

  updateProfileCurrentDir(profileKey, dirId) {
    this.db.prepare(`
      UPDATE profiles
      SET current_dir_id = ?, updated_at = ?
      WHERE profile_key = ?
    `).run(dirId, nowIso(), profileKey);
    return this.getProfileByKey(profileKey);
  }

  clearProfileCurrentDir(profileKey) {
    return this.updateProfileCurrentDir(profileKey, null);
  }

  updateProfileAsset(profileKey, patch = {}) {
    const profile = this.getProfileByKey(profileKey);
    if (!profile) {
      throw new BindingNotFoundError(profileKey);
    }

    this.db.prepare(`
      UPDATE profiles
      SET
        current_dir_id = @current_dir_id,
        local_profile_path = @local_profile_path,
        archive_root_path = @archive_root_path,
        status = @status,
        last_verified_at = @last_verified_at,
        updated_at = @updated_at
      WHERE profile_key = @profile_key
    `).run({
      profile_key: profileKey,
      current_dir_id: patch.current_dir_id !== undefined ? patch.current_dir_id : profile.current_dir_id,
      local_profile_path: patch.local_profile_path !== undefined ? patch.local_profile_path : profile.local_profile_path,
      archive_root_path: patch.archive_root_path !== undefined ? patch.archive_root_path : profile.archive_root_path,
      status: patch.status !== undefined ? patch.status : profile.status,
      last_verified_at: patch.last_verified_at !== undefined ? patch.last_verified_at : profile.last_verified_at,
      updated_at: nowIso(),
    });

    return this.getProfileByKey(profileKey);
  }

  updateBindingVerifyResult(bindingKey, verifyResult) {
    this.db.prepare(`
      UPDATE bindings
      SET last_verify_result = ?, updated_at = ?
      WHERE binding_key = ?
    `).run(JSON.stringify(verifyResult), nowIso(), bindingKey);
    return this.resolveBinding(bindingKey);
  }

  listBindings() {
    return this.db.prepare(`
      SELECT
        b.binding_key,
        b.status,
        p.profile_key,
        p.platform,
        p.current_dir_id,
        a.account_key,
        api.credential_key AS api_credential_key,
        ip.proxy_key
      FROM bindings b
      JOIN profiles p ON p.id = b.profile_id
      JOIN accounts a ON a.id = b.account_id
      JOIN api_credentials api ON api.id = b.api_credential_id
      LEFT JOIN ip_resources ip ON ip.id = b.ip_resource_id
      ORDER BY b.id DESC
    `).all();
  }

  exportData() {
    return {
      exported_at: nowIso(),
      profiles: this.db.prepare("SELECT * FROM profiles ORDER BY id").all(),
      accounts: this.db.prepare("SELECT * FROM accounts ORDER BY id").all(),
      ip_resources: this.db.prepare("SELECT * FROM ip_resources ORDER BY id").all(),
      api_credentials: this.db.prepare("SELECT * FROM api_credentials ORDER BY id").all(),
      machines: this.db.prepare("SELECT * FROM machines ORDER BY id").all(),
      browser_accounts: this.db.prepare("SELECT * FROM browser_accounts ORDER BY id").all(),
      machine_browser_bindings: this.db.prepare("SELECT * FROM machine_browser_bindings ORDER BY id").all(),
      bindings: this.db.prepare("SELECT * FROM bindings ORDER BY id").all(),
      profile_snapshots: this.db.prepare("SELECT * FROM profile_snapshots ORDER BY id").all(),
    };
  }

  createProfileSnapshotRecord(input) {
    this.db.prepare(`
      INSERT INTO profile_snapshots (
        profile_id, snapshot_key, snapshot_type, archive_path, metadata_path, source_dir_id,
        source_profile_path, cookie_count, storage_origin_count, size_bytes, created_at,
        verified_at, status
      ) VALUES (
        @profile_id, @snapshot_key, @snapshot_type, @archive_path, @metadata_path, @source_dir_id,
        @source_profile_path, @cookie_count, @storage_origin_count, @size_bytes, @created_at,
        @verified_at, @status
      )
    `).run({
      ...input,
      created_at: input.created_at || nowIso(),
      verified_at: input.verified_at || null,
      status: input.status || "created",
    });

    return this.getProfileSnapshotByKey(input.snapshot_key);
  }

  getProfileSnapshotByKey(snapshotKey) {
    return this.db.prepare(`
      SELECT ps.*, p.profile_key
      FROM profile_snapshots ps
      JOIN profiles p ON p.id = ps.profile_id
      WHERE ps.snapshot_key = ?
    `).get(snapshotKey);
  }

  listProfileSnapshots(profileKey) {
    return this.db.prepare(`
      SELECT ps.*, p.profile_key
      FROM profile_snapshots ps
      JOIN profiles p ON p.id = ps.profile_id
      WHERE p.profile_key = ?
      ORDER BY ps.created_at DESC
    `).all(profileKey);
  }

  getLatestProfileSnapshot(profileKey) {
    return this.db.prepare(`
      SELECT ps.*, p.profile_key
      FROM profile_snapshots ps
      JOIN profiles p ON p.id = ps.profile_id
      WHERE p.profile_key = ?
      ORDER BY ps.created_at DESC
      LIMIT 1
    `).get(profileKey);
  }

  getProfileByKey(profileKey) {
    const row = this.db.prepare("SELECT * FROM profiles WHERE profile_key = ?").get(profileKey);
    return row ? normalizeProfileRow(row) : null;
  }

  getAccountByKey(accountKey) {
    return this.db.prepare("SELECT * FROM accounts WHERE account_key = ?").get(accountKey);
  }

  getProxyByKey(proxyKey) {
    return this.db.prepare("SELECT * FROM ip_resources WHERE proxy_key = ?").get(proxyKey);
  }

  getApiCredentialByKey(credentialKey) {
    return this.db.prepare("SELECT * FROM api_credentials WHERE credential_key = ?").get(credentialKey);
  }

  getMachineByKey(machineKey) {
    return this.db.prepare("SELECT * FROM machines WHERE machine_key = ?").get(machineKey);
  }

  getBrowserAccountByKey(browserAccountKey) {
    return this.db.prepare("SELECT * FROM browser_accounts WHERE browser_account_key = ?").get(browserAccountKey);
  }
}

function normalizeProfileInput(input) {
  return {
    profile_key: input.profile_key,
    platform: input.platform,
    display_name: input.display_name || input.profile_key,
    workspace_id: input.workspace_id || null,
    project_id: input.project_id || null,
    current_dir_id: input.current_dir_id || null,
    browser_core_version: input.browser_core_version || null,
    user_agent: input.user_agent || null,
    os_name: input.os_name || null,
    os_version: input.os_version || null,
    fingerprint_json: toJson(input.fingerprint),
    proxy_template_json: toJson(input.proxy_template),
    default_open_urls_json: toJson(input.default_open_urls || []),
    local_profile_path: input.local_profile_path || null,
    archive_root_path: input.archive_root_path || null,
    status: input.status || "active",
    last_verified_at: input.last_verified_at || null,
  };
}

function normalizeProfileRow(row) {
  return {
    ...row,
    fingerprint: safeParseJson(row.fingerprint_json),
    proxy_template: safeParseJson(row.proxy_template_json),
    default_open_urls: safeParseJson(row.default_open_urls_json) || [],
  };
}

function toJson(value) {
  return value === undefined ? null : JSON.stringify(value);
}

function safeParseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
