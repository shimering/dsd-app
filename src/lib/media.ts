import { PhotoAsset, ToothTransform } from "../types";
import {
  TOOTH_TEMPLATES,
  POPULAR_DENTAL_SHADES,
  getToothTypeFromFdi,
  isRightQuadrant,
} from "./tooth-templates";
import { downloadBlob } from "./storage";
import { imageFrame } from "../../supabase/functions/_shared/image-frame";
export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error("This image could not be decoded. Use JPEG, PNG or WebP."),
      );
    img.src = url;
  });
}
export async function inspectMedia(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    if (blob.type.startsWith("video/"))
      return await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () =>
            resolve({ width: video.videoWidth, height: video.videoHeight });
          video.onerror = () =>
            reject(new Error("Video format is not supported by this browser."));
          video.src = url;
        },
      );
    const img = await loadImage(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function imageData(url: string, max = 1600, padded = false) {
  const image = await loadImage(url),
    frame = padded
      ? imageFrame(image.naturalWidth, image.naturalHeight, max)
      : undefined,
    scale =
      frame?.scale ??
      Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = frame?.width ?? Math.round(image.naturalWidth * scale);
  canvas.height = frame?.height ?? Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    (frame?.offsetX ?? 0) * scale,
    (frame?.offsetY ?? 0) * scale,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
  );
  return {
    mimeType: "image/jpeg",
    data: canvas.toDataURL("image/jpeg", 0.92).split(",")[1],
  };
}
export function paintTeeth(
  ctx: CanvasRenderingContext2D,
  teeth: Record<number, ToothTransform>,
  scale = 1,
) {
  for (const t of Object.values(teeth)) {
    ctx.save();
    ctx.translate(t.x * scale, t.y * scale);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale((t.widthPx * scale) / 100, (t.heightPx * scale) / 100);
    ctx.translate(-50, -50);
    const template = TOOTH_TEMPLATES[t.form] ?? TOOTH_TEMPLATES.rounded;
    const path = new Path2D(
      t.customPath ??
        template.outlinePath(
          getToothTypeFromFdi(t.fdi),
          isRightQuadrant(t.fdi),
        ),
    );
    ctx.fillStyle =
      (POPULAR_DENTAL_SHADES.find((s) => s.code === t.shade)?.hex ??
        "#F3EFE3") + "cc";
    ctx.strokeStyle = "#13ccb4";
    ctx.lineWidth = 1;
    ctx.fill(path);
    ctx.stroke(path);
    ctx.restore();
  }
}
export async function designData(
  photo: PhotoAsset,
  teeth: Record<number, ToothTransform>,
  padded = false,
) {
  const image = await loadImage(photo.url!),
    frame = padded ? imageFrame(photo.width, photo.height) : undefined,
    scale =
      frame?.scale ?? Math.min(1, 1600 / Math.max(photo.width, photo.height));
  const canvas = document.createElement("canvas");
  canvas.width = frame?.width ?? Math.round(photo.width * scale);
  canvas.height = frame?.height ?? Math.round(photo.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate((frame?.offsetX ?? 0) * scale, (frame?.offsetY ?? 0) * scale);
  ctx.drawImage(image, 0, 0, photo.width * scale, photo.height * scale);
  paintTeeth(ctx, teeth, scale);
  return {
    mimeType: "image/png",
    data: canvas.toDataURL("image/png").split(",")[1],
  };
}
export type MouthMask = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export async function compositeSimulation(
  photo: PhotoAsset,
  generated: string,
  mask: MouthMask,
) {
  const original = await loadImage(photo.url!),
    after = await loadImage(generated),
    frame = imageFrame(photo.width, photo.height);
  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(original, 0, 0, photo.width, photo.height);
  const x = mask.left * photo.width,
    y = mask.top * photo.height,
    w = (mask.right - mask.left) * photo.width,
    h = (mask.bottom - mask.top) * photo.height;
  if (
    w <= 0 ||
    h <= 0 ||
    ![mask.left, mask.top, mask.right, mask.bottom].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    )
  )
    throw new Error("Review a valid mouth mask before generating.");
  if (
    Math.abs(
      after.naturalWidth /
        after.naturalHeight /
        (frame.frameWidth / frame.frameHeight) -
        1,
    ) > 0.015
  )
    throw new Error(
      "The generated image changed the framing. It was not composited. Generate a new preview and review registration.",
    );
  const left = Math.max(0, Math.floor(x)),
    top = Math.max(0, Math.floor(y)),
    regionWidth = Math.min(photo.width, Math.ceil(x + w)) - left,
    regionHeight = Math.min(photo.height, Math.ceil(y + h)) - top;
  const proposed = document.createElement("canvas");
  proposed.width = regionWidth;
  proposed.height = regionHeight;
  const pc = proposed.getContext("2d")!;
  pc.drawImage(
    after,
    ((frame.offsetX + left) / frame.frameWidth) * after.naturalWidth,
    ((frame.offsetY + top) / frame.frameHeight) * after.naturalHeight,
    (regionWidth / frame.frameWidth) * after.naturalWidth,
    (regionHeight / frame.frameHeight) * after.naturalHeight,
    0,
    0,
    regionWidth,
    regionHeight,
  );
  const pixels = ctx.getImageData(left, top, regionWidth, regionHeight),
    replacement = pc.getImageData(0, 0, regionWidth, regionHeight),
    cx = x + w / 2,
    cy = y + h / 2;
  // A pixel-centre mask has no antialiasing spill into unreviewed pixels.
  for (
    let py = Math.max(0, Math.floor(y));
    py < Math.min(photo.height, Math.ceil(y + h));
    py++
  )
    for (
      let px = Math.max(0, Math.floor(x));
      px < Math.min(photo.width, Math.ceil(x + w));
      px++
    ) {
      if (
        ((px + 0.5 - cx) / (w / 2)) ** 2 + ((py + 0.5 - cy) / (h / 2)) ** 2 >
        1
      )
        continue;
      const i = ((py - top) * regionWidth + px - left) * 4;
      pixels.data.set(replacement.data.subarray(i, i + 4), i);
    }
  ctx.putImageData(pixels, left, top);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image could not be saved.")),
      "image/png",
    ),
  );
}
export async function exportDesign(
  photo: PhotoAsset,
  teeth: Record<number, ToothTransform>,
) {
  const data = await designData(photo, teeth);
  const blob = await (
    await fetch(`data:${data.mimeType};base64,${data.data}`)
  ).blob();
  downloadBlob(blob, "smile-design-blueprint.png");
}
export async function exportSimulation(url: string) {
  const img = await loadImage(url),
    canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight + 64;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, img.naturalHeight, canvas.width, 64);
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.max(14, canvas.width / 70)}px sans-serif`;
  ctx.fillText(
    "Simulated treatment outcome • Requires dentist review",
    16,
    img.naturalHeight + 40,
  );
  const blob = await new Promise<Blob>((r) =>
    canvas.toBlob((b) => r(b!), "image/png"),
  );
  downloadBlob(blob, "smile-simulation-review.png");
}
