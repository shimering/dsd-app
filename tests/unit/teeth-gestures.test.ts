import { describe, expect, it } from 'vitest';
import {
  newPhoto,
  seededTeeth,
  restoreCrownProportions,
  type Point,
} from '../../src/domain';
import { distance, pinchTeeth, toImage, toScreen } from '../../src/geometry';

const teeth = seededTeeth(newPhoto('Test', '', 1200, 800, 'image/png'));
const start: [Point, Point] = [
  { x: 400, y: 400 },
  { x: 800, y: 400 },
];
function fingers(scale: number, degrees: number): [Point, Point] {
  const angle = (degrees * Math.PI) / 180;
  return start.map((p) => ({
    x: 600 + (p.x - 600) * scale * Math.cos(angle),
    y: 400 + (p.x - 600) * scale * Math.sin(angle),
  })) as [Point, Point];
}
describe('two-finger tooth transforms', () => {
  it('uses crown width rather than a deep mouth opening to set starting height', () => {
    const p = newPhoto('Test', '', 1200, 800, 'image/png');
    const arch = (bottom: number) =>
      seededTeeth({
        ...p,
        lip: {
          points: [
            { x: 250, y: 250 },
            { x: 950, y: 250 },
            { x: 950, y: bottom },
            { x: 250, y: bottom },
          ],
          closed: true,
          smoothing: 0,
        },
      });
    const normal = arch(500),
      deep = arch(750);
    deep.forEach((t, i) => {
      expect(t.height).toBeCloseTo(normal[i].height);
      expect(t.y).toBeCloseTo(normal[i].y);
    });
    for (const fdi of [11, 21]) {
      const t = deep.find((t) => t.fdi === fdi)!;
      expect(t.width / t.height).toBeCloseTo(0.82);
      expect(t.height).toBeLessThan(150);
    }
  });
  it('restores elongated crown proportions without moving the cervical midpoint', () => {
    const t = {
      ...teeth.find((t) => t.fdi === 11)!,
      height: 300,
      rotation: 27,
    };
    const next = restoreCrownProportions(t),
      angle = (t.rotation * Math.PI) / 180;
    const top = (tooth: typeof t) => ({
      x: tooth.x + (tooth.height / 2) * Math.sin(angle),
      y: tooth.y - (tooth.height / 2) * Math.cos(angle),
    });
    expect(next.width / next.height).toBeCloseTo(0.82);
    expect(top(next).x).toBeCloseTo(top(t).x);
    expect(top(next).y).toBeCloseTo(top(t).y);
    expect(next.width).toBe(t.width);
    expect(next.rotation).toBe(t.rotation);
  });
  it('rotates and scales only the selected tooth, including a rotated and zoomed photo', () => {
    const view = {
      width: 900,
      height: 600,
      photoWidth: 1200,
      photoHeight: 800,
      rotation: 90,
      scale: 1.8,
      pan: { x: 33, y: -40 },
    };
    const end = fingers(1.2, 23.7);
    const converted = (points: [Point, Point]) =>
      points.map((p) => toImage(toScreen(p, view), view)) as [Point, Point];
    const next = pinchTeeth(
      teeth,
      11,
      converted(start),
      converted(end),
      false,
      2400,
      1600,
    );
    const before = teeth.find((t) => t.fdi === 11)!,
      after = next.find((t) => t.fdi === 11)!;
    expect(after.width / before.width).toBeCloseTo(1.2);
    expect(after.height / before.height).toBeCloseTo(1.2);
    expect(after.rotation - before.rotation).toBeCloseTo(23.7);
    teeth.forEach((t, i) => {
      if (t.fdi !== 11) expect(next[i]).toBe(t);
    });
  });
  it('keeps arch proportions and relative angles when transforming the whole smile', () => {
    const next = pinchTeeth(
      teeth,
      null,
      start,
      fingers(1.3, -18),
      false,
      2400,
      1600,
    );
    next.forEach((t, i) => {
      expect(t.width / teeth[i].width).toBeCloseTo(1.3);
      expect(t.rotation - teeth[i].rotation).toBeCloseTo(-18);
    });
    expect(
      distance(next[0], next[9]) / distance(teeth[0], teeth[9]),
    ).toBeCloseTo(1.3);
  });
  it('magnetically snaps nearby angles and scale steps only when enabled', () => {
    const free = pinchTeeth(
      teeth,
      11,
      start,
      fingers(1.107, 14.3),
      false,
      2400,
      1600,
    );
    const snapped = pinchTeeth(
      teeth,
      11,
      start,
      fingers(1.107, 14.3),
      true,
      2400,
      1600,
    );
    const i = teeth.findIndex((t) => t.fdi === 11);
    expect(free[i].rotation).toBeCloseTo(14.3);
    expect(snapped[i].rotation).toBe(15);
    expect(snapped[i].width / teeth[i].width).toBeCloseTo(1.1);
    const between = pinchTeeth(
      teeth,
      11,
      start,
      fingers(1.125, 17.5),
      true,
      2400,
      1600,
    );
    expect(between[i].rotation).toBeCloseTo(17.5);
    expect(between[i].width / teeth[i].width).toBeCloseTo(1.125);
  });
  it('crosses the angle boundary smoothly and constrains scale without changing arch proportions', () => {
    const angleStart = fingers(1, 179),
      end = fingers(1, -179);
    const next = pinchTeeth(teeth, 11, angleStart, end, false, 2400, 1600);
    expect(next.find((t) => t.fdi === 11)!.rotation).toBeCloseTo(2);
    const tiny = pinchTeeth(
      teeth,
      null,
      start,
      fingers(0, 0),
      false,
      2400,
      1600,
    );
    tiny.forEach((t) => {
      expect(t.width).toBeGreaterThanOrEqual(1);
      expect(t.height).toBeGreaterThanOrEqual(1);
    });
    const huge = pinchTeeth(
      teeth,
      null,
      start,
      fingers(1000, 0),
      false,
      2400,
      1600,
    );
    huge.forEach((t) => {
      expect(t.width).toBeLessThanOrEqual(2400);
      expect(t.height).toBeLessThanOrEqual(1600);
    });
    expect(
      pinchTeeth(teeth, null, [start[0], start[0]], end, false, 2400, 1600),
    ).toBe(teeth);
  });
});
