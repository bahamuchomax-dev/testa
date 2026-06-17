import "./profile.css";
import {
  useStudy,
  level,
  totalMinutes,
  streakDays,
  weekSeries,
  subjectBreakdown,
  fmtMinutes,
} from "../studyStore.js";
import { getAccount, accountAvatarImg } from "../realAccount.js";

/* ============================================================
 * ProfileView — マイページ (profile / 実績)
 * ------------------------------------------------------------
 * Everything is read live from the shared study store (useStudy):
 *   1) header card — gradient-ring avatar + name + level + EXP bar
 *   2) 2x2 stat grid — 累計 / 連続 / 今週 / コイン
 *   3) 教科バランス — mini proportion bars (subjectBreakdown)
 *   4) 称号・バッジ — milestone badges (earned vs locked)
 *   5) link rows — 設定 / 学習日記 / ギフト (call onOpen)
 * Every selector in profile.css is prefixed with .oxv-pf.
 * No emoji — icons are inline <svg> only.
 * ============================================================ */

const FALLBACK_NAME = "ヒカリ";

/* ---- inline icons (line svg, no emoji) ---------------------------------- */
const IcClock = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8v4.2l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcFlame = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.6.7-2.5 1.4-3.3C11 7.8 11.4 6 12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 21a5 5 0 0 0 5-5c0-1.3-.4-2.4-1-3.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IcWeek = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="5" width="16" height="15" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 9.5h16M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 13.5l2.4 2.4L16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcCoin = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
    <path d="M12 9.2v5.6M10.3 12h3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IcSpark = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5l1.6 5 5 .6-3.7 3.3 1.1 4.9L12 14.8 8 17.3l1.1-4.9L5.4 9.1l5-.6L12 3.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const IcMedal = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 3l3 5 3-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="15" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 13l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3.9-1.8z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const IcCrown = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 8l3.5 3 4.5-6 4.5 6L20 8l-1.5 10h-13L4 8z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 18h13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IcLock = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IcCheck = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IcSettings = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M4.6 7.8l1.9 1.1M17.5 15.1l1.9 1.1M4.6 16.2l1.9-1.1M17.5 8.9l1.9-1.1" />
  </svg>
);
const IcDiary = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
    <path d="M5 18a2 2 0 0 1 2-2h11" />
    <path d="M9 8h6M9 11h4" />
  </svg>
);
const IcGift = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4.5" y="9.5" width="15" height="10.5" rx="1.5" />
    <path d="M3.5 9.5h17v3h-17zM12 9.5V20" />
    <path d="M12 9.5C9 9.5 8 4.5 12 6.2 16 4.5 15 9.5 12 9.5Z" />
  </svg>
);
const Chevron = (
  <svg className="oxv-pf-chev" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LINKS = [
  { key: "settings", label: "設定", desc: "アプリの設定を変える", tone: "blue", icon: IcSettings },
  { key: "diary", label: "学習日記", desc: "今日の学びをふり返る", tone: "red", icon: IcDiary },
  { key: "gift", label: "ギフト", desc: "コインや特典を受け取る", tone: "gold", icon: IcGift },
];

export default function ProfileView({ onBack, onOpen }) {
  const st = useStudy();

  // Identity is the REAL signed-in account (same as the home), not a placeholder.
  const acct = getAccount();
  const name = (acct && acct.name) || FALLBACK_NAME;
  const avatarImg = accountAvatarImg(acct);

  const lv = level(st);
  const total = totalMinutes(st);
  const streak = streakDays(st);
  const weekSum = weekSeries(st).reduce((a, d) => a + d.minutes, 0);
  const coins = st.coins;
  const breakdown = subjectBreakdown(st);

  // minutes left until the next level (a level every 10h = 600 min)
  const toNext = Math.max(0, lv.level * 600 - lv.xp);
  const maxSub = breakdown.length ? breakdown[0].minutes : 1;
  const initial = Array.from(name)[0] || name;

  const stats = [
    { key: "total", label: "累計", value: fmtMinutes(total), icon: IcClock, tone: "red" },
    { key: "streak", label: "連続", value: streak, unit: "日", icon: IcFlame, tone: "gold" },
    { key: "week", label: "今週", value: fmtMinutes(weekSum), icon: IcWeek, tone: "blue" },
    { key: "coins", label: "コイン", value: coins.toLocaleString("ja-JP"), icon: IcCoin, tone: "good" },
  ];

  const badges = [
    { id: "first", label: "はじめの一歩", note: "学習を記録する", icon: IcSpark, earned: total > 0, prog: total > 0 ? 1 : 0 },
    { id: "streak7", label: "7日の継続", note: "7日連続で学習", icon: IcFlame, earned: streak >= 7, prog: Math.min(1, streak / 7) },
    { id: "hours10", label: "10時間達成", note: "累計10時間を学習", icon: IcMedal, earned: total >= 600, prog: Math.min(1, total / 600) },
    { id: "lv5", label: "レベル5", note: "レベル5に到達", icon: IcCrown, earned: lv.level >= 5, prog: Math.min(1, lv.level / 5) },
    { id: "coins1k", label: "コイン1000", note: "1000コインを保有", icon: IcCoin, earned: coins >= 1000, prog: Math.min(1, coins / 1000) },
  ];
  const earnedCount = badges.filter((b) => b.earned).length;

  const open = (key) => {
    if (typeof onOpen === "function") onOpen(key);
  };

  return (
    <div className="oxh-sub oxv-pf">
      <div className="oxh-sub-head">
        <button className="oxh-back" onClick={onBack} aria-label="戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="oxh-sub-title">マイページ</span>
      </div>

      <div className="oxv-body">
        {/* 1) header card ------------------------------------------------- */}
        <div className="oxv-pf-hero">
          <div className="oxv-pf-glow" aria-hidden="true" />
          <div className="oxv-pf-id">
            <div className="oxv-pf-ring" aria-hidden="true">
              <div className="oxv-pf-avatar">
                {avatarImg ? <img className="oxv-pf-avatar-img" src={avatarImg} alt="" /> : initial}
              </div>
            </div>
            <div className="oxv-pf-who">
              <span className="oxv-pf-name">{name}</span>
              <span className="oxv-pf-lvtag">Lv.{lv.level}</span>
            </div>
          </div>

          <div className="oxv-pf-exp">
            <div className="oxv-pf-exp-top">
              <span className="oxv-pf-exp-label">EXP</span>
              <span className="oxv-pf-exp-val">{lv.xpPct}<small>%</small></span>
            </div>
            <div className="oxv-pf-exp-track">
              <i className="oxv-pf-exp-fill" style={{ width: `${lv.xpPct}%` }} />
            </div>
            <span className="oxv-pf-exp-foot">
              次のレベルまで あと <b>{fmtMinutes(toNext)}</b>
            </span>
          </div>
        </div>

        {/* 2) stat grid --------------------------------------------------- */}
        <div className="oxv-pf-stats">
          {stats.map((s) => (
            <div className={"oxv-pf-stat oxv-pf-t-" + s.tone} key={s.key}>
              <span className="oxv-pf-stat-ic" aria-hidden="true">{s.icon}</span>
              <span className="oxv-pf-stat-k">{s.label}</span>
              <span className="oxv-pf-stat-v">
                {s.value}{s.unit ? <small>{s.unit}</small> : null}
              </span>
            </div>
          ))}
        </div>

        {/* 3) 教科バランス ------------------------------------------------ */}
        <div className="oxv-pf-h"><span>教科バランス</span></div>
        <div className="oxv-pf-card">
          {breakdown.length === 0 ? (
            <p className="oxv-pf-empty">まだ記録がありません。学習すると教科の割合が表示されます。</p>
          ) : (
            <div className="oxv-pf-bal">
              {breakdown.map((s) => (
                <div className="oxv-pf-brow" key={s.key}>
                  <span className="oxv-pf-bname"><i style={{ background: s.color }} />{s.label}</span>
                  <span className="oxv-pf-btrack">
                    <i style={{ width: `${Math.max(4, Math.round((s.minutes / maxSub) * 100))}%`, background: s.color }} />
                  </span>
                  <span className="oxv-pf-bval">{fmtMinutes(s.minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4) 称号・バッジ ------------------------------------------------ */}
        <div className="oxv-pf-h">
          <span>称号・バッジ</span>
          <span className="oxv-pf-h-meta">{earnedCount}/{badges.length}</span>
        </div>
        <div className="oxv-pf-badges">
          {badges.map((b) => (
            <div className={"oxv-pf-badge" + (b.earned ? " is-earned" : "")} key={b.id}>
              <span className="oxv-pf-badge-ic" aria-hidden="true">{b.icon}</span>
              <span className="oxv-pf-badge-name">{b.label}</span>
              <span className="oxv-pf-badge-note">{b.note}</span>
              {b.earned ? (
                <span className="oxv-pf-badge-state is-on">
                  <span className="oxv-pf-badge-chk" aria-hidden="true">{IcCheck}</span>獲得
                </span>
              ) : (
                <span className="oxv-pf-badge-state">
                  <span className="oxv-pf-badge-chk" aria-hidden="true">{IcLock}</span>{Math.round(b.prog * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 5) link rows --------------------------------------------------- */}
        <div className="oxv-pf-links">
          {LINKS.map((l) => (
            <button
              type="button"
              className="oxv-pf-link"
              key={l.key}
              onClick={() => open(l.key)}
            >
              <span className={"oxv-pf-link-ic oxv-pf-t-" + l.tone} aria-hidden="true">{l.icon}</span>
              <span className="oxv-pf-link-txt">
                <span className="oxv-pf-link-label">{l.label}</span>
                <span className="oxv-pf-link-desc">{l.desc}</span>
              </span>
              {Chevron}
            </button>
          ))}
        </div>

        <p className="oxv-pf-foot">学べば学ぶほど、称号とコインが増えていきます。</p>
      </div>
    </div>
  );
}
