import { useState } from "react";
import { wordKey } from "../../lib/wordKey.js";
import { colorForCategory } from "../../services/categoryColors.js";

/* ============================================================
 * Factory — word-list editor scaffold
 * ------------------------------------------------------------
 * Reference-note fix: delete used to key only on `id`. Legacy rows have no
 * id, so deleting one wiped EVERY id-less word at once. Here delete keys on
 * wordKey(), which removes exactly the intended row and correctly
 * distinguishes same-spelling words across categories/stages.
 *
 * `words` and `onChange` are props so the screen stays storage-agnostic; in
 * the full app these are backed by the repository.
 *
 * STATUS: documented migration target. Reuses .rx-home / .rx-talk row styles.
 * See MIGRATION.md.
 * ============================================================ */

export default function Factory({ words = [], onChange, onBack }) {
  const [list, setList] = useState(words);

  const removeByKey = (key) => {
    const next = list.filter((w) => wordKey(w) !== key);
    setList(next);
    onChange && onChange(next);
  };

  return (
    <div className="rx-home">
      {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}
      <div className="rx-sec"><h3>単語ファクトリー</h3></div>

      <div className="rx-talk">
        {list.length === 0 && <div className="rx-trow"><div className="rx-trow-ls">単語がありません</div></div>}
        {list.map((w) => {
          const key = wordKey(w);
          return (
            <div className="rx-trow" key={key}>
              <div style={{ flex: 1 }}>
                <div className="rx-trow-nm">
                  {w.en}
                  {w.category && (() => {
                    const c = colorForCategory(w.category);
                    return (
                      <span
                        className="rx-tbadge"
                        style={{ marginLeft: 6, background: c.softBg, color: c.accent }}
                      >
                        {w.category}
                      </span>
                    );
                  })()}
                  {w.stage != null && w.stage !== "" && <span className="rx-tbadge" style={{ marginLeft: 4 }}>St.{w.stage}</span>}
                </div>
                <div className="rx-trow-ls">{w.ja}</div>
              </div>
              <button className="rx-mini-danger" onClick={() => removeByKey(key)}>削除</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
