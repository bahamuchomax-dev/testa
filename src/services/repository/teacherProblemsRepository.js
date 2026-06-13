/* Teacher problems repository.
 *
 * DESIGN (do not collapse back into one document):
 *   - The student-visible problem (title/body/subject) and the ANSWER
 *     (answer/explanation) live in SEPARATE stores. Hiding the answer
 *     in the UI is not enough — if it ships in the payload a student can
 *     read it in devtools. So answers are never delivered to students.
 *   - Global broadcast vs per-student delivery are also separate, so a
 *     client cannot fetch "all problems" and filter locally.
 *
 * This localStorage version models the same split for offline/dev.
 */
import { readJSON, writeJSON } from "./localStore.js";
import { lsKey } from "./paths.js";
import { assertOwnUid } from "../firebase/authz.js";

/* Student side: problems WITHOUT answers. */
export function listDelivered(uid) {
  const rows = readJSON(lsKey.deliveredProblems(uid), []);
  return (Array.isArray(rows) ? rows : []).map((p) => ({
    id: p.id, title: p.title, body: p.body, subject: p.subject, createdAt: p.createdAt,
  }));
}

/* Teacher side: create a problem. Stores the public part and the answer
 * separately. In Firestore these are two writes to two collections. */
export function createProblem(uid, input) {
  uid = assertOwnUid(uid); // 先生は自分の配信ストアにのみ書く
  const id = input?.id || "prob_" + Date.now();
  const pub = {
    id,
    title: input?.title ?? "",
    body: input?.body ?? "",
    subject: input?.subject ?? "",
    createdAt: input?.createdAt ?? Date.now(),
  };
  const ans = { id, answer: input?.answer ?? "", explanation: input?.explanation ?? "" };

  const problems = readJSON(lsKey.deliveredProblems(uid), []);
  const answers = readJSON(lsKey.problemAnswers(uid), {});
  problems.push(pub);
  answers[id] = ans;
  const a = writeJSON(lsKey.deliveredProblems(uid), problems);
  const b = writeJSON(lsKey.problemAnswers(uid), answers);
  if (!a || !b) return { ok: false, error: "問題の保存に失敗しました。" };
  return { ok: true, problem: pub };
}

/* Answer is only readable here for the teacher / after submission.
 * Students never call this. */
export function getAnswer(uid, problemId) {
  const answers = readJSON(lsKey.problemAnswers(uid), {});
  return answers[problemId] || null;
}

export function removeProblem(uid, problemId) {
  uid = assertOwnUid(uid);
  const problems = readJSON(lsKey.deliveredProblems(uid), []).filter((p) => p.id !== problemId);
  const answers = readJSON(lsKey.problemAnswers(uid), {});
  delete answers[problemId];
  writeJSON(lsKey.deliveredProblems(uid), problems);
  writeJSON(lsKey.problemAnswers(uid), answers);
  return true;
}
