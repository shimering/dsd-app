import { type Measurement, type Photo, type Point, uid } from './domain.ts';
import { ANTERIOR, applicableDsd, dsdDefinition } from './dsdCatalog.ts';
import { distance, pixelsPerMm } from './geometry.ts';

export const dsdState = (photo: Photo) =>
  photo.dsd ?? {
    view: 'smile' as const,
    unavailable: [],
    smileArc: 'unassessed' as const,
  };
export const dsdMeasurement = (photo: Photo, id: string) =>
  photo.measurements.find((m) => m.assessmentId === id);
export function saveDsdMeasurement(
  photo: Photo,
  measurement: Measurement,
): Photo {
  return {
    ...photo,
    measurements: [
      ...photo.measurements.filter(
        (m) =>
          !measurement.assessmentId ||
          m.assessmentId !== measurement.assessmentId,
      ),
      measurement,
    ],
    ...(measurement.assessmentId
      ? {
          dsd: {
            ...dsdState(photo),
            unavailable: dsdState(photo).unavailable.filter(
              (m) => m.assessmentId !== measurement.assessmentId,
            ),
          },
        }
      : {}),
  };
}
export function dsdProgress(photo: Photo) {
  const items = applicableDsd(dsdState(photo).view);
  const measured = items.filter((m) => dsdMeasurement(photo, m.id)).length;
  const unavailable = items.filter(
    (m) =>
      !dsdMeasurement(photo, m.id) &&
      dsdState(photo).unavailable.some((u) => u.assessmentId === m.id),
  ).length;
  return {
    total: items.length,
    measured,
    unavailable,
    remaining: items.length - measured - unavailable,
  };
}
const length = (m?: Measurement) =>
  m
    ? m.points.slice(1).reduce((n, p, i) => n + distance(m.points[i], p), 0)
    : null;
const vector = (m: Measurement) => ({
  x: m.points[1].x - m.points[0].x,
  y: m.points[1].y - m.points[0].y,
});
// Lines are unoriented: reversing endpoints must not change the assessment.
function relativeAngle(a: Measurement, b: Measurement) {
  const u = vector(a),
    v = vector(b);
  if (Math.hypot(u.x, u.y) < 1 || Math.hypot(v.x, v.y) < 1) return null;
  return (
    (Math.acos(
      Math.min(
        1,
        Math.abs(u.x * v.x + u.y * v.y) /
          (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)),
      ),
    ) *
      180) /
    Math.PI
  );
}
export type DsdMetric = { label: string; value: string; needs: string };
export function dsdMetrics(photo: Photo): DsdMetric[] {
  const get = (id: string) => dsdMeasurement(photo, id);
  const ppm = pixelsPerMm(photo);
  const fmt = (px: number) =>
    (ppm ? px / ppm : px).toFixed(ppm ? 2 : 1) + (ppm ? ' mm' : ' px');
  const metrics: DsdMetric[] = [];
  const add = (label: string, value: string | null, needs: string) =>
    metrics.push({ label, value: value ?? 'Awaiting measurements', needs });
  const horizontal = get('facial-horizontal'),
    facial = get('facial-midline'),
    dental = get('dental-midline'),
    incisal = get('incisal-plane'),
    canine = get('canine-plane');
  let offset: number | null = null;
  if (horizontal && facial && dental) {
    const h = vector(horizontal),
      f = vector(facial),
      a = facial.points[0];
    const normal = h.x >= 0 ? { x: -h.y, y: h.x } : { x: h.y, y: -h.x };
    const p = dental.points.reduce((a, b) =>
      a.x * normal.x + a.y * normal.y > b.x * normal.x + b.y * normal.y ? a : b,
    );
    const cross = h.x * f.y - h.y * f.x;
    if (
      Math.abs(cross) > 0.001 &&
      Math.hypot(h.x, h.y) >= 1 &&
      Math.hypot(f.x, f.y) >= 1
    )
      offset =
        Math.abs(((p.x - a.x) * f.y - (p.y - a.y) * f.x) / cross) *
        Math.hypot(h.x, h.y);
  }
  add(
    'Facial / dental midline discrepancy',
    offset === null ? null : fmt(offset),
    'Facial horizontal, facial midline, upper dental midline; evaluated at the incisal embrasure.',
  );
  for (const [label, a, b, needs] of [
    [
      'Dental midline inclination',
      dental,
      facial,
      'Upper dental and facial midlines.',
    ],
    [
      'Incisal cant',
      incisal,
      horizontal,
      'Central incisal plane and facial horizontal.',
    ],
    [
      'Anterior plane cant',
      canine,
      horizontal,
      'Canine plane and facial horizontal.',
    ],
  ] as const) {
    const angle = a && b ? relativeAngle(a, b) : null;
    add(label, angle == null ? null : angle.toFixed(1) + '°', needs);
  }
  for (const fdi of ANTERIOR) {
    const w = length(get(`width-${fdi}`)),
      h = length(get(`height-${fdi}`));
    add(
      `${fdi} width / height`,
      w !== null && h !== null && h >= 1
        ? ((w / h) * 100).toFixed(1) + '%'
        : null,
      `${fdi} crown width and height.`,
    );
    const axis = get(`axis-${fdi}`);
    const angle = axis && facial ? relativeAngle(axis, facial) : null;
    add(
      `${fdi} crown-axis inclination`,
      angle == null ? null : angle.toFixed(1) + '°',
      `${fdi} crown axis and facial midline; visible crown only.`,
    );
  }
  for (const [a, b] of [
    [13, 23],
    [12, 22],
    [11, 21],
  ]) {
    for (const [prefix, label] of [
      ['width', 'width difference'],
      ['height', 'height difference'],
      ['gingival', 'gingival-level difference'],
    ]) {
      const x =
          prefix === 'gingival' && !get('gingival-reference')
            ? null
            : length(get(`${prefix}-${a}`)),
        y = length(get(`${prefix}-${b}`));
      add(
        `${a} / ${b} ${label}`,
        x !== null && y !== null ? fmt(Math.abs(x - y)) : null,
        `Both ${prefix} measurements${prefix === 'gingival' ? ' from the same gingival reference' : ''}.`,
      );
    }
  }
  const rightStep = length(get('lateral-step-12')),
    leftStep = length(get('lateral-step-22'));
  add(
    'Lateral incisal-step asymmetry',
    rightStep !== null && leftStep !== null
      ? fmt(Math.abs(rightStep - leftStep))
      : null,
    'Both central-to-lateral incisal steps from the same incisal plane.',
  );
  for (const [a, b] of [
    [12, 11],
    [22, 21],
    [13, 12],
    [23, 22],
  ]) {
    const x = length(get(`width-${a}`)),
      y = length(get(`width-${b}`));
    add(
      `${a} / ${b} apparent width ratio`,
      x !== null && y !== null && y >= 1
        ? ((x / y) * 100).toFixed(1) + '%'
        : null,
      'Apparent frontal widths; compare within the individual case.',
    );
  }
  const width = length(get('smile-width')),
    gap = length(get('interlabial-gap')),
    r = length(get('corridor-right')),
    l = length(get('corridor-left'));
  add(
    'Interlabial gap / smile width',
    gap !== null && width !== null && width >= 1
      ? ((gap / width) * 100).toFixed(1) + '%'
      : null,
    'Interlabial gap and smile width.',
  );
  add(
    'Total buccal corridor / smile width',
    r !== null && l !== null && width !== null && width >= 1
      ? (((r + l) / width) * 100).toFixed(1) + '%'
      : null,
    'Both buccal corridors and smile width.',
  );
  add(
    'Buccal corridor asymmetry',
    r !== null && l !== null ? fmt(Math.abs(r - l)) : null,
    'Both buccal corridors.',
  );
  if (incisal && horizontal) {
    const h = vector(horizontal),
      p = vector(incisal),
      len = Math.hypot(h.x, h.y);
    add(
      'Central incisal height difference',
      len >= 1 ? fmt(Math.abs(h.x * p.y - h.y * p.x) / len) : null,
      'Central incisal plane and facial horizontal.',
    );
  }
  return metrics;
}
export type DsdSuggestion = {
  measurements: { assessmentId: string; points: Point[] }[];
  unavailable: { assessmentId: string; reason: string }[];
};
export function applyDsdSuggestion(
  photo: Photo,
  result: DsdSuggestion,
  selected: string[],
): Photo {
  let next = photo;
  for (const m of result.measurements.filter((m) =>
    selected.includes(m.assessmentId),
  )) {
    // Existing clinician measurements always win over a suggestion.
    if (dsdMeasurement(next, m.assessmentId)) continue;
    const def = dsdDefinition(m.assessmentId);
    if (!def) throw new Error('Unknown DSD measurement.');
    next = saveDsdMeasurement(next, {
      id: uid(),
      assessmentId: def.id,
      label: def.label,
      kind: def.kind,
      points: m.points.map((p) => ({
        x: (p.x * photo.width) / 1000,
        y: (p.y * photo.height) / 1000,
      })),
    });
  }
  const state = dsdState(next);
  return {
    ...next,
    dsd: {
      ...state,
      unavailable: [
        ...state.unavailable.filter(
          (u) =>
            !result.unavailable.some((v) => v.assessmentId === u.assessmentId),
        ),
        ...result.unavailable.filter(
          (u) => !dsdMeasurement(next, u.assessmentId),
        ),
      ],
    },
  };
}
