/* ============================================================
 * pdfTextExtractor — ブラウザ内でPDF本文を抽出
 * ------------------------------------------------------------
 * - PDFファイルもPDF本文も外部に送信しない。pdfjs-dist で
 *   ブラウザ内だけで処理する。
 * - 画像中心（スキャン）PDFは抽出できないため、その旨を返す。
 *   OCRは未実装（将来拡張・下のTODO参照）。
 * - 長文は対象ページを絞り、チャンク化して扱う。
 *
 * 重い pdfjs-dist は extractPdfText() の中で動的importする
 * （PDFタブを使うまで読み込まない＝初期バンドルを軽く保つ）。
 * チャンク化やページ範囲解釈などの純ロジックは pdfjs に依存
 * しないので単体テストできる。
 * ============================================================ */

// pdfjs はブラウザ専用。SSR/テスト環境では読み込まない。
let _pdfjsPromise = null;
async function loadPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Vite が worker をアセットとして解決する（?url）
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return _pdfjsPromise;
}

/* "1-3,5" のようなページ指定を 1始まりのページ番号配列に変換。 */
export function parsePageRange(spec, numPages) {
  const max = Number(numPages) || 0;
  if (!spec || !String(spec).trim()) {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
  const set = new Set();
  for (const part of String(spec).split(",")) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) set.add(i);
    } else {
      const n = parseInt(part.trim(), 10);
      if (Number.isFinite(n) && n >= 1 && n <= max) set.add(n);
    }
  }
  return Array.from(set).sort((x, y) => x - y);
}

/* 文字数の少なさから画像中心PDFかを推定（抽出後の判定にも使う）。 */
export function looksLikeImagePdf(totalChars, pageCount) {
  const pages = Math.max(1, Number(pageCount) || 1);
  return (Number(totalChars) || 0) < 20 * pages;
}

/* 長文を文字数上限で素直に分割（文の途中で切れすぎないよう改行/句点優先）。 */
export function chunkText(text, maxChars = 6000) {
  const s = String(text || "");
  if (s.length <= maxChars) return s.length ? [s] : [];
  const chunks = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + maxChars, s.length);
    if (end < s.length) {
      const slice = s.slice(i, end);
      const cut = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf("。"), slice.lastIndexOf(". "));
      if (cut > maxChars * 0.5) end = i + cut + 1;
    }
    chunks.push(s.slice(i, end).trim());
    i = end;
  }
  return chunks.filter(Boolean);
}

/* PDF全体のページ別テキストを抽出。返り値:
 *   { ok, numPages, pages:[{page,text}], totalChars, imageLikely, error? } */
export async function extractPdfText(file, { maxPages } = {}) {
  if (typeof window === "undefined") {
    return { ok: false, error: "ブラウザ環境でのみPDF抽出に対応しています。" };
  }
  let pdfjs;
  try {
    pdfjs = await loadPdfjs();
  } catch {
    return { ok: false, error: "PDF処理ライブラリの読み込みに失敗しました。" };
  }

  let doc;
  try {
    const buf = await file.arrayBuffer();
    doc = await pdfjs.getDocument({ data: buf }).promise;
  } catch {
    return { ok: false, error: "PDFを開けませんでした。ファイルが壊れている可能性があります。" };
  }

  const numPages = doc.numPages;
  const limit = Math.min(numPages, Number(maxPages) || numPages);
  const pages = [];
  let totalChars = 0;
  try {
    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => (it && typeof it.str === "string" ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ page: i, text });
      totalChars += text.length;
    }
  } catch {
    return { ok: false, error: "PDFのテキスト抽出中にエラーが発生しました。" };
  }

  const imageLikely = looksLikeImagePdf(totalChars, limit);
  if (imageLikely) {
    return {
      ok: false,
      numPages,
      pages,
      totalChars,
      imageLikely: true,
      error: "このPDFは画像中心のためテキスト抽出できません（テキスト選択できるPDFのみ対応）。",
    };
  }
  return { ok: true, numPages, pages, totalChars, imageLikely: false };

  // TODO(将来拡張): 画像中心PDF向けに、ブラウザ内OCR（例: tesseract.js）を
  // オプションで追加する。重いので既定では無効・明示オプト時のみとする。
}

/* 選択ページのテキストを結合して返す。 */
export function joinPages(pages, pageNumbers) {
  const wanted = new Set(pageNumbers);
  return (pages || [])
    .filter((p) => wanted.has(p.page))
    .map((p) => `--- p.${p.page} ---\n${p.text}`)
    .join("\n\n");
}
