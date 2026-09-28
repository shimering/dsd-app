import { useState } from "react";
import { Case, GuideKey, PhotoAsset, Point2D } from "../../types";
import { activePhoto, now } from "../../lib/case-model";
import { calibrationScale, clamp } from "../../lib/geometry";
import { Notice, NumberField, errorText } from "../ui";
import { SelectedGuide } from "./SmileCanvas";
export const guideNames: Record<GuideKey, string> = {
  facialMidline: "Facial midline",
  dentalMidline: "Dental midline",
  bipupillary: "Bipupillary reference",
  incisalPlane: "Incisal plane",
  smileArc: "Smile arc",
  gingivalCurve: "Gingival curve",
  papillae: "Papilla landmarks",
  canineLines: "Canine reference lines",
};
export function GuideControls({
  currentCase,
  guide,
  onGuide,
  onPhoto,
  visible,
  onVisible,
  showTeeth,
  onShowTeeth,
  opacity,
  onOpacity,
}: {
  currentCase: Case;
  guide: SelectedGuide;
  onGuide: (g: SelectedGuide) => void;
  onPhoto: (p: Partial<PhotoAsset>) => void;
  visible: GuideKey[];
  onVisible: (g: GuideKey[]) => void;
  showTeeth: boolean;
  onShowTeeth: (v: boolean) => void;
  opacity: number;
  onOpacity: (v: number) => void;
}) {
  const photo = activePhoto(currentCase),
    [distance, setDistance] = useState<number | null>(
      photo?.calibration.realDistanceMm ?? null,
    ),
    [method, setMethod] = useState(photo?.calibration.referenceMethod ?? ""),
    [site, setSite] = useState(photo?.calibration.referenceSite ?? ""),
    [error, setError] = useState("");
  if (!photo)
    return (
      <Notice>Add a photo before positioning guides or calibrating.</Notice>
    );
  const points: Point2D[] =
    guide === "calibration"
      ? [
          photo.calibration.p1 ?? {
            x: photo.width * 0.43,
            y: photo.height * 0.52,
          },
          photo.calibration.p2 ?? {
            x: photo.width * 0.5,
            y: photo.height * 0.52,
          },
        ]
      : guide === "none"
        ? []
        : photo.guides[guide];
  function pointChange(i: number, patch: Partial<Point2D>) {
    const next = points.map((p, n) =>
      n === i
        ? {
            x: clamp(patch.x ?? p.x, 0, photo!.width),
            y: clamp(patch.y ?? p.y, 0, photo!.height),
          }
        : p,
    );
    if (guide === "calibration")
      onPhoto({
        calibration: { isCalibrated: false, p1: next[0], p2: next[1] },
      });
    else if (guide !== "none")
      onPhoto({ guides: { ...photo!.guides, [guide]: next } });
  }
  return (
    <div className="stack">
      <h3>Alignment & guides</h3>
      <label className="field">
        <span>Edit guide</span>
        <select
          value={guide}
          onChange={(e) => onGuide(e.target.value as SelectedGuide)}
        >
          <option value="none">Choose a guide</option>
          {Object.entries(guideNames).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
          <option value="calibration">Photo scale reference</option>
        </select>
      </label>
      <p className="muted" style={{ fontSize: 12 }}>
        Drag a numbered handle or enter its original-image coordinates below.
        Reference lines are editable observations, not automatic diagnoses.
      </p>
      {points.map((p, i) => (
        <div key={i} className="two-cols">
          <NumberField
            label={`Point ${i + 1} horizontal`}
            unit="px"
            step={1}
            value={Math.round(p.x)}
            min={0}
            max={photo.width}
            onChange={(v) => {
              if (v !== null) pointChange(i, { x: v });
            }}
          />
          <NumberField
            label={`Point ${i + 1} vertical`}
            unit="px"
            step={1}
            value={Math.round(p.y)}
            min={0}
            max={photo.height}
            onChange={(v) => {
              if (v !== null) pointChange(i, { y: v });
            }}
          />
        </div>
      ))}
      {guide === "calibration" && (
        <>
          <NumberField
            label="Clinically measured reference distance"
            value={distance}
            min={0.1}
            onChange={setDistance}
          />
          <label className="field">
            <span>Reference measurement method</span>
            <input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. calibrated caliper"
            />
          </label>
          <label className="field">
            <span>Reference tooth / site / plane</span>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="e.g. FDI 11, frontal width"
            />
          </label>
          <button
            className="btn primary block"
            disabled={
              !distance ||
              !method.trim() ||
              !site.trim() ||
              photo.isIllustration
            }
            onClick={() => {
              try {
                const pixelsPerMm = calibrationScale(
                  points[0],
                  points[1],
                  distance!,
                );
                onPhoto({
                  calibration: {
                    isCalibrated: true,
                    p1: points[0],
                    p2: points[1],
                    realDistanceMm: distance!,
                    pixelsPerMm,
                    confirmedAt: now(),
                    referenceMethod: method.trim(),
                    referenceSite: site.trim(),
                  },
                });
                setError("");
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >
            Confirm photo scale
          </button>
          {photo.isIllustration && (
            <Notice>
              Upload a patient photo to establish a clinical scale reference.
            </Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <p className="muted" style={{ fontSize: 12 }}>
            Calibration applies only to this photo. Perspective and tooth
            rotation remain sources of error; generated images cannot establish
            measurements.
          </p>
        </>
      )}
      <NumberField
        label="Photo alignment rotation"
        unit="°"
        step={1}
        min={-180}
        max={180}
        value={photo.orientationDeg}
        onChange={(v) => {
          if (v !== null) onPhoto({ orientationDeg: clamp(v, -180, 180) });
        }}
      />
      <div className="divider" />
      <h3>Visible overlays</h3>
      {Object.entries(guideNames).map(([key, label]) => (
        <label className="check" key={key}>
          <input
            type="checkbox"
            checked={visible.includes(key as GuideKey)}
            onChange={(e) =>
              onVisible(
                e.target.checked
                  ? [...visible, key as GuideKey]
                  : visible.filter((g) => g !== key),
              )
            }
          />
          <span>{label}</span>
        </label>
      ))}
      <label className="check">
        <input
          type="checkbox"
          checked={showTeeth}
          onChange={(e) => onShowTeeth(e.target.checked)}
        />
        <span>Tooth design overlays</span>
      </label>
      <label className="field">
        <span>Overlay opacity · {Math.round(opacity * 100)}%</span>
        <input
          type="range"
          min="0.1"
          max="1"
          step=".05"
          value={opacity}
          onChange={(e) => onOpacity(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
