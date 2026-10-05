/* Uploaded media (ad images/videos, custom backgrounds), stored in the database so the API runs on any
   host (Netlify, Render, a VPS). Files are split into 512 KB chunks to stay far below per-request limits.
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

/* -> { data: Uint8Array, type } or null */
export async function getMedia(db, store, key) {
  const head = (await db.execute({ sql: 'SELECT type, size FROM media WHERE store = ? AND key = ?', args: [store, key] })).rows[0];
  if (!head) return legacyGet(store, key);
  const size = Number(head.size), count = Math.ceil(size / CHUNK);
  const parts = await Promise.all(Array.from({ length: count }, (_, idx) =>
    db.execute({ sql: 'SELECT data FROM media_chunks WHERE store = ? AND key = ? AND idx = ?', args: [store, key, idx] }).then((r) => r.rows[0])));
  if (parts.some((p) => !p)) return null;
  const data = new Uint8Array(size);
  let off = 0;
  for (const p of parts) { const b = new Uint8Array(p.data); data.set(b, off); off += b.length; }
  return { data, type: head.type };
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
