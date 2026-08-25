/**
 * Serve `out/` the way GitHub Pages serves it.
 *
 * The tests used to run against `next start`, which is a Node server. The site
 * is now exported to static files and published by GitHub Pages, and `next
 * start` refuses to run under `output: 'export'` at all. Pointing the suite at
 * some other static server would be worse than that: the specs assert a 404
 * status on an unknown path, and most static servers answer such a path with a
 * directory listing, a 200, or an empty body. The gate would then be describing
 * a host nobody uses.
 *
 * So the resolution rules here are deliberately Pages' rules and not a general
 * server's:
 *
 * - a directory resolves to its `index.html`;
 * - `/thing` resolves to `thing.html` when that exists, which is how Pages
 *   serves an exported route;
 * - anything unresolved gets `404.html` with a real 404 status, which is the
 *   behaviour the not-found spec depends on;
 * - no header is added beyond a content type, because Pages adds none. That is
 *   the whole reason the security policy had to move into the document.
 *
 * Usage:
 *   tsx scripts/serve-export.ts [port]
 */

import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const OUT_DIR = resolve(import.meta.dirname, '..', 'out');

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();

/** Pages' resolution order, in one place so the tests and the host agree. */
const resolveRequest = (pathname: string): string | null => {
  // `normalize` collapses `..`, and the prefix check refuses anything that
  // still escapes the export. A published host would never serve it either.
  const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(OUT_DIR, relative);
  if (!target.startsWith(OUT_DIR)) return null;

  if (isFile(target)) return target;
  if (isFile(`${target}.html`)) return `${target}.html`;

  const index = join(target, 'index.html');
  return isFile(index) ? index : null;
};

export const startExportServer = (port: number): Promise<Server> => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const file = resolveRequest(pathname);

    if (file === null) {
      const notFound = join(OUT_DIR, '404.html');
      const body = isFile(notFound) ? readFileSync(notFound) : Buffer.from('Not Found');
      response.writeHead(404, { 'content-type': CONTENT_TYPES['.html']! });
      response.end(body);
      return;
    }

    const type = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': type });
    response.end(readFileSync(file));
  });

  return new Promise((resolveStarted, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolveStarted(server));
  });
};

const invokedDirectly = process.argv[1]?.endsWith('serve-export.ts') === true;

if (invokedDirectly) {
  if (!existsSync(OUT_DIR)) {
    console.error('No out/ directory. Run `pnpm build` first.');
    process.exit(1);
  }
  const port = Number(process.argv[2] ?? '4311');
  await startExportServer(port);
  console.log(`Serving out/ as GitHub Pages would on http://127.0.0.1:${port}`);
}
