import {
  Case,
  FindingKey,
  MeasuredValue,
  MeasurementState,
  SITES,
  Site,
  ToothMeasurement,
} from "../../types";
import { activeRevision, blankValue, now } from "../../lib/case-model";
import {
  evaluatePeriodontalCandidate,
  confirmedClinical,
} from "../../lib/clinical-engine";
import { Notice, NumberField } from "../ui";
import { ToothPicker } from "./ToothCustomizer";
function Measurement({
  label,
  value,
  onChange,
  signed = false,
}: {
  label: string;
  value: MeasuredValue;
  onChange: (v: MeasuredValue) => void;
  signed?: boolean;
}) {
  const change = (patch: Partial<MeasuredValue>) =>
    onChange({
      ...value,
      ...patch,
      recordedAt: now(),
      confirmed: patch.confirmed ?? false,
    });
  return (
    <div className="stack" style={{ gap: 9 }}>
      <div className="two-cols">
        <NumberField
          label={label}
          value={value.value}
          signed={signed}
          min={signed ? undefined : 0}
          onChange={(v) =>
            change({ value: v, state: v === null ? "not_measured" : "known" })
          }
        />
        <label className="field">
          <span>Value status</span>
          <select
            value={value.state}
            onChange={(e) =>
              change({
                state: e.target.value as MeasurementState,
                value: e.target.value === "known" ? value.value : null,
              })
            }
          >
            <option value="not_measured">Not measured</option>
            <option value="known">Recorded</option>
            <option value="not_assessable">Not assessable</option>
            <option value="not_applicable">Not applicable</option>
          </select>
        </label>
      </div>
      <details>
        <summary
          style={{
            fontSize: 12,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          Source & confirmation
        </summary>
        <div className="stack" style={{ gap: 9, marginTop: 10 }}>
          <label className="field">
            <span>Source</span>
            <select
              value={value.source}
              onChange={(e) =>
                change({ source: e.target.value as MeasuredValue["source"] })
              }
            >
              <option value="clinical">Clinical measurement</option>
              <option value="photo_estimate">Photo estimate</option>
            </select>
          </label>
          <label className="field">
            <span>Method / reference</span>
            <input
              value={value.method}
              onChange={(e) => change({ method: e.target.value })}
              placeholder="Instrument and reference"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={value.confirmed}
              disabled={
                value.value === null ||
                value.state !== "known" ||
                (!signed && value.value < 0) ||
                !value.method.trim()
              }
              onChange={(e) => change({ confirmed: e.target.checked })}
            />
            <span>
              Clinician confirms this value
              <br />
              <small className="muted">
                Recorded {new Date(value.recordedAt).toLocaleDateString()}
              </small>
            </span>
          </label>
        </div>
      </details>
    </div>
  );
}
export function PeriodontalInspector({
  currentCase,
  selectedFdi,
  onSelect,
  onChange,
}: {
  currentCase: Case;
  selectedFdi: number;
  onSelect: (n: number) => void;
  onChange: (c: Case) => void;
}) {
  const m = currentCase.measurements[selectedFdi],
    site = m.evaluationSite,
    findings = m.sites[site],
    result = evaluatePeriodontalCandidate(
      m,
      activeRevision(currentCase).teeth[selectedFdi],
      currentCase.assessment.confirmed &&
        currentCase.assessment.cause !== "unknown",
    );
  const update = (patch: Partial<ToothMeasurement>) =>
    onChange({
      ...currentCase,
      measurements: {
        ...currentCase.measurements,
        [selectedFdi]: { ...m, ...patch },
      },
    });
  const criteria = (patch: Partial<ToothMeasurement["criteria"]>) =>
    update({
      criteria: {
        ...m.criteria,
        ...patch,
        confirmed: patch.confirmed ?? false,
      },
    });
  return (
    <div className="stack">
      <ToothPicker selected={selectedFdi} onSelect={onSelect} />
      <details open>
        <summary>
          <strong>Patient assessment</strong>
        </summary>
        <div className="stack" style={{ marginTop: 14 }}>
          <label className="field">
            <span>Clinical display assessment</span>
            <select
              value={currentCase.assessment.cause}
              onChange={(e) =>
                onChange({
                  ...currentCase,
                  assessment: {
                    ...currentCase.assessment,
                    cause: e.target.value as Case["assessment"]["cause"],
                    confirmed: false,
                  },
                })
              }
            >
              <option value="unknown">Unknown / awaiting assessment</option>
              <option value="soft_tissue">
                Soft tissue / eruption related
              </option>
              <option value="lip">Lip related</option>
              <option value="skeletal">Skeletal</option>
              <option value="dentoalveolar">Dentoalveolar</option>
              <option value="wear">Wear / restorative</option>
              <option value="mixed">Mixed causes</option>
            </select>
          </label>
          <details>
            <summary>Facial and smile measurements</summary>
            <div className="stack" style={{ marginTop: 14 }}>
              {(
                [
                  ["restDisplay", "Upper incisor display at rest"],
                  [
                    "gingivalDisplay",
                    "Midbuccal gingival display at maximum smile",
                  ],
                  [
                    "lipLength",
                    "Upper lip length (subnasale to upper-lip lower border)",
                  ],
                  [
                    "lipMobility",
                    "Upper lip elevation (rest to maximum smile)",
                  ],
                ] as const
              ).map(([key, label]) => (
                <Measurement
                  key={key}
                  label={label}
                  value={
                    currentCase.assessment.facialMeasurements?.[key] ??
                    blankValue()
                  }
                  onChange={(v) =>
                    onChange({
                      ...currentCase,
                      assessment: {
                        ...currentCase.assessment,
                        confirmed: false,
                        facialMeasurements: {
                          restDisplay: blankValue(),
                          gingivalDisplay: blankValue(),
                          lipLength: blankValue(),
                          lipMobility: blankValue(),
                          ...currentCase.assessment.facialMeasurements,
                          [key]: v,
                        },
                      },
                    })
                  }
                />
              ))}
            </div>
          </details>
          <label className="field">
            <span>Assessment notes & indicated records</span>
            <textarea
              placeholder="Lip length/mobility, display at rest, occlusion, wear, radiographic findings and external reviews where indicated"
              value={currentCase.assessment.notes}
              onChange={(e) =>
                onChange({
                  ...currentCase,
                  assessment: {
                    ...currentCase.assessment,
                    notes: e.target.value,
                    confirmed: false,
                  },
                })
              }
            />
          </label>
          <label className="field">
            <span>Reviewing clinician</span>
            <input
              value={currentCase.assessment.clinician}
              onChange={(e) =>
                onChange({
                  ...currentCase,
                  assessment: {
                    ...currentCase.assessment,
                    clinician: e.target.value,
                    confirmed: false,
                  },
                })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              disabled={
                !currentCase.assessment.clinician.trim() ||
                currentCase.assessment.cause === "unknown"
              }
              checked={currentCase.assessment.confirmed}
              onChange={(e) =>
                onChange({
                  ...currentCase,
                  assessment: {
                    ...currentCase.assessment,
                    confirmed: e.target.checked,
                  },
                })
              }
            />
            <span>
              I reviewed the examination, function and indicated diagnostic
              records. This assessment is clinician confirmed.
            </span>
          </label>
        </div>
      </details>
      <div className="divider" />
      <h3>FDI {selectedFdi} · site-specific findings</h3>
      <label className="field">
        <span>Clinical site</span>
        <select
          value={site}
          onChange={(e) =>
            update({
              evaluationSite: e.target.value as Site,
              criteria: { ...m.criteria, confirmed: false },
            })
          }
        >
          {SITES.map((s) => (
            <option key={s} value={s}>
              {s} ·{" "}
              {
                {
                  MB: "mesiobuccal",
                  B: "midbuccal",
                  DB: "distobuccal",
                  ML: "mesiolingual",
                  L: "midlingual",
                  DL: "distolingual",
                }[s]
              }
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ["probingDepth", "Probing depth"],
          ["boneSounding", "Margin to bone crest"],
          ["ktw", "Keratinized tissue width"],
          ["marginToCej", "Margin position relative to CEJ"],
          ["finishLineDepth", "Planned finish-line depth"],
        ] as [FindingKey, string][]
      ).map(([key, label]) => (
        <Measurement
          key={key}
          label={label}
          value={findings[key]}
          signed={key === "marginToCej"}
          onChange={(v) =>
            update({ sites: { ...m.sites, [site]: { ...findings, [key]: v } } })
          }
        />
      ))}
      <p className="muted" style={{ fontSize: 12 }}>
        CEJ sign: + margin apical to CEJ (recession), − coronal. CAL from
        co-located confirmed values is probing depth + signed CEJ position;
        alternate references require clinical documentation.
      </p>
      {confirmedClinical(findings.probingDepth) &&
        findings.probingDepth.value >= 0 &&
        confirmedClinical(findings.marginToCej) && (
          <span className="badge">
            Calculated attachment level:{" "}
            {(findings.probingDepth.value + findings.marginToCej.value).toFixed(
              1,
            )}{" "}
            mm
          </span>
        )}
      <div className="two-cols">
        {(["bleeding", "suppuration"] as const).map((key) => (
          <label className="field" key={key}>
            <span>
              {key === "bleeding" ? "Bleeding on probing" : "Suppuration"}
            </span>
            <select
              value={findings[key]}
              onChange={(e) =>
                update({
                  sites: {
                    ...m.sites,
                    [site]: { ...findings, [key]: e.target.value },
                  },
                })
              }
            >
              <option value="unknown">Unknown</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
        ))}
      </div>
      <Measurement
        label="Current clinical width"
        value={m.currentWidth}
        onChange={(v) => update({ currentWidth: v })}
      />
      <Measurement
        label="Current clinical height"
        value={m.currentHeight}
        onChange={(v) => update({ currentHeight: v })}
      />
      <label className="field">
        <span>Periodontal phenotype</span>
        <select
          value={m.phenotype}
          onChange={(e) =>
            update({
              phenotype: e.target.value as ToothMeasurement["phenotype"],
            })
          }
        >
          <option value="unknown">Unknown</option>
          <option value="thin_scalloped">Thin / scalloped</option>
          <option value="thick_flat">Thick / flat</option>
          <option value="thick_scalloped">Thick / scalloped</option>
        </select>
      </label>
      <label className="field">
        <span>Current restorative status</span>
        <select
          value={m.restorativeStatus}
          onChange={(e) =>
            update({
              restorativeStatus: e.target
                .value as ToothMeasurement["restorativeStatus"],
            })
          }
        >
          {[
            "unknown",
            "natural",
            "composite",
            "veneer",
            "crown",
            "implant",
            "wear_facet",
            "fractured",
          ].map((s) => (
            <option value={s} key={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className="divider" />
      <h3>Scenario criteria</h3>
      <Notice>
        Enter criteria appropriate to this patient and site. The app does not
        assume universal clearance or tissue thresholds.
      </Notice>
      <NumberField
        label="Minimum finish-line-to-crest criterion"
        value={m.criteria.minimumClearanceMm}
        min={0.1}
        onChange={(v) => criteria({ minimumClearanceMm: v })}
      />
      <NumberField
        label="Minimum remaining KTW criterion"
        value={m.criteria.minimumKtwMm}
        min={0}
        onChange={(v) => criteria({ minimumKtwMm: v })}
      />
      <label className="field">
        <span>Criteria reference / clinical reasoning</span>
        <textarea
          value={m.criteria.reference}
          onChange={(e) => criteria({ reference: e.target.value })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={m.criteria.excisionAssumptionConfirmed}
          onChange={(e) =>
            criteria({ excisionAssumptionConfirmed: e.target.checked })
          }
        />
        <span>
          Simple-excision geometry applies for the projected KTW calculation.
        </span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={m.criteria.softTissueFeasible}
          onChange={(e) => criteria({ softTissueFeasible: e.target.checked })}
        />
        <span>I assessed soft-tissue-only feasibility.</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={m.criteria.confirmed}
          disabled={
            !m.criteria.reference.trim() ||
            m.criteria.minimumClearanceMm === null ||
            m.criteria.minimumClearanceMm <= 0 ||
            m.criteria.minimumKtwMm === null ||
            m.criteria.minimumKtwMm < 0 ||
            !currentCase.assessment.clinician.trim()
          }
          onChange={(e) =>
            criteria({
              confirmed: e.target.checked,
              site,
              confirmedAt: now(),
              confirmedBy: currentCase.assessment.clinician.trim(),
            })
          }
        />
        <span>I confirm these individualized criteria.</span>
      </label>
      {m.criteria.confirmed && (
        <p className="muted">
          Criteria for {m.criteria.site ?? "unconfirmed site"} ·{" "}
          {m.criteria.confirmedBy ?? "reviewer pending"} ·{" "}
          {m.criteria.confirmedAt
            ? new Date(m.criteria.confirmedAt).toLocaleDateString()
            : "confirmation date pending"}
        </p>
      )}
      <label className="field">
        <span>Tooth-specific clinical notes</span>
        <textarea
          value={m.clinicianNotes}
          onChange={(e) => update({ clinicianNotes: e.target.value })}
        />
      </label>
      <Notice tone="warning">
        <strong>{result.headline}</strong>
        <ul style={{ paddingLeft: 16, marginTop: 8 }}>
          {[...result.supportingFindings, ...result.unresolved].map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Notice>
    </div>
  );
}
