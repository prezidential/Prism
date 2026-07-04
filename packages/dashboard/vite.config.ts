import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative base so the built app works from any static path (e.g. vite preview).
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
