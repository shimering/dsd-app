import { expect, it } from "vitest";
import { imageFrame } from "../../supabase/functions/_shared/image-frame";
for (const [width, height] of [
  [1800, 1200],
  [1400, 2100],
  [1800, 1300],
  [640, 480],
  [4032, 3024],
  [2048, 1300],
])
  it(`pads ${width}×${height} without cropping or changing scale`, () => {
    const f = imageFrame(width, height);
    expect(f.frameWidth).toBeGreaterThanOrEqual(width);
    expect(f.frameHeight).toBeGreaterThanOrEqual(height);
    expect(f.offsetX * 2 + width).toBeCloseTo(f.frameWidth);
    expect(f.offsetY * 2 + height).toBeCloseTo(f.frameHeight);
    expect(Math.max(f.width, f.height)).toBeLessThanOrEqual(1600);
    expect((width * f.scale) / (height * f.scale)).toBeCloseTo(width / height);
  });
it("rejects unknown dimensions", () => {
  expect(() => imageFrame(0, 1300)).toThrow();
  expect(() => imageFrame(NaN, 1300)).toThrow();
});
