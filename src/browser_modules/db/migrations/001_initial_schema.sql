CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  display_name TEXT,
  workspace_id INTEGER,
  project_id INTEGER,
  current_dir_id TEXT,
  browser_core_version TEXT,
  user_agent TEXT,
  os_name TEXT,
  os_version TEXT,
  fingerprint_json TEXT,
  proxy_template_json TEXT,
  default_open_urls_json TEXT,
  local_profile_path TEXT,
  archive_root_path TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  login_name TEXT NOT NULL,
  display_name TEXT,
  credential_ref TEXT,
  credential_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ip_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proxy_key TEXT NOT NULL UNIQUE,
  proxy_type TEXT NOT NULL,
  host TEXT,
  port INTEGER,
  username_ref TEXT,
  password_ref TEXT,
  provider TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  exit_ip TEXT,
  check_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credential_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  api_host TEXT NOT NULL,
  api_key_ref TEXT NOT NULL,
  workspace_id INTEGER,
  project_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  binding_key TEXT NOT NULL UNIQUE,
  profile_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  ip_resource_id INTEGER,
  api_credential_id INTEGER NOT NULL,
  binding_mode TEXT NOT NULL DEFAULT 'primary',
  is_primary INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  last_restore_at TEXT,
  last_verify_result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(id),
  FOREIGN KEY(account_id) REFERENCES accounts(id),
  FOREIGN KEY(ip_resource_id) REFERENCES ip_resources(id),
  FOREIGN KEY(api_credential_id) REFERENCES api_credentials(id)
);

CREATE TABLE IF NOT EXISTS profile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  snapshot_key TEXT NOT NULL UNIQUE,
  snapshot_type TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  metadata_path TEXT NOT NULL,
  source_dir_id TEXT,
  source_profile_path TEXT,
  cookie_count INTEGER,
  storage_origin_count INTEGER,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  FOREIGN KEY(profile_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS session_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  snapshot_id INTEGER,
  site_name TEXT,
  state_type TEXT NOT NULL,
  cookie_json TEXT,
  local_storage_json TEXT,
  session_storage_json TEXT,
  indexeddb_hint TEXT,
  captured_at TEXT NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(id),
  FOREIGN KEY(snapshot_id) REFERENCES profile_snapshots(id)
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_key TEXT NOT NULL UNIQUE,
  binding_id INTEGER NOT NULL,
  script_name TEXT NOT NULL,
  machine_role TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result_json TEXT,
  error_text TEXT,
  FOREIGN KEY(binding_id) REFERENCES bindings(id)
);
