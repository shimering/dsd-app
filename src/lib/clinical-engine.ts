import { ToothMeasurement, ClinicalEvaluationResult, ToothTransform } from '../types';

/**
 * Deterministic Clinical Planning Engine
 * Grounded in European Federation of Periodontology (EFP) clinical guidelines
 * for crown lengthening and aesthetic periodontal surgical margins.
 */

// Minimum biological clearance (Supracrestal Tissue Attachment - STA) required between
// alveolar bone crest and the proposed restorative/gingival margin.
export const MIN_BIOLOGIC_WIDTH_MM = 3.0; // 2mm junctional/connective tissue + 1mm sulcus

// Minimum keratinized tissue width (KTW) that MUST remain after any surgical margin alteration
export const MIN_POSTOP_KTW_MM = 2.0;
export const OPTIMAL_POSTOP_KTW_MM = 3.0;

/**
 * Evaluates the proposed gingival margin movement against bone sounding and keratinized tissue.
 * Calculates clearance deterministically with zero AI hallucination.
 */
export function evaluatePeriodontalCandidate(
  measurement: ToothMeasurement | undefined,
  transform: ToothTransform | undefined,
  isCalibrated: boolean
): ClinicalEvaluationResult {
  const fdi = measurement?.fdi || transform?.fdi || 11;

  // 1. Uncalibrated State Check
  if (!isCalibrated) {
    return {
      fdi,
      outcome: 'further_assessment_needed',
      headline: 'Further Assessment Needed (Photograph Uncalibrated)',
      supportingFindings: [
        'Photographic calibration is required before surgical millimeter clearances can be computed.',
        'Current display shows proportional tooth dimensions (%) rather than true clinical millimeters.'
      ],
      supracrestalAttachmentSafe: false,
      clearanceCriteriaMet: false,
      requiresClinicianConfirmation: true
    };
  }

  // 2. Missing Core Clinical Data Check
  if (!measurement) {
    return {
      fdi,
      outcome: 'further_assessment_needed',
      headline: 'Further Assessment Needed (No Measurements Recorded)',
      supportingFindings: [
        'Probing depth, bone sounding, and keratinized tissue width (KTW) have not been entered.',
        'Surgical candidate evaluation blocked until clinical probing is documented.'
      ],
      supracrestalAttachmentSafe: false,
      clearanceCriteriaMet: false,
      requiresClinicianConfirmation: true
    };
  }

  const deltaGM = transform?.gingivalShiftMm || 0; // Positive = apical movement (gingival reduction)

  // If no apical shift is planned (only incisal extension or restorative change)
  if (deltaGM <= 0.05) {
    return {
      fdi,
      outcome: 'restorative_only',
      headline: 'Restorative / Non-Surgical Design Only',
      supportingFindings: [
        'No apical gingival margin alteration is planned.',
        'Proposed design relies entirely on incisal edge addition or restorative veneer placement.',
        'Periodontal architecture remains unaltered.'
      ],
      supracrestalAttachmentSafe: true,
      clearanceCriteriaMet: true,
      requiresClinicianConfirmation: false
    };
  }

  // Check for missing bone sounding or KTW
  const hasBoneSounding = typeof measurement.boneSoundingMm === 'number' && !isNaN(measurement.boneSoundingMm);
  const hasKtw = typeof measurement.keratinizedTissueWidthMm === 'number' && !isNaN(measurement.keratinizedTissueWidthMm);

  if (!hasBoneSounding || !hasKtw) {
    const missing: string[] = [];
    if (!hasBoneSounding) missing.push('Bone sounding (distance from FGM to alveolar bone crest)');
    if (!hasKtw) missing.push('Keratinized tissue width (KTW)');

    return {
      fdi,
      outcome: 'further_assessment_needed',
      headline: 'Further Assessment Needed (Missing Biological Findings)',
      supportingFindings: [
        `Missing: ${missing.join(', ')}.`,
        `Planned apical gingival displacement is +${deltaGM.toFixed(1)} mm.`,
        'Cannot verify supracrestal tissue attachment or risk of mucogingival defect without complete probing data.'
      ],
      supracrestalAttachmentSafe: false,
      clearanceCriteriaMet: false,
      requiresClinicianConfirmation: true
    };
  }

  // Biological clearance calculations
  const boneSounding = measurement.boneSoundingMm!;
  const currentKtw = measurement.keratinizedTissueWidthMm!;
  
  // Remaining distance from proposed margin to bone crest
  const remainingBoneClearance = boneSounding - deltaGM;
  
  // Remaining keratinized tissue after excision
  const remainingKtw = currentKtw - deltaGM;

  const findings: string[] = [
    `Proposed apical margin shift: +${deltaGM.toFixed(1)} mm.`,
    `Baseline bone sounding: ${boneSounding.toFixed(1)} mm | Remaining bone clearance: ${remainingBoneClearance.toFixed(1)} mm.`,
    `Baseline KTW: ${currentKtw.toFixed(1)} mm | Remaining KTW: ${remainingKtw.toFixed(1)} mm.`
  ];

  // 3. Evaluation: Keratinized Tissue Insufficiency
  if (remainingKtw < MIN_POSTOP_KTW_MM) {
    findings.push(
      `CRITICAL WARNING: Planned excision leaves < ${MIN_POSTOP_KTW_MM} mm of keratinized gingiva. High risk of progressive gingival recession or mucogingival defect.`
    );
    return {
      fdi,
      outcome: 'referral_periodontist',
      headline: 'Contraindicated: Insufficient Keratinized Tissue (Referral / Grafting Indicated)',
      supportingFindings: findings,
      remainingBoneClearanceMm: remainingBoneClearance,
      remainingKtwMm: remainingKtw,
      supracrestalAttachmentSafe: false,
      clearanceCriteriaMet: false,
      requiresClinicianConfirmation: true
    };
  }

  // 4. Evaluation: Simple Gingivectomy vs Flap-based Crown Lengthening
  if (remainingBoneClearance >= MIN_BIOLOGIC_WIDTH_MM) {
    // Alveolar crest is >= 3mm away from proposed margin -> Simple Gingivectomy is biologically viable
    findings.push(
      `Biologic width preserved: Alveolar bone crest is ${remainingBoneClearance.toFixed(1)} mm apical to planned margin (&ge; 3.0 mm standard).`,
      `Keratinized zone adequate (${remainingKtw.toFixed(1)} mm remaining).`,
      'Candidate for simple soft-tissue excision (gingivectomy / diode laser) without ostectomy.'
    );

    return {
      fdi,
      outcome: 'candidate_gingivectomy',
      headline: 'Candidate: Simple Soft-Tissue Gingivectomy',
      supportingFindings: findings,
      remainingBoneClearanceMm: remainingBoneClearance,
      remainingKtwMm: remainingKtw,
      supracrestalAttachmentSafe: true,
      clearanceCriteriaMet: true,
      requiresClinicianConfirmation: true
    };
  } else {
    // Bone crest is < 3mm -> Flap-based Crown Lengthening with Osseous Resection (Ostectomy) is REQUIRED
    const ostectomyAmount = (MIN_BIOLOGIC_WIDTH_MM - remainingBoneClearance).toFixed(1);
    findings.push(
      `Supracrestal tissue violation: Remaining bone distance (${remainingBoneClearance.toFixed(1)} mm) is < 3.0 mm biological requirement.`,
      `Simple gingivectomy alone would result in high biological tissue rebound.`,
      `Requires full-thickness flap reflection and osseous resection (approx. ${ostectomyAmount} mm of crestal bone removal) to re-establish supracrestal attachment.`
    );

    if (measurement.phenotype === 'thin_scalloped') {
      findings.push('Caution: Thin-scalloped biotype has elevated risk of post-surgical interdental papillary loss and black triangles.');
    }

    return {
      fdi,
      outcome: 'candidate_crown_lengthening',
      headline: 'Candidate: Flap-based Crown Lengthening with Osseous Resection',
      supportingFindings: findings,
      remainingBoneClearanceMm: remainingBoneClearance,
      remainingKtwMm: remainingKtw,
      supracrestalAttachmentSafe: false, // Not safe without ostectomy
      clearanceCriteriaMet: true,
      requiresClinicianConfirmation: true
    };
  }
}

/**
 * Calculates central incisor proportion (Width-to-Height ratio)
 * Ideal aesthetic range according to Lombardi, Levin, and DSD protocol: 75% - 85%
 */
export function calculateToothProportion(widthMm: number, heightMm: number): {
  ratioPercent: number;
  isHarmonious: boolean;
  statusText: string;
} {
  if (!heightMm || heightMm <= 0) {
    return { ratioPercent: 0, isHarmonious: false, statusText: 'Invalid height' };
  }
  const ratio = (widthMm / heightMm) * 100;
  const isHarmonious = ratio >= 75 && ratio <= 85;
  let statusText = 'Harmonious (75–85%)';
  if (ratio < 75) statusText = 'Too Narrow (< 75%)';
  if (ratio > 85) statusText = 'Too Square / Broad (> 85%)';

  return {
    ratioPercent: Math.round(ratio * 10) / 10,
    isHarmonious,
    statusText
  };
}
