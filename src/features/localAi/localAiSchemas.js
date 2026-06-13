/* ============================================================
 * localAiSchemas — output shapes + tolerant JSON handling
 * ------------------------------------------------------------
 * Local models often wrap JSON in prose or code fences, or emit
 * trailing commas. extractJson() recovers the JSON when it can;
 * validateRequired() does a shallow "are the keys I need present"
 * check so the panel can decide between structured vs plain-text
 * rendering. Neither throws — callers always get a result object.
 *
 * This module is pure (no network, no DOM) so it is easy to test.
 * ============================================================ */

function parseCandidate(str) {
  const tryParse = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };
  const parsed = tryParse(str);
  if (parsed !== null) return parsed;
  return tryParse(str.replace(/,\s*([}\]])/g, "$1"));
}

export function parseJsonLenient(text) {
  if (typeof text !== "string") return null;
  const s = text.trim();

  const direct = parseCandidate(s);
  if (direct !== null) return direct;

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const fenced = parseCandidate(fence[1].trim());
    if (fenced !== null) return fenced;
  }

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    const obj = parseCandidate(s.slice(objStart, objEnd + 1));
    if (obj !== null) return obj;
  }

  const arrStart = s.indexOf("[");
  const arrEnd = s.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    const arr = parseCandidate(s.slice(arrStart, arrEnd + 1));
    if (arr !== null) return arr;
  }

  return null;
}

/* Pull a JSON value out of a model response. Returns { ok, data }. */
export function extractJson(text) {
  const data = parseJsonLenient(text);
  return data === null ? { ok: false } : { ok: true, data };
}

/* Shallow presence check against a schema's `required` list. */
export function validateRequired(data, schema) {
  if (!schema || typeof schema !== "object") return { ok: true };
  if (schema.type === "array") {
    return Array.isArray(data) ? { ok: true } : { ok: false, error: "配列が必要です" };
  }
  if (schema.type === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "オブジェクトが必要です" };
    }
    for (const key of schema.required || []) {
      if (!(key in data)) return { ok: false, error: `項目が不足: ${key}` };
    }
  }
  return { ok: true };
}

/* ---- A. 復習提案 ---- */
export const reviewPlanSchema = {
  type: "object",
  properties: {
    priority: {
      type: "array",
      items: {
        type: "object",
        properties: {
          level: { type: "string" }, // 高 / 中 / 低
          item: { type: "string" },
          reason: { type: "string" },
        },
        required: ["level", "item", "reason"],
      },
    },
    tomorrowTasks: { type: "array", items: { type: "string" } },
    threeDayReview: { type: "array", items: { type: "string" } },
    weakUnits: { type: "array", items: { type: "string" } },
    quizCandidates: { type: "array", items: { type: "string" } },
    teacherNote: { type: "string" },
    studentMessage: { type: "string" },
  },
  required: ["priority", "tomorrowTasks", "teacherNote", "studentMessage"],
};

/* ---- C. 単語小テスト ---- */
export const vocabQuizSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "number" },
          format: { type: "string" }, // en2ja / ja2en / choice / cloze / sentence
          question: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["question", "answer"],
      },
    },
  },
  required: ["items"],
};

/* ---- D. 生徒カルテ要約 ---- */
export const studentSummarySchema = {
  type: "object",
  properties: {
    current: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
    nextFocus: { type: "array", items: { type: "string" } },
    forGuardian: { type: "string" },
    teacherOnlyNote: { type: "string" },
    nextAction: { type: "string" },
  },
  required: ["current", "strengths", "issues", "nextFocus"],
};

/* ---- E. PDF教材から問題作成 ---- */
export const pdfQuestionsSchema = {
  type: "object",
  properties: {
    sourceSummary: { type: "string" }, // 根拠にした本文の要約
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "number" },
          format: { type: "string" },
          question: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          sourcePage: { type: "number" }, // 根拠にしたページ番号（v5-3 検査用）
          sourceQuote: { type: "string" }, // 本文からの根拠引用（v5-3 検査用）
        },
        required: ["question"],
      },
    },
  },
  required: ["sourceSummary", "questions"],
};
