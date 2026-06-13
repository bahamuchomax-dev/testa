/* Profile repository.
 *
 * Two safety rules from the original work are baked in here:
 *  1) never persist `undefined` (Firestore rejects it) -> stripUndefined
 *  2) don't rewrite storage when nothing actually changed (avoids the
 *     setState -> save -> setState feedback loop that inflates writes)
 *
 * SECURITY: `role` / `isTeacher` must be enforced by Firestore Rules,
 * not by this client. A student editing their profile must not be able
 * to grant themselves teacher rights.
 */
import { readJSON, writeJSON } from "./localStore.js";
import { lsKey } from "./paths.js";
import { stripUndefined } from "../../lib/sanitize.js";
import { assertOwnUid, sanitizeProfileUpdate } from "../firebase/authz.js";
import { sanitizePlainText } from "../security/sanitizeText.js";

const DEFAULT = { name: "", bio: "", avatar: null };

export function get(uid) {
  return { ...DEFAULT, ...(readJSON(lsKey.profile(uid), {}) || {}) };
}

export function save(uid, profile) {
  // 権限防御: 書き込み先 uid は現在ユーザーに固定し、特権フィールド
  // (role/isTeacher/teacher/admin 等) はクライアントから保存させない。
  const owner = assertOwnUid(uid);
  const safeInput = sanitizeProfileUpdate(profile || {});
  // XSS 多層防御: 文字列フィールドは保存前に危険HTMLを無害化する
  // （タグ/危険スキームのみ除去。日本語・英数・改行は保持）。長さも上限でクランプ。
  if (typeof safeInput.name === "string") safeInput.name = sanitizePlainText(safeInput.name, { maxLength: 120 });
  if (typeof safeInput.bio === "string") safeInput.bio = sanitizePlainText(safeInput.bio, { maxLength: 4000 });
  const next = stripUndefined({ ...DEFAULT, ...safeInput });
  const prev = readJSON(lsKey.profile(owner), null);
  if (prev && JSON.stringify(prev) === JSON.stringify(next)) {
    return { ok: true, unchanged: true };
  }
  if (!writeJSON(lsKey.profile(owner), next)) {
    return { ok: false, error: "プロフィールの保存に失敗しました。" };
  }
  return { ok: true, profile: next };
}
