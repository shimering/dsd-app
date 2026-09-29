import { activeDesign, type Photo, type Tooth } from './domain';
import { lipPath, lipProblem, toothCorners, type View } from './geometry';
import { toothSprite } from './assets';
import { shadeTeeth, type LightFrame } from './lighting';

export function drawTooth(ctx: CanvasRenderingContext2D, t: Tooth) {
  const image = toothSprite(t);
  if (!image || !t.visible) return;
  if (Math.abs(t.perspective) < 0.005) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate((t.rotation * Math.PI) / 180);
    if (t.fdi >= 21) ctx.scale(-1, 1);
    ctx.drawImage(image, -t.width / 2, -t.height / 2, t.width, t.height);
    ctx.restore();
    return;
  }
  // Overlapping texture bands avoid triangle seams in translucent enamel.
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.fdi >= 21) ctx.scale(-1, 1);
  const count = 128;
  for (let row = 0; row < count; row++) {
    const start = Math.max(0, row / count - 0.0015),
      end = Math.min(1, (row + 1) / count + 0.0015),
      width =
        t.width * (1 - t.perspective + (2 * t.perspective * (start + end)) / 2);
    ctx.drawImage(
      image,
      0,
      start * image.height,
      image.width,
      (end - start) * image.height,
      -width / 2,
      -t.height / 2 + start * t.height,
      width,
      (end - start) * t.height,
    );
  }
  ctx.restore();
}
export function applyView(ctx: CanvasRenderingContext2D, v: View) {
  ctx.translate(v.width / 2 + v.pan.x, v.height / 2 + v.pan.y);
  ctx.rotate((v.rotation * Math.PI) / 180);
  ctx.scale(v.scale, v.scale);
  ctx.translate(-v.photoWidth / 2, -v.photoHeight / 2);
}
let lastLayer:
  | { photo: Photo; layer: HTMLCanvasElement; frame: LightFrame }
  | undefined;
export function drawTeeth(ctx: CanvasRenderingContext2D, photo: Photo) {
  const design = activeDesign(photo);
  // Posterior teeth behind anterior teeth at interproximal overlaps.
  const teeth = [...design.teeth]
    .filter((t) => t.visible)
    .sort((a, b) => Math.abs((b.fdi % 10) - 1) - Math.abs((a.fdi % 10) - 1));
  if (!teeth.length) return;
  if (!design.lighting) {
    teeth.forEach((t) => drawTooth(ctx, t));
    return;
  }
  if (lastLayer?.photo !== photo) {
    const corners = teeth.flatMap(toothCorners);
    const xs = corners.map((p) => p.x),
      ys = corners.map((p) => p.y);
    // Include the upper lip in the crop so shadow distances stay correct even
    // when the crowns start below it. Keep the layer within the source image.
    const x = Math.max(0, Math.floor(Math.min(...xs) - 2));
    const y = Math.max(
      0,
      Math.floor(Math.min(...ys, ...photo.lip.points.map((p) => p.y)) - 2),
    );
    const w = Math.min(photo.width, Math.ceil(Math.max(...xs) + 2)) - x;
    const h = Math.min(photo.height, Math.ceil(Math.max(...ys) + 2)) - y;
    if (w <= 0 || h <= 0) return;
    const scale = Math.min(1, 1800 / Math.max(w, h));
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(w * scale);
    layer.height = Math.ceil(h * scale);
    const layerCtx = layer.getContext('2d', { willReadFrequently: true })!;
    layerCtx.scale(scale, scale);
    layerCtx.translate(-x, -y);
    teeth.forEach((t) => drawTooth(layerCtx, t));
    const frame = { x, y, scale };
    shadeTeeth(layer, photo, frame);
    // Do not cache a partially loaded library.
    if (teeth.every((t) => toothSprite(t))) lastLayer = { photo, layer, frame };
    else {
      ctx.drawImage(layer, x, y, layer.width / scale, layer.height / scale);
      return;
    }
  }
  const { layer, frame } = lastLayer!;
  ctx.drawImage(
    layer,
    frame.x,
    frame.y,
    layer.width / frame.scale,
    layer.height / frame.scale,
  );
}
export function drawMockup(
  ctx: CanvasRenderingContext2D,
  photo: Photo,
  renderImage?: CanvasImageSource,
) {
  if (!photo.lip.closed || lipProblem(photo.lip)) return;
  ctx.save();
  ctx.clip(new Path2D(lipPath(photo.lip)));
  if (renderImage && photo.render?.sourceRevision === photo.revision)
    ctx.drawImage(renderImage, 0, 0, photo.width, photo.height);
  else {
    drawTeeth(ctx, photo);
  }
  ctx.restore();
}
export async function exportImage(
  photo: Photo,
  image: CanvasImageSource,
  comparison: boolean,
  split = 0.5,
  renderImage?: CanvasImageSource,
): Promise<Blob> {
  if (!photo.lip.closed || lipProblem(photo.lip))
    throw new Error('Confirm a valid lip outline before exporting.');
  if (!activeDesign(photo)?.teeth.some((t) => t.visible))
    throw new Error('Place teeth before exporting.');
  const a = (photo.rotation * Math.PI) / 180;
  const bw = Math.ceil(
      Math.abs(photo.width * Math.cos(a)) +
        Math.abs(photo.height * Math.sin(a)),
    ),
    bh = Math.ceil(
      Math.abs(photo.height * Math.cos(a)) +
        Math.abs(photo.width * Math.sin(a)),
    );
  const scale = Math.min(1, 4096 / Math.max(bw, bh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bw * scale);
  canvas.height = Math.round(bh * scale);
  const ctx = canvas.getContext('2d')!,
    v: View = {
      width: canvas.width,
      height: canvas.height,
      photoWidth: photo.width,
      photoHeight: photo.height,
      scale,
      rotation: photo.rotation,
      pan: { x: 0, y: 0 },
    };
  ctx.save();
  applyView(ctx, v);
  ctx.drawImage(image, 0, 0, photo.width, photo.height);
  ctx.restore();
  ctx.save();
  if (comparison) {
    ctx.beginPath();
    ctx.rect(canvas.width * split, 0, canvas.width, canvas.height);
    ctx.clip();
  }
  applyView(ctx, v);
  drawMockup(ctx, photo, renderImage);
  ctx.restore();
  if (comparison) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width * split, 0);
    ctx.lineTo(canvas.width * split, canvas.height);
    ctx.stroke();
  }
  const font = Math.max(12, Math.round(canvas.width * 0.018));
  ctx.font = `500 ${font}px sans-serif`;
  const label = 'Smile Studio • Simulation';
  const w = ctx.measureText(label).width + 24;
  ctx.fillStyle = 'rgba(18,28,37,.8)';
  ctx.fillRect(12, canvas.height - font - 30, w, font + 18);
  ctx.fillStyle = 'white';
  ctx.fillText(label, 24, canvas.height - 18);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Image export failed.')),
      'image/png',
    ),
  );
}
