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

  it("refetches after the TTL expires", async () => {
    let t = 0;
    const cache = createReadCache({ ttl: 1000, now: () => t });
    const fetcher = vi.fn(async () => "v" + t);
    await cache.get("k", fetcher);
    t = 1500;
    await cache.get("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
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
});
