import {describe, expect, it} from "vitest";
import {
  PRUNABLE_TOKEN_ERROR_CODES,
  isPrunableTokenError,
  selectTokensToPrune,
} from "../src/lib/tokens";

const fail = (code?: string) => ({success: false, error: code === undefined ? {} : {code}});
const ok = {success: true};

describe("isPrunableTokenError", () => {
  it.each([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
  ])("prunes %s", (code) => {
    expect(isPrunableTokenError(code)).toBe(true);
    expect(PRUNABLE_TOKEN_ERROR_CODES.has(code)).toBe(true);
  });

  it.each([
    "messaging/internal-error",
    "messaging/server-unavailable",
    "messaging/quota-exceeded",
    "messaging/invalid-argument",
    undefined,
  ])("does not prune %s", (code) => {
    expect(isPrunableTokenError(code)).toBe(false);
  });
});

describe("selectTokensToPrune", () => {
  it("prunes both dead-token codes", () => {
    expect(
      selectTokensToPrune(["a", "b"], [
        fail("messaging/registration-token-not-registered"),
        fail("messaging/invalid-registration-token"),
      ]),
    ).toEqual(["a", "b"]);
  });

  it("keeps tokens with transient or unknown errors", () => {
    expect(
      selectTokensToPrune(["a", "b", "c", "d", "e"], [
        fail("messaging/internal-error"),
        fail("messaging/server-unavailable"),
        fail("messaging/quota-exceeded"),
        fail("messaging/invalid-argument"),
        fail(),
      ]),
    ).toEqual([]);
  });

  it("handles mixed success/failure arrays", () => {
    expect(
      selectTokensToPrune(["ok1", "dead1", "transient", "ok2", "dead2"], [
        ok,
        fail("messaging/registration-token-not-registered"),
        fail("messaging/internal-error"),
        ok,
        fail("messaging/invalid-registration-token"),
      ]),
    ).toEqual(["dead1", "dead2"]);
  });

  it("aligns tokens and responses by index", () => {
    const tokens = ["t0", "t1", "t2", "t3"];
    const responses = [
      ok,
      ok,
      ok,
      fail("messaging/registration-token-not-registered"),
    ];
    expect(selectTokensToPrune(tokens, responses)).toEqual(["t3"]);
    expect(selectTokensToPrune(tokens, [...responses].reverse())).toEqual(["t0"]);
  });

  it("never prunes a successful response", () => {
    expect(
      selectTokensToPrune(["a"], [
        {success: true, error: {code: "messaging/registration-token-not-registered"}},
      ]),
    ).toEqual([]);
  });
});
