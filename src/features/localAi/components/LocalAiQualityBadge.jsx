/* ============================================================
 * LocalAiQualityBadge — 品質チェックのカード表示（v5-4）
 * ------------------------------------------------------------
 * generateStrictJsonWithQuality が返す quality
 * （finalCheck / selfCheck / repaired / deterministic）を、
 * 先生が一目で判断できるカードで表示する。
 *   - 状態ピル（使用可能 / 使用注意 / 使用不可）で色分け
 *   - 重要な指摘（issues / mustFix / 決定的issues）は最初から表示
 *   - 注意（warnings）が複数あるときは折りたたみ（details）
 *   - 決定的チェックの状況を1行で表示
 * 過剰な発光・グラデーションは使わない（白カード＋淡い色帯）。
 * ============================================================ */

import { qualityStatusLabel, collectQualityFindings } from "../utils/localAiFormatters.js";

const PILL_CLASS = { usable: "ok", caution: "warn", blocked: "err" };

export default function LocalAiQualityBadge({ quality }) {
  if (!quality) return null;
  const finalCheck = quality.finalCheck || {};
  const selfCheck = quality.selfCheck || {};
  const status = finalCheck.status || "caution";
  const score = finalCheck.score != null ? finalCheck.score : selfCheck.score;
  const { major, minor, deterministic } = collectQualityFindings(quality);

  return (
    <div className={"lai-qa lai-qa-" + status}>
      <div className="lai-qa-top">
        <span className={"lai-pill " + (PILL_CLASS[status] || "warn")}>
          <span className="dot" />
          {qualityStatusLabel(status)}
        </span>
        <span className="lai-qa-score">品質チェック {score != null ? score : "-"} / 100</span>
      </div>

      <div className="lai-qa-line">自己検査: {selfCheck.summary || finalCheck.summary || "-"}</div>
      <div className="lai-qa-line">
        修正生成: {quality.repaired ? "実行済み" : "なし"}
        {quality.repaired && quality.repairReason ? `（${quality.repairReason}）` : ""}
      </div>

      {/* 重要な指摘は最初から見せる */}
      {major.length > 0 && (
        <ul className="lai-qa-major">
          {major.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {/* 注意は2件以上なら折りたたみ、1件ならそのまま */}
      {minor.length === 1 && <ul className="lai-qa-minor"><li>{minor[0]}</li></ul>}
      {minor.length > 1 && (
        <details className="lai-qa-more">
          <summary>注意 {minor.length} 件を表示</summary>
          <ul className="lai-qa-minor">
            {minor.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="lai-qa-det">
        決定的チェック: {deterministic.length ? `${deterministic.length}件の指摘` : "問題は見つかりませんでした"}
      </div>
    </div>
  );
}
