# Responsive DSD evaluation release — verification

Verified on 28 September 2026 in the Windows development workspace, including the requested expansion through both second premolars. This is an evaluation prototype for clinician-reviewed upper-ten-tooth design (FDI 15–25), not a clinically validated surgical planning system.

## Completed checks

| Check | Result |
|---|---|
| TypeScript and Vite production build | Passed |
| Unit and database checks | 77 passed across 6 files, including the authenticated AI connection check |
| Chromium and WebKit browser checks | Full upper-ten suite: 73 passed, 1 intentionally skipped; subsequent connection-check and dialog-focus checks: 4 passed |
| Supabase Edge Function Deno type check | Passed |
| Dependency security audit | 0 vulnerabilities in the installed dependency audit; 0 production vulnerabilities |
| Treatment PDF | All 18 complete-workflow exports contained 4 pages and all ten FDI sections; a representative export was rendered and all pages visually inspected |
| Responsive UI | Light phone and dark desktop screenshots visually inspected; layout checks passed in both themes at every listed size |

Both themes and all five destinations were tested at 320×568, 390×844, 430×932, 1024×768, 1180×820, 1366×1024, 1280×800, 1440×900 and 1920×1080. The complete clinical workflow ran in Chromium and WebKit at every size, using synthetic media and explicit mocked AI responses.

Browser coverage includes upload, per-photo calibration, tooth editing, undo/redo, findings, consent, three AI alternatives and manual application, consultation, draft approval, PDF/image downloads, stale results, provider quota failures, mask review, aesthetic acceptance, backup/import and missing-media recovery. Browser layout checks found no page-wide horizontal overflow in the exercised views. Keyboard checks covered focus trapping, focus restoration and reduced motion. Resizing between portrait, landscape and a shorter keyboard viewport preserved entered values.

Premolar coverage verifies ten canvas teeth and ten selectable FDI controls, edits at both second premolars across the responsive sizes/themes, ten treatment cards, and inclusion in AI clinical context and exports. Existing six-tooth records were recovered from IndexedDB in both engines at phone and iPad widths. The upgrade preserves original anterior geometry, historical revisions, media keys and calibration, adds unknown premolar findings, invalidates previous results/approval, and is idempotent. Separate unit checks cover multiple photo revisions, partially entered premolars and distinct first/second premolar outlines.

Geometry checks cover the nine viewport sizes and four rotations with forward/inverse coordinate transforms. Calibration stays in original image coordinates. Mouse cancellation discards an unfinished edit. A Chromium CDP test exercised trusted touch pinch and pen events, including palm-event rejection. That CDP-only test is intentionally skipped in WebKit; it does not verify actual Apple Pencil hardware.

The compositor checks passed in both engines: every decoded pixel outside the reviewed mask remained identical to the original, and incompatible generated image framing was rejected. This proves the compositing boundary, not clinical fidelity or accurate tooth registration in live generated images.

Clinical checks cover unknown values, source/method/confirmation requirements, signed CEJ measurements, same-site criteria, non-finite input rejection, conditional clearance and KTW calculations, coronal movement, zero movement and clearance shortfalls. No default universal clinical threshold or automatic gingivectomy/ostectomy prescription is asserted.

The authenticated connection check rejects missing/anonymous sessions and extra case/media fields, handles absent secrets, provider access and quota errors, and requires actual text content before returning readiness. Browser checks in both engines verify that its request contains only the connection-check operation and distinguishes image-model availability from generation testing. These checks use explicit provider mocks; they are not live API verification.

The production build reports a nonblocking main-bundle size warning (approximately 600KB minified / 173KB gzip) and dependency annotation warnings. PDF generation is loaded separately when exported.

## Dedicated Supabase deployment

Project: `Dsd`, reference `ievxqrnqeahljepcjhfp`.

- Migration `20260928091330_dsd_cases.sql` applied successfully.
- Authenticated `smile-ai` Edge Function deployed, version 4, ACTIVE, JWT verification enabled. The prompt and clinical context cover FDI 15–25. The new connection-check operation uses a fixed nonclinical prompt and image-model metadata without reading case records.
- Function bundle SHA256: `31eea3355b2bf940608cb6c3a06dc37f43589bf943d513541bfe464090814c1f`.
- The live public Auth settings endpoint responded 200; unauthenticated case access responded 401; unauthenticated AI responded 401; allowed localhost preflight responded 204.
- A rollback-only database check verified owner read/insert, rejection of ownership reassignment, hidden cross-owner reads, zero cross-owner updates/deletes, rejected cross-owner inserts and rejected anonymous reads. Authenticated users have case CRUD privileges but no TRUNCATE privilege. RLS is enabled.
- All synthetic test rows were rolled back. The project contained zero case rows after verification. No test signup emails were sent.
- No media Storage bucket is used. Original photos, videos, masks and generated composites are stored in IndexedDB. The database holds structured case data and media/output metadata.

The supplied publishable frontend key is configured in ignored `.env.local`. Private Google credentials are never included in frontend environment variables or the repository.

## Remaining release checks

The user has reported adding `GEMINI_API_KEY` to the project's Edge Function secrets. Live key acceptance and provider response verification are pending clinician sign-in and **Account and local backup → Check AI connection**. This check does not transmit patient data. Subsequent patient-specific suggestions, consultation and simulation require recorded cloud consent and clinician review. Suggestions/consultation default to `gemini-3.8-flash`; simulation uses the separately configured `gemini-3.1-flash-image`. The provider contracts are tested, but no live Gemini response has been verified. Image-model metadata access alone does not establish successful image generation. A Gemini app subscription does not itself configure an API key or quota.

Configure Supabase Auth's site URL, allowed redirect URLs and email/signup settings for the actual frontend origin before onboarding clinicians. Production frontend hosting has not been deployed; the development preview is at `http://127.0.0.1:5173/`.

Real iPad Safari, Apple Pencil and physical phone Safari/Chrome remain unverified, including real keyboard behavior, split-screen, rotation, camera capture and interrupted gestures. Automated WebKit tests are not equivalent to an iPad or iPhone. The optional Firefox runtime remains unverified because its Windows executable reports an incorrect side-by-side configuration involving `mozglue`; reinstalling the official Playwright Firefox runtime did not resolve that host issue.

Obtain periodontal and restorative expert review of the clinical data model, calculations, treatment language and live simulation behavior before stronger clinical accuracy claims or clinical deployment. The current export and UI distinguish photo estimates, proposed design movements, clinical findings, aesthetic acceptance and clinician approval. Unknown findings remain unknown, and unresolved conditions stay visible in treatment drafts.

The tests exercise representative workflows; they do not certify WCAG conformance, regulatory status, every device/browser combination or all clinical scenarios.
