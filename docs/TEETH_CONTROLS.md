# Tooth gestures and lighting — 29 September 2026

## Fix list

- [x] Two-finger tooth rotation and uniform scaling.
- [x] Optional snapping for rotation and scale.
- [x] Manual environment lighting and shadow controls, with Match photo.
- [x] Correct overly elongated starting teeth and add proportion repair for existing designs.
- [x] Publish the frontend and shared AI function update.
- [ ] Verify on a physical iPad and original patient photographs.

## Rotate and scale

1. Open **Teeth** and select a tooth using the photo or FDI buttons.
2. Spread/pinch two fingers to scale it uniformly; twist to rotate it. Moving the two fingers also moves the tooth.
3. Enable **Move and style the whole smile** to transform every tooth together, retaining arch proportions and relative rotations.
4. Enable **Apply snapping** for attraction within 1.5° of a 5° angle and within 1.25 percentage points of a 5% scale step. Selected teeth snap their absolute rotation; the arch snaps its rotation change. The preference is retained on this device.
5. Choose **Pan** to pan/zoom the photo. Two-finger tooth editing works with finger edit mode off; that mode controls single-finger edits.

Each completed tooth gesture creates one undo step. Pointer cancellation, lost capture, and Escape discard the preview. Extra fingers do not change the active pair. Other workflow stages retain photo navigation.

## Tooth proportions

After placing the ten upper overlays, press **Recalculate from measurements** to fit the whole active design to confirmed Measure guides. The button becomes available when a confirmed tooth-proportion, usable dental-midline, incisal, or gingival guide is present. Changing guides does not automatically edit teeth. This explicit fit preserves form, texture, shade, visibility, perspective, lighting, saved annotations, guide targets, and other design alternatives. Undo/redo restores the operation as a single edit; the resulting geometry persists in cases and backups.

Fitting uses the following priorities:

- The confirmed ten-tooth ruler supplies symmetric crown widths and arch positions, including both second premolars. The central-incisor target sets the width/height ratio for 11 and 21. Without a ruler, the confirmed central outlines supply the positions and sizes of those two teeth only.
- The confirmed dental line aligns the arch center and rotation. Facial references continue to show the facial comparison. A dental line with no downward component cannot define crown alignment.
- Visible incisal and gingival curves constrain crown edges. With a proportion layout or dental line, the fitter intersects the visible curve with each crown axis. Without those constraints, paired landmarks give that tooth's observed axis and crown height. A single edge keeps the existing height. Resizing from the ruler preserves an existing crown ratio unless a confirmed central target or paired edge curves provide its height.
- A confirmed central proportion takes priority over the gingival height when it differs from the incisal-to-gingival gap; the incisal edge remains aligned, and the cervical edge may differ from the gingival guide. Review and refine the guides or the tooth after applying.
- Null landmarks never supply a constraint or get interpolated across a missing section. A tooth with no applicable constraint retains its geometry. Papilla and inner lower-lip curves remain visual references rather than being interpreted as crown borders. Conflicting reversed edges or unrepresentable crown sizes leave the affected tooth unchanged and are reported after the fit.

Calibration and photo rotation/zoom do not change this fit: all geometry uses original-photo coordinates and the configured dimensionless ratios.

The earlier placement stretched crowns to 90% of the lip opening height. A deep opening therefore produced excessively long teeth. Starting crown heights now come from their widths with tooth-specific visual ratios, and the upper arch is positioned near the upper lip rather than stretched across the complete oral opening. Opening height controls clipping and the available space.

**Restore natural proportions** repairs the selected tooth, or all teeth when whole-smile mode is enabled or no tooth is selected. It preserves crown width, rotation, and the cervical midpoint while restoring height. Each repair is undoable; the clinician can still adjust width/height independently. Two-finger scaling preserves the restored ratios. Existing designs are repaired explicitly rather than rewritten on load.

The central-incisor default is an adjustable 0.82 width-to-height visual ratio. This is a design starting point, informed by an aesthetics study that found 82% attractive in its normal-form examples; the study also reports individual variation. The defaults are not patient-specific measurements. [Cooper et al., 2012](https://pubmed.ncbi.nlm.nih.gov/22722122/)

## Lighting and shadows

Expand **Lighting & shadows** in the Teeth inspector. All controls apply to the active smile design, independently of single-tooth selection:

- **Brightness, warmth, saturation:** adapt enamel to the photograph.
- **Soften highlights:** reduce the bright highlights already present in the tooth textures.
- **Upper lip shadow / Shadow reach:** follow the confirmed upper lip contour and fade inward.
- **Posterior shadow:** darken the sides of the arch.
- **Light balance:** adjust shading from left to right.
- **Match photo:** sample brighter, low-chroma original enamel inside the confirmed lip outline and apply an editable starting point. If reliable enamel cannot be found, use the manual controls.
- **Reset lighting:** restore neutral lighting; undo can restore the previous values.

The renderer processes the transparent tooth layer. The editor, comparison, and PNG exports use the same lighting. Changing lighting clears any existing AI rendered preview so the updated editable teeth are visible. Settings belong to each design and survive local reopening, backup/import, duplication, and presets. Records without lighting remain readable and retain their prior appearance.

The source crowns are 2D images with baked highlights. These controls improve compositing and provide approximate environmental shading; they do not recover a 3D material or a physical light source. Neutral-light source textures would allow stronger future relighting. Match photo is a starting point requiring visual review on the actual photograph.

The official DSD documentation describes texture selection and adjustments to brightness, saturation, and hue to fit the photograph. Our shadow and matching controls are this app's implementation. [DSD App documentation](https://digitalsmiledesign.com/dsd-app)

## Verification and release

- 21 unit/integration cases passed, including crown-height independence from a deep opening, preservation of the cervical midpoint during proportion repair, rotated viewport transforms, whole-arch proportions, optional snapping, scale limits, angle wraparound, and AI record compatibility.
- All 46 browser cases passed across Chromium and desktop WebKit, including the existing workflow plus tooth gestures, third-finger handling, cancellation, single-step undo/redo, single-tooth/whole-arch proportion repair, navigation, lighting persistence and backup restoration, curved-lip shadows, posterior/directional shading, preserved enamel alpha, and export equivalence. The lighting persistence test explicitly waits for local saving before reloading.
- Build and edge type checks passed. Desktop, iPad landscape, and phone layouts were inspected without horizontal overflow using a fictional fixture.
- Physical iPad Safari/Pencil and visual review on original patient photographs remain unverified.

Released to [the hosted app](https://dsd-app.gazarxperia.workers.dev) on 29 September 2026 from production branch `main`, source commit `de1a117f2d13f584c1ddfd7f98713e1606aa577d`. Cloudflare build `b279dbbd-2583-4dc5-bafe-029b92c9be27` succeeded and deployed Worker version `456c3a8d-b917-436e-a096-66cb341ab36e`. The hosted page serves the tested `index-D0mu_Fm4.js` bundle. Refresh an already open tab to load this version.

The shared `src/domain.ts` schema accepts optional design lighting. Supabase `smile-assist` version 3 was deployed first with JWT verification enabled; production-origin preflight returned 200 and an unauthenticated POST returned 401. No photograph was sent in those checks. No database migration was needed for the existing JSON case body. The final pre-release check reran all 21 unit/integration cases, the production build and edge type checks, and all 14 tooth-control browser cases across Chromium and WebKit, explicitly enabling finger edit mode for the selected-tooth pinch/twist test.
