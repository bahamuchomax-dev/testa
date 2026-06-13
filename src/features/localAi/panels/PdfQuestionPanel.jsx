/* E. PDF教材から問題作成（旧 LocalAiPanel.jsx の PdfForm） */
import { useState } from "react";
import LocalAiResultView, { TextFallback, useGenerate } from "../components/LocalAiResultView.jsx";
import { Field, Select, Row, Actions, GenerateButton } from "../components/LocalAiInputBlock.jsx";
import { generateStrictJsonWithQuality } from "../localAiQuality.js";
import { LOCAL_AI_TASKS } from "../localAiPrompts.js";
import { pdfQuestionsSchema } from "../localAiSchemas.js";
import { extractPdfText, parsePageRange, joinPages } from "../pdfTextExtractor.js";
import { formatBodyOnly, formatWithDetails, formatPdfEvidence, findingsForQuestion } from "../utils/localAiFormatters.js";

const MAX_PDF_PAGES = 40;
const MAX_GEN_INPUT_CHARS = 8000;

export default function PdfQuestionPanel({ settings }) {
  const [extract, setExtract] = useState(null); // {ok,numPages,pages,error}
  const [extracting, setExtracting] = useState(false);
  const [pageSpec, setPageSpec] = useState("1-3");
  const [count, setCount] = useState(5);
  const [style, setStyle] = useState("4択");
  const [difficulty, setDifficulty] = useState("標準");
  const [withAnswers, setWithAnswers] = useState(true);
  const gen = useGenerate();

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    gen.clear();
    setExtract(null);
    setExtracting(true);
    const res = await extractPdfText(file, { maxPages: MAX_PDF_PAGES });
    setExtract(res);
    setExtracting(false);
  };

  const submit = () =>
    gen.run(async (signal) => {
      if (!extract || !extract.ok) return gen.fail("先にテキスト抽出できるPDFを読み込んでください。");
      const pageNums = parsePageRange(pageSpec, extract.numPages);
      if (!pageNums.length) return gen.fail("対象ページが選択されていません。例: 1-3");
      const text = joinPages(extract.pages, pageNums);
      if (!text.trim()) return gen.fail("選択ページからテキストを取得できませんでした。");
      if (text.length > MAX_GEN_INPUT_CHARS) {
        return gen.fail("入力が長すぎます。ページ範囲を絞ってください（目安: 数ページ）。");
      }
      const r = await generateStrictJsonWithQuality({
        taskType: LOCAL_AI_TASKS.PDF_QUESTION_GENERATION,
        input: text,
        context: { count, style, difficulty, withAnswers },
        schema: pdfQuestionsSchema,
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
      <Field label="PDF教材（ブラウザ内で本文を抽出。ファイルは外部に送信しません）">
        <input type="file" accept="application/pdf" className="rx-tf" aria-label="PDF教材を選択" onChange={onFile} />
        {extracting && <div className="lai-note"><span className="lai-spin" />テキストを抽出しています…</div>}
        {extract && extract.error && <div className="lai-err">{extract.error}</div>}
        {extract && extract.ok && (
          <>
            <div className="lai-note">全{extract.numPages}ページ・抽出{extract.totalChars}文字。対象ページを選んでください。</div>
            <div className="lai-pages">
              {extract.pages.slice(0, 12).map((p) => (
                <div className="lai-page" key={p.page}>
                  <b>p.{p.page}</b> {p.text.slice(0, 80)}{p.text.length > 80 ? "…" : ""}
                </div>
              ))}
            </div>
          </>
        )}
      </Field>

      {extract && extract.ok && (
        <>
          <Field label="対象ページ（例: 1-3, 5）">
            <input className="rx-tf" value={pageSpec} onChange={(e) => setPageSpec(e.target.value)} />
          </Field>
          <Field>
            <Row>
              <div>
                <label className="lai-label">問題数</label>
                <input className="rx-tf" type="number" min="1" max="20" value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))} />
              </div>
              <div>
                <label className="lai-label">形式</label>
                <Select value={style} onChange={(e) => setStyle(e.target.value)}
                  options={["4択", "空欄補充", "記述", "和訳", "用語確認", "模試風", "小テスト風"]} />
              </div>
              <div>
                <label className="lai-label">難易度</label>
                <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                  options={["やさしい", "標準", "難しい"]} />
              </div>
            </Row>
            <label className="lai-label" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} /> 解答をつける
            </label>
          </Field>
          <Actions>
            <GenerateButton busy={gen.busy} onClick={submit}>このPDFから問題を作る</GenerateButton>
          </Actions>
        </>
      )}

      <LocalAiResultView
        busy={gen.busy}
        error={gen.error}
        hasResult={!!gen.result}
        note={gen.result && gen.result.fallback ? gen.result.fallbackMsg : "このPDFの内容だけをもとに作成しています。"}
        filename="oriex-pdf-questions.txt"
        copyBody={() => formatBodyOnly(LOCAL_AI_TASKS.PDF_QUESTION_GENERATION, gen.result)}
        copyDetailed={() => formatWithDetails(LOCAL_AI_TASKS.PDF_QUESTION_GENERATION, gen.result)}
        onClear={gen.clear}
        quality={gen.result && gen.result.quality}
      >
        {d ? (
          <div className="lai-out">
            {d.sourceSummary && (
              <div className="lai-block"><h4>根拠にした本文の要約</h4><div>{d.sourceSummary}</div></div>
            )}
            <div className="lai-block">
              <h4>問題</h4>
              {(d.questions || []).map((q, i) => {
                const no = q.no || i + 1;
                const evidence = formatPdfEvidence(q);
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
                    {q.answer && <div className="lai-ans">解答: {q.answer}</div>}
                    {evidence && (
                      <div className="lai-evidence">
                        {q.sourcePage != null && String(q.sourcePage) !== "" && (
                          <span className="lai-evidence-page">根拠: p.{q.sourcePage}</span>
                        )}
                        {q.sourceQuote && <blockquote className="lai-evidence-quote">{q.sourceQuote}</blockquote>}
                      </div>
                    )}
                    {(isBlocked || fs.length > 0) && (
                      <div className="lai-q-warn err">
                        {fs.length ? fs.map((m, k) => <div key={k}>{m}</div>) : "この問題は根拠不足の可能性があります"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          gen.result && <TextFallback text={gen.result.text} />
        )}
      </LocalAiResultView>
    </div>
  );
}
