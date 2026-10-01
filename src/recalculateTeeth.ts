import {
  FDI,
  activeDesign,
  type Photo,
  type Point,
  type Tooth,
} from './domain';
import { getTemplate, templatePaths } from './basicFrame';
import type { BasicToolId, FramePath } from './basicFrameSchema';

const confirmed = (photo: Photo, id: BasicToolId) => {
  const t = getTemplate(photo, id);
  return t?.status === 'confirmed' ? t : undefined;
};
const dentalLine = (photo: Photo) => {
  const points = confirmed(photo, 'midline')
    ?.paths.find((p) => p.key === 'dental')
    ?.anchors.map((a) => a.point);
  return points?.[0] && points[1] && Math.abs(points[1].y - points[0].y) >= 1
    ? [points[0], points[1]]
    : undefined;
};
export function recalculationTools(photo: Photo): BasicToolId[] {
  return [
    ...(dentalLine(photo) ? ['midline' as const] : []),
    ...(
      ['interdental-proportion', 'central-incisor-proportion'] as const
    ).filter((id) => confirmed(photo, id)),
    ...(['smile-curve', 'gingival-curve'] as const).filter((id) =>
      confirmed(photo, id)?.paths[0]?.anchors.some((a) => a.point),
    ),
  ];
}
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const rotation = (degrees: number) => ((degrees + 540) % 360) - 180;
const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const innerEdge = (t: Tooth): Point => {
  const a = radians(t.rotation),
    halfWidth = (t.width / 2) * (t.fdi === 11 ? 1 : -1);
  return { x: t.x + halfWidth * Math.cos(a), y: t.y + halfWidth * Math.sin(a) };
};

// Intersect the same clamped cubic used by the displayed curve with a crown
// axis. A null landmark is never filled from its neighbours.
function curveLevel(
  path: FramePath | undefined,
  fdi: number,
  u: number,
  project: (p: Point) => Point,
) {
  const own = path?.anchors.find((a) => a.key === String(fdi))?.point;
  if (!path || !own) return undefined;
  const points = path.anchors.map((a) => a.point);
  for (let i = 0; i < points.length - 1; i++) {
    const b = points[i],
      c = points[i + 1];
    if (!b || !c) continue;
    const bx = project(b).x,
      cx = project(c).x;
    if (
      u < Math.min(bx, cx) ||
      u > Math.max(bx, cx) ||
      Math.abs(cx - bx) < 0.001
    )
      continue;
    const a = points[i - 1] ?? b,
      d = points[i + 2] ?? c;
    const clamp = (n: number, x: number, y: number) =>
      Math.max(Math.min(x, y), Math.min(Math.max(x, y), n));
    const p = {
      x: clamp(b.x + (c.x - a.x) / 6, b.x, c.x),
      y: clamp(b.y + (c.y - a.y) / 6, b.y, c.y),
    };
    const q = {
      x: clamp(c.x - (d.x - b.x) / 6, b.x, c.x),
      y: clamp(c.y - (d.y - b.y) / 6, b.y, c.y),
    };
    const sample = (t: number) => {
      const s = 1 - t;
      return project({
        x:
          s ** 3 * b.x +
          3 * s ** 2 * t * p.x +
          3 * s * t ** 2 * q.x +
          t ** 3 * c.x,
        y:
          s ** 3 * b.y +
          3 * s ** 2 * t * p.y +
          3 * s * t ** 2 * q.y +
          t ** 3 * c.y,
      });
    };
    let low = 0,
      high = 1;
    for (let j = 0; j < 32; j++) {
      const t = (low + high) / 2;
      if (sample(t).x < u === bx < cx) low = t;
      else high = t;
    }
    return sample((low + high) / 2).y;
  }
  // Outside the visible curve span, use only this tooth's recorded level.
  return project(own).y;
}

export function recalculateTeeth(photo: Photo): {
  teeth: Tooth[];
  skipped: number[];
} {
  const original = activeDesign(photo).teeth;
  if (!original.length || !recalculationTools(photo).length)
    return { teeth: original, skipped: [] };
  const ruler = confirmed(photo, 'interdental-proportion');
  const central = confirmed(photo, 'central-incisor-proportion');
  const incisal = confirmed(photo, 'smile-curve')?.paths.find(
    (p) => p.key === 'incisal',
  );
  const gingival = confirmed(photo, 'gingival-curve')?.paths[0];
  const line = dentalLine(photo);
  const centrals = original.filter((t) => t.fdi === 11 || t.fdi === 21);
  const placement = ruler?.placement ?? central?.placement;
  const origin =
    placement?.center ??
    (centrals.length === 2
      ? midpoint(innerEdge(centrals[0]), innerEdge(centrals[1]))
      : { x: photo.width / 2, y: photo.height / 2 });
  const baseRotation =
    placement?.rotation ??
    (centrals.length
      ? centrals.reduce((n, t) => n + t.rotation, 0) / centrals.length
      : 0);
  let angle = baseRotation,
    destination = origin;
  if (line) {
    const [a, b] = line[0].y <= line[1].y ? line : [line[1], line[0]];
    // A horizontal dental line cannot define a downward crown axis.
    if (Math.abs(b.y - a.y) >= 1) {
      angle = (Math.atan2(a.x - b.x, b.y - a.y) * 180) / Math.PI;
      destination = {
        x: a.x + ((origin.y - a.y) * (b.x - a.x)) / (b.y - a.y),
        y: origin.y,
      };
    }
  }
  const delta = radians(angle - baseRotation),
    a = radians(angle);
  const align = (p: Point): Point => ({
    x:
      destination.x +
      (p.x - origin.x) * Math.cos(delta) -
      (p.y - origin.y) * Math.sin(delta),
    y:
      destination.y +
      (p.x - origin.x) * Math.sin(delta) +
      (p.y - origin.y) * Math.cos(delta),
  });
  const project = (p: Point): Point => ({
    x:
      (p.x - destination.x) * Math.cos(a) + (p.y - destination.y) * Math.sin(a),
    y:
      -(p.x - destination.x) * Math.sin(a) +
      (p.y - destination.y) * Math.cos(a),
  });
  const unproject = (p: Point): Point => ({
    x: destination.x + p.x * Math.cos(a) - p.y * Math.sin(a),
    y: destination.y + p.x * Math.sin(a) + p.y * Math.cos(a),
  });
  const boundaries = ruler
    ? templatePaths(ruler).map((p) =>
        midpoint(p.anchors[0].point!, p.anchors[1].point!),
      )
    : [];
  const outlines = central ? templatePaths(central) : [];
  const skipped: number[] = [];
  const teeth = original.map((t) => {
    let next = { ...t };
    const index = FDI.indexOf(t.fdi as (typeof FDI)[number]);
    const outline = outlines.find((p) => p.key === String(t.fdi));
    const hasLayout = !!ruler || !!outline;
    if (ruler) {
      next.width = length(boundaries[index], boundaries[index + 1]);
      next.height *= next.width / t.width;
      Object.assign(
        next,
        align(midpoint(boundaries[index], boundaries[index + 1])),
      );
      next.rotation = angle;
    } else if (outline) {
      next.width = central!.placement!.centralWidth;
      Object.assign(
        next,
        align(midpoint(outline.anchors[0].point!, outline.anchors[2].point!)),
      );
      next.rotation = angle;
    } else if (line) {
      Object.assign(next, align(t));
      next.rotation = rotation(t.rotation + angle - baseRotation);
    }
    const targetHeight = outline
      ? next.width / central!.targets![0]
      : undefined;
    if (targetHeight) next.height = targetHeight;
    const tip = incisal?.anchors.find((q) => q.key === String(t.fdi))?.point;
    const top = gingival?.anchors.find((q) => q.key === String(t.fdi))?.point;
    if (tip || top) {
      const u = project(next).x;
      // Without a width layout or dental reference, keep the observed axis.
      if (!hasLayout && !line) {
        if (tip && top) {
          const r = radians(next.rotation);
          if (
            -(tip.x - top.x) * Math.sin(r) + (tip.y - top.y) * Math.cos(r) <
            1
          ) {
            skipped.push(t.fdi);
            return t;
          }
          next.rotation = rotation(
            (Math.atan2(top.x - tip.x, tip.y - top.y) * 180) / Math.PI,
          );
          next.height = length(top, tip);
        }
        const r = radians(next.rotation),
          edge = tip ?? top!;
        const sign = tip ? -1 : 1;
        next.x = edge.x - ((sign * next.height) / 2) * Math.sin(r);
        next.y = edge.y + ((sign * next.height) / 2) * Math.cos(r);
      } else {
        const bottom = curveLevel(incisal, t.fdi, u, project);
        const crownTop = curveLevel(gingival, t.fdi, u, project);
        if (
          bottom !== undefined &&
          crownTop !== undefined &&
          bottom - crownTop < 1
        ) {
          skipped.push(t.fdi);
          return t;
        }
        if (!targetHeight && bottom !== undefined && crownTop !== undefined)
          next.height = bottom - crownTop;
        const v =
          bottom !== undefined
            ? bottom - next.height / 2
            : crownTop! + next.height / 2;
        Object.assign(next, unproject({ x: u, y: v }));
        next.rotation = angle;
      }
    }
    if (
      ![next.x, next.y, next.width, next.height, next.rotation].every(
        Number.isFinite,
      ) ||
      next.width <= 0 ||
      next.height < 1 ||
      next.width > 100000 ||
      next.height > 100000
    ) {
      skipped.push(t.fdi);
      return t;
    }
    return next;
  });
  return { teeth, skipped };
}
