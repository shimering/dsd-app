import { get, set, del, keys } from 'idb-keyval';

/**
 * Local Photo Storage Layer
 * Uses browser IndexedDB to keep 100% of patient medical photographs
 * private on the clinician's machine without requiring cloud buckets.
 */

const PHOTO_PREFIX = 'dsd_photo_';
const MASK_PREFIX = 'dsd_mask_';
const SIM_PREFIX = 'dsd_sim_';

export async function saveLocalPhoto(caseId: string, photoType: string, fileOrDataUrl: string | Blob): Promise<string> {
  const key = `${PHOTO_PREFIX}${caseId}_${photoType}`;
  await set(key, fileOrDataUrl);
  return key;
}

export async function getLocalPhoto(keyOrPath: string): Promise<string | null> {
  if (!keyOrPath) return null;
  // If it's already an inline data URI or http link, return as is
  if (keyOrPath.startsWith('data:') || keyOrPath.startsWith('http')) {
    return keyOrPath;
  }
  const data = await get<string | Blob>(keyOrPath);
  if (!data) return null;

  if (typeof data === 'string') {
    return data;
  }
  // Convert Blob to Object URL
  return URL.createObjectURL(data);
}

export async function saveLocalSimulation(caseId: string, jobId: string, imageBase64: string): Promise<string> {
  const key = `${SIM_PREFIX}${caseId}_${jobId}`;
  await set(key, imageBase64);
  return key;
}

export async function deleteCaseLocalPhotos(caseId: string): Promise<void> {
  const allKeys = await keys();
  for (const key of allKeys) {
    if (typeof key === 'string' && key.includes(caseId)) {
      await del(key);
    }
  }
}
