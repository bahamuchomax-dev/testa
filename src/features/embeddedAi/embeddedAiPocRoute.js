/* ============================================================
 * embeddedAiPocRoute — hidden URL gate for the WebGPU PoC (phase 3A)
 * ------------------------------------------------------------
 * The PoC is a developer experiment only. It is NOT in the normal UI and is
 * NOT a tab. It opens ONLY when the URL explicitly asks for it, via either:
 *
 *   ?oriexProbe=embedded-ai-poc   (query)
 *   #embedded-ai-poc              (hash)
 *
 * Tiny pure matcher: pulls in no React, no panel, and no engine code, so
 * importing it does not add the PoC to the initial bundle. Never throws.
 * ============================================================ */

const QUERY_KEY = "oriexProbe";
const QUERY_VALUE = "embedded-ai-poc";
const HASH_VALUE = "embedded-ai-poc";

export function isEmbeddedAiPocUrl(location) {
  try {
    if (!location) return false;

    const search = String(location.search || "");
    let byQuery = false;
    try {
      byQuery = new URLSearchParams(search).get(QUERY_KEY) === QUERY_VALUE;
    } catch {
      byQuery = new RegExp("[?&]" + QUERY_KEY + "=" + QUERY_VALUE + "(?:&|$)").test(search);
    }

    const hash = String(location.hash || "").replace(/^#/, "");
    const byHash = hash === HASH_VALUE;

    return byQuery || byHash;
  } catch {
    return false;
  }
}
