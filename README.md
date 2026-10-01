# Smile Studio

A React/TypeScript smile design editor built around **Photos → Measure → Lip outline → Teeth → Compare**. **Measure** includes six adjustable DSD smile-frame tools covering ten upper teeth through both second premolars, visual proportion targets, and reviewed Gemini assistance. See [docs/DSD_MEASUREMENTS.md](docs/DSD_MEASUREMENTS.md).

```sh
npm ci
cp .env.example .env.local
# Set the existing Supabase URL and public publishable key.
npm run dev
```

Preview: http://127.0.0.1:5174. Choose a photo or open **Tooth library** to review the corrected crown assets. See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the guided workflow and acceptance gates.

The current manual editor has 33 passing unit/integration and 54 passing browser cases. The tooth gesture, proportion, and lighting update is live at [Smile Studio](https://dsd-app.gazarxperia.workers.dev) and described in [docs/TEETH_CONTROLS.md](docs/TEETH_CONTROLS.md); see [docs/VERIFICATION.md](docs/VERIFICATION.md) for tested scope, backend deployment, screenshots, and remaining acceptance work. Production releases must reach `main` to trigger Cloudflare; pushes to `rebuild-v2` alone do not publish the app. The current public build is in `dist`; the earlier ZIP in `.preview/smile-studio-preview.zip` has not been refreshed for this update.

```sh
npm test
npm run test:browser
npm run check:edge
npm run build
```

The Supabase migration is additive: `dsd_workspaces` and an authenticated `smile-assist` function. The existing `dsd_cases`/`smile-ai` backend and the live app remain compatible. Deploy only the new migration/function. Configure `GEMINI_API_KEY` server-side, optional `GEMINI_ASSIST_MODEL`, `GEMINI_RENDER_MODEL`, and `SMILE_ALLOWED_ORIGINS`. Public frontend keys are not Gemini credentials.

Production deployment targets the existing `dsd-app` worker (`npm run deploy:cloudflare` after Wrangler sign-in). The user authorized replacing the previous version on 28 September 2026. Cloudflare previews use the separate `dsd-app-rebuild` worker (`npm run deploy:preview`). If the Git connection requires a new repository access grant, that permission must be approved separately.

`.env.production` contains only the existing Supabase URL and public publishable key, so the hosted build reuses the account integration even without dashboard build variables. These values are public browser configuration; Gemini and privileged Supabase credentials remain server-side. `npm run check:cloudflare-env` validates the public configuration before deployment.

Clinical reference material and prior planning are retained in [docs/reference](docs/reference). This is a visual simulation prototype; physical iPad/Pencil and authenticated provider testing remain acceptance requirements.
