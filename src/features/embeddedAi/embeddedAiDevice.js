/* ============================================================
 * embeddedAiDevice — capability probe for on-device AI
 * ------------------------------------------------------------
 * Every check is wrapped so a missing browser API, a throwing getter, or a
 * non-browser (test) environment never breaks the app — no white screen, no
 * thrown error. Returns plain booleans / a summary object; callers decide.
 * ============================================================ */

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/* WebGPU is the fast path for several in-browser LLM engines. */
export function hasWebGPU() {
  return safe(() => typeof navigator !== "undefined" && !!navigator.gpu, false);
}

/* A place to cache model bytes / engine state. */
export function hasIndexedDB() {
  return safe(() => typeof indexedDB !== "undefined" && !!indexedDB, false);
}

/* True only when we are confident the device is offline. */
export function isOffline() {
  return safe(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
    false,
  );
}

/* navigator.deviceMemory is in GiB (Chromium). Treat <= 4 GiB as low. */
export function isLikelyLowMemory() {
  return safe(() => {
    const mem = typeof navigator !== "undefined" ? navigator.deviceMemory : undefined;
    return typeof mem === "number" && mem > 0 && mem <= 4;
  }, false);
}

/* Best-effort mobile detection (UA-CH first, UA string fallback). */
export function isLikelyMobile() {
  return safe(() => {
    if (typeof navigator === "undefined") return false;
    const uaData = navigator.userAgentData;
    if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
    const ua = String(navigator.userAgent || "");
    return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
  }, false);
}

/* One call that returns the whole picture. Never throws.
 *
 * `usable` is a conservative floor: we only require a cache surface
 * (IndexedDB) here, not WebGPU, because a future wasm-based engine may not
 * need WebGPU. The actual engine refines this when it is plugged in. */
export function describeDevice() {
  const webgpu = hasWebGPU();
  const indexeddb = hasIndexedDB();
  const offline = isOffline();
  const lowMemory = isLikelyLowMemory();
  const mobile = isLikelyMobile();
  const usable = indexeddb;
  return { webgpu, indexeddb, offline, lowMemory, mobile, usable };
}
