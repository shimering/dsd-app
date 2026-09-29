import { type Photo } from './domain';
import { applicableDsd, dsdDefinition, DSD_GROUPS } from './dsdCatalog';
import { dsdMeasurement, dsdMetrics, dsdProgress, dsdState } from './dsd';
import { measurementValue } from './geometry';

export function DsdPanel({
  photo,
  assessmentId,
  onChange,
  onStart,
  showAll,
  onShowAll,
  onAssist,
  aiBusy,
  imageReady,
}: {
  photo: Photo;
  assessmentId: string | null;
  onChange: (photo: Photo) => void;
  onStart: (id: string, redraw?: boolean) => void;
  showAll: boolean;
  onShowAll: (show: boolean) => void;
  onAssist: () => void;
  aiBusy: boolean;
  imageReady: boolean;
}) {
  const state = dsdState(photo),
    progress = dsdProgress(photo);
  const definitions = applicableDsd(state.view);
  const current = assessmentId ? dsdDefinition(assessmentId) : undefined;
  const metrics = dsdMetrics(photo);
  const ready = metrics.filter((m) => m.value !== 'Awaiting measurements');
  return (
    <section className="dsd-panel" aria-label="DSD tooth-position assessment">
      <div className="section-label">DSD TOOTH-POSITION ASSESSMENT</div>
      <p className="muted">
        Measure the original teeth before outlining the lips. Add full-face,
        retracted, and resting photos to assess the relationships visible in
        each view.
      </p>
      <label className="field">
        Assessment photo view
        <select
          value={state.view}
          onChange={(e) =>
            onChange({
              ...photo,
              dsd: { ...state, view: e.target.value as typeof state.view },
            })
          }
        >
          <option value="smile">Frontal smile</option>
          <option value="retracted">Retracted anterior teeth</option>
          <option value="rest">Face / lips at rest</option>
        </select>
      </label>
      <div className="dsd-progress" role="status">
        <strong>
          {progress.measured} of {progress.total} measured
        </strong>
        <span>
          {progress.unavailable} unavailable · {progress.remaining} remaining
        </span>
        <progress
          max={progress.total}
          value={progress.measured + progress.unavailable}
          aria-label="DSD checklist progress"
        />
      </div>
      <button
        className="full"
        onClick={onAssist}
        disabled={aiBusy || !imageReady}
      >
        {aiBusy
          ? 'Requesting suggestion…'
          : 'Assist this assessment with Gemini'}
      </button>
      <label className="check-row">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => onShowAll(e.target.checked)}
        />
        Show all DSD overlays
      </label>
      <p className="note">
        The canvas shows facial references and the selected item. Select either
        smile curve to compare both.
      </p>
      {current && current.views.includes(state.view) && (
        <div className="dsd-current">
          <strong>{current.label}</strong>
          <p>{current.instruction}</p>
          {dsdMeasurement(photo, current.id) ? (
            <button className="full" onClick={() => onStart(current.id, true)}>
              Redraw this measurement
            </button>
          ) : (
            <button className="full" onClick={() => onStart(current.id)}>
              Measure this item
            </button>
          )}
          {!dsdMeasurement(photo, current.id) && (
            <button
              className="text-button"
              onClick={() =>
                onChange({
                  ...photo,
                  dsd: {
                    ...state,
                    unavailable: [
                      ...state.unavailable.filter(
                        (m) => m.assessmentId !== current.id,
                      ),
                      {
                        assessmentId: current.id,
                        reason:
                          'Not visible or reliably measurable in this photo.',
                      },
                    ],
                  },
                })
              }
            >
              Mark not visible in this photo
            </button>
          )}
        </div>
      )}
      <div className="dsd-checklist">
        {DSD_GROUPS.map((group) => {
          const items = definitions.filter((m) => m.group === group);
          if (!items.length) return null;
          const done = items.filter((m) => dsdMeasurement(photo, m.id)).length;
          return (
            <details
              key={group}
              open={
                group === DSD_GROUPS[0] || group === 'Resting lip relationships'
              }
            >
              <summary>
                {group}
                <span>
                  {done}/{items.length}
                </span>
              </summary>
              {items.map((def) => {
                const m = dsdMeasurement(photo, def.id),
                  unavailable = state.unavailable.find(
                    (u) => u.assessmentId === def.id,
                  );
                return (
                  <div className="dsd-item" key={def.id}>
                    <button
                      className={assessmentId === def.id ? 'selected' : ''}
                      aria-label={`${m ? 'Review' : 'Measure'} ${def.label}`}
                      onClick={() => onStart(def.id)}
                    >
                      <span>{def.label}</span>
                      <strong>
                        {m
                          ? measurementValue(m, photo)
                          : unavailable
                            ? 'Unavailable'
                            : 'Measure'}
                      </strong>
                    </button>
                    {unavailable && !m && (
                      <div className="dsd-unavailable">
                        <small>{unavailable.reason}</small>
                        <button
                          className="text-button"
                          onClick={() =>
                            onChange({
                              ...photo,
                              dsd: {
                                ...state,
                                unavailable: state.unavailable.filter(
                                  (u) => u.assessmentId !== def.id,
                                ),
                              },
                            })
                          }
                        >
                          Restore item
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </details>
          );
        })}
      </div>
      {state.view === 'smile' && (
        <label className="field">
          Smile arc assessment
          <select
            value={state.smileArc ?? 'unassessed'}
            onChange={(e) =>
              onChange({
                ...photo,
                dsd: {
                  ...state,
                  smileArc: e.target.value as NonNullable<
                    typeof state.smileArc
                  >,
                },
              })
            }
          >
            <option value="unassessed">Awaiting clinician review</option>
            <option value="consonant">Consonant with the lower lip</option>
            <option value="flat">Flat</option>
            <option value="reverse">Reverse</option>
          </select>
          <small>
            Compare the incisal arc and lower-lip curve in a posed smile.
          </small>
        </label>
      )}
      <details className="dsd-results" open>
        <summary>
          Calculated assessment <span>{ready.length} results</span>
        </summary>
        {ready.length ? (
          <dl>
            {ready.map((m) => (
              <div key={m.label} title={m.needs}>
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">
            Add facial references for midline discrepancy and cant. Measure
            crown width and height for tooth proportions.
          </p>
        )}
        <p className="note">
          Results describe the marked photo geometry. Ratios and angles need no
          scale. Millimeters require a known reference in the same plane.
          Compare proportions within the individual case; frontal photos do not
          measure root position, overjet, or 3D occlusion.
        </p>
      </details>
    </section>
  );
}
