/* ============================================================
 * LocalAiInputBlock — 共通入力UIの小さなプリミティブ
 * ------------------------------------------------------------
 * 各panelで重複していた入力欄マークアップを、見た目・クラス・DOM
 * 構造を一切変えずに共通化したもの。新しいUIは追加していない。
 *   Field          : <div class="lai-field"> ＋ 任意の <label>/<p hint>
 *   TextArea       : <textarea class="rx-tf lai-area">
 *   Select         : <select class="rx-tf"> ＋ <option>群
 *   Row            : <div class="lai-row">（横並びの列コンテナ）
 *   Actions        : <div class="lai-actions">（ボタン行）
 *   GenerateButton : <button class="lai-btn primary">（生成/実行ボタン）
 *
 * 数値入力・ファイル入力・チェックボックス等のpanel固有要素は、
 * 既存の見た目を保つため各panelにそのまま残している。
 * ============================================================ */

export function Field({ label, hint, labelStyle, children }) {
  return (
    <div className="lai-field">
      {label != null && <label className="lai-label" style={labelStyle}>{label}</label>}
      {hint != null && <p className="lai-panel-sub">{hint}</p>}
      {children}
    </div>
  );
}

export function TextArea({ value, onChange, placeholder }) {
  return <textarea className="rx-tf lai-area" value={value} onChange={onChange} placeholder={placeholder} />;
}

export function Select({ value, onChange, options }) {
  return (
    <select className="rx-tf" value={value} onChange={onChange}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

export function Row({ children }) {
  return <div className="lai-row">{children}</div>;
}

export function Actions({ children }) {
  return <div className="lai-actions">{children}</div>;
}

export function GenerateButton({ busy, onClick, children }) {
  return (
    <button className="lai-btn primary" disabled={busy} onClick={onClick}>
      {children}
    </button>
  );
}
