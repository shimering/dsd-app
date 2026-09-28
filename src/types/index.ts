// Digital Smile Design Domain Types

export type ToothFormType = 'oval' | 'square' | 'tapered' | 'rounded' | 'custom';

export type PeriodontalPhenotype = 'thin_scalloped' | 'thick_flat' | 'thick_scalloped';

export type RestorativeStatus = 'natural' | 'composite' | 'veneer' | 'crown' | 'implant' | 'wear_facet' | 'fractured';

export type CaseStatus = 'draft' | 'designed' | 'simulated' | 'approved';

export type PhotoType = 'frontal_face' | 'smile' | 'retracted';

export const FDI_VISIBLE_UPPER: number[] = [13, 12, 11, 21, 22, 23];

export interface Point2D {
  x: number;
  y: number;
}

export interface CalibrationData {
  isCalibrated: boolean;
  p1?: Point2D;
  p2?: Point2D;
  realDistanceMm?: number;
  pixelsPerMm?: number; // null when uncalibrated -> displays % proportions
}

export interface FacialGuides {
  midline: { p1: Point2D; p2: Point2D };       // Facial vertical (glabella to philtrum)
  bipupillary: { p1: Point2D; p2: Point2D };   // Horizontal plane reference
  smileArc: Point2D[];                          // Lower lip curvature curve points
  incisalPlane: { p1: Point2D; p2: Point2D };  // Current or planned incisal plane
}

export interface ToothTransform {
  fdi: number;
  form: ToothFormType;
  x: number; // canvas percent [0..100]
  y: number; // canvas percent [0..100]
  width: number;  // mm if calibrated, or relative units
  height: number; // mm if calibrated, or relative units
  rotation: number; // degrees
  gingivalShiftMm: number; // planned apical (+) or coronal (-) movement
  incisalExtensionMm: number; // planned incisal lengthening (+) or reduction (-)
  shade: string;
}

export interface ToothMeasurement {
  fdi: number;
  currentWidthMm?: number;
  currentHeightMm?: number;
  probingDepthMm?: number;
  boneSoundingMm?: number; // Free gingival margin to alveolar bone crest
  keratinizedTissueWidthMm?: number; // KTW
  cejLocationMm?: number; // FGM to CEJ
  phenotype: PeriodontalPhenotype;
  restorativeStatus: RestorativeStatus;
  clinicianNotes?: string;
}

export type PeriodontalOutcome = 
  | 'further_assessment_needed'
  | 'candidate_gingivectomy'
  | 'candidate_crown_lengthening'
  | 'referral_periodontist'
  | 'orthodontic_consult_needed'
  | 'restorative_only';

export interface ClinicalEvaluationResult {
  fdi: number;
  outcome: PeriodontalOutcome;
  headline: string;
  supportingFindings: string[];
  remainingBoneClearanceMm?: number;
  remainingKtwMm?: number;
  supracrestalAttachmentSafe: boolean;
  clearanceCriteriaMet: boolean;
  requiresClinicianConfirmation: boolean;
  clinicianOverrideExplanation?: string;
}

export interface ToothPreset {
  id: string;
  name: string;
  form: ToothFormType;
  shade: string;
  proportions: {
    widthHeightRatio: number;
    lateralRatioToCentral: number; // Golden proportion is ~0.618 to 0.75
    canineRatioToCentral: number;
  };
}

export interface AiSuggestion {
  id: string;
  styleName: string;
  toothTemplate: ToothFormType;
  recommendedShade: string;
  facialProportionRationale: string;
  smileArcAlignment: string;
  lipLineDynamics: string;
  dentitionNotes: string;
}

export interface SimulationJob {
  id: string;
  caseId: string;
  revisionId: string;
  createdAt: string;
  modelUsed: string;
  consentRecorded: boolean;
  reviewStatus: 'pending_review' | 'dentist_accepted' | 'dentist_rejected';
  rawOutputUrl?: string;
  compositeOutputUrl: string; // 100% original outside intraoral mask
  watermarkLabel: string; // "Simulated treatment outcome — Requires dentist review"
  dentistNotes?: string;
}

export interface DesignRevision {
  id: string;
  revisionNumber: number;
  timestamp: string;
  teeth: Record<number, ToothTransform>;
  isDentistApproved: boolean;
}

export interface TreatmentPlan {
  id: string;
  caseId: string;
  revisionId: string;
  goals: string[];
  perToothChanges: Array<{
    fdi: number;
    widthDelta: number;
    heightDelta: number;
    gingivalShift: number;
    incisalExtension: number;
    periodontalPlan: string;
    restorativePlan: string;
  }>;
  periodontalSummary: string;
  restorativeAlternatives: string[];
  proposedSequence: string[];
  unresolvedFindings: string[];
  referralNeeds: string[];
  aiClinicalRationale?: string;
  isOutdated: boolean;
  lastUpdated: string;
}

export interface Case {
  id: string;
  patientIdentifier: string;
  patientName?: string;
  dentistId: string;
  createdAt: string;
  updatedAt: string;
  status: CaseStatus;
  notes?: string;
  photos: {
    frontal_face?: { url: string; orientationDeg: number; calibration: CalibrationData };
    smile?: { url: string; orientationDeg: number; calibration: CalibrationData };
    retracted?: { url: string; orientationDeg: number; calibration: CalibrationData };
  };
  activePhotoType: PhotoType;
  guides: FacialGuides;
  measurements: Record<number, ToothMeasurement>;
  revisions: DesignRevision[];
  activeRevisionId: string;
  simulations: SimulationJob[];
  treatmentPlan?: TreatmentPlan;
  consentGranted: boolean;
}
