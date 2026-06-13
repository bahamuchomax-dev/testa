/* ============================================================
 * localAiFormatters — 生成結果を「コピー/保存用テキスト」に整形
 * ------------------------------------------------------------
 * 純粋関数のみ（React/DOM/ネットワーク非依存）。各panelの結果を
 * .txt コピー/保存する際の本文を組み立てる。ロジックは旧
 * LocalAiPanel.jsx から変更なしで移設（挙動は同一）。
 * ============================================================ */

import { LOCAL_AI_TASKS } from "../localAiPrompts.js";

/* A. 今日の学習記録から復習提案 */
export function formatReview(d) {
  const lines = [];
  if (Array.isArray(d.priority)) {
    lines.push("【今日の復習優先度】");
    for (const p of d.priority) lines.push(`${p.level}：${p.item}（${p.reason}）`);
  }
  if (Array.isArray(d.tomorrowTasks) && d.tomorrowTasks.length) {
    lines.push("\n【明日やること】");
    d.tomorrowTasks.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  }
  if (Array.isArray(d.threeDayReview) && d.threeDayReview.length) {
    lines.push("\n【3日後に再確認】");
    d.threeDayReview.forEach((t) => lines.push(`・${t}`));
  }
  if (d.teacherNote) lines.push("\n【先生メモ】\n" + d.teacherNote);
  if (d.studentMessage) lines.push("\n【生徒へ】\n" + d.studentMessage);
  return lines.join("\n");
}

/* C. 単語リストから小テスト生成 */
export function formatQuiz(d, showAnswers) {
  const lines = ["【小テスト】"];
  (d.items || []).forEach((q, i) => {
    lines.push(`${q.no || i + 1}. ${q.question}`);
    if (Array.isArray(q.choices)) q.choices.forEach((c, j) => lines.push(`   ${String.fromCharCode(65 + j)}. ${c}`));
  });
  if (showAnswers) {
    lines.push("\n【解答】");
    (d.items || []).forEach((q, i) => {
      lines.push(`${q.no || i + 1}. ${q.answer}${q.explanation ? `  — ${q.explanation}` : ""}`);
    });
  }
  return lines.join("\n");
}

/* D. 生徒カルテの要約 */
export function formatSummary(d) {
  const out = [];
  if (d.current) out.push("【現状】\n" + d.current);
  if (Array.isArray(d.strengths) && d.strengths.length) out.push("\n【強み】\n" + d.strengths.map((s) => "・" + s).join("\n"));
  if (Array.isArray(d.issues) && d.issues.length) out.push("\n【課題】\n" + d.issues.map((s) => "・" + s).join("\n"));
  if (Array.isArray(d.nextFocus) && d.nextFocus.length) out.push("\n【次回見るべき点】\n" + d.nextFocus.map((s) => "・" + s).join("\n"));
  if (d.forGuardian) out.push("\n【保護者に伝えるなら】\n" + d.forGuardian);
  if (d.nextAction) out.push("\n【次の一手】\n" + d.nextAction);
  if (d.teacherOnlyNote) out.push("\n【先生だけが見る注意点】\n" + d.teacherOnlyNote);
  return out.join("\n");
}

/* E. PDF教材から問題作成 */
export function formatPdf(d) {
  const out = [];
  if (d.sourceSummary) out.push("【根拠にした本文の要約】\n" + d.sourceSummary + "\n");
  out.push("【問題】");
  (d.questions || []).forEach((q, i) => {
    out.push(`${q.no || i + 1}. ${q.question}`);
    if (Array.isArray(q.choices)) q.choices.forEach((c, j) => out.push(`   ${String.fromCharCode(65 + j)}. ${c}`));
    if (q.answer) out.push(`   解答: ${q.answer}`);
  });
  return out.join("\n");
}

/* ============================================================
 * v5-4: UI/コピー支援の純粋ヘルパー
 * ------------------------------------------------------------
 * 品質バッジ・根拠表示・本文/詳細コピーで共有する整形関数。
 * すべて純粋関数（React/DOM非依存）。
 * ============================================================ */

const QUALITY_STATUS_LABEL = {
  usable: "使用可能",
  caution: "使用注意",
  blocked: "使用不可",
};

/* 品質状態 → 日本語ラベル。未知/未設定は「使用注意」。 */
export function qualityStatusLabel(status) {
  return QUALITY_STATUS_LABEL[status] || "使用注意";
}

function uniqStrings(value) {
  return Array.from(
    new Set((Array.isArray(value) ? value : []).map((s) => String(s == null ? "" : s).trim()).filter(Boolean))
  );
}

/* 重大（issues / mustFix）と注意（warnings）に分けて集約。 */
export function collectQualityFindings(quality) {
  const sc = (quality && quality.selfCheck) || {};
  const det = (quality && quality.deterministic) || {};
  return {
    major: uniqStrings([...(sc.mustFix || []), ...(sc.issues || []), ...(det.issues || [])]),
    minor: uniqStrings([...(sc.warnings || []), ...(det.warnings || [])]),
    deterministic: uniqStrings([...(det.issues || []), ...(det.warnings || [])]),
  };
}

/* PDF1問分の根拠テキスト（"根拠: p.5" と「引用」）。無ければ空文字。 */
export function formatPdfEvidence(question) {
  if (!question || typeof question !== "object") return "";
  const parts = [];
  if (question.sourcePage != null && String(question.sourcePage) !== "") {
    parts.push(`根拠: p.${question.sourcePage}`);
  }
  const quote = String(question.sourceQuote == null ? "" : question.sourceQuote).trim();
  if (quote) parts.push(`「${quote}」`);
  return parts.join("\n");
}

/* blockedQuestionNumbers を表示用文字列に（例: "1、3問目"）。 */
export function describeBlockedQuestions(blockedQuestionNumbers) {
  const arr = (Array.isArray(blockedQuestionNumbers) ? blockedQuestionNumbers : []).filter((n) => n != null);
  if (!arr.length) return "";
  return arr.join("、") + "問目";
}

/* 決定的チェックの指摘のうち、特定の問題番号(no)に紐づくものだけ抽出。 */
export function findingsForQuestion(quality, no) {
  const det = (quality && quality.deterministic) || {};
  const all = [...(det.issues || []), ...(det.warnings || [])];
  const tag = `${no}問目`;
  return all.filter((m) => typeof m === "string" && m.indexOf(tag) !== -1);
}

/* 品質情報をテキスト化（詳細込みコピー用）。 */
export function qualityBlockText(quality) {
  if (!quality) return "";
  const fc = quality.finalCheck || {};
  const sc = quality.selfCheck || {};
  const lines = [
    `品質チェック: ${fc.score != null ? fc.score : sc.score != null ? sc.score : "-"} / 100`,
    `状態: ${qualityStatusLabel(fc.status)}`,
    `自己検査: ${sc.summary || fc.summary || "-"}`,
    `修正生成: ${quality.repaired ? "実行済み" : "なし"}`,
  ];
  if (quality.repaired && quality.repairReason) lines.push(`理由: ${quality.repairReason}`);

  const { major, minor, deterministic } = collectQualityFindings(quality);
  if (major.length) {
    lines.push("注意（重要）:");
    major.forEach((w) => lines.push(`- ${w}`));
  }
  if (minor.length) {
    lines.push("注意:");
    minor.forEach((w) => lines.push(`- ${w}`));
  }
  lines.push("決定的チェック:");
  if (deterministic.length) deterministic.forEach((w) => lines.push(`- ${w}`));
  else lines.push("- 問題は見つかりませんでした");

  return lines.join("\n");
}

/* PDFの根拠を全問まとめたテキスト（詳細込みコピー用）。 */
function pdfEvidenceBlockText(data, quality) {
  if (!data || !Array.isArray(data.questions)) return "";
  const det = (quality && quality.deterministic) || {};
  const blocked = new Set((det.blockedQuestionNumbers || []).map((n) => Number(n)));
  const out = ["【根拠】"];
  data.questions.forEach((q, i) => {
    const no = q && q.no != null ? q.no : i + 1;
    const ev = formatPdfEvidence(q).replace(/\n/g, " ");
    if (blocked.has(Number(no))) {
      out.push(`${no}. 根拠が不足している可能性があります${ev ? "（" + ev + "）" : ""}`);
    } else if (ev) {
      out.push(`${no}. ${ev}`);
    } else {
      out.push(`${no}. 根拠の記載がありません`);
    }
  });
  return out.join("\n");
}

/* 本文だけ（品質チェックや警告を含まない）。
 * - 小テストは問題本文のみ（解答なし）
 * - 報告書/カルテ/PDF/復習提案は本文整形
 * - schema崩れ/テキストタスクは result.text をそのまま */
export function formatBodyOnly(taskType, result) {
  const data = result && result.data;
  const text = (result && result.text) || "";
  if (!data) return text;
  switch (taskType) {
    case LOCAL_AI_TASKS.REVIEW_PLAN:
      return formatReview(data);
    case LOCAL_AI_TASKS.VOCAB_QUIZ:
      return formatQuiz(data, false);
    case LOCAL_AI_TASKS.STUDENT_SUMMARY:
      return formatSummary(data);
    case LOCAL_AI_TASKS.PDF_QUESTION_GENERATION:
      return formatPdf(data);
    default:
      return text;
  }
}

/* 詳細込み（本文＋PDF根拠＋品質チェック）。 */
export function formatWithDetails(taskType, result) {
  const data = result && result.data;
  const quality = result && result.quality;
  let body;
  if (!data) body = (result && result.text) || "";
  else if (taskType === LOCAL_AI_TASKS.VOCAB_QUIZ) body = formatQuiz(data, true); // 解答込み
  else body = formatBodyOnly(taskType, result);

  const sections = [body];
  if (data && taskType === LOCAL_AI_TASKS.PDF_QUESTION_GENERATION) {
    const ev = pdfEvidenceBlockText(data, quality);
    if (ev) sections.push(ev);
  }
  const qb = qualityBlockText(quality);
  if (qb) sections.push(qb);
  return sections.filter(Boolean).join("\n\n");
}
