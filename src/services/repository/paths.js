/* Single source of truth for storage keys / Firestore paths.
 *
 * Keeping these here (instead of scattered string literals in screens)
 * is what lets a screen stay unaware of *where* its data lives.
 *
 * Firestore layout (target):
 *   public/data/teacherProblems            global broadcast (no answers)
 *   users/{uid}/deliveredProblems/{id}      per-student delivery (no answers)
 *   deliveredProblems/{id}                  { title, body, subject, createdAt }
 *   teacherProblemAnswers/{id}              { answer, explanation }   <- never sent to students
 *   users/{uid}/bookLogs/{id}               reading log (minutes-validated)
 *   profiles/{uid}                          profile (role/isTeacher Rules-protected)
 *   teacherAllowlist/{uid}                  read-restricted; no list()
 */
const NS = "oriex:v1";

export const lsKey = {
  records: (uid) => NS + ":records:" + (uid || "local"),
  books:   (uid) => NS + ":books:"   + (uid || "local"),
  profile: (uid) => NS + ":profile:" + (uid || "local"),
  // mirrors of Firestore for offline fallback:
  deliveredProblems: (uid) => NS + ":delivered:" + (uid || "local"),
  problemAnswers:    (uid) => NS + ":answers:"   + (uid || "local"),
};

export const fsPath = {
  globalProblems: () => ["public", "data", "teacherProblems"],
  deliveredFor: (uid) => ["users", uid, "deliveredProblems"],
  problemDoc: (id) => ["deliveredProblems", id],
  answerDoc: (id) => ["teacherProblemAnswers", id],
  bookLogs: (uid) => ["users", uid, "bookLogs"],
  profile: (uid) => ["profiles", uid],
  teacherAllow: (uid) => ["teacherAllowlist", uid],
};
