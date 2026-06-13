/* Reference-book reading logs. Same validation discipline as records. */
import { readJSON, writeJSON } from "./localStore.js";
import { lsKey } from "./paths.js";
import { parsePositiveMinutes } from "../../lib/minutes.js";
import { assertOwnUid } from "../firebase/authz.js";

export function list(uid) {
  const rows = readJSON(lsKey.books(uid), []);
  return Array.isArray(rows) ? rows : [];
}

export function add(uid, input) {
  uid = assertOwnUid(uid);
  const minutes = parsePositiveMinutes(input?.minutes);
  if (minutes == null) return { ok: false, error: "1分以上の数値を入力してください。" };
  const row = {
    id: input?.id || "book_" + Date.now(),
    title: input?.title ?? "",
    minutes,
    createdAt: input?.createdAt ?? Date.now(),
  };
  const rows = list(uid); rows.push(row);
  if (!writeJSON(lsKey.books(uid), rows)) return { ok: false, error: "保存に失敗しました。" };
  return { ok: true, row };
}

export function remove(uid, id) {
  uid = assertOwnUid(uid);
  return writeJSON(lsKey.books(uid), list(uid).filter((r) => r.id !== id));
}
