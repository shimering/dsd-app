import { createClient, type User } from '@supabase/supabase-js';
import { workspaceSchema, type Workspace } from './domain';
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export type CloudRecord = { workspace: Workspace; version: number };
export class CloudConflictError extends Error {
  constructor(public readonly record: CloudRecord) {
    super(
      'This device and the cloud have different versions of this case. Choose which version to continue with; both copies will be kept.',
    );
    this.name = 'CloudConflictError';
  }
}
export function sameWorkspace(a: Workspace, b: Workspace): boolean {
  const canonical = (workspace: Workspace) =>
    JSON.stringify(workspaceSchema.parse(workspace), (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
    );
  return canonical(a) === canonical(b);
}
async function fetchCloudCase(
  id: string,
  ownerId: string,
): Promise<CloudRecord | null> {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const { data, error } = await supabase
    .from('dsd_workspaces')
    .select('body,revision')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const workspace = workspaceSchema.parse(data.body);
  if (workspace.id !== id || workspace.ownerId !== ownerId)
    throw new Error(
      'This cloud case is unavailable for the signed-in account.',
    );
  return { workspace, version: data.revision };
}
export async function fetchCloud(): Promise<CloudRecord[]> {
  if (!supabase)
    throw new Error(
      'Cloud accounts are not configured. Local tools are available.',
    );
  const { data, error } = await supabase
    .from('dsd_workspaces')
    .select('body,revision');
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    workspace: workspaceSchema.parse(row.body),
    version: row.revision,
  }));
}
export async function syncCloud(
  workspace: Workspace,
  user: User,
  expected?: number,
): Promise<number> {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const body = { ...workspace, ownerId: user.id };
  workspaceSchema.parse(body);
  if (workspace.ownerId && workspace.ownerId !== user.id)
    throw new Error('This case belongs to another account.');
  if (expected === undefined) {
    const existing = await fetchCloudCase(body.id, user.id);
    if (existing) {
      if (sameWorkspace(body, existing.workspace)) return existing.version;
      throw new CloudConflictError(existing);
    }
    const { error } = await supabase
      .from('dsd_workspaces')
      .insert({ id: body.id, owner_id: user.id, body, revision: 1 });
    if (error) {
      if (error.code === '23505') {
        const existing = await fetchCloudCase(body.id, user.id);
        if (existing) {
          if (sameWorkspace(body, existing.workspace)) return existing.version;
          throw new CloudConflictError(existing);
        }
      }
      throw new Error(error.message);
    }
    return 1;
  }
  const { data, error } = await supabase
    .from('dsd_workspaces')
    .update({ body, revision: expected + 1 })
    .eq('id', body.id)
    .eq('owner_id', user.id)
    .eq('revision', expected)
    .select('revision');
  if (error) throw new Error(error.message);
  if (!data.length) {
    const existing = await fetchCloudCase(body.id, user.id);
    if (existing) throw new CloudConflictError(existing);
    throw new Error(
      'This cloud case is unavailable. Your local edits are still saved on this device.',
    );
  }
  return data[0].revision;
}
