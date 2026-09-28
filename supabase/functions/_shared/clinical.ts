import {
  Case,
  ClinicalEvaluationResult,
  MeasuredValue,
  ToothMeasurement,
  ToothTransform,
} from "./clinical-contracts.ts";
export const confirmedClinical = (
  m: MeasuredValue | undefined,
): m is MeasuredValue & { value: number } =>
  !!m &&
  m.state === "known" &&
  m.source === "clinical" &&
  m.unit === "mm" &&
  m.confirmed &&
  m.value !== null &&
  Number.isFinite(m.value) &&
  typeof m.method === "string" &&
  !!m.method.trim();
export function evaluatePeriodontalCandidate(
  m: ToothMeasurement | undefined,
  t: ToothTransform | undefined,
  assessmentConfirmed = false,
): ClinicalEvaluationResult {
  const result: ClinicalEvaluationResult = {
    fdi: t?.fdi ?? m?.fdi ?? 11,
    outcome: "further_assessment_needed",
    headline: "Further assessment needed",
    supportingFindings: [],
    unresolved: [],
    clearanceCriteriaMet: false,
  };
  if (!t) {
    result.unresolved.push("No design scenario recorded.");
    return result;
  }
  const shift = t.gingivalShiftMm;
  if (!Number.isFinite(shift)) {
    result.unresolved.push("Invalid proposed margin movement.");
    return result;
  }
  result.supportingFindings.push(
    `Proposed margin movement: ${shift.toFixed(1)} mm (+ apical; − coronal). This is a design change, not a surgical removal quantity.`,
  );
  if (shift < 0) {
    result.outcome = "coronal_assessment";
    result.headline = "Coronal movement: separate assessment";
    result.unresolved.push(
      "Assess root coverage, tissue support and restorative implications.",
    );
    return result;
  }
  if (shift === 0) {
    result.outcome = "no_apical_change";
    result.headline = "No planned apical margin change";
    result.unresolved.push(
      "Periodontal health, function and restorative suitability still require clinical review.",
    );
    return result;
  }
  if (!m) {
    result.unresolved.push("Clinical measurements have not been recorded.");
    return result;
  }
  const site = m.sites[m.evaluationSite],
    c = m.criteria;
  if (confirmedClinical(site.boneSounding) && site.boneSounding.value >= 0)
    result.remainingBoneClearanceMm = site.boneSounding.value - shift;
  else
    result.unresolved.push(
      "Confirmed same-site margin-to-crest measurement required.",
    );
  if (
    c.excisionAssumptionConfirmed &&
    confirmedClinical(site.ktw) &&
    site.ktw.value >= 0
  )
    result.remainingKtwMm = site.ktw.value - shift;
  else
    result.unresolved.push(
      "Confirm keratinized tissue measurement and the simple-excision assumption before projecting remaining tissue.",
    );
  if (!confirmedClinical(site.probingDepth) || site.probingDepth.value < 0)
    result.unresolved.push("Confirmed nonnegative probing depth required.");
  if (!confirmedClinical(site.marginToCej))
    result.unresolved.push(
      "Confirm CEJ/reference position (+ recession; − margin coronal to CEJ).",
    );
  if (site.bleeding === "unknown" || site.suppuration === "unknown")
    result.unresolved.push(
      "Record same-site bleeding and suppuration findings and review periodontal health.",
    );
  else if (site.bleeding === "yes" || site.suppuration === "yes")
    result.unresolved.push(
      "Review and manage recorded inflammation/pathology before judging elective soft-tissue feasibility.",
    );
  if (
    result.remainingBoneClearanceMm !== undefined &&
    confirmedClinical(site.finishLineDepth) &&
    site.finishLineDepth.value >= 0
  )
    result.finishLineClearanceMm =
      result.remainingBoneClearanceMm - site.finishLineDepth.value;
  else
    result.unresolved.push(
      "Confirm proposed finish-line depth (zero only when clinically intended).",
    );
  if (!assessmentConfirmed)
    result.unresolved.push(
      "Confirm the cause of gingival display and clinical assessment.",
    );
  if (
    !c.confirmed ||
    !c.reference.trim() ||
    c.site !== m.evaluationSite ||
    !c.confirmedAt ||
    !c.confirmedBy?.trim() ||
    c.minimumClearanceMm === null ||
    c.minimumKtwMm === null ||
    !Number.isFinite(c.minimumClearanceMm) ||
    !Number.isFinite(c.minimumKtwMm) ||
    c.minimumClearanceMm <= 0 ||
    c.minimumKtwMm < 0
  )
    result.unresolved.push(
      "Confirm individualized clearance/tissue criteria and their reference.",
    );
  if (m.phenotype === "unknown")
    result.unresolved.push("Periodontal phenotype remains unknown.");
  if (m.restorativeStatus === "unknown")
    result.unresolved.push("Current restorative status remains unknown.");
  if (result.remainingBoneClearanceMm !== undefined)
    result.supportingFindings.push(
      `Projected margin-to-crest distance at ${m.evaluationSite}: ${result.remainingBoneClearanceMm.toFixed(1)} mm, assuming unchanged crest and comparable direction.`,
    );
  if (result.remainingKtwMm !== undefined)
    result.supportingFindings.push(
      `Projected KTW under the confirmed excision assumption: ${result.remainingKtwMm.toFixed(1)} mm. KTW is not attached gingiva.`,
    );
  if (result.unresolved.length) return result;
  const clearance = result.finishLineClearanceMm!;
  result.clearanceShortfallMm = Math.max(0, c.minimumClearanceMm! - clearance);
  result.clearanceCriteriaMet =
    clearance >= c.minimumClearanceMm! &&
    result.remainingKtwMm! >= c.minimumKtwMm!;
  if (!result.clearanceCriteriaMet) {
    result.outcome = "crown_lengthening_assessment";
    result.headline = "Discuss periodontal / crown-lengthening assessment";
    result.supportingFindings.push(
      `Clearance shortfall against the recorded criterion: ${result.clearanceShortfallMm.toFixed(1)} mm. This is not a prescribed bone-removal amount.`,
      "Review tissue management, adjacent sites, supporting anatomy and restorative alternatives.",
    );
  } else if (c.softTissueFeasible) {
    result.outcome = "candidate_gingivectomy";
    result.headline = "Clinician-confirmed gingivectomy option";
    result.supportingFindings.push(
      "Recorded scenario meets the selected numerical criteria. Procedure selection and final quantities require an approved clinical plan.",
    );
  } else
    result.unresolved.push(
      "Confirm soft-tissue-only feasibility or obtain further periodontal assessment.",
    );
  return result;
}
export function evaluationsFor(
  c: Case,
): Record<number, ClinicalEvaluationResult> {
  const teeth =
    c.revisions.find((r) => r.id === c.activeRevisionId)?.teeth ?? {};
  return Object.fromEntries(
    Object.values(teeth).map((t) => [
      t.fdi,
      evaluatePeriodontalCandidate(
        c.measurements[t.fdi],
        t,
        c.assessment.confirmed && c.assessment.cause !== "unknown",
      ),
    ]),
  );
}
export function calculateToothProportion(width: number, height: number) {
  return Number.isFinite(width) && height > 0
    ? Math.round((width / height) * 1000) / 10
    : null;
}
