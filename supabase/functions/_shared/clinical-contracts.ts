export interface MeasuredValue {
  value: number | null;
  state: string;
  source: string;
  confirmed: boolean;
  method: string;
  unit: string;
}
type SiteFindings = Record<
  "probingDepth" | "boneSounding" | "ktw" | "marginToCej" | "finishLineDepth",
  MeasuredValue
> & { bleeding: string; suppuration: string };
export interface ToothMeasurement {
  fdi: number;
  evaluationSite: string;
  sites: Record<string, SiteFindings>;
  phenotype: string;
  restorativeStatus: string;
  criteria: {
    minimumClearanceMm: number | null;
    minimumKtwMm: number | null;
    reference: string;
    confirmed: boolean;
    softTissueFeasible: boolean;
    excisionAssumptionConfirmed: boolean;
    site?: string;
    confirmedAt?: string;
    confirmedBy?: string;
  };
}
export interface ToothTransform {
  fdi: number;
  gingivalShiftMm: number;
}
export interface ClinicalEvaluationResult {
  fdi: number;
  outcome:
    | "further_assessment_needed"
    | "no_apical_change"
    | "coronal_assessment"
    | "candidate_gingivectomy"
    | "crown_lengthening_assessment";
  headline: string;
  supportingFindings: string[];
  unresolved: string[];
  remainingBoneClearanceMm?: number;
  finishLineClearanceMm?: number;
  remainingKtwMm?: number;
  clearanceShortfallMm?: number;
  clearanceCriteriaMet: boolean;
}
export interface Case {
  activeRevisionId: string;
  revisions: { id: string; teeth: Record<number, ToothTransform> }[];
  measurements: Record<number, ToothMeasurement>;
  assessment: { confirmed: boolean; cause: string };
}
