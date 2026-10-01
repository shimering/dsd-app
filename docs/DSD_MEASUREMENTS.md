# Six-tool DSD smile frame

The **Measure** stage offers six adjustable guides across the ten upper teeth, from second premolar to second premolar: **15, 14, 13, 12, 11, 21, 22, 23, 24, 25**. The former 66-item smile checklist is replaced by six cards.

| Tool                       | Coverage                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Midline                    | Facial horizontal, facial midline, and dental midline; confirmed offset and angle                                                            |
| Smile curve                | Ten upper incisal-edge / visible cusp landmarks plus five inner lower-lip reference points                                                   |
| Interdental proportion     | Ten-tooth ruler with symmetric targets for lateral/central, canine/lateral, first-premolar/canine, and second-premolar/first-premolar widths |
| Central incisor proportion | Target width/height outlines for 11 and 21                                                                                                   |
| Gingival curve             | Ten gingival zeniths                                                                                                                         |
| Papilla curve              | Nine papilla tips, from 15–14 through 24–25                                                                                                  |

## Fit and confirm

1. Select a card to add its provisional template. Compatible saved facial references, smile curves, gingival and papilla landmarks seed the corresponding guides; other guides start from the existing provisional ten-tooth layout.
2. Drag individual reference points to refine the shape. The teal handle below the frame moves the guide, the square handle resizes uniformly, and the round top handle rotates. Numeric center coordinates and resize/rotation buttons provide another way to adjust placement. Mouse and pen editing are supported; enable finger edit mode to drag on touch devices. Two fingers continue to navigate the photo.
3. Set desired proportion percentages in the two proportion cards. The templates resize symmetrically while preserving configured ratios. Starting widths follow **1 : 0.8 : 0.74 : 0.62 : 0.55** from central incisor to second premolar, and central width/height starts at **82%**. These are adjustable design targets.
4. Open **Landmarks and hidden anatomy** to adjust exact point coordinates or mark cropped / hidden landmarks unavailable. Their tooth or papilla identities stay in place. Curves break at unavailable points rather than interpolate unseen anatomy. At least one reference line or a curve with three visible landmarks is needed for confirmation.
5. **Confirm guide** records a guide as set; later geometry or target changes return it to draft. **Reset guide** restores its provisional template. A whole guide can be marked unavailable and restored. Undo/redo and cancelled gestures preserve the existing editor behavior.

The progress display counts **six guides**, rather than individual endpoints. The selected guide and midline references appear by default; **Show all guides** displays the other saved guides. The two smile curves appear together for comparison. The clinician's smile-arc classification remains within that card.

In **Teeth**, **Show confirmed smile guides** displays confirmed frames over the editable design. Guides do not resize or reposition tooth layers. Comparison views and exported simulations omit frame overlays.

## Calibration and saved cases

Midline offset is calculated from confirmed references in the facial frame. Distances use pixels until the photo is calibrated against a known reference; ratios and angles need no scale. Calibration and free distance, polyline, angle, reference-line and ink tools remain under **Annotations**. Photo-view selection is in the secondary **Photo view and calibration notes** controls and does not change the six-card roster.

Templates and desired ratios are stored separately from observed measurements in optional `Photo.dsd.basicFrame` data, using original-photo coordinates. Old cases keep all their named measurements and unavailable reasons. Their measurement lists are available under the collapsed **Saved annotations** section. Local saves, cloud case records and JSON backups retain both old records and the new frame without a database migration.

## Gemini assistance

**Assist six tools with Gemini** uses the new `basic-frame` operation. Gemini proposes placement geometry or unavailable reasons for all six tools, including the ten tooth identities and nine papilla identities. It never selects the user's desired ratios. Missing landmarks retain their key and an unavailable reason.

Review suggestions over the source photo and select tools before applying. Confirmed user guides are protected; unselected suggestions are skipped. Accepted placements remain drafts until manually confirmed. Unknown or duplicate tools, incomplete landmark identities, target injection, invalid coordinates and stale proposals are rejected. Sign-in, patient consent, ownership/revision checks and the existing request interval still apply. Manual tools remain available during provider failures.

Deploy the updated `smile-assist` handler before the frontend so it accepts the optional stored frame and the new operation. The legacy `assessment` operation remains compatible with older clients.

## Verification

Automated checks cover second-premolar coverage, symmetric target geometry, transformations, midline calculations, hidden landmarks, undo/cancellation, photo rotation and zoom, local reopening, backups, legacy cases and cloud conflicts. Gemini tests cover complete six-tool responses, normalized coordinates, review/application, protected confirmed guides and preserved user targets. Browser checks include Chromium, WebKit and phone layouts. Physical iPad/Pencil use and authenticated provider quality require device and clinician review.
