import {
  Case,
  DesignRevision,
  FDI_VISIBLE_UPPER,
  MeasuredValue,
  PhotoAsset,
  SITES,
  SiteFindings,
  ToothMeasurement,
  ToothTransform,
  TreatmentPlan,
} from "../types";
import { defaultGuides } from "./geometry";
import { evaluationsFor } from "./clinical-engine";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const blankValue = (): MeasuredValue => ({
  value: null,
  state: "not_measured",
  unit: "mm",
  source: "clinical",
  method: "",
  recordedAt: now(),
  confirmed: false,
});
export const blankSite = (): SiteFindings => ({
  probingDepth: blankValue(),
  boneSounding: blankValue(),
  ktw: blankValue(),
  marginToCej: blankValue(),
  finishLineDepth: blankValue(),
  bleeding: "unknown",
  suppuration: "unknown",
});
export const blankMeasurement = (fdi: number): ToothMeasurement => ({
  fdi,
  evaluationSite: "B",
  sites: Object.fromEntries(
    SITES.map((s) => [s, blankSite()]),
  ) as ToothMeasurement["sites"],
  phenotype: "unknown",
  restorativeStatus: "unknown",
  currentWidth: blankValue(),
  currentHeight: blankValue(),
  clinicianNotes: "",
  criteria: {
    minimumClearanceMm: null,
    minimumKtwMm: null,
    reference: "",
    confirmed: false,
    softTissueFeasible: false,
    excisionAssumptionConfirmed: false,
  },
});
export function defaultTeeth(
  w: number,
  h: number,
): Record<number, ToothTransform> {
  return Object.fromEntries(
    FDI_VISIBLE_UPPER.map((fdi) => [
      fdi,
      {
        fdi,
        form: "rounded",
        x:
          w *
          (0.5 +
            (fdi < 20 ? -1 : 1) *
              [0, 0.032, 0.096, 0.16, 0.21, 0.254][fdi % 10]),
        y: h * (fdi % 10 > 3 ? 0.55 - ((fdi % 10) - 3) * 0.008 : 0.55),
        widthPx: w * [0, 0.077, 0.05, 0.05, 0.045, 0.038][fdi % 10],
        heightPx: h * [0, 0.16, 0.14, 0.14, 0.125, 0.11][fdi % 10],
        rotation: 0,
        gingivalShiftMm: 0,
        incisalExtensionMm: 0,
        shade: "A1",
      },
    ]),
  );
}
export function createCase(identifier = "New patient"): Case {
  const rev: DesignRevision = {
    id: uid(),
    revisionNumber: 1,
    timestamp: now(),
    photoId: "",
    teeth: defaultTeeth(1000, 650),
  };
  return {
    schemaVersion: 2,
    id: uid(),
    patientIdentifier: identifier,
    patientName: "",
    createdAt: now(),
    updatedAt: now(),
    contextVersion: 1,
    photos: [],
    activePhotoId: "",
    measurements: Object.fromEntries(
      FDI_VISIBLE_UPPER.map((fdi) => [fdi, blankMeasurement(fdi)]),
    ),
    revisions: [rev],
    activeRevisionId: rev.id,
    consents: [],
    simulations: [],
    presets: [],
    consultation: [],
    assessment: {
      cause: "unknown",
      confirmed: false,
      notes: "",
      clinician: "",
    },
    capturePurpose: "preview",
    notIndicated: [],
  };
}
export const activeRevision = (c: Case) =>
  c.revisions.find((r) => r.id === c.activeRevisionId)!;
export const activePhoto = (c: Case) =>
  c.photos.find((p) => p.id === c.activePhotoId);
export function invalidate(c: Case): Case {
  return {
    ...c,
    contextVersion: c.contextVersion + 1,
    updatedAt: now(),
    treatmentPlan: c.treatmentPlan
      ? { ...c.treatmentPlan, approval: undefined }
      : undefined,
  };
}
export function updateDesign(
  c: Case,
  change: (
    teeth: Record<number, ToothTransform>,
  ) => Record<number, ToothTransform>,
): Case {
  const prev = activeRevision(c),
    rev: DesignRevision = {
      ...prev,
      id: uid(),
      revisionNumber: Math.max(...c.revisions.map((r) => r.revisionNumber)) + 1,
      timestamp: now(),
      teeth: change(structuredClone(prev.teeth)),
    };
  return invalidate({
    ...c,
    revisions: [...c.revisions, rev],
    activeRevisionId: rev.id,
  });
}
export function selectPhoto(c: Case, id: string): Case {
  const photo = c.photos.find((p) => p.id === id);
  if (!photo) return c;
  const previous = [...c.revisions].reverse().find((r) => r.photoId === id);
  if (previous)
    return invalidate({
      ...c,
      activePhotoId: id,
      activeRevisionId: previous.id,
    });
  const rev = {
    id: uid(),
    revisionNumber: c.revisions.length + 1,
    timestamp: now(),
    photoId: id,
    teeth: defaultTeeth(photo.width, photo.height),
  };
  return invalidate({
    ...c,
    activePhotoId: id,
    revisions: [...c.revisions, rev],
    activeRevisionId: rev.id,
  });
}
/** Add editable premolars without changing saved anterior geometry or historical revisions. */
export function expandUpperDesign(c: Case): Case {
  const latestByPhoto = new Map<string, DesignRevision>();
  for (const revision of c.revisions)
    latestByPhoto.set(revision.photoId, revision);
  const candidates = new Map(
    [...latestByPhoto.values(), activeRevision(c)].map((revision) => [
      revision.id,
      revision,
    ]),
  );
  const measurements = { ...c.measurements };
  let changed = false;
  for (const fdi of FDI_VISIBLE_UPPER)
    if (!measurements[fdi]) {
      measurements[fdi] = blankMeasurement(fdi);
      changed = true;
    }
  const revisions = [...c.revisions];
  let activeRevisionId = c.activeRevisionId;
  let revisionNumber = Math.max(...c.revisions.map((r) => r.revisionNumber));
  for (const source of candidates.values()) {
    if (FDI_VISIBLE_UPPER.every((fdi) => source.teeth[fdi])) continue;
    const photo = c.photos.find((p) => p.id === source.photoId);
    const w = photo?.width ?? 1000,
      h = photo?.height ?? 650;
    const defaults = defaultTeeth(w, h),
      teeth = { ...source.teeth };
    for (const quadrant of [1, 2]) {
      const canine = source.teeth[quadrant * 10 + 3];
      const lateral = source.teeth[quadrant * 10 + 2];
      let previous = canine;
      const dx =
        canine && lateral ? canine.x - lateral.x : quadrant === 1 ? -1 : 1;
      const dy = canine && lateral ? canine.y - lateral.y : 0;
      const distance = Math.hypot(dx, dy);
      const direction =
        distance > 0
          ? { x: dx / distance, y: dy / distance }
          : { x: quadrant === 1 ? -1 : 1, y: 0 };
      for (const ordinal of [4, 5]) {
        const fdi = quadrant * 10 + ordinal;
        if (!teeth[fdi]) {
          const tooth = { ...defaults[fdi] };
          if (canine && previous) {
            tooth.widthPx = canine.widthPx * (ordinal === 4 ? 0.9 : 0.76);
            tooth.heightPx = canine.heightPx * (ordinal === 4 ? 0.89 : 0.79);
            const spacing = (previous.widthPx + tooth.widthPx) / 2;
            tooth.x = Math.max(
              0,
              Math.min(w, previous.x + direction.x * spacing),
            );
            tooth.y = Math.max(
              0,
              Math.min(h, previous.y + direction.y * spacing),
            );
            tooth.rotation = canine.rotation;
            tooth.form = canine.form === "custom" ? "rounded" : canine.form;
            tooth.shade = canine.shade;
          }
          teeth[fdi] = tooth;
        }
        previous = teeth[fdi];
      }
    }
    for (const fdi of FDI_VISIBLE_UPPER) teeth[fdi] ??= defaults[fdi];
    const revision: DesignRevision = {
      ...source,
      id: uid(),
      revisionNumber: ++revisionNumber,
      timestamp: now(),
      teeth,
    };
    revisions.push(revision);
    if (source.id === c.activeRevisionId) activeRevisionId = revision.id;
    changed = true;
  }
  return changed
    ? invalidate({ ...c, measurements, revisions, activeRevisionId })
    : c;
}
export function draftPlan(c: Case): TreatmentPlan {
  const evaluations = Object.values(evaluationsFor(c));
  const unresolved = new Map<string, number[]>();
  for (const e of evaluations)
    for (const finding of e.unresolved)
      unresolved.set(finding, [...(unresolved.get(finding) ?? []), e.fdi]);
  return {
    goals: "",
    periodontalSummary: evaluations
      .map(
        (e) =>
          `FDI ${e.fdi}: ${e.headline}.${e.finishLineClearanceMm !== undefined ? ` Conditional finish-line clearance ${e.finishLineClearanceMm.toFixed(1)} mm.` : ""}${e.remainingKtwMm !== undefined ? ` Conditional remaining KTW ${e.remainingKtwMm.toFixed(1)} mm.` : ""}`,
      )
      .join("\n"),
    restorativeAlternatives:
      "Discuss additive composite, ceramic restorations, orthodontic assessment or no treatment according to clinical findings.",
    proposedSequence:
      "1. Confirm diagnosis, functional findings and records.\n2. Compare designs and review an external mock-up / wax-up where indicated.\n3. Complete periodontal or other indicated assessment before selecting a procedure.\n4. Reassess tissue stability and restorative readiness.\n5. Confirm definitive restoration and follow-up milestones.",
    referralNeeds:
      "Record periodontal, orthodontic or other referrals as indicated.",
    unresolvedFindings: [...unresolved]
      .map(([finding, teeth]) => `FDI ${teeth.join(", ")}: ${finding}`)
      .join("\n"),
    sourceVersion: c.contextVersion,
    revisionId: c.activeRevisionId,
  };
}
export const hasConsent = (c: Case) =>
  c.consents.some(
    (r) =>
      r.purpose === "cloud_ai" &&
      !r.revokedAt &&
      r.policyVersion === "cloud-ai-v1",
  );
export const isStale = (
  c: Case,
  p: { contextVersion: number; revisionId: string; caseId?: string },
) =>
  p.contextVersion !== c.contextVersion ||
  p.revisionId !== c.activeRevisionId ||
  (!!p.caseId && p.caseId !== c.id);
export function migrateCase(raw: any): Case {
  if (raw.schemaVersion === 2) return expandUpperDesign(raw as Case);
  const c = createCase(raw.patientIdentifier ?? "Imported patient");
  c.id = /^[0-9a-f-]{36}$/i.test(raw.id) ? raw.id : uid();
  c.patientName = raw.patientName ?? "";
  c.createdAt = raw.createdAt ?? now();
  c.assessment.notes = `Imported prototype record. Legacy measurements and approval require confirmation. ${raw.notes ?? ""}`;
  for (const [type, p] of Object.entries(raw.photos ?? {}) as [string, any][]) {
    const asset: PhotoAsset = {
      id: uid(),
      type:
        type === "smile"
          ? "maximum_smile"
          : type === "retracted"
            ? "retracted"
            : "rest",
      mediaKey: "",
      name: "Imported photo",
      width: 1000,
      height: 650,
      mimeType: "image/png",
      capturedAt: now(),
      qualityReviewed: false,
      filters: "unknown",
      orientationDeg: p.orientationDeg ?? 0,
      calibration: { isCalibrated: false },
      guides: defaultGuides(1000, 650),
      url: p.url,
    };
    c.photos.push(asset);
  }
  c.activePhotoId = c.photos[0]?.id ?? "";
  const old =
    raw.revisions?.find((r: any) => r.id === raw.activeRevisionId) ??
    raw.revisions?.[0];
  if (old)
    for (const fdi of FDI_VISIBLE_UPPER) {
      const t = old.teeth?.[fdi];
      if (!t) continue;
      c.revisions[0].teeth[fdi] = {
        ...c.revisions[0].teeth[fdi],
        form: ["oval", "square", "tapered", "rounded"].includes(t.form)
          ? t.form
          : "rounded",
        x: (t.x ?? 50) * 10,
        y: (t.y ?? 50) * 6.5,
        widthPx: Math.max(1, (t.width ?? 8) * 10),
        heightPx: Math.max(1, (t.height ?? 10) * 10),
        rotation: t.rotation ?? 0,
        shade: t.shade ?? "A1",
        gingivalShiftMm: t.gingivalShiftMm ?? 0,
        incisalExtensionMm: t.incisalExtensionMm ?? 0,
      };
    }
  c.revisions[0].photoId = c.activePhotoId;
  for (const fdi of FDI_VISIBLE_UPPER) {
    const m = raw.measurements?.[fdi];
    if (!m) continue;
    for (const [oldKey, key] of [
      ["probingDepthMm", "probingDepth"],
      ["boneSoundingMm", "boneSounding"],
      ["keratinizedTissueWidthMm", "ktw"],
    ] as const)
      if (typeof m[oldKey] === "number")
        c.measurements[fdi].sites.B[key] = {
          ...blankValue(),
          value: m[oldKey],
          state: "known",
          method: "Imported legacy measurement; confirm method and site",
        };
    c.measurements[fdi].clinicianNotes =
      `Legacy CEJ value: ${m.cejLocationMm ?? "unknown"}; sign/reference unconfirmed. ${m.clinicianNotes ?? ""}`;
  }
  return c;
}
