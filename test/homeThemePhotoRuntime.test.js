import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { loadPhotoBlob } from "../src/features/home/homePhotoStorage.js";

function makeStyle() {
  const props = new Map();
  return {
    cssText: "",
    setProperty(name, value) {
      props.set(name, String(value));
    },
    removeProperty(name) {
      props.delete(name);
    },
    getPropertyValue(name) {
      return props.get(name) || "";
    },
  };
}

function makeClassList() {
  const classes = new Set();
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function makeElement(tagName, registry) {
  const el = {
    tagName: tagName.toUpperCase(),
    children: [],
    parentNode: null,
    style: makeStyle(),
    classList: makeClassList(),
    attributes: new Map(),
    textContent: "",
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      if (child.id) registry.set(child.id, child);
      return child;
    },
    insertBefore(child, before) {
      const index = this.children.indexOf(before);
      if (index < 0) return this.appendChild(child);
      this.children.splice(index, 0, child);
      child.parentNode = this;
      if (child.id) registry.set(child.id, child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((x) => x !== child);
      if (child.id) registry.delete(child.id);
      child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === "id") this.id = String(value);
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    },
    getAttribute(name) {
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    },
    click() {
      if (typeof this.onclick === "function") this.onclick({ target: this });
    },
  };
  Object.defineProperty(el, "firstChild", {
    get() {
      return this.children[0] || null;
    },
  });
  Object.defineProperty(el, "id", {
    get() {
      return this._id || "";
    },
    set(value) {
      if (this._id) registry.delete(this._id);
      this._id = value;
      if (value) registry.set(value, this);
    },
  });
  return el;
}

function makeDocument({ readyState = "loading" } = {}) {
  const registry = new Map();
  const doc = {
    readyState,
    documentElement: null,
    head: null,
    body: null,
    createElement(tagName) {
      return makeElement(tagName, registry);
    },
    getElementById(id) {
      return registry.get(id) || null;
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
  };
  doc.documentElement = makeElement("html", registry);
  doc.head = makeElement("head", registry);
  doc.body = makeElement("body", registry);
  const root = makeElement("div", registry);
  root.id = "root";
  const legacyShell = makeElement("div", registry);
  legacyShell.style.cssText = "position: fixed; inset: 0; background: linear-gradient(#fff,#eee)";
  root.appendChild(legacyShell);
  doc.body.appendChild(root);
  return doc;
}

function walk(node, out = []) {
  if (!node) return out;
  out.push(node);
  for (const child of node.children || []) walk(child, out);
  return out;
}

function makeLocalStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    dump() {
      return Array.from(data.entries());
    },
  };
}

function makeFakeIndexedDB() {
  const data = new Map();
  function req(resultGetter) {
    const r = {};
    queueMicrotask(() => {
      try {
        if (resultGetter) r.result = resultGetter();
        if (typeof r.onsuccess === "function") r.onsuccess({ target: r });
      } catch (e) {
        r.error = e;
        if (typeof r.onerror === "function") r.onerror({ target: r });
      }
    });
    return r;
  }
  const objectStore = {
    get: (key) => req(() => data.get(key)),
    put: (val, key) => {
      data.set(key, val);
      return req(() => true);
    },
    delete: (key) => {
      data.delete(key);
      return req(() => true);
    },
  };
  const db = {
    createObjectStore: () => objectStore,
    transaction: () => ({ objectStore: () => objectStore }),
  };
  return {
    _data: data,
    open: () => {
      const r = {};
      queueMicrotask(() => {
        r.result = db;
        if (typeof r.onupgradeneeded === "function") r.onupgradeneeded({ target: r });
        if (typeof r.onsuccess === "function") r.onsuccess({ target: r });
      });
      return r;
    },
  };
}

async function flushMicrotasks(times = 8) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

async function installOxBg({ indexedDB = makeFakeIndexedDB(), localStorage = makeLocalStorage(), readyState = "loading" } = {}) {
  const document = makeDocument({ readyState });
  const window = {
    document,
    localStorage,
    indexedDB,
    __oxUid: "local",
    addEventListener() {},
    removeEventListener() {},
  };
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("indexedDB", indexedDB);
  vi.stubGlobal("setInterval", () => 1);
  vi.stubGlobal("clearInterval", () => {});
  vi.stubGlobal("setTimeout", (cb) => {
    queueMicrotask(cb);
    return 1;
  });
  vi.stubGlobal("clearTimeout", () => {});
  const RealURL = globalThis.URL;
  class TestURL extends RealURL {}
  TestURL.createObjectURL = vi.fn(() => "blob:oriex-test-photo");
  TestURL.revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", TestURL);

  vi.resetModules();
  await import("../src/services/oxHelpers.js");
  await flushMicrotasks();
  return { bg: window.__oxBg, document, indexedDB, localStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("theme photo runtime helper", () => {
  it("exposes window.__oxBg.openSettings and creates a clickable image picker", async () => {
    const { bg, document } = await installOxBg();

    expect(typeof bg.openSettings).toBe("function");
    bg.openSettings();

    const nodes = walk(document.body);
    const fileInput = nodes.find((node) => node.tagName === "INPUT" && node.type === "file");
    const chooseButton = nodes.find((node) => node.tagName === "BUTTON" && node.textContent === "写真を選択");

    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe("image/*");
    expect("capture" in fileInput).toBe(false);
    expect(typeof fileInput.onchange).toBe("function");
    expect(typeof chooseButton.onclick).toBe("function");
  });

  it("setPhoto saves a Blob, applies body.oxbg-on, and sets background CSS", async () => {
    const { bg, document, indexedDB, localStorage } = await installOxBg();
    const ok = await bg.setPhoto(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));

    expect(ok).toBe(true);
    expect(document.body.classList.contains("oxbg-on")).toBe(true);
    expect(document.documentElement.getAttribute("data-home-photo")).toBe("on");
    expect(document.documentElement.style.getPropertyValue("--oriex-home-photo-url")).toContain("blob:oriex-test-photo");
    expect(document.getElementById("oxbg-photo-layer")).toBeTruthy();
    expect(document.getElementById("oxbg-photo-layer").style.backgroundImage).toContain("--oriex-home-photo-url");
    expect(Number(document.getElementById("oxbg-photo-layer").style.zIndex)).toBeGreaterThanOrEqual(0);
    expect(document.getElementById("root").style.position).toBe("relative");
    expect(document.getElementById("root").style.zIndex).toBe("1");
    expect(await loadPhotoBlob({ uid: "local", indexedDB })).toBeInstanceOf(Blob);
    expect(localStorage.dump().some(([, value]) => value.startsWith("data:image/"))).toBe(false);
  });

  it("injects CSS that makes the legacy fixed root background transparent", async () => {
    const { bg, document } = await installOxBg();
    await bg.setPhoto(new Blob([new Uint8Array([4])], { type: "image/jpeg" }));

    const css = document.getElementById("oxbg-css").textContent;
    expect(css).toContain("body.oxbg-on #root > div{background:transparent!important}");
    expect(css).toContain("body.oxbg-on #root{position:relative!important;z-index:1!important;background:transparent!important}");
  });

  it("injects CSS that restores readable card surfaces over theme photos", async () => {
    const { bg, document } = await installOxBg();
    await bg.setPhoto(new Blob([new Uint8Array([5])], { type: "image/jpeg" }));

    const css = document.getElementById("oxbg-css").textContent;
    expect(css).toContain("body.oxbg-on .rx-peek,");
    expect(css).toContain("body.oxbg-on .rx-rec-s,");
    expect(css).toContain("body.oxbg-on .rx-tabbar,");
    expect(css).toContain("body.oxbg-on .rx-calendar-grid,");
    expect(css).toContain('body.oxbg-on [class*="rounded"][style*="rgba(255,255,255,0.05)"]');
    expect(css).toContain("background:rgba(255,255,255,.88)!important");
    expect(css).toContain("backdrop-filter:blur(10px)");
  });

  it("restores the photo from IndexedDB on startup and afterTheme reapplies CSS", async () => {
    const indexedDB = makeFakeIndexedDB();
    const localStorage = makeLocalStorage();
    let env = await installOxBg({ indexedDB, localStorage });
    await env.bg.setPhoto(new Blob([new Uint8Array([9])], { type: "image/jpeg" }));

    vi.unstubAllGlobals();
    env = await installOxBg({ indexedDB, localStorage, readyState: "complete" });
    await flushMicrotasks();

    expect(env.document.body.classList.contains("oxbg-on")).toBe(true);
    expect(env.document.documentElement.style.getPropertyValue("--oriex-home-photo-url")).toContain("blob:oriex-test-photo");
    expect(env.document.getElementById("oxbg-photo-layer")).toBeTruthy();

    env.document.documentElement.style.removeProperty("--oriex-home-photo-url");
    env.document.getElementById("oxbg-photo-layer").parentNode.removeChild(env.document.getElementById("oxbg-photo-layer"));
    env.bg.afterTheme();
    expect(env.document.documentElement.style.getPropertyValue("--oriex-home-photo-url")).toContain("blob:oriex-test-photo");
    expect(env.document.getElementById("oxbg-photo-layer")).toBeTruthy();
    expect(env.document.getElementById("oxbg-photo-layer").style.zIndex).toBe("0");
  });

  it("deletes the stored photo and removes oxbg-on/CSS variables", async () => {
    const { bg, document, indexedDB } = await installOxBg();

    await bg.setPhoto(new Blob([new Uint8Array([7])], { type: "image/jpeg" }));
    const ok = await bg.clearPhoto();

    expect(ok).toBe(true);
    expect(await loadPhotoBlob({ uid: "local", indexedDB })).toBeNull();
    expect(document.body.classList.contains("oxbg-on")).toBe(false);
    expect(document.documentElement.getAttribute("data-home-photo")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--oriex-home-photo-url")).toBe("");
    expect(document.getElementById("oxbg-photo-layer")).toBeNull();
  });

  it("does not contain network upload primitives in the theme photo path", () => {
    const helper = readFileSync(new URL("../src/services/oxHelpers.js", import.meta.url), "utf8");
    const storage = readFileSync(new URL("../src/features/home/homePhotoStorage.js", import.meta.url), "utf8");
    const src = helper + "\n" + storage;

    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    expect(src).not.toMatch(/sendBeacon/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});
