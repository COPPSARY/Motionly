import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cp, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { createFfmpegExportMiddleware } from './bin/ffmpeg-export.js';

const motionProjectPath = resolve('video-motion/motionly.motion');

const motionProject = {
  name: 'motion-project',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/motion-project', async (request, response, next) => {
      try {
        if (request.method === 'GET') {
          // Return 404 to use fallback motion instead of loading saved project
          response.statusCode = 404;
          response.end();
          return;
        }
        if (request.method === 'PUT') {
          let source = '';
          for await (const chunk of request) {
            source += chunk;
            if (source.length > 5_000_000) {
              response.statusCode = 413;
              response.end();
              return;
            }
          }
          if (!source.includes('canvas {')) {
            response.statusCode = 400;
            response.end('Invalid .motion project');
            return;
          }
          await writeFile(motionProjectPath, source, 'utf8');
          response.statusCode = 204;
          response.end();
          return;
        }
        next();
      } catch (error) {
        next(error as Error);
      }
    });
  },
};

const ffmpegExport = {
  name: 'ffmpeg-export',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(createFfmpegExportMiddleware());
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(createFfmpegExportMiddleware());
  },
};

const presetRoot = resolve('preset');

const PRESET_CONTENT_TYPES: Record<string, string> = {
  '.motion': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.json': 'application/json',
  '.lottie': 'application/zip',
  '.woff2': 'font/woff2',
};

/**
 * Serve `/preset/*` straight from the package `preset/` directory.
 *
 * The editor loads presets over HTTP, and `public/` is the only directory Vite
 * serves statically — which previously meant keeping a hand-made second copy of
 * every preset under `public/preset/`. Two copies drift: an edit to the packaged
 * preset was invisible in the editor. This makes `preset/` the single source of
 * truth for dev, preview, and the built bundle.
 */
const presetAssets = {
  name: 'preset-assets',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/preset', servePreset);
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/preset', servePreset);
  },
  async writeBundle() {
    await cp(presetRoot, resolve('dist/preset'), { recursive: true });
  },
};

async function servePreset(
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
  next: (error?: Error) => void
): Promise<void> {
  try {
    const requested = decodeURIComponent((request.url ?? '/').split(/[?#]/, 1)[0] ?? '/');
    const target = resolve(presetRoot, `.${requested}`);
    // Contain the served path inside preset/ so a traversal cannot escape it.
    if (target !== presetRoot && !target.startsWith(`${presetRoot}${sep}`)) {
      response.statusCode = 403;
      response.end();
      return;
    }
    const file = await stat(target).catch(() => null);
    if (!file?.isFile()) {
      next();
      return;
    }
    response.setHeader(
      'Content-Type',
      PRESET_CONTENT_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream'
    );
    response.setHeader('Content-Length', String(file.size));
    createReadStream(target).pipe(response);
  } catch (error) {
    next(error as Error);
  }
}

export default defineConfig({
  plugins: [svelte(), motionProject, presetAssets, ffmpegExport],
  base: process.env.BASE_PATH ?? '/',
  root: '.',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['gsap', 'motion'],
  },
});
