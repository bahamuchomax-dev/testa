import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  computeResizeDimensions,
  isDataUrlString,
  homePhotoOverlayAlpha,
  savePhotoBlob,
  loadPhotoBlob,
  deletePhotoBlob,
  LONG_EDGE_MAX,
  OUTPUT_QUALITY,
  DB_NAME,
  STORE_NAME,
} from "../src/features/home/homePhotoStorage.js";

/* Minimal in-memory IndexedDB fake (the test env is node, no real IndexedDB).
 * Implements only what homePhotoStorage uses: open/onupgradeneeded/onsuccess,
 * transaction().objectStore().get/put/delete with async success events. */
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

const jpeg = (bytes = 4) => new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });

describe("computeResizeDimensions", () => {
  it("clamps a large landscape image's long edge to the max (aspect kept)", () => {
    const r = computeResizeDimensions(4000, 3000, 1600);
    expect(Math.max(r.width, r.height)).toBe(1600);
    expect(r).toEqual({ width: 1600, height: 1200 });
  });

  it("clamps a portrait image by height", () => {
    const r = computeResizeDimensions(3000, 4000, 1600);
    expect(r).toEqual({ width: 1200, height: 1600 });
  });

  it("leaves images already within bounds unchanged", () => {
    expect(computeResizeDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("defaults to LONG_EDGE_MAX (1600)", () => {
    expect(LONG_EDGE_MAX).toBe(1600);
    const r = computeResizeDimensions(5000, 5000);
    expect(Math.max(r.width, r.height)).toBe(1600);
  });
});

describe("isDataUrlString", () => {
  it("recognizes data URLs and rejects everything else", () => {
    expect(isDataUrlString("data:image/png;base64,AAAA")).toBe(true);
    expect(isDataUrlString("blob:http://x/y")).toBe(false);
    expect(isDataUrlString(null)).toBe(false);
    expect(isDataUrlString(jpeg())).toBe(false);
  });
});

describe("homePhotoOverlayAlpha + compression quality", () => {
  it("uses a light overlay at full opacity and whitens as opacity drops", () => {
    expect(homePhotoOverlayAlpha(1)).toBeCloseTo(0.08, 5);
    expect(homePhotoOverlayAlpha(null)).toBeCloseTo(0.08, 5);
    expect(homePhotoOverlayAlpha(0)).toBeCloseTo(0.9, 5); // clamped to 0.9
    expect(homePhotoOverlayAlpha(0.5)).toBeGreaterThan(homePhotoOverlayAlpha(1));
  });

  it("compresses at quality 0.82 per spec", () => {
    expect(OUTPUT_QUALITY).toBe(0.82);
  });
});

describe("home photo IndexedDB storage", () => {
  it("uses the documented DB/store names", () => {
    expect(DB_NAME).toBe("oriexbg");
    expect(STORE_NAME).toBe("imgs");
  });

  it("saves and reads back a Blob", async () => {
    const idb = makeFakeIndexedDB();
    const ok = await savePhotoBlob(jpeg(4), { uid: "u1", indexedDB: idb });
    expect(ok).toBe(true);
    const got = await loadPhotoBlob({ uid: "u1", indexedDB: idb });
    expect(got).toBeInstanceOf(Blob);
    expect(got.size).toBe(4);
    expect(got.type).toBe("image/jpeg");
  });

  it("returns null when nothing is stored (no crash)", async () => {
    const idb = makeFakeIndexedDB();
    expect(await loadPhotoBlob({ uid: "none", indexedDB: idb })).toBeNull();
  });

  it("deletes the stored photo", async () => {
    const idb = makeFakeIndexedDB();
    await savePhotoBlob(jpeg(8), { uid: "u2", indexedDB: idb });
    await deletePhotoBlob({ uid: "u2", indexedDB: idb });
    expect(await loadPhotoBlob({ uid: "u2", indexedDB: idb })).toBeNull();
  });

  it("keeps photos separated per uid", async () => {
    const idb = makeFakeIndexedDB();
    await savePhotoBlob(jpeg(2), { uid: "a", indexedDB: idb });
    await savePhotoBlob(jpeg(16), { uid: "b", indexedDB: idb });
    expect((await loadPhotoBlob({ uid: "a", indexedDB: idb })).size).toBe(2);
    expect((await loadPhotoBlob({ uid: "b", indexedDB: idb })).size).toBe(16);
  });

  it("does not write image bytes to localStorage", async () => {
    const calls = [];
    const had = Object.prototype.hasOwnProperty.call(globalThis, "localStorage");
    const prev = globalThis.localStorage;
    globalThis.localStorage = { setItem: (k, v) => calls.push([k, v]), getItem: () => null, removeItem: () => {} };
    try {
      const idb = makeFakeIndexedDB();
      await savePhotoBlob(jpeg(5000), { uid: "u", indexedDB: idb });
      await loadPhotoBlob({ uid: "u", indexedDB: idb });
      await deletePhotoBlob({ uid: "u", indexedDB: idb });
      expect(calls).toHaveLength(0);
    } finally {
      if (had) globalThis.localStorage = prev;
      else delete globalThis.localStorage;
    }
  });
});

describe("home photo storage safety", () => {
  it("never references network primitives (no external image upload)", () => {
    const src = readFileSync(new URL("../src/features/home/homePhotoStorage.js", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    expect(src).not.toMatch(/sendBeacon/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});
