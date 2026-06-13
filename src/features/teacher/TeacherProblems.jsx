import { useState } from "react";
import { currentUid } from "../../services/firebase/client.js";
import * as tp from "../../services/repository/teacherProblemsRepository.js";
import * as profiles from "../../services/repository/profileRepository.js";
import { isTeacher, assertTeacher } from "../../services/firebase/authz.js";

/* ============================================================
 * TeacherProblems — teacher problem authoring scaffold
 * ------------------------------------------------------------
 * Reference-note design (do not collapse back into one record):
 *   - The student-visible problem (title/body/subject) and the ANSWER
 *     (answer/explanation) are stored SEPARATELY. Hiding the answer in the UI
 *     is not enough — if it ships in the payload, a student reads it in
 *     devtools. So the answer never reaches a student's browser.
 *   - listDelivered() returns problems WITHOUT answers, demonstrating exactly
 *     what a student would receive.
 *   - getAnswer() is teacher-only and is the only path that surfaces an answer.
 *
 * SECURITY: this split is necessary but NOT sufficient. Firestore Rules must
 * enforce that only teachers write problems/answers and that students can't
 * read teacherProblemAnswers/*. See MIGRATION.md (Rules section).
 *
 * STATUS: documented migration target. Reuses .rx-home / .rx-tf / .rx-cta /
 * .rx-talk. See MIGRATION.md.
 * ============================================================ */

export default function TeacherProblems({ uid = currentUid(), profile, onBack }) {
  // 先生権限はサーバ由来の profile から判定（role/isTeacher は Rules で保護）。
  // localStorage 開発時は既定で false（＝生徒が自分で先生化できない）。
  const myProfile = profile || profiles.get(uid);
  const teacher = isTeacher(myProfile);
  const [rows, setRows] = useState(() => (isTeacher(myProfile) ? tp.listDelivered(uid) : []));
  const [form, setForm] = useState({ title: "", body: "", subject: "", answer: "", explanation: "" });
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState({}); // problemId -> answer (teacher view only)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const refresh = () => setRows(tp.listDelivered(uid));

  const create = () => {
    setError("");
    try {
      assertTeacher(myProfile); // 先生専用関数: 非先生は実行不可
    } catch (e) {
      setError(e.message);
      return;
    }
    if (!form.title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    const res = tp.createProblem(uid, form);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm({ title: "", body: "", subject: "", answer: "", explanation: "" });
    refresh();
  };

  const reveal = (id) => {
    try {
      assertTeacher(myProfile);
    } catch {
      return;
    }
    setRevealed((r) => ({ ...r, [id]: tp.getAnswer(uid, id) }));
  };
  const del = (id) => {
    try {
      assertTeacher(myProfile);
    } catch {
      return;
    }
    tp.removeProblem(uid, id);
    refresh();
  };

  // 生徒（非先生）には先生専用UIを一切出さない。
  if (!teacher) {
    return (
      <div className="rx-home">
        {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}
        <div className="rx-sec"><h3>先生問題の作成</h3></div>
        <div className="rx-trow"><div className="rx-trow-ls">この画面は先生専用です。</div></div>
      </div>
    );
  }

  return (
    <div className="rx-home">
      {onBack && <button className="rx-back" onClick={onBack}>← 戻る</button>}
      <div className="rx-sec"><h3>先生問題の作成</h3></div>

      <input className="rx-tf" placeholder="タイトル" value={form.title} onChange={(e) => set({ title: e.target.value })} />
      <input className="rx-tf" style={{ marginTop: 8 }} placeholder="教科" value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
      <textarea className="rx-tf" style={{ marginTop: 8, minHeight: 80 }} placeholder="問題文（生徒に配信されます）" value={form.body} onChange={(e) => set({ body: e.target.value })} />
      <textarea className="rx-tf" style={{ marginTop: 8, minHeight: 60 }} placeholder="解答（生徒には送られません）" value={form.answer} onChange={(e) => set({ answer: e.target.value })} />
      <textarea className="rx-tf" style={{ marginTop: 8, minHeight: 60 }} placeholder="解説（生徒には送られません）" value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} />

      {error && <div className="rx-support-msg" role="alert" style={{ color: "#d4574e" }}>{error}</div>}
      <button className="rx-cta" style={{ marginTop: 10 }} onClick={create}>
        <span className="l">問題を作成</span>
        <span>＋</span>
      </button>

      <div className="rx-sec" style={{ marginTop: 16 }}><h3>配信中の問題（生徒が受け取る内容）</h3></div>
      <div className="rx-talk">
        {rows.length === 0 && <div className="rx-trow"><div className="rx-trow-ls">まだ問題がありません</div></div>}
        {rows.map((p) => (
          <div className="rx-trow" key={p.id}>
            <div style={{ flex: 1 }}>
              <div className="rx-trow-nm">
                {p.title}
                {p.subject && <span className="rx-tbadge" style={{ marginLeft: 6 }}>{p.subject}</span>}
              </div>
              <div className="rx-trow-ls">{p.body}</div>
              {/* The answer is NOT part of the delivered payload — it is fetched
                  separately and only by the teacher. */}
              {revealed[p.id]
                ? <div className="rx-trow-ls" style={{ marginTop: 4 }}>解答: {revealed[p.id].answer} ／ 解説: {revealed[p.id].explanation}</div>
                : <button className="rx-talkbtn" style={{ marginTop: 6 }} onClick={() => reveal(p.id)}>解答を表示（先生のみ）</button>}
            </div>
            <button className="rx-mini-danger" onClick={() => del(p.id)}>削除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
