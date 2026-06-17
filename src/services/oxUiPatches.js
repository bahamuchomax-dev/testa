/* ============================================================
 * oxUiPatches — durable runtime relabels over the frozen legacy bundle's DOM
 * ------------------------------------------------------------
 * The live app is the frozen, minified legacy bundle — its JSX (e.g. the bottom
 * nav labels) cannot be hand-edited. oxHelpers.js already establishes the
 * codebase pattern for adjusting the bundle's OUTPUT at runtime (MutationObserver
 * + a low-frequency interval that re-applies after React re-renders). This module
 * uses that same mechanism for small, exact-match text relabels.
 *
 * Currently: rename the bottom-nav "マイ" tab to "マイページ" (the bundle renders
 * {id:"myPage",label:"マイ"} — see src/legacy/oriex-app.bundle.js). Pure relabel
 * decisions live in nextLabel() so they are unit-tested without a DOM.
 * ============================================================ */
import { getFrame, frameRing } from "../features/home/iconFrames.js";
import { isTeacher } from "../features/home/realAccount.js";

// Exact whole-label renames, keyed by the EXACT trimmed text the bundle renders.
// Whole-text equality (not substring) so "マイワード" etc. are never touched.
export const RELABELS = { "マイ": "マイページ" };

// Teacher/admin sections to REMOVE from the (frozen-bundle) admin screen. Each is
// an <h3>/<button> heading whose whole text equals one of these; we hide its
// PARENT (the section card that holds the heading + its controls). Exact-text
// match means a container with extra text never matches, so only the intended
// section is hidden. Cosmetic + reversible (display:none, try/caught) — the
// bundle JS is untouched. NOTE: hiding the パスワード一覧 UI stops it being shown,
// but the legacy plaintext password DATA still exists in Firestore — retiring
// that store is a separate follow-up (see auth-password-architecture memory).
export const HIDE_SECTION_HEADINGS = [
  "招待コード管理",
  "パスワード一覧",
  "先生管理",
  "ユーザー管理",
];

/**
 * The replacement for a label's text, or null to leave it unchanged (no mapping,
 * or it already equals the target). Pure + unit-tested.
 * @param {unknown} text
 * @param {Record<string,string>} [map]
 * @returns {string|null}
 */
export function nextLabel(text, map = RELABELS) {
  const t = (text == null ? "" : String(text)).trim();
  if (Object.prototype.hasOwnProperty.call(map, t)) {
    return map[t] === t ? null : map[t];
  }
  return null;
}

// A label is a leaf element holding only text (no child elements) — e.g. the
// nav <span>. Restricting to leaves avoids rewriting a container that merely
// happens to contain the text plus other markup.
function isLeafLabel(el) {
  return !!el && el.childElementCount === 0;
}

/** True iff this exact (trimmed) heading text marks a section to remove. Pure. */
export function isHideHeading(text, headings = HIDE_SECTION_HEADINGS) {
  const t = (text == null ? "" : String(text)).trim();
  return headings.indexOf(t) >= 0;
}

// The hamster "house + wheel" icon is embedded in the frozen bundle as base64
// webp and shown on the home / cards. Swap just those <img> srcs to the new
// public/hamster.png (the run-animation frames use DIFFERENT prefixes, so they
// keep animating). Matched by the exact base64 head of each embedded variant.
export const HAMSTER_SRC_PREFIXES = [
  "data:image/webp;base64,UklGRkIe",
  "data:image/webp;base64,UklGRuQm",
];
const HAMSTER_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : "/") + "hamster.png";

/** True iff this <img> src is one of the embedded hamster-icon images. Pure. */
export function isHamsterIconSrc(src, prefixes = HAMSTER_SRC_PREFIXES) {
  const s = typeof src === "string" ? src : "";
  return prefixes.some((p) => s.indexOf(p) === 0);
}

// Hamburger MENU icon tiles are a 52x52 rounded div with a
// `linear-gradient(145deg, <c1>, <c2>)` FILL and a white glyph. The user wants
// them OUTLINED in that color instead of filled: white tile + colored border +
// colored glyph. We read the gradient's first color and restyle. After restyle
// the background is no longer a gradient, so the element stops matching the
// selector (idempotent); a React re-render restores the gradient and we re-apply.
const MENU_TILE_SELECTOR = 'div[style*="linear-gradient(145deg"]';

/** Extract the first color of a `linear-gradient(145deg, C, K)` string. Pure. */
export function firstGradientColor(bg) {
  const s = typeof bg === "string" ? bg : "";
  // First color may be #hex, rgb()/rgba() (which contain commas) or a name.
  const m = s.match(/linear-gradient\(\s*145deg\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)/i);
  return m ? m[1].trim() : "";
}

// Recolor a glyph node to `color` robustly: the white glyph may be painted via a
// fill attr, a stroke attr, currentColor, or CSS, so don't rely on matching the
// exact white token. Fill: set to color UNLESS it is explicitly "none" (so a
// stroke-only/outline icon is not filled in). Stroke: set to color when present.
function paintNode(el, color) {
  if (!el || !el.getAttribute) return;
  const f = el.getAttribute("fill");
  if (f !== "none") {
    try {
      el.setAttribute("fill", color);
    } catch {
      /* ignore */
    }
  }
  const s = el.getAttribute("stroke");
  if (s && s !== "none") {
    try {
      el.setAttribute("stroke", color);
    } catch {
      /* ignore */
    }
  }
}

/** A light tint (hex8) of a #rrggbb color for the tile fill, else "" (use white). */
export function tintOf(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color + "26" : "";
}

function outlineMenuIconsOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const tiles = document.querySelectorAll(MENU_TILE_SELECTOR);
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile.offsetWidth > 80) continue; // menu tiles are 52px; skip big gradients
      const color = firstGradientColor(tile.style.background || tile.style.backgroundImage || "");
      if (!color) continue;
      // light tint instead of a solid fill, with a clear colored border — so each
      // tile stays distinguishable by color (a plain white tile + faint glyph was
      // unreadable). Glyph recolored to the color so it's visible on the tint.
      tile.style.background = tintOf(color) || "#ffffff";
      tile.style.backgroundImage = "none";
      tile.style.border = "2.5px solid " + color;
      tile.style.boxShadow = "none";
      const svg = tile.querySelector("svg");
      if (svg) {
        svg.style.color = color; // for glyphs that use currentColor
        svg.style.fill = color;
        paintNode(svg, color);
        const kids = svg.querySelectorAll("*");
        for (let k = 0; k < kids.length; k++) paintNode(kids[k], color);
      }
    }
  } catch {
    /* cosmetic only */
  }
}

// The 先生用管理 (teacher admin / settingsApp) screen is dark-themed (navy bg +
// white/gray/teal text via the bundle's `A` palette) while every other tab is
// light, so its gray-on-navy body text is hard to read. Convert it to the light
// look: light container + light cards + dark text. Detected by its title, since
// the screen uses only generic utility classes.
function parseRgb(s) {
  if (typeof s !== "string") return null;
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (h) {
    let hex = h[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] };
}
/** True iff a CSS color string is an opaque, dark color. Pure + tested. */
export function isDarkOpaqueColor(s) {
  const c = parseRgb(s);
  if (!c || c.a < 0.5) return false;
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 120;
}
/** True iff the element's computed background (solid OR gradient) is mostly dark. */
function hasDarkBackground(cs) {
  if (isDarkOpaqueColor(cs.backgroundColor)) return true;
  const bi = cs.backgroundImage || "";
  if (bi.indexOf("gradient") < 0) return false;
  const cols = bi.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,6}/g) || [];
  let opaque = 0;
  let dark = 0;
  for (let i = 0; i < cols.length; i++) {
    const c = parseRgb(cols[i]);
    if (c && c.a >= 0.5) {
      opaque += 1;
      if (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 120) dark += 1;
    }
  }
  return opaque > 0 && dark / opaque > 0.5;
}

function findAdminContainer() {
  const nodes = document.querySelectorAll("h1,h2,h3,div,span");
  for (let i = 0; i < nodes.length; i++) {
    if ((nodes[i].textContent || "").trim() === "先生用管理") {
      let p = nodes[i];
      for (let up = 0; up < 8 && p; up += 1) {
        if (p.style && p.style.position === "absolute") return p;
        p = p.parentElement;
      }
      return nodes[i].parentElement;
    }
  }
  return null;
}

function lightenAdminOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll || !window.getComputedStyle) return;
    const container = findAdminContainer();
    if (!container) return;
    if (container.classList && !container.classList.contains("ox-admin-light")) {
      container.classList.add("ox-admin-light");
    }
    // The container's own dark fill may be a GRADIENT (A.bg), which the solid-only
    // check missed — so the whole navy backdrop stayed dark while text went dark
    // too (invisible). Use the gradient-aware check here as well.
    if (hasDarkBackground(window.getComputedStyle(container))) {
      container.style.setProperty("background", "#fbf8f3", "important");
      container.style.setProperty("background-image", "none", "important");
    }
    const els = container.querySelectorAll("*");
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const tag = el.tagName;
      if (tag === "svg" || tag === "SVG" || tag === "path" || tag === "PATH") continue;
      // lighten any DARK background — solid color OR a dark gradient (the cards
      // are gradients, which the solid-color check alone missed) — and give cards
      // a soft border so they read on the now-light surface.
      if (hasDarkBackground(window.getComputedStyle(el))) {
        el.style.setProperty("background-color", "#ffffff", "important");
        el.style.setProperty("background-image", "none", "important");
        el.style.setProperty("border-color", "rgba(15,23,42,.12)", "important");
        el.style.setProperty("box-shadow", "0 1px 3px rgba(15,23,42,.06)", "important");
      }
    }
  } catch {
    /* cosmetic only */
  }
}

// On a photo background the top profile header (avatar + name + 現論会 校名 +
// streak) sits directly on the photo and can be hard to read. That header uses
// only generic utility classes, so we find it by its org label ("現論会…") and
// back the nearest ancestor row that contains the avatar image. Photo-bg only.
const HEADER_BACK = "rgba(255,255,255,0.66)";

function backProfileHeaderOnce() {
  try {
    if (typeof document === "undefined" || !document.body) return;
    if (!document.body.classList || !document.body.classList.contains("oxbg-on")) return;
    const spans = document.querySelectorAll("span");
    for (let i = 0; i < spans.length; i++) {
      if ((spans[i].textContent || "").trim().indexOf("現論会") !== 0) continue;
      let el = spans[i].parentElement;
      let hops = 0;
      while (el && hops < 6) {
        if (el.querySelector && el.querySelector('img[data-oxav], img[alt="avatar"]')) break;
        el = el.parentElement;
        hops += 1;
      }
      if (el && el.style && String(el.style.background).indexOf("255, 255, 255, 0.66") < 0) {
        el.style.background = HEADER_BACK;
        el.style.borderRadius = "16px";
        el.style.padding = "6px 10px";
        el.style.backdropFilter = "blur(6px)";
        el.style.webkitBackdropFilter = "blur(6px)";
      }
      return;
    }
  } catch {
    /* cosmetic only */
  }
}

// Section headings that sit directly on the photo veil (no card backing). On a
// photo background give just these a white halo so they stay legible — they have
// mixed markup (.rx-sec h3 AND inline-styled headings) so we match by exact text.
export const VEIL_HALO_TEXTS = [
  "プレイリスト",
  "つながり",
  "お知らせ",
  "クイックメニュー",
  "最近の記録",
  "アカウント",
  "パレット",
  // 先生からの問題 area headings — kept legible on a photo theme background
  "先生からの問題",
  "配布アプリ",
  "配信",
];
// Stronger, thicker white outline (8-direction 1px ring + glow) so headings stay
// bold and legible on busy/bright photos.
const VEIL_HALO =
  "1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff, " +
  "0 2px 0 #fff, 0 -2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff, " +
  "0 0 4px rgba(255,255,255,.95), 0 0 9px rgba(255,255,255,.8)";

function haloVeilHeadingsOnce() {
  try {
    if (typeof document === "undefined" || !document.body) return;
    if (!document.body.classList || !document.body.classList.contains("oxbg-on")) return;
    const nodes = document.querySelectorAll("h1,h2,h3,h4,b,span,div,p");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.childElementCount !== 0) continue;
      if (VEIL_HALO_TEXTS.indexOf((el.textContent || "").trim()) < 0) continue;
      if (String(el.style.textShadow).indexOf("255, 255, 255") < 0) {
        el.style.textShadow = VEIL_HALO;
      }
    }
  } catch {
    /* cosmetic only */
  }
}

function swapHamsterIconsOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const imgs = document.querySelectorAll('img[src^="data:image/webp;base64,UklGR"]');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (isHamsterIconSrc(img.getAttribute("src") || "")) {
        img.setAttribute("src", HAMSTER_URL); // no longer matches the prefix -> idempotent
      }
    }
  } catch {
    /* a cosmetic swap must never break the app */
  }
}

// The frozen bundle appends " 先生" to a teacher's profile name — it renders
// .rx-pname children as [name, isTeacher ? " 先生" : ""], so the suffix is its own
// trailing text node (the name itself is the first node, untouched). Empty just
// that suffix node, by its exact value, so the username shows without "先生". The
// separate teacher BADGE (.rx-tbadge) still marks teachers; only the auto-appended
// name suffix is removed. Reapplied by the run loop after re-renders.
function stripTeacherNameSuffixOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const els = document.querySelectorAll(".rx-pname");
    for (let i = 0; i < els.length; i++) {
      const last = els[i].lastChild;
      if (last && last.nodeType === 3 && last.nodeValue === " 先生") {
        last.nodeValue = "";
      }
    }
  } catch {
    /* cosmetic only */
  }
}

function hideSectionsOnce(headings) {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    // Section headings in the admin screen are <h3> (some actions are <button>).
    // An icon <svg> child contributes no text, so textContent is just the label.
    const nodes = document.querySelectorAll("h2,h3,h4,button");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!isHideHeading(el.textContent, headings)) continue;
      const section = el.parentElement;
      if (section && section.style && section.style.display !== "none") {
        section.style.display = "none";
      }
    }
  } catch {
    /* a cosmetic removal must never break the app */
  }
}

// New-home access placed IN the legacy SETTINGS/account screen, just above the
// ログアウト button (a stable anchor unique to that screen). The new home is unlocked
// by entering a TEACHER-DISTRIBUTED CODE (replaces the old レジェンド-icon gate):
//   - unlocked (teacher, or code already entered, or preview opt-in) → show the
//     「新ホームに切り替える」 button.
//   - locked → show a code-entry field; the correct code unlocks + opens the new home.
// The code is a UX gate, not a security boundary (client-side check). Default is
// HOME_CODE_DEFAULT; an owner can override it at runtime via localStorage.oxhHomeCode.
// Never on the React home (#root holds .oxh). Idempotent; the run loop re-applies.
const HOME_SWITCH_ID = "ox-newhome-switch";
const HOME_CODE_ID = "ox-newhome-code";
const HOME_CODE_DEFAULT = "UMAMUSUME";
const HOME_UNLOCKED_KEY = "oriexHomeCodeUnlocked";

function expectedHomeCode() {
  try {
    const v = window.localStorage.getItem("oxhHomeCode");
    if (v && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  return HOME_CODE_DEFAULT;
}
function homeCodeUnlocked() {
  try {
    return window.localStorage.getItem(HOME_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}
function openNewHome() {
  try {
    window.localStorage.setItem("oriexHome", "1");
  } catch {
    /* ignore */
  }
  try {
    window.location.reload();
  } catch {
    /* ignore */
  }
}
function removeNode(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function injectHomeSwitchInSettingsOnce() {
  try {
    if (typeof document === "undefined" || !document.body) return;
    const swExisting = document.getElementById(HOME_SWITCH_ID);
    const codeExisting = document.getElementById(HOME_CODE_ID);

    // Never on the React home.
    if (document.querySelector(".oxh")) {
      removeNode(swExisting);
      removeNode(codeExisting);
      return;
    }

    let unlocked = false;
    try {
      unlocked =
        isTeacher() ||
        homeCodeUnlocked() ||
        window.localStorage.getItem("oriexHomeToggle") === "1";
    } catch {
      unlocked = false;
    }

    // The correct control already exists — clean up the other state and stop.
    if (unlocked && swExisting) {
      removeNode(codeExisting);
      return;
    }
    if (!unlocked && codeExisting) {
      removeNode(swExisting);
      return;
    }

    // Find the ログアウト control — its presence marks the settings/account screen.
    let leaf = null;
    const nodes = document.querySelectorAll("button,a,span,div");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.childElementCount === 0 && (el.textContent || "").trim() === "ログアウト") {
        leaf = el;
        break;
      }
    }
    if (!leaf) return; // not on the settings screen
    const btn = (leaf.closest && leaf.closest("button,a")) || leaf;
    const host = btn.parentElement;
    if (!host) return;

    if (unlocked) {
      removeNode(codeExisting);
      if (swExisting) return;
      const sw = document.createElement("button");
      sw.id = HOME_SWITCH_ID;
      sw.type = "button";
      sw.textContent = "新ホームに切り替える";
      sw.style.cssText =
        "display:block;width:100%;margin:0 0 10px;padding:13px;border:none;border-radius:14px;" +
        "background:linear-gradient(135deg,#ff3d52,#b3142a);color:#fff;font-weight:900;font-size:14px;" +
        "font-family:'Zen Maru Gothic',system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;" +
        "box-shadow:0 8px 18px rgba(179,20,42,.4);";
      sw.addEventListener("click", openNewHome);
      host.insertBefore(sw, btn);
      return;
    }

    // Locked: show a code-entry card.
    removeNode(swExisting);
    if (codeExisting) return;
    const card = document.createElement("div");
    card.id = HOME_CODE_ID;
    card.style.cssText =
      "display:block;width:100%;margin:0 0 10px;padding:13px;border:1.5px solid rgba(232,39,60,.45);" +
      "border-radius:14px;background:rgba(232,39,60,.06);" +
      "font-family:'Zen Maru Gothic',system-ui,sans-serif;";
    const label = document.createElement("div");
    label.textContent = "新ホームの解放コード";
    label.style.cssText = "font-size:13px;font-weight:900;color:#b3142a;margin-bottom:8px;";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "先生に聞いたコードを入力";
    input.autocomplete = "off";
    input.autocapitalize = "characters";
    input.style.cssText =
      "flex:1;min-width:0;padding:11px 12px;border:1px solid rgba(20,24,40,.18);border-radius:10px;" +
      "background:#fff;color:#1b2236;font-size:14px;font-family:inherit;";
    const go = document.createElement("button");
    go.type = "button";
    go.textContent = "解放";
    go.style.cssText =
      "flex:none;padding:0 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff3d52,#b3142a);" +
      "color:#fff;font-weight:900;font-size:14px;font-family:inherit;cursor:pointer;";
    const msg = document.createElement("div");
    msg.style.cssText = "font-size:11.5px;font-weight:700;margin-top:7px;min-height:14px;color:#b3142a;";
    const submit = () => {
      const val = (input.value || "").trim();
      if (!val) return;
      if (val.toLowerCase() === expectedHomeCode().toLowerCase()) {
        try {
          window.localStorage.setItem(HOME_UNLOCKED_KEY, "1");
        } catch {
          /* ignore */
        }
        msg.style.color = "#1a8f4a";
        msg.textContent = "解放しました。新ホームを開きます…";
        openNewHome();
      } else {
        msg.style.color = "#b3142a";
        msg.textContent = "コードが正しくありません。先生に確認してください。";
      }
    };
    go.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    row.appendChild(input);
    row.appendChild(go);
    card.appendChild(label);
    card.appendChild(row);
    card.appendChild(msg);
    host.insertBefore(card, btn);
  } catch {
    /* a cosmetic injection must never break the app */
  }
}

// Paint the equipped frame ring onto the legacy header avatar (so the choice shows
// in the original app too). Matched by the bundle's avatar <img data-oxav>.
function applyAvatarFrameOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const ring = frameRing(getFrame());
    const imgs = document.querySelectorAll('img[data-oxav]:not([data-ox-iconpv])');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const want = ring === "none" ? "" : ring;
      if (img.style.boxShadow !== want) img.style.boxShadow = want;
    }
  } catch {
    /* cosmetic only */
  }
}

function relabelOnce(map) {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const nodes = document.querySelectorAll("span,div,button,a,p");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!isLeafLabel(el)) continue;
      const repl = nextLabel(el.textContent, map);
      if (repl != null && el.textContent !== repl) el.textContent = repl;
    }
  } catch {
    /* never let a cosmetic patch break the app */
  }
}

// The profile-edit "プロフィール背景を変更" card carries an ALWAYS-VISIBLE inline
// preview (a [data-oxpbg-cover] tile that __oxPbg keeps in sync), so you see the
// crop without opening any modal. The "アイコンを変更" card has NO such inline
// preview — the only live [data-oxav] tile lives up in the header, away from the
// sliders/「調整」button — so the user can't watch the icon while editing it.
// Inject the same kind of always-on preview INTO the icon card: a circular
// [data-oxav] tile that __oxAv.applyEls() keeps synced (zoom/position) live,
// exactly like the background card. Photo avatars only (an illustration has no
// crop to preview); cosmetic + reversible, the frozen bundle is untouched.
function injectIconPreviewOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    // The icon card's header label is a leaf node with this exact text.
    let label = null;
    const leaves = document.querySelectorAll("p,span,div");
    for (let i = 0; i < leaves.length; i++) {
      const el = leaves[i];
      if (el.childElementCount === 0 && (el.textContent || "").trim() === "アイコンを変更") {
        label = el;
        break;
      }
    }
    if (!label) return; // not on the profile-edit screen
    const headerRow = label.parentElement; // flex row: label + 写真 upload
    const card = headerRow && headerRow.parentElement; // the icon-edit card
    if (!card) return;

    // The current photo avatar, if any: the bundle renders a single [data-oxav]
    // <img src={photo}> (the header tile). We mirror its src into our preview.
    const srcImg = document.querySelector('img[data-oxav]:not([data-ox-iconpv])');
    const existingWrap = card.querySelector('[data-ox-iconpv-wrap]');

    if (!srcImg || !srcImg.getAttribute("src")) {
      // Illustration (no photo) — nothing to crop; drop any stale preview.
      if (existingWrap && existingWrap.parentNode) existingWrap.parentNode.removeChild(existingWrap);
      return;
    }
    const src = srcImg.getAttribute("src");

    if (existingWrap) {
      const cur = existingWrap.querySelector('img[data-ox-iconpv]');
      if (cur && cur.getAttribute("src") !== src) cur.setAttribute("src", src);
      return; // already injected; __oxAv keeps zoom/position synced
    }

    const wrap = document.createElement("div");
    wrap.setAttribute("data-ox-iconpv-wrap", "1");
    wrap.style.cssText = "display:flex;justify-content:center;margin:10px 0 2px";
    const tile = document.createElement("div");
    tile.style.cssText =
      "width:96px;height:96px;border-radius:50%;overflow:hidden;border:1px solid rgba(0,0,0,.08);background:#0891b2";
    const img = document.createElement("img");
    img.setAttribute("data-oxav", "1"); // so __oxAv.applyEls() syncs it live
    img.setAttribute("data-ox-iconpv", "1"); // our marker (excluded as a src source)
    img.alt = "アイコンプレビュー";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    img.setAttribute("src", src);
    // Seed the crop immediately so there is no one-frame "uncropped" flash before
    // __oxAv's next tick.
    if (window.__oxAvPos) {
      img.style.objectPosition = window.__oxAvPos();
      img.style.transformOrigin = window.__oxAvPos();
    }
    if (window.__oxAvScale) img.style.transform = window.__oxAvScale();
    tile.appendChild(img);
    wrap.appendChild(tile);
    card.insertBefore(wrap, headerRow.nextSibling);
  } catch {
    /* a cosmetic preview must never break the app */
  }
}

// Each お知らせ (announcement) card renders a colored LEFT RIM — a thin vertical
// indigo→violet gradient strip (absolute top-0 left-0 w-1 h-full) — plus, on
// unread cards, an indigo border + glow. The user wants that edge color gone.
// Strip just the COLOR: hide the rim strip and neutralize the indigo border/glow,
// leaving the card's shape intact. We match the strip by its exact class combo +
// a linear-gradient background so no other accent strip is touched, and only
// recolor a border/shadow that is actually the indigo one. Cosmetic + reversible;
// the frozen bundle is untouched.
const INDIGO = "99, 102, 241"; // rgb of #6366f1, as the browser serializes it
function neutralizeNoticeEdgeOnce() {
  try {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const strips = document.querySelectorAll("div.absolute.top-0.left-0.w-1.h-full");
    for (let i = 0; i < strips.length; i++) {
      const strip = strips[i];
      const bg = strip.style.backgroundImage || strip.style.background || "";
      if (bg.indexOf("linear-gradient") < 0) continue; // not the colored rim
      if (strip.style.display !== "none") {
        strip.style.setProperty("display", "none", "important");
      }
      const card = strip.parentElement;
      if (card && card.style) {
        const b = card.style.border || card.style.borderColor || "";
        if (b.replace(/\s/g, "").indexOf(INDIGO.replace(/\s/g, "")) >= 0) {
          card.style.setProperty("border-color", "rgba(0,0,0,0.08)", "important");
        }
        const sh = card.style.boxShadow || "";
        if (sh.replace(/\s/g, "").indexOf(INDIGO.replace(/\s/g, "")) >= 0) {
          card.style.setProperty("box-shadow", "none", "important");
        }
      }
    }
  } catch {
    /* a cosmetic tweak must never break the app */
  }
}

// On a photo theme background the legacy "先生からの問題 / 配布アプリ / 配信" (customApp)
// screen renders its text/cards straight on the photo, which is hard to read. Give
// that screen's content container a soft frosted backing so it stays legible —
// ONLY under body.oxbg-on (photo bg on) and only on that screen (matched by its
// heading). Cosmetic + reversible; the frozen bundle is untouched.
const CUSTOMAPP_HEADINGS = ["先生からの問題", "配布アプリ", "配信"];
function backCustomAppOnce() {
  try {
    if (typeof document === "undefined" || !document.body) return;
    if (!document.body.classList || !document.body.classList.contains("oxbg-on")) return;
    const heads = document.querySelectorAll("h1,h2,h3");
    for (let i = 0; i < heads.length; i++) {
      if (CUSTOMAPP_HEADINGS.indexOf((heads[i].textContent || "").trim()) < 0) continue;
      let p = heads[i];
      for (let h = 0; h < 6 && p; h += 1) {
        const cls = (p.className && typeof p.className === "string" && p.className) || "";
        if (cls.indexOf("space-y-6") >= 0) {
          if (String(p.style.background).indexOf("255, 255, 255") < 0) {
            p.style.background = "rgba(255,255,255,0.84)";
            p.style.backdropFilter = "blur(8px)";
            p.style.webkitBackdropFilter = "blur(8px)";
            p.style.borderRadius = "18px";
            p.style.padding = "12px";
          }
          return;
        }
        p = p.parentElement;
      }
      return;
    }
  } catch {
    /* cosmetic only */
  }
}

// The word-quiz "play" view (先生からの問題 を解く画面) renders its cards on a near-
// transparent background, so on a photo theme the word display is hard to read.
// Give the play view's container a frosted backing under body.oxbg-on only. The
// play view is the full-height "flex flex-col w-full" screen with paddingBottom:76px
// — distinctive enough to match without touching other screens.
function backPlayViewOnce() {
  try {
    if (typeof document === "undefined" || !document.body) return;
    if (!document.body.classList || !document.body.classList.contains("oxbg-on")) return;
    const els = document.querySelectorAll("div.animate-in.fade-in.flex.flex-col.w-full");
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if ((el.style.paddingBottom || "").indexOf("76px") < 0) continue;
      if (String(el.style.background).indexOf("255, 255, 255") < 0) {
        el.style.background = "rgba(255,255,255,0.86)";
        el.style.backdropFilter = "blur(8px)";
        el.style.webkitBackdropFilter = "blur(8px)";
        el.style.borderRadius = "18px";
        el.style.paddingLeft = "10px";
        el.style.paddingRight = "10px";
      }
      return;
    }
  } catch {
    /* cosmetic only */
  }
}

/** Install the relabel patches. Idempotent enough to call once at startup. */
export function installUiPatches(map = RELABELS) {
  try {
    if (typeof document === "undefined") return;
    // Preload the hamster image so the icon swap is INSTANT (no async-load size
    // pop / flicker when the swapped <img> first appears).
    try {
      if (typeof Image === "function") {
        const pre = new Image();
        pre.src = HAMSTER_URL;
      }
    } catch {
      /* ignore */
    }
    const run = () => {
      relabelOnce(map);
      hideSectionsOnce(HIDE_SECTION_HEADINGS);
      swapHamsterIconsOnce();
      outlineMenuIconsOnce();
      backProfileHeaderOnce();
      haloVeilHeadingsOnce();
      injectIconPreviewOnce();
      neutralizeNoticeEdgeOnce();
      stripTeacherNameSuffixOnce();
      backCustomAppOnce();
      backPlayViewOnce();
      injectHomeSwitchInSettingsOnce();
      applyAvatarFrameOnce();
    };

    if (document.readyState !== "loading") setTimeout(run, 0);
    else document.addEventListener("DOMContentLoaded", run);

    if (typeof window !== "undefined" && window.MutationObserver) {
      let queued = false;
      const schedule = () => {
        if (queued) return;
        queued = true;
        (window.requestAnimationFrame || setTimeout)(() => {
          queued = false;
          run();
        }, 16);
      };
      new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    // Backstop for re-renders the observer might coalesce away (mirrors oxHelpers).
    setInterval(run, 700);
  } catch {
    /* ignore */
  }
}
