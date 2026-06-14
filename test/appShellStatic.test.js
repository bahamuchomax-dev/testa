import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/* Static guards for the app-shell fixes (bug-fix phase 2). No DOM/React
 * runtime needed — we assert against the source files directly. */

const MAIN = readFileSync("src/main.js", "utf8");
const INDEX_HTML = readFileSync("index.html", "utf8");
const DEPLOY_PAGES = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
const SW = readFileSync("public/sw.js", "utf8");
const MANIFEST = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
const PDF_PANEL = readFileSync("src/features/localAi/panels/PdfQuestionPanel.jsx", "utf8");

describe("service worker registration (main.js)", () => {
  it("registers the service worker", () => {
    expect(MAIN).toContain('"serviceWorker" in navigator');
    expect(MAIN).toMatch(/navigator\.serviceWorker\s*\.register\(/);
  });
  it("registers only in production and after window load", () => {
    expect(MAIN).toContain("VITE_ENV.PROD");
    expect(MAIN).toMatch(/addEventListener\(\s*["']load["']/);
  });
  it("uses a BASE_URL-relative path (GitHub Pages subpath safe)", () => {
    expect(MAIN).toContain("APP_BASE_URL");
    expect(MAIN).toContain("${APP_BASE_URL}sw.js");
  });
  it("never breaks the app on failure (has a catch)", () => {
    expect(MAIN).toMatch(/\.catch\(/);
  });
});

describe("repository-root static startup fallback", () => {
  it("uses a browser-accepted .js entry and links CSS from index.html", () => {
    expect(INDEX_HTML).toContain('src="./src/main.js"');
    expect(INDEX_HTML).not.toContain("/src/main.jsx");
    expect(INDEX_HTML).not.toContain('src="/src/');
    expect(INDEX_HTML).toContain('href="./src/styles/utilities.css"');
    expect(INDEX_HTML).toContain('href="./src/styles/app.css"');
    expect(MAIN).not.toMatch(/import\s+["'][^"']+\.css["']/);
  });

  it("uses project-relative manifest and icon paths for GitHub Pages subpaths", () => {
    expect(INDEX_HTML).toContain('rel="manifest" href="./manifest.webmanifest"');
    expect(INDEX_HTML).toContain('rel="icon" type="image/png" href="./icon-192.png"');
    expect(INDEX_HTML).toContain('rel="apple-touch-icon" href="./icon-180.png"');
    expect(INDEX_HTML).not.toContain('href="/manifest.webmanifest"');
    expect(INDEX_HTML).not.toContain('href="/icon-180.png"');
    expect(existsSync("manifest.webmanifest")).toBe(true);
    expect(existsSync("icon-180.png")).toBe(true);
    expect(existsSync("icon-192.png")).toBe(true);
    expect(existsSync("icon-512.png")).toBe(true);
    expect(existsSync("public/assets/icon-192.png")).toBe(true);
    expect(existsSync("public/assets/icon-512.png")).toBe(true);
  });

  it("keeps the live entry free of JSX syntax and App.jsx imports", () => {
    expect(MAIN).not.toMatch(/<\s*[A-Z][A-Za-z0-9]*/);
    expect(MAIN).not.toMatch(/from\s+["']\.\/App(\.jsx)?["']/);
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
  });
});

describe("PWA theme-color consistency", () => {
  it("index.html theme-color matches manifest theme_color", () => {
    const m = INDEX_HTML.match(/name=["']theme-color["']\s+content=["']([^"']+)["']/i);
    expect(m).toBeTruthy();
    const htmlColor = m[1].trim().toLowerCase();
    const manifestColor = String(MANIFEST.theme_color).trim().toLowerCase();
    expect(htmlColor).toBe(manifestColor);
  });
});

describe("service worker cache scope", () => {
  it("caches same-origin static assets without intercepting every same-origin GET", () => {
    expect(SW).toContain("function isStaticAssetRequest");
    expect(SW).toContain("req.destination");
    expect(SW).toContain("isStaticAssetRequest(req, url)");
    expect(SW).not.toMatch(/if\s*\(\s*url\.origin\s*===\s*self\.location\.origin\s*\)\s*\{\s*e\.respondWith\(swr\(SHELL,\s*req\)\)/);
  });
});

describe("PDF question panel accessibility", () => {
  it("file input has an aria-label", () => {
    expect(PDF_PANEL).toMatch(/<input[^>]*type=["']file["'][^>]*aria-label=["'][^"']+["']/);
    expect(PDF_PANEL).toContain('aria-label="PDF教材を選択"');
  });
});

describe("safe meta CSP (static)", () => {
  it("index.html ships a Content-Security-Policy meta with object-src and base-uri", () => {
    const m = INDEX_HTML.match(/http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
    expect(m).toBeTruthy();
    const csp = m[1];
    expect(csp).toMatch(/object-src\s+'none'/);
    expect(csp).toMatch(/base-uri\s+'self'/);
  });
});

describe("GitHub Pages deployment", () => {
  it("publishes the built dist artifact after a project-page smoke check", () => {
    expect(DEPLOY_PAGES).toContain("npm run build");
    expect(DEPLOY_PAGES).toContain("node scripts/pagesSmokeCheck.mjs dist");
    expect(DEPLOY_PAGES).toContain("actions/upload-pages-artifact");
    expect(DEPLOY_PAGES).toMatch(/path:\s*dist/);
  });
});
