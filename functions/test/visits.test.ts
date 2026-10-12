import {describe, expect, it} from "vitest";
import {closeEnough, distanceM, parsePosition} from "../src/lib/visits";

describe("visits", () => {
  const spot = {lat: 47.4979, lng: 19.0402};
  it("measures distances", () => {
    expect(Math.round(distanceM(spot, {lat: 47.4979, lng: 19.0402}))).toBe(0);
    // About 111 m per 0.001 degree of latitude.
    expect(Math.round(distanceM(spot, {lat: 47.4989, lng: 19.0402}))).toBe(111);
  });
  it("accepts a position near the spot, allowing for its accuracy", () => {
    expect(closeEnough(spot, {lat: 47.4999, lng: 19.0402}, 10)).toBe(true); // ~222 m
    expect(closeEnough(spot, {lat: 47.5009, lng: 19.0402}, 10)).toBe(false); // ~333 m
    expect(closeEnough(spot, {lat: 47.5009, lng: 19.0402}, 60)).toBe(true);
    expect(closeEnough(spot, spot, 500)).toBe(false);
  });
  it("parses positions", () => {
    expect(parsePosition({lat: 1, lng: 2})).toEqual({lat: 1, lng: 2});
    expect(parsePosition({lat: 91, lng: 2})).toBeNull();
    expect(parsePosition({lat: "1", lng: 2})).toBeNull();
    expect(parsePosition(null)).toBeNull();
  });
});
