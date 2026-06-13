import { useState } from "react";
import { classifyBaseUrl, LOCAL_AI_MODEL_PROFILES, LOCAL_AI_STRICT_PRESET } from "./localAiClient.js";
import { MODEL_OPTIONS } from "./localAiStorage.js";

/* ============================================================
 * LocalAiSettings — モデル・接続先の設定
 * ------------------------------------------------------------
 * 接続先は localhost / 127.0.0.1 の Ollama のみ許可。APIキー欄は作らない。
 * 値は親が保持し、onChange(patch) で更新＆永続化する。
 * ============================================================ */

export default function LocalAiSettings({ settings, onChange }) {
  const initialCustom = settings.modelProfileId === LOCAL_AI_MODEL_PROFILES.custom.id || !MODEL_OPTIONS.includes(settings.model);
  const [customModel, setCustomModel] = useState(initialCustom);
  const cls = classifyBaseUrl(settings.baseUrl);
  const profiles = Object.values(LOCAL_AI_MODEL_PROFILES);
  const activeProfile = profiles.find((profile) => profile.id === settings.modelProfileId) || LOCAL_AI_MODEL_PROFILES.recommended;

  const selectProfile = (profileId) => {
    const profile = LOCAL_AI_MODEL_PROFILES[profileId] || LOCAL_AI_MODEL_PROFILES.recommended;
    setCustomModel(profile.id === LOCAL_AI_MODEL_PROFILES.custom.id);
    onChange({
      modelProfileId: profile.id,
      model: profile.id === LOCAL_AI_MODEL_PROFILES.custom.id ? settings.model : profile.model,
    });
  };

  return (
    <div className="lai-settings">
      <div className="lai-field">
        <label className="lai-label" htmlFor="lai-profile">モデルプロファイル</label>
        <select
          id="lai-profile"
          className="rx-tf"
          value={customModel ? LOCAL_AI_MODEL_PROFILES.custom.id : activeProfile.id}
          onChange={(e) => selectProfile(e.target.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.label}</option>
          ))}
        </select>
        <div className="lai-warn-inline ok">
          {customModel ? LOCAL_AI_MODEL_PROFILES.custom.description : activeProfile.description}
        </div>
      </div>

      <div className="lai-field">
        <label className="lai-label" htmlFor="lai-model">使用モデル</label>
        {customModel ? (
          <input
            id="lai-model"
            className="rx-tf"
            value={settings.model}
            placeholder="例: qwen2.5:14b-instruct"
            onChange={(e) => onChange({ model: e.target.value, modelProfileId: LOCAL_AI_MODEL_PROFILES.custom.id })}
          />
        ) : (
          <input
            id="lai-model"
            className="rx-tf"
            value={settings.model}
            readOnly
          />
        )}
        <button
          type="button"
          className="lai-btn ghost"
          style={{ marginTop: 6 }}
          onClick={() => {
            const next = !customModel;
            setCustomModel(next);
            onChange({
              modelProfileId: next ? LOCAL_AI_MODEL_PROFILES.custom.id : LOCAL_AI_MODEL_PROFILES.recommended.id,
              model: next ? settings.model : LOCAL_AI_MODEL_PROFILES.recommended.model,
            });
          }}
        >
          {customModel ? "推奨モデルに戻す" : "モデル名を直接入力"}
        </button>
      </div>

      <div className="lai-field">
        <label className="lai-label" htmlFor="lai-url">接続先URL（既定: http://localhost:11434）</label>
        <input
          id="lai-url"
          className="rx-tf"
          value={settings.baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
        />
        <div className={`lai-warn-inline ${cls.allowed ? "ok" : "err"}`}>
          {cls.allowed ? "✓ " : "⚠ "}{cls.reason}
        </div>
      </div>

      <div className="lai-field">
        <div className="lai-label">{LOCAL_AI_STRICT_PRESET.label}プリセット</div>
        <div className="lai-warn-inline warn">
          {LOCAL_AI_STRICT_PRESET.description} temperature {LOCAL_AI_STRICT_PRESET.temperature} / num_ctx {LOCAL_AI_STRICT_PRESET.numCtx} で固定します。応答が遅くなる場合があります。
        </div>
      </div>
    </div>
  );
}
