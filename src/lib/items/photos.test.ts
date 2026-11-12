import { describe, expect, it } from "vitest";

import { isPhotoPath, photoUrl } from "./photos";

const U = "00000000-0000-4000-8000-00000000a11c";
const I = "11111111-1111-4111-8111-11111111111a";

describe("photoUrl", () => {
  it("gives a stable app URL for a storage path", () => {
    expect(photoUrl(`${U}/${I}/thumb.jpg`)).toBe(`/photos/${U}/${I}/thumb.jpg`);
    expect(photoUrl(null)).toBeNull();
  });
});

describe("isPhotoPath", () => {
  it("accepts only the closet layout", () => {
    expect(isPhotoPath(`${U}/${I}/thumb.jpg`)).toBe(true);
    expect(isPhotoPath(`${U}/${I}/full.jpg`)).toBe(true);
  });

  it("rejects anything else, including traversal", () => {
    expect(isPhotoPath(`${U}/${I}/other.jpg`)).toBe(false);
    expect(isPhotoPath(`${U}/../${I}/thumb.jpg`)).toBe(false);
    expect(isPhotoPath(`${U}/${I}/thumb.jpg/../x`)).toBe(false);
    expect(isPhotoPath(`not-a-uuid/${I}/thumb.jpg`)).toBe(false);
    expect(isPhotoPath(`${U}/${I}`)).toBe(false);
  });
});
