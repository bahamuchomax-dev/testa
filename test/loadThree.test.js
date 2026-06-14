import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { loadThree, resetThreeLoader } from "../src/services/loadThree.js";

/* Fake DOM: createElement returns a script stub that records listeners and
 * lets the test fire load/error; head.appendChild collects appended scripts. */
function makeFakeDom() {
  const scripts = [];
  const doc = {
    createElement() {
      const listeners = {};
      return {
        async: false,
        _src: "",
        get src() {
          return this._src;
        },
        set src(v) {
          this._src = v;
        },
        setAttribute() {},
        addEventListener(type, cb) {
          listeners[type] = listeners[type] || [];
          listeners[type].push(cb);
        },
        _fire(type, ev) {
          (listeners[type] || []).forEach((cb) => cb(ev));
        },
      };
    },
    querySelector() {
      return null;
    },
    head: {
      appendChild(s) {
        scripts.push(s);
      },
    },
  };
  return { doc, scripts };
}

describe("loadThree", () => {
  beforeEach(() => resetThreeLoader());

  it("reuses an existing window.THREE without adding a script", async () => {
    const { doc, scripts } = makeFakeDom();
    const THREE = { rev: 1 };
    const got = await loadThree({ win: { THREE }, doc });
    expect(got).toBe(THREE);
    expect(scripts.length).toBe(0);
  });

  it("adds only ONE script for concurrent calls and resolves on load", async () => {
    const { doc, scripts } = makeFakeDom();
    const win = {}; // THREE not present yet
    const p1 = loadThree({ win, doc, baseUrl: "/" });
    const p2 = loadThree({ win, doc, baseUrl: "/" });
    expect(scripts.length).toBe(1); // shared in-flight promise => one <script>
    win.THREE = { ok: true };
    scripts[0]._fire("load");
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(win.THREE);
    expect(r2).toBe(win.THREE);
  });

  it("uses a BASE_URL-relative src and async=true", () => {
    const { doc, scripts } = makeFakeDom();
    loadThree({ win: {}, doc, baseUrl: "/myrepo/" });
    expect(scripts[0].src).toBe("/myrepo/three.min.js");
    expect(scripts[0].async).toBe(true);
  });

  it("rejects when the script fails to load", async () => {
    const { doc, scripts } = makeFakeDom();
    const p = loadThree({ win: {}, doc, baseUrl: "/" });
    scripts[0]._fire("error");
    await expect(p).rejects.toThrow();
  });

  it("allows a retry after a failure (in-flight promise is released)", async () => {
    const { doc, scripts } = makeFakeDom();
    const p = loadThree({ win: {}, doc, baseUrl: "/" });
    scripts[0]._fire("error");
    await expect(p).rejects.toThrow();
    // second attempt creates a fresh script
    const win2 = {};
    const p2 = loadThree({ win: win2, doc, baseUrl: "/" });
    expect(scripts.length).toBe(2);
    win2.THREE = { ok: true };
    scripts[1]._fire("load");
    await expect(p2).resolves.toBe(win2.THREE);
  });
});

describe("three.js is no longer render-blocking (static)", () => {
  const INDEX = readFileSync("index.html", "utf8");
  const MAIN = readFileSync("src/main.js", "utf8");
  const HAMSTER = readFileSync("src/features/hamster/HamsterRoom.jsx", "utf8");

  it("index.html does not load three.min.js synchronously", () => {
    const m = INDEX.match(/<script[^>]*three\.min\.js[^>]*>/);
    if (m) {
      // if still present at all, it must be deferred/async (non-blocking)
      expect(m[0]).toMatch(/\b(defer|async)\b/);
    } else {
      expect(m).toBe(null); // removed entirely (our choice)
    }
  });

  it("main.js warms three.js off the critical path via loadThree", () => {
    expect(MAIN).toContain("loadThree");
    expect(MAIN).toContain("staticSourceAssetBaseUrl");
    expect(MAIN).toMatch(/requestIdleCallback|addEventListener\(\s*["']load["']/);
  });

  it("HamsterRoom loads three.js on demand", () => {
    expect(HAMSTER).toContain("loadThree");
  });
});
