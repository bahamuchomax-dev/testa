import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const MAIN = readFileSync("src/main.js", "utf8");
const APP = readFileSync("src/App.jsx", "utf8");
const PLAN_PATH = "docs/REACT_MIGRATION_PLAN.md";
const PLAN = readFileSync(PLAN_PATH, "utf8");
const LOCAL_AI_FLAG = readFileSync("src/features/localAi/uiFlag.js", "utf8");

describe("React migration phase 0", () => {
  it("keeps main.js on the legacy entry instead of App.jsx", () => {
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
    expect(MAIN).not.toMatch(/from\s+["']\.\/App(\.jsx)?["']/);
    expect(MAIN).not.toMatch(/createRoot\(/);
  });

  it("marks App.jsx as a migration scaffold", () => {
    expect(APP).toContain("React migration scaffold");
    expect(APP).toMatch(/not yet mounted/i);
    expect(APP).toContain("docs/REACT_MIGRATION_PLAN.md");
  });

  it("documents the migration plan and order", () => {
    expect(existsSync(PLAN_PATH)).toBe(true);
    const ordered = [
      "1. Profile",
      "2. Records / learning records",
      "3. Review",
      "4. Factory / small tests",
      "5. TeacherProblems",
      "6. Home / subject cards",
      "8. Legacy bundle removal",
    ];
    for (const item of ordered) expect(PLAN).toContain(item);
  });

  it("documents that the legacy bundle is not directly edited", () => {
    expect(PLAN).toContain("Do not edit `src/legacy/oriex-app.bundle.js` directly.");
    expect(PLAN).toContain("src/legacy/oriex-app.bundle.js` remains frozen");
  });

  it("keeps the local AI UI pause in place", () => {
    const tabsBlock = (APP.match(/const TABS = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(LOCAL_AI_FLAG).toMatch(/LOCAL_AI_UI_ENABLED\s*=\s*false/);
    expect(MAIN).toContain("LOCAL_AI_UI_ENABLED");
    expect(tabsBlock).not.toMatch(/localai/i);
    expect(existsSync("src/features/localAi/LocalAiPage.jsx")).toBe(true);
  });
});
