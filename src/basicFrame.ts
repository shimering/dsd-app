import { seededTeeth, type Photo, type Point } from './domain.ts';
import { dsdState, dsdMeasurement, dsdMetrics } from './dsd.ts';
import {
  BASIC_TOOLS,
  PATH_KEYS,
  basicTemplateSchema,
  type BasicToolId,
  type BasicTemplate,
  type FramePath,
  type BasicFrameSuggestion,
} from './basicFrameSchema.ts';

export const DEFAULT_TARGETS = [0.8, 0.74 / 0.8, 0.62 / 0.74, 0.55 / 0.62];
export const getTemplate = (photo: Photo, id: BasicToolId) =>
  photo.dsd?.basicFrame?.templates.find((t) => t.id === id);
export function setTemplate(photo: Photo, template: BasicTemplate): Photo {
  return {
    ...photo,
    dsd: {
      ...dsdState(photo),
      basicFrame: {
        templates: [
          ...(photo.dsd?.basicFrame?.templates ?? []).filter(
            (t) => t.id !== template.id,
          ),
          basicTemplateSchema.parse(template),
        ],
      },
    },
  };
}
export function seedTemplate(photo: Photo, id: BasicToolId): BasicTemplate {
  const teeth = seededTeeth(photo),
    central = teeth.find((t) => t.fdi === 11)!;
  const byTooth = (key: string) => teeth.find((t) => String(t.fdi) === key)!;
  const path = (key: string, points: Point[]): FramePath => ({
    key,
    anchors: PATH_KEYS[id][key].map((key, i) => ({ key, point: points[i] })),
  });
  const legacy = (name: string, fallback: Point[]) => {
    const points = dsdMeasurement(photo, name)?.points;
    return points &&
      Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) >= 1
      ? points
      : fallback;
  };
  let paths: FramePath[] = [];
  if (id === 'midline')
    paths = [
      path(
        'horizontal',
        legacy('facial-horizontal', [
          { x: photo.width * 0.3, y: photo.height * 0.3 },
          { x: photo.width * 0.7, y: photo.height * 0.3 },
        ]),
      ),
      path(
        'facial',
        legacy('facial-midline', [
          { x: photo.width / 2, y: photo.height * 0.2 },
          { x: photo.width / 2, y: photo.height * 0.8 },
        ]),
      ),
      path(
        'dental',
        legacy('dental-midline', [
          { x: photo.width / 2, y: central.y - central.height / 2 },
          { x: photo.width / 2, y: central.y + central.height / 2 },
        ]),
      ),
    ];
  if (id === 'smile-curve') {
    const resample = (name: string, fallback: Point[]) => {
      const old = dsdMeasurement(photo, name)?.points;
      return old
        ? fallback.map((_, i) => {
            const index = (i * (old.length - 1)) / (fallback.length - 1),
              a = old[Math.floor(index)],
              b = old[Math.ceil(index)],
              f = index % 1;
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
          })
        : fallback;
    };
    paths = [
      path(
        'incisal',
        resample(
          'incisal-arc',
          PATH_KEYS[id].incisal.map((key) => {
            const t = byTooth(key);
            return { x: t.x, y: t.y + t.height / 2 };
          }),
        ),
      ),
      path(
        'lower-lip',
        resample(
          'lower-lip-arc',
          [0, 0.25, 0.5, 0.75, 1].map((f) => ({
            x: photo.width * (0.27 + 0.46 * f),
            y: photo.height * (0.62 + 0.05 * Math.sin(f * Math.PI)),
          })),
        ),
      ),
    ];
  }
  if (id === 'gingival-curve')
    paths = [
      path(
        'gingival',
        PATH_KEYS[id].gingival.map((key) => {
          const t = byTooth(key),
            old =
              dsdMeasurement(photo, `gingival-${key}`)?.points[1] ??
              dsdMeasurement(photo, `height-${key}`)?.points[0];
          return old ?? { x: t.x, y: t.y - t.height / 2 };
        }),
      ),
    ];
  if (id === 'papilla-curve')
    paths = [
      path(
        'papilla',
        PATH_KEYS[id].papilla.map((key) => {
          const [a, b] = key.split('-').map((k) => byTooth(k));
          return (
            dsdMeasurement(photo, `papilla-${key}`)?.points[0] ?? {
              x: (a.x + b.x) / 2,
              y:
                Math.min(a.y - a.height / 2, b.y - b.height / 2) +
                central.height * 0.15,
            }
          );
        }),
      ),
    ];
  return {
    id,
    status: 'draft',
    paths,
    ...(id.endsWith('proportion')
      ? {
          placement: {
            center: { x: photo.width / 2, y: central.y },
            centralWidth: central.width,
            rotation: 0,
          },
          targets:
            id === 'interdental-proportion' ? [...DEFAULT_TARGETS] : [0.82],
        }
      : {}),
  };
}
export function templatePaths(t: BasicTemplate): FramePath[] {
  if (!t.placement) return t.paths;
  const { center, centralWidth: w, rotation } = t.placement,
    a = (rotation * Math.PI) / 180;
  const point = (x: number, y: number) => ({
    x: center.x + x * Math.cos(a) - y * Math.sin(a),
    y: center.y + x * Math.sin(a) + y * Math.cos(a),
  });
  const make = (key: string, coords: number[][]): FramePath => ({
    key,
    anchors: coords.map(([x, y], i) => ({
      key: String(i),
      point: point(x, y),
    })),
  });
  if (t.id === 'central-incisor-proportion') {
    const h = w / t.targets![0];
    return [-1, 0].map((side, i) =>
      make(i === 0 ? '11' : '21', [
        [side * w, -h / 2],
        [(side + 1) * w, -h / 2],
        [(side + 1) * w, h / 2],
        [side * w, h / 2],
        [side * w, -h / 2],
      ]),
    );
  }
  const [l, c, p1, p2] = t.targets!,
    factors = [
      l * c * p1 * p2,
      l * c * p1,
      l * c,
      l,
      1,
      1,
      l,
      l * c,
      l * c * p1,
      l * c * p1 * p2,
    ];
  let x = (-factors.reduce((n, f) => n + f, 0) * w) / 2;
  return [...factors, 0].map((f, i) => {
    const path = make(`boundary-${i}`, [
      [x, -w * 0.65],
      [x, w * 0.65],
    ]);
    x += f * w;
    return path;
  });
}
export function templateBounds(t: BasicTemplate) {
  const pts = templatePaths(t).flatMap((p) =>
    p.anchors.flatMap((a) => (a.point ? [a.point] : [])),
  );
  if (!pts.length) return null;
  const minX = Math.min(...pts.map((p) => p.x)),
    maxX = Math.max(...pts.map((p) => p.x)),
    minY = Math.min(...pts.map((p) => p.y)),
    maxY = Math.max(...pts.map((p) => p.y));
  return {
    minX,
    maxX,
    minY,
    maxY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}
export function transformTemplate(
  t: BasicTemplate,
  origin: Point,
  destination: Point,
  scale = 1,
  degrees = 0,
): BasicTemplate {
  const a = (degrees * Math.PI) / 180,
    transform = (p: Point) => ({
      x:
        destination.x +
        scale *
          ((p.x - origin.x) * Math.cos(a) - (p.y - origin.y) * Math.sin(a)),
      y:
        destination.y +
        scale *
          ((p.x - origin.x) * Math.sin(a) + (p.y - origin.y) * Math.cos(a)),
    });
  return {
    ...t,
    status: 'draft',
    paths: t.paths.map((p) => ({
      ...p,
      anchors: p.anchors.map((q) => ({
        ...q,
        point: q.point ? transform(q.point) : null,
      })),
    })),
    ...(t.placement
      ? {
          placement: {
            ...t.placement,
            center: transform(t.placement.center),
            centralWidth: t.placement.centralWidth * scale,
            rotation: ((t.placement.rotation + degrees + 540) % 360) - 180,
          },
        }
      : {}),
  };
}
export function templateFits(photo: Photo, t: BasicTemplate) {
  const b = templateBounds(t);
  return (
    basicTemplateSchema.safeParse(t).success &&
    (!b ||
      (b.minX >= 0 &&
        b.minY >= 0 &&
        b.maxX <= photo.width &&
        b.maxY <= photo.height))
  );
}
export function moveAnchor(
  photo: Photo,
  id: BasicToolId,
  path: string,
  key: string,
  point: Point,
): Photo {
  const t = getTemplate(photo, id);
  if (!t) return photo;
  const next = {
    ...t,
    status: 'draft' as const,
    paths: t.paths.map((p) =>
      p.key === path
        ? {
            ...p,
            anchors: p.anchors.map((a) => (a.key === key ? { key, point } : a)),
          }
        : p,
    ),
  };
  return templateFits(photo, next) ? setTemplate(photo, next) : photo;
}
// Smooth open curves; missing landmarks break the path rather than imply unseen anatomy.
export function curvePath(path: FramePath): string {
  const runs: Point[][] = [[]];
  for (const a of path.anchors) {
    if (a.point) runs[runs.length - 1].push(a.point);
    else if (runs[runs.length - 1].length) runs.push([]);
  }
  return runs
    .filter((r) => r.length)
    .map((r) => {
      let d = `M ${r[0].x} ${r[0].y}`;
      for (let i = 0; i < r.length - 1; i++) {
        const a = r[Math.max(0, i - 1)],
          b = r[i],
          c = r[i + 1],
          e = r[Math.min(r.length - 1, i + 2)];
        const clamp = (v: number, x: number, y: number) =>
          Math.max(Math.min(x, y), Math.min(Math.max(x, y), v));
        d += ` C ${clamp(b.x + (c.x - a.x) / 6, b.x, c.x)} ${clamp(b.y + (c.y - a.y) / 6, b.y, c.y)} ${clamp(c.x - (e.x - b.x) / 6, b.x, c.x)} ${clamp(c.y - (e.y - b.y) / 6, b.y, c.y)} ${c.x} ${c.y}`;
      }
      return d;
    })
    .join(' ');
}
export function midlineResults(photo: Photo) {
  const t = getTemplate(photo, 'midline');
  if (!t || t.status !== 'confirmed') return [];
  const ids: Record<string, string> = {
    horizontal: 'facial-horizontal',
    facial: 'facial-midline',
    dental: 'dental-midline',
  };
  const measurements = t.paths
    .filter((p) => p.anchors.every((a) => a.point))
    .map((p) => ({
      id: p.key,
      assessmentId: ids[p.key],
      label: p.key,
      kind: 'guide' as const,
      points: p.anchors.map((a) => a.point!),
    }));
  return dsdMetrics({ ...photo, measurements }).filter(
    (m) =>
      [
        'Facial / dental midline discrepancy',
        'Dental midline inclination',
      ].includes(m.label) && m.value !== 'Awaiting measurements',
  );
}
export function applyBasicSuggestion(
  photo: Photo,
  suggestion: BasicFrameSuggestion,
  selected: string[],
) {
  let next = photo;
  for (const entry of suggestion.templates) {
    if (
      !selected.includes(entry.id) ||
      getTemplate(photo, entry.id)?.status === 'confirmed'
    )
      continue;
    const base = getTemplate(photo, entry.id) ?? seedTemplate(photo, entry.id),
      point = (p: Point) => ({
        x: (p.x * photo.width) / 1000,
        y: (p.y * photo.height) / 1000,
      });
    const t: BasicTemplate = {
      ...base,
      paths: entry.paths.map((p) => ({
        ...p,
        anchors: p.anchors.map((a) => ({
          ...a,
          point: a.point ? point(a.point) : null,
        })),
      })),
      ...(entry.placement
        ? {
            placement: {
              ...entry.placement,
              center: point(entry.placement.center),
              centralWidth: (entry.placement.centralWidth * photo.width) / 1000,
            },
          }
        : {}),
      status: 'draft',
    };
    if (!templateFits(photo, t))
      throw new Error(
        'The suggested guide extends beyond the photo. Adjust it manually.',
      );
    next = setTemplate(next, t);
  }
  for (const entry of suggestion.unavailable) {
    if (
      selected.includes(entry.id) &&
      getTemplate(photo, entry.id)?.status !== 'confirmed'
    )
      next = setTemplate(next, {
        ...(getTemplate(photo, entry.id) ?? seedTemplate(photo, entry.id)),
        status: 'unavailable',
        reason: entry.reason,
      });
  }
  return next;
}
export const toolLabel = (id: BasicToolId) =>
  BASIC_TOOLS.find((t) => t.id === id)!.label;
