import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

/* Static safety net: the app must contain no external AI hostnames, SDK
 * identifiers, or legacy browser API-key handling. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const SCAN_ROOTS = [
  join(root, "src"),
  join(root, "package.json"),
  ...readdirSync(root)
    .filter((name) => name === ".env" || name.startsWith(".env."))
    .map((name) => join(root, name)),
];

const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".mjs", ".cjs", ".env"]);
const dotted = (...parts) => parts.join(".");
const joined = (...parts) => parts.join("");

function isTextFile(path) {
  if (path.endsWith(".env")) return true;
  const dot = path.lastIndexOf(".");
  return dot === -1 ? false : TEXT_EXTENSIONS.has(path.slice(dot));
}

function collectFiles(path, out = []) {
  if (!existsSync(path)) return out;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) collectFiles(join(path, name), out);
  } else if (isTextFile(path)) {
    out.push({
      f: relative(root, path).replaceAll("\\", "/"),
      src: readFileSync(path, "utf8"),
    });
  }
  return out;
}

const FORBIDDEN = [
  dotted("api", "openai", "com"),
  dotted("api", "anthropic", "com"),
  dotted("generativelanguage", "googleapis", "com"),
  joined("genron_", "anthropic", "ApiKey"),
  joined("anthropic", "-dangerous-direct-browser-access"),
  joined("OPEN", "AI"),
  joined("ANTH", "ROPIC"),
  joined("GEM", "INI"),
  joined("CLAUDE", "_API"),
  joined("Clau", "de", " API"),
];

describe("local AI keeps processing local", () => {
  const files = SCAN_ROOTS.flatMap((path) => collectFiles(path));

  it("scanned app source, package metadata, and env files when present", () => {
    expect(files.some((x) => x.f === "src/legacy/oriex-app.bundle.js")).toBe(true);
    expect(files.some((x) => x.f === "package.json")).toBe(true);
    expect(files.length).toBeGreaterThan(10);
  });

  for (const needle of FORBIDDEN) {
    it(`has no reference to ${needle}`, () => {
      const hits = files.filter((x) => x.src.includes(needle)).map((x) => x.f);
      expect(hits).toEqual([]);
    });
  }

  it("talks to the local Ollama endpoint", () => {
    const client = files.find((x) => x.f === "src/features/localAi/localAiClient.js");
    expect(client.src).toContain("localhost:11434");
    expect(client.src).toContain("/api/generate");
  });

  it("includes the legacy browser AI key token in the forbidden list", () => {
    expect(FORBIDDEN).toContain(joined("genron_", "anthropic", "ApiKey"));
    expect(FORBIDDEN).toContain(joined("anthropic", "-dangerous-direct-browser-access"));
  });
});
