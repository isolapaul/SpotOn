import {describe, expect, it} from "vitest";
import {NAME_COLORS, NAME_FONTS} from "../src/lib/levels";
import {
  buildPublicProfile,
  NameStyleValidationError,
  normalizeUsername,
  profileFieldsEqual,
  USERNAME_RE,
  validateNameStylePatch,
} from "../src/lib/profiles";

describe("normalizeUsername", () => {
  it("accepts 3-20 chars of a-z, 0-9, _", () => {
    expect(normalizeUsername("abc")).toBe("abc");
    expect(normalizeUsername("user_01")).toBe("user_01");
    expect(normalizeUsername("a".repeat(20))).toBe("a".repeat(20));
  });

  it("trims and lowercases", () => {
    expect(normalizeUsername("A_b")).toBe("a_b");
    expect(normalizeUsername("  Spot_On  ")).toBe("spot_on");
  });

  it("rejects too short / too long", () => {
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("a".repeat(21))).toBeNull();
  });

  it("rejects characters outside a-z, 0-9, _", () => {
    expect(normalizeUsername("béla")).toBeNull();
    expect(normalizeUsername("Béla")).toBeNull();
    expect(normalizeUsername("a b")).toBeNull();
    expect(normalizeUsername("a-b")).toBeNull();
    expect(normalizeUsername("a/bc")).toBeNull();
  });

  it("rejects non-strings", () => {
    for (const input of [undefined, null, 123, {}, [], true]) {
      expect(normalizeUsername(input)).toBeNull();
    }
  });

  it("USERNAME_RE is the combined rule", () => {
    expect(USERNAME_RE.source).toBe("^[a-z0-9_]{3,20}$");
  });
});

describe("validateNameStylePatch", () => {
  it("accepts every allowlisted color and font", () => {
    for (const color of NAME_COLORS) {
      expect(validateNameStylePatch({color})).toEqual({color});
    }
    for (const font of NAME_FONTS) {
      expect(validateNameStylePatch({font})).toEqual({font});
    }
    expect(validateNameStylePatch({color: "text-rose-400", font: "font-mono"}))
      .toEqual({color: "text-rose-400", font: "font-mono"});
  });

  it("accepts null (clear)", () => {
    expect(validateNameStylePatch({color: null})).toEqual({color: null});
    expect(validateNameStylePatch({font: null})).toEqual({font: null});
    expect(validateNameStylePatch({color: null, font: null})).toEqual({color: null, font: null});
  });

  it("rejects unknown values", () => {
    for (const data of [
      {color: "text-red-500"},
      {color: "#ff0000"},
      {font: "fixed inset-0"},
      {font: "font-sans "},
      {color: 1},
      {font: undefined},
      {color: "text-cyan-300", font: "font-comic"},
    ]) {
      expect(() => validateNameStylePatch(data)).toThrow(NameStyleValidationError);
    }
  });

  it("rejects unknown keys", () => {
    expect(() => validateNameStylePatch({size: "xl"})).toThrow(NameStyleValidationError);
    expect(() => validateNameStylePatch({color: "text-cyan-300", size: "xl"}))
      .toThrow(NameStyleValidationError);
  });

  it("rejects an empty object", () => {
    expect(() => validateNameStylePatch({})).toThrow(NameStyleValidationError);
  });

  it("rejects non-objects", () => {
    for (const data of [undefined, null, "text-cyan-300", 5, [], ["color"], true]) {
      expect(() => validateNameStylePatch(data)).toThrow(NameStyleValidationError);
    }
  });
});

describe("buildPublicProfile", () => {
  const base = {
    uid: "u1",
    username: "spot_user",
    email: "private@example.test",
    profilePictureURL: "https://img.example/p.png",
    photoURL: "https://img.example/g.png",
    customNameColor: "text-cyan-300",
    customNameFont: "font-serif italic",
    savedSpots: ["s1"],
    fcmTokens: ["tok"],
  };

  it("projects only the public fields", () => {
    expect(buildPublicProfile({...base, spotsCount: 4}, {isAdmin: true})).toEqual({
      username: "spot_user",
      profilePictureURL: "https://img.example/p.png",
      customNameColor: "text-cyan-300",
      customNameFont: "font-serif italic",
      isAdmin: true,
      spotsCount: 4,
    });
  });

  it("drops an injected font and non-allowlisted colours to null", () => {
    const p = buildPublicProfile(
      {...base, customNameFont: "fixed inset-0", customNameColor: "#ff00ff"},
      {isAdmin: false},
    );
    expect(p.customNameFont).toBeNull();
    expect(p.customNameColor).toBeNull();
  });

  it("falls back to photoURL, then null", () => {
    expect(buildPublicProfile({...base, profilePictureURL: ""}, {isAdmin: false})
      .profilePictureURL).toBe("https://img.example/g.png");
    expect(buildPublicProfile({...base, profilePictureURL: undefined}, {isAdmin: false})
      .profilePictureURL).toBe("https://img.example/g.png");
    expect(buildPublicProfile({...base, profilePictureURL: "", photoURL: ""}, {isAdmin: false})
      .profilePictureURL).toBeNull();
    expect(buildPublicProfile({}, {isAdmin: false}).profilePictureURL).toBeNull();
  });

  it("omits spotsCount when absent or not a non-negative integer", () => {
    expect("spotsCount" in buildPublicProfile(base, {isAdmin: false})).toBe(false);
    for (const spotsCount of [-1, 1.5, "3", null, NaN]) {
      expect("spotsCount" in buildPublicProfile({...base, spotsCount}, {isAdmin: false}))
        .toBe(false);
    }
    expect(buildPublicProfile({...base, spotsCount: 0}, {isAdmin: false}).spotsCount).toBe(0);
  });

  it("nulls a missing or non-string username and missing styles", () => {
    const p = buildPublicProfile({username: 42}, {isAdmin: false});
    expect(p).toEqual({
      username: null,
      profilePictureURL: null,
      customNameColor: null,
      customNameFont: null,
      isAdmin: false,
    });
  });

  it("keeps a legacy (invalid) username string as-is", () => {
    expect(buildPublicProfile({username: "Béla"}, {isAdmin: false}).username).toBe("Béla");
  });
});

describe("profileFieldsEqual", () => {
  const a = {username: "x_y", profilePictureURL: null, isAdmin: false, spotsCount: 3};

  it("ignores updatedAt", () => {
    expect(profileFieldsEqual({...a, updatedAt: 1}, {...a, updatedAt: 2})).toBe(true);
    expect(profileFieldsEqual({...a, updatedAt: 1}, a)).toBe(true);
  });

  it("detects a changed value", () => {
    expect(profileFieldsEqual(a, {...a, spotsCount: 4})).toBe(false);
    expect(profileFieldsEqual(a, {...a, isAdmin: true})).toBe(false);
    expect(profileFieldsEqual(a, {...a, profilePictureURL: ""})).toBe(false);
  });

  it("compares keys from both sides", () => {
    const withoutCount = {username: "x_y", profilePictureURL: null, isAdmin: false};
    expect(profileFieldsEqual(a, withoutCount)).toBe(false);
    expect(profileFieldsEqual(withoutCount, a)).toBe(false);
    expect(profileFieldsEqual({}, {})).toBe(true);
  });
});
