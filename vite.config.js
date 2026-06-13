import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps asset URLs relative so the build also works when
// served from a GitHub Pages project subpath (matches manifest/sw "./").
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2019",
    // The legacy app bundle is intentionally large until screens are
    // migrated out of it; silence the size warning for now.
    chunkSizeWarningLimit: 4096,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    // Rules Emulator tests are run separately via `npm run test:rules`
    // (they need the Firebase emulator); keep them out of the normal run.
    exclude: [...configDefaults.exclude, "**/*.emulator.test.js"],
  },
});
