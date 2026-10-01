# Frontal reference tooth set

The library includes ten separate RGBA crowns under **Form → Frontal reference**, covering FDI 15–25. Both canines (13 and 23) have a modest downward-pointing incisal cusp, as requested.

- Assets: `public/teeth/frontal-reference/{15,14,13,12,11,21,22,23,24,25}.png`
- Metadata: `public/teeth/frontal-reference/manifest.json`
- Final generated atlas: `docs/reference/frontal-reference-atlas.png`
- Library preview: `docs/previews/frontal-reference-library.png`
- Importer: `node scripts/import-reference-teeth.mjs <transparent-atlas.png>`
- Each side has its own crown asset; reference crowns are never mirrored at render time.
- The reference set has one enamel texture. Existing visual shades and lighting controls work normally.
- The library review shows the arch and individual crowns, with a download link for each PNG.
- The new form is accepted in local cases, presets, backups, and workspace validation.

These are **reference-based ImageGen reconstructions**, rather than lossless segmentation of the original low-resolution photograph. Occluded edges were completed, and the canine cusps were deliberately changed. Width, height, placement, and rotation remain adjustable in the editor. Small molar fragments at the outer edges of the photograph are outside the current ten-tooth library.

Validation: 62 unit/integration tests, 28 focused browser scenarios across Chromium and WebKit, and the production build passed. The browser checks verify ten distinct sprites, transparent corners, downward canine cusps, unmirrored left-side rendering, individual and whole-smile styling, persistence, downloads, and export. Desktop and phone previews were visually inspected; the phone dialog has no horizontal overflow and its keyboard focus wraps correctly. Production publishing follows the existing main-branch Cloudflare workflow; release verification is recorded in [VERIFICATION.md](VERIFICATION.md).

Built-in `image_gen.imagegen` was used, with true transparent-background output. The importer identifies the ten connected crowns, crops them into independent PNGs, preserves their enamel pixels and antialiasing, and discards faint gutter noise. It does not recolor or transform the perspective.

## Prompt set

### Initial extraction and atlas

```text
Use case: background-extraction
Asset type: transparent tooth atlas for a digital smile design app.
Input image 1 is the EDIT TARGET: the user's frontal smile photograph. Extract and separate the ten visible maxillary crowns through the second premolars, preserving their appearance and their perspective AS SEEN FROM THE FRONT OF THE WHOLE SMILE. This is one atlas asset, not a dental illustration.
Remove all lips, gingiva, mouth, black background, lower teeth, lettering and watermarks. Preserve the photographed white enamel color, subtle grey translucency, light reflections, crown contour, and asymmetry. Do not replace the teeth with generic isolated anatomical teeth. Do not rotate posterior teeth into a full buccal head-on view: they must retain the narrower frontal-smile perspective in the reference. Complete only tiny crown areas occluded by adjacent teeth or gingiva, minimally and naturally. No roots.
Composition: a strict grid of FIVE EQUAL WIDTH COLUMNS and TWO EQUAL HEIGHT ROWS on true transparent background, landscape 3:2 canvas. Exactly one detached crown centered inside each cell with generous fully transparent gutters. All crowns upright with cervical top and incisal/cusp bottom, never upside down. Preserve the actual different crown proportions, not five identical crown shapes.
FIRST ROW left to right: patient right upper second premolar 15, first premolar 14, canine 13, lateral incisor 12, central incisor 11. These are the five teeth on the IMAGE LEFT side, excluding the far edge molar fragments. 
SECOND ROW left to right: patient left upper central incisor 21, lateral incisor 22, canine 23, first premolar 24, second premolar 25. These are the five teeth on the IMAGE RIGHT side, excluding the far edge molar fragments.
Central incisors have the broad gently squared rounded incisal edges of the reference. Laterals retain the shorter rounded shape. Canines and premolars retain the visible frontal photographic contour, not sharp triangular spear-like silhouettes. Keep right and left unique. No labels, no grid lines, no cast shadows outside enamel, no decorative background. Alpha=0 everywhere outside teeth.
```

### Frontal perspective refinement

```text
Use case: precise-object-edit
Asset type: transparent 10-tooth atlas for digital smile design.
Image 1 is the PRIMARY SOURCE PHOTO, a frontal view of the entire smile. Image 2 is the EDIT TARGET atlas. Correct only the crown proportions and frontal perspective in the atlas to match image 1 much more closely. The atlas currently makes posterior teeth too broad, as though individually photographed head-on; FIX THIS. Preserve photographed enamel appearance and the right/left asymmetry. Use the source photo contours.
Exactly 10 separate crowns on actual transparent background in strict 5 columns by 2 rows. Top row 15,14,13,12,11. Bottom row 21,22,23,24,25. No text, labels, gum, roots, background, grids, or exterior shadow.
Camera: frontal projection of the WHOLE dental arch; posterior teeth are viewed obliquely and appear progressively NARROWER. Keep that perspective baked into their outlines. Do not show broad isolated buccal faces on the canines and premolars. Do not rotate these teeth to view them head-on.
Crucial projected width/height ratios, based on image 1: central incisors about 0.75; lateral incisors about 0.60; canines about 0.45; first premolars about 0.33; second premolars about 0.27. The second premolars MUST be long narrow slivers, the first premolars narrow, canines less broad than laterals. Keep tooth contours and asymmetric highlights of the photo. These are photographic crowns seen from frontal smile perspective, not full anatomical illustrations.
Canvas landscape 1536x1024. Equal-width 307px columns, 512px rows. Each crown fully inside its cell. Cervical top and incisal edge/cusp bottom. Relative height: centrals 340px; laterals 310px; canines 325px; first premolars 280px; second premolars 260px. Relative width: centrals 255px; laterals 186px; canines 146px; first premolars 92px; second premolars 70px. Center each tooth in its assigned cell and preserve clean fully transparent gutters. Use the rounded rectangular incisal edge of the reference on the centrals, rounded laterals, and the blunt visible cusps of the photo on posterior teeth. Preserve incisal translucency. Minimal completion only where the source photo hides a crown edge. True RGBA transparency outside teeth.
```

### Final canine refinement

```text
Use case: precise-object-edit.
Edit target: the attached transparent 10-crown atlas.
Make ONLY the TWO CANINES slightly pointy at their INCISAL EDGE, with the cusp tip POINTING DOWNWARD.
The canines are the THIRD tooth from the LEFT in the TOP row (FDI 13) and the THIRD tooth from the LEFT in the BOTTOM row (FDI 23). Their cervical ends remain at the top. Modify the BOTTOM edge of each of these two teeth to have a modest, natural, single downward cusp, positioned about the middle of the incisal edge. Mesial and distal incisal slopes should converge to the tip. It should be subtly pointy rather than flat or fully rounded, not an exaggerated fang. Preserve their enamel texture and highlights.
Keep the other EIGHT teeth completely unchanged. Keep every tooth in its current location, same size, same frontal smile projection, same white enamel appearance. Do not add a tip to the top. Do not sharpen the premolars. No gum, no roots, no lettering or labels.
Preserve actual transparent background and clean transparent gaps between all crowns. Output the same two-row five-column atlas.
```
