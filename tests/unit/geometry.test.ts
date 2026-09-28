import { describe, it, expect } from 'vitest';
import {
  fitScale,
  toImage,
  toScreen,
  measurementValue,
  lipProblem,
  lipPath,
} from '../../src/geometry';
import { newPhoto, seededTeeth, FDI } from '../../src/domain';
import { crownColumn } from '../../src/assets';
import { History } from '../../src/history';
import { validateProposal, alignmentSchema } from '../../src/assistProtocol';

describe('original-image geometry', () => {
  const photo = newPhoto('Test', 'test', 2400, 1600, 'image/png');
  photo.calibration = {
    points: [
      { x: 500, y: 300 },
      { x: 900, y: 300 },
    ],
    lengthMm: 20,
    confirmedAt: '2026-09-28',
  };
  const m = {
    id: 'm',
    kind: 'polyline' as const,
    label: 'Length',
    points: [
      { x: 700, y: 500 },
      { x: 900, y: 500 },
      { x: 900, y: 800 },
    ],
  };
  it('retains the same calibrated length after viewport transforms and reopening', () => {
    expect(measurementValue(m, photo)).toBe('25.00 mm');
    for (const rotation of [0, 33, 90, 180, -90])
      for (const [width, height, zoom] of [
        [1200, 700, 1],
        [1024, 600, 5],
        [390, 400, 0.6],
      ]) {
        const v = {
          width,
          height,
          photoWidth: 2400,
          photoHeight: 1600,
          rotation,
          scale: fitScale(width, height, 2400, 1600, rotation) * zoom,
          pan: { x: -104, y: 99 },
        };
        m.points.forEach((point) => {
          const restored = toImage(toScreen(point, v), v);
          expect(restored.x).toBeCloseTo(point.x, 8);
          expect(restored.y).toBeCloseTo(point.y, 8);
        });
      }
    expect(measurementValue(m, JSON.parse(JSON.stringify(photo)))).toBe(
      '25.00 mm',
    );
    expect(measurementValue(m, { ...photo, calibration: null })).toBe(
      '500.0 px',
    );
  });
  it('calculates angles locally without needing a scale', () => {
    expect(
      measurementValue(
        {
          id: 'a',
          kind: 'angle',
          label: 'Angle',
          points: [
            { x: 0, y: 10 },
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        },
        photo,
      ),
    ).toBe('90.0°');
  });
  it('rejects intersecting, degenerate, and incomplete lip masks', () => {
    const lip = {
      points: [
        { x: 10, y: 10 },
        { x: 110, y: 10 },
        { x: 110, y: 90 },
        { x: 10, y: 90 },
      ],
      closed: true,
      smoothing: 0.7,
    };
    expect(lipProblem(lip)).toBeNull();
    expect(lipPath(lip)).toContain('C');
    expect(
      lipProblem({
        ...lip,
        points: [lip.points[0], lip.points[2], lip.points[1], lip.points[3]],
      }),
    ).toBeTruthy();
    expect(lipProblem({ ...lip, points: lip.points.slice(0, 2) })).toBeTruthy();
    expect(
      lipProblem({
        ...lip,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
      }),
    ).toBeTruthy();
  });
});
describe('tooth anatomy and starting alignment', () => {
  it('maps all ten FDI teeth to the correct crown type on both sides', () => {
    expect(FDI.map(crownColumn)).toEqual([4, 3, 2, 1, 0, 0, 1, 2, 3, 4]);
    const teeth = seededTeeth(
      newPhoto('Test', 'test', 2000, 1500, 'image/png'),
    );
    expect(teeth.map((t) => t.fdi)).toEqual(FDI);
    expect(teeth.every((t, i) => i === 0 || t.x > teeth[i - 1].x)).toBe(true);
    for (let i = 0; i < 5; i++) {
      const a = teeth[i],
        b = teeth[9 - i];
      expect(a.x + b.x).toBeCloseTo(2000);
      expect(a.y).toBeCloseTo(b.y);
      expect(a.width).toBeCloseTo(b.width);
      expect(a.height).toBeCloseTo(b.height);
      expect(a.rotation).toBeCloseTo(-b.rotation);
    }
    expect(teeth[4].y + teeth[4].height / 2).toBeCloseTo(
      teeth[5].y + teeth[5].height / 2,
    );
    expect(teeth[0].height).toBeLessThan(teeth[2].height);
    expect(teeth[1].height).toBeLessThan(teeth[2].height);
    expect(teeth[0].y + teeth[0].height / 2).toBeLessThan(
      teeth[4].y + teeth[4].height / 2,
    );
  });
});
describe('history and AI provenance', () => {
  it('supports undo, redo, and a new branch of edits without shared object mutation', () => {
    const h = new History<{ points: number[] }>(),
      a = { points: [1] },
      b = { points: [2] },
      c = { points: [3] };
    h.record(a);
    a.points[0] = 99;
    expect(h.undo(b)).toEqual({ points: [1] });
    expect(h.redo(a)).toEqual(b);
    h.record(c);
    expect(h.canRedo).toBe(false);
  });
  it('rejects stale and cross-photo proposals and duplicate tooth identifiers', () => {
    const source = {
      workspaceId: crypto.randomUUID(),
      photoId: crypto.randomUUID(),
      sourceRevision: 8,
    };
    const proposal = {
      id: crypto.randomUUID(),
      source,
      model: 'gemini-3.8-flash',
      createdAt: '2026-09-28',
      operation: 'outline',
      result: {
        points: [
          { x: 20, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 80 },
        ],
      },
    };
    expect(validateProposal(proposal, source)).toBeTruthy();
    expect(() =>
      validateProposal(proposal, { ...source, sourceRevision: 9 }),
    ).toThrow(/outdated/);
    expect(() =>
      validateProposal(proposal, { ...source, photoId: crypto.randomUUID() }),
    ).toThrow(/outdated/);
    expect(
      alignmentSchema.safeParse({
        teeth: Array.from({ length: 10 }, () => ({
          fdi: 11,
          center: { x: 500, y: 500 },
          width: 100,
          height: 200,
          rotation: 0,
        })),
      }).success,
    ).toBe(false);
  });
});
