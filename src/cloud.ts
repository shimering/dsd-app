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
  if (expected === undefined) {
    const { error } = await supabase
      .from('dsd_workspaces')
      .insert({ id: body.id, owner_id: user.id, body, revision: 1 });
    if (error)
      throw new Error(
        error.code === '23505'
          ? 'This case already exists in the cloud. Load cloud cases before syncing.'
          : error.message,
      );
    return 1;
  }
  const { data, error } = await supabase
    .from('dsd_workspaces')
    .update({ body, revision: expected + 1 })
    .eq('id', body.id)
    .eq('revision', expected)
    .select('revision');
  if (error) throw new Error(error.message);
  if (!data.length)
    throw new Error(
      'A newer cloud version exists. Back up your local case, then load the cloud version into a separate case.',
    );
  return data[0].revision;
}
