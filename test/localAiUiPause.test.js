import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const MAIN = readFileSync("src/main.js", "utf8");
const APP = readFileSync("src/App.jsx", "utf8");
const FLAG = readFileSync("src/features/localAi/uiFlag.js", "utf8");

describe("local AI UI is temporarily paused", () => {
  it("keeps the pause flag off by default", () => {
    expect(FLAG).toMatch(/LOCAL_AI_UI_ENABLED\s*=\s*false/);
  });

  it("does not statically import or directly call the sidecar from main.js", () => {
    expect(MAIN).not.toMatch(/import\s+\{\s*mountLocalAiSidecar\s*\}/);
    expect(MAIN).not.toMatch(/\bmountLocalAiSidecar\s*\(\s*\)/);
    expect(MAIN).toContain("LOCAL_AI_UI_ENABLED");
  });

  it("keeps local AI out of App.jsx tab navigation", () => {
    const tabsBlock = (APP.match(/const TABS = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(tabsBlock).not.toMatch(/id:\s*["']localai["']/);
    expect(tabsBlock).not.toMatch(/label:\s*["']AI["']/);
  });

  it("keeps the local AI source in place for future re-enable", () => {
    expect(existsSync("src/features/localAi/index.jsx")).toBe(true);
    expect(existsSync("src/features/localAi/localAiClient.js")).toBe(true);
    expect(existsSync("src/features/localAi/LocalAiPage.jsx")).toBe(true);
  });
});
