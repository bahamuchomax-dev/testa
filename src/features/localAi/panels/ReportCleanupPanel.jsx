/* B. 先生メモから指導報告書を清書（旧 LocalAiPanel.jsx の ReportForm） */
import { useState } from "react";
import LocalAiResultView, { useGenerate } from "../components/LocalAiResultView.jsx";
import { Field, TextArea, Select, Row, Actions, GenerateButton } from "../components/LocalAiInputBlock.jsx";
import { generateStrictJsonWithQuality } from "../localAiQuality.js";
import { LOCAL_AI_TASKS } from "../localAiPrompts.js";
import { formatBodyOnly, formatWithDetails } from "../utils/localAiFormatters.js";

export default function ReportCleanupPanel({ settings }) {
  const [memo, setMemo] = useState("");
  const [tone, setTone] = useState("通常");
  const [audience, setAudience] = useState("保護者向け");
  const gen = useGenerate();

  const submit = () =>
    gen.run(async (signal) => {
      if (!memo.trim()) return gen.fail("生成するには、先生メモまたは学習記録を入力してください。");
      const r = await generateStrictJsonWithQuality({
        taskType: LOCAL_AI_TASKS.REPORT_CLEANUP,
        input: memo,
        context: { tone, audience },
        model: settings.model,
        baseUrl: settings.baseUrl,
        signal,
      });
      return r;
    });

  return (
    <div>
      <Field label="先生メモ（授業内容・宿題・小テスト結果・次回課題など）">
        <TextArea value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      <Field>
        <Row>
          <div>
            <label className="lai-label">文体</label>
            <Select value={tone} onChange={(e) => setTone(e.target.value)} options={["通常", "やさしめ", "厳しめ"]} />
          </div>
          <div>
            <label className="lai-label">読み手</label>
            <Select value={audience} onChange={(e) => setAudience(e.target.value)} options={["保護者向け", "生徒向け"]} />
          </div>
        </Row>
      </Field>
      <Actions>
        <GenerateButton busy={gen.busy} onClick={submit}>報告書を清書する</GenerateButton>
      </Actions>
      <LocalAiResultView
        busy={gen.busy}
        error={gen.error}
        hasResult={!!gen.result}
        filename="oriex-report.txt"
        copyBody={() => formatBodyOnly(LOCAL_AI_TASKS.REPORT_CLEANUP, gen.result)}
        copyDetailed={() => formatWithDetails(LOCAL_AI_TASKS.REPORT_CLEANUP, gen.result)}
        onClear={gen.clear}
        quality={gen.result && gen.result.quality}
      >
        {gen.result && <div className="lai-out text lai-report rx-selectable">{gen.result.text}</div>}
      </LocalAiResultView>
    </div>
  );
}
