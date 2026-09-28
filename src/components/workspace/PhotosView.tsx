import { useRef, useState } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  Upload,
  Video,
  AlertCircle,
} from "lucide-react";
import { Case, PhotoAsset, PhotoType } from "../../types";
import { defaultGuides } from "../../lib/geometry";
import { now, selectPhoto, uid } from "../../lib/case-model";
import { inspectMedia } from "../../lib/media";
import { saveMedia } from "../../lib/storage";
import { Notice, errorText } from "../ui";
import { VideoFrameCapture } from "./VideoFrameCapture";
export const PHOTO_SLOTS: {
  type: PhotoType;
  label: string;
  instruction: string;
  core: boolean;
}[] = [
  {
    type: "maximum_smile",
    label: "Maximum smile",
    instruction:
      "Frontal face, maximum natural smile, teeth in focus; keep the head level.",
    core: true,
  },
  {
    type: "rest",
    label: "Frontal at rest",
    instruction:
      "Natural head position and relaxed lips; record incisor display at rest.",
    core: true,
  },
  {
    type: "social_smile",
    label: "Social smile",
    instruction:
      "Frontal face with a comfortable posed smile; use the same camera position.",
    core: true,
  },
  {
    type: "profile_rest",
    label: "Profile at rest",
    instruction: "Standardized profile, relaxed lips; document patient side.",
    core: true,
  },
  {
    type: "profile_smile",
    label: "Profile smile",
    instruction: "Profile smile with the same head position as the rest view.",
    core: true,
  },
  {
    type: "retracted",
    label: "Anterior retracted",
    instruction:
      "Separate the teeth to expose clinical crowns and gingival margins.",
    core: true,
  },
  {
    type: "twelve_oclock",
    label: "12 o’clock view",
    instruction:
      "Supplementary view above the patient for smile and arch relationships.",
    core: false,
  },
  {
    type: "frontal_bite",
    label: "Frontal bite",
    instruction:
      "Retracted frontal intercuspation; supplement clinical bite assessment.",
    core: false,
  },
  {
    type: "right_bite",
    label: "Right buccal bite",
    instruction: "Right buccal view in intercuspation; identify patient side.",
    core: false,
  },
  {
    type: "left_bite",
    label: "Left buccal bite",
    instruction: "Left buccal view in intercuspation; identify patient side.",
    core: false,
  },
  {
    type: "upper_occlusal",
    label: "Upper occlusal",
    instruction:
      "Upper arch view with an appropriate mirror and controlled orientation.",
    core: false,
  },
  {
    type: "lower_occlusal",
    label: "Lower occlusal",
    instruction:
      "Lower arch view with an appropriate mirror and controlled orientation.",
    core: false,
  },
  {
    type: "shade",
    label: "Shade reference",
    instruction:
      "Use consistent lighting and a labelled shade tab or reference card.",
    core: false,
  },
  {
    type: "video",
    label: "Rest · speech · smile video",
    instruction:
      "Record relaxed lips, speech and natural smile. Use an identified frame for design.",
    core: false,
  },
];
export function captureCompleteness(c: Case) {
  const required =
    c.capturePurpose === "preview"
      ? ["maximum_smile"]
      : PHOTO_SLOTS.filter(
          (s) => s.core && !c.notIndicated.includes(s.type),
        ).map((s) => s.type);
  return {
    total: required.length,
    ready: required.filter((t) =>
      c.photos.some(
        (p) => p.type === t && !p.archived && !p.missing && !p.isIllustration,
      ),
    ).length,
  };
}
export function PhotosView({
  currentCase,
  onChange,
  onDesign,
  onAddPhoto,
}: {
  currentCase: Case;
  onChange: (c: Case) => void;
  onDesign: () => void;
  onAddPhoto: (caseId: string, p: PhotoAsset) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState<PhotoType | null>(null),
    [showExtra, setShowExtra] = useState(false);
  async function upload(
    file: File | undefined,
    type: PhotoType,
    videoSource?: PhotoAsset["videoSource"],
  ) {
    if (!file) return;
    setError("");
    setBusy(type);
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Use a photo or video under 100MB.");
      if (!file.type.startsWith(type === "video" ? "video/" : "image/"))
        throw new Error("Choose a supported photo or video file.");
      const dimensions = await inspectMedia(file),
        mediaKey = await saveMedia(file),
        asset: PhotoAsset = {
          id: uid(),
          type,
          mediaKey,
          name: file.name,
          ...dimensions,
          mimeType: file.type,
          orientationDeg: 0,
          calibration: { isCalibrated: false },
          guides: defaultGuides(dimensions.width, dimensions.height),
          capturedAt: now(),
          qualityReviewed: false,
          filters: "unknown",
          url: URL.createObjectURL(file),
          videoSource,
        };
      onAddPhoto(currentCase.id, asset);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  const progress = captureCompleteness(currentCase);
  return (
    <div className="page-scroll">
      <div className="page-content stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">01 / Patient records</span>
            <h1>Capture the complete picture.</h1>
            <p>
              Keep originals on this device. Add the views needed for your
              intended assessment.
            </p>
          </div>
          <button className="btn primary" onClick={onDesign}>
            Continue to design
          </button>
        </div>
        <div className="panel content-card stack">
          <div className="row spread">
            <label className="field">
              <span>Capture purpose</span>
              <select
                value={currentCase.capturePurpose}
                onChange={(e) =>
                  onChange({
                    ...currentCase,
                    capturePurpose: e.target.value as Case["capturePurpose"],
                  })
                }
              >
                <option value="preview">Initial aesthetic preview</option>
                <option value="comprehensive">
                  Comprehensive clinical assessment
                </option>
              </select>
            </label>
            <span className="badge">
              {progress.ready} / {progress.total} baseline views available
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{ width: `${(progress.ready / progress.total) * 100}%` }}
            />
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            A photo checklist does not establish surgical suitability. Assess
            clinical findings and indicated records separately.
          </p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="capture-grid">
          {PHOTO_SLOTS.filter((s) => s.core || showExtra).map((slot) => {
            const photo = currentCase.photos.find(
                (p) => p.type === slot.type && !p.archived,
              ),
              required =
                currentCase.capturePurpose === "preview"
                  ? slot.type === "maximum_smile"
                  : slot.core,
              notIndicated = currentCase.notIndicated.includes(slot.type);
            return (
              <div className="panel capture-card" key={slot.type}>
                <div className="row spread">
                  <h3>{slot.label}</h3>
                  <span
                    className={`badge ${photo && !photo.missing && !photo.isIllustration ? "success" : ""}`}
                  >
                    {notIndicated
                      ? "Not indicated"
                      : required
                        ? "Baseline"
                        : "Conditional"}
                  </span>
                </div>
                <p>{slot.instruction}</p>
                <div className="capture-image">
                  {photo?.url ? (
                    slot.type === "video" ? (
                      <video src={photo.url} controls playsInline />
                    ) : (
                      <img src={photo.url} alt={slot.label} />
                    )
                  ) : (
                    <div
                      className="stack"
                      style={{ alignItems: "center", gap: 8 }}
                    >
                      {slot.type === "video" ? (
                        <Video size={28} />
                      ) : (
                        <Camera size={28} />
                      )}
                      <small>
                        {photo?.missing
                          ? "Media unavailable on this device"
                          : "No local media yet"}
                      </small>
                    </div>
                  )}
                </div>
                <div className="capture-actions">
                  <label className="btn">
                    <Upload size={16} />
                    <span>
                      {busy === slot.type
                        ? "Importing…"
                        : photo
                          ? "Replace"
                          : "Upload"}
                    </span>
                    <input
                      className="sr-only"
                      type="file"
                      aria-label={`Upload ${slot.label}`}
                      accept={slot.type === "video" ? "video/*" : "image/*"}
                      disabled={busy !== null}
                      onChange={(e) => {
                        void upload(e.target.files?.[0], slot.type);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="btn">
                    <Camera size={16} />
                    <span>Camera</span>
                    <input
                      className="sr-only"
                      type="file"
                      aria-label={`Capture ${slot.label} with camera`}
                      accept={slot.type === "video" ? "video/*" : "image/*"}
                      capture="user"
                      disabled={busy !== null}
                      onChange={(e) => {
                        void upload(e.target.files?.[0], slot.type);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {photo?.url && slot.type === "video" && (
                  <VideoFrameCapture
                    photo={photo}
                    onFrame={(file, type, source) => upload(file, type, source)}
                  />
                )}{" "}
                {photo && slot.type !== "video" && (
                  <button
                    className={`btn ${photo.id === currentCase.activePhotoId ? "subtle" : ""}`}
                    onClick={() => {
                      onChange(selectPhoto(currentCase, photo.id));
                      onDesign();
                    }}
                  >
                    {photo.id === currentCase.activePhotoId ? (
                      <Check size={16} />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    Use for design
                  </button>
                )}
                {photo && (
                  <>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={photo.qualityReviewed}
                        onChange={(e) =>
                          onChange({
                            ...currentCase,
                            photos: currentCase.photos.map((p) =>
                              p.id === photo.id
                                ? { ...p, qualityReviewed: e.target.checked }
                                : p,
                            ),
                          })
                        }
                      />
                      <span>
                        Reviewed focus, exposure, pose, landmark visibility and
                        patient side.
                      </span>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={photo.filters === "none"}
                        onChange={(e) =>
                          onChange({
                            ...currentCase,
                            photos: currentCase.photos.map((p) =>
                              p.id === photo.id
                                ? {
                                    ...p,
                                    filters: e.target.checked
                                      ? "none"
                                      : "unknown",
                                  }
                                : p,
                            ),
                          })
                        }
                      />
                      <span>No beauty filters or geometric edits applied.</span>
                    </label>
                    {photo.isIllustration && (
                      <span className="badge warning">
                        Illustration · replace for patient use
                      </span>
                    )}
                  </>
                )}
                {slot.type !== "maximum_smile" && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={notIndicated}
                      onChange={(e) =>
                        onChange({
                          ...currentCase,
                          notIndicated: e.target.checked
                            ? [...currentCase.notIndicated, slot.type]
                            : currentCase.notIndicated.filter(
                                (t) => t !== slot.type,
                              ),
                        })
                      }
                    />
                    <span>Not clinically indicated for this assessment</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn" onClick={() => setShowExtra(!showExtra)}>
          {showExtra
            ? "Hide conditional views"
            : "Show bite, occlusal, shade and video records"}
        </button>
        <Notice>
          Preserve consistent camera distance, natural head position and
          lighting. Shade and dimensional estimates from photographs need
          clinical confirmation. Radiographs or CBCT are collected only when
          clinically indicated.
        </Notice>
      </div>
    </div>
  );
}
