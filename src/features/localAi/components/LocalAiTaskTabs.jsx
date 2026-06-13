/* ============================================================
 * LocalAiTaskTabs — 6機能のタブバー
 * ------------------------------------------------------------
 * これまで LocalAiPage.jsx 内にインラインで書かれていた .lai-tabs の
 * 描画をそのまま部品化したもの（DOM・クラスは不変）。
 *   tabs    : [{ id, label }]（localAiTaskConfig.js の PANEL_TABS）
 *   current : 選択中タブ id
 *   onSelect: タブ選択ハンドラ
 * ============================================================ */

export default function LocalAiTaskTabs({ tabs, current, onSelect }) {
  return (
    <div className="lai-tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`lai-tab ${current === t.id ? "on" : ""}`}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
