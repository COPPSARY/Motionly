#!/usr/bin/env node
// Motionly launcher: `npx motionly` serves the built editor locally.
// Zero dependencies — uses only Node's standard library.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = normalize(join(here, '..'));
const dist = join(root, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json; charset=utf-8',
};

function parsePort(argv) {
  const flag = argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (flag >= 0 && argv[flag + 1]) return Number(argv[flag + 1]);
  const env = Number(process.env.PORT);
  return Number.isFinite(env) && env > 0 ? env : 4173;
}

async function ensureBuilt() {
  try {
    await stat(join(dist, 'index.html'));
    return true;
  } catch {
    console.error(
      '\nMotionly is not built yet.\n' +
        'Run "npm run build" in the project, or use the published package which ships the build.\n'
    );
    return false;
  }
}

function openBrowser(url) {
  const platform = process.platform;
  const command =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}

async function main() {
  if (!(await ensureBuilt())) process.exit(1);
  const port = parsePort(process.argv.slice(2));
  const noOpen = process.argv.includes('--no-open');

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      // Resolve within dist and block path traversal.
      const filePath = normalize(join(dist, pathname));
      if (!filePath.startsWith(dist)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let body;
      let resolved = filePath;
      try {
        body = await readFile(resolved);
      } catch {
        // SPA fallback: serve index.html for unknown routes.
        resolved = join(dist, 'index.html');
        body = await readFile(resolved);
      }
      response.writeHead(200, { 'Content-Type': MIME[extname(resolved)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(500).end('Internal Server Error');
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  Motionly is running at ${url}\n  Press Ctrl+C to stop.\n`);
    if (!noOpen) openBrowser(url);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is in use. Try: npx motionly --port ${port + 1}`);
      process.exit(1);
    }
    throw error;
  });
}

main();
