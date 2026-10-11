import {describe, expect, it} from "vitest";
import {cleanErrorReport, countEvents, dayKey, errorHash, scrub, MAX_EVENTS} from "../src/lib/telemetry";

describe("telemetry", () => {
  it("counts only known events, at most MAX_EVENTS", () => {
    expect([...countEvents(["app_open", "app_open", "nope", 3])]).toEqual([["app_open", 2]]);
    expect(countEvents(Array(50).fill("visit")).get("visit")).toBe(MAX_EVENTS);
    expect(countEvents("app_open").size).toBe(0);
  });
  it("keys days in UTC", () => {
    expect(dayKey(Date.UTC(2026, 9, 11, 23, 59))).toBe("2026-10-11");
  });
  it("scrubs e-mails, ids and query strings", () => {
    expect(scrub("fail for a.b@x.hu at https://x.test/a?token=abc#f")).toBe("fail for <email> at https://x.test/a");
    expect(scrub("spot 0123456789abcdefghijKL missing")).toBe("spot :id missing");
  });
  it("cleans reports and hashes them stably", () => {
    expect(cleanErrorReport({message: "  "})).toBeNull();
    const r = cleanErrorReport({message: "boom ".repeat(100), stack: "Error\n    at f (a.js:1)", path: "/spot/1?x=y", version: "2.1.0", platform: "ios"})!;
    expect(r.message.length).toBeLessThanOrEqual(300);
    expect(r.path).toBe("/spot/1");
    expect(r.platform).toBe("ios");
    expect(cleanErrorReport({message: "m", version: "<b>", platform: "x"})).toMatchObject({version: "", platform: "web"});
    expect(errorHash(r)).toBe(errorHash({...r, path: "/other"}));
    expect(errorHash(r)).not.toBe(errorHash({...r, platform: "web"}));
  });
});
