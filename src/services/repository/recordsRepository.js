/* Study records repository (localStorage today, Firestore-ready).
 *
 * Screens call list()/add()/remove() and never touch storage directly.
 * When you wire Firestore, implement the same 3 methods against it and
 * keep this localStorage version as the offline fallback.
 */
import { readJSON, writeJSON } from "./localStore.js";
import { lsKey } from "./paths.js";
import { parsePositiveMinutes } from "../../lib/minutes.js";
import { assertOwnUid } from "../firebase/authz.js";

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
  const record = {
    id: input?.id || "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    minutes,
    subject: input?.subject ?? "",
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
