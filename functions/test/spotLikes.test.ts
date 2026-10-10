import {describe, expect, it} from "vitest";
import {likeChange, onlyLikeCountChanged, spotLikeId} from "../src/lib/spotLikes";

describe("spot likes", () => {
  it("sets the wanted state, a repeat changes nothing", () => {
    expect(likeChange(false, true)).toBe(1);
    expect(likeChange(true, false)).toBe(-1);
    expect(likeChange(true, true)).toBe(0);
    expect(likeChange(false, false)).toBe(0);
  });
  it("one doc per spot and user", () => {
    expect(spotLikeId("s1", "u1")).toBe("s1_u1");
  });
});

describe("onlyLikeCountChanged", () => {
  it("is true only for a pure counter change", () => {
    expect(onlyLikeCountChanged({a: 1, likeCount: 1}, {a: 1, likeCount: 2})).toBe(true);
    expect(onlyLikeCountChanged({a: 1}, {a: 1, likeCount: 1})).toBe(true);
    expect(onlyLikeCountChanged({a: 1, likeCount: 1}, {a: 2, likeCount: 2})).toBe(false);
    expect(onlyLikeCountChanged({a: 1}, {a: 1})).toBe(false);
    expect(onlyLikeCountChanged(undefined, {likeCount: 1})).toBe(false);
  });
});
