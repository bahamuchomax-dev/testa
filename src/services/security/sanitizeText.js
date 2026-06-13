/* ============================================================
 * sanitizeText — XSS / HTML 注入対策ユーティリティ
 * ------------------------------------------------------------
 * 方針（security: XSS hardening）:
 *   - React は {text} で自動エスケープするため、表示は基本これで安全。
 *     本モジュールは「保存前の無害化」「HTML として出す場合の無害化」
 *     「URL の検証」「危険検知」を担う多層防御。
 *   - 普通の日本語・英数字・改行（\n）・タブは壊さない。
 *   - 外部送信・eval・new Function は一切使わない（純粋関数）。
 *
 * 関数:
 *   escapeHtml(input)          : & < > " ' をエンティティ化
 *   stripDangerousHtml(input)  : 危険タグ/属性/スキームを除去（他のHTMLは残す）
 *   sanitizePlainText(input,o) : プレーンテキスト化（タグ除去・危険スキーム除去）
 *   sanitizeUrl(input)         : 安全スキームのみ許可（javascript:/data: 等を拒否）
 *   hasLikelyXss(input)        : 危険そうなパターンの有無を判定
 * ============================================================ */

// Intentionally matches control characters to strip them from saved text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/* 危険要素（中身ごと消す）: script / style。 */
const BLOCK_ELEMENTS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
/* 危険な単独タグ（開始/終了/自己終了）: iframe/object/embed/link/meta/base/script/style。 */
const DANGEROUS_TAGS = /<\/?\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*>/gi;
/* on* イベントハンドラ属性。 */
const ON_ATTRS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
/* style 属性。 */
const STYLE_ATTR = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
/* srcdoc 属性。 */
const SRCDOC_ATTR = /\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
/* 危険スキーム。 */
const DANGEROUS_SCHEMES = /(javascript|vbscript)\s*:|data\s*:\s*text\/html/gi;
/* 実HTMLタグらしき並び（< の直後が英字 or / + 英字、かつ > で閉じる）。 */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;

function toStr(input) {
  if (input == null) return "";
  return typeof input === "string" ? input : String(input);
}

/* & < > " ' をエスケープ。&amp; を二重エスケープしないため & を最初に。 */
export function escapeHtml(input) {
  return toStr(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* HTML として扱う必要がある場合の無害化。危険な要素/属性/スキームのみ除去し、
 * それ以外の文字（日本語/英数/改行）は保持する。 */
export function stripDangerousHtml(input) {
  let s = toStr(input);
  s = s.replace(BLOCK_ELEMENTS, ""); // <script>…</script>, <style>…</style>
  s = s.replace(DANGEROUS_TAGS, ""); // iframe/object/embed/link/meta/base 等のタグ
  s = s.replace(ON_ATTRS, ""); // onerror= / onclick= …
  s = s.replace(STYLE_ATTR, ""); // style=
  s = s.replace(SRCDOC_ATTR, ""); // srcdoc=
  s = s.replace(DANGEROUS_SCHEMES, ""); // javascript: / vbscript: / data:text/html
  return s;
}

/* プレーンテキストとして安全化。実HTMLタグ・危険スキーム・制御文字を除去し、
 * 通常文字（日本語/英数）・改行(\n)・タブ(\t)は保持。"a<b"（> 無し）は壊さない。 */
export function sanitizePlainText(input, options = {}) {
  let s = toStr(input);
  // <script>…</script> 等は中身ごと先に除去（残った "alert(1)" 等の混入を減らす）。
  s = s.replace(BLOCK_ELEMENTS, "");
  s = s.replace(HTML_TAG, ""); // 実タグらしき並びを除去（"3<5" は > が無いので残る）
  s = s.replace(DANGEROUS_SCHEMES, ""); // 危険スキーム文字列を除去
  s = s.replace(CONTROL_CHARS, ""); // 制御文字（\n \t は対象外）
  if (options && Number.isFinite(options.maxLength) && options.maxLength >= 0) {
    s = s.slice(0, options.maxLength);
  }
  if (options && options.trim) s = s.trim();
  return s;
}

/* 安全な URL だけ許可。スキーム付きは http/https/mailto/tel/blob のみ許可、
 * 相対/フラグメントは許可、javascript:/vbscript:/data: 等は "" を返す。 */
export function sanitizeUrl(input) {
  const raw = toStr(input).trim();
  if (!raw) return "";
  // スキーム判定はホワイトスペース/制御文字で難読化されても拾えるよう正規化。
  const compact = raw.replace(CONTROL_CHARS, "").replace(/\s+/g, "");
  const m = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (m) {
    const scheme = m[1].toLowerCase();
    const allowed = ["http", "https", "mailto", "tel", "blob"];
    if (!allowed.includes(scheme)) return ""; // javascript:/data:/vbscript:/file: 等を拒否
  }
  return raw; // 相対 URL・フラグメント・許可スキームはそのまま
}

/* 危険そうな XSS パターンが含まれるか（保存拒否や警告の判断用）。 */
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
