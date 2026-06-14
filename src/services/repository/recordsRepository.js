/* Study records repository (localStorage today, Firestore-ready).
 *
 * Screens call list()/add()/remove() and never touch storage directly.
 * When you wire Firestore, implement the same 3 methods against it and
 * keep this localStorage version as the offline fallback.
 *
 * SAFETY (React migration phase 3):
 *   - Writes are pinned to the current user via assertOwnUid; a client-passed
 *     uid that differs from the signed-in user is ignored, never trusted.
 *   - `subject` is free text, so it is sanitized with sanitizePlainText before
 *     it is persisted: HTML tags and dangerous schemes (javascript:, etc.) are
 *     stripped, control characters removed, and the value is clamped to
 *     RECORDS_SUBJECT_MAX_LENGTH. Normal Japanese / English / line breaks are
 *     preserved. A whitespace-only subject is stored as "" (a safe default; the
 *     UI shows the "学習" fallback for empty subjects).
 *   - `minutes` keeps its existing parsePositiveMinutes validation (rounds to a
 *     whole minute, rejects < 1 / NaN / negatives). No upper bound is enforced
 *     today; see docs/REACT_MIGRATION_PLAN.md for the recommended cap to add
 *     when Records moves to Firestore.
 *
 * TODO(firestore): when this moves off localStorage, keep the same list/add/
 * remove/weekly surface, use a scoped recent-records query (current uid +
 * recent date window + limit) fronted by readCache, and invalidate only the
 * records cache key on add/remove. Avoid realtime listeners and unbounded
 * collection fetches, and never read other users' records. See
 * docs/REACT_MIGRATION_PLAN.md for the exact go-live conditions.
 */
import { readJSON, writeJSON } from "./localStore.js";
import { lsKey } from "./paths.js";
import { parsePositiveMinutes } from "../../lib/minutes.js";
import { assertOwnUid } from "../firebase/authz.js";
import { sanitizePlainText } from "../security/sanitizeText.js";

/* Max length for the free-text manual subject field. Kept here (not in the
 * screen) so the repository clamp is the source of truth; Records.jsx imports
 * this same constant for its input maxLength so the two never drift. */
export const RECORDS_SUBJECT_MAX_LENGTH = 80;

export function list(uid) {
  const rows = readJSON(lsKey.records(uid), []);
  return Array.isArray(rows) ? rows : [];
}

/* Returns { ok, error?, record? }. Rejects sub-minute logs (UI should
 * show `error` to the user instead of silently writing a 0-minute row). */
export function add(uid, input) {
  uid = assertOwnUid(uid); // 書き込みは現在ユーザーに固定
  const minutes = parsePositiveMinutes(input?.minutes);
  if (minutes == null) {
    return { ok: false, error: "1分以上の数値を入力してください。" };
  }
  // XSS / storage hygiene: never persist raw user HTML. Strip tags + dangerous
  // schemes, drop control chars, trim, and clamp length. Empty -> "" (safe
  // default; the UI renders the "学習" fallback for empty subjects).
  const subject = sanitizePlainText(input?.subject ?? "", {
    maxLength: RECORDS_SUBJECT_MAX_LENGTH,
    trim: true,
  });
  const record = {
    id: input?.id || "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    minutes,
    subject,
    source: input?.source || "manual",
    createdAt: input?.createdAt ?? Date.now(),
  };
  const rows = list(uid);
  rows.push(record);
  if (!writeJSON(lsKey.records(uid), rows)) {
    return { ok: false, error: "保存に失敗しました。空き容量を確認してください。" };
  }
  return { ok: true, record };
}

export function remove(uid, id) {
  uid = assertOwnUid(uid);
  const rows = list(uid).filter((r) => r.id !== id);
  return writeJSON(lsKey.records(uid), rows);
}

/* 7-day rollup, same shape the home screen wants. */
export function weekly(uid, now = new Date()) {
  const rows = list(uid);
  const dayKey = (d) => {
    const t = new Date(d);
    return t.getFullYear() + "/" + (t.getMonth() + 1) + "/" + t.getDate();
  };
  const byDay = {};
  for (const r of rows) byDay[dayKey(r.createdAt)] = (byDay[dayKey(r.createdAt)] || 0) + (r.minutes || 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const k = dayKey(d);
    days.push({ key: k, label: (d.getMonth() + 1) + "/" + d.getDate(), minutes: byDay[k] || 0 });
  }
  const total = days.reduce((a, b) => a + b.minutes, 0);
  return { days, total, today: days[days.length - 1].minutes };
}
