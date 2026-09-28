import { z } from "zod";
const num = z.number().finite();
const point = z.object({ x: num, y: num });
const measurement = z.object({
  value: num.nullable(),
  state: z.enum(["known", "not_measured", "not_assessable", "not_applicable"]),
  unit: z.literal("mm"),
  source: z.enum(["clinical", "photo_estimate"]),
  method: z.string(),
  recordedAt: z.string(),
  confirmed: z.boolean(),
});
const sites = z.object({
  probingDepth: measurement,
  boneSounding: measurement,
  ktw: measurement,
  marginToCej: measurement,
  finishLineDepth: measurement,
  bleeding: z.enum(["unknown", "yes", "no"]),
  suppuration: z.enum(["unknown", "yes", "no"]),
});
const tooth = z.object({
  fdi: num,
  form: z.enum(["oval", "square", "tapered", "rounded", "custom"]),
  x: num,
  y: num,
  widthPx: num.positive(),
  heightPx: num.positive(),
  rotation: num,
  gingivalShiftMm: num,
  incisalExtensionMm: num,
  shade: z.string(),
  customPath: z.string().optional(),
});
const provenance = z.object({
  caseId: z.string(),
  revisionId: z.string(),
  contextVersion: num,
  photoId: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  createdAt: z.string(),
});
export const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        id: z.string(),
        styleName: z.string(),
        toothTemplate: z.enum(["oval", "square", "tapered", "rounded"]),
        recommendedShade: z.string(),
        facialProportionRationale: z.string(),
        smileArcAlignment: z.string(),
        lipLineDynamics: z.string(),
        dentitionNotes: z.string(),
      }),
    )
    .length(3),
  sequence: z.array(z.string()),
  perioSummary: z.string(),
  provenance,
});
export const caseSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.uuid(),
    ownerId: z.string().optional(),
    patientIdentifier: z.string(),
    patientName: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    contextVersion: num.int().positive(),
    photos: z.array(
      z.object({
        id: z.string(),
        type: z.enum([
          "rest",
          "social_smile",
          "maximum_smile",
          "profile_rest",
          "profile_smile",
          "retracted",
          "twelve_oclock",
          "frontal_bite",
          "right_bite",
          "left_bite",
          "upper_occlusal",
          "lower_occlusal",
          "shade",
          "video",
        ]),
        mediaKey: z.string(),
        name: z.string(),
        width: num.positive(),
        height: num.positive(),
        mimeType: z.string(),
        orientationDeg: num,
        calibration: z.object({
          isCalibrated: z.boolean(),
          p1: point.optional(),
          p2: point.optional(),
          realDistanceMm: num.positive().optional(),
          pixelsPerMm: num.positive().optional(),
          confirmedAt: z.string().optional(),
          referenceMethod: z.string().optional(),
          referenceSite: z.string().optional(),
        }),
        guides: z.object({
          facialMidline: z.array(point).length(2),
          dentalMidline: z.array(point).length(2),
          bipupillary: z.array(point).length(2),
          incisalPlane: z.array(point).length(2),
          smileArc: z.array(point).length(3),
          gingivalCurve: z.array(point).length(3),
          papillae: z.array(point),
          canineLines: z.array(point).length(4),
        }),
        capturedAt: z.string(),
        qualityReviewed: z.boolean(),
        filters: z.enum(["none", "unknown"]),
        isIllustration: z.boolean().optional(),
        archived: z.boolean().optional(),
        videoSource: z
          .object({ mediaId: z.string(), frameTimeSec: num.nonnegative() })
          .optional(),
      }),
    ),
    activePhotoId: z.string(),
    measurements: z.record(
      z.string(),
      z.object({
        fdi: num,
        sites: z.object({
          MB: sites,
          B: sites,
          DB: sites,
          ML: sites,
          L: sites,
          DL: sites,
        }),
        evaluationSite: z.enum(["MB", "B", "DB", "ML", "L", "DL"]),
        phenotype: z.enum([
          "unknown",
          "thin_scalloped",
          "thick_flat",
          "thick_scalloped",
        ]),
        restorativeStatus: z.enum([
          "unknown",
          "natural",
          "composite",
          "veneer",
          "crown",
          "implant",
          "wear_facet",
          "fractured",
        ]),
        currentWidth: measurement,
        currentHeight: measurement,
        criteria: z.object({
          minimumClearanceMm: num.nullable(),
          minimumKtwMm: num.nullable(),
          reference: z.string(),
          confirmed: z.boolean(),
          softTissueFeasible: z.boolean(),
          excisionAssumptionConfirmed: z.boolean(),
          site: z.enum(["MB", "B", "DB", "ML", "L", "DL"]).optional(),
          confirmedBy: z.string().optional(),
          confirmedAt: z.string().optional(),
        }),
        clinicianNotes: z.string(),
      }),
    ),
    revisions: z
      .array(
        z.object({
          id: z.string(),
          revisionNumber: num,
          timestamp: z.string(),
          photoId: z.string(),
          teeth: z.record(z.string(), tooth),
        }),
      )
      .min(1),
    activeRevisionId: z.string(),
    consents: z.array(
      z.object({
        id: z.string(),
        purpose: z.literal("cloud_ai"),
        recordedAt: z.string(),
        recordedBy: z.string(),
        policyVersion: z.string(),
        revokedAt: z.string().optional(),
      }),
    ),
    simulations: z.array(
      z.object({
        id: z.string(),
        provenance,
        mediaKey: z.string(),
        maskKey: z.string(),
        reviewStatus: z.enum([
          "pending_review",
          "aesthetic_accepted",
          "rejected",
        ]),
        notes: z.string(),
      }),
    ),
    presets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        teeth: z.record(z.string(), tooth),
        createdAt: z.string(),
        sourceWidth: num.positive().optional(),
        sourcePixelsPerMm: num.positive().optional(),
      }),
    ),
    consultation: z.array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        text: z.string(),
        provenance: provenance.optional(),
      }),
    ),
    suggestions: suggestionSchema.optional(),
    treatmentPlan: z
      .object({
        goals: z.string(),
        periodontalSummary: z.string(),
        restorativeAlternatives: z.string(),
        proposedSequence: z.string(),
        referralNeeds: z.string(),
        unresolvedFindings: z.string(),
        sourceVersion: num,
        revisionId: z.string(),
        approval: z
          .object({
            clinician: z.string(),
            approvedAt: z.string(),
            contextVersion: num,
            revisionId: z.string(),
          })
          .optional(),
      })
      .optional(),
    assessment: z.object({
      cause: z.enum([
        "unknown",
        "soft_tissue",
        "lip",
        "skeletal",
        "dentoalveolar",
        "wear",
        "mixed",
      ]),
      confirmed: z.boolean(),
      notes: z.string(),
      clinician: z.string(),
      facialMeasurements: z
        .object({
          restDisplay: measurement,
          gingivalDisplay: measurement,
          lipLength: measurement,
          lipMobility: measurement,
        })
        .optional(),
    }),
    capturePurpose: z.enum(["preview", "comprehensive"]),
    notIndicated: z.array(
      z.enum([
        "rest",
        "social_smile",
        "maximum_smile",
        "profile_rest",
        "profile_smile",
        "retracted",
        "twelve_oclock",
        "frontal_bite",
        "right_bite",
        "left_bite",
        "upper_occlusal",
        "lower_occlusal",
        "shade",
        "video",
      ]),
    ),
    isDemo: z.boolean().optional(),
  })
  .superRefine((c, ctx) => {
    if (!c.revisions.some((r) => r.id === c.activeRevisionId))
      ctx.addIssue({
        code: "custom",
        message: "Active design revision is missing.",
      });
  });
