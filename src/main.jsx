/* ============================================================
 * Oriex — application entry point
 * ------------------------------------------------------------
 * IMPORT ORDER MATTERS. The legacy app bundle expects several
 * globals to already exist on `window`, so we install them first,
 * then run the bundle (which self-mounts into <div id="root">).
 *
 *   window.THREE         <- loadThree() (services/loadThree.js, lazy)
 *   window.OriexHamu3D   <- oriexHamu3D.js (imported below)
 *   window.__oxBg / __oxPbg / __oxAv / __oxStudy <- oxHelpers.js
 *
 * As screens are migrated into src/features/*, you will start
 * importing real React components here and shrink the legacy
 * bundle. See MIGRATION.md.
 * ============================================================ */

// 1) styles
import "./styles/utilities.css"; // generated Tailwind utilities (rarely edited)
import "./styles/app.css";       // hand-written app styles — EDIT THESE

// 2) globals the app relies on (now editable modules)
import "./features/hamster/oriexHamu3D.js"; // -> window.OriexHamu3D
import "./services/oxHelpers.js";           // -> window.__oxBg / __oxPbg / __oxAv / __oxStudy

// 3) the application. Currently the original production build.
//    Screens are being peeled out of here into src/features/*.
import "./legacy/oriex-app.bundle.js"; // self-mounts the React app into #root

// 4) Local AI (Ollama only). Mounted as a separate root so it overlays the
//    live app as a floating launcher + drawer WITHOUT editing the legacy
//    bundle. In the future React shell (src/App.jsx) it is a normal tab.
import { mountLocalAiSidecar } from "./features/localAi/index.jsx";
mountLocalAiSidecar();

// 5) PWA service worker. Registered exactly once, PRODUCTION only, after the
//    window load event, and never allowed to break the app (failures are only
//    logged). BASE_URL keeps the path correct under the GitHub Pages subpath.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => console.info("[oriex] service worker registered"))
      .catch((err) => console.warn("[oriex] service worker registration failed", err));
  });
}

// 6) three.js OFF the critical path. The render-blocking classic <script> was
//    removed from index.html. The live hamster screen is still rendered by the
//    frozen legacy bundle, which calls window.OriexHamu3D() synchronously when
//    opened and cannot be hooked — so we warm window.THREE in the background
//    AFTER first paint (idle/after-load), never blocking initial render. React
//    screens (HamsterRoom) additionally call loadThree() on demand.
import { loadThree } from "./services/loadThree.js";
const preloadThree = () => {
  loadThree().catch(() => {
    /* preload failure is non-fatal; on-demand loaders retry later */
  });
};
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(preloadThree);
} else if (typeof window !== "undefined") {
  window.addEventListener("load", preloadThree);
}
