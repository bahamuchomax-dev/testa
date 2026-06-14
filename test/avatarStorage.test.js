import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  saveAvatarBlob,
  loadAvatarBlob,
  deleteAvatarBlob,
  isDataUrlString,
  DB_NAME,
  STORE_NAME,
  AVATAR_LONG_EDGE_MAX,
} from "../src/services/avatarStorage.js";
import { DB_NAME as PHOTO_DB_NAME } from "../src/features/home/homePhotoStorage.js";

/* Minimal in-memory IndexedDB fake (node env has no real IndexedDB).
 * Same shape as the homePhotoStorage test fake. */
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

describe("avatarStorage — IndexedDB Blob storage", () => {
  it("saves and loads an avatar Blob", async () => {
    const idb = makeFakeIndexedDB();
    await saveAvatarBlob(jpeg(8), { uid: "u1", indexedDB: idb });
    const got = await loadAvatarBlob({ uid: "u1", indexedDB: idb });
    expect(got).toBeInstanceOf(Blob);
    expect(got.size).toBe(8);
  });

  it("returns null when no avatar is stored", async () => {
    const idb = makeFakeIndexedDB();
    expect(await loadAvatarBlob({ uid: "missing", indexedDB: idb })).toBe(null);
  });

  it("deletes a stored avatar", async () => {
    const idb = makeFakeIndexedDB();
    await saveAvatarBlob(jpeg(), { uid: "u2", indexedDB: idb });
    expect(await deleteAvatarBlob({ uid: "u2", indexedDB: idb })).toBe(true);
    expect(await loadAvatarBlob({ uid: "u2", indexedDB: idb })).toBe(null);
  });

  it("keeps a per-uid key so users don't collide", async () => {
    const idb = makeFakeIndexedDB();
    await saveAvatarBlob(jpeg(3), { uid: "a", indexedDB: idb });
    await saveAvatarBlob(jpeg(9), { uid: "b", indexedDB: idb });
    expect((await loadAvatarBlob({ uid: "a", indexedDB: idb })).size).toBe(3);
    expect((await loadAvatarBlob({ uid: "b", indexedDB: idb })).size).toBe(9);
  });

  it("uses a DB isolated from the theme-photo DB", () => {
    expect(DB_NAME).toBe("oriexavatar");
    expect(DB_NAME).not.toBe(PHOTO_DB_NAME); // must not clash with theme photo
    expect(STORE_NAME).toBe("imgs");
    expect(AVATAR_LONG_EDGE_MAX).toBe(512);
  });

  it("re-exports isDataUrlString for migration checks", () => {
    expect(isDataUrlString("data:image/png;base64,AAAA")).toBe(true);
    expect(isDataUrlString("blob:http://x/y")).toBe(false);
  });
});

describe("avatar never uses base64 / localStorage (static)", () => {
  const PROFILE = readFileSync("src/features/profile/Profile.jsx", "utf8");
  const AVATAR = readFileSync("src/services/avatarStorage.js", "utf8");

  it("Profile does not base64-encode the avatar", () => {
    expect(PROFILE).not.toMatch(/toDataURL\s*\(/);
    expect(PROFILE).not.toMatch(/readAsDataURL\s*\(/);
  });

  it("avatarStorage itself does not base64-encode or touch localStorage", () => {
    expect(AVATAR).not.toMatch(/toDataURL\s*\(/);
    expect(AVATAR).not.toMatch(/readAsDataURL\s*\(/);
    expect(AVATAR).not.toMatch(/localStorage\s*\./);
  });

  it("Profile save payload contains only name/bio (no avatar image)", () => {
    expect(PROFILE).toMatch(
      /profiles\.save\(\s*profileUid\s*,\s*\{\s*name:\s*profile\.name\s*,\s*bio:\s*profile\.bio\s*\}\s*\)/
    );
    expect(PROFILE).not.toMatch(/avatar:\s*dataUrl/);
  });

  it("Profile stores/restores the avatar via the IndexedDB helper", () => {
    expect(PROFILE).toContain("saveAvatarBlob");
    expect(PROFILE).toContain("loadAvatarBlob");
    expect(PROFILE).toContain("deleteAvatarBlob");
  });

  it("avatar file input has no capture attribute", () => {
    const m = PROFILE.match(/<input[^>]*type="file"[^>]*>/);
    expect(m).toBeTruthy();
    expect(m[0]).not.toContain("capture");
  });
});
