import type { Point, Photo, Lip, Measurement, Tooth } from './domain.ts';
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export type View = {
  width: number;
  height: number;
  photoWidth: number;
  photoHeight: number;
  scale: number;
  rotation: number;
  pan: Point;
};
export function fitScale(
  width: number,
  height: number,
  pw: number,
  ph: number,
  rotation: number,
) {
  const a = (rotation * Math.PI) / 180;
  return Math.max(
    0.001,
    Math.min(
      (width - 32) / (Math.abs(pw * Math.cos(a)) + Math.abs(ph * Math.sin(a))),
      (height - 32) / (Math.abs(ph * Math.cos(a)) + Math.abs(pw * Math.sin(a))),
    ),
  );
}
export function toScreen(p: Point, v: View): Point {
  const a = (v.rotation * Math.PI) / 180,
    x = p.x - v.photoWidth / 2,
    y = p.y - v.photoHeight / 2;
  return {
    x: v.width / 2 + v.pan.x + (x * Math.cos(a) - y * Math.sin(a)) * v.scale,
    y: v.height / 2 + v.pan.y + (x * Math.sin(a) + y * Math.cos(a)) * v.scale,
  };
}
export function toImage(p: Point, v: View): Point {
  const a = (-v.rotation * Math.PI) / 180,
    x = (p.x - v.width / 2 - v.pan.x) / v.scale,
    y = (p.y - v.height / 2 - v.pan.y) / v.scale;
  return {
    x: v.photoWidth / 2 + x * Math.cos(a) - y * Math.sin(a),
    y: v.photoHeight / 2 + x * Math.sin(a) + y * Math.cos(a),
  };
}
export function pixelsPerMm(photo: Photo) {
  if (!photo.calibration) return null;
  const px = distance(photo.calibration.points[0], photo.calibration.points[1]);
  return px >= 2 ? px / photo.calibration.lengthMm : null;
}
export function measurementValue(
  measurement: Measurement,
  photo: Photo,
): string {
  if (measurement.kind === 'guide' || measurement.kind === 'ink')
    return measurement.kind === 'guide' ? 'Reference line' : 'Annotation';
  const points = measurement.points;
  if (measurement.kind === 'angle') {
    if (points.length !== 3) return '—';
    const [a, b, c] = points,
      u = { x: a.x - b.x, y: a.y - b.y },
      v = { x: c.x - b.x, y: c.y - b.y },
      len = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    return len < 0.001
      ? 'Undefined angle'
      : (
          (Math.acos(clamp((u.x * v.x + u.y * v.y) / len, -1, 1)) * 180) /
          Math.PI
        ).toFixed(1) + '°';
  }
  const px = points
      .slice(1)
      .reduce((sum, p, i) => sum + distance(points[i], p), 0),
    ppm = pixelsPerMm(photo);
  return (ppm ? px / ppm : px).toFixed(ppm ? 2 : 1) + (ppm ? ' mm' : ' px');
}
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  const on = (p: Point, q: Point, r: Point) =>
    Math.abs(cross(p, q, r)) < 1e-6 &&
    r.x >= Math.min(p.x, q.x) - 1e-6 &&
    r.x <= Math.max(p.x, q.x) + 1e-6 &&
    r.y >= Math.min(p.y, q.y) - 1e-6 &&
    r.y <= Math.max(p.y, q.y) + 1e-6;
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    on(a, b, c) ||
    on(a, b, d) ||
    on(c, d, a) ||
    on(c, d, b)
  );
}
export function lipProblem(lip: Lip): string | null {
  const p = lip.points;
  if (p.length < 3) return 'Add at least three points around the lip opening.';
  if (p.some((a, i) => distance(a, p[(i + 1) % p.length]) < 1))
    return 'Separate overlapping outline points.';
  const area =
    Math.abs(
      p.reduce(
        (s, a, i) =>
          s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y,
        0,
      ),
    ) / 2;
  if (area < 4) return 'Trace an opening with a visible area.';
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      if (intersects(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length]))
        return 'The outline crosses itself. Move or remove a point.';
    }
  return null;
}
export function lipPath(lip: Lip): string {
  const p = lip.points,
    n = p.length;
  if (!n) return '';
  let path = 'M ' + p[0].x + ' ' + p[0].y;
  if (n < 3 || lip.smoothing === 0 || !lip.closed) {
    path += p
      .slice(1)
      .map((q) => ' L ' + q.x + ' ' + q.y)
      .join('');
  } else {
    for (let i = 0; i < n; i++) {
      const a = p[(i + n - 1) % n],
        b = p[i],
        c = p[(i + 1) % n],
        d = p[(i + 2) % n],
        t = lip.smoothing / 6;
      // Clamp control points to the segment bounds to prevent smoothing overshoot.
      const x1 = clamp(
          b.x + (c.x - a.x) * t,
          Math.min(b.x, c.x),
          Math.max(b.x, c.x),
        ),
        y1 = clamp(
          b.y + (c.y - a.y) * t,
          Math.min(b.y, c.y),
          Math.max(b.y, c.y),
        );
      const x2 = clamp(
          c.x - (d.x - b.x) * t,
          Math.min(b.x, c.x),
          Math.max(b.x, c.x),
        ),
        y2 = clamp(
          c.y - (d.y - b.y) * t,
          Math.min(b.y, c.y),
          Math.max(b.y, c.y),
        );
      path +=
        ' C ' + x1 + ' ' + y1 + ' ' + x2 + ' ' + y2 + ' ' + c.x + ' ' + c.y;
    }
  }
  return path + (lip.closed ? ' Z' : '');
}
export function toothCorners(t: Tooth): Point[] {
  const a = (t.rotation * Math.PI) / 180,
    w = t.width / 2,
    h = t.height / 2;
  return [
    [-w * (1 - t.perspective), -h],
    [w * (1 - t.perspective), -h],
    [w * (1 + t.perspective), h],
    [-w * (1 + t.perspective), h],
  ].map(([x, y]) => ({
    x: t.x + x * Math.cos(a) - y * Math.sin(a),
    y: t.y + x * Math.sin(a) + y * Math.cos(a),
  }));
}
export function pointInPolygon(point: Point, p: Point[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (
      p[i].y > point.y !== p[j].y > point.y &&
      point.x <
        ((p[j].x - p[i].x) * (point.y - p[i].y)) / (p[j].y - p[i].y) + p[i].x
    )
      inside = !inside;
  return inside;
}
