import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as recordsRepo from "../src/services/repository/recordsRepository.js";
import { RECORDS_SUBJECT_MAX_LENGTH } from "../src/services/repository/recordsRepository.js";

const RECORDS_PATH = "src/features/records/Records.jsx";
const RECORDS = readFileSync(RECORDS_PATH, "utf8");
const RECORDS_REPOSITORY = readFileSync("src/services/repository/recordsRepository.js", "utf8");
const APP = readFileSync("src/App.jsx", "utf8");
const MAIN = readFileSync("src/main.js", "utf8");
const LOCAL_AI_FLAG = readFileSync("src/features/localAi/uiFlag.js", "utf8");
const PLAN = readFileSync("docs/REACT_MIGRATION_PLAN.md", "utf8");

/* ------------------------------------------------------------------
 * Static guards: phase 3 hardens the Records scaffold WITHOUT putting it
 * on a production route. These assertions lock the safety invariants.
 * ------------------------------------------------------------------ */
describe("React Records migration phase 3 — static guards", () => {
  it("keeps the Records scaffold present and documented as phase 3", () => {
    expect(existsSync(RECORDS_PATH)).toBe(true);
    expect(RECORDS).toContain("Records");
    expect(RECORDS).toContain("React migration phase 3");
    expect(PLAN).toContain("Phase 3 Records Minimal Hardening");
    // history section retained
    expect(PLAN).toContain("Phase 2 Records Inventory");
  });

  it("keeps main.js on the legacy entry instead of App.jsx", () => {
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
    expect(MAIN).not.toMatch(/from\s+["']\.\/App(\.jsx)?["']/);
    expect(MAIN).not.toMatch(/createRoot\(/);
  });

  it("does not expose Records as a production tab yet", () => {
    const tabsBlock = (APP.match(/const TABS = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(APP).toContain('tab === "records"');
    expect(APP).toContain('"records" is reached from Home');
    expect(tabsBlock).not.toMatch(/id:\s*["']records["']/);
    expect(tabsBlock).not.toMatch(/Records|学習記録|記録/);
  });

  it("keeps Records rendering free of dangerous HTML sinks", () => {
    expect(RECORDS).not.toContain("dangerouslySetInnerHTML");
    expect(RECORDS).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);
    // text rendered with React {…} expressions, not raw HTML.
    expect(RECORDS).toContain('{r.subject || "学習"}');
  });

  it("sanitizes + clamps the free-text subject in the repository", () => {
    expect(RECORDS_REPOSITORY).toContain("sanitizePlainText");
    expect(RECORDS_REPOSITORY).toContain("RECORDS_SUBJECT_MAX_LENGTH = 80");
    // sanitize call applies the shared clamp + trim before persisting.
    expect(RECORDS_REPOSITORY).toMatch(
      /sanitizePlainText\(\s*input\?\.subject[^)]*maxLength:\s*RECORDS_SUBJECT_MAX_LENGTH/,
    );
  });

  it("puts a subject input maxLength on the screen that matches the repository clamp", () => {
    expect(RECORDS).toMatch(/maxLength=\{records\.RECORDS_SUBJECT_MAX_LENGTH\}/);
    // the exported value the input uses must equal the documented 80.
    expect(RECORDS_SUBJECT_MAX_LENGTH).toBe(80);
    expect(PLAN).toContain("subject` is free text");
    expect(PLAN).toContain("maxLength of 80");
  });

  it("keeps current Records storage behind the repository layer with a uid guard", () => {
    expect(RECORDS).toContain("records.add");
    expect(RECORDS).toContain("records.list");
    expect(RECORDS).toContain("records.remove");
    // no-uid -> no write guard in the screen
    expect(RECORDS).toContain("if (!recordUid)");
    // repository pins writes to the current user and uses the scoped ls key
    expect(RECORDS_REPOSITORY).toContain("assertOwnUid");
    expect(RECORDS_REPOSITORY).toContain("lsKey.records");
    expect(RECORDS_REPOSITORY).toContain("parsePositiveMinutes");
    // Firestore migration TODO retained for a later phase
    expect(RECORDS_REPOSITORY).toContain("TODO(firestore)");
  });

  it("does not write Records directly to localStorage from the screen", () => {
    expect(RECORDS).not.toMatch(/localStorage\s*\./);
  });

  it("keeps Local AI UI paused", () => {
    const tabsBlock = (APP.match(/const TABS = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(LOCAL_AI_FLAG).toMatch(/LOCAL_AI_UI_ENABLED\s*=\s*false/);
    expect(MAIN).toContain("LOCAL_AI_UI_ENABLED");
    expect(tabsBlock).not.toMatch(/localai/i);
    expect(existsSync("src/features/localAi/LocalAiPage.jsx")).toBe(true);
  });
});

/* ------------------------------------------------------------------
 * Behavioural unit tests for recordsRepository sanitize/validation.
 * Test env is node, so we stub a minimal localStorage and window.__oxUid
 * (currentUid() reads window.__oxUid, otherwise falls back to "local").
 * ------------------------------------------------------------------ */
function makeFakeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

describe("recordsRepository — subject sanitize & validation", () => {
  let prevWindow;
  let prevLocalStorage;

  beforeEach(() => {
    prevWindow = globalThis.window;
    prevLocalStorage = globalThis.localStorage;
    globalThis.localStorage = makeFakeLocalStorage();
    globalThis.window = { __oxUid: "user_a" };
  });

  afterEach(() => {
    globalThis.window = prevWindow;
    globalThis.localStorage = prevLocalStorage;
  });

  it("strips <script> from the saved subject value", () => {
    const res = recordsRepo.add("user_a", { minutes: 30, subject: "<script>alert(1)</script>英語" });
    expect(res.ok).toBe(true);
    expect(res.record.subject).not.toContain("<script>");
    expect(res.record.subject).not.toContain("</script>");
    // the safe Japanese text survives
    expect(res.record.subject).toContain("英語");
  });

  it("drops an <img onerror> payload so no tag is persisted", () => {
    const res = recordsRepo.add("user_a", { minutes: 10, subject: '<img src=x onerror=alert(1)>数学' });
    expect(res.ok).toBe(true);
    expect(res.record.subject).not.toMatch(/<img/i);
    expect(res.record.subject).not.toMatch(/onerror/i);
    expect(res.record.subject).toContain("数学");
  });

  it("does not persist a javascript: scheme in the subject", () => {
    const res = recordsRepo.add("user_a", { minutes: 5, subject: "javascript:alert(1) 国語" });
    expect(res.ok).toBe(true);
    expect(res.record.subject).not.toMatch(/javascript:/i);
    expect(res.record.subject).toContain("国語");
  });

  it("preserves normal Japanese and line breaks", () => {
    const res = recordsRepo.add("user_a", { minutes: 45, subject: "英語\n長文読解" });
    expect(res.ok).toBe(true);
    expect(res.record.subject).toBe("英語\n長文読解");
  });

  it("clamps an over-long subject to the max length", () => {
    const long = "あ".repeat(500);
    const res = recordsRepo.add("user_a", { minutes: 20, subject: long });
    expect(res.ok).toBe(true);
    expect(res.record.subject.length).toBe(RECORDS_SUBJECT_MAX_LENGTH);
  });

  it("stores a whitespace-only subject as the empty safe default", () => {
    const res = recordsRepo.add("user_a", { minutes: 15, subject: "   \n\t  " });
    expect(res.ok).toBe(true);
    expect(res.record.subject).toBe("");
  });

  it("rejects sub-minute / invalid minutes without writing a row", () => {
    expect(recordsRepo.add("user_a", { minutes: 0, subject: "英語" }).ok).toBe(false);
    expect(recordsRepo.add("user_a", { minutes: 0.4, subject: "英語" }).ok).toBe(false);
    expect(recordsRepo.add("user_a", { minutes: "abc", subject: "英語" }).ok).toBe(false);
    expect(recordsRepo.list("user_a")).toHaveLength(0);
  });

  it("pins writes to the signed-in uid even if another uid is passed", () => {
    // currentUid() is user_a; a passed-in other uid must be ignored.
    const res = recordsRepo.add("user_b", { minutes: 30, subject: "理科" });
    expect(res.ok).toBe(true);
    // saved under user_a's key, not user_b's
    expect(recordsRepo.list("user_a")).toHaveLength(1);
    const otherKey = "oriex:v1:records:user_b";
    expect(globalThis.localStorage.getItem(otherKey)).toBeNull();
  });

  it("never persists raw HTML to localStorage", () => {
    recordsRepo.add("user_a", { minutes: 30, subject: "<script>alert(1)</script>" });
    const raw = globalThis.localStorage.getItem("oriex:v1:records:user_a") || "";
    expect(raw).not.toMatch(/<script/i);
  });

  it("removes through the repository and keeps rows uid-scoped", () => {
    const a = recordsRepo.add("user_a", { minutes: 30, subject: "英語" });
    expect(recordsRepo.list("user_a")).toHaveLength(1);
    recordsRepo.remove("user_a", a.record.id);
    expect(recordsRepo.list("user_a")).toHaveLength(0);
  });
});
