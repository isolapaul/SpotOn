import {describe, expect, it} from "vitest";
import {
  activeHighlightIds,
  CandidateSpot,
  computeAllowance,
  DocData,
  HIGHLIGHT_TTL_MS,
  highlightCandidateIds,
  isActiveEntry,
  MAX_HIGHLIGHT_CANDIDATES,
  planHighlight,
  planUnhighlight,
} from "../src/lib/highlights";

const NOW = new Date("2026-02-14T12:00:00.000Z");
const PAST = "2026-02-10T12:00:00.000Z";
const FUTURE = "2026-02-18T12:00:00.000Z";
const UID = "me";

const entry = (userId: string, expiresAt: string) =>
  ({userId, highlightedAt: "2026-02-07T12:00:00.000Z", expiresAt});

function ownSpot(extra: DocData = {}): DocData {
  return {status: "approved", createdBy: UID, ...extra};
}

function plan(overrides: Partial<Parameters<typeof planHighlight>[0]> = {}) {
  return planHighlight({
    uid: UID,
    spotId: "target",
    spot: ownSpot(),
    candidateSpots: [],
    allowance: 1,
    now: NOW,
    ...overrides,
  });
}

describe("constants", () => {
  it("TTL is 7 days", () => {
    expect(HIGHLIGHT_TTL_MS).toBe(604800000);
  });
});

describe("isActiveEntry", () => {
  it("own, unexpired entry only", () => {
    expect(isActiveEntry(entry(UID, FUTURE), UID, NOW)).toBe(true);
    expect(isActiveEntry(entry(UID, PAST), UID, NOW)).toBe(false);
    expect(isActiveEntry(entry(UID, NOW.toISOString()), UID, NOW)).toBe(false);
    expect(isActiveEntry(entry("other", FUTURE), UID, NOW)).toBe(false);
  });

  it("malformed entries are inactive", () => {
    for (const e of [null, undefined, "x", 1, [], {userId: UID}, {userId: UID, expiresAt: 1e15},
      {userId: UID, expiresAt: "garbage"}]) {
      expect(isActiveEntry(e, UID, NOW)).toBe(false);
    }
  });
});

describe("computeAllowance", () => {
  it("level slots per spot count", () => {
    expect(computeAllowance(0, undefined)).toBe(0);
    expect(computeAllowance(9, undefined)).toBe(0);
    expect(computeAllowance(10, undefined)).toBe(1);
    expect(computeAllowance(14, undefined)).toBe(1);
    expect(computeAllowance(15, undefined)).toBe(2);
    expect(computeAllowance(20, undefined)).toBe(2);
  });

  it("plus the Valentine highlightBonus (D9)", () => {
    const qr = (highlightBonus: unknown) => ({valentine2026: {highlightBonus}});
    expect(computeAllowance(9, qr(1))).toBe(1);
    expect(computeAllowance(10, qr(1))).toBe(2);
    expect(computeAllowance(15, qr(2))).toBe(4);
    expect(computeAllowance(20, qr(1))).toBe(3);
  });

  it("bad bonus values count as 0 or are floored", () => {
    const qr = (highlightBonus: unknown) => ({valentine2026: {highlightBonus}});
    expect(computeAllowance(10, qr(-3))).toBe(1);
    expect(computeAllowance(10, qr("x"))).toBe(1);
    expect(computeAllowance(10, qr(null))).toBe(1);
    expect(computeAllowance(10, qr(NaN))).toBe(1);
    expect(computeAllowance(10, qr(1.9))).toBe(2);
    expect(computeAllowance(10, qr("2"))).toBe(3);
    expect(computeAllowance(10, {})).toBe(1);
    expect(computeAllowance(10, "junk")).toBe(1);
  });
});

describe("highlightCandidateIds", () => {
  it("unique strings from highlightedSpots and legacy activeHighlights, excluding the target", () => {
    const user = {
      highlightedSpots: ["a", "b", "target", 7, "a"],
      questRewards: {valentine2026: {activeHighlights: [
        {spotId: "b"}, {spotId: "c"}, {spotId: "target"}, {spotId: 5}, null,
      ]}},
    };
    expect(highlightCandidateIds(user, "target")).toEqual(["a", "b", "c"]);
  });

  it("skips invalid stored ids (paths, dot and reserved ids)", () => {
    const user = {
      highlightedSpots: ["bad/id", "ok", "..", ".", "__x__", "", "x".repeat(201)],
      questRewards: {valentine2026: {activeHighlights: [{spotId: "a/b/c"}, {spotId: "ok2"}]}},
    };
    expect(highlightCandidateIds(user, "target")).toEqual(["ok", "ok2"]);
  });

  it("invalid ids do not use up the cap", () => {
    const ids = [...Array.from({length: 60}, (_, i) => `bad/${i}`),
      ...Array.from({length: 50}, (_, i) => `s${i}`)];
    expect(highlightCandidateIds({highlightedSpots: ids}, "t")).toHaveLength(50);
  });

  it("missing fields → none", () => {
    expect(highlightCandidateIds(undefined, "t")).toEqual([]);
    expect(highlightCandidateIds({}, "t")).toEqual([]);
    expect(highlightCandidateIds({highlightedSpots: "x", questRewards: 1}, "t")).toEqual([]);
  });

  it("capped", () => {
    const ids = Array.from({length: 80}, (_, i) => `s${i}`);
    expect(highlightCandidateIds({highlightedSpots: ids}, "t"))
      .toEqual(ids.slice(0, MAX_HIGHLIGHT_CANDIDATES));
    expect(MAX_HIGHLIGHT_CANDIDATES).toBe(50);
  });
});

describe("activeHighlightIds", () => {
  it("only existing spots with an active entry by uid", () => {
    const candidates: CandidateSpot[] = [
      {id: "active", data: {highlighted: [entry(UID, FUTURE)]}},
      {id: "expired", data: {highlighted: [entry(UID, PAST)]}},
      {id: "others", data: {highlighted: [entry("other", FUTURE)]}},
      {id: "missing", data: undefined},
      {id: "none", data: {}},
    ];
    expect(activeHighlightIds(candidates, UID, NOW)).toEqual(["active"]);
  });
});

describe("planHighlight", () => {
  it("writes the entry, isHighlighted and highlightedSpots", () => {
    const result = plan({
      spot: ownSpot({highlighted: [entry("other", FUTURE)]}),
      candidateSpots: [{id: "a", data: {highlighted: [entry(UID, FUTURE)]}}],
      allowance: 2,
    });
    const expiresAt = new Date(NOW.getTime() + HIGHLIGHT_TTL_MS).toISOString();
    expect(result).toEqual({
      plan: {
        spotUpdate: {
          highlighted: [
            entry("other", FUTURE),
            {userId: UID, highlightedAt: NOW.toISOString(), expiresAt},
          ],
          isHighlighted: true,
        },
        userUpdate: {highlightedSpots: ["a", "target"]},
        expiresAt,
      },
    });
    expect(expiresAt).toBe("2026-02-21T12:00:00.000Z");
  });

  it("an expired entry by uid is not counted and gets replaced", () => {
    const result = plan({spot: ownSpot({highlighted: [entry(UID, PAST), entry("other", PAST)]})});
    if (!("plan" in result)) throw new Error("expected a plan");
    expect(result.plan.spotUpdate.highlighted).toEqual([
      entry("other", PAST),
      {userId: UID, highlightedAt: NOW.toISOString(), expiresAt: result.plan.expiresAt},
    ]);
  });

  it("expired and stale candidates are pruned from highlightedSpots and not counted", () => {
    const result = plan({
      candidateSpots: [
        {id: "expired", data: {highlighted: [entry(UID, PAST)]}},
        {id: "gone", data: undefined},
      ],
      allowance: 1,
    });
    if (!("plan" in result)) throw new Error("expected a plan");
    expect(result.plan.userUpdate).toEqual({highlightedSpots: ["target"]});
  });

  it("not approved → failed-precondition", () => {
    for (const status of ["pending", undefined, "rejected"]) {
      expect(plan({spot: ownSpot({status})})).toEqual({error: {
        code: "failed-precondition", message: "Spot must be approved to highlight"}});
    }
  });

  it("not owner → permission-denied", () => {
    expect(plan({spot: ownSpot({createdBy: "other"})})).toEqual({error: {
      code: "permission-denied", message: "You can only highlight your own spots"}});
  });

  it("already active → permission-denied", () => {
    expect(plan({spot: ownSpot({highlighted: [entry(UID, FUTURE)]}), allowance: 5})).toEqual({
      error: {code: "permission-denied", message: "You have already highlighted this spot"}});
  });

  it("allowance 0 → No highlight bonus available", () => {
    expect(plan({allowance: 0})).toEqual({error: {
      code: "permission-denied", message: "No highlight bonus available"}});
  });

  it("limit reached → permission-denied", () => {
    expect(plan({
      candidateSpots: [
        {id: "a", data: {highlighted: [entry(UID, FUTURE)]}},
        {id: "b", data: {highlighted: [entry(UID, FUTURE)]}},
      ],
      allowance: 2,
    })).toEqual({error: {
      code: "permission-denied", message: "You have reached your highlight limit"}});
  });

  it("checks run in order: approved, owner, already, allowance, limit", () => {
    const worst = {
      spot: {status: "pending", createdBy: "other", highlighted: [entry(UID, FUTURE)]},
      allowance: 0,
    };
    expect(plan(worst)).toMatchObject({error: {message: "Spot must be approved to highlight"}});
    expect(plan({...worst, spot: {...worst.spot, status: "approved"}}))
      .toMatchObject({error: {message: "You can only highlight your own spots"}});
    expect(plan({...worst, spot: {...worst.spot, status: "approved", createdBy: UID}}))
      .toMatchObject({error: {message: "You have already highlighted this spot"}});
  });

  it("legacy activeHighlights are counted only when the spot entry is active", () => {
    const user = {
      questRewards: {valentine2026: {highlightBonus: 1, activeHighlights: [
        {spotId: "legacy-active", expiresAt: FUTURE},
        {spotId: "legacy-expired-on-spot", expiresAt: FUTURE},
      ]}},
    };
    const ids = highlightCandidateIds(user, "target");
    expect(ids).toEqual(["legacy-active", "legacy-expired-on-spot"]);

    // Only the expired-on-spot one exists as active in the user map: not counted.
    const onlyExpired: CandidateSpot[] = [
      {id: "legacy-active", data: {highlighted: [entry("other", FUTURE)]}},
      {id: "legacy-expired-on-spot", data: {highlighted: [entry(UID, PAST)]}},
    ];
    const ok = plan({candidateSpots: onlyExpired, allowance: 1});
    expect(ok).toHaveProperty("plan");

    const withActive: CandidateSpot[] = [
      {id: "legacy-active", data: {highlighted: [entry(UID, FUTURE)]}},
      onlyExpired[1],
    ];
    expect(plan({candidateSpots: withActive, allowance: 1})).toMatchObject({
      error: {message: "You have reached your highlight limit"}});
    const two = plan({candidateSpots: withActive, allowance: 2});
    if (!("plan" in two)) throw new Error("expected a plan");
    expect(two.plan.userUpdate).toEqual({highlightedSpots: ["legacy-active", "target"]});
  });
});

describe("planUnhighlight", () => {
  it("removes uid's entries and recomputes isHighlighted", () => {
    expect(planUnhighlight({
      uid: UID, spotId: "s",
      spot: {highlighted: [entry(UID, FUTURE)], isHighlighted: true},
      user: undefined,
    })).toEqual({spotUpdate: {highlighted: [], isHighlighted: false}});

    expect(planUnhighlight({
      uid: UID, spotId: "s",
      spot: {highlighted: [entry("other", PAST), entry(UID, PAST)], isHighlighted: true},
      user: undefined,
    })).toEqual({spotUpdate: {highlighted: [entry("other", PAST)], isHighlighted: true}});
  });

  it("no entry by uid → no spot write", () => {
    expect(planUnhighlight({
      uid: UID, spotId: "s", spot: {highlighted: [entry("other", FUTURE)]}, user: undefined,
    })).toEqual({});
    expect(planUnhighlight({uid: UID, spotId: "s", spot: {}, user: undefined})).toEqual({});
  });

  it("cleans the user side, including legacy activeHighlights, even without the spot", () => {
    const user = {
      highlightedSpots: ["a", "s"],
      questRewards: {valentine2026: {highlightBonus: 1, activeHighlights: [
        {spotId: "s", expiresAt: FUTURE}, {spotId: "b", expiresAt: FUTURE},
      ]}},
    };
    expect(planUnhighlight({uid: UID, spotId: "s", spot: undefined, user})).toEqual({
      userUpdate: {
        "highlightedSpots": ["a"],
        "questRewards.valentine2026.activeHighlights": [{spotId: "b", expiresAt: FUTURE}],
      },
    });
  });

  it("user without mentions → no user write", () => {
    expect(planUnhighlight({
      uid: UID, spotId: "s", spot: undefined,
      user: {highlightedSpots: ["a"], questRewards: {valentine2026: {activeHighlights: []}}},
    })).toEqual({});
  });
});
