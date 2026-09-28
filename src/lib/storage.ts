import { get, set, entries, setMany } from "idb-keyval";
import { Case } from "../types";
import { expandUpperDesign, migrateCase, now, uid } from "./case-model";
import { caseSchema } from "./validation";
export function stripRuntime(c: Case): Case {
  return {
    ...c,
    photos: c.photos.map(({ url, missing, ...p }) => p),
    simulations: c.simulations.map(({ url, missing, ...s }) => s),
  };
}
export async function saveCases(cases: Case[], owner = "local") {
  await set(`dsd_cases_v2_${owner}`, cases.map(stripRuntime));
}
export async function hydrateCase(c: Case): Promise<Case> {
  c = expandUpperDesign(c);
  return {
    ...c,
    photos: await Promise.all(
      c.photos.map(async (p) => {
        const data = await readMedia(p.mediaKey);
        return {
          ...p,
          url: data ? URL.createObjectURL(data) : undefined,
          missing: !data,
        };
      }),
    ),
    simulations: await Promise.all(
      c.simulations.map(async (s) => {
        const data = await readMedia(s.mediaKey);
        return {
          ...s,
          url: data ? URL.createObjectURL(data) : undefined,
          missing: !data,
        };
      }),
    ),
  };
}
export async function loadCases(owner = "local"): Promise<Case[]> {
  const saved = await get<Case[]>(`dsd_cases_v2_${owner}`);
  if (saved)
    return Promise.all(saved.map((c) => hydrateCase(caseSchema.parse(c))));
  if (owner !== "local") return [];
  const legacy =
    localStorage.getItem("dsd_app_cases") ??
    localStorage.getItem("dsd_local_cases_v1");
  if (!legacy) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(legacy);
  } catch {
    throw new Error(
      "Legacy records could not be read. They have been retained for recovery.",
    );
  }
  if (!Array.isArray(raw))
    throw new Error("Legacy case data is invalid and has been retained.");
  const cases = raw.map(migrateCase);
  for (const c of cases)
    for (const p of c.photos) {
      let blob: Blob | undefined;
      if (p.url?.startsWith("data:")) blob = await (await fetch(p.url)).blob();
      else if (p.url) {
        const old = await get<Blob | string>(p.url);
        if (old)
          blob =
            typeof old === "string" ? await (await fetch(old)).blob() : old;
      }
      if (!blob) {
        p.url = undefined;
        p.missing = true;
        continue;
      }
      p.mediaKey = `dsd_media_${uid()}`;
      await set(p.mediaKey, await encodeMedia(blob));
      p.url = URL.createObjectURL(blob);
      p.mimeType = blob.type;
      p.isIllustration = blob.type === "image/svg+xml";
      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () =>
            reject(
              new Error(
                "An imported photo cannot be decoded. Legacy records are retained for recovery.",
              ),
            );
          image.src = p.url!;
        },
      );
      const sx = dimensions.width / p.width,
        sy = dimensions.height / p.height;
      p.guides = Object.fromEntries(
        Object.entries(p.guides).map(([key, points]) => [
          key,
          points.map((point) => ({ x: point.x * sx, y: point.y * sy })),
        ]),
      ) as typeof p.guides;
      for (const revision of c.revisions.filter((r) => r.photoId === p.id))
        for (const tooth of Object.values(revision.teeth)) {
          tooth.x *= sx;
          tooth.y *= sy;
          tooth.widthPx *= sx;
          tooth.heightPx *= sy;
        }
      p.width = dimensions.width;
      p.height = dimensions.height;
    }
  await saveCases(cases);
  localStorage.removeItem("dsd_app_cases");
  localStorage.removeItem("dsd_local_cases_v1");
  return cases;
}
export async function saveMedia(blob: Blob) {
  const key = `dsd_media_${uid()}`;
  // Byte records avoid file-backed Blob serialization failures in WebKit.
  await set(key, await encodeMedia(blob));
  return key;
}
type LocalMedia = {
  format: "dsd-media-v1";
  mimeType: string;
  bytes: ArrayBuffer;
};
async function encodeMedia(blob: Blob): Promise<LocalMedia> {
  return {
    format: "dsd-media-v1",
    mimeType: blob.type,
    bytes: await blob.arrayBuffer(),
  };
}
export async function readMedia(key: string): Promise<Blob | undefined> {
  const raw = await get<Blob | LocalMedia>(key);
  if (raw instanceof Blob) return raw; // Read existing prototype media without re-writing it.
  if (raw?.format === "dsd-media-v1" && raw.bytes instanceof ArrayBuffer)
    return new Blob([raw.bytes], { type: raw.mimeType });
  return undefined;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read local media."));
    reader.readAsDataURL(blob);
  });
}
export async function exportBackup(cases: Case[]) {
  if (cases.length > 100)
    throw new Error(
      "Export a patient backup for workspaces with more than 100 cases.",
    );
  let estimatedBytes = new Blob([JSON.stringify(cases.map(stripRuntime))]).size;
  const keys = new Set(
    cases.flatMap((c) => [
      ...c.photos.map((p) => p.mediaKey),
      ...c.simulations.flatMap((s) => [s.mediaKey, s.maskKey]),
    ]),
  );
  const media: Record<string, string> = {};
  for (const key of keys) {
    const blob = await readMedia(key);
    if (blob) {
      estimatedBytes += Math.ceil((blob.size * 4) / 3) + 256;
      if (estimatedBytes > 149 * 1024 * 1024)
        throw new Error(
          "This backup exceeds the 150MB import limit. Export individual patient backups; use shorter or smaller capture files for a case over the limit.",
        );
      media[key] = await blobDataUrl(blob);
    }
  }
  downloadBlob(
    new Blob(
      [
        JSON.stringify({
          format: "dsd-local-backup",
          version: 2,
          cases: cases.map(stripRuntime),
          media,
        }),
      ],
      { type: "application/json" },
    ),
    `smile-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
export async function importBackup(
  file: File,
  ownerId?: string,
): Promise<Case[]> {
  if (file.size > 150 * 1024 * 1024)
    throw new Error("Backup is too large. Import a file under 150MB.");
  const raw = JSON.parse(await file.text());
  if (
    raw.format !== "dsd-local-backup" ||
    raw.version !== 2 ||
    !Array.isArray(raw.cases) ||
    !raw.media ||
    raw.cases.length > 100
  )
    throw new Error("Choose a valid Smile Studio version 2 backup.");
  const cases: Case[] = raw.cases.map((c: unknown) => caseSchema.parse(c));
  const replacements = new Map<string, string>();
  const staged: [string, LocalMedia][] = [];
  for (const c of cases)
    for (const old of [
      ...c.photos.map((p) => p.mediaKey),
      ...c.simulations.flatMap((s) => [s.mediaKey, s.maskKey]),
    ]) {
      if (replacements.has(old)) continue;
      const data = raw.media[old];
      if (!data) continue;
      if (
        typeof data !== "string" ||
        !/^data:(image\/[a-zA-Z0-9.+-]+|video\/[a-zA-Z0-9.+-]+|application\/json);base64,/.test(
          data,
        )
      )
        throw new Error("Backup contains unsupported media.");
      const blob = await (await fetch(data)).blob(),
        key = `dsd_media_${uid()}`;
      replacements.set(old, key);
      staged.push([key, await encodeMedia(blob)]);
    }
  await setMany(staged);
  for (const c of cases) {
    c.id = uid();
    c.ownerId = ownerId;
    c.isDemo = false;
    c.contextVersion++;
    c.updatedAt = now();
    c.consents = c.consents.map((r) => ({ ...r, revokedAt: now() }));
    if (c.treatmentPlan) c.treatmentPlan.approval = undefined;
    c.photos.forEach((p) => {
      p.mediaKey = replacements.get(p.mediaKey) ?? "";
    });
    c.simulations.forEach((s) => {
      s.mediaKey = replacements.get(s.mediaKey) ?? "";
      s.maskKey = replacements.get(s.maskKey) ?? "";
    });
  }
  return Promise.all(cases.map(hydrateCase));
}
export async function orphanedMediaCount(cases: Case[]) {
  const used = new Set(
    cases.flatMap((c) => [
      ...c.photos.map((p) => p.mediaKey),
      ...c.simulations.flatMap((s) => [s.mediaKey, s.maskKey]),
    ]),
  );
  return (await entries()).filter(
    ([k]) =>
      typeof k === "string" && k.startsWith("dsd_media_") && !used.has(k),
  ).length;
}
