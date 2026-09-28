// Pad to a provider-supported ratio without changing the patient's proportions.
export const imageRatios = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
] as const;
export function imageFrame(width: number, height: number, maxSize = 1600) {
  if (![width, height, maxSize].every((v) => Number.isFinite(v) && v > 0))
    throw new Error("Invalid image dimensions.");
  const ratio = width / height;
  const aspectRatio = imageRatios.reduce((best, candidate) => {
    const value = (s: string) => {
      const [w, h] = s.split(":").map(Number);
      return w / h;
    };
    return Math.abs(Math.log(value(candidate) / ratio)) <
      Math.abs(Math.log(value(best) / ratio))
      ? candidate
      : best;
  });
  const [rw, rh] = aspectRatio.split(":").map(Number),
    selectedRatio = rw / rh;
  const frameWidth = Math.max(width, height * selectedRatio),
    frameHeight = Math.max(height, width / selectedRatio);
  const scale = Math.min(1, maxSize / Math.max(frameWidth, frameHeight));
  return {
    aspectRatio,
    frameWidth,
    frameHeight,
    offsetX: (frameWidth - width) / 2,
    offsetY: (frameHeight - height) / 2,
    scale,
    width: Math.round(frameWidth * scale),
    height: Math.round(frameHeight * scale),
  };
}
