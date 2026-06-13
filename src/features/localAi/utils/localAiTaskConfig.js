/* ============================================================
 * localAiTaskConfig — 6機能のメタデータ（表示文言・schema対応）
 * ------------------------------------------------------------
 * 旧 LocalAiPanel.jsx の PANELS（title/sub）と PANEL_TABS（タブの
 * 短いラベル）を1か所に集約したもの。文言は変更していない。
 *   - tabLabel : タブバー表示の短いラベル（旧 PANEL_TABS.label）
 *   - title    : パネル見出し（旧 PANELS[id].title）
 *   - sub      : パネル説明（旧 PANELS[id].sub）
 *   - schemaKey: 出力スキーマ名（localAiSchemas.js のエクスポート名）
 *               ※実際のschemaオブジェクトは各panelが直接importする。
 *                 ここはタスク↔schema対応を一覧するためのメタ情報。
 *
 * id→Reactコンポーネントの対応は責務分離のため LocalAiPanel.jsx 側
 * （dispatcher）に置く。この設定ファイルはJSXを持たない。
 * ============================================================ */

import { LOCAL_AI_TASKS } from "../localAiPrompts.js";

export const LOCAL_AI_TASK_CONFIG = {
  [LOCAL_AI_TASKS.REVIEW_PLAN]: {
    tabLabel: "復習提案",
    title: "今日の復習提案",
    sub: "今日の学習記録から、明日やるべき復習を整理します。",
    schemaKey: "reviewPlanSchema",
  },
  [LOCAL_AI_TASKS.REPORT_CLEANUP]: {
    tabLabel: "報告書清書",
    title: "指導報告書を清書",
    sub: "先生のメモを、保護者・生徒に伝わる自然な文章に整えます。",
    schemaKey: null, // テキスト出力（schemaなし）
  },
  [LOCAL_AI_TASKS.VOCAB_QUIZ]: {
    tabLabel: "単語小テスト",
    title: "単語小テスト生成",
    sub: "登録済み単語から、範囲外を混ぜずに小テストを作ります。",
    schemaKey: "vocabQuizSchema",
  },
  [LOCAL_AI_TASKS.STUDENT_SUMMARY]: {
    tabLabel: "カルテ要約",
    title: "生徒カルテ要約",
    sub: "記録やメモをもとに、次回見るべき点を整理します。",
    schemaKey: "studentSummarySchema",
  },
  [LOCAL_AI_TASKS.PDF_QUESTION_GENERATION]: {
    tabLabel: "PDF問題",
    title: "PDF教材から問題作成",
    sub: "PDF本文から読み取れる範囲だけで問題を作ります。",
    schemaKey: "pdfQuestionsSchema",
  },
  [LOCAL_AI_TASKS.HEALTH_TEST]: {
    tabLabel: "接続確認",
    title: "接続確認",
    sub: "ローカル処理であること・外部AI未使用を確認します。",
    schemaKey: null, // 接続テスト用の短いschemaは ConnectionCheckPanel 内で定義
  },
};

/* タブバー用。旧 PANEL_TABS と同じ順序・同じ id/label。
 * （これらのキーは数値的でない文字列なので挿入順が保たれる） */
export const PANEL_TABS = Object.keys(LOCAL_AI_TASK_CONFIG).map((id) => ({
  id,
  label: LOCAL_AI_TASK_CONFIG[id].tabLabel,
}));
