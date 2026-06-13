import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Static checks over firestore.rules. We have no Firebase emulator yet, so
 * instead of executing the rules we assert that the hardened guards are
 * present in the rules source. These catch regressions like a block reverting
 * to `if isTeacher()` or `if signedIn()`. Emulator-based behavioural tests are
 * tracked as not-yet-done in docs/FIREBASE_READ_AUDIT.md. */

const RULES = readFileSync("firestore.rules", "utf8");

/* Return the text of `match <path> { ... }` with balanced braces. */
function block(path) {
  const header = "match " + path;
  const start = RULES.indexOf(header);
  if (start === -1) throw new Error("rule block not found: " + path);
  // the opening brace is the LAST `{` on the header line — the earlier `{`
  // tokens are path placeholders like {u} / {id}.
  const lineEnd = RULES.indexOf("\n", start);
  const open = RULES.lastIndexOf("{", lineEnd);
  let depth = 0;
  for (let i = open; i < RULES.length; i++) {
    if (RULES[i] === "{") depth++;
    else if (RULES[i] === "}") {
      depth--;
      if (depth === 0) return RULES.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces for: " + path);
}

const ANSWER_FIELDS = ["answer", "correctAnswer", "explanation", "solution", "answerKey"];
const PRIVILEGED = ["role", "isTeacher", "teacherId", "admin"];

describe("firestore.rules — profiles whitelist", () => {
  const b = block("/profiles/{u}");
  it("uses hasOnly on both create and update (whitelist, not blocklist)", () => {
    expect(b).toMatch(/create:[\s\S]*hasOnly\(\[/);
    expect(b).toMatch(/update:[\s\S]*affectedKeys\(\)[\s\S]*hasOnly\(\[/);
  });
  it("does not allow self to write role / isTeacher / teacherId / admin", () => {
    // those fields must not appear inside any self hasOnly([...]) allow-list
    const allowLists = b.match(/hasOnly\(\[[^\]]*\]\)/g) || [];
    for (const list of allowLists) {
      for (const field of PRIVILEGED) {
        expect(list.includes("'" + field + "'")).toBe(false);
      }
    }
  });
  it("only admin (or self within whitelist) can update; admin alone for delete", () => {
    expect(b).toMatch(/update:\s*if isAdmin\(\)/);
    expect(b).toMatch(/delete:\s*if isAdmin\(\)/);
  });
});

describe("firestore.rules — records / bookLogs uid binding", () => {
  it("ownsRow() pins data.userId to the signed-in uid", () => {
    expect(RULES).toMatch(/function ownsRow\(\)\s*\{\s*return request\.resource\.data\.userId == request\.auth\.uid;/);
  });
  for (const path of ["/users/{u}/records/{id}", "/users/{u}/bookLogs/{id}"]) {
    it(`${path} requires ownsRow() and whitelists fields on write`, () => {
      const b = block(path);
      expect(b).toMatch(/create:[\s\S]*ownsRow\(\)/);
      expect(b).toMatch(/create:[\s\S]*hasOnly\(\[/);
      expect(b).toMatch(/update:[\s\S]*ownsRow\(\)/);
      // write is owner-only (no bare isTeacher / signedIn write)
      expect(b).not.toMatch(/allow write:/);
    });
  }
});

describe("firestore.rules — deliveredProblems are assignment-scoped & answer-free", () => {
  const b = block("/users/{u}/deliveredProblems/{id}");
  it("teacher writes are limited to the assigned teacher or admin (not any teacher)", () => {
    expect(b).toMatch(/create, update:\s*if \(isAdmin\(\) \|\| teaches\(u\)\)/);
    // must NOT be a bare isTeacher() write
    expect(b).not.toMatch(/create, update, delete:\s*if isTeacher\(\);/);
  });
  it("requires the row to be addressed to the path owner and forbids answers", () => {
    expect(b).toMatch(/request\.resource\.data\.userId == u/);
    expect(b).toMatch(/noAnswerFields\(\)/);
  });
  it("noAnswerFields() bans answer/correctAnswer/explanation/solution/answerKey", () => {
    const fn = RULES.match(/function noAnswerFields\(\)[\s\S]*?\}/)[0];
    for (const f of ANSWER_FIELDS) expect(fn.includes("'" + f + "'")).toBe(true);
  });
});

describe("firestore.rules — top-level deliveredProblems read tightened", () => {
  const b = block("/deliveredProblems/{id}");
  it("is no longer readable by every signed-in user", () => {
    expect(b).not.toMatch(/read:\s*if signedIn\(\)/);
    expect(b).toMatch(/read:\s*if isTeacher\(\)/);
  });
  it("still forbids answer fields on write", () => {
    expect(b).toMatch(/noAnswerFields\(\)/);
  });
});

describe("firestore.rules — teacherProblemAnswers not shared across all teachers", () => {
  const b = block("/teacherProblemAnswers/{id}");
  it("does not grant blanket read/write to any teacher", () => {
    expect(b).not.toMatch(/allow read, write:\s*if isTeacher\(\);/);
    expect(b).not.toMatch(/read:\s*if isTeacher\(\);/);
  });
  it("scopes reads to the owning teacher (teacherId) or admin only — READ POLICY A", () => {
    const r = clause(b, "read");
    expect(r).toContain("resource.data.teacherId == request.auth.uid");
    expect(r).toContain("isAdmin()");
    // Policy A: an assigned student's OTHER teachers must NOT read the doc,
    // so the read clause must NOT use a studentUid-based grant.
    expect(r).not.toContain("studentUid");
  });
  it("students are never granted read (no signedIn / isSelf read path here)", () => {
    expect(b).not.toMatch(/signedIn\(\)/);
    expect(b).not.toMatch(/isSelf/);
  });
});

describe("firestore.rules — global posture", () => {
  it("ends with an explicit default-deny", () => {
    expect(RULES).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;/);
  });
  it("derives roles from server-set custom claims, not client fields", () => {
    expect(RULES).toMatch(/request\.auth\.token\.teacher/);
    expect(RULES).toMatch(/request\.auth\.token\.admin/);
  });
});

/* Return the text of an `allow <action>` clause within a block. */
function clause(blockText, action) {
  const parts = blockText.split(/allow /).filter(Boolean);
  return parts.find((p) => p.startsWith(action)) || "";
}

describe("firestore.rules — teacherId anti-spoofing & studentUid recheck (stage 4.5)", () => {
  it("answer update re-checks teaches(studentUid)", () => {
    const u = clause(block("/teacherProblemAnswers/{id}"), "update");
    expect(u).toContain("teaches(request.resource.data.studentUid)");
    // teacherId must remain the writer's own uid
    expect(u).toContain("request.resource.data.teacherId == request.auth.uid");
  });

  for (const path of ["/public/data/teacherProblems/{id}", "/deliveredProblems/{id}"]) {
    it(`${path} binds teacherId to the writer with an admin exception`, () => {
      const c = clause(block(path), "create, update");
      expect(c).toContain("request.resource.data.teacherId == request.auth.uid");
      expect(c).toContain("isAdmin()");
      expect(c).toContain("noAnswerFields()");
    });
  }

  it("per-student deliveredProblems does NOT allow a teacherId field (policy B)", () => {
    const c = clause(block("/users/{u}/deliveredProblems/{id}"), "create, update");
    const allowList = (c.match(/hasOnly\(\[[^\]]*\]\)/) || [""])[0];
    expect(allowList).not.toContain("'teacherId'");
    // still pinned to the path owner
    expect(c).toContain("request.resource.data.userId == u");
  });
});

describe("firestore.rules — admin not exempt from answer ban & owner-limited delete (stage 4.6)", () => {
  for (const path of ["/public/data/teacherProblems/{id}", "/deliveredProblems/{id}"]) {
    it(`${path}: admin create/update still passes noAnswerFields + whitelist`, () => {
      const c = clause(block(path), "create, update");
      // the (admin || teacher==self) group is AND-ed with noAnswerFields()
      expect(c).toMatch(/\(isAdmin\(\) \|\| \(isTeacher\(\)[\s\S]*\)\)\s*&&[\s\S]*noAnswerFields\(\)/);
      expect(c).toMatch(/hasOnly\(\[/);
    });
    it(`${path}: delete is owner-limited (not isTeacher() alone)`, () => {
      const d = clause(block(path), "delete");
      expect(d).toContain("resource.data.teacherId == request.auth.uid");
      expect(d).toContain("isAdmin()");
      expect(d).not.toMatch(/^delete:\s*if isTeacher\(\);/);
    });
  }

  it("teacherProblemAnswers read policy matches docs (Policy A)", () => {
    const audit = readFileSync("docs/FIREBASE_READ_AUDIT.md", "utf8");
    expect(audit).toContain("READ POLICY = A");
    const r = clause(block("/teacherProblemAnswers/{id}"), "read");
    expect(r).not.toContain("studentUid"); // A: no assigned-student read
  });
});
