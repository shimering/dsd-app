# Rebuild verification — 28 September 2026

The manual rebuild implements **Photos → Measure → Lip outline → Teeth → Compare**. The initial review checks below were completed on `rebuild-v2`; the user subsequently authorized replacing the previous GitHub version.

## Checks completed

- **13 unit/integration tests passed:** original-image coordinate transforms, calibrated values under zoom/rotation/resize/reopening, lip validation, undo/redo, symmetric FDI placement, proposal provenance, owner RLS, ownership immutability, consent, rate limiting, provider errors, and stale results.
- **32 browser tests passed in Chromium and desktop WebKit:** multiple photos; calibration; every manual measurement tool; cancelled edits; numeric adjustments; undo/redo; lip confirmation; all ten teeth; comparison; labelled PNG exports; offline persistence; storage failure visibility; backup and missing-media recovery; synthetic pen/two-finger state transitions; desktop, iPad landscape, and phone layouts in both themes. The full phone workflow was exercised in both themes.
- **60 crown combinations checked:** four forms × three textures × five tooth types. Every cervical cap is rounded, and both premolar types have one visible pointed cusp. The five tooth types are mirrored to cover FDI 15–25.
- **Pixel checks passed:** mockups leave pixels outside the confirmed lip opening unchanged. Comparison exports retain identical source framing, preserve the before side, omit editing guides, and include a simulation label. Draft outlines do not paint a mockup.
- `npm run build` and `npm run check:edge` passed. Dependencies are pinned; npm audit reported zero vulnerabilities after the compatible Vite 6.4.3 update. [Vite advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff).

## Deployed additive backend

Supabase project `ievxqrnqeahljepcjhfp` now contains the new `dsd_workspaces` table and `smile-assist` version 1, with JWT verification enabled. The migration version is `20260928125937`. Existing `dsd_cases` and `smile-ai` version 5 remain unchanged; their source and migration history are retained.

Remote checks confirmed owner policies for SELECT, INSERT, UPDATE, and DELETE; anonymous table/RPC access denied; ownership reassignment denied. The deployed endpoint returned 200 for allowed preflight and 401 for an unauthenticated POST. No patient photo was transmitted during these checks.

The advisor flags authenticated access to the consent/reservation `SECURITY DEFINER` RPC. This access is intentional: it checks `auth.uid()` ownership, consent, source revision, and cooldown, and updates only the server-owned reservation timestamp. Anonymous execution is revoked, the search path is empty, and denial paths are exercised in the Postgres integration tests. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The existing account configuration also has leaked-password protection disabled. That account-wide setting was not changed as part of this rebuild. [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Preview and remaining acceptance work

The local preview runs at http://127.0.0.1:5174/. The production build is in `dist`; a ZIP containing only the built public app is prepared at `.preview/smile-studio-preview.zip`. It contains no patient originals or server credentials.

Cloudflare publishing remains pending. Automatic approval review rejected a new Cloudflare/GitHub connection because it could grant repository access. Static upload through the already authenticated Cloudflare session was then blocked by the Edge extension's file-access permission. No new worker was deployed and no live settings were changed. An upload of `dist` to a separate `dsd-app-rebuild` worker, or an explicitly approved Git build connection, is required for a hosted review URL.

The tested branch is pushed to [GitHub rebuild-v2](https://github.com/shimering/dsd-app/tree/rebuild-v2). The GitHub connector denied draft PR creation with an integration-permission error; automatic approval review then rejected a browser fallback as an alternate route around that access-control failure. No pull request was created. Using the signed-in browser session to create a draft PR requires specific user approval.

Physical iPad Safari and Apple Pencil testing, clinician review on real photos, and authenticated end-to-end Gemini/account testing are still required. Synthetic pointer events and desktop WebKit do not establish device support. Existing Gemini server secrets are reused; their validity and model access were not tested with a patient request.

Review the corrected [tooth arch](previews/tooth-review.png) and [iPad layout](previews/ipad-landscape.png), then follow [WORKFLOW.md](WORKFLOW.md). Advanced clinical features remain in the roadmap.

## Promotion authorized by the user

On 28 September 2026 the user requested pushing the updates to GitHub and replacing the previous version. The production configuration now targets the existing `dsd-app` worker, and both the dashboard's `npx wrangler deploy` command and `npm run deploy:cloudflare` use that target. The previous source remains recoverable in Git history and tag `legacy-before-v2-20260928` at `5b54a3ceaa14629302e48e2073a3d374c5093aef`.

Supabase `smile-assist` version 2 now allows the existing production origin, with JWT verification still enabled. Its production-origin preflight passed remotely without transmitting a photo. A regression check was added: 14 unit/integration tests, edge type checks, production build, public configuration validation, and the Wrangler dry run passed. The frontend rendering is unchanged from the 32 passing browser tests above.

The committed `.env.production` contains only the public Supabase URL and publishable key, allowing the Cloudflare build to retain the existing account integration without needing new dashboard variables. Server credentials and patient media remain excluded.
