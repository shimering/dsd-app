import { useState } from 'react';
import type { Photo } from './domain';
import { dsdState } from './dsd';
import {
  BASIC_TOOLS,
  basicTemplateSchema,
  type BasicToolId,
  type BasicTemplate,
} from './basicFrameSchema';
import {
  getTemplate,
  seedTemplate,
  setTemplate,
  templateBounds,
  templateFits,
  transformTemplate,
  midlineResults,
} from './basicFrame';

const descriptions: Record<BasicToolId, string> = {
  midline:
    'Fit the facial horizontal, facial midline, and dental midline. Confirm the guides to see their offset and angle.',
  'smile-curve':
    'Fit the upper tooth edges and visible cusps from 15 to 25. Adjust the inner lower-lip curve for comparison.',
  'interdental-proportion':
    'Set desired adjacent tooth-width ratios across all 10 upper teeth. These are visual targets for your design.',
  'central-incisor-proportion':
    'Set the desired width / height of 11 and 21. Both outlines share the same target.',
  'gingival-curve':
    'Fit the curve to the gingival zeniths of all 10 upper teeth, from second premolar to second premolar.',
  'papilla-curve':
    'Fit the nine papilla tips between 15 and 25. Mark hidden landmarks unavailable.',
};
const targetLabels = [
  'Lateral / central width %',
  'Canine / lateral width %',
  'First premolar / canine width %',
  'Second premolar / first premolar width %',
];
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        aria-label={label}
        step="0.1"
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber))
            onChange(e.target.valueAsNumber);
        }}
      />
    </label>
  );
}
export function BasicFramePanel({
  photo,
  activeId,
  onStart,
  onChange,
  showAll,
  onShowAll,
  onAssist,
  aiBusy,
  imageReady,
}: {
  photo: Photo;
  activeId: BasicToolId | null;
  onStart: (id: BasicToolId) => void;
  onChange: (p: Photo) => void;
  showAll: boolean;
  onShowAll: (v: boolean) => void;
  onAssist: () => void;
  aiBusy: boolean;
  imageReady: boolean;
}) {
  const [error, setError] = useState('');
  const state = dsdState(photo),
    templates = state.basicFrame?.templates ?? [];
  const t = activeId ? getTemplate(photo, activeId) : undefined;
  const confirmed = templates.filter((t) => t.status === 'confirmed').length;
  const change = (next: BasicTemplate) => {
    if (!templateFits(photo, next)) {
      setError('Keep the guide inside the photo and use positive proportions.');
      return;
    }
    setError('');
    onChange(setTemplate(photo, next));
  };
  const transform = (
    scale: number,
    degrees = 0,
    destination?: { x: number; y: number },
  ) => {
    if (!t) return;
    const bounds = templateBounds(t);
    if (!bounds) return;
    change(
      transformTemplate(
        t,
        bounds.center,
        destination ?? bounds.center,
        scale,
        degrees,
      ),
    );
  };
  return (
    <section
      className="dsd-panel basic-frame-panel"
      aria-label="Six basic DSD tools"
    >
      <div className="section-label">BASIC SMILE FRAME · 10 UPPER TEETH</div>
      <p className="muted">
        Second premolar to second premolar · 15–25. Fit six adjustable guides
        over the original photo.
      </p>
      <div className="dsd-progress" role="status">
        <strong>{confirmed} of 6 guides set</strong>
        <span>
          {templates.filter((t) => t.status === 'unavailable').length}{' '}
          unavailable · starter guides stay provisional until confirmed
        </span>
        <progress max={6} value={confirmed} aria-label="Basic guide progress" />
      </div>
      <div className="basic-tool-cards">
        {BASIC_TOOLS.map((tool) => (
          <button
            key={tool.id}
            data-testid={`basic-tool-${tool.id}`}
            className={activeId === tool.id ? 'selected' : ''}
            aria-pressed={activeId === tool.id}
            onClick={() => {
              setError('');
              onStart(tool.id);
            }}
          >
            <span>{tool.label}</span>
            <small>{getTemplate(photo, tool.id)?.status ?? 'Add guide'}</small>
          </button>
        ))}
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => onShowAll(e.target.checked)}
        />
        Show all guides
      </label>
      <button
        className="full"
        onClick={onAssist}
        disabled={aiBusy || !imageReady}
      >
        {aiBusy ? 'Requesting suggestion…' : 'Assist six tools with Gemini'}
      </button>
      {t && (
        <div className="dsd-current" key={t.id}>
          <strong>{BASIC_TOOLS.find((tool) => tool.id === t.id)!.label}</strong>
          <p>{descriptions[t.id]}</p>
          <p className="note">
            Drag points to refine the shape. Use the center handle to move, the
            square handle to resize, and the round top handle to rotate.
          </p>
          {t.targets?.map((ratio, i) => (
            <NumberField
              key={i}
              label={
                t.id === 'central-incisor-proportion'
                  ? 'Central incisor width / height %'
                  : targetLabels[i]
              }
              value={ratio * 100}
              onChange={(value) =>
                change({
                  ...t,
                  status: 'draft',
                  targets: t.targets!.map((v, index) =>
                    index === i ? value / 100 : v,
                  ),
                })
              }
            />
          ))}
          {t.targets && (
            <p className="note">
              Editable starting targets. Tooth layers are adjusted separately in
              Teeth.
            </p>
          )}
          {templateBounds(t) && (
            <>
              <div className="numeric-grid">
                <NumberField
                  label="Guide center X"
                  value={templateBounds(t)!.center.x}
                  onChange={(x) =>
                    transform(1, 0, { ...templateBounds(t)!.center, x })
                  }
                />
                <NumberField
                  label="Guide center Y"
                  value={templateBounds(t)!.center.y}
                  onChange={(y) =>
                    transform(1, 0, { ...templateBounds(t)!.center, y })
                  }
                />
              </div>
              <div className="basic-transform-actions">
                <button onClick={() => transform(0.95)}>Smaller −5%</button>
                <button onClick={() => transform(1.05)}>Larger +5%</button>
                <button onClick={() => transform(1, -5)}>Rotate −5°</button>
                <button onClick={() => transform(1, 5)}>Rotate +5°</button>
              </div>
            </>
          )}
          <div className="basic-transform-actions">
            <button
              className="primary"
              disabled={
                !basicTemplateSchema.safeParse({ ...t, status: 'confirmed' })
                  .success
              }
              onClick={() =>
                change({ ...t, status: 'confirmed', reason: undefined })
              }
            >
              Confirm guide
            </button>
            <button onClick={() => change(seedTemplate(photo, t.id))}>
              Reset guide
            </button>
          </div>
          <button
            className="text-button"
            onClick={() =>
              onChange(
                setTemplate(photo, {
                  ...t,
                  status: 'unavailable',
                  reason: 'Not visible or reliably identifiable in this photo.',
                }),
              )
            }
          >
            Mark guide unavailable
          </button>
          {t.status === 'unavailable' && (
            <p>
              {t.reason}
              <button
                className="text-button"
                onClick={() =>
                  change({ ...t, status: 'draft', reason: undefined })
                }
              >
                Restore guide
              </button>
            </p>
          )}
          {t.paths.length > 0 && (
            <details className="basic-landmarks">
              <summary>Landmarks and hidden anatomy</summary>
              {t.paths.map((path) => (
                <div key={path.key}>
                  <strong>{path.key}</strong>
                  {path.anchors.map((a) => (
                    <div className="basic-landmark" key={a.key}>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          aria-label={`${path.key} ${a.key} visible`}
                          checked={!!a.point}
                          onChange={(e) => {
                            const fallback = seedTemplate(photo, t.id)
                              .paths.find((p) => p.key === path.key)!
                              .anchors.find((q) => q.key === a.key)!;
                            change({
                              ...t,
                              status: 'draft',
                              paths: t.paths.map((p) =>
                                p.key === path.key
                                  ? {
                                      ...p,
                                      anchors: p.anchors.map((q) =>
                                        q.key === a.key
                                          ? e.target.checked
                                            ? fallback
                                            : {
                                                key: a.key,
                                                point: null,
                                                reason:
                                                  'Not visible in this photo.',
                                              }
                                          : q,
                                      ),
                                    }
                                  : p,
                              ),
                            });
                          }}
                        />
                        {a.key}
                      </label>
                      {a.point ? (
                        <div className="numeric-grid">
                          {(['x', 'y'] as const).map((axis) => (
                            <NumberField
                              key={axis}
                              label={`${path.key} ${a.key} ${axis.toUpperCase()}`}
                              value={a.point![axis]}
                              onChange={(n) =>
                                change({
                                  ...t,
                                  status: 'draft',
                                  paths: t.paths.map((p) =>
                                    p.key === path.key
                                      ? {
                                          ...p,
                                          anchors: p.anchors.map((q) =>
                                            q.key === a.key
                                              ? {
                                                  ...q,
                                                  point: {
                                                    ...q.point!,
                                                    [axis]: n,
                                                  },
                                                }
                                              : q,
                                          ),
                                        }
                                      : p,
                                  ),
                                })
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <small>{a.reason}</small>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </details>
          )}
          {t.id === 'midline' && (
            <dl className="basic-midline-results">
              {midlineResults(photo).map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {t.id === 'smile-curve' && (
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
            </label>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>Photo view and calibration notes</summary>
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
        <p className="note">
          Ratios and angles need no scale. Midline distances use pixels until a
          known reference is calibrated.
        </p>
      </details>
    </section>
  );
}
