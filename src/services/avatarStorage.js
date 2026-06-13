/* ============================================================
 * avatarStorage — プロフィールアバター画像のローカル保存ユーティリティ
 * ------------------------------------------------------------
 * 方針（bug-fix phase 3）:
 *   - 画像は端末内の IndexedDB に「Blob」で保存する。
 *   - localStorage には画像（base64 / data URL）を一切入れない。
 *     プロフィールの保存 payload にも画像本体を入れない。
 *   - テーマ写真（homePhotoStorage）と同じ方式。ただし保存先 DB は
 *     完全に分離（DB名 "oriexavatar"）し、テーマ写真の DB("oriexbg")とは
 *     衝突しない。圧縮ロジックは homePhotoStorage の実装を共有する。
 *   - アバターは長辺 512px 程度に縮小・圧縮する。
 *   - 外部送信は一切しない（fetch / XHR / 外部URL を使わない）。
 *
 * テスト容易性のため IndexedDB は依存性注入できる（既定はグローバル）。
 * ============================================================ */

import { compressImageToBlob, isDataUrlString } from "../features/home/homePhotoStorage.js";

export const DB_NAME = "oriexavatar";
export const STORE_NAME = "imgs";
export const AVATAR_LONG_EDGE_MAX = 512; // 長辺の上限(px)
export const OUTPUT_QUALITY = 0.82;

export { isDataUrlString };

function keyFor(uid) {
  return "avatar_" + (uid || "local");
}

/* ---------------- IndexedDB（Blob 保存） ---------------- */
function resolveIdb(override) {
  if (override) return override;
  if (typeof indexedDB !== "undefined" && indexedDB) return indexedDB;
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) return globalThis.indexedDB;
  throw new Error("IndexedDBが利用できません。");
}

function openDb(idb) {
  return new Promise((resolve, reject) => {
    let rq;
    try {
      rq = idb.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    rq.onupgradeneeded = () => {
      try {
        rq.result.createObjectStore(STORE_NAME);
      } catch {
        /* store already exists */
      }
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error || new Error("IndexedDBを開けませんでした。"));
  });
}

function store(db, mode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/* Blob を保存。成功で true。失敗は reject（呼び出し側で握りつぶしてUI表示）。 */
export function saveAvatarBlob(blob, { uid, indexedDB: idbOverride } = {}) {
  const idb = resolveIdb(idbOverride);
  return openDb(idb).then(
    (db) =>
      new Promise((resolve, reject) => {
        let r;
        try {
          r = store(db, "readwrite").put(blob, keyFor(uid));
        } catch (e) {
          reject(e);
          return;
        }
        r.onsuccess = () => resolve(true);
        r.onerror = () => reject(r.error || new Error("保存に失敗しました。"));
      })
  );
}

/* 保存済みアバターを取得。無ければ null。常に解決（UIを止めない）。 */
export function loadAvatarBlob({ uid, indexedDB: idbOverride } = {}) {
  let idb;
  try {
    idb = resolveIdb(idbOverride);
  } catch {
    return Promise.resolve(null);
  }
  return openDb(idb)
    .then(
      (db) =>
        new Promise((resolve) => {
          let r;
          try {
            r = store(db, "readonly").get(keyFor(uid));
          } catch {
            resolve(null);
            return;
          }
          r.onsuccess = () => resolve(r.result != null ? r.result : null);
          r.onerror = () => resolve(null);
        })
    )
    .catch(() => null);
}

/* アバターを削除。常に解決（UIを止めない）。 */
export function deleteAvatarBlob({ uid, indexedDB: idbOverride } = {}) {
  let idb;
  try {
    idb = resolveIdb(idbOverride);
  } catch {
    return Promise.resolve(false);
  }
  return openDb(idb)
    .then(
      (db) =>
        new Promise((resolve) => {
          try {
            store(db, "readwrite").delete(keyFor(uid));
            resolve(true);
          } catch {
            resolve(false);
          }
        })
    )
    .catch(() => false);
}

/* File/Blob を長辺512pxへ縮小・圧縮して Blob を返す（base64 は経由しない）。
 * returns { blob, resized, width, height, type } */
export function compressAvatarToBlob(file, opts = {}) {
  return compressImageToBlob(file, {
    maxEdge: AVATAR_LONG_EDGE_MAX,
    quality: OUTPUT_QUALITY,
    ...opts,
  });
}
