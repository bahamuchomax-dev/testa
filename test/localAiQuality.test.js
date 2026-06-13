import { describe, it, expect, vi } from "vitest";
import {
  buildFinalCheck,
  generateStrictJsonWithQuality,
  shouldRepair,
} from "../src/features/localAi/localAiQuality.js";
import { LOCAL_AI_TASKS } from "../src/features/localAi/localAiPrompts.js";

const schema = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
};

function check({ ok = true, score = 90, issues = [], warnings = [], mustFix = [], summary = "ok" } = {}) {
  return { ok, score, issues, warnings, mustFix, summary };
}

describe("localAiQuality", () => {
  it("requires repair when score is below 85", () => {
    expect(shouldRepair(check({ score: 84 }))).toBe(true);
  });

  it("requires repair when ok is false", () => {
    expect(shouldRepair(check({ ok: false, score: 99 }))).toBe(true);
  });

  it("does not repair when ok is true and score is at least 85", () => {
    expect(shouldRepair(check({ ok: true, score: 85 }))).toBe(false);
  });

  it("stops repair generation after one retry", async () => {
    let generationCalls = 0;
    let repairCalls = 0;
    let selfCheckCalls = 0;
    const deps = {
      generateWithLocalAi: vi.fn(),
      generateJsonWithLocalAi: vi.fn(async ({ input, schema: requestedSchema }) => {
        if (requestedSchema && requestedSchema.required?.includes("ok")) {
          selfCheckCalls += 1;
          return {
            ok: true,
            data: check({
              ok: false,
              score: selfCheckCalls === 1 ? 50 : 40,
              mustFix: ["入力にない事実があります"],
            }),
            text: "{}",
          };
        }
        if (String(input).includes("入力にない事実を削除してください。")) repairCalls += 1;
        else generationCalls += 1;
        return { ok: true, data: { answer: "fixed" }, text: '{"answer":"fixed"}' };
      }),
    };

    const result = await generateStrictJsonWithQuality(
      {
        taskType: LOCAL_AI_TASKS.REVIEW_PLAN,
        input: "source only",
        schema,
      },
      deps
    );

    expect(generationCalls).toBe(1);
    expect(repairCalls).toBe(1);
    expect(selfCheckCalls).toBe(2);
    expect(result.quality.repaired).toBe(true);
    expect(result.data).toEqual({ answer: "fixed" });
  });

  it("returns usable final check", () => {
    expect(buildFinalCheck(check({ ok: true, score: 92 })).status).toBe("usable");
  });

  it("returns caution final check", () => {
    expect(buildFinalCheck(check({ ok: true, score: 80, warnings: ["確認が必要"] })).status).toBe("caution");
  });

  it("returns blocked final check for major issues", () => {
    expect(
      buildFinalCheck(check({ ok: false, score: 90, mustFix: ["医療診断のような表現があります"] })).status
    ).toBe("blocked");
  });

  it("returns flat selfCheck/finalCheck and skips repair when the first output is clean", async () => {
    let genCalls = 0;
    let selfChecks = 0;
    const deps = {
      generateWithLocalAi: vi.fn(),
      generateJsonWithLocalAi: vi.fn(async ({ schema: requestedSchema }) => {
        if (requestedSchema && requestedSchema.required?.includes("ok")) {
          selfChecks += 1;
          return {
            ok: true,
            data: check({ ok: true, score: 95, summary: "入力情報に基づいています。" }),
            text: "{}",
          };
        }
        genCalls += 1;
        return { ok: true, data: { answer: "clean" }, text: '{"answer":"clean"}' };
      }),
    };

    const result = await generateStrictJsonWithQuality(
      { taskType: LOCAL_AI_TASKS.REVIEW_PLAN, input: "source only", schema },
      deps
    );

    expect(genCalls).toBe(1); // 修正生成は呼ばれない
    expect(selfChecks).toBe(1); // 自己検査は1回だけ
    expect(result.repaired).toBe(false);
    expect(result.repairedSelfCheck).toBeNull();
    expect(result.selfCheck.score).toBe(95);
    expect(result.finalCheck.status).toBe("usable");
    expect(result.data).toEqual({ answer: "clean" });
  });

  it("exposes initial and post-repair self-checks when repaired", async () => {
    let selfChecks = 0;
    const deps = {
      generateWithLocalAi: vi.fn(),
      generateJsonWithLocalAi: vi.fn(async ({ input, schema: requestedSchema }) => {
        if (requestedSchema && requestedSchema.required?.includes("ok")) {
          selfChecks += 1;
          return selfChecks === 1
            ? {
                ok: true,
                data: check({ ok: false, score: 60, mustFix: ["入力にない事実があります"], summary: "初回NG" }),
                text: "{}",
              }
            : { ok: true, data: check({ ok: true, score: 90, summary: "修正後は根拠に沿っています。" }), text: "{}" };
        }
        const fixed = String(input).includes("入力にない事実を削除してください。");
        return { ok: true, data: { answer: fixed ? "fixed" : "first" }, text: "{}" };
      }),
    };

    const result = await generateStrictJsonWithQuality(
      { taskType: LOCAL_AI_TASKS.STUDENT_SUMMARY, input: "source only", schema },
      deps
    );

    expect(result.repaired).toBe(true);
    expect(result.selfCheck.score).toBe(60); // 初回
    expect(result.repairedSelfCheck.score).toBe(90); // 修正後
    expect(result.finalCheck.status).toBe("usable"); // 最終は修正後の自己検査を反映
    expect(result.quality.repairReason).toContain("入力にない事実");
    expect(result.data).toEqual({ answer: "fixed" });
  });
});
