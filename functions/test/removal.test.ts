import {describe, expect, it} from "vitest";
import {spotPhotoFiles} from "../src/lib/removal";

describe("spotPhotoFiles", () => {
  it("lists every photo once, with its uploader and the spot's creator as owners", () => {
    const files = spotPhotoFiles({
      createdBy: "owner",
      imageUrls: ["/a.jpg", "/b.jpg"],
      spotImages: [
        {url: "/b.jpg", addedBy: "helper"},
        {url: "/c.jpg", addedBy: "helper"},
      ],
    });
    expect(files).toEqual([
      {url: "/a.jpg", owners: ["", "owner"]},
      {url: "/b.jpg", owners: ["helper", "owner"]},
      {url: "/c.jpg", owners: ["helper", "owner"]},
    ]);
  });

  it("reads legacy and malformed shapes without throwing", () => {
    // Legacy: only imageUrls, no creator; junk entries are skipped.
    expect(spotPhotoFiles({imageUrls: ["/a.jpg", 7, null]})).toEqual([{url: "/a.jpg", owners: ["", ""]}]);
    expect(spotPhotoFiles({spotImages: [null, {url: 3}, {url: "/x.jpg", addedBy: 5}]})).toEqual([
      {url: "/x.jpg", owners: ["", ""]},
    ]);
    expect(spotPhotoFiles({imageUrls: "not-a-list", spotImages: {}})).toEqual([]);
    expect(spotPhotoFiles({})).toEqual([]);
  });

  it("keeps deleted accounts' spots as the placeholder owner", () => {
    expect(spotPhotoFiles({createdBy: "deleted-user", imageUrls: ["/k.jpg"]})).toEqual([
      {url: "/k.jpg", owners: ["", "deleted-user"]},
    ]);
  });
});
