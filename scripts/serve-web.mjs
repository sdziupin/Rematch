#!/usr/bin/env node
// Serves the exported web build (`npm run build:web`) as a single-page app.
// It also sends the cross-origin isolation headers the expo-sqlite web docs
// recommend. Only expo-sqlite's sync API needs them; REMATCH uses the async API,
// so any static host with an index.html fallback works too.
//
//   node scripts/serve-web.mjs [dir=dist] [--port 8080]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.PORT ?? 8080);
const root = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port') ?? 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No index.html in ${root}. Run "npm run build:web" first.`);
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const requested = normalize(join(root, decodeURIComponent(url.pathname)));
  // Never serve anything outside the build directory.
  const inside = requested === root || requested.startsWith(root + sep);
  let file = inside && existsSync(requested) && statSync(requested).isFile() ? requested : null;
  // Single-page app: unknown routes fall back to index.html.
  if (!file) file = join(root, 'index.html');

  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', file.includes(`${sep}_expo${sep}`) || file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`REMATCH web build: http://localhost:${port}  (serving ${root})`);
});
