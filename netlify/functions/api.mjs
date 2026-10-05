/* Tezlash API — single Netlify Function (served at /api/*), backed by Turso (libSQL).
   Env vars (Netlify → Site settings → Environment variables):
     TURSO_DATABASE_URL, TURSO_AUTH_TOKEN   database
     JWT_SECRET                             optional; signs login tokens (derived from the Turso token if unset)
     GOOGLE_CLIENT_ID                       Google OAuth web client id (for "Sign in with Google")
     ADMIN_EMAIL, ADMIN_PASSWORD            credentials for /admin.html
     GROQ_API_KEY                           AI coach (key never reaches the browser); optional GROQ_MODEL */
import { createClient } from '@libsql/client';
import { putMedia, headMedia, readMedia, listMedia, deleteMedia } from './media.mjs';
import crypto from 'node:crypto';
import { SCHEMA, MIGRATIONS } from './schema.mjs';

export const config = { path: '/api/*' };

/* ---------- db ---------- */
const SCHEMA_VERSION = String(SCHEMA.length + MIGRATIONS.length);
let client = null, schemaReady = null;
function db() {
  if (!client) client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}
async function applySchema() {
  /* one cheap read on a cold start; the DDL only runs when the schema actually changed */
  const cur = await db().execute("SELECT value FROM settings WHERE key = 'schema_version'").then((r) => r.rows[0]?.value, () => null);
  if (cur === SCHEMA_VERSION) return;
  await db().batch(SCHEMA.map((sql) => ({ sql, args: [] })), 'write');
  for (const sql of MIGRATIONS) {
    try { await db().execute(sql); } catch (e) { if (!/duplicate column/i.test(String(e.message))) throw e; }
  }
  await db().execute({ sql: "INSERT INTO settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [SCHEMA_VERSION] });
}
function ensureSchema() {
  if (!schemaReady) {
    /* don't cache a failure: a transient Turso error must not break every later request on a warm instance */
    schemaReady = applySchema().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}
async function q(sql, args = []) { return (await db().execute({ sql, args })).rows; }
async function q1(sql, args = []) { return (await q(sql, args))[0] || null; }

/* ---------- helpers ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const now = () => Date.now();
const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 24);
const clean = (s, n = 24) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);

/* day/week/month boundaries are computed in Tashkent time (UTC+5), where most players are */
const TZ_MS = 5 * 3600e3;
function periodStart(period) {
  const local = new Date(now() + TZ_MS);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_MS;
  if (period === 'day') return day;
  if (period === 'week') return day - ((local.getUTCDay() + 6) % 7) * 86400e3;  // Monday
  if (period === 'month') return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_MS;
  return 0;
}

/* JWT_SECRET is optional: without it the signing key is derived from the (secret) Turso token */
const jwtKey = () => process.env.JWT_SECRET || crypto.createHash('sha256').update('tezlash-jwt:' + (process.env.TURSO_AUTH_TOKEN || '') + (process.env.TURSO_DATABASE_URL || '')).digest('hex');
const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload, days = 90) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(now() / 1000 + days * 86400) }));
  const sig = crypto.createHmac('sha256', jwtKey()).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', jwtKey()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > now() / 1000 ? p : null;
  } catch { return null; }
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('base64') + '$' + crypto.scryptSync(pw, salt, 64).toString('base64');
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), 64);
  const want = Buffer.from(hash, 'base64');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function authUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  const p = m && verify(m[1]);
  if (!p || !p.sub) return null;
  const u = await q1('SELECT * FROM users WHERE id = ?', [p.sub]);
  /* "online" in the admin dashboard = seen in the last few minutes; write at most once a minute */
  if (u && (!u.last_seen_at || now() - Number(u.last_seen_at) > 60e3)) {
    await q('UPDATE users SET last_seen_at = ? WHERE id = ?', [now(), u.id]);
  }
  return u;
}
async function requireUser(req) {
  const u = await authUser(req);
  if (!u) throw new HttpError(401, 'unauthorized');
  if (Number(u.banned)) throw new HttpError(403, 'account blocked');
  return u;
}
function requireAdmin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  const p = m && verify(m[1]);
  if (!p || p.admin !== true) throw new HttpError(403, 'admin only');
}
const tokenFor = (u) => sign({ sub: u.id });

function parseSettings(u) {
  try { return JSON.parse(u.settings || '{}') || {}; } catch { return {}; }
}

async function profileOf(u) {
  const [langs, achv] = await Promise.all([
    q('SELECT kind, lang FROM user_langs WHERE user_id = ?', [u.id]),
    q('SELECT id, ts FROM achievements WHERE user_id = ?', [u.id]),
  ]);
  const langsUsed = {}, codeLangsUsed = {}, achievements = {};
  langs.forEach((r) => (r.kind === 'code' ? codeLangsUsed : langsUsed)[r.lang] = true);
  achv.forEach((r) => achievements[r.id] = Number(r.ts));
  return {
    id: u.id, name: u.name, isGuest: u.kind === 'guest', email: u.email || null,
    bestWpm: Number(u.best_wpm), ratingWpm: Number(u.rating_wpm || 0), testsCount: Number(u.tests_count),
    createdAt: Number(u.created_at), profilePublic: Number(u.profile_public ?? 1) === 1,
    streak: { current: Number(u.streak_current), longest: Number(u.streak_longest), lastDate: u.streak_last_date },
    langsUsed, codeLangsUsed, achievements,
    settings: parseSettings(u).prefs || null,
  };
}
async function session(u) {
  await q('UPDATE users SET last_login_at = ? WHERE id = ?', [now(), u.id]);
  return { token: tokenFor(u), profile: await profileOf(u) };
}

/* ---------- rate limit: fixed window, stored in the db so every function instance shares it ---------- */
async function limit(key, max, windowMs) {
  const t = now();
  const row = await q1(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start <= ? THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= ? THEN ? ELSE rate_limits.window_start END
     RETURNING count`,
    [key, t, t - windowMs, t - windowMs, t]);
  if (Math.random() < 0.01) q('DELETE FROM rate_limits WHERE window_start < ?', [t - 2 * 86400e3]).catch(() => {});
  if (row && Number(row.count) > max) throw new HttpError(429, 'too many requests');
}

async function adminLog(action, target, detail) {
  await q('INSERT INTO admin_log (ts, action, target, detail) VALUES (?,?,?,?)', [now(), action, target || null, detail ? String(detail).slice(0, 300) : null]);
}

/* ---------- auth ---------- */
async function convertOrCreate(req, fields) {
  /* if the caller is a guest, upgrade that row in place so their uid / history / scores carry over */
  const cur = await authUser(req);
  if (cur && cur.kind === 'guest') {
    const sets = [], args = [];
    for (const [k, v] of Object.entries(fields)) { sets.push(k + ' = ?'); args.push(v); }
    sets.push("kind = 'user'");
    await q(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...args, cur.id]);
    return await q1('SELECT * FROM users WHERE id = ?', [cur.id]);
  }
  const id = uid();
  const cols = ['id', 'kind', 'created_at', ...Object.keys(fields)];
  await q(`INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, [id, 'user', now(), ...Object.values(fields)]);
  return await q1('SELECT * FROM users WHERE id = ?', [id]);
}

const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/config', async () => json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null }));

route('POST', '/auth/guest', async (req, ctx, body, req_ip) => {
  await limit('guest:' + req_ip, 30, 3600e3);
  const id = uid();
  await q('INSERT INTO users (id, kind, name, created_at) VALUES (?,?,?,?)', [id, 'guest', clean(body.name) || "o'yinchi" + (100 + Math.floor(Math.random() * 900)), now()]);
  return json(await session(await q1('SELECT * FROM users WHERE id = ?', [id])));
});

route('POST', '/auth/signup', async (req, ctx, body, ip) => {
  await limit('signup:' + ip, 10, 3600e3);
  const email = clean(body.email, 120).toLowerCase(), name = clean(body.name);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'invalid email');
  if (String(body.password || '').length < 6) throw new HttpError(400, 'password too short');
  if (!name) throw new HttpError(400, 'name required');
  if (process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase()) throw new HttpError(409, 'email in use');
  if (await q1('SELECT 1 FROM users WHERE email = ?', [email])) throw new HttpError(409, 'email in use');
  const u = await convertOrCreate(req, { name, email, password_hash: hashPassword(String(body.password)) });
  return json(await session(u));
});

route('POST', '/auth/login', async (req, ctx, body, ip) => {
  await limit('login:' + ip, 20, 600e3);
  const email = clean(body.email, 120).toLowerCase();
  const u = await q1('SELECT * FROM users WHERE email = ?', [email]);
  if (!u || !(await verifyAnyPassword(u, String(body.password || '')))) throw new HttpError(401, 'wrong email or password');
  if (Number(u.banned)) throw new HttpError(403, 'account blocked');
  return json(await session(u));
});

/* users imported from Firebase carry a Firebase scrypt hash; accept it once, then re-hash natively */
async function verifyAnyPassword(u, pw) {
  if (!u.password_hash) return false;
  if (u.password_hash.startsWith('scrypt$')) return checkPassword(pw, u.password_hash);
  if (u.password_hash.startsWith('fbscrypt$')) {
    const { verifyFirebaseScrypt } = await import('./firebase-scrypt.mjs');
    if (verifyFirebaseScrypt(pw, u.password_hash)) {
      await q('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(pw), u.id]);
      return true;
    }
  }
  return false;
}

route('POST', '/auth/google', async (req, ctx, body, ip) => {
  await limit('google:' + ip, 30, 600e3);
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(body.idToken || '')));
  const info = r.ok ? await r.json() : null;
  if (!info || info.aud !== process.env.GOOGLE_CLIENT_ID || !info.sub) throw new HttpError(401, 'invalid google token');
  const email = info.email_verified === 'true' || info.email_verified === true ? String(info.email || '').toLowerCase() : null;
  let u = await q1('SELECT * FROM users WHERE google_sub = ?', [info.sub]);
  if (!u && email) {
    u = await q1('SELECT * FROM users WHERE email = ?', [email]); // same verified e-mail (incl. imported Firebase accounts)
    /* e-mail sign-ups are never verified, so a password set on this row may belong to someone who
       registered the address before its real owner. Google just proved ownership: drop that password. */
    if (u) await q("UPDATE users SET google_sub = ?, kind = 'user', password_hash = NULL WHERE id = ?", [info.sub, u.id]);
  }
  if (!u) {
    u = await convertOrCreate(req, { name: clean(body.name) || clean(info.name) || (email ? email.split('@')[0] : 'player'), email, google_sub: info.sub });
  }
  u = await q1('SELECT * FROM users WHERE id = ?', [u.id]);
  if (Number(u.banned)) throw new HttpError(403, 'account blocked');
  return json(await session(u));
});

route('GET', '/me', async (req) => json({ profile: await profileOf(await requireUser(req)) }));

route('PUT', '/me', async (req, ctx, body) => {
  const u = await requireUser(req);
  const name = clean(body.name);
  if (!name) throw new HttpError(400, 'name required');
  await q('UPDATE users SET name = ? WHERE id = ?', [name, u.id]);
  return json({ ok: true, name });
});

/* ---------- personal settings (background, typing animations) ---------- */
const PRESET_BGS = ['none', 'mountains', 'city', 'registan', 'nebula', 'forest', 'aurora'];
function sanitizePrefs(p, uploads) {
  p = p && typeof p === 'object' ? p : {};
  let bg = String(p.bg || 'none');
  if (!PRESET_BGS.includes(bg) && !(bg.startsWith('custom:') && uploads.includes(bg.slice(7)))) bg = 'none';
  const accent = /^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : 'auto';
  return {
    bg,
    bgX: num(p.bgX ?? 50, 0, 100), bgY: num(p.bgY ?? 50, 0, 100),
    dim: num(p.dim ?? 45, 0, 85), blur: num(p.blur ?? 0, 0, 20),
    glass: p.glass !== false,
    accent,
    caret: pick(p.caret, ['line', 'block', 'underline', 'off'], 'line'),
    caretMotion: pick(p.caretMotion, ['smooth', 'fast', 'instant'], 'smooth'),
    caretBlink: p.caretBlink !== false,
    letterAnim: pick(p.letterAnim, ['none', 'fade', 'glow', 'rise'], 'none'),
    errorFx: pick(p.errorFx, ['red', 'shake', 'underline'], 'red'),
    finishFx: pick(p.finishFx, ['none', 'confetti', 'countup'], 'countup'),
    sound: pick(p.sound, ['error', 'off', 'mech', 'soft'], 'error'),
  };
}

route('GET', '/me/settings', async (req) => {
  const u = await requireUser(req);
  const s = parseSettings(u);
  const uploads = Array.isArray(s.uploads) ? s.uploads : [];
  return json({ prefs: sanitizePrefs(s.prefs, uploads), uploads: uploads.map((k) => ({ key: k, url: '/api/bg/' + k })), profilePublic: Number(u.profile_public ?? 1) === 1 });
});

route('PUT', '/me/settings', async (req, ctx, body) => {
  const u = await requireUser(req);
  await limit('settings:' + u.id, 120, 3600e3);
  const s = parseSettings(u);
  const uploads = Array.isArray(s.uploads) ? s.uploads : [];
  const prefs = sanitizePrefs(body.prefs, uploads);
  const pub = body.profilePublic === undefined ? Number(u.profile_public ?? 1) : (body.profilePublic ? 1 : 0);
  await q('UPDATE users SET settings = ?, profile_public = ? WHERE id = ?', [JSON.stringify({ prefs, uploads }), pub, u.id]);
  return json({ prefs, profilePublic: pub === 1 });
});

/* custom backgrounds: already resized/compressed to WebP in the browser, stored in the database (media.mjs) */
const BG_TYPES = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png' };
const MAX_UPLOADS = 3;
route('POST', '/me/background', async (req) => {
  const u = await requireUser(req);
  if (u.kind === 'guest') throw new HttpError(403, 'sign in to upload');
  await limit('bgup:' + u.id, 20, 86400e3);
  const type = (req.headers.get('content-type') || '').split(';')[0];
  if (!BG_TYPES[type]) throw new HttpError(415, 'unsupported file type');
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 4.5 * 1024 * 1024) throw new HttpError(413, 'file too large');
  const s = parseSettings(u);
  const uploads = Array.isArray(s.uploads) ? s.uploads : [];
  if (uploads.length >= MAX_UPLOADS) throw new HttpError(409, 'upload limit');
  const key = u.id + '_' + now() + BG_TYPES[type];
  await putMedia(db(), 'backgrounds', key, buf, type);
  uploads.push(key);
  await q('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify({ prefs: s.prefs || {}, uploads }), u.id]);
  return json({ key, url: '/api/bg/' + key });
});

route('DELETE', '/me/background/:key', async (req, ctx) => {
  const u = await requireUser(req);
  const s = parseSettings(u);
  const uploads = (Array.isArray(s.uploads) ? s.uploads : []);
  if (!uploads.includes(ctx.key)) throw new HttpError(404, 'not found');
  await deleteMedia(db(), 'backgrounds', ctx.key);
  const left = uploads.filter((k) => k !== ctx.key);
  const prefs = s.prefs || {};
  if (prefs.bg === 'custom:' + ctx.key) prefs.bg = 'none';
  await q('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify({ prefs, uploads: left }), u.id]);
  return json({ ok: true });
});

/* uploaded files with HEAD and byte-range support (Safari only plays video that it can fetch in ranges);
   keys are unique per upload, so responses can be cached for good */
async function serveMedia(req, store, key) {
  const head = await headMedia(db(), store, key);
  if (!head) throw new HttpError(404, 'not found');
  const size = head.size;
  const base = { 'content-type': head.type || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes' };
  if (req.method === 'HEAD') return new Response(null, { headers: { ...base, 'content-length': String(size) } });
  const m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.get('range') || '').trim());
  if (m && (m[1] || m[2]) && size > 0) {
    let start, end;
    if (m[1]) { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
    else { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...base, 'content-range': `bytes */${size}` } });
    const part = await readMedia(db(), store, key, head, start, end);
    return new Response(part, { status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(part.length) } });
  }
  const data = size ? await readMedia(db(), store, key, head) : new Uint8Array(0);
  return new Response(data, { headers: { ...base, 'content-length': String(size) } });
}
route('GET', '/bg/:key', async (req, ctx) => serveMedia(req, 'backgrounds', ctx.key));
route('HEAD', '/bg/:key', async (req, ctx) => serveMedia(req, 'backgrounds', ctx.key));

/* ---------- test results ---------- */
/* a signed "test started" stamp: lets the server check that a result did not take less time
   than actually passed on the server clock (stops hand-crafted "400 wpm in 0 seconds" posts) */
route('POST', '/tests/start', async (req) => {
  const u = await requireUser(req);
  await limit('tstart:' + u.id, 600, 3600e3);
  return json({ token: sign({ tst: u.id, t: now() }, 1 / 12) });
});

const RANKED_KINDS = ['words', 'time', 'code', 'daily'];
const MAX_HUMAN_WPM = 220;
const ACHV_ID = /^[a-z0-9_]{1,32}$/;

/* returns { wpm, acc, flag } — wpm/acc recomputed from raw counts, flag = why it looks implausible */
async function validateResult(u, body) {
  let wpm = num(body.wpm, 0, 400), acc = num(body.acc, 0, 100);
  const durationMs = num(body.durationMs, 0, 3600e3);
  const correct = num(body.correct, 0, 100000), typed = num(body.typed, 0, 100000);
  let flag = null;

  let startedAt = null;
  if (body.raceCode) {
    const code = clean(body.raceCode, 5).toUpperCase();
    const row = await q1('SELECT r.started_at FROM rooms r JOIN room_players p ON p.code = r.code AND p.user_id = ? WHERE r.code = ?', [u.id, code]);
    startedAt = row && row.started_at ? Number(row.started_at) : null;
  } else {
    const p = verify(String(body.testToken || ''));
    if (p && p.tst === u.id) startedAt = Number(p.t);
  }

  if (durationMs >= 1000 && correct > 0) {
    const calc = Math.round((correct / 5) / (durationMs / 60000));
    if (Math.abs(calc - wpm) > Math.max(3, wpm * 0.05)) flag = 'wpm does not match raw counts';
    wpm = Math.min(400, calc);
    if (typed > 0) acc = num((Math.min(correct, typed) / typed) * 100, 0, 100);
  } else if (wpm > 0) {
    flag = 'missing timing data';
  }
  if (!startedAt) flag = flag || 'no start stamp';
  else if (durationMs > now() - startedAt + 3000) flag = 'faster than the server clock';
  if (wpm > MAX_HUMAN_WPM) flag = 'above ' + MAX_HUMAN_WPM + ' wpm';

  /* key-press rhythm: bots type with near-identical gaps; humans are irregular */
  const iv = body.intervals || {};
  const n = num(iv.n, 0, 100000), median = Number(iv.median) || 0, cv = Number(iv.cv) || 0;
  if (n >= 30 && ((median > 0 && median < 25) || (cv > 0 && cv < 0.08))) flag = 'robotic key rhythm';
  return { wpm, acc, durationMs, flag };
}

route('POST', '/results', async (req, ctx, body) => {
  const u = await requireUser(req);
  if (u.kind === 'guest') return json({ ok: true, skipped: true });
  await limit('result:' + u.id, 150, 3600e3);
  const { wpm, acc, durationMs, flag } = await validateResult(u, body);
  if (wpm <= 0) return json({ profile: await profileOf(u) });
  const kind = body.raceCode ? 'race' : pick(body.kind, RANKED_KINDS, 'words');
  const textLang = kind === 'code' ? null : (clean(body.textLang, 4) || null);
  const mode = clean(body.mode, 40);
  const st = body.streak || {};
  const missed = {};
  Object.entries(body.missed || {}).slice(0, 80).forEach(([k, v]) => { if (k.length <= 2) missed[k] = num(v, 0, 10000); });
  const t = now();
  /* a missing stamp/timing (e.g. a dropped request) still counts for the player's own stats;
     only clearly implausible results are kept out of history, tier and achievements */
  const hard = !!flag && !/^(no start stamp|missing timing data)$/.test(flag);

  const stmts = [];
  if (!hard) {
    stmts.push(
      { sql: `UPDATE users SET tests_count = tests_count + 1, best_wpm = MAX(best_wpm, ?),
              streak_current = ?, streak_longest = MAX(streak_longest, ?), streak_last_date = ? WHERE id = ?`,
        args: [wpm, num(st.current, 0, 100000), num(st.longest, 0, 100000), clean(st.lastDate, 10) || null, u.id] },
      { sql: 'INSERT INTO history (user_id, wpm, acc, mode, missed, ts, duration_ms) VALUES (?,?,?,?,?,?,?)', args: [u.id, wpm, acc, mode, JSON.stringify(missed), t, durationMs] },
      { sql: `UPDATE users SET rating_wpm = COALESCE((SELECT CAST(ROUND(AVG(wpm)) AS INTEGER) FROM
                (SELECT wpm FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT 10)), 0) WHERE id = ?`, args: [u.id, u.id] },
    );
  }
  /* leaderboard: ranked modes only, decent accuracy; suspicious results wait for an admin */
  if (kind !== 'race' && (acc >= 90 || flag)) {
    stmts.push({ sql: 'INSERT INTO scores (user_id, name, mode, wpm, acc, ts, kind, text_lang, status, flag_reason) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [u.id, u.name, mode, wpm, acc, t, kind, textLang, flag ? 'flagged' : 'ok', flag] });
  }
  const li = body.langInfo || {};
  if (!hard && li.textLang) stmts.push({ sql: "INSERT OR IGNORE INTO user_langs (user_id, kind, lang) VALUES (?, 'text', ?)", args: [u.id, clean(li.textLang, 12)] });
  if (!hard && li.codeLang) stmts.push({ sql: "INSERT OR IGNORE INTO user_langs (user_id, kind, lang) VALUES (?, 'code', ?)", args: [u.id, clean(li.codeLang, 12)] });
  if (!hard) (Array.isArray(body.achievements) ? body.achievements : []).slice(0, 20).filter((a) => ACHV_ID.test(a)).forEach((a) =>
    stmts.push({ sql: 'INSERT OR IGNORE INTO achievements (user_id, id, ts) VALUES (?,?,?)', args: [u.id, a, t] }));
  if (stmts.length) await db().batch(stmts, 'write');
  return json({ wpm, acc, flagged: !!flag, ranked: kind !== 'race' && acc >= 90 && !flag, profile: await profileOf(await q1('SELECT * FROM users WHERE id = ?', [u.id])) });
});

route('GET', '/history', async (req) => {
  const u = await requireUser(req);
  const limitN = num(new URL(req.url).searchParams.get('limit') || 50, 1, 200);
  const rows = await q('SELECT wpm, acc, mode, missed, ts, duration_ms FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT ?', [u.id, limitN]);
  return json({ history: rows.reverse().map((r) => ({ wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, missed: JSON.parse(r.missed || '{}'), ts: Number(r.ts), durationMs: Number(r.duration_ms || 0) })) });
});

/* ---------- leaderboard: one row per player (their best result), current name, tier ---------- */
/* old rows (before kind/text_lang columns existed) are classified from the mode label, e.g. "words · 25 · en" */
const KIND_SQL = "COALESCE(s.kind, substr(s.mode, 1, instr(s.mode || ' ', ' ') - 1))";
const LANG_SQL = "COALESCE(s.text_lang, CASE WHEN s.mode LIKE '% · __' THEN substr(s.mode, -2) END)";

async function leaderboard({ from = 0, to = null, kind = 'all', lang = 'all', meId = null, top = 100 }) {
  const where = ["s.status = 'ok'", 's.user_id IS NOT NULL', 's.ts >= ?'], args = [from];
  if (to) { where.push('s.ts < ?'); args.push(to); }
  if (kind !== 'all') { where.push(KIND_SQL + ' = ?'); args.push(kind); }
  if (lang !== 'all') { where.push(LANG_SQL + ' = ?'); args.push(lang); }
  const rows = await q(`
    WITH best AS (
      SELECT s.user_id, s.wpm, s.acc, s.mode, s.ts,
             ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.wpm DESC, s.acc DESC, s.ts ASC) AS rn
      FROM scores s WHERE ${where.join(' AND ')}
    ), ranked AS (
      SELECT b.user_id, u.name, u.rating_wpm, u.tests_count, b.wpm, b.acc, b.mode, b.ts,
             ROW_NUMBER() OVER (ORDER BY b.wpm DESC, b.acc DESC, b.ts ASC) AS rank,
             COUNT(*) OVER () AS total
      FROM best b JOIN users u ON u.id = b.user_id
      WHERE b.rn = 1 AND u.banned = 0 AND u.kind = 'user'
    )
    SELECT * FROM ranked WHERE rank <= ? OR user_id = ? ORDER BY rank`, [...args, top, meId || '']);
  const map = (r) => ({ id: r.user_id, name: r.name, rating: Number(r.rating_wpm || 0), tests: Number(r.tests_count), wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, ts: Number(r.ts), rank: Number(r.rank) });
  const me = rows.find((r) => r.user_id === meId);
  return {
    rows: rows.filter((r) => Number(r.rank) <= top).map(map),
    me: me ? map(me) : null,
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

route('GET', '/leaderboard', async (req) => {
  const sp = new URL(req.url).searchParams;
  const kind = pick(sp.get('mode'), ['all', ...RANKED_KINDS], 'all');
  const period = kind === 'daily' ? 'day' : pick(sp.get('period'), ['day', 'week', 'month', 'all'], 'all');
  const lang = pick(sp.get('lang'), ['all', 'en', 'ru', 'uz', 'kk', 'ky'], 'all');
  const me = await authUser(req).catch(() => null);
  const lb = await leaderboard({ from: periodStart(period), kind, lang, meId: me && me.id });
  /* last week's winner, shown as a banner */
  const weekStart = periodStart('week');
  const champ = (await leaderboard({ from: weekStart - 7 * 86400e3, to: weekStart, top: 1 })).rows[0] || null;
  return json({ period, mode: kind, lang, scores: lb.rows, me: lb.me, total: lb.total, champion: champ });
});

/* ---------- public profile ---------- */
route('GET', '/users/:id', async (req, ctx) => {
  const u = await q1('SELECT * FROM users WHERE id = ?', [ctx.id]);
  if (!u || u.kind !== 'user' || Number(u.banned)) throw new HttpError(404, 'user not found');
  const viewer = await authUser(req).catch(() => null);
  const isSelf = !!viewer && viewer.id === u.id;
  if (!isSelf && Number(u.profile_public ?? 1) !== 1) throw new HttpError(403, 'profile is private');
  const t = now();
  const [base, hist, totals, week, prevWeek, activity, byMode, rankRow] = await Promise.all([
    profileOf(u),
    q('SELECT wpm, acc, mode, ts, duration_ms FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT 200', [u.id]),
    q1('SELECT COUNT(*) AS n, COALESCE(SUM(duration_ms),0) AS ms, AVG(wpm) AS wpm, AVG(acc) AS acc FROM history WHERE user_id = ?', [u.id]),
    q1('SELECT AVG(wpm) AS wpm, COUNT(*) AS n FROM history WHERE user_id = ? AND ts >= ?', [u.id, t - 7 * 86400e3]),
    q1('SELECT AVG(wpm) AS wpm, COUNT(*) AS n FROM history WHERE user_id = ? AND ts >= ? AND ts < ?', [u.id, t - 14 * 86400e3, t - 7 * 86400e3]),
    q("SELECT date((ts + ?) / 1000, 'unixepoch') AS d, COUNT(*) AS c FROM history WHERE user_id = ? AND ts >= ? GROUP BY d", [TZ_MS, u.id, t - 371 * 86400e3]),
    q(`SELECT ${KIND_SQL} AS k, ${LANG_SQL} AS l, MAX(s.wpm) AS wpm FROM scores s WHERE s.user_id = ? AND s.status = 'ok' GROUP BY k, l ORDER BY wpm DESC`, [u.id]),
    q1(`SELECT COUNT(*) + 1 AS rank, (SELECT COUNT(DISTINCT s2.user_id) FROM scores s2 JOIN users u2 ON u2.id = s2.user_id WHERE s2.status = 'ok' AND u2.banned = 0) AS total
        FROM (SELECT s.user_id, MAX(s.wpm) AS m FROM scores s JOIN users x ON x.id = s.user_id WHERE s.status = 'ok' AND x.banned = 0 GROUP BY s.user_id)
        WHERE m > (SELECT COALESCE(MAX(wpm), -1) FROM scores WHERE user_id = ? AND status = 'ok')`, [u.id]),
  ]);
  const hasRanked = byMode.length > 0;
  if (!isSelf) { delete base.email; delete base.settings; }
  return json({
    profile: {
      ...base, isSelf,
      rank: hasRanked ? Number(rankRow.rank) : null, players: Number(rankRow?.total || 0),
      totals: { tests: Number(totals.n), typingMs: Number(totals.ms), avgWpm: Math.round(Number(totals.wpm) || 0), avgAcc: Math.round(Number(totals.acc) || 0) },
      week: { avgWpm: week.n ? Math.round(Number(week.wpm)) : null, prevAvgWpm: prevWeek.n ? Math.round(Number(prevWeek.wpm)) : null },
      activity: Object.fromEntries(activity.map((r) => [r.d, Number(r.c)])),
      bestByMode: byMode.map((r) => ({ kind: r.k, lang: r.l, wpm: Number(r.wpm) })),
      history: hist.reverse().map((r) => ({ wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, ts: Number(r.ts), durationMs: Number(r.duration_ms || 0) })),
    },
  });
});

/* ---------- race rooms (clients poll GET /rooms/:code) ---------- */
const CODE = /^[A-Z0-9]{5}$/;
async function roomView(code) {
  const room = await q1('SELECT * FROM rooms WHERE code = ?', [code]);
  if (!room) return null;
  const ps = await q('SELECT * FROM room_players WHERE code = ? ORDER BY joined_at', [code]);
  const players = {};
  ps.forEach((p) => players[p.user_id] = { name: p.name, progress: Number(p.progress), wpm: Number(p.wpm), finished: !!p.finished, finishedAt: p.finished_at ? Number(p.finished_at) : undefined });
  return {
    hostUid: room.host_id, text: room.text, lang: room.lang, textLang: room.text_lang, type: room.type,
    timeLimit: Number(room.time_limit), maxPlayers: Number(room.max_players), status: room.status,
    startedAt: room.started_at ? Number(room.started_at) : null, serverTime: now(), players,
  };
}
async function hostRoom(code, u) {
  const room = await q1('SELECT * FROM rooms WHERE code = ?', [code]);
  if (!room) throw new HttpError(404, 'room not found');
  if (room.host_id !== u.id) throw new HttpError(403, 'host only');
  return room;
}

route('POST', '/rooms', async (req, ctx, body) => {
  const u = await requireUser(req);
  await limit('room:' + u.id, 20, 3600e3);
  await q('DELETE FROM room_players WHERE code IN (SELECT code FROM rooms WHERE created_at < ?)', [now() - 6 * 3600e3]);
  await q('DELETE FROM rooms WHERE created_at < ?', [now() - 6 * 3600e3]);
  const text = String(body.text || '').slice(0, 4000);
  if (!text) throw new HttpError(400, 'text required');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code, tries = 0;
  do { code = Array.from({ length: 5 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (await q1('SELECT 1 FROM rooms WHERE code = ?', [code]) && ++tries < 10);
  await db().batch([
    { sql: 'INSERT INTO rooms (code, host_id, text, lang, text_lang, type, time_limit, max_players, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [code, u.id, text, clean(body.lang, 12), clean(body.textLang, 12), clean(body.type, 12), num(body.timeLimit, 10, 600) || 60, num(body.maxPlayers, 2, 10) || 10, 'waiting', now()] },
    { sql: 'INSERT INTO room_players (code, user_id, name, joined_at) VALUES (?,?,?,?)', args: [code, u.id, u.name, now()] },
  ], 'write');
  return json({ code, room: await roomView(code) });
});

route('GET', '/rooms/:code', async (req, ctx) => {
  await requireUser(req);
  const room = await roomView(ctx.code.toUpperCase());
  if (!room) throw new HttpError(404, 'room not found');
  return json({ room });
});

route('POST', '/rooms/:code/join', async (req, ctx) => {
  const u = await requireUser(req);
  const code = ctx.code.toUpperCase();
  if (!CODE.test(code)) throw new HttpError(404, 'room not found');
  const room = await roomView(code);
  if (!room) throw new HttpError(404, 'room not found');
  const mine = room.players[u.id];
  if (!mine) {
    if (room.status !== 'waiting') throw new HttpError(409, 'already started');
    if (Object.keys(room.players).length >= room.maxPlayers) throw new HttpError(409, 'room full');
    await q('INSERT OR IGNORE INTO room_players (code, user_id, name, joined_at) VALUES (?,?,?,?)', [code, u.id, u.name, now()]);
  }
  return json({ room: await roomView(code) });
});

route('POST', '/rooms/:code/leave', async (req, ctx) => {
  const u = await requireUser(req);
  const code = ctx.code.toUpperCase();
  const room = await q1('SELECT host_id FROM rooms WHERE code = ?', [code]);
  if (room && room.host_id === u.id) {
    await db().batch([{ sql: 'DELETE FROM room_players WHERE code = ?', args: [code] }, { sql: 'DELETE FROM rooms WHERE code = ?', args: [code] }], 'write');
  } else {
    await q('DELETE FROM room_players WHERE code = ? AND user_id = ?', [code, u.id]);
  }
  return json({ ok: true });
});

route('POST', '/rooms/:code/start', async (req, ctx) => {
  const code = ctx.code.toUpperCase();
  await hostRoom(code, await requireUser(req));
  await q("UPDATE rooms SET status = 'racing', started_at = ? WHERE code = ?", [now(), code]);
  return json({ ok: true });
});

route('POST', '/rooms/:code/progress', async (req, ctx, body) => {
  const u = await requireUser(req);
  const code = ctx.code.toUpperCase();
  const fin = body.finished ? 1 : 0;
  await q(`UPDATE room_players SET progress = ?, wpm = ?, finished = ?, finished_at = CASE WHEN ? = 1 AND finished_at IS NULL THEN ? ELSE finished_at END
           WHERE code = ? AND user_id = ? AND finished = 0 AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND status = 'racing')`,
    [num(body.progress, 0, 100), num(body.wpm, 0, 400), fin, fin, now(), code, u.id, code]);
  return json({ ok: true });
});

route('POST', '/rooms/:code/finish', async (req, ctx) => {
  const code = ctx.code.toUpperCase();
  await hostRoom(code, await requireUser(req));
  await q("UPDATE rooms SET status = 'finished', finished_at = ? WHERE code = ? AND status != 'finished'", [now(), code]);
  return json({ ok: true });
});

route('POST', '/rooms/:code/reset', async (req, ctx) => {
  const code = ctx.code.toUpperCase();
  await hostRoom(code, await requireUser(req));
  await db().batch([
    { sql: "UPDATE rooms SET status = 'waiting', started_at = NULL, finished_at = NULL WHERE code = ?", args: [code] },
    { sql: 'UPDATE room_players SET progress = 0, wpm = 0, finished = 0, finished_at = NULL WHERE code = ?', args: [code] },
  ], 'write');
  return json({ ok: true });
});

/* ---------- ad slot ---------- */
/* the live ad, or null: a switched-off (draft) ad is only visible to the admin */
route('GET', '/settings/ad', async () => {
  const r = await q1("SELECT value FROM settings WHERE key = 'ad'");
  const ad = r ? JSON.parse(r.value) : null;
  const live = ad && ad.enabled && (ad.videoUrl || ad.imageUrl);
  return json({ ad: live ? ad : null });
});

const dayKey = (t = now()) => new Date(t + TZ_MS).toISOString().slice(0, 10);
route('POST', '/ad/event', async (req, ctx, body, ip) => {
  const kind = pick(body.kind, ['view', 'click'], null);
  if (!kind) throw new HttpError(400, 'bad kind');
  /* the page sends one view per visitor per day and at most one click per page view */
  await limit('ad:' + kind + ':' + ip, kind === 'view' ? 30 : 20, 3600e3);
  await q('INSERT INTO ad_stats (day, kind, count) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1', [dayKey(), kind]);
  return json({ ok: true });
});

/* ---------- admin ---------- */
route('POST', '/admin/login', async (req, ctx, body, ip) => {
  await limit('admin:' + ip, 10, 600e3);
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new HttpError(500, 'admin not configured');
  if (!safeEq(clean(body.email, 120).toLowerCase(), ADMIN_EMAIL.toLowerCase()) | !safeEq(String(body.password || ''), ADMIN_PASSWORD)) throw new HttpError(401, 'wrong credentials');
  await adminLog('login', null, ip);
  return json({ token: sign({ admin: true }, 1) });
});

route('GET', '/admin/stats', async (req) => {
  requireAdmin(req);
  const t = now(), today = periodStart('day'), from30 = today - 29 * 86400e3;
  const [online, onlineUsers, totals, todayRow, rooms, flagged, testsDaily, usersDaily] = await Promise.all([
    q1('SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ?', [t - 5 * 60e3]),
    q("SELECT id, name, kind, last_seen_at FROM users WHERE last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 30", [t - 5 * 60e3]),
    q1("SELECT SUM(kind = 'user') AS users, SUM(kind = 'guest') AS guests, SUM(banned) AS banned FROM users"),
    q1("SELECT (SELECT COUNT(*) FROM history WHERE ts >= ?) AS tests, (SELECT COUNT(*) FROM users WHERE created_at >= ? AND kind = 'user') AS signups", [today, today]),
    q1("SELECT COUNT(*) AS c FROM rooms WHERE status != 'finished' AND created_at >= ?", [t - 3600e3]),
    q1("SELECT COUNT(*) AS c FROM scores WHERE status = 'flagged'"),
    q("SELECT date((ts + ?) / 1000, 'unixepoch') AS d, COUNT(*) AS c FROM history WHERE ts >= ? GROUP BY d", [TZ_MS, from30]),
    q("SELECT date((created_at + ?) / 1000, 'unixepoch') AS d, COUNT(*) AS c FROM users WHERE kind = 'user' AND created_at >= ? GROUP BY d", [TZ_MS, from30]),
  ]);
  const days = [];
  const tm = Object.fromEntries(testsDaily.map((r) => [r.d, Number(r.c)])), um = Object.fromEntries(usersDaily.map((r) => [r.d, Number(r.c)]));
  for (let i = 0; i < 30; i++) { const d = dayKey(from30 + i * 86400e3); days.push({ d, tests: tm[d] || 0, signups: um[d] || 0 }); }
  return json({
    online: Number(online.c),
    onlineUsers: onlineUsers.map((r) => ({ id: r.id, name: r.name, guest: r.kind === 'guest', lastSeenAt: Number(r.last_seen_at) })),
    users: Number(totals.users || 0), guests: Number(totals.guests || 0), banned: Number(totals.banned || 0),
    testsToday: Number(todayRow.tests), signupsToday: Number(todayRow.signups), activeRooms: Number(rooms.c), flagged: Number(flagged.c),
    days,
  });
});

route('GET', '/admin/users', async (req) => {
  requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const search = clean(sp.get('q'), 60).toLowerCase();
  const kind = pick(sp.get('kind'), ['user', 'guest', 'all', 'banned'], 'user');
  const sort = { last: 'COALESCE(last_seen_at, last_login_at, 0) DESC', created: 'created_at DESC', best: 'best_wpm DESC', tests: 'tests_count DESC' }[sp.get('sort')] || 'COALESCE(last_seen_at, last_login_at, 0) DESC';
  const page = num(sp.get('page'), 0, 10000), per = 50;
  const where = [], args = [];
  if (kind === 'banned') where.push('banned = 1');
  else if (kind !== 'all') { where.push('kind = ?'); args.push(kind); }
  if (search) { where.push("(lower(name) LIKE ? OR lower(COALESCE(email,'')) LIKE ? OR id = ?)"); args.push('%' + search + '%', '%' + search + '%', search); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const [rows, cnt] = await Promise.all([
    q(`SELECT id, name, email, kind, banned, created_at, last_login_at, last_seen_at, tests_count, best_wpm, rating_wpm FROM users ${w} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...args, per, page * per]),
    q1(`SELECT COUNT(*) AS c FROM users ${w}`, args),
  ]);
  return json({
    total: Number(cnt.c), page, per,
    users: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, kind: r.kind, banned: !!Number(r.banned), createdAt: Number(r.created_at), lastLoginAt: r.last_login_at ? Number(r.last_login_at) : null, lastSeenAt: r.last_seen_at ? Number(r.last_seen_at) : null, testsCount: Number(r.tests_count), bestWpm: Number(r.best_wpm), ratingWpm: Number(r.rating_wpm || 0) })),
  });
});

route('GET', '/admin/users/:id', async (req, ctx) => {
  requireAdmin(req);
  const u = await q1('SELECT * FROM users WHERE id = ?', [ctx.id]);
  if (!u) throw new HttpError(404, 'user not found');
  const [hist, scores] = await Promise.all([
    q('SELECT wpm, acc, mode, ts, duration_ms FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT 30', [u.id]),
    q('SELECT id, wpm, acc, mode, ts, status, flag_reason FROM scores WHERE user_id = ? ORDER BY ts DESC LIMIT 30', [u.id]),
  ]);
  return json({
    user: { id: u.id, name: u.name, email: u.email, kind: u.kind, banned: !!Number(u.banned), createdAt: Number(u.created_at), lastLoginAt: u.last_login_at ? Number(u.last_login_at) : null, lastSeenAt: u.last_seen_at ? Number(u.last_seen_at) : null, testsCount: Number(u.tests_count), bestWpm: Number(u.best_wpm), ratingWpm: Number(u.rating_wpm || 0), google: !!u.google_sub, profilePublic: Number(u.profile_public ?? 1) === 1 },
    history: hist.map((r) => ({ wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, ts: Number(r.ts), durationMs: Number(r.duration_ms || 0) })),
    scores: scores.map((r) => ({ id: Number(r.id), wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, ts: Number(r.ts), status: r.status, reason: r.flag_reason })),
  });
});

route('POST', '/admin/users/:id/ban', async (req, ctx, body) => {
  requireAdmin(req);
  const banned = body.banned ? 1 : 0;
  await q('UPDATE users SET banned = ? WHERE id = ?', [banned, ctx.id]);
  await adminLog(banned ? 'ban' : 'unban', ctx.id);
  return json({ ok: true });
});

route('PUT', '/admin/users/:id/name', async (req, ctx, body) => {
  requireAdmin(req);
  const name = clean(body.name);
  if (!name) throw new HttpError(400, 'name required');
  await q('UPDATE users SET name = ? WHERE id = ?', [name, ctx.id]);
  await adminLog('rename', ctx.id, name);
  return json({ ok: true });
});

route('POST', '/admin/users/:id/hide-scores', async (req, ctx) => {
  requireAdmin(req);
  await q("UPDATE scores SET status = 'hidden' WHERE user_id = ?", [ctx.id]);
  await adminLog('hide-scores', ctx.id);
  return json({ ok: true });
});

route('GET', '/admin/flagged', async (req) => {
  requireAdmin(req);
  const rows = await q("SELECT s.id, s.user_id, u.name, s.wpm, s.acc, s.mode, s.ts, s.flag_reason FROM scores s LEFT JOIN users u ON u.id = s.user_id WHERE s.status = 'flagged' ORDER BY s.ts DESC LIMIT 200");
  return json({ scores: rows.map((r) => ({ id: Number(r.id), userId: r.user_id, name: r.name, wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, ts: Number(r.ts), reason: r.flag_reason })) });
});

route('POST', '/admin/scores/:id/:action', async (req, ctx) => {
  requireAdmin(req);
  const status = { approve: 'ok', hide: 'hidden' }[ctx.action];
  if (!status) throw new HttpError(404, 'not found');
  const s = await q1('SELECT user_id, wpm FROM scores WHERE id = ?', [num(ctx.id, 0, 1e15)]);
  if (!s) throw new HttpError(404, 'score not found');
  await q('UPDATE scores SET status = ? WHERE id = ?', [status, num(ctx.id, 0, 1e15)]);
  if (status === 'ok' && s.user_id) await q('UPDATE users SET best_wpm = MAX(best_wpm, ?) WHERE id = ?', [Number(s.wpm), s.user_id]);
  await adminLog(ctx.action + '-score', s.user_id, 'score ' + ctx.id + ', ' + s.wpm + ' wpm');
  return json({ ok: true });
});

route('GET', '/admin/log', async (req) => {
  requireAdmin(req);
  const rows = await q('SELECT l.ts, l.action, l.target, l.detail, u.name FROM admin_log l LEFT JOIN users u ON u.id = l.target ORDER BY l.id DESC LIMIT 200');
  return json({ log: rows.map((r) => ({ ts: Number(r.ts), action: r.action, target: r.target, name: r.name, detail: r.detail })) });
});

route('GET', '/admin/ad-stats', async (req) => {
  requireAdmin(req);
  const rows = await q('SELECT day, kind, count FROM ad_stats WHERE day >= ? ORDER BY day', [dayKey(now() - 29 * 86400e3)]);
  /* every one of the last 30 days, zeros included, so the chart's x axis is real time */
  const by = {};
  for (let i = 29; i >= 0; i--) { const d = dayKey(now() - i * 86400e3); by[d] = { day: d, view: 0, click: 0 }; }
  rows.forEach((r) => { if (by[r.day]) by[r.day][r.kind] = Number(r.count); });
  return json({ days: Object.values(by) });
});

/* link: absolute http(s) only. media: an uploaded file (/api/media/<key>) or an absolute http(s) URL */
const MEDIA_PATH = /^\/api\/media\/[A-Za-z0-9._-]+$/;
function adUrl(v, field, { media }) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s.length > 500) throw new HttpError(400, field + ': too long');
  if (media && MEDIA_PATH.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { throw new HttpError(400, field + ': must start with https://'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new HttpError(400, field + ': must start with https://');
  return u.href;
}
route('PUT', '/admin/ad', async (req, ctx, body) => {
  requireAdmin(req);
  const ad = {
    enabled: !!body.enabled,
    imageUrl: adUrl(body.imageUrl, 'image', { media: true }),
    mobileImageUrl: adUrl(body.mobileImageUrl, 'mobile image', { media: true }),
    videoUrl: adUrl(body.videoUrl, 'video', { media: true }),
    linkUrl: adUrl(body.linkUrl, 'link', { media: false }),
    text: clean(body.text, 120),
  };
  if (ad.enabled && !ad.imageUrl && !ad.videoUrl) throw new HttpError(400, 'add an image or a video before switching the ad on');
  await q("INSERT INTO settings (key, value) VALUES ('ad', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(ad)]);
  /* uploads that the saved ad no longer uses (older than an hour, so a file uploaded but not yet saved survives) */
  const used = new Set([ad.imageUrl, ad.mobileImageUrl, ad.videoUrl].filter((u) => MEDIA_PATH.test(u)).map((u) => u.slice('/api/media/'.length)));
  const stale = (await listMedia(db(), 'ads')).filter((m) => !used.has(m.key) && m.createdAt < now() - 3600e3);
  for (const m of stale) await deleteMedia(db(), 'ads', m.key);
  await adminLog('ad-update', null, (ad.enabled ? 'enabled' : 'disabled') + (stale.length ? ', removed ' + stale.length + ' old file(s)' : ''));
  return json({ ok: true, ad });
});

/* the admin panel reads the saved ad including a switched-off draft */
route('GET', '/admin/ad', async (req) => {
  requireAdmin(req);
  const r = await q1("SELECT value FROM settings WHERE key = 'ad'");
  return json({ ad: r ? JSON.parse(r.value) : null });
});

/* ad media: stored in the database (media.mjs), served from /api/media/<key>. Netlify limits request bodies to ~6 MB. */
const MEDIA_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm' };
route('POST', '/admin/upload', async (req) => {
  requireAdmin(req);
  const type = (req.headers.get('content-type') || '').split(';')[0];
  if (!MEDIA_TYPES[type]) throw new HttpError(415, 'unsupported file type');
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 5.5 * 1024 * 1024) throw new HttpError(413, 'file too large (max ~5 MB)');
  const key = now() + '_' + uid().slice(0, 6) + MEDIA_TYPES[type];
  await putMedia(db(), 'ads', key, buf, type);
  return json({ url: '/api/media/' + key });
});

route('GET', '/media/:key', async (req, ctx) => serveMedia(req, 'ads', ctx.key));
route('HEAD', '/media/:key', async (req, ctx) => serveMedia(req, 'ads', ctx.key));

/* ---------- AI coach (server-side Groq call, OpenAI-compatible API) ---------- */
async function groqChat(messages, { json = false, maxTokens = 400 } = {}) {
  if (!process.env.GROQ_API_KEY) throw new HttpError(503, 'coach unavailable');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages, max_tokens: maxTokens, temperature: 0.6,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!r.ok) { console.error('groq error', r.status, await r.text().catch(() => '')); throw new HttpError(502, 'coach upstream error'); }
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

const LANG_NAMES = { uz: "Uzbek (Latin script)", ru: 'Russian', en: 'English', kk: 'Kazakh (Cyrillic)', ky: 'Kyrgyz (Cyrillic)' };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const charLabel = (ch) => (ch === ' ' ? '(space)' : ch === '\n' ? '(newline)' : ch);

/* Short coaching tip. The prompt is built here from the user's mistake counts only, so this endpoint
   can't be used as a general-purpose proxy to the LLM. */
route('POST', '/coach', async (req, ctx, body) => {
  const u = await requireUser(req);
  await limit('coach:' + u.id, 30, 3600e3);
  const lang = LANG_NAMES[body.lang] ? body.lang : 'en';
  const missed = Object.entries(body.missed || {})
    .filter(([k]) => typeof k === 'string' && k.length >= 1 && k.length <= 2)
    .map(([k, v]) => [k, num(v, 0, 10000)]).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!missed.length) throw new HttpError(400, 'no data');
  const total = missed.reduce((s, [, v]) => s + v, 0);
  const minor = missed.filter(([k]) => k !== '\n').length <= 2 && total <= 8;
  const sys = `You are a friendly personal typing coach in a typing-speed app. In 2-3 sentences, warm and motivating, no jargon, no headings or formatting, write in ${LANG_NAMES[lang]}. ` +
    (minor ? 'There are very few mistakes: reassure the user and do NOT recommend drilling those 1-2 letters dozens of times.'
           : 'There are quite a few mistakes: recommend a short exercise focused on exactly these characters.');
  const user = 'Most-missed characters in the last tests (character: count): ' + missed.map(([k, v]) => charLabel(k) + ': ' + v).join(', ') + '. Total mistakes: ' + total + '.';
  return json({ text: await groqChat([{ role: 'system', content: sys }, { role: 'user', content: user }], { maxTokens: 260 }) });
});

/* Builds a numeric picture of the user's recent typing, then asks the model to explain the weak spots. */
route('POST', '/coach/analyze', async (req, ctx, body) => {
  const u = await requireUser(req);
  await limit('analyze:' + u.id, 12, 3600e3);
  const lang = LANG_NAMES[body.lang] ? body.lang : 'en';
  const rows = u.kind === 'guest' ? [] : (await q('SELECT wpm, acc, mode, missed, ts FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT 50', [u.id])).reverse();
  const missed = {};
  const addMissed = (m) => Object.entries(m || {}).forEach(([k, v]) => { if (k.length <= 2) missed[k] = (missed[k] || 0) + num(v, 0, 10000); });
  rows.slice(-10).forEach((r) => addMissed(JSON.parse(r.missed || '{}')));
  if (!rows.length) addMissed(body.missed); // guests: this session's mistakes sent by the client
  const wpms = rows.map((r) => Number(r.wpm)), accs = rows.map((r) => Number(r.acc));
  const last = rows.slice(-5), prev = rows.slice(-10, -5);
  const byMode = {};
  rows.forEach((r) => { const m = String(r.mode).split(' · ')[0]; (byMode[m] ||= []).push(Number(r.wpm)); });
  const stats = {
    tests: rows.length, avgWpm: Math.round(avg(wpms)), bestWpm: Math.max(0, ...wpms), avgAcc: Math.round(avg(accs)),
    lowAccTests: accs.filter((a) => a < 90).length,
    recentWpm: Math.round(avg(last.map((r) => Number(r.wpm)))), previousWpm: prev.length ? Math.round(avg(prev.map((r) => Number(r.wpm)))) : null,
    recentAcc: Math.round(avg(last.map((r) => Number(r.acc)))),
    modes: Object.fromEntries(Object.entries(byMode).map(([m, v]) => [m, Math.round(avg(v))])),
    streak: Number(u.streak_current),
    topMissed: Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ch, n]) => ({ ch: charLabel(ch), n })),
  };
  if (stats.tests < 3 && !stats.topMissed.length) return json({ stats, analysis: null, reason: 'not_enough_data' });

  const sys = `You are a friendly, honest typing coach inside a typing-speed app. Analyse the user's stats and reply ONLY with a JSON object:
{"summary": string (1-2 sentences, overall level and trend), "weaknesses": [{"title": string (max 5 words), "detail": string (1 sentence, cite numbers)}] (1 to 3 items, the most important problems first), "tips": [string] (2 to 3 concrete practice tips), "focusChars": string (up to 5 characters worth drilling, no spaces, or empty)}.
Rules: base every claim on the numbers given; do not invent data; accuracy below 92% matters more than speed; a trend is only meaningful with previousWpm present; be encouraging, no jargon. Write all text in ${LANG_NAMES[lang]}.`;
  const raw = await groqChat([{ role: 'system', content: sys }, { role: 'user', content: 'User name: ' + u.name + '\nStats JSON: ' + JSON.stringify(stats) }], { json: true, maxTokens: 600 });
  let a = null;
  try { a = JSON.parse(raw); } catch { throw new HttpError(502, 'coach bad response'); }
  const str = (v, n) => String(v ?? '').slice(0, n);
  return json({
    stats,
    analysis: {
      summary: str(a.summary, 400),
      weaknesses: (Array.isArray(a.weaknesses) ? a.weaknesses : []).slice(0, 3).map((w) => ({ title: str(w.title, 60), detail: str(w.detail, 300) })),
      tips: (Array.isArray(a.tips) ? a.tips : []).slice(0, 3).map((x) => str(x, 300)),
      focusChars: str(a.focusChars, 12).replace(/\s/g, ''),
    },
  });
});

/* ---------- entry ---------- */
export default async (req, context) => {
  try {
    /* a missing env var would otherwise surface as an opaque 500; say exactly which one is absent (names only) */
    if (new URL(req.url).pathname.endsWith('/health')) {
      const names = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'GROQ_API_KEY'];
      let dbStatus = 'ok';
      try { await db().execute('SELECT 1'); } catch (e) { dbStatus = 'error: ' + String(e.message).slice(0, 200); }
      return json({ api: 'ok', env: Object.fromEntries(names.map((k) => [k, !!process.env[k]])), database: dbStatus });
    }
    const missing = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].filter((k) => !process.env[k] && !(k === 'TURSO_AUTH_TOKEN' && /^file:/.test(process.env.TURSO_DATABASE_URL || '')));
    if (missing.length) throw new HttpError(503, 'server not configured, missing environment variables: ' + missing.join(', '));
    await ensureSchema();
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
    /* Netlify passes the client ip in context; server.mjs (Render / any Node host) does the same */
    const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      let body = {};
      if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers.get('content-type') || '').match(/^(image|video)\//)) {
        body = await req.json().catch(() => ({}));
      }
      return await r.fn(req, m.groups || {}, body, ip);
    }
    throw new HttpError(404, 'not found');
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error('api error', err);
    return json({ error: 'server error' }, 500);
  }
};
