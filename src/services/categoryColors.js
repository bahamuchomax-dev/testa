/* ============================================================
 * categoryColors — 単語カテゴリ（教科）の配色を一元管理
 * ------------------------------------------------------------
 * 目的: 英単語・熟語・漢字・化学・古文などのカテゴリカードで「1つだけ色が
 *       付かない/薄い/未設定」になるのを防ぐ。全カテゴリに accent / softBg /
 *       iconBg を必ず持たせ、未知のカテゴリでも安全な fallback を返す
 *       （undefined を出さない）。
 *
 * 使い分け:
 *   accent  … 選択時の border / label / underline / アイコン本体色
 *   softBg  … カード／バッジの薄い背景（未選択でもうっすら色づく）
 *   iconBg  … アイコン背景（未選択でも薄く色づく）
 *
 * 注意: ライブの一覧カードは凍結された legacy バンドルが描画するため、本マップで
 *       バンドル側を遡及的に塗り替えることはできない（CSS フォールバックで色抜けは
 *       防止）。React 側（Factory 等）と移行後の単一ソースとして使う。
 * ============================================================ */

// 安全な既定色（テーマ accent に追従。未知カテゴリでも必ず色が付く）。
export const FALLBACK_COLOR = Object.freeze({
  id: "_fallback",
  label: "その他",
  accent: "var(--accent, #ff7a59)",
  softBg: "var(--accent-soft, #ffe9e2)",
  iconBg: "var(--accent-soft, #ffe9e2)",
});

// id をキーに持つ配色マップ（各エントリの id はキーと一致させる）。
export const CATEGORY_COLORS = Object.freeze({
  eitango: { id: "eitango", label: "英単語", accent: "#2f6df0", softBg: "#e8eeff", iconBg: "#dbe6ff" },
  idiom: { id: "idiom", label: "熟語", accent: "#e0792f", softBg: "#fdeede", iconBg: "#ffe6cf" },
  kanji: { id: "kanji", label: "漢字", accent: "#c0392b", softBg: "#fbe6e3", iconBg: "#ffd9d2" },
  chemistry: { id: "chemistry", label: "化学", accent: "#2aa676", softBg: "#e3f6ee", iconBg: "#cdeede" },
  koten: { id: "koten", label: "古文", accent: "#8a5cf0", softBg: "#efe8fd", iconBg: "#e3d6ff" },
});

// 日本語ラベル / よくある別名 → id の対応（ラベルで来ても解決できるように）。
const ALIAS_TO_ID = Object.freeze({
  英単語: "eitango",
  単語: "eitango",
  english: "eitango",
  eitan: "eitango",
  vocab: "eitango",
  熟語: "idiom",
  idiom: "idiom",
  漢字: "kanji",
  kanji: "kanji",
  化学: "chemistry",
  chem: "chemistry",
  chemistry: "chemistry",
  古文: "koten",
  koten: "koten",
  classics: "koten",
});

/* カテゴリの id / ラベル / 別名から配色を返す。未知でも FALLBACK を返し、
 * 戻り値の accent / softBg / iconBg は常に非空（undefined を出さない）。 */
export function colorForCategory(key) {
  if (key == null) return FALLBACK_COLOR;
  const raw = String(key).trim();
  if (!raw) return FALLBACK_COLOR;
  if (CATEGORY_COLORS[raw]) return CATEGORY_COLORS[raw];
  const lower = raw.toLowerCase();
  if (CATEGORY_COLORS[lower]) return CATEGORY_COLORS[lower];
  const id = ALIAS_TO_ID[raw] || ALIAS_TO_ID[lower];
  if (id && CATEGORY_COLORS[id]) return CATEGORY_COLORS[id];
  return FALLBACK_COLOR;
}

/* 全カテゴリ配列（UI のループ用）。 */
export function listCategoryColors() {
  return Object.values(CATEGORY_COLORS);
}
