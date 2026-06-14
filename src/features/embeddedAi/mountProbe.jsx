import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EmbeddedAiProbePanel from "./EmbeddedAiProbePanel.jsx";

/* ============================================================
 * mountProbe — lazy entry for the hidden device-probe route
 * ------------------------------------------------------------
 * Loaded ONLY by src/main.js when the URL explicitly requests the probe
 * (see embeddedAiProbeRoute.js). Because main.js imports this with a dynamic
 * import(), React + the panel land in a separate lazy chunk and never touch
 * normal startup. Idempotent; never throws to the caller's .then().
 * ============================================================ */

export function mountEmbeddedAiProbe(opts = {}) {
  if (typeof document === "undefined") return null;
  const host =
    document.getElementById(opts.id || "root") ||
    (() => {
      const el = document.createElement("div");
      el.id = "root";
      document.body.appendChild(el);
      return el;
    })();
  // Diagnostic page owns the mount node; clear anything already there.
  try {
    while (host.firstChild) host.removeChild(host.firstChild);
  } catch {
    /* ignore */
  }
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <EmbeddedAiProbePanel />
    </StrictMode>,
  );
  return root;
}
