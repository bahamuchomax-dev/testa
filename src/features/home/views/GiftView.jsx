import "./gift.css";
import { useState } from "react";
import { useStudy, addCoins } from "../studyStore.js";

const STORE_KEY = "oxhGiftsClaimed";

/* ~5 demo gifts (claimable rewards) -------------------------------------- */
const GIFTS = [
  { id: "login",    name: "ログインボーナス",  desc: "毎日ログインで貰える特典",       amount: 50,  kind: "login" },
  { id: "streak7",  name: "7日連続達成",       desc: "7日連続で学習を継続しました",     amount: 200, kind: "streak" },
  { id: "levelup",  name: "レベルアップ報酬",  desc: "レベル10に到達しました",          amount: 100, kind: "level" },
  { id: "weekgoal", name: "週目標達成",        desc: "今週の学習目標をクリア",          amount: 150, kind: "goal" },
  { id: "invite",   name: "友だち招待",        desc: "友だちを1人招待しました",         amount: 300, kind: "invite" },
];

/* items that may begin already-claimed when nothing is stored yet */
const DEFAULT_CLAIMED = ["login"];

function loadClaimed() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
    }
  } catch {
    /* ignore corrupt / unavailable storage */
  }
  return DEFAULT_CLAIMED.slice();
}

function saveClaimed(ids) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ids));
  } catch {
    /* storage may be unavailable — non-fatal */
  }
}

/** Live count of gifts not yet claimed (drives the home badge + マイページ dot). */
export function availableGiftsCount() {
  const claimed = loadClaimed();
  return GIFTS.filter((g) => !claimed.includes(g.id)).length;
}

function GiftIcon({ kind }) {
  switch (kind) {
    case "streak": /* flame */
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.6-2.4 1.3-3.2C9.8 8.6 11 7 12 3z" />
          <path d="M12 21a5 5 0 0 0 5-5c0-1.3-.4-2.4-1-3.3" />
        </svg>
      );
    case "level": /* upward star burst */
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l2.4 5 5.5.6-4.1 3.7 1.2 5.4L12 15.9 7 17.7l1.2-5.4L4 8.6 9.5 8 12 3z" />
        </svg>
      );
    case "goal": /* target */
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "invite": /* two friends */
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
          <path d="M16 6.2a3 3 0 0 1 0 5.6" />
          <path d="M16.5 14.2c2.4.5 4 2.4 4 4.8" />
        </svg>
      );
    case "login":
    default: /* gift box */
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
          <path d="M3 7h18v3H3z" />
          <path d="M12 7v13" />
          <path d="M12 7C10.5 4 7 4 7 6.2 7 7.4 8.4 7 12 7zM12 7c1.5-3 5-3 5-.8 0 1.2-1.4.8-5 .8z" />
        </svg>
      );
  }
}

function CoinIcon() {
  return (
    <svg className="oxv-gf-coinsvg" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
      <path d="M12 9v6M10.3 12h3" />
    </svg>
  );
}

export default function GiftView({ onBack }) {
  const st = useStudy();
  const [claimed, setClaimed] = useState(loadClaimed);

  const balance = st.coins; // unified with the study store (the timer earns coins too)
  const available = GIFTS.filter((g) => !claimed.includes(g.id)).length;

  const claim = (id) => {
    if (claimed.includes(id)) return;
    const gift = GIFTS.find((g) => g.id === id);
    if (gift) addCoins(gift.amount); // adds to the shared coin balance
    const next = [...claimed, id];
    saveClaimed(next);
    setClaimed(next);
  };

  return (
    <div className="oxh-sub oxv-gf">
      <div className="oxh-sub-head">
        <button className="oxh-back" onClick={onBack} aria-label="戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="oxh-sub-title">ギフト</span>
      </div>

      <div className="oxv-body">
       <div className="oxv-gf-wrap">
        {/* coin balance banner */}
        <div className="oxv-gf-banner">
          <div className="oxv-gf-banner-glow" aria-hidden="true" />
          <div className="oxv-gf-coin" aria-hidden="true">
            <CoinIcon />
          </div>
          <div className="oxv-gf-banner-info">
            <span className="oxv-gf-banner-label">保有コイン</span>
            <span className="oxv-gf-balance">
              {balance.toLocaleString("ja-JP")}
              <span className="oxv-gf-unit">コイン</span>
            </span>
            <span className="oxv-gf-banner-sub">
              受け取れるギフトが{available}件あります
            </span>
          </div>
        </div>

        {/* claimable list */}
        <div className="oxv-gf-section">
          <h2 className="oxv-gf-sec-title">受け取れるギフト</h2>
          <ul className="oxv-gf-list">
            {GIFTS.map((g) => {
              const done = claimed.includes(g.id);
              return (
                <li
                  key={g.id}
                  className={"oxv-gf-card" + (done ? " is-done" : "")}
                >
                  <span className={"oxv-gf-ico oxv-gf-ico-" + g.kind} aria-hidden="true">
                    <GiftIcon kind={g.kind} />
                  </span>

                  <div className="oxv-gf-meta">
                    <span className="oxv-gf-name">{g.name}</span>
                    <span className="oxv-gf-desc">{g.desc}</span>
                    <span className="oxv-gf-amount">
                      <i className="oxv-gf-amount-coin" aria-hidden="true">
                        <CoinIcon />
                      </i>
                      +{g.amount.toLocaleString("ja-JP")}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="oxv-gf-btn"
                    onClick={() => claim(g.id)}
                    disabled={done}
                    aria-label={done ? g.name + " 受取済" : g.name + " を受け取る"}
                  >
                    {done ? (
                      <>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        受取済
                      </>
                    ) : (
                      "受け取る"
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="oxv-gf-foot">
          ギフトは予告なく内容が変更される場合があります。
        </p>
       </div>
      </div>
    </div>
  );
}
