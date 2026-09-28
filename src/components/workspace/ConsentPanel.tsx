import { Case } from "../../types";
import { hasConsent, now, uid } from "../../lib/case-model";
import { Notice } from "../ui";
import { useState } from "react";
export function ConsentPanel({
  currentCase,
  onChange,
}: {
  currentCase: Case;
  onChange: (c: Case) => void;
}) {
  const [checked, setChecked] = useState(false),
    [clinician, setClinician] = useState(currentCase.assessment.clinician);
  if (hasConsent(currentCase))
    return (
      <div className="row spread">
        <span className="badge success">Cloud AI consent recorded</span>
        <button
          className="btn subtle"
          onClick={() =>
            onChange({
              ...currentCase,
              consents: currentCase.consents.map((r) =>
                r.revokedAt ? r : { ...r, revokedAt: now() },
              ),
            })
          }
        >
          Revoke for future requests
        </button>
      </div>
    );
  return (
    <div className="panel content-card stack">
      <Notice tone="warning">
        AI requests transfer the selected photo and clinical context to Google's
        Gemini service. Originals remain stored locally; the transfer is cloud
        processing. Record patient consent before requesting suggestions,
        consultation or a preview.
      </Notice>
      <label className="field">
        <span>Clinician recording consent</span>
        <input
          value={clinician}
          onChange={(e) => setClinician(e.target.value)}
          placeholder="Clinician name"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>
          I have documented the patient's consent for this cloud AI processing.
        </span>
      </label>
      <button
        className="btn primary"
        disabled={!checked || !clinician.trim()}
        onClick={() =>
          onChange({
            ...currentCase,
            consents: [
              ...currentCase.consents,
              {
                id: uid(),
                purpose: "cloud_ai",
                recordedAt: now(),
                recordedBy: clinician.trim(),
                policyVersion: "cloud-ai-v1",
              },
            ],
          })
        }
      >
        Record patient consent
      </button>
    </div>
  );
}
