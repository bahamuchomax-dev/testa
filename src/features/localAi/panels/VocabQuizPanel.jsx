/* C. 単語リストから小テスト生成（旧 LocalAiPanel.jsx の VocabQuizForm） */
import { useState } from "react";
import LocalAiResultView, { TextFallback, useGenerate } from "../components/LocalAiResultView.jsx";
import { Field, TextArea, Select, Row, Actions, GenerateButton } from "../components/LocalAiInputBlock.jsx";
import { generateStrictJsonWithQuality } from "../localAiQuality.js";
import { LOCAL_AI_TASKS } from "../localAiPrompts.js";
import { vocabQuizSchema } from "../localAiSchemas.js";
import { formatBodyOnly, formatWithDetails, findingsForQuestion } from "../utils/localAiFormatters.js";

export default function VocabQuizPanel({ settings }) {
  const [raw, setRaw] = useState("");
  const [count, setCount] = useState(10);
  const [style, setStyle] = useState("ランダム混合");
  const [showAnswers, setShowAnswers] = useState(false);
  const gen = useGenerate();

  const submit = () =>
    gen.run(async (signal) => {
      const words = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!words.length) return gen.fail("単語リストを入力してください（1行に1語、例: apple, りんご, 名詞）。");
      const r = await generateStrictJsonWithQuality({
        taskType: LOCAL_AI_TASKS.VOCAB_QUIZ,
        input: words.join("\n"),
        context: { count, style },
        schema: vocabQuizSchema,
        model: settings.model,
        baseUrl: settings.baseUrl,
        signal,
      });
      return r;
    });

  const d = gen.result && gen.result.data;
  const det = gen.result && gen.result.quality && gen.result.quality.deterministic;
  const blocked = new Set(((det && det.blockedQuestionNumbers) || []).map((n) => Number(n)));
  return (
    <div>
      <Field label="単語リスト（1行に1語：英単語, 和訳, 品詞, 例文）">
        <TextArea
          placeholder={"apple, りんご, 名詞\nrun, 走る, 動詞"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </Field>
      <Field>
        <Row>
          <div>
            <label className="lai-label">出題数</label>
            <input className="rx-tf" type="number" min="1" max="50" value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))} />
          </div>
          <div>
            <label className="lai-label">出題形式</label>
            <Select value={style} onChange={(e) => setStyle(e.target.value)}
              options={["ランダム混合", "英→日", "日→英", "4択", "空欄補充", "例文和訳"]} />
          </div>
        </Row>
      </Field>
      <Actions>
        <GenerateButton busy={gen.busy} onClick={submit}>小テストを作る</GenerateButton>
        {d && (
          <button className="lai-btn ghost" onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? "解答を隠す" : "解答を表示"}
          </button>
        )}
      </Actions>
      <LocalAiResultView
        busy={gen.busy}
        error={gen.error}
        hasResult={!!gen.result}
        note={gen.result && gen.result.fallback ? gen.result.fallbackMsg : null}
        filename="oriex-vocab-quiz.txt"
        copyBody={() => formatBodyOnly(LOCAL_AI_TASKS.VOCAB_QUIZ, gen.result)}
        copyDetailed={() => formatWithDetails(LOCAL_AI_TASKS.VOCAB_QUIZ, gen.result)}
        onClear={gen.clear}
        quality={gen.result && gen.result.quality}
      >
        {d ? (
          <div className="lai-out">
            {(d.items || []).map((q, i) => {
              const no = q.no || i + 1;
              const fs = findingsForQuestion(gen.result.quality, no);
              const isBlocked = blocked.has(Number(no));
              return (
                <div className="lai-q" key={i}>
                  <div>{no}. {q.question}</div>
                  {Array.isArray(q.choices) && (
                    <ul className="lai-choices">
                      {q.choices.map((c, j) => <li key={j}>{String.fromCharCode(65 + j)}. {c}</li>)}
                    </ul>
                  )}
                  {showAnswers && (
                    <div className="lai-ans">解答: {q.answer}{q.explanation ? ` — ${q.explanation}` : ""}</div>
                  )}
                  {(isBlocked || fs.length > 0) && (
                    <div className="lai-q-warn err">
                      {fs.length ? fs.map((m, k) => <div key={k}>{m}</div>) : "範囲外の単語が含まれている可能性があります"}
                    </div>
                  )}
                </div>
              );
            })}
            {!showAnswers && <div className="lai-answerkey lai-ans">解答は「解答を表示」で確認できます。</div>}
          </div>
        ) : (
          gen.result && <TextFallback text={gen.result.text} />
        )}
      </LocalAiResultView>
    </div>
  );
}
