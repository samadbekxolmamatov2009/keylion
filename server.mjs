/* Tezlash as a plain Node.js web server: the static site from keylion/ plus the API at /api/*.
   Used on hosts without Netlify (Render — see render.yaml — or any VPS), and locally: `npm start`.
   The API itself is the same code Netlify runs (netlify/functions/api.mjs). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import handler from './netlify/functions/api.mjs';

const PORT = Number(process.env.PORT) || 8888;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'keylion');
const MAX_BODY = 8 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt']);
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'expect', 'proxy-connection', 'te', 'trailer']);

/* behind Render's proxy the socket address is the proxy's; the edge puts the visitor's ip in these headers */
function clientIp(req) {
  const h = req.headers;
  return h['cf-connecting-ip'] || h['true-client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

async function handleApi(req, res) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) { res.writeHead(413, { 'content-type': 'application/json' }); res.end('{"error":"file too large"}'); return; }
    chunks.push(c);
  }
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
  const hasBody = !['GET', 'HEAD'].includes(req.method) && chunks.length;
  const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
  const response = await handler(request, { ip: clientIp(req) });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function serveStatic(req, res) {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { rel = '/'; }
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  /* pretty URLs like Netlify: /admin -> admin.html */
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>404</title><p style="font-family:sans-serif">Sahifa topilmadi. <a href="/">Tezlash</a></p>');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'content-type': TYPES[ext] || 'application/octet-stream',
      /* file names aren't content-hashed, so code and pages are revalidated; backgrounds/images can be cached */
      'cache-control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400',
      'last-modified': st.mtime.toUTCString(),
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    };
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) {
      res.writeHead(304, headers); res.end(); return;
    }
    const stream = fs.createReadStream(file);
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      headers['content-encoding'] = 'gzip';
      headers.vary = 'accept-encoding';
      res.writeHead(200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      stream.pipe(zlib.createGzip()).pipe(res);
    } else {
      headers['content-length'] = st.size;
      res.writeHead(200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      stream.pipe(res);
    }
  });
}

http.createServer(async (req, res) => {
  try {
    if (req.url === '/api' || req.url.startsWith('/api/')) await handleApi(req, res);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res);
    else { res.writeHead(405); res.end(); }
  } catch (err) {
    console.error('server error', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":"server error"}');
  }
}).listen(PORT, () => console.log('Tezlash listening on port ' + PORT));
