import {describe, expect, it} from "vitest";
import {isOwnSpotImagePath, parseStorageDownloadUrl} from "../src/lib/spotImages";

const BUCKET = "demo-spoton.appspot.com";
const UID = "user-123";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OWN_PATH = `spot-images/${UID}/${UUID}.jpg`;
const enc = encodeURIComponent;

function prodUrl(path: string, query = "alt=media&token=abc", bucket = BUCKET): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${enc(path)}?${query}`;
}

describe("parseStorageDownloadUrl", () => {
  it("valid prod URL → decoded path", () => {
    expect(parseStorageDownloadUrl(prodUrl(OWN_PATH), {bucket: BUCKET})).toEqual({path: OWN_PATH});
  });

  it("encoded path spot-images%2F<uid>%2F<uuid>.jpg", () => {
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/spot-images%2F${UID}%2F${UUID}.jpg?alt=media&token=t`;
    expect(parseStorageDownloadUrl(url, {bucket: BUCKET})).toEqual({path: OWN_PATH});
  });

  it("wrong host → null", () => {
    expect(parseStorageDownloadUrl(
      prodUrl(OWN_PATH).replace("firebasestorage.googleapis.com", "evil.example.com"),
      {bucket: BUCKET})).toBeNull();
    expect(parseStorageDownloadUrl(
      prodUrl(OWN_PATH).replace("firebasestorage.googleapis.com",
        "firebasestorage.googleapis.com.evil.example.com"),
      {bucket: BUCKET})).toBeNull();
  });

  it("userinfo (user@ / user:pass@) → null", () => {
    for (const userinfo of ["evil@", "evil:pw@", ":pw@"]) {
      const url = prodUrl(OWN_PATH).replace("https://", `https://${userinfo}`);
      expect(parseStorageDownloadUrl(url, {bucket: BUCKET})).toBeNull();
    }
    const emu = `http://evil@127.0.0.1:9199/v0/b/${BUCKET}/o/${enc(OWN_PATH)}?alt=media&token=t`;
    expect(parseStorageDownloadUrl(emu, {bucket: BUCKET, emulatorHost: "127.0.0.1:9199"}))
      .toBeNull();
  });

  it("wrong bucket → null", () => {
    expect(parseStorageDownloadUrl(prodUrl(OWN_PATH, undefined, "other.appspot.com"),
      {bucket: BUCKET})).toBeNull();
  });

  it("http in prod → null", () => {
    expect(parseStorageDownloadUrl(prodUrl(OWN_PATH).replace("https:", "http:"),
      {bucket: BUCKET})).toBeNull();
  });

  it("emulator URL only with a matching emulatorHost", () => {
    const url = `http://127.0.0.1:9199/v0/b/${BUCKET}/o/${enc(OWN_PATH)}?alt=media&token=t`;
    expect(parseStorageDownloadUrl(url, {bucket: BUCKET})).toBeNull();
    expect(parseStorageDownloadUrl(url, {bucket: BUCKET, emulatorHost: "127.0.0.1:9199"}))
      .toEqual({path: OWN_PATH});
    expect(parseStorageDownloadUrl(url, {bucket: BUCKET, emulatorHost: "localhost:9199"}))
      .toBeNull();
    expect(parseStorageDownloadUrl(url.replace("http:", "https:"),
      {bucket: BUCKET, emulatorHost: "127.0.0.1:9199"})).toBeNull();
  });

  it("missing token or alt=media → null", () => {
    expect(parseStorageDownloadUrl(prodUrl(OWN_PATH, "alt=media"), {bucket: BUCKET})).toBeNull();
    expect(parseStorageDownloadUrl(prodUrl(OWN_PATH, "alt=media&token="), {bucket: BUCKET}))
      .toBeNull();
    expect(parseStorageDownloadUrl(prodUrl(OWN_PATH, "token=abc"), {bucket: BUCKET})).toBeNull();
  });

  it("unencoded slashes in the object path → null", () => {
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${OWN_PATH}?alt=media&token=t`;
    expect(parseStorageDownloadUrl(url, {bucket: BUCKET})).toBeNull();
  });

  it("not a URL → null", () => {
    expect(parseStorageDownloadUrl("not a url", {bucket: BUCKET})).toBeNull();
    expect(parseStorageDownloadUrl("/placeholder-spot.jpg", {bucket: BUCKET})).toBeNull();
    expect(parseStorageDownloadUrl("", {bucket: BUCKET})).toBeNull();
  });

  it("malformed percent-encoding → null", () => {
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/spot-images%E0%A4%A?alt=media&token=t`;
    expect(parseStorageDownloadUrl(url, {bucket: BUCKET})).toBeNull();
  });
});

describe("isOwnSpotImagePath", () => {
  it("accepts spot-images/{uid}/{uuid}.{jpg|png|webp}", () => {
    for (const ext of ["jpg", "png", "webp"]) {
      expect(isOwnSpotImagePath(`spot-images/${UID}/${UUID}.${ext}`, UID)).toBe(true);
    }
  });

  it("rejects other extensions and names", () => {
    expect(isOwnSpotImagePath(`spot-images/${UID}/${UUID}.gif`, UID)).toBe(false);
    expect(isOwnSpotImagePath(`spot-images/${UID}/${UUID}.JPG`, UID)).toBe(false);
    expect(isOwnSpotImagePath(`spot-images/${UID}/x${UUID}.jpg`, UID)).toBe(false);
    expect(isOwnSpotImagePath(`spot-images/${UID}/sub/${UUID}.jpg`, UID)).toBe(false);
  });

  it("rejects a .. path (after URL decoding)", () => {
    const path = `spot-images/${UID}/../other/${UUID}.jpg`;
    const url = prodUrl(path);
    const parsed = parseStorageDownloadUrl(url, {bucket: BUCKET});
    expect(parsed).toEqual({path});
    expect(isOwnSpotImagePath(path, UID)).toBe(false);
    expect(isOwnSpotImagePath(`spot-images/${UID}/..%2F${UUID}.jpg`, UID)).toBe(false);
  });

  it("rejects another uid's path", () => {
    expect(isOwnSpotImagePath(`spot-images/other-uid/${UUID}.jpg`, UID)).toBe(false);
    expect(isOwnSpotImagePath(`spot-images/${UID}x/${UUID}.jpg`, UID)).toBe(false);
  });

  it("rejects the legacy flat path spot-images/123_x.jpg", () => {
    const path = "spot-images/123_x.jpg";
    expect(parseStorageDownloadUrl(prodUrl(path), {bucket: BUCKET})).toEqual({path});
    expect(isOwnSpotImagePath(path, UID)).toBe(false);
  });

  it("rejects other prefixes", () => {
    expect(isOwnSpotImagePath(`profile-pictures/${UID}/${UUID}.jpg`, UID)).toBe(false);
  });
});
