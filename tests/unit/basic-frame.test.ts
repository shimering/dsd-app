import { describe, it, expect } from 'vitest';
import {
  newPhoto,
  photoSchema,
  assertPhotoGeometry,
  seededTeeth,
} from '../../src/domain';
import {
  BASIC_TOOLS,
  FRAME_TEETH,
  basicFrameSuggestionSchema,
  basicTemplateSchema,
} from '../../src/basicFrameSchema';
import {
  seedTemplate,
  setTemplate,
  getTemplate,
  templatePaths,
  transformTemplate,
  templateBounds,
  templateFits,
  applyBasicSuggestion,
  curvePath,
  midlineResults,
  DEFAULT_TARGETS,
} from '../../src/basicFrame';
import { visibleTemplates } from '../../src/frameCanvas';

const photo = () => newPhoto('Frame', 'test', 1200, 800, 'image/png');
function suggestion() {
  const p = photo();
  return {
    templates: BASIC_TOOLS.map(({ id }) => {
      const t = seedTemplate(p, id),
        point = (q: { x: number; y: number }) => ({
          x: (q.x / p.width) * 1000,
          y: (q.y / p.height) * 1000,
        });
      return {
        id,
        paths: t.paths.map((path) => ({
          ...path,
          anchors: path.anchors.map((a) => ({
            ...a,
            point: a.point ? point(a.point) : null,
          })),
        })),
        ...(t.placement
          ? {
              placement: {
                ...t.placement,
                center: point(t.placement.center),
                centralWidth: (t.placement.centralWidth / p.width) * 1000,
              },
            }
          : {}),
      };
    }),
    unavailable: [],
  };
}
describe('six basic tools', () => {
  it('rejects collapsed midlines and persisted proportion guides extending outside the photo', () => {
    const p = photo(),
      midline = seedTemplate(p, 'midline');
    midline.paths[0].anchors[1].point = midline.paths[0].anchors[0].point;
    expect(basicTemplateSchema.safeParse(midline).success).toBe(false);
    const ruler = seedTemplate(p, 'interdental-proportion');
    ruler.placement!.center.x = 1;
    const invalid = setTemplate(p, ruler);
    expect(photoSchema.safeParse(invalid).success).toBe(false);
    expect(() => assertPhotoGeometry(invalid)).toThrow('outside');
  });
  it('uses ten upper teeth and nine ordered papilla identities through both second premolars', () => {
    const p = photo();
    expect(BASIC_TOOLS).toHaveLength(6);
    expect(FRAME_TEETH).toEqual([15, 14, 13, 12, 11, 21, 22, 23, 24, 25]);
    for (const id of ['smile-curve', 'gingival-curve'] as const)
      expect(seedTemplate(p, id).paths[0].anchors.map((a) => a.key)).toEqual(
        FRAME_TEETH.map(String),
      );
    expect(
      seedTemplate(p, 'papilla-curve').paths[0].anchors.map((a) => a.key),
    ).toEqual([
      '15-14',
      '14-13',
      '13-12',
      '12-11',
      '11-21',
      '21-22',
      '22-23',
      '23-24',
      '24-25',
    ]);
    for (const { id } of BASIC_TOOLS)
      expect(templateFits(p, seedTemplate(p, id))).toBe(true);
  });
  it('creates eleven ruler boundaries and the configured symmetric width ratios', () => {
    const t = seedTemplate(photo(), 'interdental-proportion'),
      paths = templatePaths(t),
      widths = paths
        .slice(1)
        .map((p, i) => p.anchors[0].point!.x - paths[i].anchors[0].point!.x);
    expect(paths).toHaveLength(11);
    expect(widths[3] / widths[4]).toBeCloseTo(0.8);
    expect(widths[0] / widths[4]).toBeCloseTo(0.55);
    expect(widths[1] / widths[4]).toBeCloseTo(0.62);
    expect(widths[2] / widths[4]).toBeCloseTo(0.74);
    widths.forEach((w, i) =>
      expect(w).toBeCloseTo(widths[widths.length - i - 1]),
    );
  });
  it('preserves target ratios and tooth layers through move, scale and rotation', () => {
    const p = photo();
    p.designs[0].teeth = seededTeeth(p);
    const t = seedTemplate(p, 'central-incisor-proportion'),
      center = templateBounds(t)!.center;
    const changed = transformTemplate(
        t,
        center,
        { x: center.x + 20, y: center.y + 10 },
        1.1,
        20,
      ),
      next = setTemplate(p, changed);
    expect(changed.targets).toEqual([0.82]);
    expect(changed.placement!.centralWidth).toBeCloseTo(
      t.placement!.centralWidth * 1.1,
    );
    expect(next.designs).toEqual(p.designs);
    const outline = templatePaths(t)[0].anchors.map((a) => a.point!);
    expect(
      (outline[1].x - outline[0].x) / (outline[2].y - outline[1].y),
    ).toBeCloseTo(0.82);
  });
  it('round-trips optional frame data together with legacy named measurements', () => {
    const p = photo();
    p.measurements = [
      {
        id: 'legacy',
        assessmentId: 'width-11',
        kind: 'distance',
        label: '11 crown width',
        points: [
          { x: 400, y: 400 },
          { x: 480, y: 400 },
        ],
      },
    ];
    expect(photoSchema.parse(p).dsd).toBeUndefined();
    const next = setTemplate(p, seedTemplate(p, 'gingival-curve'));
    expect(photoSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(next.measurements).toEqual(p.measurements);
    expect(() => assertPhotoGeometry(next)).not.toThrow();
    const invalid = structuredClone(next);
    invalid.dsd!.basicFrame!.templates[0].paths[0].anchors[0].point!.x = 1201;
    expect(() => assertPhotoGeometry(invalid)).toThrow('outside');
  });
  it('preserves unavailable landmark slots and breaks the smooth curve at hidden anatomy', () => {
    const t = seedTemplate(photo(), 'gingival-curve');
    t.paths[0].anchors[1] = { key: '14', point: null, reason: 'Cropped.' };
    expect(basicTemplateSchema.parse(t).paths[0].anchors).toHaveLength(10);
    expect(curvePath(t.paths[0]).match(/M /g)).toHaveLength(2);
    expect(() =>
      basicTemplateSchema.parse({
        ...t,
        paths: [{ ...t.paths[0], anchors: t.paths[0].anchors.slice(1) }],
      }),
    ).toThrow();
  });
  it('shows drafts only in Measure and shows only confirmed guides in Teeth', () => {
    let p = setTemplate(photo(), seedTemplate(photo(), 'smile-curve'));
    expect(visibleTemplates(p, 'smile-curve', false)).toHaveLength(1);
    expect(visibleTemplates(p, null, true, true)).toHaveLength(0);
    p = setTemplate(p, {
      ...getTemplate(p, 'smile-curve')!,
      status: 'confirmed',
    });
    expect(visibleTemplates(p, null, true, true)).toHaveLength(1);
  });
  it('calculates confirmed midline results independently of photo rotation and calibration', () => {
    let t = seedTemplate(photo(), 'midline');
    t.paths = [
      {
        key: 'horizontal',
        anchors: [
          { key: 'left', point: { x: 100, y: 100 } },
          { key: 'right', point: { x: 900, y: 100 } },
        ],
      },
      {
        key: 'facial',
        anchors: [
          { key: 'upper', point: { x: 500, y: 100 } },
          { key: 'lower', point: { x: 500, y: 700 } },
        ],
      },
      {
        key: 'dental',
        anchors: [
          { key: 'papilla', point: { x: 520, y: 350 } },
          { key: 'embrasure', point: { x: 520, y: 500 } },
        ],
      },
    ];
    let p = setTemplate(photo(), t);
    expect(midlineResults(p)).toHaveLength(0);
    p = setTemplate(p, { ...t, status: 'confirmed' });
    expect(midlineResults(p)[0].value).toBe('20.0 px');
    expect(midlineResults({ ...p, rotation: 90 })).toEqual(midlineResults(p));
    expect(
      midlineResults({
        ...p,
        calibration: {
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
          ],
          lengthMm: 10,
          confirmedAt: 'test',
        },
      })[0].value,
    ).toBe('1.00 mm');
    t = transformTemplate(t, { x: 600, y: 400 }, { x: 600, y: 400 }, 1, 8);
    expect(
      midlineResults(setTemplate(p, { ...t, status: 'confirmed' }))[0].value,
    ).toBe('20.0 px');
  });
  it('requires all six suggestions, rejects target injection and duplicate or missing identities', () => {
    const s = suggestion();
    expect(basicFrameSuggestionSchema.safeParse(s).success).toBe(true);
    for (const bad of [
      { ...s, templates: s.templates.slice(1) },
      { ...s, templates: [...s.templates.slice(1), s.templates[1]] },
      { ...s, templates: s.templates.map((t) => ({ ...t, targets: [0.62] })) },
    ])
      expect(basicFrameSuggestionSchema.safeParse(bad).success).toBe(false);
    s.templates[0].paths[0].anchors[0].point!.x = 1001;
    expect(basicFrameSuggestionSchema.safeParse(s).success).toBe(false);
  });
  it('applies selected placements as drafts without changing targets or confirmed guides', () => {
    let p = photo();
    p = setTemplate(p, {
      ...seedTemplate(p, 'interdental-proportion'),
      targets: [0.7, 0.9, 0.8, 0.85],
    });
    p = setTemplate(p, { ...seedTemplate(p, 'midline'), status: 'confirmed' });
    const next = applyBasicSuggestion(
      p,
      suggestion(),
      BASIC_TOOLS.map((t) => t.id),
    );
    expect(getTemplate(next, 'midline')).toEqual(getTemplate(p, 'midline'));
    expect(getTemplate(next, 'interdental-proportion')!.targets).toEqual([
      0.7, 0.9, 0.8, 0.85,
    ]);
    expect(getTemplate(next, 'smile-curve')!.status).toBe('draft');
    expect(getTemplate(next, 'interdental-proportion')!.targets).not.toEqual(
      DEFAULT_TARGETS,
    );
    expect(applyBasicSuggestion(p, suggestion(), []).dsd).toEqual(p.dsd);
  });
});
