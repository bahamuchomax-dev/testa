/* A. 今日の学習記録から復習提案（旧 LocalAiPanel.jsx の ReviewPlanForm） */
import { useState } from "react";
import LocalAiResultView, { TextFallback, useGenerate } from "../components/LocalAiResultView.jsx";
import { Field, TextArea, Actions, GenerateButton } from "../components/LocalAiInputBlock.jsx";
import { generateStrictJsonWithQuality } from "../localAiQuality.js";
import { LOCAL_AI_TASKS } from "../localAiPrompts.js";
import { reviewPlanSchema } from "../localAiSchemas.js";
import { formatBodyOnly, formatWithDetails } from "../utils/localAiFormatters.js";
import * as records from "../../../services/repository/recordsRepository.js";
import { currentUid } from "../../../services/firebase/client.js";

export default function ReviewPlanPanel({ settings }) {
  const [input, setInput] = useState("");
  const gen = useGenerate();

  const loadToday = () => {
    const rows = records.list(currentUid());
    const today = new Date();
    const sameDay = (ts) => {
      const d = new Date(ts);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    };
    const todays = rows.filter((r) => sameDay(r.createdAt));
    if (!todays.length) {
      setInput((v) => v || "（今日のローカル学習記録は見つかりませんでした。手入力してください）");
      return;
    }
    const text = todays
      .map((r) => `・${r.subject || "学習"}：${r.minutes}分${r.note ? `（${r.note}）` : ""}`)
      .join("\n");
    setInput(`今日の学習記録\n${text}`);
  };

  const submit = () =>
    gen.run(async (signal) => {
      if (!input.trim()) return gen.fail("生成するには、今日の学習記録を入力してください。");
      const r = await generateStrictJsonWithQuality({
        taskType: LOCAL_AI_TASKS.REVIEW_PLAN,
        input,
        schema: reviewPlanSchema,
        model: settings.model,
        baseUrl: settings.baseUrl,
        signal,
      });
      return r;
    });

  const d = gen.result && gen.result.data;
  return (
    <div>
      <Field label="今日の学習記録（教科・時間・メモ・間違えた問題など）">
        <TextArea value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="lai-btn ghost" style={{ marginTop: 6 }} onClick={loadToday}>
          今日のローカル記録を読み込む
        </button>
      </Field>
      <Actions>
        <GenerateButton busy={gen.busy} onClick={submit}>復習提案を作る</GenerateButton>
      </Actions>
      <LocalAiResultView
        busy={gen.busy}
        error={gen.error}
        hasResult={!!gen.result}
        note={gen.result && gen.result.fallback ? gen.result.fallbackMsg : null}
        filename="oriex-review-plan.txt"
        copyBody={() => formatBodyOnly(LOCAL_AI_TASKS.REVIEW_PLAN, gen.result)}
        copyDetailed={() => formatWithDetails(LOCAL_AI_TASKS.REVIEW_PLAN, gen.result)}
        onClear={gen.clear}
        quality={gen.result && gen.result.quality}
      >
        {d ? (
          <div className="lai-out">
            {Array.isArray(d.priority) && (
              <div className="lai-block">
                <h4>今日の復習優先度</h4>
                <div className="lai-prio">
                  {d.priority.map((p, i) => (
                    <div className="lai-prio-row" key={i}>
                      <span className="lai-lv">{p.level}</span>
                      <span>{p.item}（{p.reason}）</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(d.tomorrowTasks) && d.tomorrowTasks.length > 0 && (
              <div className="lai-block">
                <h4>明日やること</h4>
                <ul>{d.tomorrowTasks.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {Array.isArray(d.threeDayReview) && d.threeDayReview.length > 0 && (
              <div className="lai-block">
                <h4>3日後に再確認</h4>
                <ul>{d.threeDayReview.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {d.teacherNote && (
              <div className="lai-block"><h4>先生メモ</h4><div>{d.teacherNote}</div></div>
            )}
            {d.studentMessage && (
              <div className="lai-block"><h4>生徒へ</h4><div>{d.studentMessage}</div></div>
            )}
          </div>
        ) : (
          gen.result && <TextFallback text={gen.result.text} />
        )}
      </LocalAiResultView>
    </div>
  );
}
