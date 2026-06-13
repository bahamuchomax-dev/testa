/* ============================================================
 * localAiStorage — 設定だけを保存する層
 * ------------------------------------------------------------
 * 保存してよいもの: 接続先URL / モデル名 / temperature /
 *   最後に選んだタブ / 軽いUI設定。
 * 保存してはいけないもの: 生徒の個人情報・先生メモ・PDF本文・
 *   生成結果。これらはここを通さない（自動永続化しない）。
 *
 * 既存の localStore（安全なJSON read/write）を再利用する。
 * ============================================================ */

import { readJSON, writeJSON } from "../../services/repository/localStore.js";
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_LOCAL_AI_MODEL,
  LOCAL_AI_MODEL_PROFILES,
  LOCAL_AI_STRICT_PRESET,
} from "./localAiClient.js";

const KEY = "oriex:v1:localAiSettings";

export const DEFAULT_SETTINGS = Object.freeze({
  baseUrl: DEFAULT_OLLAMA_BASE_URL,
  model: DEFAULT_LOCAL_AI_MODEL,
  modelProfileId: LOCAL_AI_MODEL_PROFILES.recommended.id,
  temperature: LOCAL_AI_STRICT_PRESET.temperature,
  lastTab: "review_plan",
});

export const MODEL_OPTIONS = Object.values(LOCAL_AI_MODEL_PROFILES)
  .map((profile) => profile.model)
  .filter(Boolean);

function sanitize(s) {
  const out = { ...DEFAULT_SETTINGS };
  if (s && typeof s === "object") {
    if (typeof s.baseUrl === "string" && s.baseUrl.trim()) out.baseUrl = s.baseUrl.trim();
    if (typeof s.model === "string" && s.model.trim()) out.model = s.model.trim();
    if (typeof s.modelProfileId === "string" && LOCAL_AI_MODEL_PROFILES[s.modelProfileId]) {
      out.modelProfileId = s.modelProfileId;
    }
    out.temperature = LOCAL_AI_STRICT_PRESET.temperature;
    if (typeof s.lastTab === "string") out.lastTab = s.lastTab;
  }
  const profile = LOCAL_AI_MODEL_PROFILES[out.modelProfileId];
  if (profile && profile.id !== LOCAL_AI_MODEL_PROFILES.custom.id) out.model = profile.model;
  return out;
}

export function loadSettings() {
  return sanitize(readJSON(KEY, null));
}

export function saveSettings(patch) {
  const next = sanitize({ ...loadSettings(), ...patch });
  writeJSON(KEY, next);
  return next;
}
