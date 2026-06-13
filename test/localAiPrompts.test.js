import { describe, it, expect } from "vitest";
import { buildPrompt, LOCAL_AI_TASKS } from "../src/features/localAi/localAiPrompts.js";

describe("localAiPrompts", () => {
  it("includes the common safety preamble in every task", () => {
    for (const t of Object.values(LOCAL_AI_TASKS)) {
      const { system } = buildPrompt(t, { input: "x", context: {} });
      expect(system).toContain("Oriex専用の学習支援AI");
      expect(system).toContain("入力された情報だけ");
    }
  });

  it("vocab quiz forbids out-of-range words and same-list distractors (JSON task)", () => {
    const { system, prompt, format } = buildPrompt(LOCAL_AI_TASKS.VOCAB_QUIZ, {
      input: "apple, りんご",
      context: { count: 5 },
    });
    expect(format).toBe("json");
    const all = system + "\n" + prompt;
    expect(all).toContain("リストに無い単語");
    expect(all).toContain("同じリスト内");
  });

  it("PDF task requires using only the PDF content", () => {
    const { system } = buildPrompt(LOCAL_AI_TASKS.PDF_QUESTION_GENERATION, { input: "...", context: {} });
    expect(system).toContain("このPDFの内容だけ");
  });

  it("report cleanup is a free-text task", () => {
    const { format } = buildPrompt(LOCAL_AI_TASKS.REPORT_CLEANUP, { input: "メモ", context: {} });
    expect(format).toBe("text");
  });
});
