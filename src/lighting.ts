import {
  activeDesign,
  DEFAULT_LIGHTING,
  type Lighting,
  type Photo,
} from './domain';
import { toothSprite } from './assets';
import { clamp, lipPath, lipProblem, toothCorners } from './geometry';

export type LightFrame = { x: number; y: number; scale: number };
const luminance = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
};

function lipMask(
  photo: Photo,
  width: number,
  height: number,
  frame: LightFrame,
) {
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext('2d')!;
  ctx.scale(frame.scale, frame.scale);
  ctx.translate(-frame.x, -frame.y);
  ctx.fill(new Path2D(lipPath(photo.lip)));
  return mask;
}

// Process only the transparent tooth layer. The photograph is never filtered.
// Pixel math also works in Safari, without relying on Canvas filter support.
export function shadeTeeth(
  layer: HTMLCanvasElement,
  photo: Photo,
  frame: LightFrame,
) {
  const design = activeDesign(photo);
  const light = design.lighting ?? DEFAULT_LIGHTING;
  if (
    Object.keys(DEFAULT_LIGHTING).every(
      (key) =>
        light[key as keyof Lighting] ===
        DEFAULT_LIGHTING[key as keyof Lighting],
    )
  )
    return;
  const ctx = layer.getContext('2d', { willReadFrequently: true })!;
  const { width, height } = layer;
  const data = ctx.getImageData(0, 0, width, height),
    px = data.data;
  const teeth = design.teeth.filter((t) => t.visible);
  const left = teeth.find((t) => t.fdi === 11),
    right = teeth.find((t) => t.fdi === 21);
  const center =
    left && right
      ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
      : {
          x: teeth.reduce((s, t) => s + t.x, 0) / teeth.length,
          y: teeth.reduce((s, t) => s + t.y, 0) / teeth.length,
        };
  const length =
    left && right ? Math.hypot(right.x - left.x, right.y - left.y) : 0;
  const axis =
    length > 0.001
      ? { x: (right!.x - left!.x) / length, y: (right!.y - left!.y) / length }
      : { x: 1, y: 0 };
  const radius = Math.max(
    1,
    ...teeth
      .flatMap(toothCorners)
      .map((p) =>
        Math.abs((p.x - center.x) * axis.x + (p.y - center.y) * axis.y),
      ),
  );
  const top = new Float32Array(width).fill(-Infinity);
  let reach = 1;
  if (light.lipShadow && photo.lip.closed && !lipProblem(photo.lip)) {
    const mask = lipMask(photo, width, height, frame)
      .getContext('2d')!
      .getImageData(0, 0, width, height).data;
    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++)
        if (mask[(y * width + x) * 4 + 3] > 128) {
          top[x] = y;
          break;
        }
    const ys = photo.lip.points.map((p) => p.y);
    reach = Math.max(
      1,
      ((Math.max(...ys) - Math.min(...ys)) * frame.scale * light.shadowDepth) /
        100,
    );
  }
  const exposure = 2 ** (light.brightness / 100),
    saturation = 1 + light.saturation / 100;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!px[i + 3]) continue;
      const lum = luminance(px[i], px[i + 1], px[i + 2]);
      const highlight =
        ((Math.max(0, lum - 195) * light.highlights) / 100) * 0.7;
      const position = clamp(
        ((frame.x + x / frame.scale - center.x) * axis.x +
          (frame.y + y / frame.scale - center.y) * axis.y) /
          radius,
        -1,
        1,
      );
      const posterior =
        ((clamp((Math.abs(position) - 0.22) / 0.78, 0, 1) ** 1.6 *
          light.posteriorShadow) /
          100) *
        0.7;
      const directional =
        ((Math.max(0, Math.sign(light.lightBalance) * position) *
          Math.abs(light.lightBalance)) /
          100) *
        0.5;
      const belowLip = y - top[x];
      const shadow =
        belowLip >= 0
          ? (light.lipShadow / 100) * 0.85 * Math.exp(-belowLip / (reach * 0.5))
          : 0;
      const factor =
        exposure * (1 - posterior) * (1 - directional) * (1 - shadow);
      px[i] = clamp(
        (lum + (px[i] - lum) * saturation - highlight + light.warmth * 0.4) *
          factor,
        0,
        255,
      );
      px[i + 1] = clamp(
        (lum +
          (px[i + 1] - lum) * saturation -
          highlight +
          light.warmth * 0.1) *
          factor,
        0,
        255,
      );
      px[i + 2] = clamp(
        (lum +
          (px[i + 2] - lum) * saturation -
          highlight -
          light.warmth * 0.55) *
          factor,
        0,
        255,
      );
    }
  }
  ctx.putImageData(data, 0, 0);
}

// Estimate a starting point from bright, low-chroma enamel inside the original
// opening. Dark oral pixels and red gums/lips must not set the tooth exposure.
export function matchPhotoLighting(
  image: CanvasImageSource,
  photo: Photo,
): Lighting {
  if (!photo.lip.closed || lipProblem(photo.lip))
    throw new Error('Confirm the lip outline before matching the photo.');
  const teeth = activeDesign(photo).teeth.filter((t) => t.visible);
  if (!teeth.length) throw new Error('Place teeth before matching the photo.');
  const xs = photo.lip.points.map((p) => p.x),
    ys = photo.lip.points.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    w = Math.max(...xs) - x,
    h = Math.max(...ys) - y;
  const scale = Math.min(1, 320 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(
    lipMask(photo, canvas.width, canvas.height, { x, y, scale }),
    0,
    0,
  );
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples: {
    r: number;
    g: number;
    b: number;
    lum: number;
    x: number;
    y: number;
  }[] = [];
  let openingPixels = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    openingPixels++;
    const r = px[i],
      g = px[i + 1],
      b = px[i + 2],
      lum = luminance(r, g, b);
    if (
      lum > 75 &&
      lum < 250 &&
      Math.max(r, g, b) - Math.min(r, g, b) < 70 &&
      b > r * 0.55 &&
      g > r * 0.65
    )
      samples.push({
        r,
        g,
        b,
        lum,
        x: ((i / 4) % canvas.width) / canvas.width,
        y: Math.floor(i / 4 / canvas.width) / canvas.height,
      });
  }
  if (samples.length < Math.max(30, openingPixels * 0.025))
    throw new Error(
      'No reliable tooth color was found in the original opening. Adjust the lighting sliders manually.',
    );
  const cutoff = percentile(
    samples.map((p) => p.lum),
    0.6,
  );
  const enamel = samples.filter((p) => p.lum >= cutoff);
  const mean = (key: 'r' | 'g' | 'b' | 'lum', list = enamel) =>
    list.reduce((s, p) => s + p[key], 0) / list.length;
  const reference: { r: number; g: number; b: number; lum: number }[] = [];
  for (const tooth of teeth) {
    const sprite = toothSprite(tooth);
    if (!sprite) continue;
    const data = sprite
      .getContext('2d')!
      .getImageData(0, 0, sprite.width, sprite.height).data;
    for (let i = 0; i < data.length; i += 64)
      if (data[i + 3] > 200)
        reference.push({
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
          lum: luminance(data[i], data[i + 1], data[i + 2]),
        });
  }
  if (!reference.length)
    throw new Error(
      'Wait for the tooth library to load, then match the photo.',
    );
  const refCutoff = percentile(
    reference.map((p) => p.lum),
    0.6,
  );
  const refEnamel = reference.filter((p) => p.lum >= refCutoff);
  const refMean = (key: 'r' | 'g' | 'b' | 'lum') =>
    refEnamel.reduce((s, p) => s + p[key], 0) / refEnamel.length;
  const center = samples.filter((p) => p.x > 0.3 && p.x < 0.7);
  const centerLum = percentile(
    (center.length ? center : samples).map((p) => p.lum),
    0.75,
  );
  const bandLum = (test: (p: (typeof samples)[number]) => boolean) => {
    const band = samples.filter(test);
    return band.length >= 15
      ? percentile(
          band.map((p) => p.lum),
          0.75,
        )
      : centerLum;
  };
  const topLum = bandLum((p) => p.y < 0.3),
    sidesLum = bandLum((p) => p.x < 0.25 || p.x > 0.75);
  const round = (value: number, min: number, max: number) =>
    Math.round(clamp(value, min, max));
  return {
    brightness: round(
      Math.log2(mean('lum') / refMean('lum')) * 100 + 3,
      -40,
      25,
    ),
    warmth: round(
      (mean('r') - mean('b') - (refMean('r') - refMean('b'))) / 0.95,
      -35,
      35,
    ),
    saturation: round(
      ((mean('r') - mean('b')) / Math.max(8, refMean('r') - refMean('b')) - 1) *
        30,
      -40,
      25,
    ),
    highlights: 35,
    lipShadow: round(18 + (1 - topLum / centerLum) * 80, 12, 50),
    shadowDepth: 35,
    posteriorShadow: round(16 + (1 - sidesLum / centerLum) * 80, 12, 50),
    lightBalance: round(
      ((bandLum((p) => p.x < 0.45) - bandLum((p) => p.x > 0.55)) / centerLum) *
        100,
      -40,
      40,
    ),
  };
}
