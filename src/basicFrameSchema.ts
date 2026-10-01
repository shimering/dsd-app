import { z } from 'zod';

export const FRAME_TEETH = [15, 14, 13, 12, 11, 21, 22, 23, 24, 25] as const;
export const BASIC_TOOLS = [
  { id: 'midline', label: 'Midline' },
  { id: 'smile-curve', label: 'Smile curve' },
  { id: 'interdental-proportion', label: 'Interdental proportion' },
  { id: 'central-incisor-proportion', label: 'Central incisor proportion' },
  { id: 'gingival-curve', label: 'Gingival curve' },
  { id: 'papilla-curve', label: 'Papilla curve' },
] as const;
export const basicToolIdSchema = z.enum(BASIC_TOOLS.map((t) => t.id));
export type BasicToolId = z.infer<typeof basicToolIdSchema>;
const framePointSchema = z
  .object({
    x: z.number().finite().min(0).max(100000),
    y: z.number().finite().min(0).max(100000),
  })
  .strict();
export const frameAnchorSchema = z
  .object({
    key: z.string().max(40),
    point: framePointSchema.nullable(),
    reason: z.string().min(1).max(240).optional(),
  })
  .strict()
  .superRefine((a, c) => {
    if (!a.point && !a.reason)
      c.addIssue({
        code: 'custom',
        message: 'Missing landmarks require an unavailable reason.',
      });
  });
export const framePathSchema = z
  .object({
    key: z.string().max(40),
    anchors: z.array(frameAnchorSchema).min(2).max(40),
  })
  .strict();
export const framePlacementSchema = z
  .object({
    center: framePointSchema,
    centralWidth: z.number().finite().positive().max(100000),
    rotation: z.number().finite().min(-360).max(360),
  })
  .strict();
export const PATH_KEYS: Record<BasicToolId, Record<string, string[]>> = {
  midline: {
    horizontal: ['left', 'right'],
    facial: ['upper', 'lower'],
    dental: ['papilla', 'embrasure'],
  },
  'smile-curve': {
    incisal: FRAME_TEETH.map(String),
    'lower-lip': ['left', 'left-inner', 'middle', 'right-inner', 'right'],
  },
  'interdental-proportion': {},
  'central-incisor-proportion': {},
  'gingival-curve': { gingival: FRAME_TEETH.map(String) },
  'papilla-curve': {
    papilla: FRAME_TEETH.slice(0, -1).map(
      (fdi, i) => `${fdi}-${FRAME_TEETH[i + 1]}`,
    ),
  },
};
export const frameGeometrySchema = z
  .object({
    id: basicToolIdSchema,
    paths: z.array(framePathSchema).max(3),
    placement: framePlacementSchema.optional(),
  })
  .strict()
  .superRefine((t, c) => {
    const expected = PATH_KEYS[t.id];
    if (
      t.paths.length !== Object.keys(expected).length ||
      new Set(t.paths.map((p) => p.key)).size !== t.paths.length ||
      t.paths.some(
        (p) =>
          !expected[p.key] ||
          p.anchors.length !== expected[p.key].length ||
          p.anchors.some((a, i) => a.key !== expected[p.key][i]),
      )
    )
      c.addIssue({
        code: 'custom',
        message:
          'Every tool must retain its ordered tooth and landmark identities.',
      });
    if (!!t.placement !== t.id.endsWith('proportion'))
      c.addIssue({
        code: 'custom',
        message:
          'Proportion tools require placement; reference tools use paths.',
      });
    if (
      t.id === 'midline' &&
      t.paths.some(
        (p) =>
          p.anchors[0]?.point &&
          p.anchors[1]?.point &&
          Math.hypot(
            p.anchors[0].point.x - p.anchors[1].point.x,
            p.anchors[0].point.y - p.anchors[1].point.y,
          ) < 1,
      )
    )
      c.addIssue({
        code: 'custom',
        message: 'Reference lines require distinct endpoints.',
      });
  });
export const basicTemplateSchema = frameGeometrySchema
  .safeExtend({
    status: z.enum(['draft', 'confirmed', 'unavailable']),
    reason: z.string().min(1).max(240).optional(),
    targets: z.array(z.number().finite().positive().max(10)).max(4).optional(),
  })
  .superRefine((t, c) => {
    const count =
      t.id === 'interdental-proportion'
        ? 4
        : t.id === 'central-incisor-proportion'
          ? 1
          : 0;
    if ((t.targets?.length ?? 0) !== count)
      c.addIssue({
        code: 'custom',
        message: 'Proportion tools require their configured target ratios.',
      });
    if (t.status === 'unavailable' && !t.reason)
      c.addIssue({
        code: 'custom',
        message: 'Unavailable tools require a reason.',
      });
    if (
      t.status === 'confirmed' &&
      !t.placement &&
      !t.paths.some(
        (p) =>
          p.anchors.filter((a) => a.point).length >=
          (t.id === 'midline' ? 2 : 3),
      )
    )
      c.addIssue({
        code: 'custom',
        message:
          'Confirm at least one complete reference line or a curve with three visible landmarks.',
      });
  });
export const basicFrameSchema = z
  .object({ templates: z.array(basicTemplateSchema).max(6) })
  .strict()
  .superRefine((f, c) => {
    if (new Set(f.templates.map((t) => t.id)).size !== f.templates.length)
      c.addIssue({ code: 'custom', message: 'Basic tools must be unique.' });
  });
export const basicFrameSuggestionSchema = z
  .object({
    templates: z.array(frameGeometrySchema).max(6),
    unavailable: z
      .array(
        z
          .object({ id: basicToolIdSchema, reason: z.string().min(1).max(240) })
          .strict(),
      )
      .max(6),
  })
  .strict()
  .superRefine((r, c) => {
    const ids = [...r.templates, ...r.unavailable].map((t) => t.id);
    if (ids.length !== 6 || new Set(ids).size !== 6)
      c.addIssue({
        code: 'custom',
        message: 'Return each of the six basic tools once.',
      });
    const points = [
      ...r.templates.flatMap((t) =>
        t.paths.flatMap((p) =>
          p.anchors.flatMap((a) => (a.point ? [a.point] : [])),
        ),
      ),
      ...r.templates.flatMap((t) => (t.placement ? [t.placement.center] : [])),
    ];
    if (
      points.some((p) => p.x > 1000 || p.y > 1000) ||
      r.templates.some((t) => t.placement && t.placement.centralWidth > 1000)
    )
      c.addIssue({
        code: 'custom',
        message: 'Suggestions must use normalized coordinates.',
      });
  });
export type FrameAnchor = z.infer<typeof frameAnchorSchema>;
export type FramePath = z.infer<typeof framePathSchema>;
export type BasicTemplate = z.infer<typeof basicTemplateSchema>;
export type BasicFrameSuggestion = z.infer<typeof basicFrameSuggestionSchema>;
export function frameExtentPoints(t: BasicTemplate) {
  if (!t.placement)
    return t.paths.flatMap((p) =>
      p.anchors.flatMap((a) => (a.point ? [a.point] : [])),
    );
  const { center, centralWidth: w, rotation } = t.placement,
    a = (rotation * Math.PI) / 180;
  const [l, c, p1, p2] = t.targets!;
  const halfWidth =
    t.id === 'central-incisor-proportion'
      ? w
      : w * (1 + l + l * c + l * c * p1 + l * c * p1 * p2);
  const halfHeight =
    t.id === 'central-incisor-proportion' ? w / t.targets![0] / 2 : w * 0.65;
  return [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ].map(([x, y]) => ({
    x: center.x + x * Math.cos(a) - y * Math.sin(a),
    y: center.y + x * Math.sin(a) + y * Math.cos(a),
  }));
}
