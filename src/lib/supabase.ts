import { createClient } from "@supabase/supabase-js";
import { Case } from "../types";
import { stripRuntime } from "./storage";
import { caseSchema } from "./validation";
import { expandUpperDesign } from "./case-model";
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";
export const isSupabaseConfigured =
  !!url && !!key && !url.includes("your-project") && !key.includes("your-");
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
const stamps = new Map<string, string>();
const queues = new Map<string, Promise<void>>();
export async function loadCloudCases(): Promise<Case[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dsd_cases")
    .select("id,owner_id,body,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    stamps.set(row.id, row.updated_at);
    return expandUpperDesign({
      ...caseSchema.parse(row.body),
      ownerId: row.owner_id,
    } as Case);
  });
}
export function saveCloudCase(c: Case, ownerId: string): Promise<void> {
  const pending = (queues.get(c.id) ?? Promise.resolve())
    .catch(() => {})
    .then(() => writeCloudCase(c, ownerId));
  queues.set(c.id, pending);
  return pending;
}
async function writeCloudCase(c: Case, ownerId: string) {
  if (!supabase) throw new Error("Connect Supabase before using cloud AI.");
  const row = {
    id: c.id,
    owner_id: ownerId,
    body: stripRuntime({ ...c, ownerId }),
    updated_at: new Date().toISOString(),
  };
  const stamp = stamps.get(c.id);
  const query = stamp
    ? supabase
        .from("dsd_cases")
        .update(row)
        .eq("id", c.id)
        .eq("updated_at", stamp)
    : supabase.from("dsd_cases").insert(row);
  const { data, error } = await query.select("updated_at").single();
  if (error)
    throw new Error(
      stamp
        ? "Cloud save failed or this case changed on another device. Your local copy is retained; reload before syncing."
        : `Cloud save failed: ${error.message}`,
    );
  stamps.set(c.id, data.updated_at);
}
