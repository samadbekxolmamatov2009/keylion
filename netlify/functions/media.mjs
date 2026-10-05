/* Uploaded media (ad images/videos, custom backgrounds), stored in the database so the API runs on any
   host (Netlify, Render, a VPS). Files are split into 512 KB chunks to stay far below per-request limits,
   and byte ranges read only the chunks they need (Safari streams video with Range requests).
   Files uploaded before this existed live in Netlify Blobs; on Netlify they are still read from there. */
const CHUNK = 512 * 1024;

export async function putMedia(db, store, key, buf, type) {
  const bytes = new Uint8Array(buf);
  await db.execute({ sql: 'DELETE FROM media_chunks WHERE store = ? AND key = ?', args: [store, key] });
  /* one chunk per request; the header row goes in last, so a half-written file is never served */
  for (let i = 0, idx = 0; i < bytes.length; i += CHUNK, idx++) {
    await db.execute({ sql: 'INSERT INTO media_chunks (store, key, idx, data) VALUES (?,?,?,?)', args: [store, key, idx, bytes.slice(i, i + CHUNK)] });
  }
  await db.execute({
    sql: 'INSERT INTO media (store, key, type, size, created_at) VALUES (?,?,?,?,?) ON CONFLICT(store, key) DO UPDATE SET type = excluded.type, size = excluded.size, created_at = excluded.created_at',
    args: [store, key, type, bytes.length, Date.now()],
  });
}

/* -> { type, size, legacy? } or null; `legacy` holds the whole file when it came from Netlify Blobs */
export async function headMedia(db, store, key) {
  const head = (await db.execute({ sql: 'SELECT type, size FROM media WHERE store = ? AND key = ?', args: [store, key] })).rows[0];
  if (head) return { type: head.type, size: Number(head.size) };
  const old = await legacyGet(store, key);
  return old ? { type: old.type, size: old.data.length, legacy: old.data } : null;
}

/* bytes start..end (inclusive) of a file described by headMedia() */
export async function readMedia(db, store, key, head, start = 0, end = head.size - 1) {
  if (head.legacy) return head.legacy.slice(start, end + 1);
  const first = Math.floor(start / CHUNK), last = Math.floor(end / CHUNK);
  const parts = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) =>
    db.execute({ sql: 'SELECT data FROM media_chunks WHERE store = ? AND key = ? AND idx = ?', args: [store, key, first + i] }).then((r) => r.rows[0])));
  if (parts.some((p) => !p)) throw new Error('media chunk missing: ' + store + '/' + key);
  const out = new Uint8Array(end - start + 1);
  let pos = first * CHUNK, off = 0;
  for (const p of parts) {
    const b = new Uint8Array(p.data);
    const from = Math.max(0, start - pos), to = Math.min(b.length, end + 1 - pos);
    if (to > from) { out.set(b.subarray(from, to), off); off += to - from; }
    pos += b.length;
  }
  return out;
}

export async function listMedia(db, store) {
  return (await db.execute({ sql: 'SELECT key, created_at FROM media WHERE store = ?', args: [store] })).rows.map((r) => ({ key: r.key, createdAt: Number(r.created_at) }));
}

export async function deleteMedia(db, store, key) {
  await db.batch([
    { sql: 'DELETE FROM media WHERE store = ? AND key = ?', args: [store, key] },
    { sql: 'DELETE FROM media_chunks WHERE store = ? AND key = ?', args: [store, key] },
  ], 'write');
  try { const { getStore } = await import('@netlify/blobs'); await getStore(store).delete(key); } catch { /* not on Netlify */ }
}

async function legacyGet(store, key) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const got = await getStore(store).getWithMetadata(key, { type: 'arrayBuffer' });
    return got ? { data: new Uint8Array(got.data), type: got.metadata?.type } : null;
  } catch {
    return null;   // not running on Netlify
  }
}
