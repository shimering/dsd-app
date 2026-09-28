import jsPDF from 'jspdf';
import { Case, ClinicalEvaluationResult } from '../types';

export function exportTreatmentPlanPdf(
  activeCase: Case,
  evaluations: Record<number, ClinicalEvaluationResult>,
  simulationImageBase64?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header Bar
  doc.setFillColor(11, 15, 25); // Dark clinical
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(6, 182, 212); // Cyan
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL SMILE DESIGN — TREATMENT PLAN REPORT', 14, 12);

  doc.setTextColor(248, 250, 252);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient ID: ${activeCase.patientIdentifier}  |  Date: ${new Date().toLocaleDateString()}  |  Status: ${activeCase.status.toUpperCase()}`, 14, 20);

  y = 36;

  // Section 1: Clinical Goals & Design Summary
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Aesthetic Goals & Tooth Blueprint', 14, y);
  y += 6;

  const activeRev = activeCase.revisions.find(r => r.id === activeCase.activeRevisionId) || activeCase.revisions[0];
  const centralTooth = activeRev?.teeth[11];
  const formName = (centralTooth?.form || 'Rounded').toUpperCase();
  const shade = centralTooth?.shade || 'A1';
  const isCalibrated = activeCase.photos.smile?.calibration?.isCalibrated || false;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Selected Tooth Form: ${formName}  |  Target Shade: ${shade}`, 16, y);
  y += 5;
  doc.text(`• Calibration Status: ${isCalibrated ? `Calibrated (${activeCase.photos.smile?.calibration?.pixelsPerMm?.toFixed(1)} px/mm)` : 'Proportional (% only - uncalibrated)'}`, 16, y);
  y += 8;

  // Section 2: Per-Tooth FDI Measurement & Periodontal Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Visible Maxillary Arch (FDI 13–23) Periodontal & Margin Analysis', 14, y);
  y += 6;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Tooth', 16, y + 5);
  doc.text('Form', 30, y + 5);
  doc.text('&Delta;GM (Gingival)', 48, y + 5);
  doc.text('&Delta;Inc (Extension)', 75, y + 5);
  doc.text('Bone Clearance', 105, y + 5);
  doc.text('KTW Remaining', 135, y + 5);
  doc.text('EFP Candidate Status', 165, y + 5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  const teethList = [13, 12, 11, 21, 22, 23];
  for (const fdi of teethList) {
    const t = activeRev?.teeth[fdi];
    const m = activeCase.measurements[fdi];
    const ev = evaluations[fdi];

    const deltaGm = t?.gingivalShiftMm ? `+${t.gingivalShiftMm.toFixed(1)} mm` : '0.0 mm';
    const deltaInc = t?.incisalExtensionMm ? `+${t.incisalExtensionMm.toFixed(1)} mm` : '0.0 mm';
    const bone = ev?.remainingBoneClearanceMm !== undefined ? `${ev.remainingBoneClearanceMm.toFixed(1)} mm` : '—';
    const ktw = ev?.remainingKtwMm !== undefined ? `${ev.remainingKtwMm.toFixed(1)} mm` : '—';
    
    let statusLabel = 'Assessment Needed';
    if (ev?.outcome === 'candidate_gingivectomy') statusLabel = 'Gingivectomy';
    if (ev?.outcome === 'candidate_crown_lengthening') statusLabel = 'Crown Lengthening';
    if (ev?.outcome === 'restorative_only') statusLabel = 'Restorative Only';
    if (ev?.outcome === 'referral_periodontist') statusLabel = 'Perio Referral';

    doc.text(`FDI ${fdi}`, 16, y);
    doc.text(t?.form || '—', 30, y);
    doc.text(deltaGm, 48, y);
    doc.text(deltaInc, 75, y);
    doc.text(bone, 105, y);
    doc.text(ktw, 135, y);
    doc.text(statusLabel, 165, y);

    y += 6;
  }

  y += 6;

  // Section 3: Recommended Clinical Treatment Sequence
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Proposed Clinical Execution Sequence', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const sequenceSteps = activeCase.treatmentPlan?.proposedSequence || [
    '1. Diagnostic review and patient consent verification.',
    '2. Calibrated digital smile design alignment with facial midline and lower lip curve.',
    '3. Hard & soft tissue periodontal intervention as validated by bone sounding.',
    '4. Periodontal tissue healing period (minimum 8–12 weeks prior to final prep).',
    '5. Conservative minimally invasive tooth preparation and definitive restorations.'
  ];

  for (const step of sequenceSteps) {
    doc.text(step, 16, y);
    y += 5;
  }

  y += 6;

  // Regulatory Disclaimer & Dentist Signature Box
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, y, pageWidth - 28, 24);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text('MANDATORY CLINICAL NOTICE:', 16, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Simulated treatment outcomes and digital overlays are diagnostic visual blueprints for patient communication.', 16, y + 10);
  doc.text('They do not constitute automated surgical or prosthetic prescriptions. The licensed clinician remains strictly', 16, y + 14);
  doc.text('responsible for independent intraoral validation of biological width, bone architecture, and occlusal dynamics.', 16, y + 18);

  y += 32;

  // Signature lines
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.line(16, y + 10, 80, y + 10);
  doc.text('Treating Clinician Signature', 16, y + 15);

  doc.line(120, y + 10, 184, y + 10);
  doc.text('Patient Confirmation & Date', 120, y + 15);

  // Save / Download PDF
  doc.save(`DSD_Treatment_Plan_${activeCase.patientIdentifier}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
