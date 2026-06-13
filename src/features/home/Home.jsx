import { useEffect, useMemo, useState } from "react";
import { currentUid } from "../../services/firebase/client.js";
import * as records from "../../services/repository/recordsRepository.js";

/* ============================================================
 * Home — dashboard scaffold
 * ------------------------------------------------------------
 * Reference-note fix: Home used to read localStorage directly, which drifted
 * out of sync with Records/TeacherProblems (those went through a repository).
 * This version reads the SAME weekly rollup the rest of the app uses, so the
 * numbers always agree. It never touches storage directly.
 *
 * STATUS: documented migration target — not yet rendered by the live app.
 * Wire it in from App.jsx (see MIGRATION.md). Styling reuses the existing
 * .rx-home / .rx-hero / .rx-stats vocabulary from src/styles/app.css.
 * ============================================================ */

export default function Home({ uid = currentUid(), goalMinutes = 60, onOpen }) {
  const [week, setWeek] = useState(() => records.weekly(uid));

  // Re-read when the active user changes (uid-aware, like the rest of the app).
  useEffect(() => {
    setWeek(records.weekly(uid));
  }, [uid]);

  const pct = useMemo(
    () => Math.min(100, Math.round((week.today / Math.max(1, goalMinutes)) * 100)),
    [week.today, goalMinutes]
  );

  return (
    <div className="rx-home">
      <div className="rx-topbar">
        <div>
          <div className="rx-greet">おかえりなさい</div>
          <div className="rx-title">今日の学習</div>
        </div>
        <button className="rx-streak" onClick={() => onOpen && onOpen("records")}>
          🔥 {week.total}分 / 週
        </button>
      </div>

      <button className="rx-hero" onClick={() => onOpen && onOpen("records")}>
        <div className="rx-ringwrap">
          <svg className="rx-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent-soft)" strokeWidth="4" />
            <circle
              cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" strokeWidth="4"
              strokeDasharray={`${pct} 100`} strokeLinecap="round" transform="rotate(-90 18 18)"
            />
            <text x="18" y="21" textAnchor="middle" fontSize="9" fill="var(--ink)">{pct}%</text>
          </svg>
          <div>
            <div className="rx-goal-l">今日の学習時間</div>
            <div className="rx-goal-n">{week.today}分</div>
            <div className="rx-goal-s">目標 {goalMinutes}分</div>
          </div>
        </div>
      </button>

      <div className="rx-sec"><h3>今週の記録</h3></div>
      <div className="rx-stats">
        {week.days.map((d) => (
          <div className="rx-stat" key={d.key}>
            <div className="v">{d.minutes}</div>
            <div className="l">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
