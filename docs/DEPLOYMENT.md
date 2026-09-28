# GitHub and Cloudflare deployment

The frontend uses the existing Cloudflare Worker **dsd-app** with Workers Static Assets. Supabase hosts authentication, structured cases and the authenticated `smile-ai` function. Patient media stay in IndexedDB on the browser/device where they were captured.

Repository: [shimering/dsd-app](https://github.com/shimering/dsd-app), production branch `main`.

Frontend URL: [Smile Studio](https://dsd-app.gazarxperia.workers.dev).

## Automatic frontend updates

In Cloudflare → Workers & Pages → dsd-app → Settings → Builds, connect `shimering/dsd-app` and use:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npm run deploy:cloudflare` |
| Build variable `VITE_SUPABASE_URL` | `https://ievxqrnqeahljepcjhfp.supabase.co` |
| Build variable `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's public `sb_publishable_…` key, also configured in local `.env.local` |

These are **build-time** variables. An assets-only Worker has no runtime environment variables. `.node-version` pins the build Node version; Wrangler is pinned in `package-lock.json`. `wrangler.jsonc` targets the existing Worker, uploads only `dist`, and enables SPA navigation routing.

Pushing a commit to `main` triggers Cloudflare's native Git integration. The build validates public configuration, runs the unit/database checks, and compiles the frontend before publishing it. Failed builds leave the previous deployment serving. Check the Cloudflare build log and the commit's GitHub checks to confirm deployment. No separate GitHub Actions deployment credentials are required.

Private Gemini credentials belong in Supabase Edge Function secrets. Keep `.env.local`, `supabase/.env.production`, patient backup files and generated media outside the repository. The frontend publishable key is public; owner-based RLS protects the structured records.

## Supabase production origin

Set the dedicated project's Authentication → URL Configuration site URL to:

```text
https://dsd-app.gazarxperia.workers.dev
```

Allow that URL and the development origins `http://127.0.0.1:5173` and `http://localhost:5173` as sign-in redirects. New account confirmation emails should return to the app that initiated signup.

Set `DSD_ALLOWED_ORIGINS` in Edge Function secrets to:

```text
http://localhost:5173,http://127.0.0.1:5173,https://dsd-app.gazarxperia.workers.dev
```

`GEMINI_API_KEY` remains server-side in the same project. After deployment, verify the hosted account panel and **Check AI connection**, then test consented case-specific workflows. Cloudflare preview URLs need their own explicit origin approval before cloud AI can be used there.

## Local verification and backend releases

```sh
npm ci
npm run build:cloudflare
npx wrangler deploy --dry-run
```

Cloudflare automatically publishes the frontend. Apply SQL migrations and deploy `smile-ai` through the dedicated Supabase project when backend code changes; the frontend build does not apply database migrations. Record backend deployment versions in `docs/RELEASE_VERIFICATION.md`.

Browser storage is scoped to an origin. To move records and photos from the localhost preview to the hosted app, export a local backup from localhost and import it on the hosted URL. Structured cloud records sync after clinician sign-in; original media need the backup on the destination browser/device.

Official configuration references: [Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), and [SPA asset routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).
