import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  escapeHtml,
  stripDangerousHtml,
  sanitizePlainText,
  sanitizeUrl,
  hasLikelyXss,
} from "../src/services/security/sanitizeText.js";

describe("sanitizePlainText / stripDangerousHtml", () => {
  it("neutralizes <script>alert(1)</script>", () => {
    const out = sanitizePlainText("<script>alert(1)</script>");
    expect(out).not.toMatch(/<script/i);
    expect(stripDangerousHtml("<script>alert(1)</script>")).not.toMatch(/<script/i);
  });

  it("neutralizes <img src=x onerror=alert(1)>", () => {
    const out = sanitizePlainText("<img src=x onerror=alert(1)>");
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/<img/i);
    // stripDangerousHtml keeps the <img> tag but removes the handler
    expect(stripDangerousHtml("<img src=x onerror=alert(1)>")).not.toMatch(/onerror/i);
  });

  it("strips iframe / object / embed / link / meta / style blocks", () => {
    expect(stripDangerousHtml("<iframe src=evil></iframe>")).not.toMatch(/<iframe/i);
    expect(stripDangerousHtml('<style>body{x:y}</style>hi')).toBe("hi");
    expect(stripDangerousHtml('<link rel=import>')).not.toMatch(/<link/i);
  });

  it("removes javascript: and data:text/html schemes from text", () => {
    expect(sanitizePlainText("click javascript:alert(1) here")).not.toMatch(/javascript:/i);
    expect(sanitizePlainText("data:text/html,<b>")).not.toMatch(/data:text\/html/i);
  });

  it("does NOT break ordinary Japanese, English, digits, newlines or tabs", () => {
    const ok = "こんにちは、世界。Hello 123\n2行目\tタブ";
    expect(sanitizePlainText(ok)).toBe(ok);
  });

  it("does NOT eat a lone '<' that isn't a real tag", () => {
    expect(sanitizePlainText("3 < 5 かつ a<b")).toBe("3 < 5 かつ a<b");
  });
});

describe("escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });
  it("does not double-escape", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
});

describe("sanitizeUrl", () => {
  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("  JavaScript:alert(1)")).toBe("");
    expect(sanitizeUrl("java\tscript:alert(1)")).toBe("");
  });
  it("blocks data: URLs (incl. data:text/html)", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeUrl("data:image/png;base64,AAAA")).toBe("");
  });
  it("blocks protocol-relative and UNC-style URLs", () => {
    expect(sanitizeUrl("//evil.example/x")).toBe("");
    expect(sanitizeUrl("\\\\evil.example\\x")).toBe("");
  });
  it("allows http(s), mailto, tel, relative and fragments", () => {
    expect(sanitizeUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(sanitizeUrl("http://localhost:11434")).toBe("http://localhost:11434");
    expect(sanitizeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(sanitizeUrl("tel:+810000000000")).toBe("tel:+810000000000");
    expect(sanitizeUrl("/relative/path")).toBe("/relative/path");
    expect(sanitizeUrl("#frag")).toBe("#frag");
  });
  it("allows only same-origin blob URLs", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
    Object.defineProperty(globalThis, "location", {
      value: { origin: "https://oriex.example" },
      configurable: true,
    });
    try {
      expect(sanitizeUrl("blob:https://evil.example/y")).toBe("");
      expect(sanitizeUrl("blob:https://oriex.example/y")).toBe("blob:https://oriex.example/y");
    } finally {
      if (previous) Object.defineProperty(globalThis, "location", previous);
      else delete globalThis.location;
    }
  });
});

describe("hasLikelyXss", () => {
  it("flags dangerous markup", () => {
    expect(hasLikelyXss("<script>x</script>")).toBe(true);
    expect(hasLikelyXss('<img onerror="x">')).toBe(true);
    expect(hasLikelyXss("go to javascript:void(0)")).toBe(true);
    expect(hasLikelyXss('<div style="x">')).toBe(true);
  });
  it("does not flag normal text", () => {
    expect(hasLikelyXss("普通のテキスト\n2行目")).toBe(false);
    expect(hasLikelyXss("3 < 5 and a > b")).toBe(false);
  });
});

describe("profile save sanitizes name/bio (defense in depth)", () => {
  beforeAll(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  });

  it("does not persist dangerous HTML in the profile payload", async () => {
    const profiles = await import("../src/services/repository/profileRepository.js");
    const res = profiles.save("local", {
      name: "<script>alert(1)</script>太郎",
      bio: "こんにちは\n<img src=x onerror=alert(1)> です",
    });
    expect(res.ok).toBe(true);
    const p = profiles.get("local");
    expect(p.name).not.toMatch(/<script/i);
    expect(p.name).toContain("太郎");
    expect(p.bio).not.toMatch(/onerror/i);
    expect(p.bio).toContain("こんにちは");
    expect(p.bio).toContain("\n"); // 改行は保持
  });

  it("clamps over-long name/bio (anti-abuse)", async () => {
    const profiles = await import("../src/services/repository/profileRepository.js");
    profiles.save("local", { name: "あ".repeat(500), bio: "b".repeat(10000) });
    const p = profiles.get("local");
    expect(p.name.length).toBeLessThanOrEqual(120);
    expect(p.bio.length).toBeLessThanOrEqual(4000);
  });
});

/* ---- static guards: no dangerous DOM sinks in non-legacy source ---- */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "legacy" || name === "node_modules") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(name)) acc.push(p);
  }
  return acc;
}
const SRC_FILES = walk("src");

describe("no dangerous DOM sinks in non-legacy source (static)", () => {
  it("never uses dangerouslySetInnerHTML", () => {
    const hits = SRC_FILES.filter((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));
    expect(hits).toEqual([]);
  });

  it("never assigns innerHTML / outerHTML / insertAdjacentHTML / document.write", () => {
    const re = /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/;
    const hits = SRC_FILES.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("localAi panels render text without dangerouslySetInnerHTML", () => {
    const panelFiles = SRC_FILES.filter((f) => f.replace(/\\/g, "/").includes("/localAi/"));
    expect(panelFiles.length).toBeGreaterThan(0);
    for (const f of panelFiles) {
      expect(readFileSync(f, "utf8")).not.toContain("dangerouslySetInnerHTML");
    }
  });
});
