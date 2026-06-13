import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  PRIVILEGED_FIELDS,
  isTeacher,
  isAdmin,
  assertTeacher,
  assertOwnUid,
  hasPrivilegedFields,
  sanitizeProfileUpdate,
} from "../src/services/firebase/authz.js";
import {
  buildRecordsQuery,
  buildBookLogsQuery,
  buildStudentsQuery,
  buildDeliveredProblemsQuery,
  assertScoped,
  recentSinceCutoff,
  DEFAULT_RECENT_DAYS,
} from "../src/services/repository/firestoreQueries.js";
import { PLAN_CHECK_INTERVAL_MS } from "../src/services/repository/planCheckPoller.js";

describe("authz role checks", () => {
  it("detects teacher/admin from a server-provided profile", () => {
    expect(isTeacher({ role: "teacher" })).toBe(true);
    expect(isTeacher({ isTeacher: true })).toBe(true);
    expect(isTeacher({ role: "admin" })).toBe(true);
    expect(isTeacher({ role: "student" })).toBe(false);
    expect(isTeacher({})).toBe(false);
    expect(isTeacher(null)).toBe(false);
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({ role: "teacher" })).toBe(false);
  });

  it("assertTeacher throws for non-teachers (teacher-only fns blocked)", () => {
    expect(() => assertTeacher({ role: "student" })).toThrow();
    expect(() => assertTeacher(null)).toThrow();
    expect(assertTeacher({ role: "teacher" })).toBe(true);
  });
});

describe("privileged-field stripping (students cannot self-promote)", () => {
  it("strips role/isTeacher/teacher/admin from a profile update payload", () => {
    const dirty = { name: "A", bio: "b", role: "teacher", isTeacher: true, teacher: true, admin: true, teacherId: "x" };
    const clean = sanitizeProfileUpdate(dirty);
    expect(clean).toEqual({ name: "A", bio: "b" });
    expect(hasPrivilegedFields(clean)).toBe(false);
    expect(hasPrivilegedFields(dirty)).toBe(true);
  });

  it("PRIVILEGED_FIELDS covers role and isTeacher", () => {
    expect(PRIVILEGED_FIELDS).toContain("role");
    expect(PRIVILEGED_FIELDS).toContain("isTeacher");
  });
});

describe("assertOwnUid pins writes to the current user", () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const prev = globalThis.window;
  afterEach(() => {
    if (had) globalThis.window = prev;
    else delete globalThis.window;
  });

  it("ignores a client-supplied uid that isn't the signed-in user", () => {
    globalThis.window = { __oxUid: "me-123" };
    expect(assertOwnUid("attacker-999")).toBe("me-123");
    expect(assertOwnUid("me-123")).toBe("me-123");
    expect(assertOwnUid(undefined)).toBe("me-123");
  });

  it("defaults to 'local' when no user is signed in", () => {
    delete globalThis.window;
    expect(assertOwnUid("anything")).toBe("local");
  });
});

describe("scoped Firestore queries (no full-collection reads)", () => {
  it("records query is scoped by uid + date range + limit + orderBy", () => {
    const cons = buildRecordsQuery({ uid: "u1", sinceDays: 30, limit: 50 }).constraints;
    expect(cons).toContainEqual(["where", "userId", "==", "u1"]);
    expect(cons.some((c) => c[0] === "where" && c[1] === "createdAt" && c[2] === ">=")).toBe(true);
    expect(cons).toContainEqual(["limit", 50]);
    expect(cons.some((c) => c[0] === "orderBy")).toBe(true);
  });

  it("book-logs query supports optional bookId and stays scoped", () => {
    const cons = buildBookLogsQuery({ uid: "u1", bookId: "b9" }).constraints;
    expect(cons).toContainEqual(["where", "bookId", "==", "b9"]);
    expect(cons).toContainEqual(["where", "userId", "==", "u1"]);
  });

  it("students query is scoped by teacherId + limit (no all-students read)", () => {
    const cons = buildStudentsQuery({ teacherId: "t1" }).constraints;
    expect(cons).toContainEqual(["where", "teacherId", "==", "t1"]);
    expect(cons.some((c) => c[0] === "limit")).toBe(true);
  });

  it("delivered-problems query is scoped by uid", () => {
    const cons = buildDeliveredProblemsQuery({ uid: "u1" }).constraints;
    expect(cons).toContainEqual(["where", "userId", "==", "u1"]);
  });

  it("throws when building a query without uid/teacherId", () => {
    expect(() => buildRecordsQuery({})).toThrow();
    expect(() => buildStudentsQuery({})).toThrow();
  });

  it("assertScoped rejects unscoped or unlimited descriptors (full-collection guard)", () => {
    expect(() => assertScoped({ path: ["records"], constraints: [["limit", 50]] })).toThrow();
    expect(() => assertScoped({ path: ["records"], constraints: [["where", "userId", "==", "u1"]] })).toThrow();
    expect(assertScoped({ path: ["records"], constraints: [["where", "userId", "==", "u1"], ["limit", 10]] })).toBeTruthy();
  });

  it("recentSinceCutoff returns a past timestamp and falls back for bad input", () => {
    const now = 1_000_000_000_000;
    expect(recentSinceCutoff(30, now)).toBe(now - 30 * 86400000);
    expect(recentSinceCutoff(0, now)).toBe(now - DEFAULT_RECENT_DAYS * 86400000);
  });
});

describe("read-pattern guardrails in the React source", () => {
  function walk(dir, acc = []) {
    for (const f of readdirSync(dir)) {
      if (f === "legacy" || f === "node_modules") continue;
      const p = dir + "/" + f;
      const st = statSync(p);
      if (st.isDirectory()) walk(p, acc);
      else if (/\.(js|jsx)$/.test(f)) acc.push(p);
    }
    return acc;
  }

  it("does not introduce onSnapshot anywhere in src (excluding legacy)", () => {
    const hits = walk("src").filter((p) => /\bonSnapshot\b/.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
  });

  it("the sanctioned poller uses a 20s interval", () => {
    expect(PLAN_CHECK_INTERVAL_MS).toBe(20000);
  });
});
