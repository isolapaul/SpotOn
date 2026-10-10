import {describe, expect, it} from "vitest";
import {toggleSpotLikeIn} from "../src/lib/spotLikes";
import {planSpotCleanup} from "../src/lib/accountDeletion";

describe("spot likes", () => {
  it("adds and removes the user, keeping the count exact", () => {
    expect(toggleSpotLikeIn(undefined, "a")).toEqual({likedBy: ["a"], likeCount: 1, liked: true});
    expect(toggleSpotLikeIn(["a", "b"], "a")).toEqual({likedBy: ["b"], likeCount: 1, liked: false});
    expect(toggleSpotLikeIn(["a", 3, null], "b")).toEqual({likedBy: ["a", "b"], likeCount: 2, liked: true});
  });
  it("account deletion takes the user's spot like out", () => {
    const plan = planSpotCleanup({createdBy: "x", likedBy: ["u", "v"], likeCount: 2}, "u", () => null);
    expect(plan.update).toMatchObject({likedBy: ["v"], likeCount: 1});
  });
});
