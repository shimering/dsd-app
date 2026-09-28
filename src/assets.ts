import { FDI, FORMS, TEXTURES, type Tooth } from './domain';

export const crownColumn = (fdi: number) =>
  ({ 11: 0, 21: 0, 12: 1, 22: 1, 13: 2, 23: 2, 14: 3, 24: 3, 15: 4, 25: 4 })[
    fdi
  ] ?? -1;
const sprites = new Map<string, HTMLCanvasElement>();
const spriteKey = (tooth: Pick<Tooth, 'form' | 'texture' | 'fdi'>) =>
  `${tooth.form}/${tooth.texture}/${crownColumn(tooth.fdi)}`;
let pending: Promise<void> | undefined;

// Isolate the enamel component at display time. Generative atlases can contain
// disconnected colored pixels in their gutters; these must never enter a mockup.
export function extractCrown(
  image: CanvasImageSource,
  width: number,
  height: number,
  column: number,
  row: number,
): HTMLCanvasElement {
  const x = Math.round((column * width) / 5),
    y = Math.round((row * height) / 3);
  const w = Math.round(((column + 1) * width) / 5) - x,
    h = Math.round(((row + 1) * height) / 3) - y;
  const cell = document.createElement('canvas');
  cell.width = w;
  cell.height = h;
  const ctx = cell.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h),
    px = data.data,
    n = w * h;
  const visited = new Uint8Array(n),
    queue = new Int32Array(n);
  let largest: number[] = [];
  const enamel = (i: number) =>
    px[i * 4 + 3] > 110 &&
    Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) > 65 &&
    Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) -
      Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) <
      105;
  for (let i = 0; i < n; i++) {
    if (visited[i] || !enamel(i)) continue;
    let head = 0,
      tail = 1;
    queue[0] = i;
    visited[i] = 1;
    while (head < tail) {
      const p = queue[head++],
        cx = p % w;
      for (const next of [
        cx > 0 ? p - 1 : -1,
        cx < w - 1 ? p + 1 : -1,
        p - w,
        p + w,
      ])
        if (next >= 0 && next < n && !visited[next] && enamel(next)) {
          visited[next] = 1;
          queue[tail++] = next;
        }
    }
    if (tail > largest.length) largest = Array.from(queue.subarray(0, tail));
  }
  if (largest.length < n * 0.07)
    throw new Error(
      'A tooth asset could not be loaded. Please reload the library.',
    );
  const mask = new Uint8Array(n);
  for (const p of largest) mask[p] = 1;
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) px[i * 4 + 3] = 0;
    else {
      const cx = i % w,
        cy = Math.floor(i / w);
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy);
      maxY = Math.max(maxY, cy);
    }
  }
  ctx.putImageData(data, 0, 0);
  const crown = document.createElement('canvas');
  crown.width = maxX - minX + 1;
  crown.height = maxY - minY + 1;
  crown
    .getContext('2d')!
    .drawImage(
      cell,
      minX,
      minY,
      crown.width,
      crown.height,
      0,
      0,
      crown.width,
      crown.height,
    );
  return crown;
}
export function loadToothLibrary(): Promise<void> {
  if (pending) return pending;
  pending = Promise.all(
    FORMS.map(async (form) => {
      const image = new Image();
      image.src = `/teeth/${form.id}.png`;
      await image.decode();
      TEXTURES.forEach((texture, row) => {
        [11, 12, 13, 14, 15].forEach((fdi) =>
          sprites.set(
            spriteKey({ form: form.id, texture, fdi }),
            extractCrown(
              image,
              image.width,
              image.height,
              crownColumn(fdi),
              row,
            ),
          ),
        );
      });
    }),
  )
    .then(() => undefined)
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
const shaded = new Map<string, HTMLCanvasElement>();
export function toothSprite(tooth: Tooth): HTMLCanvasElement | undefined {
  const key = spriteKey(tooth),
    source = sprites.get(key);
  if (!source) return;
  if (tooth.shade === 'A1') return source;
  const shadeKey = key + '/' + tooth.shade;
  if (shaded.has(shadeKey)) return shaded.get(shadeKey);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height),
    px = data.data;
  const adjustments = {
    A2: [-5, -10, -18],
    B1: [7, 8, 11],
    BL2: [14, 18, 26],
    BL1: [23, 27, 36],
  }[tooth.shade];
  for (let i = 0; i < px.length; i += 4)
    for (let c = 0; c < 3; c++)
      px[i + c] = Math.min(255, Math.max(0, px[i + c] + adjustments[c]));
  ctx.putImageData(data, 0, 0);
  shaded.set(shadeKey, canvas);
  return canvas;
}
export const libraryCount = () => FDI.length * FORMS.length * TEXTURES.length;
