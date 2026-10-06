/* One-off import of the old Firebase data into Turso.
   Usage:
     TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
     node scripts/migrate-firebase-to-turso.mjs <rtdb-export.json> [auth-export.json] [hash-config.json]

   rtdb-export.json   Firebase Console → Realtime Database → ⋮ → Export JSON
   auth-export.json   (optional) `firebase auth:export auth-export.json --format=json`  → keeps e-mail/password logins working
   hash-config.json   (optional) {"memCost":14,"rounds":8,"saltSeparator":"<base64>","signerKey":"<base64>"}
                      from Firebase Console → Authentication → Users → ⋮ → Password hash parameters
   Safe to run twice: rows are keyed by the Firebase uid. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@libsql/client';
import { SCHEMA, MIGRATIONS } from '../netlify/functions/schema.mjs';
import { encodeFirebaseHash } from '../netlify/functions/firebase-scrypt.mjs';

const [rtdbPath, authPath, hashPath] = process.argv.slice(2);
if (!rtdbPath) { console.error('usage: node scripts/migrate-firebase-to-turso.mjs <rtdb-export.json> [auth-export.json] [hash-config.json]'); process.exit(1); }
const rtdb = JSON.parse(fs.readFileSync(rtdbPath, 'utf8'));
const authUsers = authPath ? (JSON.parse(fs.readFileSync(authPath, 'utf8')).users || []) : [];
const hashCfg = hashPath ? JSON.parse(fs.readFileSync(hashPath, 'utf8')) : null;
const authByUid = Object.fromEntries(authUsers.map((u) => [u.localId, u]));

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
await db.batch(SCHEMA.map((sql) => ({ sql, args: [] })), 'write');
for (const sql of MIGRATIONS) {
  try { await db.execute(sql); } catch (e) { if (!/duplicate column/i.test(String(e.message))) throw e; }
}

const uidMap = {};          // firebase uid -> new id
const stmts = [];
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 24);
const usedEmails = new Set();

for (const [fuid, u] of Object.entries(rtdb.users || {})) {
  const id = newId(); uidMap[fuid] = id;
  const a = authByUid[fuid] || {};
  const priv = (rtdb.private || {})[fuid] || {};
  let email = (a.email || priv.email || '').toLowerCase() || null;
  if (email && usedEmails.has(email)) email = null;
  if (email) usedEmails.add(email);
  const google = (a.providerUserInfo || []).find((p) => p.providerId === 'google.com');
  const pwHash = hashCfg && a.passwordHash && a.salt ? encodeFirebaseHash(hashCfg, a.salt, a.passwordHash) : null;
  const s = u.streak || {};
  stmts.push({
    sql: `INSERT INTO users (id, kind, name, email, google_sub, password_hash, firebase_uid, created_at, last_login_at, best_wpm, tests_count, streak_current, streak_longest, streak_last_date)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(firebase_uid) DO NOTHING`,
    args: [id, 'user', u.name || 'player', email, google ? google.rawId : null, pwHash, fuid, u.createdAt || priv.createdAt || Date.now(), priv.lastLoginAt || null,
      u.bestWpm || 0, u.testsCount || 0, s.current || 0, s.longest || 0, s.lastDate || null],
  });
}
await db.batch(stmts.splice(0), 'write');

// ids may differ from the map if a row already existed (re-run): resolve from DB
const existing = await db.execute('SELECT id, firebase_uid FROM users WHERE firebase_uid IS NOT NULL');
existing.rows.forEach((r) => { uidMap[r.firebase_uid] = r.id; });

for (const [fuid, u] of Object.entries(rtdb.users || {})) {
  const id = uidMap[fuid];
  for (const l of Object.keys(u.langsUsed || {})) stmts.push({ sql: "INSERT OR IGNORE INTO user_langs VALUES (?, 'text', ?)", args: [id, l] });
  for (const l of Object.keys(u.codeLangsUsed || {})) stmts.push({ sql: "INSERT OR IGNORE INTO user_langs VALUES (?, 'code', ?)", args: [id, l] });
  for (const [a, ts] of Object.entries(u.achievements || {})) stmts.push({ sql: 'INSERT OR IGNORE INTO achievements VALUES (?,?,?)', args: [id, a, Number(ts) || Date.now()] });
}
let hist = 0;
for (const [fuid, u] of Object.entries(rtdb.users || {})) {
  // history has no natural key: only import when the user has none yet (keeps re-runs idempotent)
  const have = await db.execute({ sql: 'SELECT 1 FROM history WHERE user_id = ? LIMIT 1', args: [uidMap[fuid]] });
  if (have.rows.length) continue;
  for (const h of Object.values(u.history || {})) {
    stmts.push({ sql: 'INSERT INTO history (user_id, wpm, acc, mode, missed, ts) VALUES (?,?,?,?,?,?)', args: [uidMap[fuid], h.wpm || 0, h.acc || 0, h.mode || '', JSON.stringify(h.missed || {}), h.ts || Date.now()] });
    hist++;
  }
}
let scores = 0;
const haveScores = (await db.execute('SELECT COUNT(*) AS c FROM scores')).rows[0].c > 0;
if (!haveScores) for (const s of Object.values(rtdb.scores || {})) {
  stmts.push({ sql: 'INSERT INTO scores (user_id, name, mode, wpm, acc, ts) VALUES (NULL,?,?,?,?,?)', args: [s.name || 'anon', s.mode || '', s.wpm || 0, s.acc || 0, s.ts || Date.now()] });
  scores++;
}
const ad = (rtdb.settings || {}).ad;
if (ad) stmts.push({ sql: "INSERT INTO settings (key, value) VALUES ('ad', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify(ad)] });

for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200), 'write');
console.log(`users: ${Object.keys(uidMap).length}, history rows: ${hist}, scores: ${scores}, ad settings: ${ad ? 'yes' : 'no'}`);
console.log(hashCfg ? 'password hashes imported (e-mail logins keep working)' : 'no hash config given: e-mail users must use Google login or re-register');
