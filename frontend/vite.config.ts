import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In local dev, /api is proxied to Django so the frontend can use relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_PROXY ?? "http://localhost:8020",
    },
  },
  build: {
    // MapLibre is most of the bundle; its own chunk stays cached across app releases.
    rollupOptions: { output: { manualChunks: { maplibre: ["maplibre-gl"] } } },
    chunkSizeWarningLimit: 1100,
  },
});
