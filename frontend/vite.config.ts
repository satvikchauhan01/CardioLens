import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The address uvicorn listens on by default. Not "localhost": on some systems that name resolves
// to the IPv6 address first, where the backend is not listening.
const BACKEND_URL = "http://127.0.0.1:8000";

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
    // The 3D viewer (three.js, the model loader and its decoder) is one lazy chunk of about 1 MB
    // (280 kB gzipped), loaded after the page is usable.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
