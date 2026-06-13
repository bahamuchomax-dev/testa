/* Firebase client — INTENTIONALLY a stub in this stage.
 * ------------------------------------------------------------
 * The repositories currently run on localStorage so the project builds
 * and runs with zero external config. When you are ready to connect
 * Firestore, this is the single place to wire it up:
 *
 *   1. `npm i firebase`
 *   2. fill FIREBASE_CONFIG (or read import.meta.env.VITE_FIREBASE_*)
 *   3. set `firebaseEnabled = true`
 *   4. implement getDb()/getAuth() with dynamic import() so Firebase is
 *      only downloaded when actually used (keeps the main bundle light)
 *   5. gate every repository subscription behind `authReady` — never
 *      read users/{uid}/... before anonymous sign-in resolves, or Rules
 *      will reject the read and the app will flicker on startup.
 *
 * Example shape (commented out until firebase is installed):
 *
 *   let _app, _db, authReady = false;
 *   export async function getDb() {
 *     if (!firebaseEnabled) return null;
 *     if (_db) return _db;
 *     const { initializeApp } = await import("firebase/app");
 *     const { getFirestore } = await import("firebase/firestore");
 *     const { getAuth, signInAnonymously, onAuthStateChanged } = await import("firebase/auth");
 *     _app = initializeApp(FIREBASE_CONFIG);
 *     _db = getFirestore(_app);
 *     await new Promise((res) => {
 *       const auth = getAuth(_app);
 *       onAuthStateChanged(auth, (u) => { if (u) { authReady = true; res(); } });
 *       signInAnonymously(auth).catch(() => {});
 *     });
 *     return _db;
 *   }
 */
export const firebaseEnabled = false;
export const authReady = false;
export async function getDb() { return null; }
export function currentUid() {
  // until Firebase auth is wired, the app keys everything under "local".
  return (typeof window !== "undefined" && window.__oxUid) || "local";
}
