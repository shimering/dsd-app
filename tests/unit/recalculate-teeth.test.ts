import { describe, expect, it } from 'vitest';
import {
  activeDesign,
  FDI,
  newPhoto,
  photoSchema,
  seededTeeth,
} from '../../src/domain';
import {
  seedTemplate,
  setTemplate,
  templatePaths,
  transformTemplate,
} from '../../src/basicFrame';
import type { BasicToolId, BasicTemplate } from '../../src/basicFrameSchema';
import {
  recalculateTeeth,
  recalculationTools,
} from '../../src/recalculateTeeth';

function fixture() {
  const p = newPhoto('Fit', 'test', 1200, 800, 'image/png');
  p.designs[0].teeth = seededTeeth(p);
  return p;
}
function add(
  p: ReturnType<typeof fixture>,
  id: BasicToolId,
  change: (t: BasicTemplate) => void = () => {},
) {
  const t = seedTemplate(p, id);
  change(t);
  return setTemplate(p, { ...t, status: 'confirmed' });
}
const tooth = (teeth: ReturnType<typeof seededTeeth>, fdi: number) =>
  teeth.find((t) => t.fdi === fdi)!;

describe('recalculate tooth overlays from confirmed guides', () => {
  it('does not use provisional, unavailable, papilla-only or lower-lip-only guides', () => {
    let p = fixture();
    const ruler = seedTemplate(p, 'interdental-proportion');
    p = setTemplate(p, ruler);
    p = add(p, 'papilla-curve');
    p = add(p, 'smile-curve', (t) =>
      t.paths[0].anchors.forEach((a) => {
        a.point = null;
        a.reason = 'Hidden';
      }),
    );
    expect(recalculationTools(p)).toEqual([]);
    expect(recalculateTeeth(p).teeth).toBe(p.designs[0].teeth);
    p = setTemplate(p, { ...ruler, status: 'unavailable', reason: 'Cropped' });
    expect(recalculationTools(p)).toEqual([]);
    const empty = add(
      newPhoto('Empty', '', 1200, 800, 'image/png'),
      'interdental-proportion',
    );
    expect(recalculateTeeth(empty).teeth).toEqual([]);
  });

  it('fits ten symmetric widths and custom central height targets while preserving styles and data', () => {
    let p = fixture();
    p.designs[0].teeth[0] = {
      ...p.designs[0].teeth[0],
      form: 'square',
      texture: 'detailed',
      shade: 'B1',
      visible: false,
      perspective: 0.2,
    };
    p = add(p, 'interdental-proportion', (t) => {
      t.placement!.centralWidth = 80;
      t.targets = [0.7, 0.9, 0.8, 0.85];
    });
    p = add(p, 'central-incisor-proportion', (t) => {
      t.targets = [0.76];
    });
    const before = structuredClone(p),
      result = recalculateTeeth(p);
    expect(p).toEqual(before);
    expect(result.skipped).toEqual([]);
    expect(result.teeth.map((t) => t.fdi)).toEqual(FDI);
    expect(tooth(result.teeth, 11).width).toBeCloseTo(80);
    expect(
      tooth(result.teeth, 21).width / tooth(result.teeth, 21).height,
    ).toBeCloseTo(0.76);
    expect(
      tooth(result.teeth, 12).width / tooth(result.teeth, 11).width,
    ).toBeCloseTo(0.7);
    expect(
      tooth(result.teeth, 13).width / tooth(result.teeth, 12).width,
    ).toBeCloseTo(0.9);
    expect(
      tooth(result.teeth, 14).width / tooth(result.teeth, 13).width,
    ).toBeCloseTo(0.8);
    expect(
      tooth(result.teeth, 15).width / tooth(result.teeth, 14).width,
    ).toBeCloseTo(0.85);
    expect(tooth(result.teeth, 25).width).toBeCloseTo(
      tooth(result.teeth, 15).width,
    );
    expect(result.teeth[0]).toMatchObject({
      form: 'square',
      texture: 'detailed',
      shade: 'B1',
      visible: false,
      perspective: 0.2,
    });
    const changed = {
      ...p,
      designs: [{ ...p.designs[0], teeth: result.teeth }],
    };
    expect(photoSchema.safeParse(changed).success).toBe(true);
    expect(recalculateTeeth(changed).teeth).toEqual(result.teeth);
  });

  it('can use only a central outline without changing the other eight teeth', () => {
    const p = add(fixture(), 'central-incisor-proportion', (t) => {
      t.placement = {
        center: { x: 620, y: 420 },
        centralWidth: 75,
        rotation: 12,
      };
      t.targets = [0.75];
    });
    const result = recalculateTeeth(p).teeth;
    for (const t of result) {
      if (t.fdi === 11 || t.fdi === 21) {
        expect(t.width).toBeCloseTo(75);
        expect(t.height).toBeCloseTo(100);
        expect(t.rotation).toBe(12);
      } else expect(t).toEqual(tooth(p.designs[0].teeth, t.fdi));
    }
  });

  it('aligns a rotated ruler to the dental midline independent of endpoint order', () => {
    let p = add(fixture(), 'interdental-proportion', (t) => {
      t.placement!.rotation = 10;
    });
    p = add(p, 'midline', (t) => {
      t.paths
        .find((p) => p.key === 'dental')!
        .anchors.forEach((q, i) => {
          q.point = i ? { x: 650, y: 350 } : { x: 620, y: 550 };
        });
    });
    const result = recalculateTeeth(p).teeth;
    const left = tooth(result, 11),
      right = tooth(result, 21);
    const mx = (left.x + right.x) / 2,
      my = (left.y + right.y) / 2;
    expect(mx).toBeCloseTo(650 - (my - 350) * 0.15);
    expect(left.rotation).toBeCloseTo((Math.atan(0.15) * 180) / Math.PI);
    expect(tooth(result, 15).width / left.width).toBeCloseTo(0.55);
  });

  it('fits observed crown axes and leaves cropped posterior teeth unchanged without a layout', () => {
    let p = add(fixture(), 'smile-curve');
    p = add(p, 'gingival-curve');
    p.dsd!.basicFrame!.templates.forEach((t) => {
      const a = t.paths[0].anchors.find((a) => a.key === '25')!;
      a.point = null;
      a.reason = 'Outside crop';
      const central = t.paths[0].anchors.find((a) => a.key === '11')!;
      central.point =
        t.id === 'smile-curve' ? { x: 565, y: 500 } : { x: 550, y: 390 };
    });
    const result = recalculateTeeth(p).teeth,
      t = tooth(result, 11);
    expect(t.height).toBeCloseTo(Math.hypot(15, 110));
    expect(t.rotation).toBeCloseTo((-Math.atan(15 / 110) * 180) / Math.PI);
    expect(t.x).toBeCloseTo(557.5);
    expect(t.y).toBeCloseTo(445);
    expect(tooth(result, 25)).toEqual(tooth(p.designs[0].teeth, 25));
  });

  it('fits visible curves to a rotated width layout, prioritizing the central target ratio', () => {
    let p = add(fixture(), 'interdental-proportion', (t) => {
      t.placement = {
        center: { x: 600, y: 400 },
        centralWidth: 70,
        rotation: 15,
      };
    });
    p = add(p, 'central-incisor-proportion', (t) => {
      t.targets = [0.7];
    });
    const ruler = p.dsd!.basicFrame!.templates[0],
      boundaries = templatePaths(ruler);
    const angle = (15 * Math.PI) / 180;
    for (const id of ['smile-curve', 'gingival-curve'] as const)
      p = add(p, id, (t) => {
        t.paths[0].anchors.forEach((q, i) => {
          const x =
            (boundaries[i].anchors[0].point!.x +
              boundaries[i + 1].anchors[0].point!.x) /
            2;
          const y =
            (boundaries[i].anchors[0].point!.y +
              boundaries[i + 1].anchors[0].point!.y) /
            2;
          // The ruler endpoints lie 0.65 central widths above its center.
          const v = (id === 'smile-curve' ? 100 : -50) + 70 * 0.65;
          q.point = { x: x - v * Math.sin(angle), y: y + v * Math.cos(angle) };
        });
      });
    const result = recalculateTeeth(p).teeth;
    result.forEach((t) => {
      expect(t.rotation).toBe(15);
      expect(t.height).toBeCloseTo(t.fdi % 10 === 1 ? 100 : 150);
      const edge = {
        x: t.x - (t.height / 2) * Math.sin(angle),
        y: t.y + (t.height / 2) * Math.cos(angle),
      };
      expect(
        -(edge.x - 600) * Math.sin(angle) + (edge.y - 400) * Math.cos(angle),
      ).toBeCloseTo(100);
    });
  });

  it('retains conflicting or unrepresentable crowns and ignores calibration and viewport rotation', () => {
    let p = add(fixture(), 'smile-curve');
    p = add(p, 'gingival-curve', (t) => {
      t.paths[0].anchors[0].point!.y = 700;
    });
    const result = recalculateTeeth(p);
    expect(result.skipped).toContain(15);
    expect(result.teeth[0]).toEqual(p.designs[0].teeth[0]);
    const rotated = {
      ...p,
      rotation: 90,
      calibration: {
        points: [
          { x: 400, y: 400 },
          { x: 500, y: 400 },
        ],
        lengthMm: 10,
        confirmedAt: '2026-10-01',
      },
    };
    expect(recalculateTeeth(rotated)).toEqual(result);
    const extreme = add(fixture(), 'central-incisor-proportion', (t) => {
      t.targets = [0.00001];
    });
    expect(recalculateTeeth(extreme).skipped).toEqual([11, 21]);
  });

  it('aligns the central contact to the dental midline when existing widths differ', () => {
    const p = add(fixture(), 'midline', (t) => {
      t.paths
        .find((p) => p.key === 'dental')!
        .anchors.forEach((q, i) => {
          q.point = { x: 660, y: i ? 500 : 350 };
        });
    });
    tooth(p.designs[0].teeth, 11).width *= 1.3;
    const result = recalculateTeeth(p).teeth,
      left = tooth(result, 11),
      right = tooth(result, 21);
    expect(
      (left.x + left.width / 2 + right.x - right.width / 2) / 2,
    ).toBeCloseTo(660);
  });

  it('reads the active alternative rather than the first design', () => {
    const p = add(fixture(), 'central-incisor-proportion');
    const other = {
      ...p.designs[0],
      id: 'alternative',
      teeth: p.designs[0].teeth.map((t) => ({ ...t, width: t.width * 2 })),
    };
    p.designs.push(other);
    p.activeDesignId = other.id;
    const result = recalculateTeeth(p);
    expect(result.teeth[0].width).toBe(activeDesign(p).teeth[0].width);
    expect(p.designs[0].teeth[0].width).not.toBe(result.teeth[0].width);
  });
});
