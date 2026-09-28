type Env = { get: (key: string) => string | undefined };
type ModelCheck = {
  model: string;
  status: "ready" | "available" | "error";
  message: string;
};

export const textModelSupported = (model: string) => {
  const version = /^gemini-(\d+)\.(\d+)/.exec(model);
  return (
    !!version &&
    (Number(version[1]) > 3 ||
      (Number(version[1]) === 3 && Number(version[2]) >= 5))
  );
};

function failure(status: number): string {
  if (status === 400)
    return "Google rejected the request. Check the API key type and model configuration.";
  if (status === 401 || status === 403)
    return "Google denied access. Check the API key, permissions and model access in AI Studio.";
  if (status === 404)
    return "This model is unavailable for the Google API project. Check model access and its configured name.";
  if (status === 429)
    return "Gemini quota or rate limit reached. Check API quota/billing and retry later.";
  return "Google could not complete the connection check. Retry after checking service availability.";
}

/** Uses fixed nonclinical input; never reads a case or returns a credential. */
export async function checkGeminiConnection(
  env: Env,
  fetcher: typeof fetch = fetch,
) {
  const secret = env.get("GEMINI_API_KEY")?.trim();
  if (!secret)
    return {
      status: 503,
      body: {
        error: "Add GEMINI_API_KEY under Supabase Edge Functions → Secrets.",
      },
    };
  const textModel = env.get("GEMINI_TEXT_MODEL") ?? "gemini-3.8-flash";
  const imageModel = env.get("GEMINI_IMAGE_MODEL") ?? "gemini-3.1-flash-image";
  const headers = {
    "x-goog-api-key": secret,
    "Content-Type": "application/json",
  };
  async function textCheck(): Promise<ModelCheck> {
    if (!textModelSupported(textModel))
      return {
        model: textModel,
        status: "error",
        message:
          "Configure a Gemini 3.5+ text model. No older-model fallback is enabled.",
      };
    try {
      const response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(textModel)}:generateContent`,
        {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "API connectivity test. No patient information. Reply with the single word READY.",
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 128 },
          }),
        },
      );
      if (!response.ok)
        return {
          model: textModel,
          status: "error",
          message: failure(response.status),
        };
      const output = await response.json();
      const hasText = output.candidates?.[0]?.content?.parts?.some(
        (p: { text?: string; thought?: boolean }) =>
          !p.thought && p.text?.trim(),
      );
      return hasText
        ? {
            model: textModel,
            status: "ready",
            message:
              "A live text response was received. No patient data were sent.",
          }
        : {
            model: textModel,
            status: "error",
            message:
              "Google responded without usable text. Retry the check and review model access.",
          };
    } catch (e) {
      return {
        model: textModel,
        status: "error",
        message:
          e instanceof Error && e.name === "TimeoutError"
            ? "The text check timed out. Retry after checking service availability."
            : "The text model could not be reached. Retry the check.",
      };
    }
  }
  async function imageCheck(): Promise<
    ModelCheck & { generationTested: false }
  > {
    try {
      const response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(imageModel)}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok)
        return {
          model: imageModel,
          status: "error",
          message: failure(response.status),
          generationTested: false,
        };
      const metadata = await response.json();
      return typeof metadata.name === "string" &&
        metadata.name.endsWith(`/${imageModel}`)
        ? {
            model: imageModel,
            status: "available",
            message:
              "Image model access confirmed. Image generation has not been tested.",
            generationTested: false,
          }
        : {
            model: imageModel,
            status: "error",
            message:
              "Google returned unexpected image model information. Check its configured name.",
            generationTested: false,
          };
    } catch {
      return {
        model: imageModel,
        status: "error",
        message: "The image model could not be reached. Retry the check.",
        generationTested: false,
      };
    }
  }
  const [text, image] = await Promise.all([textCheck(), imageCheck()]);
  return {
    status: 200,
    body: {
      keyConfigured: true,
      text,
      image,
      checkedAt: new Date().toISOString(),
    },
  };
}
