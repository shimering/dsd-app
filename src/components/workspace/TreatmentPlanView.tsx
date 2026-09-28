import { useState } from "react";
import { CheckCircle2, Download, FileText, RefreshCw } from "lucide-react";
import { Case, FDI_VISIBLE_UPPER, TreatmentPlan } from "../../types";
import {
  activePhoto,
  activeRevision,
  draftPlan,
  now,
} from "../../lib/case-model";
import { evaluationsFor } from "../../lib/clinical-engine";
import { Notice, errorText } from "../ui";
export function TreatmentPlanView({
  currentCase,
  onChange,
}: {
  currentCase: Case;
  onChange: (c: Case) => void;
}) {
  const [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    plan = currentCase.treatmentPlan,
    teeth = activeRevision(currentCase).teeth,
    photo = activePhoto(currentCase),
    evaluations = evaluationsFor(currentCase),
    stale =
      !!plan &&
      (plan.sourceVersion !== currentCase.contextVersion ||
        plan.revisionId !== currentCase.activeRevisionId),
    approved =
      !!plan?.approval &&
      plan.approval.contextVersion === currentCase.contextVersion &&
      !stale;
  const unresolved = Object.values(evaluations).some(
    (e) =>
      e.unresolved.length > 0 ||
      e.outcome === "further_assessment_needed" ||
      e.outcome === "crown_lengthening_assessment" ||
      e.outcome === "coronal_assessment",
  );
  function edit(key: keyof TreatmentPlan, value: string) {
    if (!plan) return;
    onChange({
      ...currentCase,
      treatmentPlan: { ...plan, [key]: value, approval: undefined },
    });
    setReviewed(false);
  }
  return (
    <div className="page-scroll">
      <div className="page-content stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">05 / Clinician review</span>
            <h1>A plan grounded in the findings.</h1>
            <p>
              Document options, unresolved assessments and the sequence agreed
              by the treating clinicians.
            </p>
          </div>
          <div className="row">
            <span className={`badge ${approved ? "success" : "warning"}`}>
              {approved
                ? "Clinician approved"
                : stale
                  ? "Earlier revision"
                  : "Clinical draft"}
            </span>
            <button
              className="btn"
              onClick={async () => {
                try {
                  const { exportTreatmentPlanPdf } = await import(
                    "../../lib/pdf-export"
                  );
                  exportTreatmentPlanPdf(currentCase, evaluations);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Notice tone="warning">
          Proposed gingival shifts are design movements. Clearance shortfalls
          are assessment information; they are not prescribed amounts of
          gingivectomy or bone removal.
        </Notice>
        <div className="plan-teeth">
          {FDI_VISIBLE_UPPER.map((fdi) => {
            const t = teeth[fdi],
              e = evaluations[fdi],
              ppm = photo?.calibration.isCalibrated
                ? photo.calibration.pixelsPerMm
                : undefined;
            return (
              <article className="panel plan-tooth" key={fdi}>
                <div className="row spread">
                  <h3>FDI {fdi}</h3>
                  <span className="badge">
                    {t.form} · {t.shade}
                  </span>
                </div>
                <dl>
                  <dt>Proposed margin movement</dt>
                  <dd>
                    {t.gingivalShiftMm > 0 ? "+" : ""}
                    {t.gingivalShiftMm.toFixed(1)} mm
                  </dd>
                  <dt>Proposed incisal change</dt>
                  <dd>
                    {t.incisalExtensionMm > 0 ? "+" : ""}
                    {t.incisalExtensionMm.toFixed(1)} mm
                  </dd>
                  <dt>{ppm ? "Projected image dimensions" : "Relative W/H"}</dt>
                  <dd>
                    {ppm
                      ? `${(t.widthPx / ppm).toFixed(1)} × ${(t.heightPx / ppm).toFixed(1)} mm`
                      : `${Math.round((t.widthPx / t.heightPx) * 100)}%`}
                  </dd>
                  <dt>Projected margin-to-crest</dt>
                  <dd>
                    {e.remainingBoneClearanceMm === undefined
                      ? "Unknown"
                      : `${e.remainingBoneClearanceMm.toFixed(1)} mm`}
                  </dd>
                  <dt>Projected KTW</dt>
                  <dd>
                    {e.remainingKtwMm === undefined
                      ? "Unknown"
                      : `${e.remainingKtwMm.toFixed(1)} mm`}
                  </dd>
                </dl>
                <strong style={{ fontSize: 12, color: "var(--warning)" }}>
                  {e.headline}
                </strong>
                <ul>
                  {e.unresolved.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        {!plan ? (
          <div className="panel empty-state">
            <FileText size={34} />
            <h2>Create an editable treatment draft</h2>
            <p>
              Add patient goals, restorative alternatives, referrals and
              clinician-controlled milestones.
            </p>
            <button
              className="btn primary"
              onClick={() =>
                onChange({
                  ...currentCase,
                  treatmentPlan: draftPlan(currentCase),
                })
              }
            >
              Create treatment draft
            </button>
          </div>
        ) : (
          <>
            {stale && (
              <Notice tone="warning">
                The findings or design changed after this draft. Review the
                content and update its source revision before approving.
                <button
                  className="btn"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    onChange({
                      ...currentCase,
                      treatmentPlan: {
                        ...plan,
                        sourceVersion: currentCase.contextVersion,
                        revisionId: currentCase.activeRevisionId,
                        approval: undefined,
                      },
                    });
                    setReviewed(false);
                  }}
                >
                  <RefreshCw size={16} />
                  Mark draft reviewed against current revision
                </button>
              </Notice>
            )}
            <div className="plan-grid">
              {(
                [
                  ["goals", "Patient goals"],
                  [
                    "periodontalSummary",
                    "Periodontal options & clinical quantities",
                  ],
                  ["restorativeAlternatives", "Restorative alternatives"],
                  ["proposedSequence", "Proposed treatment sequence"],
                  ["referralNeeds", "Referrals & reassessment milestones"],
                  ["unresolvedFindings", "Unresolved findings & conditions"],
                ] as [keyof TreatmentPlan, string][]
              ).map(([key, label]) => (
                <label className="panel content-card field" key={key}>
                  <span>{label}</span>
                  <textarea
                    rows={5}
                    value={String(plan[key] ?? "")}
                    onChange={(e) => edit(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="panel content-card stack">
              <h2>Clinical approval</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Reviewing clinician:{" "}
                {currentCase.assessment.clinician ||
                  "Record the clinician in Assess"}
                . Approval records a specific plan revision and is cleared when
                clinical inputs or the design change.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>
                  I reviewed clinical findings, function, indicated records,
                  treatment alternatives and any external surgical/mock-up
                  assessment. The plan documents referral and reassessment
                  conditions for unresolved findings. Quantities are my clinical
                  decisions.
                </span>
              </label>
              {unresolved && !plan.unresolvedFindings.trim() && (
                <Notice tone="warning">
                  Document the unresolved findings and assessment/referral
                  conditions before approval.
                </Notice>
              )}
              <button
                className="btn primary"
                disabled={
                  !reviewed ||
                  stale ||
                  !currentCase.assessment.confirmed ||
                  !currentCase.assessment.clinician.trim() ||
                  (unresolved && !plan.unresolvedFindings.trim()) ||
                  !plan.goals.trim() ||
                  !plan.proposedSequence.trim() ||
                  currentCase.isDemo
                }
                onClick={() =>
                  onChange({
                    ...currentCase,
                    treatmentPlan: {
                      ...plan,
                      approval: {
                        clinician: currentCase.assessment.clinician,
                        approvedAt: now(),
                        contextVersion: currentCase.contextVersion,
                        revisionId: currentCase.activeRevisionId,
                      },
                    },
                  })
                }
              >
                <CheckCircle2 size={17} />
                Approve clinical plan revision
              </button>
              {approved && (
                <span className="badge success">
                  Approved by {plan.approval?.clinician} ·{" "}
                  {new Date(plan.approval!.approvedAt).toLocaleString()}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
