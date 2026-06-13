/* ============================================================
 * localAiClient — Ollama との通信だけを担当
 * ------------------------------------------------------------
 * 設計上の約束:
 *   - 既定の接続先は http://localhost:11434 のみ。
 *   - 外部のクラウドAIサービスには一切接続しない。この層に外部
 *     ホストのURLは存在しない（接続先はOllamaのみ）。
 *   - APIキーは使わない / 保存しない。
 *   - すべての呼び出しにタイムアウトを設定する。
 *   - 失敗してもUIが落ちないよう、必ず結果オブジェクトか
 *     LocalAiError（userMessage付き）を返す。
 * ============================================================ */

import { buildPrompt } from "./localAiPrompts.js";
import { extractJson, validateRequired } from "./localAiSchemas.js";

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const LOCAL_AI_STRICT_PRESET = Object.freeze({
  id: "strict",
  label: "最高品質",
  description: "常に厳密に生成・自己検査・修正・最終確認を行います。",
  temperature: 0.1,
  numCtx: 16384,
  selfCheck: true,
  repair: true,
  finalCheck: true,
});
export const LOCAL_AI_MODEL_PROFILES = Object.freeze({
  recommended: {
    id: "recommended",
    label: "推奨",
    model: "qwen2.5:14b-instruct",
    description: "文章清書・要約・問題作成のバランスが良い推奨モデル。",
  },
  powerful: {
    id: "powerful",
    label: "高性能PC向け",
    model: "qwen2.5:32b-instruct",
    description: "重いが、問題作成や根拠確認に強い。",
  },
  lightFallback: {
    id: "lightFallback",
    label: "軽量代替",
    model: "qwen2.5:7b-instruct",
    description: "PC性能が足りない場合の代替。品質はやや落ちる可能性があります。",
  },
  custom: {
    id: "custom",
    label: "手動指定",
    model: "",
    description: "Ollamaに入っている任意のモデルを指定。",
  },
});
export const DEFAULT_LOCAL_AI_MODEL = LOCAL_AI_MODEL_PROFILES.recommended.model;
export const ALLOWED_OLLAMA_BASE_URLS = Object.freeze([
  "http://localhost:11434",
  "http://127.0.0.1:11434",
]);

const HEALTH_TIMEOUT_MS = 8000;
const GENERATE_TIMEOUT_MS = 120000; // CPU生成は遅いので長め

export class LocalAiError extends Error {
  constructor(userMessage, cause) {
    super(userMessage);
    this.name = "LocalAiError";
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

function joinUrl(baseUrl, path) {
  const b = assertAllowedBaseUrl(baseUrl);
  const p = path.startsWith("/") ? path : "/" + path;
  return b + p;
}

function normalizeBaseUrl(url) {
  let u;
  try {
    u = new URL(String(url || DEFAULT_OLLAMA_BASE_URL).trim());
  } catch {
    return null;
  }
  if (u.pathname !== "/" || u.search || u.hash || u.username || u.password) return null;
  return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
}

/* 接続先URLの素性を判定。UI表示だけでなく送信可否にも使う。 */
export function classifyBaseUrl(url) {
  const normalized = normalizeBaseUrl(url);
  if (normalized && ALLOWED_OLLAMA_BASE_URLS.includes(normalized)) {
    return { ok: true, allowed: true, level: "allowed", normalized, reason: "ローカルOllama接続として許可されています。" };
  }

  let u;
  try {
    u = new URL(String(url || "").trim());
  } catch {
    return { ok: false, allowed: false, level: "invalid", reason: "URLの形式が正しくありません。" };
  }
  if (u.protocol !== "http:") {
    return { ok: false, allowed: false, level: "blocked", reason: "http://localhost:11434 または http://127.0.0.1:11434 だけが使えます。https や外部URLはブロックされます。" };
  }
  const host = u.hostname;
  if (host === "0.0.0.0" || host === "::1") {
    return { ok: false, allowed: false, level: "blocked", reason: "0.0.0.0 や ::1 は許可していません。localhost または 127.0.0.1 を使ってください。" };
  }
  const isLan = /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isLan) {
    return { ok: false, allowed: false, level: "blocked", reason: "LAN IP はブロックされています。外部端末へ送信しません。" };
  }
  return { ok: false, allowed: false, level: "blocked", reason: "許可されていない接続先です。外部URLや任意サーバーへの送信はブロックされています。" };
}

export function assertAllowedBaseUrl(url) {
  const cls = classifyBaseUrl(url);
  if (cls.allowed) return cls.normalized;
  throw new LocalAiError(cls.reason);
}

async function fetchWithTimeout(url, options, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // chain an externally-provided signal (e.g. component unmount)
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function friendlyError(err) {
  if (err && err.name === "AbortError") {
    return "時間内に応答がありませんでした。モデルが大きい、または入力が長すぎる可能性があります。";
  }
  // network / CORS / connection refused all surface as TypeError "Failed to fetch"
  return "ローカルAIに接続できませんでした。Ollamaが起動しているか確認してください。";
}

/* 接続確認: GET /api/tags でサーバ到達とモデル一覧を取得。 */
export async function checkLocalAiHealth({ baseUrl = DEFAULT_OLLAMA_BASE_URL, model } = {}) {
  assertAllowedBaseUrl(baseUrl);
  try {
    const res = await fetchWithTimeout(joinUrl(baseUrl, "/api/tags"), { method: "GET" }, HEALTH_TIMEOUT_MS);
    if (!res.ok) {
      return { ok: false, reachable: true, error: `Ollamaが応答エラーを返しました (HTTP ${res.status})`, baseUrl };
    }
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models.map((m) => m && m.name).filter(Boolean) : [];
    const base = model ? String(model).split(":")[0] : null;
    const hasModel = model ? models.some((n) => n === model || n.split(":")[0] === base) : true;
    return { ok: true, reachable: true, models, hasModel, baseUrl };
  } catch (err) {
    return { ok: false, reachable: false, error: friendlyError(err), baseUrl };
  }
}

/* テキスト生成。/api/generate (stream:false) を使用。 */
export async function generateWithLocalAi({
  taskType,
  input,
  context,
  model = DEFAULT_LOCAL_AI_MODEL,
  baseUrl = DEFAULT_OLLAMA_BASE_URL,
  schema,
  signal,
} = {}) {
  assertAllowedBaseUrl(baseUrl);
  const { system, prompt, format } = buildPrompt(taskType, { input, context });
  const body = {
    model,
    prompt: system ? system + "\n\n" + prompt : prompt,
    stream: false,
    options: {
      temperature: LOCAL_AI_STRICT_PRESET.temperature,
      num_ctx: LOCAL_AI_STRICT_PRESET.numCtx,
    },
  };
  if (schema) body.format = schema;
  else if (format === "json") body.format = "json"; // Ollamaに有効なJSONを促す

  let res;
  try {
    res = await fetchWithTimeout(
      joinUrl(baseUrl, "/api/generate"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      GENERATE_TIMEOUT_MS,
      signal
    );
  } catch (err) {
    throw new LocalAiError(friendlyError(err), err);
  }

  if (res.status === 404) {
    // Ollama returns 404 when the model isn't pulled
    throw new LocalAiError(
      `指定されたモデルが見つかりません。Ollamaで以下を実行してください。\n\nollama pull ${model}`
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j && j.error ? `: ${j.error}` : "";
    } catch {
      /* ignore body parse errors */
    }
    throw new LocalAiError(`生成に失敗しました (HTTP ${res.status})${detail}`);
  }

  const data = await res.json().catch(() => ({}));
  return { text: typeof data.response === "string" ? data.response : "", raw: data, format };
}

/* JSON生成。パース成功かつ必須キーが揃えば data を返す。
 * 失敗時は ok:false で text（生テキスト）も返し、UI側がテキスト表示に切り替える。 */
export async function generateJsonWithLocalAi({ schema, ...rest } = {}) {
  const { text, raw } = await generateWithLocalAi({ ...rest, context: rest.context, schema });
  const parsed = extractJson(text);
  if (parsed.ok) {
    const valid = validateRequired(parsed.data, schema);
    if (valid.ok) return { ok: true, data: parsed.data, text, raw };
    return { ok: false, data: parsed.data, text, raw, error: "出力の項目が不足しています（テキスト表示に切替）。" };
  }
  return { ok: false, data: null, text, raw, error: "JSONとして解析できませんでした（テキスト表示に切替）。" };
}
