import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Admin app runs on :5174. API requests to /api are proxied to FastAPI (:8000)
// so the session cookie stays same-origin in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: false } },
  },
  resolve: { dedupe: ["react", "react-dom", "react-router"] },
  build: { sourcemap: false, target: "es2022" },
});
