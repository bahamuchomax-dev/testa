import { useState } from "react";
import { currentUid } from "../../services/firebase/client.js";
import * as records from "../../services/repository/recordsRepository.js";

/* ============================================================
 * Records — study-log screen scaffold (React migration phase 3)
 * ------------------------------------------------------------
 * Safety baked in (phase 3 minimal hardening):
 *   - 0-minute logs are impossible. parsePositiveMinutes (in the repository)
 *     rejects anything under 1 minute, including 0.4, and the UI surfaces the
 *     returned error instead of silently writing a junk row.
 *   - the free-text subject field has an explicit maxLength
 *     (RECORDS_SUBJECT_MAX_LENGTH) and is sanitized with sanitizePlainText in
 *     recordsRepository.add() before it is persisted (tags / dangerous schemes
 *     stripped, length clamped; normal Japanese is preserved).
 *   - no uid -> no write. submit/delete guard on uid before calling the repo.
 *   - manual entries are tagged source:"manual"; a failed write shows an error.
 *   - rows render with plain {text} expressions; no raw-HTML sinks are used.
 *
 * STATUS: still NOT a production route. src/main.js boots the legacy bundle and
 * the live learning-record screen is the legacy one. This component is only
 * reachable from the (unmounted) App.jsx scaffold. Storage is still localStorage
 * via recordsRepository; Firestore migration is a later phase (see
 * docs/REACT_MIGRATION_PLAN.md). Reuses .rx-home / .rx-tf / .rx-cta / .rx-talk.
 * ============================================================ */

export default function Records({ uid = currentUid(), onBack }) {
  const recordUid = uid || "";
  const [rows, setRows] = useState(() => records.list(recordUid));
  const [minutes, setMinutes] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");

  const refresh = () => setRows(records.list(recordUid));

  const submit = () => {
    setError("");
    if (!recordUid) {
      setError("ログイン状態を確認してから記録してください。");
      return;
    }
    const res = records.add(recordUid, { minutes, subject, source: "manual" });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMinutes("");
    setSubject("");
    refresh();
  };

  const del = (id) => {
    if (!recordUid) {
      setError("ログイン状態を確認してから削除してください。");
      return;
    }
    records.remove(recordUid, id);
    refresh();
  };

  return (
    <div className="rx-home">
      {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}
      <div className="rx-sec"><h3>学習記録</h3></div>

      <input
        className="rx-tf"
        type="number"
        inputMode="numeric"
        min="1"
        placeholder="学習時間（分）"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <input
        className="rx-tf"
        style={{ marginTop: 8 }}
        placeholder="教科（任意）"
        maxLength={records.RECORDS_SUBJECT_MAX_LENGTH}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      {error && (
        <div className="rx-support-msg" role="alert" style={{ color: "#d4574e" }}>{error}</div>
      )}
      <button className="rx-cta" style={{ marginTop: 10 }} onClick={submit}>
        <span className="l">記録する</span>
        <span>＋</span>
      </button>

      <div className="rx-sec" style={{ marginTop: 16 }}><h3>履歴</h3></div>
      <div className="rx-talk">
        {rows.length === 0 && <div className="rx-trow"><div className="rx-trow-ls">まだ記録がありません</div></div>}
        {rows.map((r) => (
          <div className="rx-trow" key={r.id}>
            <div style={{ flex: 1 }}>
              <div className="rx-trow-nm">{r.subject || "学習"} ・ {r.minutes}分</div>
              <div className="rx-trow-ls">{new Date(r.createdAt).toLocaleString("ja-JP")}</div>
            </div>
            <button className="rx-mini-danger" onClick={() => del(r.id)}>削除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
