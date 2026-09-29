# DSD tooth-position assessment

The **Measure** stage now contains a guided assessment before **Lip outline**. The catalog has 69 named photo measurements: 66 apply to a frontal smile, 53 to a retracted view, and five to a resting view. These are photo measurements and visual references for clinician review.

## Workflow

1. Add suitable full-face smile, retracted anterior, and lips-at-rest photographs. Set **Assessment photo view** for each original.
2. Calibrate each photo using a known, clinician-confirmed dimension in the measurement plane. Until then, distances use pixels. Ratios and angles do not require calibration.
3. Choose a checklist item and follow its endpoint instructions. Reference lines use two points; smile curves need at least three points and **Finish length**.
4. Mark cropped or unreliable anatomy **not visible**. Measured, unavailable, and remaining items are counted separately.
5. Review the calculated assessment. Select a recorded item to move endpoints or edit original-image coordinates. **Redraw this measurement** replaces that item; undo/redo remains available.
6. Continue to **Lip outline** and tooth design. Smile-reference curves do not replace the clipping outline.

The canvas shows common references and the selected measurement by default. Select either smile curve to compare both, or enable **Show all DSD overlays**. Geometry, view selection, unavailable reasons, and clinician smile-arc classification persist in local cases, cloud records, and backups. Existing cases remain compatible.

## Coverage

| Group | Recorded geometry |
| --- | --- |
| Facial and dental alignment | Facial horizontal / interpupillary line, facial and dental midlines, central incisal plane, canine/anterior plane |
| Tooth dimensions and axes | Apparent width, height, and visible crown axis for FDI 13, 12, 11, 21, 22, 23; bilateral central-to-lateral incisal steps |
| Gingival and interdental relationships | Common gingival reference; six gingival levels and zenith offsets; lateral gingival offsets; five papilla heights, contact lengths, and incisal embrasure dimensions |
| Smile and lip relationships | Smile and visible dentition widths, interlabial gap, bilateral buccal corridors, central incisor and gingival display, incisal arc and inner lower-lip curve |
| Resting lip relationships | Bilateral incisor display and upper-lip length from a separate resting photo |

Calculated results include midline discrepancy at the incisal embrasure, dental-midline inclination, incisal/anterior cant, crown width/height ratios and axis inclinations, bilateral dimension/gingival differences, neighboring-tooth apparent-width ratios, incisal-step asymmetry, central incisal height difference, gap/corridor ratios, and corridor asymmetry. Gingival levels must share a reference; lateral incisal steps must share the central incisal plane. Angles show absolute deviations between references.

There are no automatic ideal/abnormal classifications or universal proportion targets. Frontal widths are apparent widths. The canine line is an anterior photo reference. Root position, overjet, full 3D occlusion, and periodontal diagnosis require additional clinical records. Hidden anatomy is marked unavailable. Visible zero offsets can be recorded.

## Gemini assistance

**Assist this assessment with Gemini** requests the checklist for the saved photo view through `smile-assist`. The existing signed-in account, patient consent, ownership/revision checks, and cooldown remain required. Gemini proposes normalized endpoints or unavailable reasons. Every applicable identifier must occur once. Unknown/duplicate identifiers, incomplete/wrong-view checklists, invalid geometry, inferred scale, and stale proposals are rejected.

Review the source-photo overlay and select which measurements to apply. Existing clinician measurements take precedence. Suggestions become editable named measurements. Values are computed locally from geometry and confirmed calibration. Credentials remain in server secrets; manual tools remain available during provider outages.

The sync before an AI request remembers the case's cloud revision across refreshes. Existing matching cases reconnect automatically. If **Choose a case version** appears, select **Continue with my local edits** to work in a separate case while preserving the original cloud record, or **Use the cloud version** to open it while retaining the local edits in another case. Then press the Gemini button again.

## References and checks

The reference categories follow the facial cross, canine/incisal transfer lines, central-incisor proportions, tooth axes, gingival levels, and interdental relationships in [Coachman and Calamita's DSD workflow, QDT 2012](https://digitalsmiledesign.com/files/Old-Website-Assets/Static/Coachman_Calamita_DSD_Eng_12.pdf). Smile/lip relationships also follow the calibrated photo-analysis landmarks in [the standardized smile-analysis study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8667490/).

The release passes 33 unit/integration and 54 browser tests, production configuration/build checks, and edge type checks. Tests cover geometry, view separation, zero offsets, redraw/undo, persistence, compatibility, proposal validation, server contracts, unavailable anatomy, and Chromium/WebKit workflows. Phone layouts are checked for overflow. Clinical accuracy, physical iPad/Pencil support, and authenticated live-provider quality remain clinician/device acceptance work.
