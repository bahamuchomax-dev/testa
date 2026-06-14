/* ============================================================
 * embeddedAiProbe — on-device readiness DIAGNOSTIC (phase 2)
 * ------------------------------------------------------------
 * Collects only device capability signals so a developer can judge, on a real
 * phone, whether an on-device AI engine could ever run here. It loads NO model
 * and NO AI library. Every read is wrapped so a missing API never throws and
 * never white-screens.
 *
 * Privacy / safety:
 *   - no permissions are requested (no location / contacts / photos / mic / camera),
 *   - nothing is transmitted over the network and nothing reaches the backend,
 *   - nothing is persisted automatically (no browser-storage writes here),
 *   - it reports capability flags + coarse estimates only.
 * ============================================================ */
import { hasWebGPU, hasIndexedDB, isLikelyMobile } from "./embeddedAiDevice.js";

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function uaString() {
  return safe(() => (typeof navigator !== "undefined" ? String(navigator.userAgent || "") : ""), "");
}

/* iPadOS 13+ reports a desktop-Mac UA, so also treat a touch "Macintosh" as iOS. */
export function isLikelyIos() {
  return safe(() => {
    const s = uaString();
    if (/iPhone|iPad|iPod/i.test(s)) return true;
    const touchMac =
      /Macintosh/i.test(s) && typeof navigator !== "undefined" && Number(navigator.maxTouchPoints) > 1;
    return !!touchMac;
  }, false);
}

export function isLikelyAndroid() {
  return safe(() => /Android/i.test(uaString()), false);
}

/* Safari = WebKit Safari that is NOT one of the Chromium/Firefox iOS variants. */
export function isLikelySafari() {
  return safe(() => {
    const s = uaString();
    return /Safari/i.test(s) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/i.test(s);
  }, false);
}

export function isLikelyChrome() {
  return safe(() => {
    const s = uaString();
    return /Chrome|Chromium|CriOS/i.test(s) && !/Edg|OPR/i.test(s);
  }, false);
}

/* navigator.storage.estimate() is async and may be missing/blocked. Never throws. */
async function readStorageEstimate() {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.estimate === "function"
    ) {
      const est = await navigator.storage.estimate();
      return {
        supported: true,
        quota: typeof est?.quota === "number" ? est.quota : null,
        usage: typeof est?.usage === "number" ? est.usage : null,
      };
    }
  } catch {
    // fall through to the unsupported shape
  }
  return { supported: false, quota: null, usage: null };
}

/* Gather the capability report. Async (storage estimate). Never throws. */
export async function collectEmbeddedAiProbeReport(_options = {}) {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const storageEstimate = await readStorageEstimate();
  return {
    userAgent: uaString(),
    platform: safe(() => (nav ? String(nav.platform || "") : ""), ""),
    language: safe(() => (nav ? String(nav.language || "") : ""), ""),
    online: safe(() => (nav ? nav.onLine !== false : false), false),
    secureContext: safe(() => {
      if (typeof window !== "undefined" && "isSecureContext" in window) return !!window.isSecureContext;
      if (typeof isSecureContext !== "undefined") return !!isSecureContext;
      return false;
    }, false),
    hasWebGpu: hasWebGPU(),
    hasIndexedDb: hasIndexedDB(),
    deviceMemory: safe(
      () => (nav && typeof nav.deviceMemory === "number" ? nav.deviceMemory : null),
      null,
    ),
    hardwareConcurrency: safe(
      () => (nav && typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null),
      null,
    ),
    storageEstimate,
    isLikelyMobile: isLikelyMobile(),
    isLikelyIos: isLikelyIos(),
    isLikelyAndroid: isLikelyAndroid(),
    isLikelySafari: isLikelySafari(),
    isLikelyChrome: isLikelyChrome(),
    timestamp: safe(() => new Date().toISOString(), ""),
  };
}

const LOW_STORAGE_QUOTA = 300 * 1024 * 1024; // ~300 MB coarse floor

/* Turn a report into a soft readiness judgement. Deliberately hedged:
 * "likely / limited / unlikely / unknown", not a guarantee. Never throws. */
export function summarizeEmbeddedAiReadiness(report) {
  if (!report || typeof report !== "object") {
    return {
      level: "unknown",
      reasons: ["診断情報を取得できませんでした。"],
      warnings: [],
      nextActions: ["ページを再読み込みして再診断してください。"],
    };
  }

  const reasons = [];
  const warnings = [];
  const nextActions = [];

  const { secureContext, hasIndexedDb, hasWebGpu, storageEstimate, deviceMemory } = report;
  const quota = storageEstimate && typeof storageEstimate.quota === "number" ? storageEstimate.quota : null;

  if (!secureContext) {
    warnings.push("secure context ではありません（HTTPS / localhost が必要）。");
  }
  if (quota === null) {
    warnings.push("ストレージ空き目安を取得できませんでした。実機で要確認。");
  }
  if (typeof deviceMemory === "number" && deviceMemory <= 4) {
    warnings.push("端末メモリ目安が小さめです（大型モデルは重い可能性）。");
  }

  if (!hasIndexedDb) {
    reasons.push("IndexedDB が使えないため、モデルを端末内に保持できません。");
    nextActions.push("別のブラウザ / 端末で再診断してください。");
    return { level: "unlikely", reasons, warnings, nextActions };
  }
  if (!secureContext) {
    reasons.push("secure context でないため、安全に有効化できません。");
    nextActions.push("HTTPS（GitHub Pages 等）で開いて再診断してください。");
    return { level: "unlikely", reasons, warnings, nextActions };
  }
  if (quota !== null && quota < LOW_STORAGE_QUOTA) {
    reasons.push("ストレージ空き目安が小さく、モデル保存が難しい可能性があります。");
    nextActions.push("空き容量を確保してから再診断してください。");
    return { level: "unlikely", reasons, warnings, nextActions };
  }

  if (hasWebGpu) {
    reasons.push("WebGPU・IndexedDB が利用でき、secure context です（動く可能性が高い）。");
    nextActions.push("フェーズ3で WebGPU 系 / 軽量モデルの実機検証へ。");
    return { level: "likely", reasons, warnings, nextActions };
  }

  reasons.push("IndexedDB は使えますが WebGPU がありません。WASM / 小型モデルなら可能性があります。");
  warnings.push("iPhone Safari など WebGPU 非対応環境では実機検証が必要です。");
  nextActions.push("フェーズ3で WASM / 小型モデル候補を実機検証へ。");
  return { level: "limited", reasons, warnings, nextActions };
}

/* Build a copy-friendly PLAIN-TEXT report (no HTML). Not sent or saved. */
export function formatEmbeddedAiProbeReport(report) {
  if (!report || typeof report !== "object") return "診断情報なし";
  const r = summarizeEmbeddedAiReadiness(report);
  const mb = (n) => (typeof n === "number" ? Math.round(n / (1024 * 1024)) + " MB" : "不明");
  const se = report.storageEstimate || {};
  return [
    "Oriex 埋め込みAI 実機診断（自動送信されません）",
    "timestamp: " + (report.timestamp || ""),
    "readiness: " + r.level,
    "secureContext: " + report.secureContext,
    "hasWebGpu: " + report.hasWebGpu,
    "hasIndexedDb: " + report.hasIndexedDb,
    "online: " + report.online,
    "deviceMemory: " + (report.deviceMemory ?? "不明"),
    "hardwareConcurrency: " + (report.hardwareConcurrency ?? "不明"),
    "storage.quota: " + mb(se.quota),
    "storage.usage: " + mb(se.usage),
    "mobile/ios/android: " + report.isLikelyMobile + " / " + report.isLikelyIos + " / " + report.isLikelyAndroid,
    "safari/chrome: " + report.isLikelySafari + " / " + report.isLikelyChrome,
    "platform: " + report.platform,
    "language: " + report.language,
    "userAgent: " + report.userAgent,
    "reasons: " + r.reasons.join(" / "),
    "warnings: " + (r.warnings.length ? r.warnings.join(" / ") : "なし"),
    "nextActions: " + r.nextActions.join(" / "),
  ].join("\n");
}
