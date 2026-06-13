import { describe, it, expect } from "vitest";
import {
  qualityStatusLabel,
  formatBodyOnly,
  formatWithDetails,
  formatPdfEvidence,
  describeBlockedQuestions,
  findingsForQuestion,
  qualityBlockText,
} from "../src/features/localAi/utils/localAiFormatters.js";
import { LOCAL_AI_TASKS } from "../src/features/localAi/localAiPrompts.js";

const reviewData = {
  priority: [{ level: "高", item: "二次関数", reason: "理解が浅い" }],
  tomorrowTasks: ["二次関数の復習"],
  threeDayReview: ["一次関数"],
  teacherNote: "計算ミスが多い。",
  studentMessage: "よく頑張りました。",
};
const quality = {
  finalCheck: { score: 92, status: "usable", warnings: [], summary: "使用可能です。" },
  selfCheck: { ok: true, score: 92, issues: [], warnings: [], mustFix: [], summary: "入力に基づいています。" },
  repaired: false,
  deterministic: { ok: true, issues: [], warnings: [], blockedQuestionNumbers: [], scorePenalty: 0 },
};

const quizData = {
  items: [{ no: 1, format: "choice", question: "apple?", choices: ["りんご", "走る"], answer: "りんご", explanation: "果物" }],
};

const pdfData = {
  sourceSummary: "光合成の説明。",
  questions: [
    { no: 1, question: "光合成とは？", choices: ["A", "B"], answer: "A", sourcePage: 5, sourceQuote: "光合成は植物が光を使う" },
    { no: 2, question: "別の問い", answer: "B" },
  ],
};
const pdfQuality = {
  finalCheck: { score: 80, status: "caution", warnings: [], summary: "注意" },
  selfCheck: { summary: "ok", issues: [], warnings: [], mustFix: [] },
  repaired: false,
  deterministic: { ok: false, issues: ["2問目の sourceQuote が空です。"], warnings: [], blockedQuestionNumbers: [2], scorePenalty: 20 },
};

describe("qualityStatusLabel", () => {
  it("maps each status to its Japanese label", () => {
    expect(qualityStatusLabel("usable")).toBe("使用可能");
    expect(qualityStatusLabel("caution")).toBe("使用注意");
    expect(qualityStatusLabel("blocked")).toBe("使用不可");
    expect(qualityStatusLabel("???")).toBe("使用注意");
  });
});

describe("body-only vs detailed copy", () => {
  it("body-only copy does NOT contain quality information", () => {
    const body = formatBodyOnly(LOCAL_AI_TASKS.REVIEW_PLAN, { data: reviewData, quality });
    expect(body).toContain("二次関数");
    expect(body).not.toContain("品質チェック");
    expect(body).not.toContain("決定的チェック");
  });

  it("detailed copy DOES contain quality information", () => {
    const detailed = formatWithDetails(LOCAL_AI_TASKS.REVIEW_PLAN, { data: reviewData, quality });
    expect(detailed).toContain("二次関数");
    expect(detailed).toContain("品質チェック");
    expect(detailed).toContain("決定的チェック");
  });

  it("quiz body-only omits answers; detailed includes them", () => {
    const body = formatBodyOnly(LOCAL_AI_TASKS.VOCAB_QUIZ, { data: quizData, quality });
    const detailed = formatWithDetails(LOCAL_AI_TASKS.VOCAB_QUIZ, { data: quizData, quality });
    expect(body).not.toContain("【解答】");
    expect(detailed).toContain("【解答】");
  });

  it("falls back to plain text when the schema is broken (no data)", () => {
    const body = formatBodyOnly(LOCAL_AI_TASKS.VOCAB_QUIZ, { data: null, text: "プレーンテキスト出力" });
    expect(body).toBe("プレーンテキスト出力");
    const detailed = formatWithDetails(LOCAL_AI_TASKS.REPORT_CLEANUP, { data: null, text: "報告書本文です。", quality });
    expect(detailed).toContain("報告書本文です。");
    expect(detailed).toContain("品質チェック");
  });
});

describe("PDF evidence formatting", () => {
  it("formats sourcePage and sourceQuote", () => {
    const ev = formatPdfEvidence(pdfData.questions[0]);
    expect(ev).toContain("根拠: p.5");
    expect(ev).toContain("「光合成は植物が光を使う」");
  });

  it("returns empty string when neither is present", () => {
    expect(formatPdfEvidence({ question: "x" })).toBe("");
  });

  it("detailed PDF copy includes evidence and a shortage note for blocked questions", () => {
    const detailed = formatWithDetails(LOCAL_AI_TASKS.PDF_QUESTION_GENERATION, { data: pdfData, quality: pdfQuality });
    expect(detailed).toContain("【根拠】");
    expect(detailed).toContain("p.5");
    expect(detailed).toContain("根拠が不足している可能性があります");
    expect(detailed).toContain("2問目の sourceQuote が空です。");
  });
});

describe("blocked questions + per-question findings", () => {
  it("describes blocked question numbers for display", () => {
    expect(describeBlockedQuestions([1, 3])).toBe("1、3問目");
    expect(describeBlockedQuestions([])).toBe("");
    expect(describeBlockedQuestions(null)).toBe("");
  });

  it("extracts findings tied to a specific question number", () => {
    expect(findingsForQuestion(pdfQuality, 2)).toEqual(["2問目の sourceQuote が空です。"]);
    expect(findingsForQuestion(pdfQuality, 1)).toEqual([]);
  });
});

describe("qualityBlockText", () => {
  it("renders score, status, self-check, repair and deterministic lines", () => {
    const t = qualityBlockText(quality);
    expect(t).toContain("品質チェック: 92 / 100");
    expect(t).toContain("状態: 使用可能");
    expect(t).toContain("修正生成: なし");
    expect(t).toContain("決定的チェック:");
    expect(t).toContain("問題は見つかりませんでした");
  });

  it("returns empty string without quality", () => {
    expect(qualityBlockText(null)).toBe("");
  });
});
