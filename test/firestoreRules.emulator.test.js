/* ============================================================
 * Firestore Rules — Emulator behavioural tests
 * ------------------------------------------------------------
 * Runs ONLY under `npm run test:rules` (needs Firebase CLI + the
 * Firestore emulator). It is excluded from the normal `npm run test`
 * via vite.config.js (the default run excludes emulator test files).
 *
 * Verifies the real allow/deny behaviour of firestore.rules for
 * unauthenticated / student / teacher / admin actors.
 * ============================================================ */
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  collection,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  setLogLevel,
} from "firebase/firestore";

const PROJECT_ID = "oriex-rules-test";
let testEnv;

beforeAll(async () => {
  setLogLevel("error");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/* Seed data bypassing rules. */
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

function student(uid = "student1") {
  return testEnv.authenticatedContext(uid).firestore();
}
function teacher(uid = "teacher1") {
  return testEnv.authenticatedContext(uid, { teacher: true }).firestore();
}
function admin(uid = "admin1") {
  return testEnv.authenticatedContext(uid, { admin: true }).firestore();
}
function anon() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedBaseline() {
  await seed(async (db) => {
    await setDoc(doc(db, "profiles/student1"), { name: "S1", teacherId: "teacher1" });
    await setDoc(doc(db, "profiles/student2"), { name: "S2", teacherId: "teacher2" });
    await setDoc(doc(db, "profiles/student3"), { name: "S3", teacherId: "teacher1" });
    await setDoc(doc(db, "users/student1/records/r1"), { userId: "student1", minutes: 30, subject: "math", source: "manual", createdAt: 1 });
    await setDoc(doc(db, "users/student2/records/r1"), { userId: "student2", minutes: 10, subject: "eng", source: "manual", createdAt: 1 });
    await setDoc(doc(db, "teacherProblemAnswers/ans1"), { teacherId: "teacher1", studentUid: "student1", answer: "A", problemId: "p1" });
    await setDoc(doc(db, "teacherProblemAnswers/ans2"), { teacherId: "teacher2", studentUid: "student2", answer: "B", problemId: "p2" });
    await setDoc(doc(db, "teacherProblemAnswers/ans3"), { teacherId: "teacher2", studentUid: "student1", answer: "C", problemId: "p3" });
    await setDoc(doc(db, "public/data/teacherProblems/pubT1"), { teacherId: "teacher1", title: "t", body: "b", subject: "s" });
    await setDoc(doc(db, "public/data/teacherProblems/pubT2"), { teacherId: "teacher2", title: "t", body: "b", subject: "s" });
    await setDoc(doc(db, "deliveredProblems/topT1"), { teacherId: "teacher1", title: "t", body: "b", subject: "s" });
    await setDoc(doc(db, "deliveredProblems/topT2"), { teacherId: "teacher2", title: "t", body: "b", subject: "s" });
  });
}

describe("unauthenticated", () => {
  beforeEach(seedBaseline);
  it("cannot read profiles", async () => {
    await assertFails(getDoc(doc(anon(), "profiles/student1")));
  });
  it("cannot read records", async () => {
    await assertFails(getDoc(doc(anon(), "users/student1/records/r1")));
  });
  it("cannot create teacherProblems broadcast", async () => {
    await assertFails(setDoc(doc(anon(), "public/data/teacherProblems/p1"), { title: "t", body: "b", subject: "s", teacherId: "x" }));
  });
});

describe("student", () => {
  beforeEach(seedBaseline);

  it("can read own profile", async () => {
    await assertSucceeds(getDoc(doc(student(), "profiles/student1")));
  });
  it("cannot read another student's profile", async () => {
    await assertFails(getDoc(doc(student(), "profiles/student2")));
  });
  it("can update own name/bio/avatar/theme", async () => {
    await assertSucceeds(updateDoc(doc(student(), "profiles/student1"), { name: "new", bio: "hi", avatar: "a", theme: "dark" }));
  });
  it("cannot set role/isTeacher/teacherId/admin", async () => {
    await assertFails(updateDoc(doc(student(), "profiles/student1"), { role: "teacher" }));
    await assertFails(updateDoc(doc(student(), "profiles/student1"), { isTeacher: true }));
    await assertFails(updateDoc(doc(student(), "profiles/student1"), { teacherId: "teacher9" }));
    await assertFails(updateDoc(doc(student(), "profiles/student1"), { admin: true }));
  });
  it("cannot create unknown fields like teacherOnlyNote/internalMemo", async () => {
    await testEnv.clearFirestore();
    await assertFails(setDoc(doc(student(), "profiles/student1"), { name: "x", teacherOnlyNote: "secret" }));
    await assertFails(setDoc(doc(student(), "profiles/student1"), { name: "x", internalMemo: "z" }));
    await assertSucceeds(setDoc(doc(student(), "profiles/student1"), { name: "x", bio: "ok" }));
  });
  it("can create own records", async () => {
    await assertSucceeds(setDoc(doc(student(), "users/student1/records/r2"), { userId: "student1", minutes: 20, subject: "sci", source: "manual", createdAt: 2 }));
  });
  it("cannot create records with another userId", async () => {
    await assertFails(setDoc(doc(student(), "users/student1/records/r3"), { userId: "student2", minutes: 20, subject: "sci", source: "manual", createdAt: 2 }));
  });
  it("cannot create records under another user's path", async () => {
    await assertFails(setDoc(doc(student(), "users/student2/records/r4"), { userId: "student2", minutes: 20, subject: "sci", source: "manual", createdAt: 2 }));
  });
  it("cannot read teacherProblemAnswers", async () => {
    await assertFails(getDoc(doc(student(), "teacherProblemAnswers/ans1")));
  });
  it("cannot create/delete teacher broadcast problems", async () => {
    await assertFails(setDoc(doc(student(), "public/data/teacherProblems/p9"), { title: "t", body: "b", subject: "s", teacherId: "x" }));
    await assertFails(setDoc(doc(student(), "deliveredProblems/d9"), { title: "t", body: "b", subject: "s", teacherId: "x" }));
  });
});

describe("teacher", () => {
  beforeEach(seedBaseline);

  it("can read an assigned student's profile and records", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "profiles/student1")));
    await assertSucceeds(getDoc(doc(teacher(), "users/student1/records/r1")));
  });
  it("cannot read a non-assigned student's profile or records", async () => {
    await assertFails(getDoc(doc(teacher(), "profiles/student2")));
    await assertFails(getDoc(doc(teacher(), "users/student2/records/r1")));
  });
  it("can deliver a problem to an assigned student", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "users/student1/deliveredProblems/d1"), { userId: "student1", title: "t", body: "b", subject: "s" }));
  });
  it("cannot deliver to a non-assigned student", async () => {
    await assertFails(setDoc(doc(teacher(), "users/student2/deliveredProblems/d1"), { userId: "student2", title: "t", body: "b", subject: "s" }));
  });
  it("cannot put answers into a student-visible delivered problem", async () => {
    await assertFails(setDoc(doc(teacher(), "users/student1/deliveredProblems/d2"), { userId: "student1", title: "t", answer: "x" }));
    await assertFails(setDoc(doc(teacher(), "users/student1/deliveredProblems/d3"), { userId: "student1", title: "t", correctAnswer: "x" }));
    await assertFails(setDoc(doc(teacher(), "users/student1/deliveredProblems/d4"), { userId: "student1", title: "t", answerKey: "x" }));
  });
  it("can read only its own teacherId answers", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "teacherProblemAnswers/ans1")));
    await assertFails(getDoc(doc(teacher(), "teacherProblemAnswers/ans2")));
  });
  it("can create answers for itself / assigned students, not others", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "teacherProblemAnswers/ansNew"), { teacherId: "teacher1", studentUid: "student1", problemId: "p1", answer: "x" }));
    await assertFails(setDoc(doc(teacher(), "teacherProblemAnswers/ansBad1"), { teacherId: "teacher2", answer: "x" }));
    await assertFails(setDoc(doc(teacher(), "teacherProblemAnswers/ansBad2"), { teacherId: "teacher1", studentUid: "student2", answer: "x" }));
  });

  it("cannot change an answer's studentUid to a non-assigned student on update", async () => {
    await assertFails(updateDoc(doc(teacher(), "teacherProblemAnswers/ans1"), { studentUid: "student2" }));
  });
  it("can change an answer's studentUid to another assigned student", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "teacherProblemAnswers/ans1"), { studentUid: "student3" }));
  });
  it("cannot change an answer's teacherId to another teacher on update", async () => {
    await assertFails(updateDoc(doc(teacher(), "teacherProblemAnswers/ans1"), { teacherId: "teacher2" }));
  });

  it("cannot spoof teacherId on a broadcast problem", async () => {
    await assertFails(setDoc(doc(teacher(), "public/data/teacherProblems/pSpoof"), { title: "t", body: "b", subject: "s", teacherId: "teacher2" }));
    await assertSucceeds(setDoc(doc(teacher(), "public/data/teacherProblems/pMine"), { title: "t", body: "b", subject: "s", teacherId: "teacher1" }));
  });
  it("cannot spoof teacherId on a top-level deliveredProblem", async () => {
    await assertFails(setDoc(doc(teacher(), "deliveredProblems/dSpoof"), { title: "t", body: "b", subject: "s", teacherId: "teacher2" }));
    await assertSucceeds(setDoc(doc(teacher(), "deliveredProblems/dMine"), { title: "t", body: "b", subject: "s", teacherId: "teacher1" }));
  });
  it("cannot set teacherId at all on a per-student deliveredProblem (policy B)", async () => {
    await assertFails(setDoc(doc(teacher(), "users/student1/deliveredProblems/dTid"), { userId: "student1", title: "t", teacherId: "teacher1" }));
  });

  it("cannot delete another teacher's broadcast or top-level problem", async () => {
    await assertFails(deleteDoc(doc(teacher(), "public/data/teacherProblems/pubT2")));
    await assertFails(deleteDoc(doc(teacher(), "deliveredProblems/topT2")));
  });
  it("can delete its OWN broadcast and top-level problem", async () => {
    await assertSucceeds(deleteDoc(doc(teacher(), "public/data/teacherProblems/pubT1")));
    await assertSucceeds(deleteDoc(doc(teacher(), "deliveredProblems/topT1")));
  });
  it("cannot read another teacher's answer even for an assigned student (read policy A)", async () => {
    // ans3: teacherId=teacher2, studentUid=student1 (assigned to teacher1) → still denied
    await assertFails(getDoc(doc(teacher(), "teacherProblemAnswers/ans3")));
  });
});

describe("admin", () => {
  beforeEach(seedBaseline);

  it("can change role/isTeacher/teacherId on a profile", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "profiles/student1"), { role: "teacher", isTeacher: true, teacherId: "teacher1" }));
  });
  it("can write the teacherAllowlist", async () => {
    await assertSucceeds(setDoc(doc(admin(), "teacherAllowlist/teacher1"), { grantedBy: "admin1" }));
  });
  it("cannot list the teacherAllowlist", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "teacherAllowlist/teacher1"), { grantedBy: "admin1" });
    });
    await assertFails(getDocs(collection(admin(), "teacherAllowlist")));
  });
  it("may create a broadcast on behalf of any teacherId (admin exception)", async () => {
    await assertSucceeds(setDoc(doc(admin(), "public/data/teacherProblems/pAdmin"), { title: "t", body: "b", subject: "s", teacherId: "teacher2" }));
  });
  it("still cannot put answers into public/top-level problems (admin not exempt from noAnswerFields)", async () => {
    await assertFails(setDoc(doc(admin(), "public/data/teacherProblems/pAdminBad"), { title: "t", body: "b", subject: "s", teacherId: "teacher2", answerKey: "x" }));
    await assertFails(setDoc(doc(admin(), "public/data/teacherProblems/pAdminBad2"), { title: "t", body: "b", subject: "s", teacherId: "teacher2", explanation: "x" }));
    await assertFails(setDoc(doc(admin(), "deliveredProblems/dAdminBad"), { title: "t", body: "b", subject: "s", teacherId: "teacher2", answerKey: "x" }));
    await assertFails(setDoc(doc(admin(), "deliveredProblems/dAdminBad2"), { title: "t", body: "b", subject: "s", teacherId: "teacher2", explanation: "x" }));
  });
  it("can delete any teacher's problem", async () => {
    await assertSucceeds(deleteDoc(doc(admin(), "public/data/teacherProblems/pubT2")));
    await assertSucceeds(deleteDoc(doc(admin(), "deliveredProblems/topT2")));
  });
});
