import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const BACKEND_URL = "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Fixed port: the backend's default CORS allowlist is http://localhost:5173.
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": BACKEND_URL,
      "/static": BACKEND_URL,
    },
  },
  build: {
    // The 3D viewer (three.js) is one lazy chunk of about 0.9 MB, loaded after the page is usable.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
