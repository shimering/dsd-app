import { describe, expect, it } from "vitest";
import { FDI_VISIBLE_UPPER, SITES } from "../../src/types";
import {
  activeRevision,
  createCase,
  draftPlan,
  expandUpperDesign,
  isStale,
  now,
  selectPhoto,
  uid,
} from "../../src/lib/case-model";
import { defaultGuides } from "../../src/lib/geometry";
import { evaluationsFor } from "../../src/lib/clinical-engine";
import {
  getToothTypeFromFdi,
  TOOTH_TEMPLATES,
} from "../../src/lib/tooth-templates";

const premolars = [14, 15, 24, 25];
function oldSixToothCase() {
  let c = createCase("EXISTING-SIX");
  for (const [width, height] of [
    [1800, 1200],
    [1200, 800],
  ]) {
    const id = uid();
    c.photos.push({
      id,
      type: "maximum_smile",
      width,
      height,
      mediaKey: `media-${id}`,
      name: "Existing photo",
      mimeType: "image/png",
      orientationDeg: 23,
      calibration: {
        isCalibrated: true,
        pixelsPerMm: 10,
        realDistanceMm: 10,
        p1: { x: 400, y: 500 },
        p2: { x: 500, y: 500 },
      },
      guides: defaultGuides(width, height),
      capturedAt: now(),
      qualityReviewed: true,
      filters: "none",
    });
    c = selectPhoto(c, id);
  }
  for (const fdi of premolars) {
    delete c.measurements[fdi];
    for (const revision of c.revisions) delete revision.teeth[fdi];
  }
  activeRevision(c).teeth[11].x = 534;
  activeRevision(c).teeth[11].rotation = 17;
  c.treatmentPlan = {
    ...draftPlan(c),
    approval: {
      contextVersion: c.contextVersion,
      revisionId: c.activeRevisionId,
      clinician: "Existing clinician",
      approvedAt: now(),
    },
  };
  return c;
}

describe("second-premolar-to-second-premolar design", () => {
  it("starts with ten ordered teeth and unknown findings at all premolar sites", () => {
    const c = createCase(),
      teeth = activeRevision(c).teeth;
    expect(FDI_VISIBLE_UPPER).toEqual([15, 14, 13, 12, 11, 21, 22, 23, 24, 25]);
    expect(Object.keys(teeth)).toHaveLength(10);
    for (let i = 1; i < FDI_VISIBLE_UPPER.length; i++)
      expect(teeth[FDI_VISIBLE_UPPER[i]].x).toBeGreaterThan(
        teeth[FDI_VISIBLE_UPPER[i - 1]].x,
      );
    for (const fdi of premolars) {
      for (const site of SITES) {
        expect(c.measurements[fdi].sites[site].probingDepth.value).toBeNull();
        expect(c.measurements[fdi].sites[site].boneSounding.confirmed).toBe(
          false,
        );
      }
      teeth[fdi].gingivalShiftMm = 1;
      expect(evaluationsFor(c)[fdi].outcome).toBe("further_assessment_needed");
    }
  });

  it("upgrades each photo without rewriting historical geometry or calibration", () => {
    const c = oldSixToothCase(),
      snapshot = structuredClone(c);
    const upgraded = expandUpperDesign(c);
    expect(upgraded.activeRevisionId).not.toBe(c.activeRevisionId);
    expect(upgraded.revisions.slice(0, c.revisions.length)).toEqual(
      snapshot.revisions,
    );
    for (const fdi of [13, 12, 11, 21, 22, 23])
      expect(activeRevision(upgraded).teeth[fdi]).toEqual(
        activeRevision(snapshot).teeth[fdi],
      );
    expect(upgraded.photos).toEqual(snapshot.photos);
    expect(upgraded.contextVersion).toBe(c.contextVersion + 1);
    expect(upgraded.treatmentPlan?.approval).toBeUndefined();
    expect(
      isStale(upgraded, {
        contextVersion: c.contextVersion,
        revisionId: c.activeRevisionId,
      }),
    ).toBe(true);
    for (const photo of upgraded.photos) {
      const selected = selectPhoto(upgraded, photo.id);
      expect(Object.keys(activeRevision(selected).teeth)).toHaveLength(10);
      for (const fdi of premolars) {
        expect(activeRevision(selected).teeth[fdi].gingivalShiftMm).toBe(0);
        expect(
          upgraded.measurements[fdi].sites.B.boneSounding.value,
        ).toBeNull();
      }
    }
    expect(expandUpperDesign(upgraded)).toBe(upgraded);
    expect(c).toEqual(snapshot);
  });

  it("preserves premolar edits and confirmed findings during a partial upgrade", () => {
    const c = oldSixToothCase();
    const source = createCase();
    activeRevision(c).teeth[14] = {
      ...activeRevision(source).teeth[14],
      x: 225,
      rotation: -12,
      shade: "A2",
    };
    c.measurements[14] = source.measurements[14];
    c.measurements[14].sites.B.ktw = {
      value: 4,
      state: "known",
      unit: "mm",
      source: "clinical",
      method: "Clinical probe",
      recordedAt: now(),
      confirmed: true,
    };
    const upgraded = expandUpperDesign(c);
    expect(activeRevision(upgraded).teeth[14]).toEqual(
      activeRevision(c).teeth[14],
    );
    expect(upgraded.measurements[14]).toEqual(c.measurements[14]);
    expect(upgraded.measurements[25].sites.B.ktw.value).toBeNull();
  });

  it("uses distinct first/second premolar silhouettes rather than canine fallback", () => {
    expect(getToothTypeFromFdi(14)).toBe("first_premolar");
    expect(getToothTypeFromFdi(24)).toBe("first_premolar");
    expect(getToothTypeFromFdi(15)).toBe("second_premolar");
    expect(getToothTypeFromFdi(25)).toBe("second_premolar");
    for (const form of ["oval", "square", "tapered", "rounded"] as const) {
      const outline = TOOTH_TEMPLATES[form].outlinePath;
      expect(outline("first_premolar", true)).not.toBe(outline("canine", true));
      expect(outline("second_premolar", true)).not.toBe(
        outline("first_premolar", true),
      );
    }
  });
});
