/* F. ローカル処理の安全確認 / Ollama接続確認（旧 LocalAiPanel.jsx の HealthCheck） */
import { useState } from "react";
import { Actions, GenerateButton } from "../components/LocalAiInputBlock.jsx";
import { checkLocalAiHealth } from "../localAiClient.js";
import { generateStrictJsonWithQuality } from "../localAiQuality.js";
import { LOCAL_AI_TASKS } from "../localAiPrompts.js";

const healthTestSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    app: { type: "string" },
    message: { type: "string" },
  },
  required: ["ok", "app", "message"],
};

export default function ConnectionCheckPanel({ settings }) {
  const [state, setState] = useState(null); // { health, modelTest }
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setState(null);
    let health;
    try {
      health = await checkLocalAiHealth({ baseUrl: settings.baseUrl, model: settings.model });
    } catch (e) {
      health = { ok: false, reachable: false, error: e?.userMessage || e?.message || "接続先URLが許可されていません。" };
    }
    let modelTest = null;
    if (health.ok) {
      try {
        const r = await generateStrictJsonWithQuality({
          taskType: LOCAL_AI_TASKS.HEALTH_TEST,
          input: "",
          schema: healthTestSchema,
          model: settings.model,
          baseUrl: settings.baseUrl,
        });
        modelTest = r.ok ? "OK（短いJSONを受信）" : "応答あり（JSONは未整形）";
      } catch (e) {
        modelTest = "NG: " + ((e && (e.userMessage || e.message)) || "応答なし");
      }
    }
    setState({ health, modelTest });
    setBusy(false);
  };

  return (
    <div>
      <p className="lai-panel-sub">
        Ollamaの起動状態と、外部AIを使っていないことを確認します。
      </p>
      <Actions>
        <GenerateButton busy={busy} onClick={run}>
          {busy ? <><span className="lai-spin" />確認中…</> : "接続確認"}
        </GenerateButton>
      </Actions>
      {state && (
        <div className="lai-out text rx-selectable">
          {`Ollama接続: ${state.health.ok ? "OK" : "NG"}
接続先: ${settings.baseUrl}
モデル: ${settings.model}${state.health.ok && state.health.hasModel === false ? "（未取得の可能性）" : ""}
モデル応答テスト: ${state.modelTest || "—"}
外部AI API: 未使用
状態: ローカル処理のみ`}
          {!state.health.ok && <div className="lai-err" style={{ marginTop: 10 }}>{state.health.error}</div>}
          {state.health.ok && state.health.hasModel === false && (
            <div className="lai-err" style={{ marginTop: 10 }}>
              {`指定モデルが見つかりません。Ollamaで以下を実行してください。\n\nollama pull ${settings.model}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
