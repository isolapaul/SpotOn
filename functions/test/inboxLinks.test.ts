import {describe, expect, it} from "vitest";
import {inboxLinkPath, pushLink} from "../src/lib/inboxLinks";

describe("push links", () => {
  it("follow news open the profile, spot news the spot, removals nothing", () => {
    expect(inboxLinkPath({type: "new_follower", spotId: "", actorUid: "u1"})).toBe("/user/u1");
    expect(inboxLinkPath({type: "follow_request", spotId: ""})).toBe("");
    expect(inboxLinkPath({type: "followed_spot", spotId: "s 1", actorUid: "u1"})).toBe("/spot/s%201");
    expect(inboxLinkPath({type: "spot_approved", spotId: "s1"})).toBe("/spot/s1");
    expect(inboxLinkPath({type: "spot_removed", spotId: "s1"})).toBe("");
  });
  it("only https app URLs, only same-site paths", () => {
    expect(pushLink("https://a.hu/", "/spot/x")).toBe("https://a.hu/spot/x");
    expect(pushLink("https://a.hu", "")).toBe("https://a.hu");
    expect(pushLink("https://a.hu", "//evil.com")).toBe("https://a.hu");
    expect(pushLink("http://localhost:3000", "/spot/x")).toBeNull();
  });
});
