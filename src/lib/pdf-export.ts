import jsPDF from "jspdf";
import { Case, ClinicalEvaluationResult, FDI_VISIBLE_UPPER } from "../types";
import { activeRevision } from "./case-model";
export function exportTreatmentPlanPdf(
  c: Case,
  evaluations: Record<number, ClinicalEvaluationResult>,
) {
  const doc = new jsPDF(),
    margin = 16,
    width = 178;
  let y = 20;
  function reserve(mm: number) {
    if (y + mm > 276) {
      doc.addPage();
      y = 20;
    }
  }
  function line(text: string, size = 10, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(
      text.replace(/[^\x20-\x7E\n]/g, "-"),
      width,
    );
    for (const l of lines) {
      if (y > 276) {
        doc.addPage();
        y = 20;
      }
      doc.text(l, margin, y);
      y += size * 0.48;
    }
    y += 3;
  }
  line("SMILE STUDIO | DIGITAL SMILE DESIGN", 17, true);
  line(`Patient: ${c.patientIdentifier} | ${new Date().toLocaleDateString()}`);
  const p = c.treatmentPlan,
    stale =
      p &&
      (p.sourceVersion !== c.contextVersion ||
        p.revisionId !== c.activeRevisionId),
    approved =
      p?.approval && p.approval.contextVersion === c.contextVersion && !stale;
  line(
    `Status: ${approved ? "Clinician approved" : stale ? "Earlier revision - review required" : "Clinical draft"} | Revision ${activeRevision(c).revisionNumber}`,
    10,
    true,
  );
  line(
    "Evaluation prototype. Aesthetic simulation is not a guaranteed postoperative outcome. Proposed margin movements are not surgical removal prescriptions. Clinical approval is separate from aesthetic acceptance.",
  );
  line(
    `Case ${c.id} | Clinical context ${c.contextVersion} | Design ${c.activeRevisionId}`,
    8,
  );
  if (p)
    line(
      `Draft source: context ${p.sourceVersion}, design ${p.revisionId}.`,
      8,
    );
  for (const fdi of FDI_VISIBLE_UPPER) {
    const t = activeRevision(c).teeth[fdi],
      ev = evaluations[fdi];
    const m = c.measurements[fdi],
      site = m.sites[m.evaluationSite];
    const inputs = [
      ["Probing depth", site.probingDepth],
      ["Margin to bone crest", site.boneSounding],
      ["KTW", site.ktw],
      ["Signed margin to CEJ", site.marginToCej],
      ["Planned finish-line depth", site.finishLineDepth],
      ["Clinical crown width", m.currentWidth],
      ["Clinical crown height", m.currentHeight],
    ] as const;
    const inputSummary = inputs
      .map(
        ([label, value]) =>
          `${label}: ${value.state === "known" && value.value !== null ? `${value.value.toFixed(1)} mm (${value.source}, ${value.confirmed ? "confirmed" : "unconfirmed"})` : value.state.replaceAll("_", " ")}`,
      )
      .join("; ");
    const rows = [
      [`FDI ${fdi} | ${t.form} | Shade preference ${t.shade}`, 12, true],
      [
        `Proposed margin movement: ${t.gingivalShiftMm.toFixed(1)} mm (+ apical / - coronal). Incisal change: ${t.incisalExtensionMm.toFixed(1)} mm (+ lengthen / - shorten).`,
        10,
        false,
      ],
      [ev.headline, 10, true],
      [
        `Evaluation site ${m.evaluationSite} | Phenotype ${m.phenotype.replaceAll("_", " ")} | Current restoration ${m.restorativeStatus.replaceAll("_", " ")}`,
        9,
        false,
      ],
      [inputSummary, 9, false],
      ...inputs
        .filter(([, value]) => value.state === "known" && value.value !== null)
        .map(([label, value]) => [
          `${label}: method ${value.method || "not recorded"}; recorded ${value.recordedAt}.`,
          8,
          false,
        ]),
      ...(m.criteria.confirmed
        ? [
            [
              `Criteria: site ${m.criteria.site ?? "unknown"}; minimum finish-line-to-crest ${m.criteria.minimumClearanceMm ?? "unknown"} mm; minimum remaining KTW ${m.criteria.minimumKtwMm ?? "unknown"} mm. Reference: ${m.criteria.reference || "not recorded"}. Confirmed by ${m.criteria.confirmedBy ?? "unknown"} at ${m.criteria.confirmedAt ?? "unknown"}.`,
              8,
              false,
            ],
          ]
        : []),
      ...[...ev.supportingFindings, ...ev.unresolved].map((s) => [
        `- ${s}`,
        9,
        false,
      ]),
    ] as [string, number, boolean][];
    const blockHeight = rows.reduce((total, [text, size, bold]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      return (
        total +
        doc.splitTextToSize(text.replace(/[^\x20-\x7E\n]/g, "-"), width)
          .length *
          size *
          0.48 +
        3
      );
    }, 0);
    reserve(Math.min(blockHeight, 256));
    for (const [text, size, bold] of rows) line(text, size, bold);
  }
  if (p)
    for (const [key, label] of [
      ["goals", "Patient goals"],
      ["periodontalSummary", "Periodontal options and clinician quantities"],
      ["restorativeAlternatives", "Restorative alternatives"],
      ["proposedSequence", "Treatment sequence"],
      ["referralNeeds", "Referrals and milestones"],
      ["unresolvedFindings", "Unresolved findings"],
    ] as const) {
      reserve(22);
      line(label, 12, true);
      line(p[key] || "Not recorded.");
    }
  if (approved)
    line(
      `Approved by ${p!.approval!.clinician} at ${p!.approval!.approvedAt}`,
      10,
      true,
    );
  for (const sim of c.simulations)
    line(
      `Simulation: ${sim.provenance.model} | ${sim.reviewStatus} | Source revision ${sim.provenance.revisionId}`,
      9,
    );
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.text(
      `Clinician-reviewed evaluation prototype | ${i} / ${count}`,
      16,
      289,
    );
  }
  doc.save(
    `smile-plan-${c.patientIdentifier.replace(/[^a-z0-9-]/gi, "_")}.pdf`,
  );
}
