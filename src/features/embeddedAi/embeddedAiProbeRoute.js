/* ============================================================
 * embeddedAiProbeRoute — hidden URL gate for the device probe
 * ------------------------------------------------------------
 * The embedded-AI device probe is a developer diagnostic only. It is NOT in
 * the normal UI and is NOT a tab. It opens ONLY when the URL explicitly asks
 * for it, via either:
 *
 *   ?oriexProbe=embedded-ai      (query)
 *   #embedded-ai-probe           (hash)
 *
 * This module is a tiny pure matcher: it pulls in no React, no panel, and no
 * AI code, so importing it does not add the probe to the initial bundle.
 * It never throws.
 * ============================================================ */

const QUERY_KEY = "oriexProbe";
const QUERY_VALUE = "embedded-ai";
const HASH_VALUE = "embedded-ai-probe";

export function isEmbeddedAiProbeUrl(location) {
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
