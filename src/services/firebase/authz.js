/* ============================================================
 * authz — クライアント側の権限ガード（Rulesと二重防御）
 * ------------------------------------------------------------
 * Firestore Rules がサーバ側の最終防衛線。これは「Rulesに頼り切らず
 * クライアントでも守る」ための補助:
 *   - isTeacher / isAdmin : サーバ由来の profile から役割を判定（表示制御用）
 *   - assertTeacher       : 先生専用関数の先頭で呼ぶ（非先生なら例外）
 *   - assertOwnUid        : 書き込み前に uid を「現在のユーザー」に固定
 *                           （クライアントから渡された uid を信用しない）
 *   - sanitizeProfileUpdate : role/isTeacher 等の特権フィールドを保存前に除去
 *
 * 役割（role/isTeacher）の付与・剥奪は管理者がサーバ側で行う前提。
 * このモジュールは「自分で先生化できない」をクライアントでも担保する。
 * ============================================================ */

import { currentUid } from "./client.js";

/* 生徒がフォーム等から書き換えてはいけないフィールド。 */
export const PRIVILEGED_FIELDS = [
  "role",
  "isTeacher",
  "teacher",
  "isAdmin",
  "admin",
  "teacherId",
  "claims",
  "permissions",
  "allowlist",
];

export function isTeacher(profile) {
  if (!profile || typeof profile !== "object") return false;
  return profile.isTeacher === true || profile.role === "teacher" || profile.role === "admin";
}

export function isAdmin(profile) {
  if (!profile || typeof profile !== "object") return false;
  return profile.isAdmin === true || profile.role === "admin";
}

/* 先生専用処理の入口で使う。非先生なら例外を投げて実行を止める。 */
export function assertTeacher(profile) {
  if (!isTeacher(profile)) {
    const err = new Error("この操作には先生権限が必要です。");
    err.code = "not-teacher";
    throw err;
  }
  return true;
}

/* 書き込み対象 uid は常に「現在ログイン中のユーザー」に固定する。
 * クライアントから渡された uid が現在ユーザーと異なる場合は無視する。 */
export function assertOwnUid(requestedUid) {
  const me = currentUid();
  if (requestedUid != null && String(requestedUid) !== String(me)) {
    return me; // 渡された他人の uid は信用しない
  }
  return me;
}

/* オブジェクトに特権フィールドが含まれているか（テスト/検査用）。 */
export function hasPrivilegedFields(obj) {
  if (!obj || typeof obj !== "object") return false;
  return PRIVILEGED_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

/* プロフィール更新ペイロードから特権フィールドを除去して返す（非破壊）。 */
export function sanitizeProfileUpdate(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (PRIVILEGED_FIELDS.indexOf(k) === -1) out[k] = obj[k];
  }
  return out;
}
