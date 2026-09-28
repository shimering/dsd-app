import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Sparkles } from "lucide-react";
import { Case, SimulationJob } from "../../types";
import { activePhoto, hasConsent, isStale, uid } from "../../lib/case-model";
import { requestAi } from "../../lib/gemini";
import {
  compositeSimulation,
  exportSimulation,
  MouthMask,
} from "../../lib/media";
import { readMedia, saveMedia } from "../../lib/storage";
import { Dialog, Notice, NumberField, errorText } from "../ui";
import { ConsentPanel } from "./ConsentPanel";
export function SimulationModal({
  currentCase,
  onClose,
  onChange,
  onSave,
  onReview,
}: {
  currentCase: Case;
  onClose: () => void;
  onChange: (c: Case) => void;
  onSave: (caseId: string, s: SimulationJob) => void;
  onReview: (
    id: string,
    status: SimulationJob["reviewStatus"],
    notes: string,
  ) => void;
}) {
  const photo = activePhoto(currentCase),
    job = [...currentCase.simulations]
      .reverse()
      .find((s) => s.provenance.photoId === photo?.id),
    [slider, setSlider] = useState(50),
    [mask, setMask] = useState<MouthMask>({
      left: 0.27,
      top: 0.4,
      right: 0.73,
      bottom: 0.77,
    }),
    [maskReviewed, setMaskReviewed] = useState(false),
    [savedMaskAvailable, setSavedMaskAvailable] = useState(false),
    [maskLoading, setMaskLoading] = useState(!!job),
    [imageReviewed, setImageReviewed] = useState(false),
    [notes, setNotes] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const stale = job ? isStale(currentCase, job.provenance) : false,
    validMask = mask.left < mask.right && mask.top < mask.bottom;
  useEffect(() => {
    let active = true;
    setSavedMaskAvailable(false);
    setMaskLoading(!!job);
    setImageReviewed(false);
    setMaskReviewed(false);
    setNotes(job?.notes ?? "");
    if (job)
      void readMedia(job.maskKey)
        .then(async (blob) => {
          if (!blob) return;
          const value = JSON.parse(await blob.text());
          if (
            value.shape !== "ellipse" ||
            value.photoId !== photo?.id ||
            value.reviewed !== true ||
            ![value.left, value.top, value.right, value.bottom].every(
              (v) =>
                typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
            ) ||
            value.left >= value.right ||
            value.top >= value.bottom
          )
            return;
          if (active) {
            setMask({
              left: value.left,
              top: value.top,
              right: value.right,
              bottom: value.bottom,
            });
            setSavedMaskAvailable(true);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setMaskLoading(false);
        });
    return () => {
      active = false;
    };
  }, [job?.id, photo?.id]);
  async function generate() {
    if (!photo?.url) return;
    setLoading(true);
    setError("");
    const source = currentCase;
    try {
      const response = await requestAi(source, "simulation"),
        blob = await compositeSimulation(
          photo,
          `data:${response.image.mimeType};base64,${response.image.data}`,
          mask,
        ),
        mediaKey = await saveMedia(blob),
        maskKey = await saveMedia(
          new Blob(
            [
              JSON.stringify({
                shape: "ellipse",
                ...mask,
                photoId: photo.id,
                reviewed: true,
              }),
            ],
            { type: "application/json" },
          ),
        );
      onSave(source.id, {
        id: uid(),
        provenance: response.provenance,
        mediaKey,
        maskKey,
        reviewStatus: "pending_review",
        notes: "",
        url: URL.createObjectURL(blob),
      });
      setImageReviewed(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog title="Simulated treatment preview" onClose={onClose} wide>
      <div className="stack">
        <ConsentPanel currentCase={currentCase} onChange={onChange} />
        <Notice tone="warning">
          Aesthetic simulation · requires dentist review. This image cannot
          establish surgical measurements or guarantee a postoperative result.
        </Notice>
        {error && <Notice tone="error">{error}</Notice>}
        {!photo?.url ? (
          <Notice>
            Add the original patient photograph, or restore its local backup,
            before generating.
          </Notice>
        ) : (
          <>
            <details open={!job}>
              <summary>
                <strong>Review the mouth editing mask</strong>
              </summary>
              <div className="stack" style={{ marginTop: 14 }}>
                <div className="mask-image">
                  <img
                    src={photo.url}
                    alt="Patient original with proposed elliptical mouth mask"
                  />
                  <div
                    className="mask-ellipse"
                    style={{
                      left: `${mask.left * 100}%`,
                      top: `${mask.top * 100}%`,
                      width: `${(mask.right - mask.left) * 100}%`,
                      height: `${(mask.bottom - mask.top) * 100}%`,
                    }}
                  />
                </div>
                <div className="two-cols">
                  {(["left", "top", "right", "bottom"] as const).map((key) => (
                    <NumberField
                      key={key}
                      label={`Mask ${key}`}
                      unit="%"
                      value={Math.round(mask[key] * 100)}
                      min={0}
                      max={100}
                      step={1}
                      disabled={loading}
                      onChange={(v) => {
                        if (v !== null && v >= 0 && v <= 100) {
                          setMask({ ...mask, [key]: v / 100 });
                          setMaskReviewed(false);
                        }
                      }}
                    />
                  ))}
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={maskReviewed}
                    disabled={!validMask || loading}
                    onChange={(e) => setMaskReviewed(e.target.checked)}
                  />
                  <span>
                    I reviewed this mask against the patient photo and the
                    active design. Pixels outside it will be preserved.
                  </span>
                </label>
              </div>
            </details>
            <button
              className="btn primary"
              disabled={
                loading ||
                !hasConsent(currentCase) ||
                !maskReviewed ||
                !validMask ||
                photo.isIllustration
              }
              onClick={() => void generate()}
            >
              {loading ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}{" "}
              {loading
                ? "Generating patient preview…"
                : job
                  ? "Generate a new preview"
                  : "Generate patient preview"}
            </button>
            {photo.isIllustration && (
              <Notice>
                Replace the illustrated demo with a patient photo for Gemini
                image generation.
              </Notice>
            )}
            {job?.url && (
              <>
                {!maskLoading && !savedMaskAvailable && (
                  <Notice tone="warning">
                    The reviewed mouth mask is unavailable on this device.
                    Restore a complete backup or generate a new preview before
                    accepting.
                  </Notice>
                )}
                <div className="comparison">
                  <img
                    src={job.url}
                    alt="AI simulated smile requiring review"
                  />
                  <img
                    src={photo.url}
                    alt="Original smile"
                    style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
                  />
                  <span className="comparison-label">Original</span>
                  <span className="comparison-label after">Simulation</span>
                  <div
                    className="comparison-line"
                    style={{ left: `${slider}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={slider}
                    aria-label="Original versus simulated comparison"
                    onChange={(e) => setSlider(Number(e.target.value))}
                  />
                </div>
                <NumberField
                  label="Original image revealed"
                  unit="%"
                  min={0}
                  max={100}
                  step={1}
                  value={slider}
                  onChange={(v) => {
                    if (v !== null) setSlider(Math.min(100, Math.max(0, v)));
                  }}
                />
                {stale && (
                  <Notice tone="warning">
                    This preview belongs to an earlier revision. Generate a new
                    preview before accepting.
                  </Notice>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={imageReviewed}
                    onChange={(e) => setImageReviewed(e.target.checked)}
                  />
                  <span>
                    I reviewed tooth count, orientation, shape, margins, shade,
                    lower/posterior teeth and unresolved papilla/embrasure
                    limitations.
                  </span>
                </label>
                <label className="field">
                  <span>Aesthetic review notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={stale || !imageReviewed || !savedMaskAvailable}
                    onClick={() =>
                      onReview(job.id, "aesthetic_accepted", notes)
                    }
                  >
                    <CheckCircle2 size={16} />
                    Accept aesthetic preview
                  </button>
                  <button
                    className="btn"
                    onClick={() => onReview(job.id, "rejected", notes)}
                  >
                    Reject preview
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      void exportSimulation(job.url!).catch((e) =>
                        setError(errorText(e)),
                      )
                    }
                  >
                    <Download size={16} />
                    Export image
                  </button>
                </div>
                <span className="badge">
                  {job.reviewStatus.replaceAll("_", " ")}
                </span>
                <p className="muted" style={{ fontSize: 12 }}>
                  Aesthetic acceptance is separate from clinical plan approval.{" "}
                  {job.provenance.model} ·{" "}
                  {new Date(job.provenance.createdAt).toLocaleString()}
                </p>
              </>
            )}
            {job?.missing && (
              <Notice tone="warning">
                The generated image is stored on another device. Restore a local
                backup to view it.
              </Notice>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
