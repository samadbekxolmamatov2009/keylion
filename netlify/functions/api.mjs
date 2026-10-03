/* KeyLion API — single Netlify Function (served at /api/*), backed by Turso (libSQL).
   Env vars (Netlify → Site settings → Environment variables):
     TURSO_DATABASE_URL, TURSO_AUTH_TOKEN   database
     JWT_SECRET                             long random string, signs login tokens
     GOOGLE_CLIENT_ID                       Google OAuth web client id (for "Sign in with Google")
     ADMIN_EMAIL, ADMIN_PASSWORD            credentials for /admin.html
     ANTHROPIC_API_KEY                      AI coach (key never reaches the browser) */
import { createClient } from '@libsql/client';
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { SCHEMA } from './schema.mjs';

export const config = { path: '/api/*' };

/* ---------- db ---------- */
let client = null, schemaReady = null;
function db() {
  if (!client) client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}
function ensureSchema() {
  if (!schemaReady) schemaReady = db().batch(SCHEMA.map((sql) => ({ sql, args: [] })), 'write');
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

const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload, days = 90) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(now() / 1000) + days * 86400 }));
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token || !process.env.JWT_SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64url');
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
  return await q1('SELECT * FROM users WHERE id = ?', [p.sub]);
}
async function requireUser(req) {
  const u = await authUser(req);
  if (!u) throw new HttpError(401, 'unauthorized');
  return u;
}
function requireAdmin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  const p = m && verify(m[1]);
  if (!p || p.admin !== true) throw new HttpError(403, 'admin only');
}
const tokenFor = (u) => sign({ sub: u.id });

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
    bestWpm: Number(u.best_wpm), testsCount: Number(u.tests_count),
    streak: { current: Number(u.streak_current), longest: Number(u.streak_longest), lastDate: u.streak_last_date },
    langsUsed, codeLangsUsed, achievements,
  };
}
async function session(u) {
  await q('UPDATE users SET last_login_at = ? WHERE id = ?', [now(), u.id]);
  return { token: tokenFor(u), profile: await profileOf(u) };
}

/* ---------- rate limit (best effort, per warm instance) ---------- */
const hits = new Map();
function limit(key, max, windowMs) {
  const t = now(), arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'too many requests');
  arr.push(t); hits.set(key, arr);
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
  limit('guest:' + req_ip, 30, 3600e3);
  const id = uid();
  await q('INSERT INTO users (id, kind, name, created_at) VALUES (?,?,?,?)', [id, 'guest', clean(body.name) || "o'yinchi" + (100 + Math.floor(Math.random() * 900)), now()]);
  return json(await session(await q1('SELECT * FROM users WHERE id = ?', [id])));
});

route('POST', '/auth/signup', async (req, ctx, body, ip) => {
  limit('signup:' + ip, 10, 3600e3);
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
  limit('login:' + ip, 20, 600e3);
  const email = clean(body.email, 120).toLowerCase();
  const u = await q1('SELECT * FROM users WHERE email = ?', [email]);
  if (!u || !(await verifyAnyPassword(u, String(body.password || '')))) throw new HttpError(401, 'wrong email or password');
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
  limit('google:' + ip, 30, 600e3);
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(body.idToken || '')));
  const info = r.ok ? await r.json() : null;
  if (!info || info.aud !== process.env.GOOGLE_CLIENT_ID || !info.sub) throw new HttpError(401, 'invalid google token');
  const email = info.email_verified === 'true' || info.email_verified === true ? String(info.email || '').toLowerCase() : null;
  let u = await q1('SELECT * FROM users WHERE google_sub = ?', [info.sub]);
  if (!u && email) {
    u = await q1('SELECT * FROM users WHERE email = ?', [email]); // same verified e-mail (incl. imported Firebase accounts)
    if (u) await q('UPDATE users SET google_sub = ?, kind = \'user\' WHERE id = ?', [info.sub, u.id]);
  }
  if (!u) {
    u = await convertOrCreate(req, { name: clean(body.name) || clean(info.name) || (email ? email.split('@')[0] : 'player'), email, google_sub: info.sub });
  }
  return json(await session(await q1('SELECT * FROM users WHERE id = ?', [u.id])));
});

route('GET', '/me', async (req) => json({ profile: await profileOf(await requireUser(req)) }));

route('PUT', '/me', async (req, ctx, body) => {
  const u = await requireUser(req);
  const name = clean(body.name);
  if (!name) throw new HttpError(400, 'name required');
  await q('UPDATE users SET name = ? WHERE id = ?', [name, u.id]);
  return json({ ok: true, name });
});

/* ---------- scores / history / stats ---------- */
route('POST', '/scores', async (req, ctx, body) => {
  const u = await requireUser(req);
  limit('score:' + u.id, 60, 3600e3);
  const wpm = num(body.wpm, 0, 400), acc = num(body.acc, 0, 100);
  if (wpm <= 0) return json({ ok: true });
  await q('INSERT INTO scores (user_id, name, mode, wpm, acc, ts) VALUES (?,?,?,?,?,?)', [u.id, u.name, clean(body.mode, 40), wpm, acc, now()]);
  return json({ ok: true });
});

const ACHV_ID = /^[a-z0-9_]{1,32}$/;
route('POST', '/results', async (req, ctx, body) => {
  const u = await requireUser(req);
  if (u.kind === 'guest') return json({ ok: true, skipped: true });
  limit('result:' + u.id, 120, 3600e3);
  const wpm = num(body.wpm, 0, 400), acc = num(body.acc, 0, 100);
  const st = body.streak || {};
  const missed = {};
  Object.entries(body.missed || {}).slice(0, 80).forEach(([k, v]) => { if (k.length <= 2) missed[k] = num(v, 0, 10000); });
  const stmts = [
    { sql: `UPDATE users SET tests_count = tests_count + 1, best_wpm = MAX(best_wpm, ?),
            streak_current = ?, streak_longest = MAX(streak_longest, ?), streak_last_date = ? WHERE id = ?`,
      args: [wpm, num(st.current, 0, 100000), num(st.longest, 0, 100000), clean(st.lastDate, 10) || null, u.id] },
    { sql: 'INSERT INTO history (user_id, wpm, acc, mode, missed, ts) VALUES (?,?,?,?,?,?)', args: [u.id, wpm, acc, clean(body.mode, 40), JSON.stringify(missed), now()] },
  ];
  const li = body.langInfo || {};
  if (li.textLang) stmts.push({ sql: "INSERT OR IGNORE INTO user_langs (user_id, kind, lang) VALUES (?, 'text', ?)", args: [u.id, clean(li.textLang, 12)] });
  if (li.codeLang) stmts.push({ sql: "INSERT OR IGNORE INTO user_langs (user_id, kind, lang) VALUES (?, 'code', ?)", args: [u.id, clean(li.codeLang, 12)] });
  (Array.isArray(body.achievements) ? body.achievements : []).slice(0, 20).filter((a) => ACHV_ID.test(a)).forEach((a) =>
    stmts.push({ sql: 'INSERT OR IGNORE INTO achievements (user_id, id, ts) VALUES (?,?,?)', args: [u.id, a, now()] }));
  await db().batch(stmts, 'write');
  return json({ profile: await profileOf(await q1('SELECT * FROM users WHERE id = ?', [u.id])) });
});

route('GET', '/history', async (req) => {
  const u = await requireUser(req);
  const limitN = num(new URL(req.url).searchParams.get('limit') || 50, 1, 200);
  const rows = await q('SELECT wpm, acc, mode, missed, ts FROM history WHERE user_id = ? ORDER BY ts DESC LIMIT ?', [u.id, limitN]);
  return json({ history: rows.reverse().map((r) => ({ wpm: Number(r.wpm), acc: Number(r.acc), mode: r.mode, missed: JSON.parse(r.missed || '{}'), ts: Number(r.ts) })) });
});

route('GET', '/leaderboard', async () => {
  const rows = await q('SELECT name, mode, wpm, acc FROM scores ORDER BY wpm DESC, ts ASC LIMIT 100');
  return json({ scores: rows.map((r) => ({ name: r.name, mode: r.mode, wpm: Number(r.wpm), acc: Number(r.acc) })) });
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
  limit('room:' + u.id, 20, 3600e3);
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

/* ---------- ad slot + admin ---------- */
route('GET', '/settings/ad', async () => {
  const r = await q1("SELECT value FROM settings WHERE key = 'ad'");
  return json({ ad: r ? JSON.parse(r.value) : null });
});

route('POST', '/admin/login', async (req, ctx, body, ip) => {
  limit('admin:' + ip, 10, 600e3);
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new HttpError(500, 'admin not configured');
  if (!safeEq(clean(body.email, 120).toLowerCase(), ADMIN_EMAIL.toLowerCase()) | !safeEq(String(body.password || ''), ADMIN_PASSWORD)) throw new HttpError(401, 'wrong credentials');
  return json({ token: sign({ admin: true }, 1) });
});

route('GET', '/admin/users', async (req) => {
  requireAdmin(req);
  const rows = await q("SELECT name, email, created_at, last_login_at, tests_count, best_wpm FROM users WHERE kind = 'user' ORDER BY COALESCE(last_login_at, 0) DESC LIMIT 1000");
  return json({ users: rows.map((r) => ({ name: r.name, email: r.email, createdAt: Number(r.created_at), lastLoginAt: r.last_login_at ? Number(r.last_login_at) : null, testsCount: Number(r.tests_count), bestWpm: Number(r.best_wpm) })) });
});

route('PUT', '/admin/ad', async (req, ctx, body) => {
  requireAdmin(req);
  const ad = { enabled: !!body.enabled, videoUrl: clean(body.videoUrl, 500), imageUrl: clean(body.imageUrl, 500), linkUrl: clean(body.linkUrl, 500), text: clean(body.text, 200) };
  await q("INSERT INTO settings (key, value) VALUES ('ad', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(ad)]);
  return json({ ok: true });
});

/* ad media: stored in Netlify Blobs, served from /api/media/<key>. Netlify limits request bodies to ~6 MB. */
const MEDIA_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm' };
route('POST', '/admin/upload', async (req) => {
  requireAdmin(req);
  const type = (req.headers.get('content-type') || '').split(';')[0];
  if (!MEDIA_TYPES[type]) throw new HttpError(415, 'unsupported file type');
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 5.5 * 1024 * 1024) throw new HttpError(413, 'file too large (max ~5 MB)');
  const key = now() + '_' + uid().slice(0, 6) + MEDIA_TYPES[type];
  await getStore('ads').set(key, buf, { metadata: { type } });
  return json({ url: '/api/media/' + key });
});

route('GET', '/media/:key', async (req, ctx) => {
  const got = await getStore('ads').getWithMetadata(ctx.key, { type: 'arrayBuffer' });
  if (!got) throw new HttpError(404, 'not found');
  return new Response(got.data, { headers: { 'content-type': got.metadata?.type || 'application/octet-stream', 'cache-control': 'public, max-age=86400' } });
});

/* ---------- AI coach (server-side Anthropic call) ---------- */
route('POST', '/coach', async (req, ctx, body) => {
  const u = await requireUser(req);
  limit('coach:' + u.id, 20, 3600e3);
  const prompt = String(body.prompt || '').slice(0, 2000);
  if (!prompt || !process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'coach unavailable');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 220, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new HttpError(502, 'coach upstream error');
  const data = await r.json();
  return json({ text: data.content?.[0]?.text?.trim() || null });
});

/* ---------- entry ---------- */
export default async (req, context) => {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
    const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      let body = {};
      if (req.method !== 'GET' && !(req.headers.get('content-type') || '').match(/^(image|video)\//)) {
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
