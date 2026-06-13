/* D. 生徒カルテの要約（旧 LocalAiPanel.jsx の StudentSummaryForm） */
import { useState } from "react";
import LocalAiResultView, { TextFallback, useGenerate } from "../components/LocalAiResultView.jsx";
import { Field, TextArea, Actions, GenerateButton } from "../components/LocalAiInputBlock.jsx";
import { generateStrictJsonWithQuality } from "../localAiQuality.js";
import { LOCAL_AI_TASKS } from "../localAiPrompts.js";
import { studentSummarySchema } from "../localAiSchemas.js";
import { formatBodyOnly, formatWithDetails } from "../utils/localAiFormatters.js";

export default function StudentSummaryPanel({ settings }) {
  const [input, setInput] = useState("");
  const gen = useGenerate();

  const submit = () =>
    gen.run(async (signal) => {
      if (!input.trim()) return gen.fail("要約する生徒のカルテ情報を入力してください。");
      const r = await generateStrictJsonWithQuality({
        taskType: LOCAL_AI_TASKS.STUDENT_SUMMARY,
        input,
        schema: studentSummarySchema,
        model: settings.model,
        baseUrl: settings.baseUrl,
        signal,
      });
      return r;
    });

  const d = gen.result && gen.result.data;
  return (
    <div>
      <Field
        label="生徒カルテ（学習記録・指導メモ・小テスト結果・宿題達成・苦手単元など）"
        hint="選んだ1人の生徒の情報だけを貼ってください（複数生徒の一括処理はしません）。"
      >
        <TextArea value={input} onChange={(e) => setInput(e.target.value)} />
      </Field>
      <Actions>
        <GenerateButton busy={gen.busy} onClick={submit}>カルテを要約する</GenerateButton>
      </Actions>
      <LocalAiResultView
        busy={gen.busy}
        error={gen.error}
        hasResult={!!gen.result}
        note={gen.result && gen.result.fallback ? gen.result.fallbackMsg : null}
        filename="oriex-student-summary.txt"
        copyBody={() => formatBodyOnly(LOCAL_AI_TASKS.STUDENT_SUMMARY, gen.result)}
        copyDetailed={() => formatWithDetails(LOCAL_AI_TASKS.STUDENT_SUMMARY, gen.result)}
        onClear={gen.clear}
        quality={gen.result && gen.result.quality}
      >
        {d ? (
          <div className="lai-out">
            {d.current && <div className="lai-block"><h4>現状</h4><div>{d.current}</div></div>}
            {Array.isArray(d.strengths) && d.strengths.length > 0 && (
              <div className="lai-block"><h4>強み</h4><ul>{d.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {Array.isArray(d.issues) && d.issues.length > 0 && (
              <div className="lai-block"><h4>課題</h4><ul>{d.issues.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {Array.isArray(d.nextFocus) && d.nextFocus.length > 0 && (
              <div className="lai-block"><h4>次回見るべき点</h4><ul>{d.nextFocus.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {d.forGuardian && <div className="lai-block"><h4>保護者に伝えるなら</h4><div>{d.forGuardian}</div></div>}
            {d.nextAction && <div className="lai-block"><h4>次の一手</h4><div>{d.nextAction}</div></div>}
            {d.teacherOnlyNote && <div className="lai-block"><h4>先生だけが見る注意点</h4><div>{d.teacherOnlyNote}</div></div>}
          </div>
        ) : (
          gen.result && <TextFallback text={gen.result.text} />
        )}
      </LocalAiResultView>
    </div>
  );
}
