const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function open(file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'app.db')) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      pw_hash TEXT NOT NULL,
      pw_salt TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      verify_token TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- One saved list per user per project (latest wins); used for analysis.
    CREATE TABLE IF NOT EXISTS submissions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project TEXT NOT NULL,
      project_type TEXT NOT NULL,
      queue_number TEXT,
      flat_types TEXT NOT NULL,
      blocks TEXT NOT NULL,
      min_storey INTEGER,
      max_storey INTEGER,
      floor_pref TEXT NOT NULL,
      weights TEXT NOT NULL,
      ranked_ids TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, project)
    );
    CREATE TABLE IF NOT EXISTS flags (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (user_id, project, unit_id)
    );
  `);
  return db;
}

module.exports = { open };
