/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Static, no-backend build. `base: "./"` makes the bundle portable: it can be
// served from any subpath (GitHub Pages, a CDN folder, file://-ish hosting).
export default defineConfig({
  plugins: [react()],
  base: "./",
  test: {
    globals: true,
    environment: "node",
  },
});
