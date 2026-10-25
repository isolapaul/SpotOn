import {describe, expect, it} from "vitest";
import {reportKey} from "../src/lib/reportKey";

describe("reportKey", () => {
  it("is 32 hex characters and stable", () => {
    const key = reportKey("review", "spot1", "user1");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(reportKey("review", "spot1", "user1")).toBe(key);
  });

  it("differs for any changed part", () => {
    const base = reportKey("review", "spot1", "user1");
    expect(reportKey("reply", "spot1", "user1")).not.toBe(base);
    expect(reportKey("review", "spot2", "user1")).not.toBe(base);
    expect(reportKey("review", "spot1", "user2")).not.toBe(base);
  });
});
