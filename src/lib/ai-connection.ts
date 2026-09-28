import { z } from "zod";
import { supabase } from "./supabase";

const model = z.object({ model: z.string(), message: z.string() });
const connectionSchema = z.object({
  keyConfigured: z.literal(true),
  text: model.extend({ status: z.enum(["ready", "error"]) }),
  image: model.extend({
    status: z.enum(["available", "error"]),
    generationTested: z.literal(false),
  }),
  checkedAt: z.string(),
});
export type AiConnectionStatus = z.infer<typeof connectionSchema>;

export async function checkAiConnection(): Promise<AiConnectionStatus> {
  if (!supabase)
    throw new Error("Configure Supabase before checking AI access.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    throw new Error(
      "Sign in to your clinician account to check the AI connection.",
    );
  const { data, error } = await supabase.functions.invoke("smile-ai", {
    body: { operation: "connection_check" },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let message =
      "AI connection check failed. Check your account, function deployment and server secrets.";
    if (error.context instanceof Response) {
      try {
        const payload = await error.context.json();
        if (typeof payload.error === "string") message = payload.error;
      } catch {}
    }
    throw new Error(message);
  }
  return connectionSchema.parse(data);
}
