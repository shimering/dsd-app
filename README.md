# Smile Studio

A fresh React/TypeScript smile design editor on `rebuild-v2`, built around **Photos → Measure → Lip outline → Teeth → Compare**.

```sh
npm ci
cp .env.example .env.local
# Set the existing Supabase URL and public publishable key.
npm run dev
```

Preview: http://127.0.0.1:5174. Choose a photo or open **Tooth library** to review the corrected crown assets. See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the guided workflow and acceptance gates.

The manual editor passed 13 unit/integration and 32 browser checks. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the tested scope, backend deployment, screenshots, and remaining acceptance work. A hosted Cloudflare preview is pending the browser file-upload permission; the prepared public build is in `dist` and `.preview/smile-studio-preview.zip`.

```sh
npm test
npm run test:browser
npm run check:edge
npm run build
```

The Supabase migration is additive: `dsd_workspaces` and an authenticated `smile-assist` function. The existing `dsd_cases`/`smile-ai` backend and the live app remain compatible. Deploy only the new migration/function. Configure `GEMINI_API_KEY` server-side, optional `GEMINI_ASSIST_MODEL`, `GEMINI_RENDER_MODEL`, and `SMILE_ALLOWED_ORIGINS`. Public frontend keys are not Gemini credentials.

Cloudflare preview deployment uses a separate `dsd-app-rebuild` worker (`npm run deploy:preview` after Wrangler sign-in). Build from `rebuild-v2`; do not merge or deploy this branch over the live `dsd-app` without review. If automated GitHub builds require a new repository access grant, use the prepared `dist` upload preview until that connection is explicitly authorized.

Clinical reference material and prior planning are retained in [docs/reference](docs/reference). This is a visual simulation prototype; physical iPad/Pencil and authenticated provider testing remain acceptance requirements.
