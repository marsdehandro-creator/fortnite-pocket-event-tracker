import { describe, expect, it } from "vitest";
import { decideInstallMode } from "./install";

const base = { standalone: false, hasPrompt: false, ios: false, installedFlag: false };

describe("install button: shown only until the app is installed and opened on the device", () => {
  it("shows the browser's install prompt when the browser says the site is installable", () => {
    expect(decideInstallMode({ ...base, hasPrompt: true })).toBe("prompt");
  });

  it("hides once opened as the installed app", () => {
    expect(decideInstallMode({ ...base, standalone: true, hasPrompt: true })).toBeNull();
    expect(decideInstallMode({ ...base, standalone: true, ios: true })).toBeNull();
  });

  it("hides on Chromium when there's no install prompt (already installed, or not installable)", () => {
    expect(decideInstallMode(base)).toBeNull();
    expect(decideInstallMode({ ...base, installedFlag: true })).toBeNull();
  });

  it("offers Home Screen steps on iPhone/iPad until the visitor says it's added", () => {
    expect(decideInstallMode({ ...base, ios: true })).toBe("ios");
    expect(decideInstallMode({ ...base, ios: true, installedFlag: true })).toBeNull();
  });

  it("trusts a fresh install prompt over an old 'installed' flag (the app was uninstalled)", () => {
    expect(decideInstallMode({ ...base, hasPrompt: true, installedFlag: true })).toBe("prompt");
  });
});
