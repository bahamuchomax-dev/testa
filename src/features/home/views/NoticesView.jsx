import "./notices.css";
import { useMemo, useState } from "react";

const STORAGE_KEY = "oxhNoticesRead";

// Seeded demo notices (newest first).
const NOTICES = [
  {
    id: "n-2406-event",
    type: "イベント",
    title: "夏の特訓キャンペーン開催中",
    body: "6月20日から30日まで、毎日ログインで経験値が1.5倍になる「夏の特訓キャンペーン」を開催します。連続ログインボーナスも通常の2倍。ライバルに差をつけるチャンスです。",
    date: "2026-06-16",
  },
  {
    id: "n-2406-update",
    type: "更新",
    title: "単語クイズの判定を改善しました",
    body: "ひらがな・カタカナの表記ゆれを自動で許容するようになりました。スペルが惜しい場合のヒント表示も追加し、復習がよりスムーズになっています。",
    date: "2026-06-14",
  },
  {
    id: "n-2406-info",
    type: "お知らせ",
    title: "先生からの問題が届いています",
    body: "担当の先生から新しい配信問題が追加されました。ホーム画面の「先生からの問題」から取り組めます。期限のある課題は早めに確認しましょう。",
    date: "2026-06-12",
  },
  {
    id: "n-2406-maint",
    type: "お知らせ",
    title: "メンテナンスのお知らせ",
    body: "6月22日(月) 午前2時から4時まで、サーバーメンテナンスを実施します。この時間帯はアプリをご利用いただけません。ご不便をおかけしますがご了承ください。",
    date: "2026-06-10",
  },
  {
    id: "n-2405-update",
    type: "更新",
    title: "ダークテーマを刷新しました",
    body: "コントラストと視認性を高めた新しい配色に切り替えました。長時間の学習でも目が疲れにくいデザインを目指しています。設定からいつでも切り替え可能です。",
    date: "2026-05-30",
  },
];

const TYPE_CLASS = {
  "お知らせ": "oxv-no-tag-info",
  "更新": "oxv-no-tag-update",
  "イベント": "oxv-no-tag-event",
};

function loadRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRead(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — keep in-memory state only */
  }
}

/** Live unread-notice count (NOTICES minus the read set in localStorage). */
export function unreadNoticesCount() {
  const read = new Set(loadRead());
  return NOTICES.reduce((acc, n) => (read.has(n.id) ? acc : acc + 1), 0);
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function NoticesView({ onBack }) {
  const [read, setRead] = useState(() => loadRead());
  const [open, setOpen] = useState(null);

  const readSet = useMemo(() => new Set(read), [read]);
  const unreadCount = NOTICES.reduce(
    (acc, n) => (readSet.has(n.id) ? acc : acc + 1),
    0
  );

  const markRead = (id) => {
    if (readSet.has(id)) return;
    const next = [...read, id];
    setRead(next);
    saveRead(next);
  };

  const handleCard = (id) => {
    markRead(id);
    setOpen((cur) => (cur === id ? null : id));
  };

  const markAllRead = () => {
    const all = NOTICES.map((n) => n.id);
    setRead(all);
    saveRead(all);
  };

  return (
    <div className="oxh-sub oxv-no">
      <div className="oxh-sub-head">
        <button className="oxh-back" onClick={onBack} aria-label="戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="oxh-sub-title">お知らせ</span>
      </div>

      <div className="oxv-body">
        <div className="oxv-no-top">
          <div className="oxv-no-heading">
            <span className="oxv-no-h-title">通知</span>
            {unreadCount > 0 ? (
              <span className="oxv-no-count" aria-label={`未読${unreadCount}件`}>
                {unreadCount}
              </span>
            ) : (
              <span className="oxv-no-allset">すべて確認済み</span>
            )}
          </div>
          <button
            className="oxv-no-allread"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 12.5l4.5 4.5L20 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            すべて既読
          </button>
        </div>

        <ul className="oxv-no-list">
          {NOTICES.map((n) => {
            const isRead = readSet.has(n.id);
            const isOpen = open === n.id;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={
                    "oxv-no-card" +
                    (isRead ? "" : " oxv-no-unread") +
                    (isOpen ? " oxv-no-open" : "")
                  }
                  onClick={() => handleCard(n.id)}
                  aria-expanded={isOpen}
                >
                  <div className="oxv-no-row">
                    <span className={"oxv-no-tag " + TYPE_CLASS[n.type]}>
                      {n.type}
                    </span>
                    {!isRead && (
                      <span className="oxv-no-dot" aria-label="未読" />
                    )}
                    <span className="oxv-no-date">{formatDate(n.date)}</span>
                  </div>
                  <div className="oxv-no-title">{n.title}</div>
                  <p
                    className={
                      "oxv-no-text" + (isOpen ? " oxv-no-text-open" : "")
                    }
                  >
                    {n.body}
                  </p>
                  <div className="oxv-no-more">
                    <span>{isOpen ? "閉じる" : "もっと見る"}</span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="oxv-no-chev"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
