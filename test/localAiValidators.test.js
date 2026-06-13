import { describe, it, expect, vi } from "vitest";
import {
  validateVocabQuiz,
  validatePdfQuestions,
  validateReportCleanup,
  validateStudentSummary,
  validateReviewPlan,
  runTaskValidator,
  applyValidatorToFinalCheck,
} from "../src/features/localAi/localAiValidators.js";
import { generateStrictJsonWithQuality } from "../src/features/localAi/localAiQuality.js";
import { LOCAL_AI_TASKS } from "../src/features/localAi/localAiPrompts.js";
import { vocabQuizSchema } from "../src/features/localAi/localAiSchemas.js";

const WORDS = "apple, りんご, 名詞\nrun, 走る, 動詞";

describe("validateVocabQuiz", () => {
  it("detects an out-of-range word in the choices", () => {
    const quiz = {
      items: [
        { no: 1, format: "choice", question: "apple?", choices: ["りんご", "走る", "banana"], answer: "りんご" },
      ],
    };
    const r = validateVocabQuiz(quiz, WORDS);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("範囲外");
    expect(r.blockedQuestionNumbers).toContain(1);
    expect(r.scorePenalty).toBeGreaterThan(0);
  });

  it("detects duplicate choices", () => {
    const quiz = { items: [{ no: 1, format: "choice", question: "q", choices: ["a", "a", "b"], answer: "a" }] };
    const r = validateVocabQuiz(quiz, []); // no word list -> skip range checks
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("重複");
  });

  it("detects answerKey/questions count mismatch", () => {
    const quiz = {
      items: [
        { no: 1, question: "q1", answer: "x" },
        { no: 2, question: "q2", answer: "y" },
      ],
      answerKey: ["x"],
    };
    const r = validateVocabQuiz(quiz, []);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("一致していません");
  });

  it("passes a clean in-range quiz", () => {
    const quiz = {
      items: [{ no: 1, format: "choice", question: "apple?", choices: ["りんご", "走る"], answer: "りんご" }],
    };
    const r = validateVocabQuiz(quiz, WORDS);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("skips when the object is not a quiz shape (protects other tasks)", () => {
    expect(validateVocabQuiz({ answer: "x" }, WORDS).ok).toBe(true);
  });
});

describe("validatePdfQuestions", () => {
  const pages = [{ page: 1, text: "光合成は植物が光を使って栄養を作る仕組みです。" }];

  it("detects an empty sourceQuote", () => {
    const result = { sourceSummary: "s", questions: [{ no: 1, question: "q", answer: "a", sourcePage: 1, sourceQuote: "" }] };
    const r = validatePdfQuestions(result, pages);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("sourceQuote が空");
    expect(r.blockedQuestionNumbers).toContain(1);
  });

  it("detects a sourcePage outside the extracted range", () => {
    const result = { sourceSummary: "s", questions: [{ no: 1, question: "q", sourcePage: 5, sourceQuote: "光合成は植物" }] };
    const r = validatePdfQuestions(result, pages);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("範囲外");
    expect(r.blockedQuestionNumbers).toContain(1);
  });

  it("detects a sourceQuote that is not present in the body text", () => {
    const result = {
      sourceSummary: "s",
      questions: [{ no: 2, question: "q", sourcePage: 1, sourceQuote: "徳川家康は幕府を開いた" }],
    };
    const r = validatePdfQuestions(result, pages);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("本文中に見つかりません");
    expect(r.blockedQuestionNumbers).toContain(2);
  });

  it("absorbs whitespace/newline differences when matching the quote", () => {
    const wsPages = [{ page: 1, text: "光合成は\n植物が光を使う" }];
    const result = {
      sourceSummary: "s",
      questions: [{ no: 1, question: "q", answer: "a", sourcePage: 1, sourceQuote: "光合成は 植物が 光を使う" }],
    };
    expect(validatePdfQuestions(result, wsPages).ok).toBe(true);
  });
});

describe("validateReportCleanup", () => {
  it("detects a score that is not in the input", () => {
    const r = validateReportCleanup(
      "今回のテストは90点でした。次回も一緒に頑張りましょう。",
      "授業で二次関数を扱った。宿題はプリント。"
    );
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("入力にない点数");
  });

  it("does not flag a score that is present in the input", () => {
    const r = validateReportCleanup("テストは80点でした。", "小テスト 80点 / 二次関数");
    expect(r.ok).toBe(true);
  });

  it("flags persona evaluation language", () => {
    const r = validateReportCleanup("お子さんはやる気がないようです。", "授業の様子");
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("人格");
  });
});

describe("validateStudentSummary", () => {
  it("detects persona-negation expressions", () => {
    const r = validateStudentSummary({
      current: "最近は集中できている。",
      strengths: [],
      issues: ["やる気がない"],
      nextFocus: [],
    });
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("人格");
  });

  it("warns when inferences are over-asserted", () => {
    const r = validateStudentSummary({ current: "x", facts: ["小テスト実施"], inferences: ["絶対に伸びる"] });
    expect(r.warnings.join("\n")).toContain("断定");
  });

  it("skips when the object is not a summary shape", () => {
    expect(validateStudentSummary({ answer: "fixed" }).ok).toBe(true);
  });
});

describe("validateReviewPlan", () => {
  it("detects a missing required section", () => {
    const r = validateReviewPlan({
      priority: [{ level: "高", item: "二次関数", reason: "理解が浅い" }],
      threeDayReview: ["復習"],
    });
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("明日やること");
  });

  it("passes a well-formed plan", () => {
    const r = validateReviewPlan({
      priority: [{ level: "高", item: "二次関数", reason: "理解が浅い" }],
      tomorrowTasks: ["二次関数の復習"],
      threeDayReview: ["一次関数"],
      quizCandidates: ["二次関数の小テスト"],
    });
    expect(r.ok).toBe(true);
  });

  it("skips when the object is not a review-plan shape", () => {
    expect(validateReviewPlan({ answer: "clean" }).ok).toBe(true);
  });
});

describe("applyValidatorToFinalCheck", () => {
  it("downgrades a usable finalCheck to blocked on a major validator issue", () => {
    const usable = { score: 92, status: "usable", warnings: [], summary: "使用可能です。" };
    const validator = {
      ok: false,
      issues: ["1問目の選択肢に範囲外の単語があります: banana"],
      warnings: [],
      blockedQuestionNumbers: [1],
      scorePenalty: 20,
    };
    const merged = applyValidatorToFinalCheck(usable, validator);
    expect(merged.status).toBe("blocked");
    expect(merged.warnings.join("\n")).toContain("範囲外");
    expect(merged.score).toBe(72);
  });

  it("downgrades usable to caution on validator warnings only", () => {
    const merged = applyValidatorToFinalCheck(
      { score: 90, status: "usable", warnings: [], summary: "使用可能です。" },
      { ok: true, issues: [], warnings: ["問題数が単語数より多くなっています。"], blockedQuestionNumbers: [], scorePenalty: 5 }
    );
    expect(merged.status).toBe("caution");
    expect(merged.score).toBe(85);
  });

  it("never upgrades a blocked finalCheck", () => {
    const merged = applyValidatorToFinalCheck(
      { score: 50, status: "blocked", warnings: [], summary: "停止" },
      { ok: true, issues: [], warnings: [], blockedQuestionNumbers: [], scorePenalty: 0 }
    );
    expect(merged.status).toBe("blocked");
  });
});

describe("runTaskValidator + integration", () => {
  it("routes by taskType and returns ok for tasks without a validator", () => {
    expect(runTaskValidator({ taskType: LOCAL_AI_TASKS.HEALTH_TEST, output: {}, input: "" }).ok).toBe(true);
  });

  it("reflects the validator result into finalCheck via generateStrictJsonWithQuality", async () => {
    const deps = {
      generateWithLocalAi: vi.fn(),
      generateJsonWithLocalAi: vi.fn(async ({ schema: requestedSchema }) => {
        if (requestedSchema && requestedSchema.required?.includes("ok")) {
          // self-check passes cleanly, so only the deterministic validator can downgrade.
          return {
            ok: true,
            data: { ok: true, score: 95, issues: [], warnings: [], mustFix: [], summary: "OK" },
            text: "{}",
          };
        }
        // main generation returns a quiz containing an out-of-range choice.
        return {
          ok: true,
          data: { items: [{ no: 1, format: "choice", question: "apple?", choices: ["りんご", "走る", "banana"], answer: "りんご" }] },
          text: "{}",
        };
      }),
    };

    const result = await generateStrictJsonWithQuality(
      { taskType: LOCAL_AI_TASKS.VOCAB_QUIZ, input: WORDS, schema: vocabQuizSchema },
      deps
    );

    expect(result.repaired).toBe(false); // self-check was clean → no repair
    expect(result.deterministicCheck.ok).toBe(false); // validator caught the range-out word
    expect(result.finalCheck.status).toBe("blocked"); // reflected into finalCheck
    expect(result.finalCheck.warnings.join("\n")).toContain("範囲外");
  });
});
