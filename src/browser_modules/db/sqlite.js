import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.resolve("data", "browser_foundation.db");
const MIGRATIONS_DIR = path.resolve("src", "browser_modules", "db", "migrations");

export function openDatabase(dbPath = process.env.BROWSER_FOUNDATION_DB_PATH || DEFAULT_DB_PATH) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version),
  );

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const insertMigration = db.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (applied.has(migration)) {
      continue;
    }

    const sql = readFileSync(path.join(MIGRATIONS_DIR, migration), "utf8");
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(migration, now);
    });
    transaction();
  }
}

export function nowIso() {
  return new Date().toISOString();
}
