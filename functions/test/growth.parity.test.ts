// Parity between the server copies and the client's growth-plan constants (launch challenge,
// referrals, telemetry). Kept here because the image build has no functions/ folder, so tests
// under src/ must not import from it.
import {describe, expect, it} from "vitest";
import * as client from "../../src/lib/challenge";
import {REFERRAL_XP as CLIENT_REFERRAL_XP} from "../../src/lib/referral";
import {TELEMETRY_EVENTS} from "../../src/lib/telemetry";
import * as server from "../src/lib/challenge";
import {INVITE_BADGE_THRESHOLDS, REFERRAL_XP} from "../src/lib/referrals";
import {EVENT_NAMES} from "../src/lib/telemetry";

describe("growth plan parity with src/lib", () => {
  it("launch challenge: steps, season end and XP", () => {
    expect([...client.CHALLENGE_STEPS]).toEqual([...server.CHALLENGE_STEPS]);
    expect(client.LAUNCH_END_MS).toBe(server.LAUNCH_END_MS);
    expect(client.FOUNDER_XP).toBe(server.FOUNDER_XP);
  });
  it("referrals: XP and badge thresholds", () => {
    expect(CLIENT_REFERRAL_XP).toEqual(REFERRAL_XP);
    expect([...INVITE_BADGE_THRESHOLDS]).toEqual([3, 5, 10]);
  });
  it("telemetry: the event list", () => {
    expect([...TELEMETRY_EVENTS]).toEqual([...EVENT_NAMES]);
  });
});
