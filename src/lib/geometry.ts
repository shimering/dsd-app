import { FacialGuides, Point2D } from "../types";
export const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));
export function imageToScreen(
  p: Point2D,
  center: Point2D,
  width: number,
  height: number,
  scale: number,
  rotation = 0,
): Point2D {
  const a = (rotation * Math.PI) / 180,
    x = p.x - width / 2,
    y = p.y - height / 2;
  return {
    x: center.x + (x * Math.cos(a) - y * Math.sin(a)) * scale,
    y: center.y + (x * Math.sin(a) + y * Math.cos(a)) * scale,
  };
}
export function screenToImage(
  p: Point2D,
  center: Point2D,
  width: number,
  height: number,
  scale: number,
  rotation = 0,
): Point2D {
  const a = (-rotation * Math.PI) / 180,
    x = (p.x - center.x) / scale,
    y = (p.y - center.y) / scale;
  return {
    x: x * Math.cos(a) - y * Math.sin(a) + width / 2,
    y: x * Math.sin(a) + y * Math.cos(a) + height / 2,
  };
}
export function calibrationScale(
  a: Point2D,
  b: Point2D,
  realDistanceMm: number,
): number {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  if (!Number.isFinite(realDistanceMm) || realDistanceMm <= 0 || distance < 2)
    throw new Error(
      "Enter a positive measured distance and use distinct reference points.",
    );
  return distance / realDistanceMm;
}
export function fitScale(
  vw: number,
  vh: number,
  iw: number,
  ih: number,
  rotation: number,
): number {
  const a = (rotation * Math.PI) / 180;
  return Math.max(
    0.001,
    Math.min(
      (vw - 24) / (Math.abs(iw * Math.cos(a)) + Math.abs(ih * Math.sin(a))),
      (vh - 24) / (Math.abs(ih * Math.cos(a)) + Math.abs(iw * Math.sin(a))),
    ),
  );
}
export function defaultGuides(w: number, h: number): FacialGuides {
  const p = (x: number, y: number) => ({ x: w * x, y: h * y });
  return {
    facialMidline: [p(0.5, 0.15), p(0.5, 0.85)],
    dentalMidline: [p(0.5, 0.4), p(0.5, 0.72)],
    bipupillary: [p(0.2, 0.3), p(0.8, 0.3)],
    incisalPlane: [p(0.32, 0.65), p(0.68, 0.65)],
    smileArc: [p(0.28, 0.58), p(0.5, 0.74), p(0.72, 0.58)],
    gingivalCurve: [p(0.3, 0.48), p(0.5, 0.4), p(0.7, 0.48)],
    papillae: [0.275, 0.325, 0.37, 0.43, 0.5, 0.57, 0.63, 0.675, 0.725].map(
      (x) => p(x, 0.48),
    ),
    canineLines: [p(0.33, 0.4), p(0.33, 0.7), p(0.67, 0.4), p(0.67, 0.7)],
  };
}
