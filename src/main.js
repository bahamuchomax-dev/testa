/* ============================================================
 * Oriex - application entry point
 * ------------------------------------------------------------
 * IMPORT ORDER MATTERS. The legacy app bundle expects several globals to
 * already exist on `window`, so we install them first, then run the bundle
 * (which self-mounts into <div id="root">).
 *
 * This entry intentionally stays plain `.js` and contains no JSX. If GitHub
 * Pages is accidentally configured to serve the repository root instead of
 * the built `dist/` artifact, browsers can still load this file as a module
 * and start the legacy app.
 * ============================================================ */

const VITE_ENV = import.meta.env || {};
const APP_BASE_URL = VITE_ENV.BASE_URL || "./";

function staticSourceAssetBaseUrl() {
  if (typeof document !== "undefined") {
    const entry = document.querySelector('script[type="module"][src$="/src/main.js"], script[type="module"][src$="./src/main.js"]');
    if (entry && entry.src) return new URL("../public/", entry.src).href;
  }
  if (typeof window !== "undefined" && window.location) {
    return new URL("./public/", window.location.href).href;
  }
  return "./public/";
}

// Styles are linked from index.html. Do not import CSS here: repository-root
// GitHub Pages serves source files without Vite transforms, and raw CSS module
// imports would stop startup before the legacy app mounts.

// Globals the app relies on (now editable modules).
import "./features/hamster/oriexHamu3D.js"; // -> window.OriexHamu3D
import "./services/oxHelpers.js"; // -> window.__oxBg / __oxPbg / __oxAv / __oxStudy

// Hidden diagnostic route. The embedded-AI device probe is NOT part of the
// normal app: it opens ONLY when the URL explicitly asks for it
// (?oriexProbe=embedded-ai or #embedded-ai-probe). This import is the tiny URL
// matcher only — it pulls in no React, no panel, and no AI code, so normal
// startup and the initial bundle are unaffected.
import { isEmbeddedAiProbeUrl } from "./features/embeddedAi/embeddedAiProbeRoute.js";
import { isEmbeddedAiPocUrl } from "./features/embeddedAi/embeddedAiPocRoute.js";

// The application. Currently the original production build. Screens are being
// peeled out of here into src/features/*. The legacy bundle self-mounts the
// React app into <div id="root"> when loaded; the globals above are installed
// first (static imports), so load order is preserved.
function startLegacyApp() {
  return import("./legacy/oriex-app.bundle.js").catch((err) =>
    console.warn("[oriex] legacy app failed to load", err),
  );
}

const oriexLocation = typeof window !== "undefined" ? window.location : null;

if (oriexLocation && isEmbeddedAiPocUrl(oriexLocation)) {
  // Hidden WebGPU PoC route (phase 3A). Separate lazy chunk; never on a normal
  // visit. Falls back to the normal app on failure (no white screen).
  import("./features/embeddedAi/mountPoc.jsx")
    .then((mod) => {
      if (typeof mod.mountEmbeddedAiPoc === "function") mod.mountEmbeddedAiPoc();
      else startLegacyApp();
    })
    .catch((err) => {
      console.warn("[oriex] embedded AI PoC failed to load", err);
      startLegacyApp();
    });
} else if (oriexLocation && isEmbeddedAiProbeUrl(oriexLocation)) {
  // Diagnostic-only route: mount the device probe instead of the normal app.
  // The probe panel + React are a separate lazy chunk, so they never load on a
  // normal visit. On any failure, fall back to the normal app (no white screen).
  import("./features/embeddedAi/mountProbe.jsx")
    .then((mod) => {
      if (typeof mod.mountEmbeddedAiProbe === "function") mod.mountEmbeddedAiProbe();
      else startLegacyApp();
    })
    .catch((err) => {
      console.warn("[oriex] embedded AI probe failed to load", err);
      startLegacyApp();
    });
} else {
  startLegacyApp();
}

// Local AI (Ollama only) UI is temporarily paused. Keep the implementation in
// src/features/localAi, but do not load its chunk or show the floating launcher
// unless this flag is intentionally re-enabled.
import { LOCAL_AI_UI_ENABLED } from "./features/localAi/uiFlag.js";
if (LOCAL_AI_UI_ENABLED) {
  import("./features/localAi/index.jsx")
    .then((mod) => {
      const mount = mod.mountLocalAiSidecar;
      if (typeof mount === "function") mount();
    })
    .catch((err) => console.warn("[oriex] local AI sidecar failed to mount", err));
}

// PWA service worker. Registered exactly once, production only, after the
// window load event, and never allowed to break the app. In repository-root
// static fallback mode `import.meta.env` is absent, so registration is skipped.
if ("serviceWorker" in navigator && VITE_ENV.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${APP_BASE_URL}sw.js`)
      .then(() => console.info("[oriex] service worker registered"))
      .catch((err) => console.warn("[oriex] service worker registration failed", err));
  });
}

// three.js OFF the critical path. The live hamster screen is still rendered by
// the frozen legacy bundle, which calls window.OriexHamu3D() synchronously when
// opened. Warm window.THREE in the background after first paint. Under Vite
// build, BASE_URL points at dist root; under repository-root static fallback,
// three.min.js lives under public/.
import { loadThree } from "./services/loadThree.js";
const preloadThree = () => {
  loadThree({ baseUrl: VITE_ENV.BASE_URL || staticSourceAssetBaseUrl() }).catch(() => {
    /* preload failure is non-fatal; on-demand loaders retry later */
  });
};
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(preloadThree);
} else if (typeof window !== "undefined") {
  window.addEventListener("load", preloadThree);
}
