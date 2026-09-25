import {describe, expect, it} from "vitest";
import {normalizeEmail} from "../src/lib/admin";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@SpotOn.Test ")).toBe("user@spoton.test");
  });

  it("accepts the 3-char minimum and 254-char maximum", () => {
    expect(normalizeEmail("a@b")).toBe("a@b");
    const max = `${"a".repeat(64)}@${"b".repeat(189)}`;
    expect(max.length).toBe(254);
    expect(normalizeEmail(max)).toBe(max);
  });

  it("rejects out-of-range lengths", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("@b")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(64)}@${"b".repeat(190)}`)).toBeNull();
  });

  it("requires exactly one @", () => {
    expect(normalizeEmail("userspoton.test")).toBeNull();
    expect(normalizeEmail("a@b@c.test")).toBeNull();
  });

  it("rejects non-strings", () => {
    for (const input of [undefined, null, 42, {}, [], true]) {
      expect(normalizeEmail(input)).toBeNull();
    }
  });
});
