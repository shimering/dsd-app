import { z } from 'zod';
import { dsdIdSchema, dsdUnavailableSchema } from './domain.ts';
import {
  DSD_MEASUREMENTS,
  dsdDefinition,
  dsdAllowsZero,
} from './dsdCatalog.ts';
export const assessmentSchema = z
  .object({
    measurements: z
      .array(
        z
          .object({
            assessmentId: dsdIdSchema,
            points: z.array(normalizedDsdPoint()).min(2).max(40),
          })
          .strict(),
      )
      .max(DSD_MEASUREMENTS.length),
    unavailable: z.array(dsdUnavailableSchema).max(DSD_MEASUREMENTS.length),
  })
  .strict()
  .superRefine((v, c) => {
    const ids = [...v.measurements, ...v.unavailable].map(
      (m) => m.assessmentId,
    );
    if (new Set(ids).size !== ids.length)
      c.addIssue({
        code: 'custom',
        message: 'Each DSD measurement must appear only once.',
      });
    for (const m of v.measurements) {
      const def = dsdDefinition(m.assessmentId)!;
      if (
        (def.kind !== 'polyline' && m.points.length !== 2) ||
        (def.kind === 'polyline' && m.points.length < 3) ||
        (!dsdAllowsZero(m.assessmentId) &&
          m.points
            .slice(1)
            .some(
              (p, i) =>
                Math.hypot(p.x - m.points[i].x, p.y - m.points[i].y) < 1,
            ))
      )
        c.addIssue({
          code: 'custom',
          message:
            'DSD endpoints must be distinct and match the measurement tool.',
        });
    }
  });
function normalizedDsdPoint() {
  return z
    .object({
      x: z.number().finite().min(0).max(1000),
      y: z.number().finite().min(0).max(1000),
    })
    .strict();
}
export const ASSIST_MODEL = 'gemini-3.8-flash',
  RENDER_MODEL = 'gemini-3.1-flash-image';
export const normalizedPoint = z
  .object({
    x: z.number().finite().min(0).max(1000),
    y: z.number().finite().min(0).max(1000),
  })
  .strict();
export const landmarkSchema = z
  .object({
    measurements: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            points: z.array(normalizedPoint).length(2),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export const outlineSchema = z
  .object({ points: z.array(normalizedPoint).min(3).max(80) })
  .strict();
export const alignmentSchema = z
  .object({
    teeth: z
      .array(
        z
          .object({
            fdi: z.number().int(),
            center: normalizedPoint,
            width: z.number().finite().positive().max(1000),
            height: z.number().finite().positive().max(1000),
            rotation: z.number().finite().min(-90).max(90),
          })
          .strict(),
      )
      .length(10),
  })
  .strict()
  .superRefine((value, context) => {
    const allowed = [15, 14, 13, 12, 11, 21, 22, 23, 24, 25];
    if (
      new Set(value.teeth.map((t) => t.fdi)).size !== 10 ||
      value.teeth.some((t) => !allowed.includes(t.fdi))
    )
      context.addIssue({
        code: 'custom',
        message: 'Alignment must contain all ten distinct upper teeth.',
      });
  });
export const sourceSchema = z
  .object({
    workspaceId: z.string().uuid(),
    photoId: z.string().uuid(),
    sourceRevision: z.number().int().nonnegative(),
  })
  .strict();
export const renderResultSchema = z
  .object({
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    data: z
      .string()
      .min(8)
      .max(22000000)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  })
  .strict();
export const proposalSchema = z
  .object({
    id: z.string().uuid(),
    source: sourceSchema,
    model: z.string().min(1).max(100),
    createdAt: z.string(),
    operation: z.enum([
      'landmarks',
      'assessment',
      'outline',
      'alignment',
      'render',
    ]),
    result: z.unknown(),
  })
  .strict();
export type Proposal = z.infer<typeof proposalSchema>;
export function validateProposal(
  raw: unknown,
  source: z.infer<typeof sourceSchema>,
): Proposal {
  const proposal = proposalSchema.parse(raw);
  if (
    proposal.source.workspaceId !== source.workspaceId ||
    proposal.source.photoId !== source.photoId ||
    proposal.source.sourceRevision !== source.sourceRevision
  )
    throw new Error(
      'This proposal is outdated or belongs to another photo. Request a new suggestion.',
    );
  if (proposal.operation === 'landmarks') landmarkSchema.parse(proposal.result);
  if (proposal.operation === 'assessment')
    assessmentSchema.parse(proposal.result);
  if (proposal.operation === 'outline') outlineSchema.parse(proposal.result);
  if (proposal.operation === 'alignment')
    alignmentSchema.parse(proposal.result);
  if (proposal.operation === 'render')
    renderResultSchema.parse(proposal.result);
  return proposal;
}
