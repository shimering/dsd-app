import { it, expect } from 'vitest';
import { newPhoto, photoSchema, uid, type Photo } from '../../src/domain';
import {
  DSD_MEASUREMENTS,
  applicableDsd,
  dsdDefinition,
} from '../../src/dsdCatalog';
import {
  dsdMetrics,
  dsdProgress,
  saveDsdMeasurement,
  applyDsdSuggestion,
} from '../../src/dsd';
import { assessmentSchema, validateProposal } from '../../src/assistProtocol';

const photo = () => newPhoto('DSD', 'test', 1200, 800, 'image/png');
function measure(
  p: Photo,
  assessmentId: string,
  points: { x: number; y: number }[],
) {
  const def = dsdDefinition(assessmentId)!;
  return saveDsdMeasurement(p, {
    id: uid(),
    assessmentId,
    kind: def.kind,
    label: def.label,
    points,
  });
}
const value = (p: Photo, label: string) =>
  dsdMetrics(p).find((m) => m.label === label)!.value;
it('covers the DSD relationships and separates resting measurements from smile photos', () => {
  expect(DSD_MEASUREMENTS).toHaveLength(69);
  expect(new Set(DSD_MEASUREMENTS.map((m) => m.id)).size).toBe(69);
  expect(applicableDsd('rest').some((m) => m.id === 'rest-display-11')).toBe(
    true,
  );
  expect(applicableDsd('smile').some((m) => m.id === 'rest-display-11')).toBe(
    false,
  );
  expect(
    applicableDsd('retracted').some((m) => m.id === 'corridor-right'),
  ).toBe(false);
  for (const id of [
    'axis-11',
    'gingival-21',
    'papilla-11-21',
    'contact-12-11',
    'embrasure-22-23',
    'incisal-arc',
    'lateral-step-12',
  ])
    expect(dsdDefinition(id)).toBeTruthy();
});
it('calculates calibrated midline offset in the facial frame and survives whole-photo rotation', () => {
  let p = photo();
  p = measure(p, 'facial-horizontal', [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
  ]);
  p = measure(p, 'facial-midline', [
    { x: 500, y: 100 },
    { x: 500, y: 700 },
  ]);
  p = measure(p, 'dental-midline', [
    { x: 510, y: 400 },
    { x: 520, y: 500 },
  ]);
  p.calibration = {
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ],
    lengthMm: 10,
    confirmedAt: 'test',
  };
  expect(value(p, 'Facial / dental midline discrepancy')).toBe('1.00 mm');
  expect(
    value({ ...p, calibration: null }, 'Facial / dental midline discrepancy'),
  ).toBe('20.0 px');
  const rotate = ({ x, y }: { x: number; y: number }) => ({ x: 800 - y, y: x });
  const rotated = {
    ...p,
    width: 800,
    height: 1200,
    measurements: p.measurements.map((m) => ({
      ...m,
      points: m.points.map(rotate),
    })),
    calibration: { ...p.calibration, points: p.calibration.points.map(rotate) },
  };
  expect(value(rotated, 'Facial / dental midline discrepancy')).toBe('1.00 mm');
  const reversed = {
    ...p,
    measurements: p.measurements.map((m) => ({
      ...m,
      points: [...m.points].reverse(),
    })),
  };
  expect(value(reversed, 'Facial / dental midline discrepancy')).toBe(
    '1.00 mm',
  );
});
it('calculates cant relative to facial horizontal and avoids undefined references', () => {
  let p = measure(photo(), 'facial-horizontal', [
    { x: 100, y: 100 },
    { x: 500, y: 100 },
  ]);
  p = measure(p, 'incisal-plane', [
    { x: 400, y: 400 },
    { x: 500, y: 500 },
  ]);
  expect(value(p, 'Incisal cant')).toBe('45.0°');
  expect(value(p, 'Central incisal height difference')).toBe('100.0 px');
  p = measure(p, 'facial-horizontal', [
    { x: 100, y: 100 },
    { x: 100, y: 100 },
  ]);
  expect(value(p, 'Incisal cant')).toBe('Awaiting measurements');
});
it('calculates scale-independent proportions, apparent widths, and corridor ratios', () => {
  let p = measure(photo(), 'width-11', [
    { x: 100, y: 400 },
    { x: 180, y: 400 },
  ]);
  p = measure(p, 'height-11', [
    { x: 140, y: 350 },
    { x: 140, y: 450 },
  ]);
  p = measure(p, 'width-12', [
    { x: 40, y: 400 },
    { x: 100, y: 400 },
  ]);
  p = measure(p, 'smile-width', [
    { x: 300, y: 450 },
    { x: 900, y: 450 },
  ]);
  p = measure(p, 'corridor-right', [
    { x: 300, y: 450 },
    { x: 360, y: 450 },
  ]);
  p = measure(p, 'corridor-left', [
    { x: 840, y: 450 },
    { x: 900, y: 450 },
  ]);
  expect(value(p, '11 width / height')).toBe('80.0%');
  expect(value(p, '12 / 11 apparent width ratio')).toBe('75.0%');
  expect(value(p, 'Total buccal corridor / smile width')).toBe('20.0%');
  expect(value(p, 'Buccal corridor asymmetry')).toBe('0.0 px');
});
it('replaces a redrawn item without duplicates and removes its unavailable status', () => {
  const p = {
    ...photo(),
    dsd: {
      view: 'smile' as const,
      unavailable: [{ assessmentId: 'width-11', reason: 'Cropped' }],
    },
  };
  const q = measure(p, 'width-11', [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ]);
  const r = measure(q, 'width-11', [
    { x: 100, y: 100 },
    { x: 180, y: 100 },
  ]);
  expect(r.measurements).toHaveLength(1);
  expect(r.dsd!.unavailable).toHaveLength(0);
  expect(dsdProgress(r).measured).toBe(1);
  expect(photoSchema.parse(JSON.parse(JSON.stringify(r)))).toEqual(r);
  expect(photoSchema.safeParse(photo()).success).toBe(true);
});
it('rejects unknown, duplicated, out-of-range, degenerate, and wrong-count AI geometry', () => {
  const m = {
    assessmentId: 'width-11',
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ],
  };
  for (const bad of [
    { measurements: [{ ...m, assessmentId: 'diagnosis' }], unavailable: [] },
    { measurements: [m, m], unavailable: [] },
    {
      measurements: [m],
      unavailable: [{ assessmentId: m.assessmentId, reason: 'Hidden' }],
    },
    {
      measurements: [{ ...m, points: [{ x: 1001, y: 100 }, m.points[1]] }],
      unavailable: [],
    },
    {
      measurements: [{ ...m, points: [m.points[0], m.points[0]] }],
      unavailable: [],
    },
    {
      measurements: [{ ...m, points: [...m.points, { x: 300, y: 100 }] }],
      unavailable: [],
    },
    { measurements: [{ ...m, assessmentId: 'incisal-arc' }], unavailable: [] },
    { measurements: [m], unavailable: [], scaleMm: 10 },
  ])
    expect(assessmentSchema.safeParse(bad).success).toBe(false);
});
it('applies only selected suggestions, preserves clinician measurements, and retains reasons', () => {
  const p = measure(photo(), 'width-11', [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ]);
  const suggestions = {
    measurements: ['width-11', 'height-11', 'width-21'].map((assessmentId) => ({
      assessmentId,
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 300 },
      ],
    })),
    unavailable: [
      { assessmentId: 'facial-horizontal', reason: 'Eyes are cropped.' },
    ],
  };
  const q = applyDsdSuggestion(p, suggestions, ['width-11', 'height-11']);
  expect(q.measurements).toHaveLength(2);
  expect(q.measurements[0]).toEqual(p.measurements[0]);
  expect(q.measurements[1].kind).toBe('distance');
  expect(q.measurements[1].points).toEqual([
    { x: 120, y: 80 },
    { x: 120, y: 240 },
  ]);
  expect(q.dsd!.unavailable[0].reason).toBe('Eyes are cropped.');
  expect(photoSchema.safeParse(q).success).toBe(true);
});
it('accepts a visible zero zenith offset without accepting a degenerate crown dimension', () => {
  const points = [
    { x: 100, y: 100 },
    { x: 100, y: 100 },
  ];
  expect(
    assessmentSchema.safeParse({
      measurements: [{ assessmentId: 'zenith-11', points }],
      unavailable: [],
    }).success,
  ).toBe(true);
  expect(
    assessmentSchema.safeParse({
      measurements: [{ assessmentId: 'width-11', points }],
      unavailable: [],
    }).success,
  ).toBe(false);
});
it('rejects incompatible named measurement records and stale DSD proposals', () => {
  const p = measure(photo(), 'width-11', [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ]);
  expect(
    photoSchema.safeParse({
      ...p,
      measurements: [...p.measurements, p.measurements[0]],
    }).success,
  ).toBe(false);
  expect(
    photoSchema.safeParse({
      ...p,
      measurements: [{ ...p.measurements[0], kind: 'guide' }],
    }).success,
  ).toBe(false);
  const source = { workspaceId: uid(), photoId: p.id, sourceRevision: 1 };
  const proposal = {
    id: uid(),
    source,
    model: 'gemini-3.8-flash',
    createdAt: 'test',
    operation: 'assessment',
    result: { measurements: [], unavailable: [] },
  };
  expect(() =>
    validateProposal(proposal, { ...source, sourceRevision: 2 }),
  ).toThrow(/outdated/);
});
