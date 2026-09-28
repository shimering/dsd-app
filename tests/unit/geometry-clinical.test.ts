import { describe, it, expect } from "vitest";
import {
  calibrationScale,
  fitScale,
  imageToScreen,
  screenToImage,
} from "../../src/lib/geometry";
import {
  activeRevision,
  blankMeasurement,
  blankValue,
  createCase,
  hasConsent,
  invalidate,
  isStale,
  migrateCase,
  updateDesign,
} from "../../src/lib/case-model";
import { evaluatePeriodontalCandidate } from "../../src/lib/clinical-engine";
import { caseSchema } from "../../src/lib/validation";
describe("original-image geometry", () => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [1024, 768],
    [1180, 820],
    [1366, 1024],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ])
    for (const rotation of [0, 23, 90, -90])
      it(`round trip ${w}x${h} rotation ${rotation}`, () => {
        const scale = fitScale(w, h, 1800, 1200, rotation) * 2.3,
          center = { x: w / 2 + 45, y: h / 2 - 32 },
          point = { x: 723.12, y: 550.9 },
          screen = imageToScreen(point, center, 1800, 1200, scale, rotation),
          recovered = screenToImage(
            screen,
            center,
            1800,
            1200,
            scale,
            rotation,
          );
        expect(recovered.x).toBeCloseTo(point.x, 8);
        expect(recovered.y).toBeCloseTo(point.y, 8);
        expect(calibrationScale({ x: 0, y: 0 }, { x: 80, y: 60 }, 10)).toBe(10);
      });
  it("rejects missing, coincident or nonpositive reference distances", () => {
    for (const n of [0, -2, NaN])
      expect(() =>
        calibrationScale({ x: 0, y: 0 }, { x: 50, y: 0 }, n),
      ).toThrow();
    expect(() => calibrationScale({ x: 0, y: 0 }, { x: 0, y: 0 }, 8)).toThrow();
  });
});
function scenario() {
  const c = createCase(),
    m = c.measurements[11];
  c.assessment.confirmed = true;
  c.assessment.cause = "soft_tissue";
  m.phenotype = "thick_flat";
  m.restorativeStatus = "natural";
  for (const [key, value] of Object.entries({
    probingDepth: 2,
    boneSounding: 5,
    ktw: 6,
    marginToCej: -2,
    finishLineDepth: 0,
  })) {
    (m.sites.B as any)[key] = {
      ...blankValue(),
      value,
      state: "known",
      method: "Clinical probe at B",
      confirmed: true,
    };
  }
  m.criteria = {
    minimumClearanceMm: 3,
    minimumKtwMm: 2,
    reference: "Clinician-selected case criterion",
    confirmed: true,
    softTissueFeasible: true,
    excisionAssumptionConfirmed: true,
    site: "B",
    confirmedBy: "Test Clinician",
    confirmedAt: new Date().toISOString(),
  };
  m.sites.B.bleeding = "no";
  m.sites.B.suppuration = "no";
  const t = { ...activeRevision(c).teeth[11], gingivalShiftMm: 1 };
  return { c, m, t };
}
describe("clinical scenarios", () => {
  it("computes manual findings without any photo calibration", () => {
    const { m, t } = scenario(),
      r = evaluatePeriodontalCandidate(m, t, true);
    expect(r.remainingBoneClearanceMm).toBe(4);
    expect(r.remainingKtwMm).toBe(5);
    expect(r.outcome).toBe("candidate_gingivectomy");
  });
  it("has no universal thresholds and requires a recorded reference", () => {
    const { m, t } = scenario();
    m.criteria.confirmed = false;
    m.criteria.minimumClearanceMm = null;
    const r = evaluatePeriodontalCandidate(m, t, true);
    expect(r.outcome).toBe("further_assessment_needed");
    expect(r.clearanceCriteriaMet).toBe(false);
  });
  it("distinguishes a shortfall from a bone-removal prescription", () => {
    const { m, t } = scenario();
    t.gingivalShiftMm = 3;
    const r = evaluatePeriodontalCandidate(m, t, true);
    expect(r.clearanceShortfallMm).toBe(1);
    expect(r.outcome).toBe("crown_lengthening_assessment");
    expect(r.supportingFindings.join(" ")).toContain(
      "not a prescribed bone-removal amount",
    );
  });
  it("does not infer safety from zero or coronal movement", () => {
    const { m, t } = scenario();
    t.gingivalShiftMm = 0;
    expect(evaluatePeriodontalCandidate(m, t, true).clearanceCriteriaMet).toBe(
      false,
    );
    t.gingivalShiftMm = -1;
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "coronal_assessment",
    );
  });
  it("requires confirmed same-site values and an excision assumption", () => {
    const { m, t } = scenario();
    m.sites.B.boneSounding.confirmed = false;
    m.criteria.excisionAssumptionConfirmed = false;
    const r = evaluatePeriodontalCandidate(m, t, true);
    expect(r.remainingBoneClearanceMm).toBeUndefined();
    expect(r.remainingKtwMm).toBeUndefined();
    expect(r.outcome).toBe("further_assessment_needed");
  });
  it("does not accept photo estimates as clinical measurements", () => {
    const { m, t } = scenario();
    m.sites.B.boneSounding.source = "photo_estimate";
    expect(
      evaluatePeriodontalCandidate(m, t, true).remainingBoneClearanceMm,
    ).toBeUndefined();
  });
  it("does not borrow findings from another site", () => {
    const { m, t } = scenario();
    m.evaluationSite = "DB";
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "further_assessment_needed",
    );
  });
  it("does not accept negative distances or nonfinite criteria", () => {
    const { m, t } = scenario();
    m.sites.B.boneSounding.value = -5;
    expect(
      evaluatePeriodontalCandidate(m, t, true).remainingBoneClearanceMm,
    ).toBeUndefined();
    m.sites.B.boneSounding.value = 5;
    m.criteria.minimumClearanceMm = NaN;
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "further_assessment_needed",
    );
  });
  it("does not accept a missing method or incompatible units", () => {
    const { m, t } = scenario();
    m.sites.B.boneSounding.method = "";
    expect(
      evaluatePeriodontalCandidate(m, t, true).remainingBoneClearanceMm,
    ).toBeUndefined();
    m.sites.B.boneSounding.method = "Probe";
    (m.sites.B.boneSounding as any).unit = "px";
    expect(
      evaluatePeriodontalCandidate(m, t, true).remainingBoneClearanceMm,
    ).toBeUndefined();
  });
});
describe("records and revisions", () => {
  it("keeps clinical options pending when health findings are unknown or inflamed", () => {
    const { m, t } = scenario();
    m.sites.B.bleeding = "unknown";
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "further_assessment_needed",
    );
    m.sites.B.bleeding = "yes";
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "further_assessment_needed",
    );
  });
  it("requires criteria confirmed for the measured site by a named clinician", () => {
    const { m, t } = scenario();
    m.criteria.site = "DB";
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "further_assessment_needed",
    );
    m.criteria.site = "B";
    m.criteria.confirmedBy = "";
    expect(evaluatePeriodontalCandidate(m, t, true).outcome).toBe(
      "further_assessment_needed",
    );
  });
  it("preserves unknown separately from zero", () => {
    const m = blankMeasurement(11);
    expect(m.sites.B.ktw.value).toBeNull();
    expect(m.phenotype).toBe("unknown");
    expect(m.sites.B.ktw.state).toBe("not_measured");
  });
  it("migrates legacy data without consent, approval or CEJ sign inference", () => {
    const c = migrateCase({
      id: "case_sample",
      patientIdentifier: "PT-1",
      consentGranted: true,
      measurements: { 11: { probingDepthMm: 0, cejLocationMm: 2 } },
    });
    expect(c.measurements[11].sites.B.probingDepth.value).toBe(0);
    expect(c.measurements[11].sites.B.probingDepth.confirmed).toBe(false);
    expect(c.measurements[11].sites.B.marginToCej.value).toBeNull();
    expect(hasConsent(c)).toBe(false);
  });
  it("creates immutable design revisions and invalidates clinical approval", () => {
    const c = createCase();
    const old = activeRevision(c);
    const next = updateDesign(c, (teeth) => {
      teeth[11].rotation = 10;
      return teeth;
    });
    expect(old.teeth[11].rotation).toBe(0);
    expect(next.activeRevisionId).not.toBe(c.activeRevisionId);
    expect(
      isStale(next, {
        contextVersion: c.contextVersion,
        revisionId: c.activeRevisionId,
      }),
    ).toBe(true);
  });
  it("validates backup structure and requires the active revision", () => {
    expect(caseSchema.parse(createCase()).schemaVersion).toBe(2);
    expect(() =>
      caseSchema.parse({ ...createCase(), activeRevisionId: "missing" }),
    ).toThrow();
  });
  it("requires the current consent policy and distinguishes an imported case", () => {
    const c = createCase();
    c.consents = [
      {
        id: "consent",
        purpose: "cloud_ai",
        recordedBy: "Clinician",
        recordedAt: new Date().toISOString(),
        policyVersion: "old-policy",
      },
    ];
    expect(hasConsent(c)).toBe(false);
    expect(
      isStale(c, {
        caseId: "another-case",
        revisionId: c.activeRevisionId,
        contextVersion: c.contextVersion,
      }),
    ).toBe(true);
  });
});
