import { useRef, useState } from "react";
import { PhotoAsset, PhotoType } from "../../types";
import { Camera } from "lucide-react";
export function VideoFrameCapture({
  photo,
  onFrame,
}: {
  photo: PhotoAsset;
  onFrame: (
    file: File,
    type: PhotoType,
    source: { mediaId: string; frameTimeSec: number },
  ) => Promise<void>;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    [type, setType] = useState<PhotoType>("maximum_smile"),
    [error, setError] = useState("");
  async function capture() {
    const video = ref.current;
    if (!video || video.readyState < 2) {
      setError("Play or seek to a decoded frame first.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Frame capture failed."))),
          "image/png",
        ),
      );
      await onFrame(
        new File([blob], `video-frame-${video.currentTime.toFixed(2)}s.png`, {
          type: "image/png",
        }),
        type,
        { mediaId: photo.id, frameTimeSec: video.currentTime },
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Frame could not be captured.");
    }
  }
  return (
    <div className="stack">
      <video
        ref={ref}
        src={photo.url}
        controls
        playsInline
        style={{
          width: "100%",
          maxHeight: 240,
          background: "var(--canvas)",
          borderRadius: 10,
        }}
      />
      <label className="field">
        <span>Use selected frame as</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PhotoType)}
        >
          <option value="maximum_smile">Maximum smile</option>
          <option value="social_smile">Social smile</option>
          <option value="rest">Frontal at rest</option>
        </select>
      </label>
      <button className="btn" onClick={() => void capture()}>
        <Camera size={16} />
        Capture selected frame
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
