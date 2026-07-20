import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

export default defineConfig({
  plugins: [svelte(), motionProject, ffmpegExport],
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
