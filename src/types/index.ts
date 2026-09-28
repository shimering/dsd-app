export type ThemePreference = "system" | "light" | "dark";
export type WorkflowStep = "capture" | "assess" | "design" | "preview" | "plan";
export type ToothFormType =
  | "oval"
  | "square"
  | "tapered"
  | "rounded"
  | "custom";
export const FDI_VISIBLE_UPPER = [
  15, 14, 13, 12, 11, 21, 22, 23, 24, 25,
] as const;
export const SITES = ["MB", "B", "DB", "ML", "L", "DL"] as const;
export type Site = (typeof SITES)[number];
export type Point2D = { x: number; y: number };
export type CalibrationData = {
  isCalibrated: boolean;
  p1?: Point2D;
  p2?: Point2D;
  realDistanceMm?: number;
  pixelsPerMm?: number;
  confirmedAt?: string;
  referenceMethod?: string;
  referenceSite?: string;
};
export type GuideKey =
  | "facialMidline"
  | "dentalMidline"
  | "bipupillary"
  | "incisalPlane"
  | "smileArc"
  | "gingivalCurve"
  | "papillae"
  | "canineLines";
export type FacialGuides = Record<GuideKey, Point2D[]>;
export type PhotoType =
  | "rest"
  | "social_smile"
  | "maximum_smile"
  | "profile_rest"
  | "profile_smile"
  | "retracted"
  | "twelve_oclock"
  | "frontal_bite"
  | "right_bite"
  | "left_bite"
  | "upper_occlusal"
  | "lower_occlusal"
  | "shade"
  | "video";
export interface PhotoAsset {
  id: string;
  type: PhotoType;
  mediaKey: string;
  name: string;
  width: number;
  height: number;
  mimeType: string;
  orientationDeg: number;
  calibration: CalibrationData;
  guides: FacialGuides;
  capturedAt: string;
  qualityReviewed: boolean;
  filters: "none" | "unknown";
  isIllustration?: boolean;
  url?: string;
  missing?: boolean;
  archived?: boolean;
  videoSource?: { mediaId: string; frameTimeSec: number };
}
export interface ToothTransform {
  fdi: number;
  form: ToothFormType;
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  rotation: number;
  gingivalShiftMm: number;
  incisalExtensionMm: number;
  shade: string;
  customPath?: string;
}
export type MeasurementState =
  | "known"
  | "not_measured"
  | "not_assessable"
  | "not_applicable";
export interface MeasuredValue {
  value: number | null;
  state: MeasurementState;
  unit: "mm";
  source: "clinical" | "photo_estimate";
  method: string;
  recordedAt: string;
  confirmed: boolean;
}
export type FindingKey =
  | "probingDepth"
  | "boneSounding"
  | "ktw"
  | "marginToCej"
  | "finishLineDepth";
export interface SiteFindings {
  probingDepth: MeasuredValue;
  boneSounding: MeasuredValue;
  ktw: MeasuredValue;
  marginToCej: MeasuredValue;
  finishLineDepth: MeasuredValue;
  bleeding: "unknown" | "yes" | "no";
  suppuration: "unknown" | "yes" | "no";
}
export interface ClinicalCriteria {
  minimumClearanceMm: number | null;
  minimumKtwMm: number | null;
  reference: string;
  confirmed: boolean;
  softTissueFeasible: boolean;
  excisionAssumptionConfirmed: boolean;
  site?: Site;
  confirmedAt?: string;
  confirmedBy?: string;
}
export interface ToothMeasurement {
  fdi: number;
  sites: Record<Site, SiteFindings>;
  evaluationSite: Site;
  phenotype: "unknown" | "thin_scalloped" | "thick_flat" | "thick_scalloped";
  restorativeStatus:
    | "unknown"
    | "natural"
    | "composite"
    | "veneer"
    | "crown"
    | "implant"
    | "wear_facet"
    | "fractured";
  currentWidth: MeasuredValue;
  currentHeight: MeasuredValue;
  criteria: ClinicalCriteria;
  clinicianNotes: string;
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
export interface ToothPreset {
  id: string;
  name: string;
  teeth: Record<number, ToothTransform>;
  createdAt: string;
  sourceWidth?: number;
  sourcePixelsPerMm?: number;
}
export interface DesignRevision {
  id: string;
  revisionNumber: number;
  timestamp: string;
  photoId: string;
  teeth: Record<number, ToothTransform>;
}
export interface ConsentRecord {
  id: string;
  purpose: "cloud_ai";
  recordedAt: string;
  recordedBy: string;
  policyVersion: string;
  revokedAt?: string;
}
export interface AiSuggestion {
  id: string;
  styleName: string;
  toothTemplate: Exclude<ToothFormType, "custom">;
  recommendedShade: string;
  facialProportionRationale: string;
  smileArcAlignment: string;
  lipLineDynamics: string;
  dentitionNotes: string;
}
export interface AiProvenance {
  caseId: string;
  revisionId: string;
  contextVersion: number;
  photoId: string;
  model: string;
  promptVersion: string;
  createdAt: string;
}
export interface SuggestionResult {
  suggestions: AiSuggestion[];
  sequence: string[];
  perioSummary: string;
  provenance: AiProvenance;
}
export interface ConsultationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  provenance?: AiProvenance;
}
export interface SimulationJob {
  id: string;
  provenance: AiProvenance;
  mediaKey: string;
  maskKey: string;
  reviewStatus: "pending_review" | "aesthetic_accepted" | "rejected";
  notes: string;
  url?: string;
  missing?: boolean;
}
export interface TreatmentPlan {
  goals: string;
  periodontalSummary: string;
  restorativeAlternatives: string;
  proposedSequence: string;
  referralNeeds: string;
  unresolvedFindings: string;
  sourceVersion: number;
  revisionId: string;
  approval?: {
    clinician: string;
    approvedAt: string;
    contextVersion: number;
    revisionId: string;
  };
}
export interface Case {
  schemaVersion: 2;
  id: string;
  ownerId?: string;
  patientIdentifier: string;
  patientName: string;
  createdAt: string;
  updatedAt: string;
  contextVersion: number;
  photos: PhotoAsset[];
  activePhotoId: string;
  measurements: Record<number, ToothMeasurement>;
  revisions: DesignRevision[];
  activeRevisionId: string;
  consents: ConsentRecord[];
  simulations: SimulationJob[];
  presets: ToothPreset[];
  consultation: ConsultationMessage[];
  suggestions?: SuggestionResult;
  treatmentPlan?: TreatmentPlan;
  assessment: {
    cause:
      | "unknown"
      | "soft_tissue"
      | "lip"
      | "skeletal"
      | "dentoalveolar"
      | "wear"
      | "mixed";
    confirmed: boolean;
    notes: string;
    clinician: string;
    facialMeasurements?: Record<
      "restDisplay" | "gingivalDisplay" | "lipLength" | "lipMobility",
      MeasuredValue
    >;
  };
  capturePurpose: "preview" | "comprehensive";
  notIndicated: PhotoType[];
  isDemo?: boolean;
}
export type AiOperation = "suggestions" | "consultation" | "simulation";
export interface AiRequest {
  operation: AiOperation;
  caseId: string;
  revisionId: string;
  contextVersion: number;
  photoId: string;
  media: { mimeType: string; data: string };
  designMedia?: { mimeType: string; data: string };
  question?: string;
  history?: { role: string; text: string }[];
}
