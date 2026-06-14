import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { scanContent, runScan, FIXTURE_ALLOW } from "../scripts/securityScan.mjs";

const PKG = JSON.parse(readFileSync("package.json", "utf8"));
const GITIGNORE = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";

describe("secret-scan tooling exists", () => {
  it("scripts/securityScan.mjs exists", () => {
    expect(existsSync("scripts/securityScan.mjs")).toBe(true);
  });
  it("package.json has a security:scan script", () => {
    expect(PKG.scripts && PKG.scripts["security:scan"]).toBe("node scripts/securityScan.mjs");
  });
  it("scans GitHub workflow files too", () => {
    const scanner = readFileSync("scripts/securityScan.mjs", "utf8");
    expect(scanner).toContain('".github"');
  });
});

describe(".gitignore covers secrets", () => {
  it("ignores .env / .env.local / .env.*.local", () => {
    expect(GITIGNORE).toMatch(/^\.env$/m);
    expect(GITIGNORE).toMatch(/^\.env\.local$/m);
    expect(GITIGNORE).toMatch(/^\.env\.\*\.local$/m);
  });
  it("ignores service account / admin sdk json", () => {
    expect(GITIGNORE).toMatch(/^serviceAccount\*\.json$/m);
    expect(GITIGNORE).toMatch(/^\*service-account\*\.json$/m);
    expect(GITIGNORE).toMatch(/^firebase-adminsdk\*\.json$/m);
  });
  it("ignores node_modules / dist / .DS_Store", () => {
    expect(GITIGNORE).toMatch(/node_modules/);
    expect(GITIGNORE).toMatch(/dist/);
    expect(GITIGNORE).toMatch(/\.DS_Store/);
  });
});

/* ---- repository content guards ---- */
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (![".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".jar", ".woff", ".woff2", ".ttf"].includes(extname(name).toLowerCase())) {
      acc.push(p);
    }
  }
  return acc;
}
const SRC_PUB_TEST = [...walk("src"), ...walk("public"), ...walk("test"), ...walk(".github")];

describe("no secret material in src / public / test", () => {
  it("contains no private_key or firebase-adminsdk tokens", () => {
    const hits = SRC_PUB_TEST.filter((f) => {
      // the scan test file itself is allowed to mention tokens
      if (f.replace(/\\/g, "/").endsWith("test/secretScanStatic.test.js")) return false;
      const t = readFileSync(f, "utf8");
      return t.includes("private_key") || t.includes("firebase-adminsdk");
    });
    expect(hits).toEqual([]);
  });

  it("contains no external-AI endpoint / API key patterns", () => {
    const re = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY/;
    const hits = SRC_PUB_TEST.filter((f) => {
      if (f.replace(/\\/g, "/").endsWith("test/secretScanStatic.test.js")) return false;
      return re.test(readFileSync(f, "utf8"));
    });
    expect(hits).toEqual([]);
  });
});

/* ---- scanner behavior ----
 * scripts/ and test/ are NAME-exempt only; HARD still fires here, so any
 * real-looking secret material below MUST sit on a line carrying the literal
 * "secret-scan-allow-fixture" marker (which the scanner skips per-line). The
 * runtime VALUES (without the marker) are still fed to scanContent to prove
 * detection works. */
describe("securityScan detection logic", () => {
  it("FAILs on a PEM private key", () => {
    const fakePem = "-----BEGIN PRIVATE KEY-----\nMIIBfakekeymaterial\n-----END PRIVATE KEY-----"; // secret-scan-allow-fixture
    expect(scanContent(fakePem, { allowName: false }).some((x) => x.sev === "FAIL")).toBe(true);
  });
  it("FAILs on a service_account JSON marker", () => {
    const fakeSa = '{ "type": "service_account" }'; // secret-scan-allow-fixture
    expect(scanContent(fakeSa, { allowName: false }).some((x) => x.sev === "FAIL")).toBe(true);
  });
  it("FAILs on a long sk- key and external endpoint (not name-exempt)", () => {
    const fakeKey = "sk-ABCDEFGHIJ0123456789xyz"; // secret-scan-allow-fixture
    expect(scanContent(fakeKey, { allowName: false }).some((x) => x.sev === "FAIL")).toBe(true);
    expect(scanContent("fetch('https://api.openai.com/v1')", { allowName: false }).some((x) => x.sev === "FAIL")).toBe(true);
  });
  it("HARD still fires even when NAME is exempt (scripts/test are NOT HARD-exempt)", () => {
    const fakeSa = '{ "type": "service_account" }'; // secret-scan-allow-fixture
    // allowName:true mimics a NAME-exempt file (docs/scripts/test); HARD must still fire.
    expect(scanContent(fakeSa, { allowName: true }).some((x) => x.sev === "FAIL")).toBe(true);
  });
  it("treats a Firebase Web apiKey (AIza...) as WARN, not FAIL", () => {
    const fakeApiKey = "AIzaSyA1234567890_abcdefghijklmnopqrstuvwx"; // secret-scan-allow-fixture
    const f = scanContent(`apiKey: '${fakeApiKey}'`, { allowName: false });
    expect(f.some((x) => x.sev === "WARN")).toBe(true);
    expect(f.some((x) => x.sev === "FAIL")).toBe(false);
  });
  it("a fixture-marked line is skipped; the same content unmarked is detected", () => {
    const marked = "-----BEGIN PRIVATE KEY-----  // " + FIXTURE_ALLOW; // secret-scan-allow-fixture
    expect(scanContent(marked, { allowName: false })).toEqual([]);
    const unmarked = "-----BEGIN PRIVATE KEY-----abc"; // secret-scan-allow-fixture
    expect(scanContent(unmarked, { allowName: false }).some((x) => x.sev === "FAIL")).toBe(true);
  });
  it("does NOT FAIL name tokens in name-exempt files (docs/.gitignore/scripts/test)", () => {
    expect(scanContent("OPENAI_API_KEY のような名称の説明", { allowName: true }).some((x) => x.sev === "FAIL")).toBe(false);
  });
  it("returns nothing for ordinary content", () => {
    expect(scanContent("普通のコードと日本語\nconst x = 1;", { allowName: false })).toEqual([]);
  });
  it("the live repository scan reports zero FAIL findings", () => {
    const fails = runScan(process.cwd()).filter((x) => x.sev === "FAIL");
    expect(fails).toEqual([]);
  });
});
