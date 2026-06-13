/* ============================================================
 * LocalAiPanel — 機能パネルの dispatcher
 * ------------------------------------------------------------
 * 選択中タスク(task)に対応する見出し・説明（localAiTaskConfig.js）と
 * パネル本体（panels/*）を描画するだけの薄い振り分け役。
 * 各機能の入力フォーム・生成・結果表示は panels/* に分離した。
 * 共通UIは components/*、表示整形は utils/localAiFormatters.js。
 *
 * 旧実装（814行・全機能を1ファイルに同梱）からの分割であり、
 * プロンプト・schema・通信・自己検査・PDF抽出・保存方針・UI文言は
 * 一切変更していない（挙動は同一）。
 * ============================================================ */

import { LOCAL_AI_TASKS } from "./localAiPrompts.js";
import { LOCAL_AI_TASK_CONFIG } from "./utils/localAiTaskConfig.js";
import ReviewPlanPanel from "./panels/ReviewPlanPanel.jsx";
import ReportCleanupPanel from "./panels/ReportCleanupPanel.jsx";
import VocabQuizPanel from "./panels/VocabQuizPanel.jsx";
import StudentSummaryPanel from "./panels/StudentSummaryPanel.jsx";
import PdfQuestionPanel from "./panels/PdfQuestionPanel.jsx";
import ConnectionCheckPanel from "./panels/ConnectionCheckPanel.jsx";

const PANEL_COMPONENTS = {
  [LOCAL_AI_TASKS.REVIEW_PLAN]: ReviewPlanPanel,
  [LOCAL_AI_TASKS.REPORT_CLEANUP]: ReportCleanupPanel,
  [LOCAL_AI_TASKS.VOCAB_QUIZ]: VocabQuizPanel,
  [LOCAL_AI_TASKS.STUDENT_SUMMARY]: StudentSummaryPanel,
  [LOCAL_AI_TASKS.PDF_QUESTION_GENERATION]: PdfQuestionPanel,
  [LOCAL_AI_TASKS.HEALTH_TEST]: ConnectionCheckPanel,
};

export default function LocalAiPanel({ task, settings }) {
  // 未知のtaskは従来どおり復習提案にフォールバック。
  const id = LOCAL_AI_TASK_CONFIG[task] ? task : LOCAL_AI_TASKS.REVIEW_PLAN;
  const cfg = LOCAL_AI_TASK_CONFIG[id];
  const Comp = PANEL_COMPONENTS[id];
  return (
    <div className="lai-panel">
      <div className="lai-panel-h">{cfg.title}</div>
      <p className="lai-panel-sub">{cfg.sub}</p>
      <Comp settings={settings} />
    </div>
  );
}
