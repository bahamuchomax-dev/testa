import { useState } from "react";
import "./localAi.css";
import LocalAiPanel from "./LocalAiPanel.jsx";
import LocalAiSettings from "./LocalAiSettings.jsx";
import LocalAiTaskTabs from "./components/LocalAiTaskTabs.jsx";
import { checkLocalAiHealth, LOCAL_AI_STRICT_PRESET } from "./localAiClient.js";
import { loadSettings, saveSettings } from "./localAiStorage.js";
import { PANEL_TABS } from "./utils/localAiTaskConfig.js";

/* ============================================================
 * LocalAiPage — ローカルAI画面の全体
 * ------------------------------------------------------------
 * 上部に「ローカル処理である」ことの明記と接続情報・接続確認、
 * 折りたたみのモデル設定、機能タブ（6つ）と選択中パネルを置く。
 * ============================================================ */

export default function LocalAiPage({ className = "rx-home" }) {
  const [settings, setSettings] = useState(() => loadSettings());
  const [task, setTask] = useState(() => loadSettings().lastTab || PANEL_TABS[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [health, setHealth] = useState(null); // {ok, error, hasModel, ...}
  const [checking, setChecking] = useState(false);

  const updateSettings = (patch) => {
    const next = saveSettings(patch);
    setSettings(next);
  };

  const selectTask = (id) => {
    setTask(id);
    updateSettings({ lastTab: id });
  };

  const runHealth = async () => {
    setChecking(true);
    try {
      const h = await checkLocalAiHealth({ baseUrl: settings.baseUrl, model: settings.model });
      setHealth(h);
    } catch (e) {
      setHealth({ ok: false, reachable: false, error: e?.userMessage || e?.message || "接続先URLが許可されていません。" });
    } finally {
      setChecking(false);
    }
  };

  let pill = { cls: "idle", text: "未確認" };
  if (checking) pill = { cls: "idle", text: "確認中…" };
  else if (health && health.ok && health.hasModel !== false) pill = { cls: "ok", text: "接続OK" };
  else if (health && health.ok && health.hasModel === false) pill = { cls: "warn", text: "モデル未取得" };
  else if (health && !health.ok) pill = { cls: "err", text: "未接続" };

  return (
    <div className={`${className} lai-root`}>
      <div className="lai-head">
        <h2>ローカルAI</h2>
        <div className="lai-disc">
          このAIはローカルPC上のOllamaに接続して動作します。生徒情報や教材本文を外部AIサービスへ送信しません。<br />
          常に{LOCAL_AI_STRICT_PRESET.label}で生成するため、応答が遅くなる場合があります。
        </div>
        <div className="lai-kv">
          <span>接続先: <code>{settings.baseUrl}</code></span>
          <span>使用モデル: <code>{settings.model}</code></span>
        </div>
        <div className="lai-status">
          <span className={`lai-pill ${pill.cls}`}><span className="dot" />{pill.text}</span>
          <button className="lai-btn" disabled={checking} onClick={runHealth}>
            {checking ? <><span className="lai-spin" />接続確認</> : "接続確認"}
          </button>
          <button className="lai-btn ghost" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? "モデル設定を閉じる" : "モデル設定"}
          </button>
        </div>
        {health && !health.ok && (
          <div className="lai-err" style={{ marginTop: 10 }}>
            {health.error}
            {"\n\n確認方法:\n1. Ollamaを起動\n2. ターミナルで `ollama list` を確認\n3. モデルが無ければ `ollama pull " + settings.model + "`"}
          </div>
        )}
        {health && health.ok && health.hasModel === false && (
          <div className="lai-err" style={{ marginTop: 10 }}>
            {`指定されたモデルがOllamaに見つかりません。\n以下を実行してください。\n\nollama pull ${settings.model}`}
          </div>
        )}
        {showSettings && <LocalAiSettings settings={settings} onChange={updateSettings} />}
      </div>

      <LocalAiTaskTabs tabs={PANEL_TABS} current={task} onSelect={selectTask} />

      <LocalAiPanel task={task} settings={settings} />
    </div>
  );
}
