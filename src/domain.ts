import { z } from 'zod';
import { DSD_MEASUREMENTS, dsdDefinition } from './dsdCatalog.ts';
import {
  basicFrameSchema,
  FRAME_TEETH,
  frameExtentPoints,
} from './basicFrameSchema.ts';

export const dsdIdSchema = z.enum(
  DSD_MEASUREMENTS.map((m) => m.id) as [string, ...string[]],
);
export const dsdUnavailableSchema = z
  .object({
    assessmentId: dsdIdSchema,
    reason: z.string().min(1).max(240),
  })
  .strict();

export const FDI = FRAME_TEETH;
export const FORMS = [
  { id: 'oval', name: 'Soft oval' },
  { id: 'square', name: 'Soft square' },
  { id: 'tapered', name: 'Tapered' },
  { id: 'rounded', name: 'Rounded' },
  { id: 'frontal-reference', name: 'Frontal reference' },
] as const;
export const TEXTURES = ['smooth', 'natural', 'detailed'] as const;
export const SHADES = ['A1', 'A2', 'B1', 'BL2', 'BL1'] as const;
export const STEPS = [
  'Photos',
  'Measure',
  'Lip outline',
  'Teeth',
  'Compare',
] as const;
export type Step = (typeof STEPS)[number];
export type Tool =
  | 'select'
  | 'distance'
  | 'polyline'
  | 'angle'
  | 'guide'
  | 'ink'
  | 'calibrate'
  | 'lip'
  | 'pan';
export const pointSchema = z
  .object({
    x: z.number().finite().min(0).max(100000),
    y: z.number().finite().min(0).max(100000),
  })
  .strict();
export type Point = z.infer<typeof pointSchema>;
export const calibrationSchema = z
  .object({
    points: z.array(pointSchema).length(2),
    lengthMm: z.number().finite().positive().max(1000),
    confirmedAt: z.string(),
  })
  .strict();
export const measurementSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['distance', 'polyline', 'angle', 'guide', 'ink']),
    label: z.string().max(200),
    points: z.array(pointSchema).min(2).max(10000),
    assessmentId: dsdIdSchema.optional(),
  })
  .strict()
  .superRefine((m, c) => {
    if (
      m.assessmentId &&
      (m.kind !== dsdDefinition(m.assessmentId)?.kind ||
        (m.kind === 'polyline' ? m.points.length < 3 : m.points.length !== 2))
    )
      c.addIssue({
        code: 'custom',
        message:
          'The DSD measurement must match its named tool and point count.',
      });
  });
export type Measurement = z.infer<typeof measurementSchema>;
export const toothSchema = z
  .object({
    fdi: z
      .number()
      .int()
      .refine((n) => FDI.includes(n as (typeof FDI)[number])),
    form: z.enum(FORMS.map((form) => form.id)),
    texture: z.enum(TEXTURES),
    shade: z.enum(SHADES),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive().max(100000),
    height: z.number().finite().positive().max(100000),
    rotation: z.number().finite(),
    perspective: z.number().finite().min(-0.65).max(0.65),
    visible: z.boolean(),
  })
  .strict();
export type Tooth = z.infer<typeof toothSchema>;
export const lightingSchema = z
  .object({
    brightness: z.number().finite().min(-40).max(40),
    warmth: z.number().finite().min(-40).max(40),
    saturation: z.number().finite().min(-50).max(50),
    highlights: z.number().finite().min(0).max(100),
    lipShadow: z.number().finite().min(0).max(75),
    shadowDepth: z.number().finite().min(10).max(80),
    posteriorShadow: z.number().finite().min(0).max(75),
    lightBalance: z.number().finite().min(-60).max(60),
  })
  .strict();
export type Lighting = z.infer<typeof lightingSchema>;
export const DEFAULT_LIGHTING: Lighting = {
  brightness: 0,
  warmth: 0,
  saturation: 0,
  highlights: 0,
  lipShadow: 0,
  shadowDepth: 35,
  posteriorShadow: 0,
  lightBalance: 0,
};
export const designSchema = z
  .object({
    id: z.string(),
    name: z.string().max(120),
    teeth: z.array(toothSchema).max(10),
    lighting: lightingSchema.optional(),
    createdAt: z.string(),
  })
  .strict();
export type Design = z.infer<typeof designSchema>;
export const lipSchema = z
  .object({
    points: z.array(pointSchema).max(300),
    closed: z.boolean(),
    smoothing: z.number().min(0).max(1),
  })
  .strict();
export type Lip = z.infer<typeof lipSchema>;
export const photoSchema = z
  .object({
    id: z.string(),
    mediaKey: z.string(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    name: z.string().max(500),
    width: z.number().int().positive().max(30000),
    height: z.number().int().positive().max(30000),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    rotation: z.number().finite(),
    revision: z.number().int().nonnegative(),
    calibration: calibrationSchema.nullable(),
    measurements: z.array(measurementSchema).max(1000),
    dsd: z
      .object({
        view: z.enum(['smile', 'rest', 'retracted']),
        unavailable: z.array(dsdUnavailableSchema).max(DSD_MEASUREMENTS.length),
        basicFrame: basicFrameSchema.optional(),
        smileArc: z
          .enum(['unassessed', 'consonant', 'flat', 'reverse'])
          .optional(),
      })
      .strict()
      .optional(),
    lip: lipSchema,
    designs: z.array(designSchema).max(100),
    activeDesignId: z.string(),
    demo: z.boolean(),
    render: z
      .object({
        mediaKey: z.string(),
        sourceRevision: z.number().int(),
        model: z.string(),
        createdAt: z.string(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((p, c) => {
    if (
      p.dsd?.basicFrame?.templates.some((t) =>
        frameExtentPoints(t).some(
          (q) => q.x < 0 || q.y < 0 || q.x > p.width || q.y > p.height,
        ),
      )
    )
      c.addIssue({
        code: 'custom',
        message: 'Basic guides must stay inside the original photo.',
      });
    const ids = p.measurements
      .filter((m) => m.assessmentId)
      .map((m) => m.assessmentId);
    const unavailable = p.dsd?.unavailable.map((m) => m.assessmentId) ?? [];
    if (
      new Set(ids).size !== ids.length ||
      new Set(unavailable).size !== unavailable.length ||
      unavailable.some((id) => ids.includes(id))
    )
      c.addIssue({
        code: 'custom',
        message:
          'DSD items must have unique measurement or unavailable records.',
      });
  });
export type Photo = z.infer<typeof photoSchema>;
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    ownerId: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    createdAt: z.string(),
    updatedAt: z.string(),
    photos: z.array(photoSchema).max(100),
    activePhotoId: z.string(),
    presets: z
      .array(
        z
          .object({
            id: z.string(),
            name: z.string().max(120),
            design: designSchema,
            sourceWidth: z.number().positive(),
            sourceHeight: z.number().positive(),
          })
          .strict(),
      )
      .max(100),
    consent: z
      .object({
        recordedAt: z.string(),
        policyVersion: z.literal('1'),
        recordedBy: z.string(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function newWorkspace(name = 'Untitled case'): Workspace {
  return {
    schemaVersion: 1,
    id: uid(),
    name,
    createdAt: now(),
    updatedAt: now(),
    photos: [],
    activePhotoId: '',
    presets: [],
    consent: null,
  };
}
export function newPhoto(
  name: string,
  mediaKey: string,
  width: number,
  height: number,
  mimeType: Photo['mimeType'],
  demo = false,
): Photo {
  const design: Design = {
    id: uid(),
    name: 'Design 1',
    teeth: [],
    createdAt: now(),
  };
  return {
    id: uid(),
    name,
    mediaKey,
    width,
    height,
    mimeType,
    rotation: 0,
    revision: 0,
    calibration: null,
    measurements: [],
    lip: { points: [], closed: false, smoothing: 0.35 },
    designs: [design],
    activeDesignId: design.id,
    demo,
    render: null,
  };
}
export const activeDesign = (photo: Photo) =>
  photo.designs.find((d) => d.id === photo.activeDesignId) ?? photo.designs[0];
export function updatePhoto(workspace: Workspace, photo: Photo): Workspace {
  return {
    ...workspace,
    updatedAt: now(),
    photos: workspace.photos.map((p) =>
      p.id === photo.id ? { ...photo, revision: p.revision + 1 } : p,
    ),
  };
}
export function seededTeeth(photo: Photo): Tooth[] {
  const pts = photo.lip.points;
  const minX = pts.length
    ? Math.min(...pts.map((p) => p.x))
    : photo.width * 0.27;
  const maxX = pts.length
    ? Math.max(...pts.map((p) => p.x))
    : photo.width * 0.73;
  const minY = pts.length
    ? Math.min(...pts.map((p) => p.y))
    : photo.height * 0.47;
  const maxY = pts.length
    ? Math.max(...pts.map((p) => p.y))
    : photo.height * 0.66;
  const widths = [0.55, 0.62, 0.74, 0.8, 1, 1, 0.8, 0.74, 0.62, 0.55],
    sum = widths.reduce((a, b) => a + b, 0),
    span = (maxX - minX) * 0.94;
  const openingHeight = Math.max(4, maxY - minY);
  const centralHeight = ((span / sum) * 1.02) / 0.82;
  // A deep opening includes oral space and lower teeth. Upper crown height
  // comes from crown width, not the height of the entire mouth opening.
  const midX = (minX + maxX) / 2;
  const upperCrossings: number[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    if (
      Math.abs(q.x - p.x) > 0.001 &&
      midX >= Math.min(p.x, q.x) &&
      midX <= Math.max(p.x, q.x)
    )
      upperCrossings.push(p.y + ((q.y - p.y) * (midX - p.x)) / (q.x - p.x));
  });
  const upperY = upperCrossings.length ? Math.min(...upperCrossings) : minY;
  const centralEdge = Math.min(
    maxY - openingHeight * 0.06,
    upperY + centralHeight * 0.9,
  );
  const curveHeight = Math.min(openingHeight, centralHeight);
  const edgeOffsets = [0.23, 0.16, 0.04, 0.09, 0, 0, 0.09, 0.04, 0.16, 0.23];
  let x = minX + (maxX - minX - span) / 2;
  return FDI.map((fdi, index) => {
    const w = (span * widths[index]) / sum,
      cx = x + w / 2;
    x += w;
    const height = naturalCrownHeight({ fdi, width: w * 1.02 });
    // Position by the visible incisal edge / cusp, never by atlas cell padding.
    const edge = centralEdge - curveHeight * edgeOffsets[index];
    const rotations = [7, 5, 3, 1, 0, 0, -1, -3, -5, -7];
    return {
      fdi,
      form: 'oval',
      texture: 'natural',
      shade: 'A1',
      x: cx,
      y: edge - height / 2,
      width: w * 1.02,
      height,
      rotation: rotations[index],
      perspective: 0,
      visible: true,
    };
  });
}
// Adjustable visual starting proportions, independent of calibration.
export function naturalCrownHeight(t: Pick<Tooth, 'fdi' | 'width'>) {
  const ratio =
    ({ 1: 0.82, 2: 0.75, 3: 0.72, 4: 0.74, 5: 0.74 } as Record<number, number>)[
      t.fdi % 10
    ] ?? 0.8;
  return Math.max(1, Math.min(100000, t.width / ratio));
}
export function restoreCrownProportions(t: Tooth): Tooth {
  const height = naturalCrownHeight(t);
  const shift = (height - t.height) / 2,
    angle = (t.rotation * Math.PI) / 180;
  // Preserve the cervical midpoint under the upper lip when shortening a tooth.
  return {
    ...t,
    height,
    x: t.x - shift * Math.sin(angle),
    y: t.y + shift * Math.cos(angle),
  };
}
export function replaceDesign(photo: Photo, design: Design): Photo {
  return {
    ...photo,
    designs: photo.designs.map((d) => (d.id === design.id ? design : d)),
  };
}
export function assertPhotoGeometry(photo: Photo) {
  const named = photo.measurements.filter((m) => m.assessmentId);
  if (
    new Set(named.map((m) => m.assessmentId)).size !== named.length ||
    named.some((m) => m.kind !== dsdDefinition(m.assessmentId!)?.kind)
  )
    throw new Error(
      'DSD measurements must have distinct identifiers and the correct tool.',
    );
  const all = [
    ...photo.lip.points,
    ...(photo.calibration?.points ?? []),
    ...photo.measurements.flatMap((m) => m.points),
    ...(photo.dsd?.basicFrame?.templates.flatMap(frameExtentPoints) ?? []),
  ];
  if (
    all.some(
      (p) => p.x < 0 || p.y < 0 || p.x > photo.width || p.y > photo.height,
    )
  )
    throw new Error('A point is outside the original photo.');
  if (
    photo.measurements.some(
      (m) =>
        (m.kind === 'angle' && m.points.length !== 3) ||
        (m.kind === 'distance' && m.points.length !== 2) ||
        (m.kind === 'guide' && m.points.length !== 2),
    )
  )
    throw new Error('This measurement has an invalid point count.');
  if (
    photo.calibration &&
    Math.hypot(
      photo.calibration.points[0].x - photo.calibration.points[1].x,
      photo.calibration.points[0].y - photo.calibration.points[1].y,
    ) < 2
  )
    throw new Error('Calibration points must be distinct.');
}
