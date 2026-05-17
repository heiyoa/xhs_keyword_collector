CREATE TABLE IF NOT EXISTS machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  os_user TEXT,
  os_password_ref TEXT,
  internal_ip TEXT,
  public_ip TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS browser_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  browser_account_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  password_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machine_browser_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id INTEGER NOT NULL,
  browser_account_id INTEGER NOT NULL,
  api_credential_id INTEGER NOT NULL,
  binding_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(machine_id) REFERENCES machines(id),
  FOREIGN KEY(browser_account_id) REFERENCES browser_accounts(id),
  FOREIGN KEY(api_credential_id) REFERENCES api_credentials(id)
);
