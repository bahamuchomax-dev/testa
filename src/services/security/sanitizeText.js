/* ============================================================
 * sanitizeText - small XSS / URL hardening helpers.
 * ------------------------------------------------------------
 * React escapes normal text rendering for us. These helpers are used before
 * saving user-controlled text or when a URL value needs a narrow allow-list.
 * Keep this file dependency-free so it can be reused in repositories/tests.
 * ============================================================ */

// Intentionally matches control characters to strip them from saved text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const BLOCK_ELEMENTS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_TAGS = /<\/?\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*>/gi;
const ON_ATTRS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_ATTR = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const SRCDOC_ATTR = /\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_SCHEMES = /(javascript|vbscript)\s*:|data\s*:\s*text\/html/gi;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;

function toStr(input) {
  if (input == null) return "";
  return typeof input === "string" ? input : String(input);
}

export function escapeHtml(input) {
  return toStr(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stripDangerousHtml(input) {
  let s = toStr(input);
  s = s.replace(BLOCK_ELEMENTS, "");
  s = s.replace(DANGEROUS_TAGS, "");
  s = s.replace(ON_ATTRS, "");
  s = s.replace(STYLE_ATTR, "");
  s = s.replace(SRCDOC_ATTR, "");
  s = s.replace(DANGEROUS_SCHEMES, "");
  return s;
}

export function sanitizePlainText(input, options = {}) {
  let s = toStr(input);
  s = s.replace(BLOCK_ELEMENTS, "");
  s = s.replace(HTML_TAG, "");
  s = s.replace(DANGEROUS_SCHEMES, "");
  s = s.replace(CONTROL_CHARS, "");
  if (options && Number.isFinite(options.maxLength) && options.maxLength >= 0) {
    s = s.slice(0, options.maxLength);
  }
  if (options && options.trim) s = s.trim();
  return s;
}

export function sanitizeUrl(input) {
  const raw = toStr(input).trim();
  if (!raw) return "";
  const compact = raw.replace(CONTROL_CHARS, "").replace(/\s+/g, "");

  // Do not allow protocol-relative or UNC-style URLs to escape the origin
  // while looking like a relative path.
  if (/^\/\//.test(compact) || /^\\\\/.test(compact)) return "";

  const m = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (m) {
    const scheme = m[1].toLowerCase();
    const allowed = ["http", "https", "mailto", "tel", "blob"];
    if (!allowed.includes(scheme)) return "";

    // Blob URLs can wrap another origin. Keep only same-origin blob URLs.
    if (scheme === "blob") {
      let parsed;
      try {
        parsed = new URL(compact);
      } catch {
        return "";
      }
      const currentOrigin =
        typeof globalThis !== "undefined" && globalThis.location && globalThis.location.origin
          ? String(globalThis.location.origin)
          : "";
      if (!currentOrigin || parsed.origin === "null" || parsed.origin !== currentOrigin) return "";
    }
  }

  return raw;
}

export function hasLikelyXss(input) {
  const s = toStr(input);
  if (!s) return false;
  return (
    /<\s*(script|iframe|object|embed|link|meta|base|style)\b/i.test(s) ||
    /\son[a-z]+\s*=/i.test(s) ||
    /\sstyle\s*=/i.test(s) ||
    /\ssrcdoc\s*=/i.test(s) ||
    /(javascript|vbscript)\s*:/i.test(s) ||
    /data\s*:\s*text\/html/i.test(s)
  );
}
