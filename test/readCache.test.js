import { describe, it, expect, vi } from "vitest";
import { createReadCache, CACHE_TTL_MS } from "../src/services/repository/readCache.js";

describe("readCache (dedupe reads + invalidate)", () => {
  it("default TTL is 60s", () => {
    expect(CACHE_TTL_MS).toBe(60000);
  });

  it("does not refetch within the TTL window", async () => {
    let t = 0;
    const cache = createReadCache({ ttl: 1000, now: () => t });
    const fetcher = vi.fn(async () => "v1");
    expect(await cache.get("k", fetcher)).toBe("v1");
    t = 500;
    expect(await cache.get("k", fetcher)).toBe("v1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight read for the same key", async () => {
    let resolveRead;
    const cache = createReadCache({ ttl: 1000 });
    const fetcher = vi.fn(() => new Promise((resolve) => { resolveRead = resolve; }));
    const a = cache.get("records:u1", fetcher);
    const b = cache.get("records:u1", fetcher);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveRead(["row1"]);
    await expect(a).resolves.toEqual(["row1"]);
    await expect(b).resolves.toEqual(["row1"]);
    expect(await cache.get("records:u1", fetcher)).toEqual(["row1"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed in-flight read instead of caching the failure", async () => {
    const cache = createReadCache({ ttl: 1000 });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("ok");
    await expect(cache.get("profile:u1", fetcher)).rejects.toThrow("network");
    await expect(cache.get("profile:u1", fetcher)).resolves.toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("refetches after the TTL expires", async () => {
    let t = 0;
    const cache = createReadCache({ ttl: 1000, now: () => t });
    const fetcher = vi.fn(async () => "v" + t);
    await cache.get("k", fetcher);
    t = 1500;
    await cache.get("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not let an invalidated in-flight read repopulate stale cache", async () => {
    let resolveOld;
    const cache = createReadCache({ ttl: 100000 });
    const fetcher = vi.fn(() => new Promise((resolve) => { resolveOld = resolve; }));
    const oldRead = cache.get("delivered:u1", fetcher);
    await Promise.resolve();
    cache.invalidate("delivered:u1");
    resolveOld(["old"]);
    await expect(oldRead).resolves.toEqual(["old"]);
    expect(cache.peek("delivered:u1")).toBeUndefined();

    const nextFetcher = vi.fn(async () => ["fresh"]);
    await expect(cache.get("delivered:u1", nextFetcher)).resolves.toEqual(["fresh"]);
    expect(cache.peek("delivered:u1")).toEqual(["fresh"]);
  });

  it("invalidate() forces a refetch (after save/delete)", async () => {
    const cache = createReadCache({ ttl: 100000 });
    const fetcher = vi.fn(async () => "x");
    await cache.get("k", fetcher);
    cache.invalidate("k");
    await cache.get("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidatePrefix() clears a group of keys only", async () => {
    const cache = createReadCache({ ttl: 100000 });
    await cache.get("records:u1", async () => 1);
    await cache.get("records:u2", async () => 2);
    await cache.get("books:u1", async () => 3);
    cache.invalidatePrefix("records:");
    expect(cache.peek("records:u1")).toBeUndefined();
    expect(cache.peek("records:u2")).toBeUndefined();
    expect(cache.peek("books:u1")).toBe(3);
  });

  it("invalidatePrefix() also cancels pending cache population", async () => {
    let resolveRead;
    const cache = createReadCache({ ttl: 100000 });
    const pending = cache.get("records:u1", () => new Promise((resolve) => { resolveRead = resolve; }));
    await Promise.resolve();
    cache.invalidatePrefix("records:");
    resolveRead(["old"]);
    await pending;
    expect(cache.peek("records:u1")).toBeUndefined();
  });
});
