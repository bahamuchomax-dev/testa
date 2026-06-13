import { defineConfig } from "vitest/config";

/* Separate config for the Firestore Rules Emulator tests so they are NOT
 * collected by the normal `npm run test` run (which excludes *.emulator.*).
 * Run via `npm run test:rules` (requires Firebase CLI + emulator). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/firestoreRules.emulator.test.js"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
