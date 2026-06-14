#!/usr/bin/env node
/* ============================================================
 * securityScan.mjs — GitHub 公開前の「秘密情報混入」チェック
 * ------------------------------------------------------------
 * 目的: リポジトリに本物の秘密鍵 / Service Account JSON / 外部AIキー等が
 *       混入しにくくする。`npm run security:scan` で実行。
 *
 * 重要な区別（docs/SECRET_AUDIT.md 参照）:
 *   - Firebase **Web config の apiKey**（`AIza...`）は通常フロントに含まれてよい
 *     → WARN（報告のみ・exit 0）。
 *   - Service Account の **private_key / service_account JSON** は絶対に禁止
 *     → FAIL（exit 1）。
 *
 * 二段重大度:
 *   FAIL (exit 1): 実鍵 material・外部AIキー/エンドポイント・秘密名称（許可リスト外）
 *   WARN (exit 0): Firebase/Google Web apiKey 形（フロント可。SA 秘密鍵でないこと要確認）
 *
 * 許可リスト:
 *   FULL 許可は廃止。HARD/NAME をまとめて無視するファイルは作らない。
 *   scripts/securityScan.mjs と test/secretScanStatic.test.js は NAME 免除のみ。
 *     （検索パターン定義やテスト用 fake 値を含むが、本物の秘密 material は検出する）。
 *   docs/ 配下・.gitignore・package-lock.json も NAME 免除のみ。
 *     （秘密情報の「名称」を説明/無視設定/依存manifestとして正当に含むため）。
 *   HARD は原則全ファイルで検出する。
 *   テスト用 fake 値だけ `secret-scan-allow-fixture` の行マーカーで明示許可する。
 *
 * 最終 ZIP の中身は保証しない。ZIP 実物チェックは別レビューで行う。
 * ============================================================ */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";

const TARGET_DIRS = ["src", "public", "test", "docs", ".github"];
const TARGET_FILES = [
  "package.json",
  "package-lock.json",
  "index.html",
  "firebase.json",
  "firestore.rules",
  ".gitignore",
  "README.md",
];

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", ".vite", ".cache"]);
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".jar", ".zip", ".gz",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf", ".mp4", ".webm",
]);

// HARD: 実際の秘密 material / 外部AIキー → FAIL（exit 1）。
export const HARD = [
  { id: "pem-private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/, note: "PEM秘密鍵" },
  { id: "sa-json-type", re: /"type"\s*:\s*"service_account"/, note: "Service Account JSON" },
  { id: "sa-private-key", re: /"private_key"\s*:\s*"-----BEGIN/, note: "Service Account private_key" },
  { id: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}\b/, note: "OpenAI形式の秘密キー" },
];

// NAME: 秘密情報の名称・外部AIエンドポイント → 許可リスト外で FAIL。
export const NAME = [
  "private_key",
  "service_account",
  "client_secret",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "firebase-adminsdk",
];

// WARN: Firebase/Google Web apiKey 形（フロント可）→ 報告のみ（exit 0）。
export const WARN = [
  {
    id: "google-web-api-key",
    re: /\bAIza[0-9A-Za-z_-]{35,}\b/,
    note: "Google/Firebase Web apiKey 形（フロント可。Service Account 秘密鍵ではないこと要確認）",
  },
];

function toPosix(p) {
  return p.split(sep).join("/");
}

// 行単位の明示許可マーカー。この文字列を含む行は HARD/NAME/WARN すべてスキップする
// （テスト用の本物風 fake 値専用。レビューで可視・行スコープなので悪用しにくい）。
export const FIXTURE_ALLOW = "secret-scan-allow-fixture";

// NAME 免除（HARD は全ファイルで適用）:
//   - docs / .gitignore / 依存manifest … 秘密情報の「名称」を正当に含む
//   - scripts/securityScan.mjs / test/secretScanStatic.test.js … 検索パターン定義や
//     テスト用 fake を含むが、**本物の秘密 material(HARD) はここでも検出する**
//     （FULL 許可は廃止）。fake 値の HARD 検出回避は行マーカー FIXTURE_ALLOW で明示。
function isNameExempt(rel) {
  return (
    rel.startsWith("docs/") ||
    rel === ".gitignore" ||
    rel === "package-lock.json" ||
    rel === "scripts/securityScan.mjs" ||
    rel === "test/secretScanStatic.test.js"
  );
}

function redact(line) {
  const t = line.trim();
  return t.length > 120 ? t.slice(0, 117) + "..." : t;
}

/* 1ファイル分のテキストを走査して findings を返す（純粋関数・テスト容易）。 */
export function scanContent(text, { rel = "", allowName = false } = {}) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 明示許可マーカー（テスト用 fake 専用・行スコープ）。
    if (line.includes(FIXTURE_ALLOW)) continue;
    for (const h of HARD) {
      if (h.re.test(line)) findings.push({ sev: "FAIL", id: h.id, note: h.note, rel, line: i + 1, snippet: redact(line) });
    }
    if (!allowName) {
      for (const tok of NAME) {
        if (line.includes(tok)) findings.push({ sev: "FAIL", id: "name:" + tok, note: "秘密情報の名称/外部AIエンドポイント", rel, line: i + 1, snippet: redact(line) });
      }
    }
    for (const w of WARN) {
      if (w.re.test(line)) findings.push({ sev: "WARN", id: w.id, note: w.note, rel, line: i + 1, snippet: redact(line) });
    }
  }
  return findings;
}

function listFiles(root) {
  const out = [];
  for (const d of TARGET_DIRS) {
    const abs = join(root, d);
    if (existsSync(abs)) walk(abs, out);
  }
  for (const f of TARGET_FILES) {
    const abs = join(root, f);
    if (existsSync(abs) && statSync(abs).isFile()) out.push(abs);
  }
  return out;
}

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else if (st.isFile() && !BINARY_EXT.has(extname(name).toLowerCase())) acc.push(abs);
  }
}

/* リポジトリ全体を走査。findings 配列を返す。 */
export function runScan(root = process.cwd()) {
  const files = listFiles(root);
  const all = [];
  for (const abs of files) {
    const rel = toPosix(relative(root, abs));
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue; // 読めない/バイナリはスキップ
    }
    all.push(...scanContent(text, { rel, allowName: isNameExempt(rel) }));
  }
  return all;
}

function main() {
  const findings = runScan(process.cwd());
  const fails = findings.filter((f) => f.sev === "FAIL");
  const warns = findings.filter((f) => f.sev === "WARN");

  if (warns.length) {
    console.log(`\n⚠️  WARN (${warns.length}) — 要確認（フロント可の可能性）:`);
    for (const w of warns) console.log(`  [${w.id}] ${w.rel}:${w.line}  ${w.note}`);
  }
  if (fails.length) {
    console.error(`\n❌ FAIL (${fails.length}) — 秘密情報の混入の疑い:`);
    for (const f of fails) console.error(`  [${f.id}] ${f.rel}:${f.line}  ${f.snippet}`);
    console.error(`\nsecurity:scan 失敗。上記を除去してください（.env / Service Account / 外部AIキーは GitHub に入れない）。`);
    return 1;
  }
  console.log(`\n✅ security:scan OK — FAIL 0 件（WARN ${warns.length} 件）。`);
  console.log(`   ※ 最終 ZIP の中身は保証しません。ZIP 実物チェックは別レビューで実施してください。`);
  return 0;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) process.exit(main());
