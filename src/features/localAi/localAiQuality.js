import { generateJsonWithLocalAi, generateWithLocalAi } from "./localAiClient.js";
import { runTaskValidator, applyValidatorToFinalCheck } from "./localAiValidators.js";

export const SELF_CHECK_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    ok: { type: "boolean" },
    score: { type: "number" },
    issues: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    mustFix: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["ok", "score", "issues", "warnings", "mustFix", "summary"],
});

const QUALITY_TASK = "__oriex_quality_check";
const MIN_USABLE_SCORE = 85;
const REPAIR_RULES = [
  "前回の出力には問題がありました。",
  "入力にない事実を削除してください。",
  "範囲外情報を混ぜないでください。",
  "指定schemaを守ってください。",
  "新しい情報を追加せず、入力から確認できる内容だけで出力してください。",
  "先生がそのまま使える自然な日本語にしてください。",
].join("\n");

const CHECK_RULES = [
  "入力にない事実を追加していないか。",
  "先生メモにない点数や宿題を作っていないか。",
  "PDF本文にない知識を混ぜていないか。",
  "単語小テストに範囲外単語が混ざっていないか。",
  "生徒を人格否定していないか。",
  "「やる気がない」など断定していないか。",
  "医療・心理診断のような表現がないか。",
  "指定schemaを守っているか。",
].join("\n");

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toStringArray(value) {
  return Array.isArray(value) ? value.map((x) => String(x || "").trim()).filter(Boolean) : [];
}

function normalizeSelfCheck(value) {
  const v = value && typeof value === "object" ? value : {};
  return {
    ok: v.ok === true,
    score: clampScore(v.score),
    issues: toStringArray(v.issues),
    warnings: toStringArray(v.warnings),
    mustFix: toStringArray(v.mustFix),
    summary: String(v.summary || ""),
  };
}

function hasMajorIssue(check) {
  const text = [...(check.issues || []), ...(check.mustFix || [])].join("\n");
  return [
    "入力にない",
    "本文にない",
    "範囲外",
    "人格否定",
    "やる気がない",
    "医療",
    "心理診断",
    "診断",
  ].some((word) => text.includes(word));
}

export function shouldRepair(check) {
  if (!check) return true;
  return check.ok !== true || clampScore(check.score) < MIN_USABLE_SCORE;
}

/* 修正生成が行われた理由を、初回自己検査の指摘から人間向けに要約する。
 * （UIの「修正生成: 実行済み / 理由: …」表示に使う） */
function describeRepairReason(initialCheck) {
  if (!initialCheck) return "自己検査の基準を満たさなかったため";
  const reasons = [...(initialCheck.mustFix || []), ...(initialCheck.issues || [])]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  if (reasons.length) return reasons.join(" / ");
  if (initialCheck.ok !== true) return "自己検査で問題が指摘されたため";
  return "自己検査の基準（score 85以上）を満たさなかったため";
}

export function buildFinalCheck(selfCheck) {
  const check = normalizeSelfCheck(selfCheck);
  const major = hasMajorIssue(check);
  let status = "caution";
  if (major) status = "blocked";
  else if (check.ok && check.score >= MIN_USABLE_SCORE) status = "usable";

  return {
    score: check.score,
    status,
    warnings: check.warnings,
    summary:
      status === "usable"
        ? check.summary || "使用可能です。"
        : status === "blocked"
          ? check.summary || "重大な問題があるため使用を止めてください。"
          : check.summary || "注意して確認してください。",
  };
}

export async function runSelfCheck({
  taskType,
  input,
  context,
  output,
  schema,
  model,
  baseUrl,
  signal,
  deps = { generateJsonWithLocalAi },
} = {}) {
  const prompt = [
    "# Oriex local quality self-check",
    "次の入力と生成結果を比較し、出力が安全で根拠に沿っているか確認してください。",
    "必ず指定schemaのJSONだけを返してください。",
    "",
    "# 確認項目",
    CHECK_RULES,
    "",
    "# タスク",
    asText(taskType),
    "",
    "# 元の入力",
    asText(input),
    context ? "\n# 条件\n" + asText(context) : "",
    schema ? "\n# 出力schema\n" + asText(schema) : "",
    "",
    "# 生成結果",
    asText(output),
    "",
    "# 判定",
    "問題がなければ ok:true, score は 85 以上にしてください。",
    "入力外の事実、範囲外情報、人格否定、断定、診断表現があれば ok:false にし、mustFix に具体的に入れてください。",
  ].join("\n");

  const result = await deps.generateJsonWithLocalAi({
    taskType: QUALITY_TASK,
    input: prompt,
    schema: SELF_CHECK_SCHEMA,
    model,
    baseUrl,
    signal,
  });
  return normalizeSelfCheck(result.ok ? result.data : null);
}

export async function runRepairGeneration({
  taskType,
  input,
  context,
  originalOutput,
  output,
  selfCheck,
  schema,
  model,
  baseUrl,
  signal,
  deps = { generateJsonWithLocalAi, generateWithLocalAi },
} = {}) {
  const priorOutput = originalOutput != null ? originalOutput : output;
  const repairPrompt = [
    "# Oriex local repair generation",
    REPAIR_RULES,
    "",
    "# 元の入力",
    asText(input),
    context ? "\n# 条件\n" + asText(context) : "",
    "",
    "# 初回生成結果",
    asText(priorOutput),
    "",
    "# 自己検査結果",
    asText(selfCheck),
    "",
    "# mustFix",
    asText(selfCheck && selfCheck.mustFix),
    "",
    "# warnings",
    asText(selfCheck && selfCheck.warnings),
    schema ? "\n# 出力schema\n" + asText(schema) : "",
  ].join("\n");

  if (schema) {
    return deps.generateJsonWithLocalAi({
      taskType,
      input: repairPrompt,
      context,
      schema,
      model,
      baseUrl,
      signal,
    });
  }

  return deps.generateWithLocalAi({
    taskType,
    input: repairPrompt,
    context,
    model,
    baseUrl,
    signal,
  });
}

function outputTextFromGeneration(result) {
  if (!result) return "";
  if (result.ok && result.data) return asText(result.data);
  return result.text || "";
}

export async function generateStrictJsonWithQuality(
  { taskType, input, context, schema, model, baseUrl, signal } = {},
  deps = { generateJsonWithLocalAi, generateWithLocalAi }
) {
  const first = schema
    ? await deps.generateJsonWithLocalAi({ taskType, input, context, schema, model, baseUrl, signal })
    : await deps.generateWithLocalAi({ taskType, input, context, model, baseUrl, signal });

  const firstCheck = await runSelfCheck({
    taskType,
    input,
    context,
    output: outputTextFromGeneration(first),
    schema,
    model,
    baseUrl,
    signal,
    deps,
  });

  let finalGeneration = first;
  let finalSelfCheck = firstCheck;
  let repaired = false;

  if (shouldRepair(firstCheck)) {
    repaired = true;
    finalGeneration = await runRepairGeneration({
      taskType,
      input,
      context,
      originalOutput: outputTextFromGeneration(first),
      selfCheck: firstCheck,
      schema,
      model,
      baseUrl,
      signal,
      deps,
    });
    finalSelfCheck = await runSelfCheck({
      taskType,
      input,
      context,
      output: outputTextFromGeneration(finalGeneration),
      schema,
      model,
      baseUrl,
      signal,
      deps,
    });
  }

  const baseFinalCheck = buildFinalCheck(finalSelfCheck);
  const structuredOk = schema ? finalGeneration.ok === true : true;
  const finalData = schema && structuredOk ? finalGeneration.data : null;
  const finalText = finalGeneration.text || outputTextFromGeneration(finalGeneration);

  // v5-3: タスク別の決定的チェック。修正生成ループは増やさず（最大1回のまま）、
  // 結果は finalCheck の status / warnings / score に反映するだけ。
  const deterministic = runTaskValidator({
    taskType,
    output: finalData != null ? finalData : finalText,
    input,
    context,
  });
  const finalCheck = applyValidatorToFinalCheck(baseFinalCheck, deterministic);

  const repairedSelfCheck = repaired ? finalSelfCheck : null;
  const repairReason = repaired ? describeRepairReason(firstCheck) : "";
  return {
    ok: structuredOk,
    data: finalData,
    text: finalText,
    // ---- v5-2 の契約（フラット） ----
    repaired,
    selfCheck: firstCheck, // 初回の自己検査
    repairedSelfCheck, // 修正生成後の自己検査（修正なしなら null）
    finalCheck,
    // ---- v5-3: 決定的チェック結果 ----
    deterministicCheck: deterministic,
    // ---- UIフォールバック用（付加情報） ----
    fallback: schema ? !structuredOk : false,
    fallbackMsg: schema && !structuredOk ? finalGeneration.error : "",
    // ---- 既存UI（LocalAiResultView / LocalAiQualityBadge）が参照する集約 ----
    quality: {
      selfCheck: finalSelfCheck, // 表示中の出力に対応する自己検査
      initialSelfCheck: firstCheck,
      repairedSelfCheck,
      repaired,
      repairReason,
      finalCheck,
      deterministic,
    },
  };
}
