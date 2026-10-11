import {describe, expect, it} from "vitest";
import {lastWeekKey, nextWeekViews, viewCounts, viewMarkId, weekKey} from "../src/lib/spotStats";

describe("spotStats", () => {
  const sun = Date.UTC(2026, 9, 11, 20); // Sunday
  const mon = Date.UTC(2026, 9, 12, 1);
  it("keys weeks by their Monday", () => {
    expect(weekKey(sun)).toBe("2026-10-05");
    expect(weekKey(mon)).toBe("2026-10-12");
    expect(lastWeekKey(mon)).toBe("2026-10-05");
  });
  it("counts one view per person and day", () => {
    expect(viewCounts(undefined, sun)).toBe(true);
    expect(viewCounts("2026-10-11", sun)).toBe(false);
    expect(viewCounts("2026-10-10", sun)).toBe(true);
    expect(viewMarkId("s", "u")).toBe("s_u");
  });
  it("restarts the weekly views each week", () => {
    expect(nextWeekViews(undefined, sun)).toEqual({week: "2026-10-05", views: 1});
    expect(nextWeekViews({week: "2026-10-05", views: 4}, sun)).toEqual({week: "2026-10-05", views: 5});
    expect(nextWeekViews({week: "2026-10-05", views: 4}, mon)).toEqual({week: "2026-10-12", views: 1});
  });
});
