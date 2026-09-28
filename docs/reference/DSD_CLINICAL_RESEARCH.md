# Clinical evidence and app requirements for Digital Smile Design

Research date: 28 September 2026. Intended audience: the dentist defining the product and the team implementing the existing web prototype.

This is an evidence-informed product specification, not validation of the current clinical engine. Recommendations labelled **App decision** are design conclusions drawn from the evidence and this project's scope; they are not published clinical guidelines. The research is a targeted review of official DSD documentation, professional guidance, and original clinical studies, with selected systematic reviews. It is not a preregistered systematic review. Some studies were available only as abstracts or indexed excerpts; access depth is recorded below.

## 1. What the app should claim and support

The official DSD App describes itself as an initial 2D simulator. Its minimum photo for that activity is a frontal maximum-smile photograph. It distinguishes this from comprehensive case assessment, which incorporates additional records and a digital or conventional process for definitive restorations. Consequently, the reference site's minimum upload requirement should not become our minimum requirement for periodontal treatment decisions. [Official DSD App](https://digitalsmiledesign.com/dsd-app)

**App decision:** provide three separately identifiable stages:

| Stage | Useful output | Required basis | Approval meaning |
| --- | --- | --- | --- |
| Aesthetic visualization | Editable tooth design, gallery alternatives, simulated appearance | Suitable photograph; scale only where image measurements are requested | Patient/dentist likes a visual direction |
| Clinical planning draft | Recorded findings, proposed changes, alternatives, unresolved questions, referrals | Clinician examination and findings appropriate to the proposed treatment | Dentist has reviewed the draft and its limitations |
| Clinician-approved plan | Confirmed procedures, sequence, responsible clinicians, reassessment conditions | Required clinical and functional assessment; indicated diagnostic records; external mock-up/wax-up review where appropriate | Named clinician accepts a specific plan revision |

Store visual approval separately from clinical approval. A patient accepting an attractive preview does not establish surgical feasibility. **App decision, updated to the requested range:** support the upper ten teeth from right second premolar to left second premolar (FDI 15–25), and identify when visible teeth or findings outside that area need assessment. A ten-tooth design cannot represent a complete full-mouth examination.

### Findings that change the earlier plan

- Add rest, posed-smile, maximum-smile, and dynamic records rather than describing one still as a record of smile dynamics.
- Add site-specific periodontal findings and explicit missing-data states.
- Distinguish a proposed gingival-margin displacement from the amount and type of surgical tissue removal.
- Preserve patient-specific tissue assessment rather than treating 3 mm clearance or 2 mm keratinized tissue as universal decision boundaries.
- Make tooth proportions and face-based recommendations adjustable aesthetic options.
- Keep generated image realism separate from measurement accuracy and clinical feasibility.

These changes are expanded and sourced in the sections below.

## 2. Photo, video, and diagnostic-record protocol

### Capture instructions supported by DSD documentation

For frontal and profile facial records, DSD's published documentation guide uses approximately one metre camera-to-patient distance, camera height at eye level, consistent lighting, and controlled head position. It asks for separate rest and maximum-smile records, a profile pair, a 12 o'clock view, and video. Rest can be elicited after a prolonged relaxed “m” sound. Its one-metre instruction concerns facial records, not every intraoral close-up. [DSD documentation protocol](https://go.digitalsmiledesign.com/hubfs/DSD%20Mastership%20New%20Documents%20-%202021/Documentation%20Protocol%20Document%20%5BFOR%20DOCTORS%5D.pdf)

The original dynamic-documentation paper explains why posed smiles and smiles during movement provide different dentolabial information. It describes smartphone video as a way to improve facially guided analysis. The earlier DSD manual also emphasizes keeping camera and head position consistent when recording smiling and retracted views for superimposition. [Coachman, Calamita and Sesma, 2017](https://pubmed.ncbi.nlm.nih.gov/28196157/), [original DSD manual](https://digitalsmiledesign.com/files/Old-Website-Assets/Media/Apostila_DSD.pdf)

### Recommended capture checklist for our app

The following checklist is an **App decision**, assembled from those protocols and the clinical purposes of the records. It is not a claim that every DSD product or every patient must have the same photograph count. The interface should show “recommended,” “needed for this assessment,” and “not clinically indicated” distinctly.

| Record | Purpose in our workflow | Suggested requirement |
| --- | --- | --- |
| Frontal face at rest | Resting lip position, incisor display, facial references | Recommended before comprehensive aesthetic review |
| Frontal posed/social smile | Typical smile and patient preference | Recommended; keep separate from maximum smile |
| Frontal maximum smile | Extent and distribution of tooth/gingival display | Required to start the primary visualization |
| Profile at rest and profile smiling | Profile relationship and lip position | Recommended for comprehensive aesthetic review |
| Frontal retracted, teeth slightly apart | Visible margins, incisal edges, tooth form and alignment | Needed for detailed anterior design review |
| 12 o'clock view | Additional view of anterior arrangement relative to lips | Recommended supplementary aesthetic record |
| Frontal retracted in maximum intercuspation | Anterior bite relationships | Needed when restorative/orthodontic feasibility depends on the bite |
| Right and left buccal in intercuspation | Posterior and lateral bite relationships | Conditional on the clinical assessment |
| Upper and lower occlusal views | Arch arrangement and occlusal context | Conditional on the clinical assessment |
| Shade/reference photograph | Separate color documentation | Conditional for shade-dependent restorative planning |
| Frontal video through rest, speech, posed and spontaneous smile | Dynamic lip/tooth display and selected frame review | Recommended for comprehensive review |

The orthodontic photography guidance supports the separate intraoral views and the need to control retraction, occlusal-plane presentation, focus, and saliva. Bite photographs provide documentation; they do not replace a functional examination. [Clinical photography guidance hosted by the British Orthodontic Society](https://www.bos.org.uk/wp-content/uploads/2022/03/clinical_photography_in_an_orthodontic__part_2.pdf)

**App decision:** accept local video or separately identified still frames from a clinician-recorded video. Retain the timestamp and expression of an extracted frame. A missing video should not block a quick preview, but should remain visible as an incomplete dynamic assessment. Video length is a usability setting to establish during piloting, not a medically validated fixed duration.

### Photography quality and color

Controlled cast photography studies support smartphone use for documentation, but their results do not prove that arbitrary patient selfies provide surgery-grade measurements. A 2021 study used 30 casts with calibrated reference stickers; a 2025 study used six casts and found differences between some devices. These are controlled acquisition studies with limited clinical generalizability. [Moussa et al., 2021](https://onlinelibrary.wiley.com/doi/10.1155/2021/3910291), [digital photography comparison, 2025](https://www.mdpi.com/2673-1592/7/4/77)

A July 2026 in-vivo comparison reports that color calibration and suitable optical zoom improved smartphone results, with device-dependent dimensional differences. It supports consistent capture conditions, not automatic clinical shade selection from an uncalibrated upload. [Yuan et al., 2026](https://pubmed.ncbi.nlm.nih.gov/42461427/)

**App decision:** include a clinician-reviewed capture checklist for focus on teeth, usable exposure, visibility of relevant landmarks, head rotation/tilt, expression, side/orientation, and whether filters or geometric edits were applied. Preserve originals. Keep crops and alignment transforms reversible. Disable beauty filters in app capture; flag unknown externally applied edits. Use image-quality automation as an aid rather than proof of accurate acquisition. Show shade as a visual preference until separately recorded clinically. Store a reference-card/shade-tab record and acquisition method when available.

### Radiographs, scans, and examination records

Do not require CBCT for every smile-design case. Current ADA/AAOMR guidance emphasizes examination-led, patient-specific image selection and using CBCT when necessary diagnostic information cannot be obtained with lower-exposure alternatives. A research protocol using CBCT does not create a universal indication for the product. [ADA radiography guidance, including the 2026 recommendations](https://www.ada.org/resources/ada-library/oral-health-topics/x-rays-radiographs)

**App decision:** let the clinician record which existing radiographs, periodontal chart, scans/impressions, bite records, or specialist assessments have been reviewed; indicate pending records and the reason for requesting them. Keep files locally where attached. Version one may use clinician-entered conclusions without interpreting radiographs or 3D files automatically. Do not present the absence of a CBCT upload as a universal failure of case completeness.

## 3. Measurement definitions and data provenance

### Separate types of values

**App decision:** every number should carry its unit, source, date, anatomical location, measurement method, recorded precision, and confirmation status. Use these value categories:

- **Clinically recorded:** entered from examination, a measured model/scan, or a clinician's reviewed record.
- **Photographic estimate:** derived from a particular calibrated image and named landmarks.
- **Proposed target:** a design decision that can be changed without changing the baseline.
- **Derived calculation:** arithmetic based on identified inputs and stated assumptions.
- **AI interpretation:** an explanation or hypothesis, never silently converted into a measured fact.

Unknown must remain unknown. “Not measured,” “not assessable,” “not applicable,” and numeric zero are different states. A selectable phenotype should initially be unknown rather than defaulting to thick tissue. Keep calibration per asset; preserve patient side and FDI identity when displaying or rotating photographs.

Use an explicit convention for CEJ-relative margin position: positive means the gingival margin is apical to the CEJ (recession), negative means coronal, and zero means coincident. Offer direction plus absolute distance in the form so the clinician need not interpret an ambiguous unsigned “FGM to CEJ” field. A proposed apical shift is also positive, but is a separate quantity. Do not silently reuse the legacy field without confirming its interpretation. Display precision should reflect the source measurement; a 0.1 mm input step does not establish 0.1 mm clinical accuracy.

### Facial and smile measurements

Use references to compare current and proposed midline, incisal arrangement, gingival contour, tooth proportions, and lip relationships. DSD's own smile frame includes current/proposed midlines, canine guides, smile/gingival/papilla curves, and anterior proportions. It uses several facial landmarks and measured central-incisor widths. These are design references that the dentist can adjust. [Official DSD smile-frame description](https://digitalsmiledesign.com/dsd-app)

For excessive gingival display, recent clinical studies have collected upper-lip length and mobility, incisor display at rest, crown dimensions, and periodontal findings alongside photos/video. The 2026 Egyptian study examined 160 women with excessive display and identified both single and combined causes; those population-specific results should not be converted into universal diagnostic prevalence or cutoffs. [Amro et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41767215/)

**App decision:** record the following when pertinent:

| Measurement/reference | Definition in the interface | Treatment of the value |
| --- | --- | --- |
| Upper-lip length at rest | Named endpoints from subnasale to lower border of the upper lip | Prefer clinician measurement; label any photo estimate |
| Upper-lip movement | Clinician-selected rest-to-maximum-smile change using comparable records | Do not derive from unrelated poses or unregistered images |
| Incisor display at rest | Visible upper incisal tooth display below the resting upper lip | Record teeth, expression and source |
| Gingival display | Exposure from tooth's facial gingival margin to upper-lip border at the selected smile state | Record central/lateral distribution and whether posterior display occurs |
| Facial and dental midlines | Separate facial reference, actual dental reference, and proposed dental line | Report deviation as observation, not diagnosis |
| Occlusal/incisal cant and smile arc | Current and proposed angular/curve relationships | Preserve the clinician's reference selection |
| Clinical crown dimensions | Clinician-recorded width and margin-to-incisal-edge height for each relevant tooth | Distinguish actual dimensions from projected image dimensions |
| Apparent tooth proportions | Width/height or tooth-to-tooth projected ratios on the selected view | Display as aesthetic comparison |

These fields are a proposed data contract; their existence is not an automated etiologic diagnosis. A 2024 cross-sectional study of 25 adults found associations between excessive display and facial/dentogingival characteristics, but its small, predominantly female sample and study-specific thresholds do not establish a universal diagnostic algorithm. [de Castro et al., 2024](https://pubmed.ncbi.nlm.nih.gov/39058347/)

### Periodontal and restorative records

Current SDCEP guidance defines probing depth from gingival margin to pocket base and clinical attachment level relative to a fixed reference, normally the CEJ. It recommends six-site probing during a full periodontal examination and documenting whether the gingival margin is coronal or apical to the CEJ. If the CEJ is obscured, an identified alternate reference may support relative attachment measurements. [SDCEP periodontal parameters](https://www.periodontalcare.sdcep.org.uk/guidance/assessment/special-tests/full-periodontal-examination/what-should-be-recorded/periodontal-parameters/)

**App decision:** replace the present one-value-per-tooth assumption with measurements at identified sites where relevant. Do not imply that bone sounding is routinely required at every site; record it when performed by the clinician for an indicated assessment.

| Data group | Fields to accommodate | Important distinction |
| --- | --- | --- |
| Periodontal examination | Probing depth, bleeding/suppuration, margin/recession position, clinical/relative attachment level, plaque and mobility findings | A six-tooth design is not a full periodontal diagnosis |
| CEJ and bone relationship | CEJ identifiable/obscured, signed margin-to-CEJ position, clinician-recorded bone sounding and/or reviewed bone-level findings | CEJ, pocket base, and bone crest are different landmarks |
| Tissue assessment | Keratinized tissue width, thickness/assessment method, mucogingival-junction location, relevant recession/frenum findings | Keratinized tissue and attached gingiva are different quantities |
| Current tooth/restoration | Wear/fracture/caries findings, existing restoration, planned margin, clinically assessed restorability | Selecting a crown/veneer graphic does not establish suitability |
| Functional feasibility | Overbite/overjet, relevant contacts and excursions, parafunction/wear assessment, clinician notes and review status | Photographic alignment cannot predict root movement or functional clearance |
| Patient context | Goals, preferences, relevant history/medications, smoking/diabetes and clinician suitability assessment | Do not infer health status or tissue characteristics from face shape |

The periodontal consensus distinguishes gingival phenotype components and variable supracrestal attachment. It does not establish a single minimum gingival width that determines health in all circumstances; hygiene, pathology, restorative demands, phenotype and the intervention matter. This is not permission to excise tissue without a surgical assessment. [AAP/EFP consensus, 2018](https://pubmed.ncbi.nlm.nih.gov/29926943/)

### Photo calibration and its limits

**App decision:** select an actual measured reference span visible on the same photograph, store its endpoints and real length, and calculate pixels per millimetre. Do not assume an average central-incisor width. Store original-image coordinates and the rendering transform so display size, zoom, crop and rotation do not change measurements.

Scaling a 2D photograph corrects magnification at a reference; it does not recover depth, compensate reliably for every rotated tooth, or reveal hidden anatomical structures. A clinical study of 30 patients found significant differences between photographic and scanned mesiodistal measurements, notably for lateral incisors and canines. Therefore, do not treat all measurements across an arch or face as equally accurate after one calibration. [Ortensi et al., 2022](https://pubmed.ncbi.nlm.nih.gov/35362247/)

**App decision:** show the source and limitations next to photo-derived millimetres. Require clinical confirmation before using them for treatment decisions. An uncalibrated photo can still accompany real clinical measurements and a clinician-entered numerical scenario; only photo-to-mm calculations should be unavailable. Never take surgical measurements from a generated image.

## 4. Gingivectomy and crown-lengthening decision support

### Evaluate the cause of excessive display first

Excessive gingival display has heterogeneous and sometimes combined causes. Clinical studies assess altered eruption, lip-related factors, skeletal/dentoalveolar relationships, and gingival enlargement rather than assuming all cases are excess gum tissue. A Saudi study of 123 selected adults also identified combined etiologies; it was not a population-wide diagnostic validation. [Saudi clinical study, 2024](https://pubmed.ncbi.nlm.nih.gov/39176165/)

**App decision:** provide clinician-confirmed cause selections, including “uncertain” and “mixed,” and a place to document supporting findings. The consultation assistant may suggest what to examine next. It should not diagnose altered passive eruption, vertical maxillary excess, or lip hypermobility from a smile photo alone. Display the option to investigate orthodontic, periodontal, restorative or other specialist assessment as appropriate to the clinician's working diagnosis.

### Do not equate three different quantities

1. **Proposed gingival-margin change:** where the dentist wants the visible margin to be.
2. **Surgical soft-tissue removal/repositioning:** a procedure-specific clinical decision.
3. **Bone recontouring/removal:** a clinical surgical decision involving anatomy and supporting tissues.

The AAP/EFP terminology for supracrestal tissue attachment refers to junctional epithelium and supracrestal connective-tissue attachment; a sulcus is not an additional part of that attachment definition. A historical anatomical study of 171 surfaces in ten cadaver jaws reported variable constituent dimensions. [World Workshop terminology](https://pubmed.ncbi.nlm.nih.gov/29926943/), [Vacek et al., 1994](https://pubmed.ncbi.nlm.nih.gov/7928131/)

A systematic review found substantial within- and between-person variation rather than a universal attachment dimension. A 2024 digital assessment of 203 teeth in 19 subjects also found variation with tooth position; these subjects had existing CBCT/scan records for implant planning and were selected without several conditions relevant to our surgical population. Neither result justifies a photograph-only surgical rule. [Schmidt et al., 2013](https://pubmed.ncbi.nlm.nih.gov/23461747/), [Abdulkarim et al., 2024](https://aap.onlinelibrary.wiley.com/doi/10.1002/cap.10280)

### Arithmetic the app can display

**App decision:** display the following as conditional calculations at the same named site, not forecasts of healed tissue. Define positive proposed shift as apical movement.

| Calculation | Assumptions that must be visible |
| --- | --- |
| Proposed margin-to-crest distance = baseline margin-to-crest distance minus proposed apical margin shift | Baseline clinically recorded; crest unchanged; comparable site and direction |
| Proposed finish-line-to-crest distance = proposed margin-to-crest distance minus planned finish-line depth below the proposed margin | Finish-line depth clinically selected; same-site geometry |
| Estimated residual keratinized width = baseline width minus proposed excisional shift | Simple excision scenario; mucogingival junction unchanged; not a prediction for flap repositioning or healing |
| Clearance shortfall = max(0, clinician-confirmed target minus calculated clearance) | Target references the correct margin/finish line and is confirmed for this site/procedure |

The last quantity must be called a **clearance shortfall**, never automatically an “amount of bone to remove.” Store the tissue criterion, its anatomical reference, source/protocol, reviewing clinician and confirmation date. If no applicable criterion is confirmed, show the arithmetic with review pending, not a green surgical clearance.

An optional baseline attachment estimate calculated from bone sounding minus probing depth should be explicitly labelled an estimate from co-located clinical inputs, not a histological measurement. Do not confuse this with the complete margin-to-bone space. The 2024 digital attachment study used clinical probing alongside anatomical measurements and advocated individualized assessment. [Abdulkarim et al., methods](https://aap.onlinelibrary.wiley.com/doi/10.1002/cap.10280)

### Scenario presentation and clinical gates

| Situation | Appropriate app output |
| --- | --- |
| Only an aesthetic photo is available | Visual alternative; explain which clinical findings remain unknown |
| Proposed apical change and clinical inputs are available | Per-site comparison, calculated constraints and unresolved assessments |
| Clinician confirms soft-tissue-only feasibility | Gingivectomy option pending documented plan approval |
| Insufficient confirmed clearance, uncertain bone/CEJ relationship, tissue concerns, or other restorative limitations | Further periodontal/restorative assessment; crown-lengthening option may be discussed |
| Other or mixed cause of display is suspected | Cause-specific assessment/referral options, not automatic gum surgery |
| No apical movement is proposed | No planned apical margin change; this does not prove periodontal/restorative safety |
| Coronal movement/root coverage is proposed | Separate assessment; do not classify it as restorative-only |

**App decision:** use user-created or clinician-approved margin scenarios. If AI offers numerical alternatives, label them as design proposals, show their sources, and recalculate constraints before application. Provide reversible comparison views, rather than a default universally recommended removal amount.

### Healing, adjacent teeth, and surgical transfer

Crown-lengthening studies report different degrees of gingival-margin rebound and stability. A prospective six-month study documented rebound and changes at adjacent sites; a randomized study of 24 participants with a specific altered-eruption subtype reported stable longer-term results with both conventional and guided approaches. These results do not establish one healing interval or one guaranteed final margin for all techniques and patients. [Deas et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15515347/), [guided dual-technique trial](https://pubmed.ncbi.nlm.nih.gov/36409356/)

A 2024 randomized trial in 16 selected patients compared conventional and 3D-guided procedures. It found shorter operating time with guidance but no significant between-group difference in margin stability. The guided process used clinical assessment and registered scan/CBCT data, not an AI-edited photograph. Its procedure-specific inclusion criteria and targets should not be universal defaults. [Borham et al., 2024](https://link.springer.com/article/10.1186/s12903-024-04080-5)

**App decision:** record external surgical/wax-up/mock-up review and follow-up reassessment where indicated. Do not fabricate a printable surgical guide from a 2D image. Do not automatically schedule definitive restoration after a fixed number of weeks. Provide clinician-controlled milestones for tissue stability and restorative readiness, including adjacent-site review.

## 5. Tooth gallery, aesthetic references, and AI

### Aesthetic references are adjustable

A study of 204 participants did not confirm the theory that central-incisor shape should correspond to inverted facial shape. It also did not support determining gender from tooth shape. Facial contour can be part of a clinician's visual discussion, but should not generate a claim of one biologically correct tooth form or an inferred personality. [Wolfart et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15560828/)

Studies using manipulated smiles found preferred width/height ranges, with differences between observers and substantial individual variation. Such findings support useful starting references, not a mandatory harmony score. [Incisor-proportion preference study, 2005](https://pubmed.ncbi.nlm.nih.gov/15819823/), [central-incisor ratio study, 2012](https://pubmed.ncbi.nlm.nih.gov/22722122/)

A 2024 observational study of natural anterior proportions in Kenyans did not support applying Golden/RED proportions uniformly. Apparent tooth-to-tooth proportions and a single tooth's width/height ratio are distinct quantities. Do not confuse projected canine width with its true mesiodistal width. [Natural anterior proportion study, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11226540/)

**App decision:** retain four original forms plus custom presets, with independent per-tooth adjustments. Let patients compare alternatives and record the characteristics they prefer. Describe ratios neutrally, for example “current W/H 86%; proposed 82%,” rather than “too square.” Separate shade preference from clinically recorded shade. Keep underlying tooth geometry independent of the texture asset.

Papilla fill is not assured by drawing an ideal papilla curve. A foundational observational study of 288 sites in 30 patients found an association between contact-to-bone distance and papilla presence. Those observations are not a guaranteed prediction for a particular patient or intervention. [Tarnow et al., 1992](https://pubmed.ncbi.nlm.nih.gov/1474471/)

**App decision:** show existing papilla/embrasure findings separately from a proposed contact arrangement. Do not automatically erase black triangles in a clinical-looking preview and imply that the treatment will regenerate papillae.

### What current AI evidence establishes

A 2026 paired study of 33 patients compared SmileFy designs with clinician-created Exocad designs and reported favorable aesthetic ratings and shorter design time for the AI workflow. It evaluated virtual proposals, not definitive restorations or periodontal surgery, and used one specific platform. It does not validate Gemini's consultation or surgical measurement accuracy. [Almohareb et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41892774/)

A 2024 prospective audit compared SmileView simulations with actual orthodontic outcomes in 24 adults. Several parameters, including smile arc and lower-incisor exposure, were not reliable predictors in that study. Attractive simulations should therefore be described as possibilities rather than exact postoperative predictions. [Adel et al., 2024](https://www.nature.com/articles/s41598-024-69314-6)

**App decision:** keep Gemini 3.5+ for this project's suggestions and consultation, but require evaluation of the actual model, prompt and workflow. Version numbers and a consumer “Pro” subscription are not clinical validation. The assistant should distinguish facts, assumptions and missing findings; explain calculations supplied by the deterministic engine; and leave clinical decisions and changes to the dentist. Any citations shown in consultation should come from verified references rather than invented bibliographies.

For generated previews, use the approved design as an input and show it beside the generated image. Preserve original pixels outside the reviewed edit mask, but do not claim that this guarantees anatomical accuracy inside the mask. Review tooth count/identity, gingival contour, bite/lip changes and unintended additions. Disable measurement tools on generated images and mark every export as a simulated outcome.

Professional AI policy emphasizes verified, supervised use rather than accepting authoritative-sounding generated advice. Its statements are professional guidance, not proof of regulatory status for this particular app. [Australian Dental Association AI policy](https://ada.org.au/policy-statement-6-34-artificial-intelligence-in-dentistry)

## 6. Recommended app steps and completeness rules

This sequence is an **App decision**, not a claim that one published protocol defines every step.

1. **Patient goals and case context:** record concerns, preferred changes, relevant history, and consent separately for local documentation and external AI processing.
2. **Capture records:** guide the user through expression-specific photos and optional/indicated diagnostic records. Review quality before tracing.
3. **Review baseline:** identify actual landmarks, apparent dimensions and clinically recorded findings. Keep current anatomy separate from design targets.
4. **Assess causes and limitations:** document the clinician's working assessment, uncertainty, missing records and referrals.
5. **Design alternatives:** adjust incisal position, tooth forms, proportions, contact/embrasure arrangement and gingival targets with reversible revisions.
6. **Review clinical scenarios:** display per-site arithmetic and assumptions; confirm appropriate criteria and record feasibility decisions.
7. **Generate and inspect visualization:** compare the original, measured design and AI image. Record acceptance of appearance separately.
8. **Draft the interdisciplinary sequence:** include disease-control needs, assessment/referral milestones, restorative alternatives, verification and reassessment. The clinician determines sequencing for the case.
9. **Approve and export:** produce a source-traceable plan with required reviews and unresolved items; record which clinician approved it. Later baseline/design changes invalidate dependent approvals.

### Capability gates

| Capability | Gate |
| --- | --- |
| Quick image preview | Usable primary photo and explicit simulation label |
| Photo-derived mm | Valid calibration on that image with visible, identified reference |
| Manual clinical scenario arithmetic | Confirmed numerical clinical inputs and proposed movement with source recorded; photo calibration is not intrinsically required |
| Tissue suitability comparison | Site-specific clinical findings and applicable clinician-confirmed criteria |
| AI photo/record analysis | Explicit processing consent, correct case/revision and actual attachment/context |
| Clinician-approved plan | Required assessment reviews complete, unresolved issues handled by the clinician, approval recorded |

**App decision:** allow incomplete draft saving. Explain incompleteness beside the unavailable capability; avoid blocking unrelated visual exploration or manual recording. Store photos/video/generated media locally in IndexedDB as already requested. Supabase may store structured findings, revision/approval records and media metadata; local-only media still require consent before transient transmission to Gemini.

## 7. Corrections required in the current prototype

These are findings from inspection of the workspace on the research date. This research task has not changed application behavior.

| Priority | Current issue | Required correction |
| --- | --- | --- |
| P0 | The inspector displays “EFP 2026 Engine” without traceable validation or endorsement | Remove the claim; identify actual rules, sources and clinical-review status |
| P0 | Fixed 3 mm clearance creates a prescription-like estimate of bone removal | Display a conditional clearance shortfall and assessment options; no automatic ostectomy quantity |
| P0 | Less than 2 mm estimated KTW is labelled universally contraindicated/grafting indicated | Use patient-, site- and procedure-specific review criteria; preserve tissue concerns without automatic treatment indication |
| P0 | Bone-related candidate branch sets `clearanceCriteriaMet` true despite inadequate clearance | Separate calculated criterion result, clinical feasibility and approval; make unknown explicit |
| P0 | No apical shift is labelled safe without clinician confirmation; negative shifts enter the same branch | Report the movement accurately; coronal movement and restoration safety need their own assessment |
| P0 | Tissue phenotype defaults to thick/flat | Add unknown and record assessment method; never infer a missing value |
| P0 | CEJ and probing findings are not fully used in treatment assessment; measurements have no site | Add site/reference provenance, CEJ assessability, periodontal review and relevant restorative/functional findings |
| P1 | Three photo slots conflate record purpose; a still claims to capture dynamics and reveal CEJ | Add expression/view metadata and rest/video support; describe only visible structures |
| P1 | Calibration blocks all clinical arithmetic, including real manual measurements | Gate image-derived measurements separately from manual clinical calculations |
| P1 | Ratios outside 75–85% are labelled too narrow/square | Use neutral ratios and editable aesthetic references |
| P1 | A generic illustration is presented as a patient-specific photorealistic simulation | Replace with genuine revision-linked editing and honest unavailable/demo states |
| P1 | Suggestions may run without the patient's photo and use procedural fallback text | Send selected attachments with consent; label fallback examples and provider failures honestly |

Primary inspected locations: `D:\AI Apps\DSD app\src\lib\clinical-engine.ts`, `D:\AI Apps\DSD app\src\components\workspace\PeriodontalInspector.tsx`, `D:\AI Apps\DSD app\src\components\workspace\PhotosView.tsx`, and domain types in `D:\AI Apps\DSD app\src\types\index.ts`.

## 8. Validation needed before claiming clinical accuracy

### Software and measurement validation

- Test units, signs, tooth/site identity, unknown versus zero, per-photo scale and transformations.
- Verify measurements remain stable under resizing, zooming and rotation; reject invalid scale/reference input.
- Compare photo-derived estimates with clinician/model/scan references under the capture conditions actually supported by the product. Report bias and agreement, including difficult poses, tooth rotations and devices. Do not infer accuracy from a lack of statistical significance alone.
- Test missing-data gates, changes to confirmed findings, revision invalidation, and separation of aesthetic acceptance from clinical approval.
- Test clinical arithmetic independently of Gemini. Verify that AI cannot overwrite measured facts or clinical-review statuses.
- Check pixels outside simulation masks, tooth identity/count and consistency with the design. Image preservation and internal clinical plausibility are separate tests.

### Clinical and AI evaluation

**App decision:** review the specification and rules with a periodontist and a restorative/prosthodontic clinician, with orthodontic input for movement-related alternatives. Include cases with healthy and diseased periodontia, wear, obscured CEJ, existing restorations, tissue/recession concerns, mixed causes of gingival display and incomplete records. Ask reviewers to assess missing examinations, calculations, feasible alternatives and misleading certainty, not just attractive images.

Use a predefined evaluation set with cases not used to develop prompts. Measure critical numerical errors, invented findings/references, inappropriate procedure suggestions, omitted assessment needs and reviewer agreement. Define acceptance criteria with the clinical reviewers before testing; do not invent a universal “95% accurate” target. Track model and prompt version, case-context revision and reviewer decisions. Reevaluate substantive model/rule changes. Patient-specific agreement and outcomes would need prospective study before any stronger predictive claim.

The American Dental Association's 2026 discussion of clinical AI adoption calls attention to standardized data and independent validation frameworks. This is relevant evaluation guidance, not validation of Gemini or this prototype. [ADA on clinical AI adoption and validation, 2026](https://adanews.ada.org/ada-news/2026/february/ada-responds-to-hhs-request-for-information-on-ai-adoption-in-dentistry/)

## 9. Evidence register and limitations

Access descriptions refer to what was available in this research session, not whether a paper is permanently open access. “Selected text” means an abstract and/or indexed full-text passages, not a claim of complete paper review. The implication column records a cautious interpretation for product design.

| Source | Evidence/access | Product implication and limitation |
| --- | --- | --- |
| [DSD App](https://digitalsmiledesign.com/dsd-app) | Official product documentation; full page | Workflow reference; marketing/product descriptions do not validate surgery |
| [DSD documentation protocol](https://go.digitalsmiledesign.com/hubfs/DSD%20Mastership%20New%20Documents%20-%202021/Documentation%20Protocol%20Document%20%5BFOR%20DOCTORS%5D.pdf) | Official 10-page capture guide; full extracted text | Structured facial capture; distinguish facial distance instruction from intraoral capture |
| [Original DSD manual](https://digitalsmiledesign.com/files/Old-Website-Assets/Media/Apostila_DSD.pdf) | Official educational manual; selected text | Consistent registration views; an educational protocol rather than an accuracy trial |
| [Coachman et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28196157/) | Original dynamic documentation paper; abstract | Dynamic records support analysis; not quantified predictive validation |
| [BOS-hosted photography paper, 2010](https://www.bos.org.uk/wp-content/uploads/2022/03/clinical_photography_in_an_orthodontic__part_2.pdf) | Professional technique publication; selected text | Intraoral-view quality and technique; not a universal contemporary capture checklist |
| [Moussa et al., 2021](https://onlinelibrary.wiley.com/doi/10.1155/2021/3910291) | Controlled cast study, 30 casts; selected methods/results | Documentation feasibility; limited generalization to patients and arbitrary devices |
| [Smartphone comparison, 2025](https://www.mdpi.com/2673-1592/7/4/77) | Controlled comparison, six casts; selected full-text material | Device/capture dependence; small laboratory evidence |
| [Yuan et al., 2026](https://pubmed.ncbi.nlm.nih.gov/42461427/) | In-vivo camera comparison; indexed abstract | Color calibration and device-dependent dimensions; no universal app accuracy claim |
| [ADA/AAOMR imaging guidance](https://www.ada.org/resources/ada-library/oral-health-topics/x-rays-radiographs) | Official summary of 2024/2026 recommendations; full relevant text | Examination-led imaging; no routine CBCT requirement |
| [SDCEP periodontal parameters](https://www.periodontalcare.sdcep.org.uk/guidance/assessment/special-tests/full-periodontal-examination/what-should-be-recorded/periodontal-parameters/) | Current professional clinical guidance; full page | Definitions and charting context; local clinicians remain responsible for assessment |
| [AAP/EFP consensus, 2018](https://pubmed.ncbi.nlm.nih.gov/29926943/) | Consensus; abstract and full published PDF | Variable attachment/phenotype and tissue-health context; not a universal elective-surgery clearance rule |
| [Amro et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41767215/) | Clinical etiologic study, 160 selected Egyptian women; abstract/selected text | Relevant multidomain examination; population/sample specificity |
| [de Castro et al., 2024](https://pubmed.ncbi.nlm.nih.gov/39058347/) | Cross-sectional study, 25 adults; abstract/selected text | Differential assessment; associations and small sample are not validated cutoffs |
| [Saudi etiologic study, 2024](https://pubmed.ncbi.nlm.nih.gov/39176165/) | Selected clinical cohort, 123 adults; abstract/selected text | Multiple causes; prevalence is not a diagnostic rule |
| [Vacek et al., 1994](https://pubmed.ncbi.nlm.nih.gov/7928131/) | Anatomical study, ten cadaver jaws/171 surfaces; abstract | Dimension variability; historical anatomical data |
| [Schmidt et al., 2013](https://pubmed.ncbi.nlm.nih.gov/23461747/) | Systematic review; abstract | No universal attachment dimension; heterogeneous measurement methods |
| [Abdulkarim et al., 2024](https://aap.onlinelibrary.wiley.com/doi/10.1002/cap.10280) | Digital assessment, 19 people/203 teeth; full relevant sections | Individualized geometry; existing diagnostic imaging and selected healthy cohort |
| [Deas et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15515347/) | Prospective study, 25 patients/43 teeth; abstract | Rebound/adjacent-site changes; largely posterior-tooth setting |
| [Guided dual technique](https://pubmed.ncbi.nlm.nih.gov/36409356/) | Randomized trial, 24 participants; abstract | Guided/conventional assessment in a specific altered-eruption subtype; not photo-only planning |
| [Borham et al., 2024](https://link.springer.com/article/10.1186/s12903-024-04080-5) | Randomized trial, 16 patients; full relevant sections | Digital surgical transfer uses diagnostic geometry; small selected sample |
| [Wolfart et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15560828/) | Observational tooth/face study, 204 participants; abstract | No reliable one-to-one face/tooth form rule in that sample |
| [Incisor preference study, 2005](https://pubmed.ncbi.nlm.nih.gov/15819823/) | Manipulated-image rating study; abstract | Optional proportion references; selected images and raters |
| [Central-incisor ratios, 2012](https://pubmed.ncbi.nlm.nih.gov/22722122/) | Manipulated-image rating study; abstract | Variation in preference; one modified female smile |
| [Natural proportions, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11226540/) | Observational study; selected text | Natural proportions vary; do not assign ethnicity-based templates automatically |
| [Tarnow et al., 1992](https://pubmed.ncbi.nlm.nih.gov/1474471/) | Observational study, 30 patients/288 sites; abstract | Contact/bone/papilla association; not a guaranteed regeneration prediction |
| [Ortensi et al., 2022](https://pubmed.ncbi.nlm.nih.gov/35362247/) | Clinical dimensional study, 30 patients; abstract | 2D/3D discrepancies; different dimensions and locations need validation |
| [Almohareb et al., 2026](https://pubmed.ncbi.nlm.nih.gov/41892774/) | Paired virtual-design study, 33 patients; abstract/selected limitations | Aesthetic ratings/efficiency for SmileFy; not surgical or Gemini validation |
| [Adel et al., 2024](https://www.nature.com/articles/s41598-024-69314-6) | Prospective simulation/outcome audit, 24 adults; selected original article text | Limited orthodontic prediction; platform- and treatment-specific |
| [Australian Dental Association AI policy](https://ada.org.au/policy-statement-6-34-artificial-intelligence-in-dentistry) | Professional policy; relevant sections | Verified clinician supervision; not jurisdiction-specific product approval |
| [American Dental Association AI discussion, 2026](https://adanews.ada.org/ada-news/2026/february/ada-responds-to-hhs-request-for-information-on-ai-adoption-in-dentistry/) | Official association discussion of its HHS response; relevant text | Independent validation and standardized data; professional policy perspective |

Older foundational studies were retained where they directly explain terminology, proportions or measurement limitations. Newer small studies were included without treating publication recency as proof of stronger evidence. No source reviewed establishes that Gemini 3.5+ can safely prescribe patient-specific gingivectomy or bone-removal quantities from photographs. Clinical review and testing of our actual workflow remain required before it can support stronger clinical claims.
