import { useMemo, useState } from "react";
import { wordKey } from "../../lib/wordKey.js";

/* ============================================================
 * Review — vocabulary review scaffold
 * ------------------------------------------------------------
 * Reference-note fixes:
 *   - the review set is a RANDOM sample, not the first 20 words.
 *   - words answered wrong are shown first.
 *   - history is keyed by wordKey() and carries { wordId, category, stage },
 *     so the same English term under a different category/stage is treated as
 *     a distinct card rather than being merged.
 *
 * `words` is a plain array of { id?, en, ja, category?, stage? }. `history`
 * maps wordKey -> { wrong: boolean }. In the full app these come from the
 * repository; here they're props so the component stays storage-agnostic.
 *
 * STATUS: documented migration target. Reuses .rx-home / .rx-q / .rx-cta /
 * .rx-cats. See MIGRATION.md.
 * ============================================================ */

function sampleDeck(words, history, size) {
  const wrongFirst = [...words].sort((a, b) => {
    const aw = history[wordKey(a)]?.wrong ? 1 : 0;
    const bw = history[wordKey(b)]?.wrong ? 1 : 0;
    if (aw !== bw) return bw - aw;            // wrong ones first
    return Math.random() - 0.5;               // then random
  });
  return wrongFirst.slice(0, Math.min(size, wrongFirst.length));
}

export default function Review({ words = [], history = {}, deckSize = 20, onGrade, onBack }) {
  // Build the deck once per mount (re-mount or change deckSize to reshuffle).
  const deck = useMemo(() => sampleDeck(words, history, deckSize), [words, history, deckSize]);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);

  if (deck.length === 0) {
    return (
      <div className="rx-home">
        {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}
        <div className="rx-sec"><h3>復習</h3></div>
        <div className="rx-trow-ls">復習できる単語がありません。</div>
      </div>
    );
  }

  const card = deck[i];
  const grade = (wrong) => {
    onGrade && onGrade(card, { wrong, key: wordKey(card), category: card.category, stage: card.stage });
    setShow(false);
    setI((n) => (n + 1) % deck.length);
  };

  return (
    <div className="rx-home">
      {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}
      <div className="rx-sec"><h3>復習 {i + 1} / {deck.length}</h3></div>

      <button className="rx-q" style={{ minHeight: 160, justifyContent: "center" }} onClick={() => setShow((s) => !s)}>
        <span style={{ fontSize: 22 }}>{card.en}</span>
        <span className="rx-trow-ls">{show ? card.ja : "タップで答えを表示"}</span>
      </button>

      {show && (
        <div className="rx-rec3" style={{ marginTop: 12 }}>
          <button className="rx-rec-s" onClick={() => grade(true)}><b>もう一度</b></button>
          <button className="rx-rec-s" onClick={() => grade(false)}><b>覚えた</b></button>
        </div>
      )}
    </div>
  );
}
