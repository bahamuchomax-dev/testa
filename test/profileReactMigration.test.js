import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const PROFILE_PATH = "src/features/profile/Profile.jsx";
const PROFILE = readFileSync(PROFILE_PATH, "utf8");
const PROFILE_REPOSITORY = readFileSync("src/services/repository/profileRepository.js", "utf8");
const AVATAR_STORAGE = readFileSync("src/services/avatarStorage.js", "utf8");
const APP = readFileSync("src/App.jsx", "utf8");
const MAIN = readFileSync("src/main.js", "utf8");
const LOCAL_AI_FLAG = readFileSync("src/features/localAi/uiFlag.js", "utf8");

describe("React Profile migration phase 1", () => {
  it("keeps the Profile component present as an unmounted React target", () => {
    expect(existsSync(PROFILE_PATH)).toBe(true);
    expect(PROFILE).toContain("React migration phase 1 scaffold");
    expect(APP).toContain('import Profile from "./features/profile/Profile.jsx"');
    expect(MAIN).toContain("legacy/oriex-app.bundle.js");
    expect(MAIN).not.toMatch(/from\s+["']\.\/App(\.jsx)?["']/);
  });

  it("keeps name and bio sanitize/clamp in the repository", () => {
    expect(PROFILE_REPOSITORY).toContain("sanitizePlainText");
    expect(PROFILE_REPOSITORY).toMatch(/safeInput\.name\s*=\s*sanitizePlainText\(\s*safeInput\.name\s*,\s*\{\s*maxLength:\s*120\s*\}\s*\)/);
    expect(PROFILE_REPOSITORY).toMatch(/safeInput\.bio\s*=\s*sanitizePlainText\(\s*safeInput\.bio\s*,\s*\{\s*maxLength:\s*4000\s*\}\s*\)/);
  });

  it("keeps Profile input length limits aligned with repository clamps", () => {
    expect(PROFILE).toContain("PROFILE_NAME_MAX_LENGTH = 120");
    expect(PROFILE).toContain("PROFILE_BIO_MAX_LENGTH = 4000");
    expect(PROFILE).toMatch(/maxLength=\{PROFILE_NAME_MAX_LENGTH\}/);
    expect(PROFILE).toMatch(/maxLength=\{PROFILE_BIO_MAX_LENGTH\}/);
  });

  it("keeps avatar storage as IndexedDB Blob storage", () => {
    expect(AVATAR_STORAGE).toContain('DB_NAME = "oriexavatar"');
    expect(AVATAR_STORAGE).toContain('STORE_NAME = "imgs"');
    expect(AVATAR_STORAGE).toContain("AVATAR_LONG_EDGE_MAX = 512");
    expect(AVATAR_STORAGE).toMatch(/put\(\s*blob\s*,\s*keyFor\(uid\)\s*\)/);
    expect(PROFILE).toContain("saveAvatarBlob");
    expect(PROFILE).toContain("loadAvatarBlob");
    expect(PROFILE).toContain("deleteAvatarBlob");
  });

  it("does not regress to localStorage base64 avatar persistence", () => {
    expect(PROFILE).not.toMatch(/toDataURL\s*\(/);
    expect(PROFILE).not.toMatch(/readAsDataURL\s*\(/);
    expect(PROFILE).not.toMatch(/localStorage\s*\./);
    expect(AVATAR_STORAGE).not.toMatch(/toDataURL\s*\(/);
    expect(AVATAR_STORAGE).not.toMatch(/readAsDataURL\s*\(/);
    expect(AVATAR_STORAGE).not.toMatch(/localStorage\s*\./);
    expect(PROFILE).toMatch(/profiles\.save\(\s*profileUid\s*,\s*\{\s*name:\s*profile\.name\s*,\s*bio:\s*profile\.bio\s*\}\s*\)/);
    expect(PROFILE).not.toMatch(/avatar\s*:/);
  });

  it("renders text safely without HTML sinks and preserves bio line breaks visually", () => {
    expect(PROFILE).not.toContain("dangerouslySetInnerHTML");
    expect(PROFILE).not.toMatch(/\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);
    expect(PROFILE).toContain("{profile.name ||");
    expect(PROFILE).toContain("{profile.bio}");
    expect(PROFILE).toContain('whiteSpace: "pre-wrap"');
  });

  it("revokes object URLs when avatar previews are replaced or unmounted", () => {
    expect(PROFILE).toContain("URL.createObjectURL");
    expect(PROFILE).toContain("URL.revokeObjectURL");
    expect(PROFILE).toContain("revokeAvatarPreview");
  });

  it("does not save Profile without a usable uid", () => {
    expect(PROFILE).toContain("if (!profileUid)");
    expect(PROFILE).toContain("ログイン状態を確認してから保存してください。");
  });

  it("keeps Local AI UI paused", () => {
    const tabsBlock = (APP.match(/const TABS = \[([\s\S]*?)\];/) || [])[1] || "";
    expect(LOCAL_AI_FLAG).toMatch(/LOCAL_AI_UI_ENABLED\s*=\s*false/);
    expect(MAIN).toContain("LOCAL_AI_UI_ENABLED");
    expect(tabsBlock).not.toMatch(/localai/i);
    expect(existsSync("src/features/localAi/LocalAiPage.jsx")).toBe(true);
  });
});
