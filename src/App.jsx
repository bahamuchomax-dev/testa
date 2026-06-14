import { lazy, Suspense, useState } from "react";
import { currentUid } from "./services/firebase/client.js";
import Home from "./features/home/Home.jsx";
import Records from "./features/records/Records.jsx";
import Review from "./features/review/Review.jsx";
import Factory from "./features/factory/Factory.jsx";
import Profile from "./features/profile/Profile.jsx";
import TeacherProblems from "./features/teacher/TeacherProblems.jsx";

// Heavy 3D screen is code-split so it (and three.js usage) stays out of the
// initial bundle — matches the reference note about lazy-loading heavy views.
const HamsterRoom = lazy(() => import("./features/hamster/HamsterRoom.jsx"));

/* ============================================================
 * App - React migration scaffold that hosts migrated screens
 * ------------------------------------------------------------
 * This is the target root for the React/Vite rebuild. It is NOT yet mounted:
 * src/main.js still boots the original production bundle so the live app
 * keeps working untouched. Migration flips one screen at a time — render the
 * real component here, delete that screen from the bundle, repeat. When every
 * tab is migrated, point main.js at this file and drop src/legacy entirely.
 * See docs/REACT_MIGRATION_PLAN.md.
 *
 * Navigation reuses the existing .rx-tabbar styling.
 * ============================================================ */

const TABS = [
  { id: "home", label: "ホーム" },
  { id: "review", label: "復習" },
  { id: "factory", label: "単語" },
  { id: "hamster", label: "部屋" },
  { id: "profile", label: "マイ" },
];

export default function App() {
  const uid = currentUid();
  const [tab, setTab] = useState("home");

  return (
    <>
      {tab === "home" && <Home uid={uid} onOpen={setTab} />}
      {tab === "records" && <Records uid={uid} onBack={() => setTab("home")} />}
      {tab === "review" && <Review words={[]} history={{}} onBack={() => setTab("home")} />}
      {tab === "factory" && <Factory words={[]} onBack={() => setTab("home")} />}
      {/* TODO(react-shell): the "teacher" branch is intentionally NOT in TABS yet.
          This shell is unmounted (legacy bundle is live), so there is no live
          dead-end. When the shell goes live, add the tab ONLY for teachers
          (isTeacher(profile)) and keep TeacherProblems' own isTeacher/assertTeacher
          guards. "records" is reached from Home (onOpen), not the tab bar. */}
      {tab === "teacher" && <TeacherProblems uid={uid} onBack={() => setTab("home")} />}
      {tab === "profile" && <Profile uid={uid} onBack={() => setTab("home")} />}
      {tab === "hamster" && (
        <div className="rx-home">
          <div className="rx-sec"><h3>ハムスターの部屋</h3></div>
          <Suspense fallback={<div className="rx-trow-ls">読み込み中…</div>}>
            <HamsterRoom mood={60} />
          </Suspense>
        </div>
      )}

      {/* Local AI UI is temporarily paused. Keep src/features/localAi intact;
          restore LOCAL_AI_UI_ENABLED and a lazy route here when re-enabling. */}

      <nav className="rx-tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
