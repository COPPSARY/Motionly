import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const motionProjectPath = resolve('video-motion/motionly.motion');

const motionProject = {
  name: 'motion-project',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/motion-project', async (request, response, next) => {
      try {
        if (request.method === 'GET') {
          response.setHeader('content-type', 'text/plain;charset=utf-8');
          response.end(await readFile(motionProjectPath, 'utf8'));
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

export default defineConfig({
  plugins: [svelte(), motionProject],
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
