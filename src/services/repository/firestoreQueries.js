/* ============================================================
 * firestoreQueries — 読み取りを必ず絞るためのクエリ記述子ビルダー
 * ------------------------------------------------------------
 * 「全件 getDocs」を構造的に禁止する。各ビルダーは
 *   { path, constraints:[ ["where",...], ["orderBy",...], ["limit",n] ] }
 * という記述子を返し、Firestore 有効化時に query()/where()/limit() へ
 * 1対1で変換する。assertScoped() がスコープ（uid/teacherId）と limit の
 * 欠落を検出して投げるので、絞り忘れた全件取得はビルド時点で失敗する。
 * ============================================================ */

export const DEFAULT_PAGE_LIMIT = 50;
export const DEFAULT_RECENT_DAYS = 30;

/* 直近 days 日の開始時刻(ms)。date range 絞り込み用。 */
export function recentSinceCutoff(days = DEFAULT_RECENT_DAYS, now = Date.now()) {
  const d = Number(days) > 0 ? Number(days) : DEFAULT_RECENT_DAYS;
  return now - d * 24 * 60 * 60 * 1000;
}

/* 記述子が「uid か teacherId のいずれかで絞られ」かつ「limit を持つ」ことを保証。
 * 違反すれば例外（＝全件取得・無制限取得を防ぐ）。 */
export function assertScoped(descriptor) {
  const cons = (descriptor && descriptor.constraints) || [];
  const hasScope = cons.some(
    (c) => c[0] === "where" && (c[1] === "userId" || c[1] === "uid" || c[1] === "teacherId" || c[1] === "ownerId")
  );
  const hasLimit = cons.some((c) => c[0] === "limit" && Number(c[1]) > 0);
  if (!hasScope) {
    throw new Error("Firestoreクエリは uid/teacherId で絞る必要があります（全件取得は禁止）。");
  }
  if (!hasLimit) {
    throw new Error("Firestoreクエリには limit が必要です（無制限取得は禁止）。");
  }
  return descriptor;
}

/* 学習記録: ユーザー単位＋直近N日＋limit。 */
export function buildRecordsQuery({ uid, sinceDays = DEFAULT_RECENT_DAYS, limit = DEFAULT_PAGE_LIMIT, now } = {}) {
  if (!uid) throw new Error("buildRecordsQuery には uid が必要です。");
  const descriptor = {
    path: ["users", uid, "records"],
    constraints: [
      ["where", "userId", "==", uid],
      ["where", "createdAt", ">=", recentSinceCutoff(sinceDays, now)],
      ["orderBy", "createdAt", "desc"],
      ["limit", limit],
    ],
  };
  return assertScoped(descriptor);
}

/* 参考書ログ: userId(+任意 bookId)＋直近N日＋limit。 */
export function buildBookLogsQuery({ uid, bookId, sinceDays = DEFAULT_RECENT_DAYS, limit = DEFAULT_PAGE_LIMIT, now } = {}) {
  if (!uid) throw new Error("buildBookLogsQuery には uid が必要です。");
  const constraints = [["where", "userId", "==", uid]];
  if (bookId) constraints.push(["where", "bookId", "==", bookId]);
  constraints.push(["where", "createdAt", ">=", recentSinceCutoff(sinceDays, now)]);
  constraints.push(["orderBy", "createdAt", "desc"]);
  constraints.push(["limit", limit]);
  return assertScoped({ path: ["users", uid, "bookLogs"], constraints });
}

/* 先生の担当生徒一覧: teacherId＋orderBy＋limit（全生徒取得はしない）。 */
export function buildStudentsQuery({ teacherId, limit = DEFAULT_PAGE_LIMIT } = {}) {
  if (!teacherId) throw new Error("buildStudentsQuery には teacherId が必要です。");
  return assertScoped({
    path: ["profiles"],
    constraints: [
      ["where", "teacherId", "==", teacherId],
      ["orderBy", "name", "asc"],
      ["limit", limit],
    ],
  });
}

/* 生徒に配信された問題（解答は含まない別コレクション）: uid＋limit。 */
export function buildDeliveredProblemsQuery({ uid, limit = DEFAULT_PAGE_LIMIT } = {}) {
  if (!uid) throw new Error("buildDeliveredProblemsQuery には uid が必要です。");
  return assertScoped({
    path: ["users", uid, "deliveredProblems"],
    constraints: [
      ["where", "userId", "==", uid],
      ["orderBy", "createdAt", "desc"],
      ["limit", limit],
    ],
  });
}
