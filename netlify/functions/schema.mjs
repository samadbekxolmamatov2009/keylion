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
  /* fixed-window rate limit counters, shared by every function instance */
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT
  )`,
  /* uploaded files (ads, custom backgrounds) in 512 KB chunks, see media.mjs */
  `CREATE TABLE IF NOT EXISTS media (store TEXT NOT NULL, key TEXT NOT NULL, type TEXT, size INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (store, key))`,
  `CREATE TABLE IF NOT EXISTS media_chunks (store TEXT NOT NULL, key TEXT NOT NULL, idx INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (store, key, idx))`,
  /* ad impressions/clicks per day */
  `CREATE TABLE IF NOT EXISTS ad_stats (day TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind))`,
];

/* Columns added after the first release. SQLite has no "ADD COLUMN IF NOT EXISTS", so each one is
   applied separately and a "duplicate column" error just means it is already there. */
export const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN last_seen_at INTEGER`,
  `ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN settings TEXT`,
  `ALTER TABLE users ADD COLUMN rating_wpm INTEGER NOT NULL DEFAULT 0`,   // avg of the last 10 tests, drives the tier
  `ALTER TABLE history ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE scores ADD COLUMN kind TEXT`,                              // words | time | code | daily | race
  `ALTER TABLE scores ADD COLUMN text_lang TEXT`,
  `ALTER TABLE scores ADD COLUMN status TEXT NOT NULL DEFAULT 'ok'`,      // ok | flagged | hidden
  `ALTER TABLE scores ADD COLUMN flag_reason TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_scores_user ON scores (user_id, wpm DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_scores_ts ON scores (ts)`,
  `CREATE INDEX IF NOT EXISTS idx_users_seen ON users (last_seen_at)`,
  /* one-off backfills (safe to re-run): players imported from Firebase only have history — their scores
     came over without a user link — so give each registered player without any score row their best
     plausible test, and compute the tier rating from history */
  `INSERT INTO scores (user_id, name, mode, wpm, acc, ts, status)
   SELECT h.user_id, u.name, h.mode, h.wpm, h.acc, h.ts, 'ok' FROM history h JOIN users u ON u.id = h.user_id
   WHERE u.kind = 'user' AND NOT EXISTS (SELECT 1 FROM scores s WHERE s.user_id = h.user_id)
     AND h.id = (SELECT h2.id FROM history h2 WHERE h2.user_id = h.user_id AND h2.acc >= 90 AND h2.wpm BETWEEN 1 AND 220
                 ORDER BY h2.wpm DESC, h2.ts ASC LIMIT 1)`,
  `UPDATE users SET rating_wpm = COALESCE((SELECT CAST(ROUND(AVG(wpm)) AS INTEGER) FROM
     (SELECT wpm FROM history WHERE user_id = users.id AND wpm <= 220 ORDER BY ts DESC LIMIT 10)), 0)
   WHERE rating_wpm = 0 AND kind = 'user'`,
];
