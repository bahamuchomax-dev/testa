/* ============================================================
 * homePhotoStorage — ホーム背景写真のローカル保存ユーティリティ
 * ------------------------------------------------------------
 * 方針（v: home-photo fix）:
 *   - 画像は端末内の IndexedDB に「Blob」で保存する。
 *   - localStorage には画像を入れない（巨大base64で壊れるのを防ぐ）。
 *     拡大率・位置・不透明度などの「設定」だけ別途 localStorage に持つ
 *     （その担当は oxHelpers 側。ここでは画像本体のみを扱う）。
 *   - 保存前にキャンバスで長辺を縮小し、JPEG/WebP に圧縮する。
 *   - 外部送信は一切しない（fetch / XHR / 外部URL を使わない）。
 *
 * テスト容易性のため IndexedDB は依存性注入できる（既定は
 * グローバルの indexedDB）。純粋なサイズ計算は computeResizeDimensions。
 * ============================================================ */

export const DB_NAME = "oriexbg";
export const STORE_NAME = "imgs";
export const LONG_EDGE_MAX = 1600; // 長辺の上限(px)
export const OUTPUT_QUALITY = 0.82; // JPEG/WebP 品質

function keyFor(uid) {
  return "theme_" + (uid || "local");
}
function oldKeyFor(uid) {
  return "p_" + (uid || "local");
}

/* 値が（旧版で保存された）data URL 文字列かどうか。Blob とは区別する。 */
export function isDataUrlString(value) {
  return typeof value === "string" && value.slice(0, 5) === "data:";
}

/* 不透明度設定(0..1) → ホーム写真テーマの白オーバーレイの alpha。
 * opacity=1 で薄め(0.08)、下げるほど白く（最大0.9）。テーマ反映で共有。 */
export function homePhotoOverlayAlpha(opacity) {
  const op = opacity == null ? 1 : Number(opacity);
  const safe = Number.isFinite(op) ? op : 1;
  return Math.min(0.9, Math.max(0, 0.08 + (1 - safe) * 0.85));
}

/* 長辺を maxEdge に収めるサイズ（アスペクト比維持）。純粋関数。 */
export function computeResizeDimensions(width, height, maxEdge = LONG_EDGE_MAX) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const longEdge = Math.max(w, h);
  if (!Number.isFinite(maxEdge) || maxEdge <= 0 || longEdge <= maxEdge) {
    return { width: w, height: h };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
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
export function savePhotoBlob(blob, { uid, indexedDB: idbOverride } = {}) {
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

/* 保存済み画像を取得。無ければ null。旧キー(p_*)があれば移行的に拾う。 */
export function loadPhotoBlob({ uid, indexedDB: idbOverride } = {}) {
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
          r.onsuccess = () => {
            if (r.result != null) {
              resolve(r.result);
              return;
            }
            // 旧キーからの移行的読み出し
            let r2;
            try {
              r2 = store(db, "readonly").get(oldKeyFor(uid));
            } catch {
              resolve(null);
              return;
            }
            r2.onsuccess = () => resolve(r2.result != null ? r2.result : null);
            r2.onerror = () => resolve(null);
          };
          r.onerror = () => resolve(null);
        })
    )
    .catch(() => null);
}

/* 画像を削除（新旧キーとも）。常に解決（UIを止めない）。 */
export function deletePhotoBlob({ uid, indexedDB: idbOverride } = {}) {
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
            const s = store(db, "readwrite");
            s.delete(keyFor(uid));
            s.delete(oldKeyFor(uid));
            resolve(true);
          } catch {
            resolve(false);
          }
        })
    )
    .catch(() => false);
}

/* ---------------- 画像の縮小・圧縮 ---------------- */
function canUseDom() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

/* WebP が使えれば WebP、無理なら JPEG。 */
export function pickOutputType() {
  try {
    if (!canUseDom()) return "image/jpeg";
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    if (c.toDataURL && c.toDataURL("image/webp").indexOf("data:image/webp") === 0) {
      return "image/webp";
    }
  } catch {
    /* fall through */
  }
  return "image/jpeg";
}

function loadDrawable(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    if (typeof URL === "undefined" || !URL.createObjectURL || typeof Image === "undefined") {
      reject(new Error("画像を読み込めませんでした。"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    img.src = url;
  });
}

function drawableSize(d) {
  return {
    w: d.width || d.naturalWidth || 0,
    h: d.height || d.naturalHeight || 0,
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), type, quality);
      return;
    }
    try {
      resolve(dataUrlToBlob(canvas.toDataURL(type, quality)));
    } catch {
      resolve(null);
    }
  });
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = (header.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(body);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* File/Blob を縮小・圧縮して Blob を返す。
 * returns { blob, resized, width, height, type } */
export async function compressImageToBlob(
  file,
  { maxEdge = LONG_EDGE_MAX, quality = OUTPUT_QUALITY, type } = {}
) {
  if (!file) throw new Error("ファイルがありません。");
  if (!canUseDom()) throw new Error("この環境では画像を変換できません。");

  const drawable = await loadDrawable(file);
  const { w: w0, h: h0 } = drawableSize(drawable);
  if (!w0 || !h0) throw new Error("画像のサイズを取得できませんでした。");

  const { width, height } = computeResizeDimensions(w0, h0, maxEdge);
  const resized = width !== w0 || height !== h0;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) throw new Error("canvasを使用できません。");
  ctx.drawImage(drawable, 0, 0, width, height);
  if (drawable.close) {
    try {
      drawable.close();
    } catch {
      /* ignore */
    }
  }

  const outType = type || pickOutputType();
  const blob = await canvasToBlob(canvas, outType, quality);
  if (!blob) throw new Error("画像を変換できませんでした。");
  return { blob, resized, width, height, type: outType };
}
