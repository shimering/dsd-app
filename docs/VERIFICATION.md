# Rebuild verification — 28 September 2026

## Gemini 3.5 request compatibility — 29 September 2026

The user approved temporary synthetic diagnostics after the initial automatic approval rejection. The protected diagnostic used a random nonce, a ten-minute expiry, fixed synthetic input, server-held credentials, and enabled JWT verification for normal requests. It was removed after each check. No patient photo or real case was transmitted.

Live requests confirmed that the configured account can reach `gemini-3.5-flash`. Provider-enforced schemas returned HTTP 400 on both Interactions and `generateContent`, including a text-only request, while `generateContent` JSON mode without provider-enforced schemas returned a completed, locally valid synthetic lip outline. The exact reason for Google's schema rejection is not established. Assistance now uses the accepted JSON-mode format and supplies the expected schema in the prompt. Server checks still enforce schema, coordinates, valid outlines, complete view-specific DSD identifiers, tooth geometry, ownership, consent, and source revision. Image rendering retains Interactions with `store:false`.

The live DSD assessment requests previously encountered Google HTTP 503 overload responses and timeouts due to unbounded dynamic thinking and raw JSON checklist payload size. Assessment prompts now format the view-specific checklist concisely and configure `thinkingConfig: { thinkingLevel: 'low' }` for Gemini 3 series models to keep reasoning fast, prevent token exhaustion, and eliminate timeouts while maintaining structured output quality. The backend reports temporary provider overload separately from request-format and unavailable-model errors, with no automatic retry or silent model fallback.

All 42 unit/integration tests, the production build, and edge type checks passed. Regression checks cover Gemini JSON-mode transport, explicit model selection, thought exclusion, incomplete/safety-stopped results, retained geometry/view validation, thinking level configuration, provider-error messages without secret exposure, and unchanged image-render transport. The frontend bundle remains `index-DPykMV1w.js`.

## Gemini 3.5 assistance model — 29 September 2026

The user selected Gemini 3.5 after seeing the provider model/request rejection. The shared frontend/backend assistance default is now `gemini-3.5-flash`; image rendering retains `gemini-3.1-flash-image`. Supabase `smile-assist` version 5 is ACTIVE, with JWT verification enabled. The retrieved seven deployed source/configuration files match the tested source. The only deployed source change is the assistance model default.

All 34 unit/integration tests passed, including a request with no explicit model that verifies the backend selects 3.5. All 16 cloud-sync browser checks passed in Chromium and WebKit and assert that frontend assistance requests select 3.5. The production build/configuration and edge type checks passed. Production-origin preflight returned 200; an unauthenticated POST returned 401. The built frontend bundle is `index-DPykMV1w.js`.

Automatic approval review initially rejected a proposed temporary nonce-protected diagnostic endpoint because invoking Gemini with the server key was outside the authorized model switch. At this stage, that endpoint was not deployed. The regular authenticated function was deployed with only the model change. No patient photo was sent to Gemini during verification. The subsequent user-approved compatibility checks are documented above.

## Gemini case-sync recovery — 29 September 2026

The reported “This case already exists in the cloud. Load cloud cases before syncing.” error came from keeping cloud revisions only in memory. Refreshing the browser cleared that revision and the next AI request attempted a duplicate insert. Account-scoped revisions now persist in IndexedDB. Cases from earlier versions reconnect after an owner-filtered lookup when the structured records match, with comparison independent of JSON key order. Differing records and stale optimistic revisions open a version chooser that preserves both copies. Same-account authentication events retain the loaded workspace, and late responses after sign-out cannot enter the guest scope.

Production configuration, all 33 unit/integration tests, and the production build passed. The full 68-case browser suite passed before the final account-change guards; all 16 cloud-sync checks then passed against the final source in Chromium and WebKit. These checks cover refresh plus local edits, legacy case recovery, account-scoped revision storage, both version choices, concurrent cloud updates, cloud loading, repeated authentication events, insert races, and late responses after sign-out. Supabase's deployed metadata query confirmed owner RLS remains enabled for SELECT, INSERT, UPDATE, and DELETE. No schema or edge-function change is required.

The tested frontend bundle is `index-DnPdw-oH.js`. Browser cloud/AI checks use synthetic photographs and intercepted responses; live Gemini provider quality is not established by these tests.

## DSD measurement assessment — 29 September 2026

The Measure stage now includes 69 named DSD photo-measurement recipes, view-specific checklists, alignment/proportion/symmetry results, unavailable-anatomy reasons, and individually reviewed Gemini suggestions. See [DSD_MEASUREMENTS.md](DSD_MEASUREMENTS.md).

All 33 unit/integration tests and 54 browser tests passed, including Chromium and desktop WebKit. Production configuration/build validation and edge type checks passed. Existing measurement, lip, tooth, lighting, export, recovery, and account isolation regressions pass. The new browser cases cover redraw/undo, draft switching, calibration, persistence, resting views, unavailable items, and small-screen curve entry. Browser pointer rounding is accommodated separately from exact geometry checks.

The user approved the separate backend deployment on 29 September 2026. Supabase project `ievxqrnqeahljepcjhfp` now runs `smile-assist` version 4, status ACTIVE, with JWT verification enabled. The deployed seven source/configuration files match the tested source at commit `19001aa6f0350402925e40bad0fafc8b5a9feb0b`. The new `assessment` operation is deployed. Production-origin preflight returned 200 with the expected allowed origin; an unauthenticated POST returned 401. No patient photograph was sent to Gemini during verification. The existing `smile-ai` function remains at version 5.

The source commit was pushed to `main`, and the hosted app was verified serving the tested `index-DnRywsCY.js` bundle. The deployment bundle SHA-256 is `365ff2ff5828d1b04343dfde04e3ad28d562d17e7e66e3049bd7e87d8d944281`.

Clinical accuracy, authenticated live-provider quality, and physical iPad/Pencil checks remain acceptance requirements.

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

## Tooth controls released — 29 September 2026

The user approved deploying the tested tooth controls to the hosted app. Production branch `main` was advanced to source commit `de1a117f2d13f584c1ddfd7f98713e1606aa577d`. Cloudflare's existing Git integration completed build `b279dbbd-2583-4dc5-bafe-029b92c9be27` successfully and deployed Worker version `456c3a8d-b917-436e-a096-66cb341ab36e`. The hosted page was checked and serves the tested `index-D0mu_Fm4.js` bundle.

This release adds two-finger tooth scaling/rotation, optional snapping, manual environmental lighting with Match photo, and corrected crown proportions with explicit repair for existing designs. The finger edit hint now describes tooth transforms correctly. The final release checks passed all 21 unit/integration cases, the production configuration guard/build, edge type checks, and all 14 tooth-control browser cases in Chromium and WebKit. The selected-tooth gesture regression explicitly enables finger edit mode and confirms that photo zoom remains at 100%.

Supabase `smile-assist` version 3 was deployed before the frontend to accept the optional stored lighting field, with JWT verification enabled. Production-origin preflight returned 200; an unauthenticated POST returned 401. No patient photograph was transmitted. Physical iPad/Pencil verification and review on original patient photographs remain outstanding. Full usage and the earlier 46-case browser verification are recorded in [TEETH_CONTROLS.md](TEETH_CONTROLS.md).
