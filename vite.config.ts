import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  base: process.env.BASE_PATH ?? "/",
  server: { port: 5173, open: false },
  build: { outDir: "dist", sourcemap: true, target: "es2022" },
  resolve: { alias: { "@": "/src" } },
  optimizeDeps: { include: ["gsap"] },
});
