import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookmarkPlus,
  Sparkles,
} from "lucide-react";
import {
  Case,
  FDI_VISIBLE_UPPER,
  ToothPreset,
  ToothTransform,
} from "../../types";
import { activePhoto, activeRevision, now, uid } from "../../lib/case-model";
import {
  POPULAR_DENTAL_SHADES,
  TOOTH_TEMPLATES,
  getToothTypeFromFdi,
  isRightQuadrant,
} from "../../lib/tooth-templates";
import { NumberField } from "../ui";
import { useState } from "react";
export function ToothPicker({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div
      className="tooth-picker"
      role="group"
      aria-label="Select tooth by FDI number"
    >
      {FDI_VISIBLE_UPPER.map((fdi) => (
        <button
          key={fdi}
          className={selected === fdi ? "active" : ""}
          aria-pressed={selected === fdi}
          onClick={() => onSelect(fdi)}
        >
          {fdi}
        </button>
      ))}
    </div>
  );
}
export function ToothCustomizer({
  currentCase,
  presets,
  selectedFdi,
  onSelect,
  onUpdate,
  onChange,
  onAssistant,
}: {
  currentCase: Case;
  presets: ToothPreset[];
  selectedFdi: number;
  onSelect: (n: number) => void;
  onUpdate: (patch: Partial<ToothTransform>, all?: boolean) => void;
  onChange: (c: Case) => void;
  onAssistant: () => void;
}) {
  const t = activeRevision(currentCase).teeth[selectedFdi],
    photo = activePhoto(currentCase),
    ppm = photo?.calibration.isCalibrated
      ? photo.calibration.pixelsPerMm
      : undefined,
    [presetName, setPresetName] = useState("");
  return (
    <div className="stack">
      <div>
        <p className="rail-heading" style={{ marginBottom: 10 }}>
          Upper arch · patient's right → left
        </p>
        <ToothPicker selected={selectedFdi} onSelect={onSelect} />
      </div>
      <div className="row spread">
        <h3>Tooth form</h3>
        <span className="badge">FDI {selectedFdi}</span>
      </div>
      <div className="form-grid">
        {(["oval", "square", "tapered", "rounded"] as const).map((form) => (
          <button
            key={form}
            className={`form-option ${t.form === form ? "active" : ""}`}
            onClick={() => onUpdate({ form })}
            aria-pressed={t.form === form}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path
                d={TOOTH_TEMPLATES[form].outlinePath(
                  getToothTypeFromFdi(selectedFdi),
                  isRightQuadrant(selectedFdi),
                )}
                fill="currentColor"
                fillOpacity=".12"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
            <span>{form[0].toUpperCase() + form.slice(1)}</span>
          </button>
        ))}
      </div>
      <button
        className="btn subtle block"
        onClick={() => onUpdate({ form: t.form }, true)}
      >
        Apply form to upper ten
      </button>
      <div className="divider" />
      <h3>Dimensions & position</h3>
      <div className="two-cols">
        <NumberField
          label={ppm ? "Projected width" : "Image width"}
          unit={ppm ? "mm" : "px"}
          value={Math.round((t.widthPx / (ppm ?? 1)) * 100) / 100}
          min={0.1}
          step={ppm ? 0.1 : 1}
          onChange={(v) => {
            if (v !== null && v > 0) onUpdate({ widthPx: v * (ppm ?? 1) });
          }}
        />
        <NumberField
          label={ppm ? "Projected height" : "Image height"}
          unit={ppm ? "mm" : "px"}
          value={Math.round((t.heightPx / (ppm ?? 1)) * 100) / 100}
          min={0.1}
          step={ppm ? 0.1 : 1}
          onChange={(v) => {
            if (v !== null && v > 0) onUpdate({ heightPx: v * (ppm ?? 1) });
          }}
        />
        <NumberField
          label="Horizontal position"
          unit="px"
          step={1}
          value={Math.round(t.x)}
          onChange={(v) => {
            if (v !== null) onUpdate({ x: v });
          }}
        />
        <NumberField
          label="Vertical position"
          unit="px"
          step={1}
          value={Math.round(t.y)}
          onChange={(v) => {
            if (v !== null) onUpdate({ y: v });
          }}
        />
      </div>
      <NumberField
        label="Rotation"
        unit="°"
        step={1}
        value={t.rotation}
        min={-180}
        max={180}
        onChange={(v) => {
          if (v !== null) onUpdate({ rotation: v });
        }}
      />
      <div
        className="numeric-move"
        role="group"
        aria-label="Nudge selected tooth by one image pixel"
      >
        <button
          className="icon-btn"
          aria-label="Move tooth left"
          onClick={() => onUpdate({ x: t.x - 1 })}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          className="icon-btn"
          aria-label="Move tooth up"
          onClick={() => onUpdate({ y: t.y - 1 })}
        >
          <ArrowUp size={17} />
        </button>
        <button
          className="icon-btn"
          aria-label="Move tooth down"
          onClick={() => onUpdate({ y: t.y + 1 })}
        >
          <ArrowDown size={17} />
        </button>
        <button
          className="icon-btn"
          aria-label="Move tooth right"
          onClick={() => onUpdate({ x: t.x + 1 })}
        >
          <ArrowRight size={17} />
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        W/H {Math.round((t.widthPx / t.heightPx) * 100)}%. Photo dimensions are
        projected estimates; confirm clinically.
      </p>
      <div className="divider" />
      <h3>Proposed changes</h3>
      <NumberField
        label="Gingival margin movement"
        value={t.gingivalShiftMm}
        min={-10}
        max={10}
        onChange={(v) => {
          if (v !== null) onUpdate({ gingivalShiftMm: v });
        }}
      />
      <NumberField
        label="Incisal edge change"
        value={t.incisalExtensionMm}
        min={-10}
        max={10}
        onChange={(v) => {
          if (v !== null) onUpdate({ incisalExtensionMm: v });
        }}
      />
      <p className="muted" style={{ fontSize: 12 }}>
        Margin: + apical / − coronal. Incisal: + lengthen / − shorten. Numeric
        proposals remain available without photo calibration.
      </p>
      <h3>Shade preference</h3>
      <div className="shade-grid">
        {POPULAR_DENTAL_SHADES.map((s) => (
          <button
            key={s.code}
            aria-label={`Shade ${s.code}`}
            aria-pressed={t.shade === s.code}
            className={`shade-option ${t.shade === s.code ? "active" : ""}`}
            onClick={() => onUpdate({ shade: s.code })}
          >
            <span style={{ background: s.hex }} />
            {s.code}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Visual preference; verify shade with clinical records.
      </p>
      <div className="divider" />
      <h3>Your gallery</h3>
      <p className="muted" style={{ fontSize: 12 }}>
        Saved forms are shared across cases in this workspace. Dimensions use
        confirmed scale where available, otherwise relative image width; review
        fit on each patient.
      </p>
      <label className="field">
        <span>Preset name</span>
        <input
          value={presetName}
          placeholder="e.g. Soft natural"
          onChange={(e) => setPresetName(e.target.value)}
        />
      </label>
      <button
        className="btn block"
        disabled={!presetName.trim()}
        onClick={() => {
          onChange({
            ...currentCase,
            presets: [
              ...currentCase.presets,
              {
                id: uid(),
                name: presetName.trim(),
                teeth: structuredClone(activeRevision(currentCase).teeth),
                createdAt: now(),
                sourceWidth: photo?.width ?? 1000,
                sourcePixelsPerMm: ppm,
              },
            ],
          });
          setPresetName("");
        }}
      >
        <BookmarkPlus size={16} />
        Save upper-ten preset
      </button>
      {presets.map((p) => (
        <button
          className="btn block"
          key={p.id}
          onClick={() =>
            onUpdate({
              form: p.teeth[selectedFdi]?.form ?? "rounded",
              shade: p.teeth[selectedFdi]?.shade ?? "A1",
              widthPx:
                (p.teeth[selectedFdi]?.widthPx ?? t.widthPx) *
                (ppm && p.sourcePixelsPerMm
                  ? ppm / p.sourcePixelsPerMm
                  : (photo?.width ?? 1000) /
                    (p.sourceWidth ?? photo?.width ?? 1000)),
              heightPx:
                (p.teeth[selectedFdi]?.heightPx ?? t.heightPx) *
                (ppm && p.sourcePixelsPerMm
                  ? ppm / p.sourcePixelsPerMm
                  : (photo?.width ?? 1000) /
                    (p.sourceWidth ?? photo?.width ?? 1000)),
              customPath: p.teeth[selectedFdi]?.customPath,
              rotation: p.teeth[selectedFdi]?.rotation ?? 0,
            })
          }
        >
          Apply {p.name} to this tooth
        </button>
      ))}
      <button
        className="btn primary block"
        onClick={(e) => {
          e.currentTarget.focus();
          onAssistant();
        }}
      >
        <Sparkles size={16} />
        Compare AI alternatives
      </button>
    </div>
  );
}
