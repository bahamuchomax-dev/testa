import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  CATEGORY_COLORS,
  FALLBACK_COLOR,
  colorForCategory,
  listCategoryColors,
} from "../src/services/categoryColors.js";

const REQUIRED = ["accent", "softBg", "iconBg"];

describe("categoryColors map", () => {
  it("every category has accent / softBg / iconBg (non-empty)", () => {
    for (const [key, c] of Object.entries(CATEGORY_COLORS)) {
      for (const f of REQUIRED) {
        expect(typeof c[f]).toBe("string");
        expect(c[f].length).toBeGreaterThan(0);
      }
      // id matches its map key
      expect(c.id).toBe(key);
    }
  });

  it("covers 英単語 / 熟語 / 漢字 / 化学 / 古文 with an accent (by label)", () => {
    for (const label of ["英単語", "熟語", "漢字", "化学", "古文"]) {
      const c = colorForCategory(label);
      expect(c).toBeTruthy();
      expect(typeof c.accent).toBe("string");
      expect(c.accent.length).toBeGreaterThan(0);
      expect(c).not.toBe(FALLBACK_COLOR); // each known label resolves to a real entry
    }
  });

  it("covers the same five by id", () => {
    for (const id of ["eitango", "idiom", "kanji", "chemistry", "koten"]) {
      expect(CATEGORY_COLORS[id]).toBeTruthy();
      expect(CATEGORY_COLORS[id].accent.length).toBeGreaterThan(0);
    }
  });

  it("never returns undefined colors — unknown keys fall back safely", () => {
    for (const k of [undefined, null, "", "  ", "知らない教科", "xyz", 123]) {
      const c = colorForCategory(k);
      expect(c).toBeTruthy();
      for (const f of REQUIRED) {
        expect(typeof c[f]).toBe("string");
        expect(c[f].length).toBeGreaterThan(0);
      }
    }
    expect(colorForCategory("知らない教科")).toBe(FALLBACK_COLOR);
  });

  it("resolves aliases (english/chem/古文…) to the right category", () => {
    expect(colorForCategory("english").id).toBe("eitango");
    expect(colorForCategory("chem").id).toBe("chemistry");
    expect(colorForCategory("古文").id).toBe("koten");
  });

  it("listCategoryColors returns all entries", () => {
    expect(listCategoryColors().length).toBe(Object.keys(CATEGORY_COLORS).length);
  });
});

describe("CSS color fallbacks are present (static)", () => {
  const APP_CSS = readFileSync("src/styles/app.css", "utf8");
  const OX_HELPERS = readFileSync("src/services/oxHelpers.js", "utf8");
  it("icon backgrounds have an accent fallback", () => {
    expect(APP_CSS).toMatch(/\.rx-q \.ic[\s\S]{0,80}background:\s*var\(--accent-soft/);
  });
  it("category dot has an accent fallback", () => {
    expect(APP_CSS).toMatch(/\.rx-frame-chip span\s*\{\s*background:\s*var\(--accent/);
  });

  it("marks only the five legacy subject cards for the selected-card override", () => {
    expect(OX_HELPERS).toContain("window.__oxSubjectCards");
    const labels = (OX_HELPERS.match(/var SUBJECT_CARD_LABELS=\[([\s\S]*?)\];/) || [])[1] || "";
    expect(labels).toContain('"英単語"');
    expect(labels).toContain('"熟語"');
    expect(labels).toContain('"漢字"');
    expect(labels).toContain('"化学"');
    expect(labels).toContain('"古文"');
    expect(labels).not.toContain('"AI"');
    expect(labels).not.toContain('"先生"');
  });

  it("keeps selected subject cards on a non-transparent white surface", () => {
    expect(APP_CSS).toMatch(/button\[data-ox-subject-card\][\s\S]*background:rgba\(255,255,255,\.\d+\)!important/);
    expect(APP_CSS).toMatch(/button\[data-ox-subject-card\]\[data-ox-subject-selected="true"\][\s\S]*background:rgba\(255,255,255,\.\d+\)!important/);
    expect(APP_CSS).toMatch(/button\[data-ox-subject-card\]\[data-ox-subject-selected="true"\][\s\S]*border:1\.5px solid color-mix/);
    expect(APP_CSS).not.toMatch(/button\[data-ox-subject-card\][^{]*\{[^}]*background:\s*transparent/i);
  });
});
