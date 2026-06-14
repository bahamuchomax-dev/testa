import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const APP = readFileSync("src/App.jsx", "utf8");
const MAIN = readFileSync("src/main.js", "utf8");
const TEACHER = readFileSync("src/features/teacher/TeacherProblems.jsx", "utf8");

describe("App shell — TeacherProblems routing (option A: shell unmounted)", () => {
  it("has a teacher branch but it is documented as intentionally not routed", () => {
    expect(APP).toMatch(/tab === "teacher"/);
    expect(APP).toContain("TODO(react-shell)");
  });

  it("does NOT expose a teacher tab in TABS (no ungated nav entry)", () => {
    // The TABS array must not contain a teacher entry under option A.
    const tabsBlock = (APP.match(/const TABS = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(tabsBlock).not.toMatch(/id:\s*["']teacher["']/);
  });

  it("notes that adding the tab later must be gated by isTeacher", () => {
    expect(APP).toMatch(/isTeacher/); // the TODO explains the future guard
  });
});

describe("TeacherProblems — non-teacher guard", () => {
  it("hides teacher UI from non-teachers and guards actions", () => {
    expect(TEACHER).toMatch(/isTeacher\s*\(/); // UI gate
    expect(TEACHER).toMatch(/assertTeacher\s*\(/); // action gate
  });
});

describe("React shell is not yet live (legacy bundle is the entry)", () => {
  it("main.js boots the legacy bundle", () => {
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
  });

  it("main.js does NOT mount App.jsx", () => {
    expect(MAIN).not.toMatch(/from\s+["']\.\/App(\.jsx)?["']/);
    expect(MAIN).not.toMatch(/\bimport\s+App\b/);
  });
});
