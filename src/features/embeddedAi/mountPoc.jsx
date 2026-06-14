import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EmbeddedAiPocPanel from "./EmbeddedAiPocPanel.jsx";

/* ============================================================
 * mountPoc — lazy entry for the hidden WebGPU PoC route
 * ------------------------------------------------------------
 * Loaded ONLY by src/main.js when the URL explicitly requests the PoC
 * (see embeddedAiPocRoute.js). Dynamic-imported, so React + the panel + the
 * engine adapter land in a separate lazy chunk and never touch normal startup.
 * Idempotent; never throws to the caller's .then().
 * ============================================================ */

export function mountEmbeddedAiPoc(opts = {}) {
  if (typeof document === "undefined") return null;
  const host =
    document.getElementById(opts.id || "root") ||
    (() => {
      const el = document.createElement("div");
      el.id = "root";
      document.body.appendChild(el);
      return el;
    })();
  try {
    while (host.firstChild) host.removeChild(host.firstChild);
  } catch {
    /* ignore */
  }
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <EmbeddedAiPocPanel />
    </StrictMode>,
  );
  return root;
}
