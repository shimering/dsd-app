import { createStore, get, set, del } from 'idb-keyval';
import {
  workspaceSchema,
  newWorkspace,
  uid,
  now,
  assertPhotoGeometry,
  type Workspace,
} from './domain';
const store = createStore('smile-studio-v2', 'local');
export const saveMedia = async (key: string, blob: Blob) =>
  set(
    'media:' + key,
    { mime: blob.type, bytes: await blob.arrayBuffer() },
    store,
  );
export const loadMedia = async (key: string): Promise<Blob | undefined> => {
  const value = await get<Blob | { mime: string; bytes: ArrayBuffer }>(
    'media:' + key,
    store,
  );
  if (!value) return;
  return value instanceof Blob
    ? value
    : new Blob([value.bytes], { type: value.mime });
};
export const removeMedia = (key: string) => del('media:' + key, store);
export async function inspectImage(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255,
    png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v),
    webp =
      String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  if (
    !(
      (blob.type === 'image/jpeg' && jpeg) ||
      (blob.type === 'image/png' && png) ||
      (blob.type === 'image/webp' && webp)
    )
  )
    throw new Error(
      'Image bytes do not match JPEG, PNG, or WebP. Convert the original file and try again.',
    );
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error(
      'This photo could not be decoded. Convert it to JPEG or PNG and try again.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function loadWorkspaces(scope: string): Promise<Workspace[]> {
  const value = await get<unknown>('cases:' + scope, store);
  if (!value) return [];
  if (!Array.isArray(value))
    throw new Error('Local case records could not be read. Restore a backup.');
  return value.map((v) => workspaceSchema.parse(v));
}
export const saveWorkspaces = (scope: string, cases: Workspace[]) =>
  set(
    'cases:' + scope,
    cases.map((c) => workspaceSchema.parse(c)),
    store,
  );
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportBackup(workspaces: Workspace[]) {
  const media: Record<string, { mime: string; data: string }> = {};
  for (const workspace of workspaces)
    for (const photo of workspace.photos)
      for (const key of [photo.mediaKey, photo.render?.mediaKey].filter(
        (k): k is string => !!k,
      )) {
        const blob = await loadMedia(key);
        if (blob)
          media[key] = {
            mime: blob.type,
            data: await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve(String(reader.result).split(',')[1]);
              reader.onerror = () =>
                reject(new Error('Could not read local media.'));
              reader.readAsDataURL(blob);
            }),
          };
      }
  const blob = new Blob(
    [
      JSON.stringify({
        format: 'smile-studio-backup',
        version: 1,
        workspaces,
        media,
      }),
    ],
    { type: 'application/json' },
  );
  if (blob.size > 150 * 1024 * 1024)
    throw new Error('This backup exceeds 150 MB. Export one case at a time.');
  download(
    blob,
    'smile-studio-backup-' + new Date().toISOString().slice(0, 10) + '.json',
  );
}
export async function importBackup(
  file: File,
  ownerId?: string,
): Promise<Workspace[]> {
  if (file.size > 150 * 1024 * 1024)
    throw new Error('Backups must be under 150 MB.');
  const raw = JSON.parse(await file.text());
  if (
    raw.format !== 'smile-studio-backup' ||
    raw.version !== 1 ||
    !Array.isArray(raw.workspaces) ||
    raw.workspaces.length > 100
  )
    throw new Error('Choose a Smile Studio v2 backup.');
  const cases: Workspace[] = raw.workspaces.map((value: unknown) =>
    workspaceSchema.parse(value),
  );
  const queued: Array<{ key: string; blob: Blob }> = [];
  for (const c of cases) {
    c.id = uid();
    c.ownerId = ownerId;
    c.consent = null;
    c.createdAt = now();
    c.updatedAt = now();
    c.name = c.name.slice(0, 110) + ' (imported)';
    const photos = new Map<string, string>();
    for (const p of c.photos) {
      assertPhotoGeometry(p);
      const old = p.id,
        oldRevision = p.revision;
      p.id = uid();
      photos.set(old, p.id);
      p.revision++;
      const originalKey = p.mediaKey;
      for (const kind of ['original', 'render'] as const) {
        const oldKey = kind === 'original' ? originalKey : p.render?.mediaKey;
        if (!oldKey) continue;
        const input = raw.media?.[oldKey],
          key = uid();
        if (kind === 'original') p.mediaKey = key;
        else if (p.render) {
          p.render.mediaKey = key;
          if (p.render.sourceRevision === oldRevision)
            p.render.sourceRevision = p.revision;
        }
        if (!input) {
          if (kind === 'render') p.render = null;
          continue;
        }
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(input.mime) ||
          typeof input.data !== 'string' ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)
        )
          throw new Error('The backup includes invalid image bytes.');
        const bytes = Uint8Array.from(atob(input.data), (ch) =>
            ch.charCodeAt(0),
          ),
          blob = new Blob([bytes], { type: input.mime }),
          size = await inspectImage(blob);
        if (kind === 'original') {
          if (
            size.width !== p.width ||
            size.height !== p.height ||
            input.mime !== p.mimeType
          )
            throw new Error(
              'A backup photo does not match its original geometry.',
            );
          if (p.sha256) {
            const hash = Array.from(
              new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
              (byte) => byte.toString(16).padStart(2, '0'),
            ).join('');
            if (hash !== p.sha256)
              throw new Error(
                'An original photo fingerprint in this backup does not match.',
              );
          }
        } else if (
          Math.abs(size.width / size.height / (p.width / p.height) - 1) > 0.03
        )
          throw new Error('A rendered backup image has mismatched framing.');
        queued.push({ key, blob });
      }
    }
    c.activePhotoId = photos.get(c.activePhotoId) ?? c.photos[0]?.id ?? '';
  }
  for (const item of queued) await saveMedia(item.key, item.blob);
  return cases;
}
export function localBlank() {
  return newWorkspace('My first case');
}
