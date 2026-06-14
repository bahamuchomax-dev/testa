/* ============================================================
 * embeddedAiConfig — in-browser (on-device) AI EXPERIMENT config
 * ------------------------------------------------------------
 * This is the experimental "embedded AI" track: a small model that may run
 * entirely on the device (phones included), separate from the existing local-AI
 * track (PC, high quality, localhost). It is NOT a replacement for that track
 * and it is NOT an external AI API. How the two tracks differ, and the concrete
 * engine candidates, are described in docs/EMBEDDED_AI_PLAN.md.
 *
 * EMBEDDED_AI_UI_ENABLED stays false: the experiment is never exposed from
 * normal navigation. It is opt-in only and, like the paused Local AI UI, is
 * kept out of the production surface. See docs/EMBEDDED_AI_PLAN.md.
 * ============================================================ */

// Must start false. Do not expose embedded AI from normal screens.
export const EMBEDDED_AI_UI_ENABLED = false;

// Marks this as an experimental, opt-in feature.
export const EMBEDDED_AI_EXPERIMENTAL = true;

// Phase 2 device probe is a developer diagnostic only. It stays false and is
// not wired into normal navigation (the probe panel is an unmounted component).
export const EMBEDDED_AI_PROBE_ENABLED = false;

// Phase 3A WebGPU PoC. Phase 3C device spike: temporarily TRUE on the
// dedicated device-spike verification branch so the hidden PoC URL can
// load/generate on a real phone. MUST be set back to false before merging to
// main. The PoC never appears in normal navigation regardless of this flag;
// it is reachable only via the hidden PoC URL.
export const EMBEDDED_AI_POC_ENABLED = true;

// Phase 1 has exactly one tiny use case: a short review suggestion built from
// today's study memo. Short input, no strict JSON output, safe to fail.
export const EMBEDDED_AI_EXPERIMENT = "review-suggestion";

// Keep the experiment input small (chars). Prevents long prompts from being
// kept around and keeps on-device work light.
export const EMBEDDED_AI_INPUT_MAX_LENGTH = 800;

// Warnings shown in the experiment UI. Plain strings, rendered as text only.
export const EMBEDDED_AI_WARNINGS = [
  "これは実験機能です。",
  "端末によっては動作しません。",
  "初回はモデル取得のため時間がかかることがあります。",
  "電池を消費します。",
  "入力文は外部AI APIへ送信しません（端末内で処理します）。",
  "失敗しても学習データは失われません。",
];

// Note about model fetching IF an engine is plugged in later. No model is
// fetched in this phase because no engine library is bundled. Documented in
// docs/EMBEDDED_AI_PLAN.md as well.
export const EMBEDDED_AI_MODEL_SOURCE_NOTE =
  "将来エンジンを組み込む場合、モデルはエンジン提供元(CDN等)から取得し、端末内(IndexedDB / Cache Storage)にキャッシュされる可能性があります。入力文・生徒データ・先生メモは外部AI APIへ送信しません。";
