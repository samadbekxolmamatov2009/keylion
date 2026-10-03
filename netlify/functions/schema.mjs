/* Turso (libSQL) schema. Applied lazily on first request (CREATE IF NOT EXISTS), and by the migration script. */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'guest',          -- 'guest' | 'user'
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    google_sub TEXT UNIQUE,
    password_hash TEXT,
    firebase_uid TEXT UNIQUE,                    -- set for users imported from Firebase
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    best_wpm INTEGER NOT NULL DEFAULT 0,
    tests_count INTEGER NOT NULL DEFAULT 0,
    streak_current INTEGER NOT NULL DEFAULT 0,
    streak_longest INTEGER NOT NULL DEFAULT 0,
    streak_last_date TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS user_langs (
    user_id TEXT NOT NULL, kind TEXT NOT NULL, lang TEXT NOT NULL,   -- kind: 'text' | 'code'
    PRIMARY KEY (user_id, kind, lang)
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    user_id TEXT NOT NULL, id TEXT NOT NULL, ts INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, wpm INTEGER NOT NULL, acc INTEGER NOT NULL,
    mode TEXT NOT NULL, missed TEXT NOT NULL DEFAULT '{}', ts INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_history_user_ts ON history (user_id, ts DESC)`,
  `CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, name TEXT NOT NULL, mode TEXT NOT NULL,
    wpm INTEGER NOT NULL, acc INTEGER NOT NULL, ts INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scores_wpm ON scores (wpm DESC)`,
  `CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY, host_id TEXT NOT NULL, text TEXT NOT NULL,
    lang TEXT, text_lang TEXT, type TEXT, time_limit INTEGER NOT NULL DEFAULT 60,
    max_players INTEGER NOT NULL DEFAULT 10, status TEXT NOT NULL DEFAULT 'waiting',
    created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS room_players (
    code TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0, wpm REAL NOT NULL DEFAULT 0,
    finished INTEGER NOT NULL DEFAULT 0, finished_at INTEGER, joined_at INTEGER NOT NULL,
    PRIMARY KEY (code, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];
