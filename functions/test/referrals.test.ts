import {describe, expect, it} from "vitest";
import {CLAIM_WINDOW_MS, canClaimReferral, normalizeInviteCode, referralXp} from "../src/lib/referrals";

describe("referrals", () => {
  it("reads a username, @name or an invite link as the code", () => {
    expect(normalizeInviteCode(" Anna_B ")).toBe("anna_b");
    expect(normalizeInviteCode("@anna_b")).toBe("anna_b");
    expect(normalizeInviteCode("https://spoton.isolapaul.hu/i/anna_b?x=1")).toBe("anna_b");
    expect(normalizeInviteCode("a")).toBeNull();
    expect(normalizeInviteCode("no spaces")).toBeNull();
    expect(normalizeInviteCode(5)).toBeNull();
  });
  it("allows a claim only in the first week", () => {
    const now = Date.UTC(2026, 9, 11);
    expect(canClaimReferral(now - 1000, now)).toBe(true);
    expect(canClaimReferral(now - CLAIM_WINDOW_MS - 1, now)).toBe(false);
    expect(canClaimReferral(Number.NaN, now)).toBe(false);
  });
  it("adds up referral XP", () => {
    expect(referralXp(0, 0, false)).toBe(0);
    expect(referralXp(3, 1, true)).toBe(3 * 10 + 20 + 10);
  });
});
