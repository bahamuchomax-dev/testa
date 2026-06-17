import "./home.css";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Real assets (Vite hashes + base-path-rewrites these, so GitHub Pages base works).
import bgUrl from "../../assets/home/1BA16E71-040A-4ADD-8EE6-383D57E63E42.png";
import charUrl from "../../assets/home/IMG_5092.png";

// Feature views — each is a self-contained screen.
import AnalysisView from "./views/AnalysisView.jsx";
import NoteView from "./views/NoteView.jsx";
import CalendarView from "./views/CalendarView.jsx";
import MoreView from "./views/MoreView.jsx";
import NoticesView, { unreadNoticesCount } from "./views/NoticesView.jsx";
import GiftView, { availableGiftsCount } from "./views/GiftView.jsx";
import TimerView from "./views/TimerView.jsx";
import RecordsView from "./views/RecordsView.jsx";
import ProfileView from "./views/ProfileView.jsx";
import SettingsView from "./views/SettingsView.jsx";
import VocabView from "./views/VocabView.jsx";
import CardView from "./views/CardView.jsx";
import QuizView from "./views/QuizView.jsx";
import ExamView from "./views/ExamView.jsx";
import ListenView from "./views/ListenView.jsx";
import DiaryView from "./views/DiaryView.jsx";
import PlansView from "./views/PlansView.jsx";
import FriendsView from "./views/FriendsView.jsx";
import FramesView from "./views/FramesView.jsx";

// Live study data (timer records here; the dashboard + views read from here).
import { useStudy, totalMinutes, streakDays, todayMinutes, weekSeries, fmtMinutes } from "./studyStore.js";
import { getFrame, frameRing } from "./iconFrames.js";
import { getAccount, accountAvatarImg, getRealStudy } from "./realAccount.js";
import { useTeacherPlan } from "./teacherPlan.js";

/* ============================================================
 * Home — Oriex new home (v2: big character).
 * ------------------------------------------------------------
 * Natural vertical FLOW (the page scrolls — not crammed into one screen):
 *   - a fixed-height HERO (character + profile + きょうの学習) so the absolute
 *     overlays keep their relationship on ANY viewport height
 *   - a BODY that flows below (chart/plan row, tools) and scrolls
 *   - a FIXED bottom nav (always visible)
 * The legacy app is a SEPARATE, mutually-exclusive mount (no nav API, no deep-link),
 * so every function is a self-contained in-home React view (src/features/home/views,
 * routed by VIEWS) backed by the shared studyStore — no switching to the original.
 * Only the heavy legacy-only features (育成 / FACTORY / 配信) keep an "元のアプリを開く"
 * fallback. No emojis — every glyph is an inline SVG matched to the character's look.
 * ============================================================ */

// localStorage flags the dispatcher (src/main.js) + oxUiPatches read.
const HOME_FLAG = "oriexHome"; // "1" => boot into this React home
const TOGGLE_FLAG = "oriexHomeToggle"; // "1" => legacy side shows a "新ホーム" button

/** Switch to the ORIGINAL (legacy) home: clear the home flag, keep the toggle so
 *  the legacy side offers a way back, strip the URL opt-in, and reload. */
function switchToOriginalHome() {
  try { window.localStorage.setItem(TOGGLE_FLAG, "1"); } catch { /* ignore */ }
  try { window.localStorage.removeItem(HOME_FLAG); } catch { /* ignore */ }
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete(HOME_FLAG);
    if (u.hash.replace(/^#/, "") === "oriex-home") u.hash = "";
    window.location.replace(u.toString());
  } catch {
    try { window.location.reload(); } catch { /* ignore */ }
  }
}

// --- inline SVG glyphs (no emoji) ------------------------------------------
const Horseshoe = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M7 4c-2 1.5-3 4-3 7 0 4 3 8 8 8s8-4 8-8c0-3-1-5.5-3-7"
      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
const Flame = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c0 3-1.5 6-3 8 0 4 2 7 3 11s3-7 3-11c-1.5-2-3-5-3-8z" fill="#e8273c" stroke="none" />
    <circle cx="12" cy="18" r="1.2" fill="#ff8a96" stroke="none" />
  </svg>
);
const BarChart = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="13" width="3.4" height="9" rx="1" fill="#3f8dff" stroke="none" />
    <rect x="10.3" y="7" width="3.4" height="15" rx="1" fill="#3f8dff" stroke="none" />
    <rect x="16.6" y="10" width="3.4" height="12" rx="1" fill="#e8273c" stroke="none" />
  </svg>
);
const Checklist = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="#3f8dff" strokeWidth="1.8" />
    <path d="M7.5 10l2 2 3.5-4" fill="none" stroke="#3f8dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 16l2 2 3.5-4" fill="none" stroke="#9aa3bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Trophy = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4h10v4a5 5 0 01-10 0z" fill="none" stroke="#ffd36e" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3M9 18h6M12 13v5" fill="none" stroke="#ffd36e" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const Swap = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </svg>
);
const Clock = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /></svg>
);
const Back = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
);
const Sparkle = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const Sun = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" fill="#ffd36e" stroke="none" />
    <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8"
      stroke="#ffd36e" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const Moon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8 8 0 119.5 4a6.4 6.4 0 0010.5 10.5z" fill="#9fc0ff" stroke="none" />
  </svg>
);

const TOOL_ICONS = {
  note: <><path d="M7 4h8l4 4v12H7z" fill="none" /><path d="M9 10h6M9 14h6" /></>,
  vocab: <><rect x="5" y="4" width="14" height="16" rx="2" fill="none" /><path d="M12 4v16" /></>,
  card: <><rect x="3" y="7" width="13" height="11" rx="2" fill="none" /><rect x="8" y="5" width="13" height="11" rx="2" fill="none" /></>,
  quiz: <><rect x="6" y="3" width="12" height="18" rx="2" fill="none" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  exam: <path d="M4 19V9M9 19V5M14 19v-7M19 19V8" strokeLinecap="round" />,
  listen: <><path d="M5 13a7 7 0 0114 0" fill="none" /><rect x="3" y="13" width="4" height="7" rx="1.5" fill="none" /><rect x="17" y="13" width="4" height="7" rx="1.5" fill="none" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" fill="none" /><path d="M4 9h16M8 3v4M16 3v4" /></>,
  more: <><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
};

const TOOLS = [
  { key: "note", label: "ノート", tone: "oxh-t-red" },
  { key: "vocab", label: "単語帳", tone: "oxh-t-blue" },
  { key: "card", label: "暗記カード", tone: "oxh-t-purple" },
  { key: "quiz", label: "問題集", tone: "oxh-t-crim" },
  { key: "exam", label: "模試", tone: "oxh-t-blue" },
  { key: "listen", label: "リスニング", tone: "oxh-t-orange" },
  { key: "calendar", label: "カレンダー", tone: "oxh-t-teal" },
  { key: "more", label: "その他", tone: "oxh-t-gray" },
];

const NAV = [
  { key: "home", label: "ホーム", icon: <><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></> },
  { key: "timer", label: "タイマー", icon: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></> },
  { key: "records", label: "記録", icon: <path d="M4 20V9M10 20V4M16 20v-8M22 20H2" /> },
  { key: "analysis", label: "分析", icon: <><path d="M12 3a9 9 0 109 9h-9z" /><path d="M12 3v9h9" /></> },
  { key: "profile", label: "マイページ", icon: (
    <>
      <path d="M7.6 4.6C5.5 6.1 4.2 8.5 4.2 11.5c0 4.5 3.5 8 7.8 8s7.8-3.5 7.8-8c0-3-1.3-5.4-3.4-6.9" />
      <circle cx="6.1" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7.9" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.9" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.1" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ) },
];

// Destination kind. Most keys now render a real in-home React view (see VIEWS),
// which takes precedence in the router. "legacy" here is only the FALLBACK panel
// ("元のアプリを開く") for the heavy legacy-only features we haven't rebuilt yet.
const DEST = {
  home: "home",
  timer: "view", records: "view", profile: "view", settings: "view",
  vocab: "view", card: "view", quiz: "view", exam: "view", listen: "view",
  diary: "view", plans: "view", friends: "view", frames: "view",
  analysis: "view", note: "view", calendar: "view", more: "view", notices: "view", gift: "view",
  // heavy legacy-only features — keep the "open the original app" switch for these
  hamster: "legacy", factory: "legacy", teacher: "legacy",
};
const LABELS = {
  home: "ホーム", timer: "タイマー", records: "記録", analysis: "分析", profile: "マイページ",
  note: "ノート", vocab: "単語帳", card: "暗記カード", quiz: "問題集", exam: "模試",
  listen: "リスニング", calendar: "カレンダー", more: "その他", notices: "お知らせ",
  gift: "ギフト", settings: "設定", diary: "学習日記", plans: "週計画", friends: "ひろば",
  hamster: "育成", factory: "FACTORY", teacher: "配信", frames: "アイコンフレーム",
};

// Keys that render a real built React screen (instead of the 準備中 / legacy panel).
const VIEWS = {
  timer: TimerView, records: RecordsView, analysis: AnalysisView,
  profile: ProfileView, settings: SettingsView,
  vocab: VocabView, card: CardView, quiz: QuizView, exam: ExamView, listen: ListenView,
  diary: DiaryView, plans: PlansView, friends: FriendsView,
  note: NoteView, calendar: CalendarView, more: MoreView, notices: NoticesView, gift: GiftView,
  frames: FramesView,
};

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

// あいさつバナー — 時間帯であいさつと一言が変わる（朝/昼/夜）。name は実アカウント名。
function greetingFor(name) {
  const h = new Date().getHours();
  const who = (name || "").trim() || "あなた";
  if (h < 5)  return { hi: `おつかれさま、${who}`, sub: "無理は禁物。少しだけ進めて、ゆっくり休もう。", night: true };
  if (h < 11) return { hi: `おはよう、${who}`,     sub: "今日もコツコツ積み上げて、理想の自分に近づこう！", night: false };
  if (h < 17) return { hi: `こんにちは、${who}`,   sub: "いまの一歩が、未来の自分をつくる。", night: false };
  if (h < 22) return { hi: `こんばんは、${who}`,   sub: "今日のがんばり、しっかり記録しておこう。", night: true };
  return { hi: `こんばんは、${who}`, sub: "無理は禁物。少しだけ進めて、ゆっくり休もう。", night: true };
}

// The user's real weekly plan (written by PlansView → localStorage "oxhPlans",
// keyed Mon..Sun). Flattened for the home's 今週の予定 card; null when none yet.
function readWeekPlans() {
  try {
    const o = JSON.parse(window.localStorage.getItem("oxhPlans") || "null");
    if (!o || typeof o !== "object") return null;
    const all = [];
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) =>
      (Array.isArray(o[d]) ? o[d] : []).forEach((t) => t && all.push(t)),
    );
    return all.length ? all : null;
  } catch {
    return null;
  }
}

export default function Home({ profile, onOpen = () => {} } = {}) {
  const [view, setView] = useState("home");
  const st = useStudy(); // live study data — the dashboard reflects recorded sessions

  // Persist the choice so reopening stays on this home, and enable the legacy-side
  // "新ホーム" toggle so the round-trip works. (The dispatcher already treats
  // localStorage.oriexHome==="1" as opt-in, so this is consistent.)
  useEffect(() => {
    try {
      window.localStorage.setItem(HOME_FLAG, "1");
      window.localStorage.setItem(TOGGLE_FLAG, "1");
    } catch { /* ignore */ }
  }, []);

  const acct = getAccount(); // real logged-in identity (null in the no-login preview)
  const avatarImg = accountAvatarImg(acct);
  const p = { name: (acct && acct.name) || "ヒカリ", totalSub: "コツコツ積み上げ中", streakSub: "この調子！", ...(profile || {}) };
  // History (累計/連続/レベル/7日) reflects the REAL account when signed in (legacy
  // study cache); otherwise the new-home tracker. きょうの学習 stays the new-home tracker.
  const realStudy = getRealStudy(acct);
  const totalMin = realStudy ? realStudy.total : totalMinutes(st);
  const totH = Math.floor(totalMin / 60);
  const totM = totalMin % 60;
  const streak = realStudy ? realStudy.streak : streakDays(st);
  const lvLevel = Math.floor(totalMin / 600) + 1; // a level per 10h
  const lvPct = Math.round(((totalMin - (lvLevel - 1) * 600) / 600) * 100);
  const todayMin = todayMinutes(st);
  const goalTarget = st.goalMin;
  const remain = Math.max(0, goalTarget - todayMin);
  const ws = realStudy ? realStudy.week : weekSeries(st);
  const wsMax = Math.max(...ws.map((d) => d.minutes), 1);
  const wsAvg = Math.round(ws.reduce((a, d) => a + d.minutes, 0) / 7);

  const teacherPlan = useTeacherPlan(); // 先生からの週計画 (live Firestore), or null
  const weekPlans = readWeekPlans();
  const planSrc = teacherPlan
    ? teacherPlan
    : weekPlans
    ? weekPlans.map((t) => ({ name: t.text, min: `${t.min || 0}分`, done: !!t.done }))
    : [];
  const planList = planSrc.slice(0, 6);
  const planDone = planList.filter((x) => x.done).length;
  const planTotal = planList.length;
  const initial = (p.name || "G").trim().charAt(0) || "G";
  const greet = greetingFor(p.name);
  // Live notification counts (re-read on each render — refreshed when you return
  // from お知らせ/ギフト). Badges hide at 0; マイページ's nav dot tracks unclaimed gifts.
  const noticeCount = unreadNoticesCount();
  const giftCount = availableGiftsCount();

  const go = (key) => {
    try { onOpen(key); } catch { /* ignore */ }
    if (key === "home") { setView("home"); return; }
    if (!DEST[key]) { setView("home"); return; }
    setView(key);
  };

  const navActive = NAV.some((n) => n.key === view) ? view : "home";

  // bottom nav — rendered in the home, or inside the sub-view portal (one at a time)
  const navEl = (
    <nav className="oxh-nav" aria-label="メインナビ">
      {NAV.map((n) => (
        <button
          key={n.key}
          className={n.key === navActive ? "oxh-navon" : ""}
          onClick={() => go(n.key)}
          aria-label={n.label}
          aria-current={n.key === navActive ? "page" : undefined}
        >
          {n.key === "profile" && giftCount > 0 && <span className="oxh-nd" />}
          <svg viewBox="0 0 24 24">{n.icon}</svg>
        </button>
      ))}
    </nav>
  );

  return (
    <div className={view === "home" ? "oxh" : "oxh oxh-subview"}>
      <div className="oxh-bg" style={{ backgroundImage: `url(${bgUrl})` }} />
      <div className="oxh-glow" />
      <div className="oxh-char" style={{ backgroundImage: `url(${charUrl})` }} />

      {view === "home" && (
        <>
          {/* HERO — fixed-height block so the character + overlays hold on any screen */}
          <div className="oxh-hero">
            <div className="oxh-top">
              <div className="oxh-brand"><Horseshoe />ORIEX</div>
              <button className="oxh-switch" onClick={switchToOriginalHome}>{Swap}元のホーム</button>
              <button className="oxh-tbtn" onClick={() => go("notices")} aria-label={`お知らせ${noticeCount > 0 ? ` 未読${noticeCount}件` : ""}`}>
                <svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 004 0" /></svg>
                {noticeCount > 0 && <span className="oxh-tdot">{noticeCount}</span>}
              </button>
              <button className="oxh-tbtn" onClick={() => go("gift")} aria-label={`ギフト${giftCount > 0 ? ` ${giftCount}件` : ""}`}>
                <svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M4 13h16M12 9v11" /></svg>
                {giftCount > 0 && <span className="oxh-tdot">{giftCount}</span>}
              </button>
              <button className="oxh-tbtn" onClick={() => go("settings")} aria-label="設定">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7 7 0 000-2l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 3h-5l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h5l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5z" /></svg>
              </button>
            </div>

            <div className="oxh-profile">
              <div className="oxh-pr-top">
                <div className="oxh-av" style={{ boxShadow: frameRing(getFrame()) === "none" ? undefined : frameRing(getFrame()) }}>
                  {avatarImg ? <img className="oxh-av-img" src={avatarImg} alt="" /> : initial}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="oxh-pr-name">{p.name}</div>
                  <div className="oxh-lvrow"><span className="oxh-lv">Lv. {lvLevel}</span><small>EXP {lvPct}%</small></div>
                </div>
              </div>
              <div className="oxh-exp"><i style={{ width: `${lvPct}%` }} /></div>
              <div className="oxh-stats">
                <div className="oxh-stat">
                  <div className="oxh-stat-k">累計学習時間</div>
                  <div className="oxh-stat-v">{totH}<small>時間</small>{totM}<small>分</small></div>
                  <div className="oxh-stat-s">{p.totalSub}</div>
                </div>
                <div className="oxh-stat">
                  <div className="oxh-stat-k">連続学習日数</div>
                  <div className="oxh-stat-v">{Flame}{streak}<small>日</small></div>
                  <div className="oxh-stat-s oxh-gold">{p.streakSub}</div>
                </div>
              </div>
            </div>

            {/* きょうの学習 — floats at the character's feet */}
            <div className="oxh-today">
              <div className="oxh-today-card">
                <div className="oxh-today-h"><Horseshoe />きょうの学習</div>
                <div className="oxh-today-goal"><span className="oxh-chip">目標</span>{goalTarget}分</div>
                <div className="oxh-today-big">{todayMin} <small>/ {goalTarget}分</small></div>
                <div className="oxh-today-note">{remain > 0 ? `あと${remain}分で達成！` : "目標達成！おつかれさま"}</div>
                <button className="oxh-timer-btn" onClick={() => go("timer")}>{Clock}タイマー</button>
              </div>
            </div>
          </div>

          {/* BODY — flows below the hero and scrolls */}
          <div className="oxh-body">
            {/* greeting banner — time-aware こんにちは + 一言, taps through to マイページ */}
            <button className="oxh-greet" onClick={() => go("profile")}>
              <span className="oxh-greet-av">
                {avatarImg ? <img src={avatarImg} alt="" /> : initial}
              </span>
              <span className="oxh-greet-tx">
                <span className="oxh-greet-hi"><span className="oxh-greet-ic">{greet.night ? Moon : Sun}</span>{greet.hi}！</span>
                <span className="oxh-greet-sub">{greet.sub}</span>
              </span>
              <svg className="oxh-greet-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l6 7-6 7M13 5l6 7-6 7" /></svg>
            </button>

            <div className="oxh-row2">
              <div className="oxh-card">
                <div className="oxh-card-h">{BarChart}7日間の記録<button className="oxh-more" onClick={() => go("records")}>詳細</button></div>
                <div className="oxh-chart">
                  {ws.map((d, i) => (
                    <div className={`oxh-bar${d.today ? " oxh-bar-t" : ""}`} key={i}>
                      <i style={{ height: `${Math.round((d.minutes / wsMax) * 100)}%` }} />
                      <span>{d.today ? "今" : DOW[d.dow]}</span>
                    </div>
                  ))}
                </div>
                <div className="oxh-avg">平均 <b>{fmtMinutes(wsAvg)}</b></div>
              </div>

              <div className="oxh-card">
                <div className="oxh-card-h">{Checklist}今週の予定<button className="oxh-more" onClick={() => go("plans")}>詳細</button></div>
                <div className="oxh-plan">
                  {planList.length ? (
                    planList.map((it) => (
                      <div className="oxh-pl" key={it.name}>
                        <span className={`oxh-box${it.done ? " oxh-on" : ""}`}>
                          {it.done && <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <span className={`oxh-nm${it.done ? " oxh-done" : ""}`}>{it.name}</span>
                        <span className="oxh-mn">{it.min}</span>
                      </div>
                    ))
                  ) : (
                    <div className="oxh-pl-empty">先生からの予定はまだありません</div>
                  )}
                </div>
                <div className="oxh-plan-foot">{Trophy}{planDone} / {planTotal}</div>
              </div>
            </div>

            <div className="oxh-tools">
              {TOOLS.map((t) => (
                <button className={`oxh-tool ${t.tone}`} key={t.key} onClick={() => go(t.key)}>
                  <span className="oxh-tool-ic"><svg viewBox="0 0 24 24">{TOOL_ICONS[t.key]}</svg></span>
                  <span className="oxh-tool-lb">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          {navEl}
        </>
      )}

      {view !== "home" &&
        createPortal(
          <div className="oxh oxh-portal">
            {VIEWS[view] ? (
              <FeatureView view={view} onBack={() => setView("home")} onOpen={go} />
            ) : (
              <SubView dest={view} onBack={() => setView("home")} />
            )}
            {navEl}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Renders a built feature view by key. The fixed bottom nav stays visible above it. */
function FeatureView({ view, onBack, onOpen }) {
  const V = VIEWS[view];
  return V ? <V onBack={onBack} onOpen={onOpen} /> : null;
}

/** A destination screen: either "準備中" (not built) or "元のアプリで開く" (lives in
 *  the legacy app). The fixed bottom nav stays visible above it. */
function SubView({ dest, onBack }) {
  const kind = DEST[dest] || "soon";
  const label = LABELS[dest] || dest;
  return (
    <div className="oxh-sub">
      <div className="oxh-sub-head">
        <button className="oxh-back" onClick={onBack} aria-label="戻る">{Back}</button>
        <span className="oxh-sub-title">{label}</span>
      </div>
      <div className="oxh-sub-body">
        <div className="oxh-soon-ico">{kind === "legacy" ? Clock : Sparkle}</div>
        {kind === "legacy" ? (
          <>
            <div className="oxh-soon-t">{label}</div>
            <p className="oxh-soon-p">この機能は現在のアプリで使えます。<br />元のホームに切り替えて開きます。</p>
            <button className="oxh-soon-cta" onClick={switchToOriginalHome}>{Swap}元のアプリを開く</button>
          </>
        ) : (
          <>
            <div className="oxh-soon-t">準備中</div>
            <p className="oxh-soon-p">「{label}」は現在準備しています。<br />もうしばらくお待ちください。</p>
          </>
        )}
      </div>
    </div>
  );
}
