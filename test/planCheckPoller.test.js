import { describe, it, expect, vi } from "vitest";
import { createPlanCheckPoller, PLAN_CHECK_INTERVAL_MS } from "../src/services/repository/planCheckPoller.js";

function fakeTimers() {
  let id = 0;
  return {
    setInterval: vi.fn(() => {
      id += 1;
      return id;
    }),
    clearInterval: vi.fn(),
  };
}

describe("planCheckPoller (the only sanctioned 20s polling)", () => {
  it("uses a 20s interval by default", () => {
    expect(PLAN_CHECK_INTERVAL_MS).toBe(20000);
    const t = fakeTimers();
    createPlanCheckPoller(() => {}, t).start();
    expect(t.setInterval).toHaveBeenCalledTimes(1);
    expect(t.setInterval.mock.calls[0][1]).toBe(20000);
  });

  it("start() is idempotent — no double interval", () => {
    const t = fakeTimers();
    const p = createPlanCheckPoller(() => {}, t);
    expect(p.start()).toBe(true);
    expect(p.start()).toBe(false);
    expect(t.setInterval).toHaveBeenCalledTimes(1);
    expect(p.isRunning()).toBe(true);
  });

  it("stop() clears the interval (unmount) and allows a later restart", () => {
    const t = fakeTimers();
    const p = createPlanCheckPoller(() => {}, t);
    p.start();
    p.stop();
    expect(t.clearInterval).toHaveBeenCalledTimes(1);
    expect(p.isRunning()).toBe(false);
    p.start();
    expect(t.setInterval).toHaveBeenCalledTimes(2);
  });

  it("skips fetching while the page is hidden", () => {
    const onTick = vi.fn();
    let visible = false;
    const p = createPlanCheckPoller(onTick, { ...fakeTimers(), isVisible: () => visible });
    p.tick();
    expect(onTick).not.toHaveBeenCalled();
    visible = true;
    p.tick();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("a poll error does not throw out of tick", () => {
    const p = createPlanCheckPoller(
      () => {
        throw new Error("boom");
      },
      { ...fakeTimers(), isVisible: () => true }
    );
    expect(() => p.tick()).not.toThrow();
  });
});
