import { AiOperation, Case } from "../types";
import { activePhoto, hasConsent } from "./case-model";
import { imageData, designData } from "./media";
import { activeRevision } from "./case-model";
import { supabase, saveCloudCase } from "./supabase";
import { suggestionSchema } from "./validation";
export const isGeminiConfigured = !!supabase;
export async function requestAi(
  c: Case,
  operation: AiOperation,
  question?: string,
) {
  if (!hasConsent(c))
    throw new Error(
      "Record patient consent before sending images or clinical findings to cloud AI.",
    );
  if (!supabase)
    throw new Error("Configure the Supabase project to use cloud AI.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    throw new Error("Sign in to your clinician account to use cloud AI.");
  const photo = activePhoto(c);
  if (
    !photo?.url ||
    photo.missing ||
    photo.type === "video" ||
    photo.isIllustration
  )
    throw new Error(
      "Upload and select a patient photograph first. Illustrated demos cannot be used for clinical AI.",
    );
  await saveCloudCase(c, session.user.id);
  const body = {
    operation,
    caseId: c.id,
    revisionId: c.activeRevisionId,
    contextVersion: c.contextVersion,
    photoId: photo.id,
    media: await imageData(photo.url, 1600, operation === "simulation"),
    question,
    designMedia:
      operation === "simulation"
        ? await designData(photo, activeRevision(c).teeth, true)
        : undefined,
  };
  const { data, error } = await supabase.functions.invoke("smile-ai", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    const context = (error as any).context;
    if (context instanceof Response) {
      try {
        const payload = await context.json();
        throw new Error(payload.error ?? error.message);
      } catch (e) {
        if (
          e instanceof Error &&
          e.message !== error.message &&
          !e.message.includes("JSON")
        )
          throw e;
      }
    }
    throw new Error(
      "Cloud AI is unavailable. Check function deployment, account access and server configuration.",
    );
  }
  if (data?.error) throw new Error(data.error);
  if (
    !data?.provenance ||
    data.provenance.caseId !== c.id ||
    data.provenance.revisionId !== c.activeRevisionId ||
    data.provenance.contextVersion !== c.contextVersion ||
    data.provenance.photoId !== photo.id
  )
    throw new Error(
      "The result belongs to another revision. Request a fresh result.",
    );
  if (operation === "suggestions") return suggestionSchema.parse(data);
  if (
    operation === "consultation" &&
    (typeof data.answer !== "string" || !data.answer.trim())
  )
    throw new Error("Invalid consultation response.");
  if (
    operation === "simulation" &&
    (!["image/png", "image/jpeg", "image/webp"].includes(
      data.image?.mimeType,
    ) ||
      typeof data.image?.data !== "string")
  )
    throw new Error("No usable image returned.");
  return data;
}
