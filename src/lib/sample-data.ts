import { Case, ToothMeasurement, ToothTransform } from '../types';

// High-fidelity clinical sample photos as SVG Data URLs for instantaneous testing
const createSampleSmileSvg = (isGummy: boolean): string => {
  const lipColor = '#C25D6B';
  const teethColor = isGummy ? '#EFE9D7' : '#E8E3D2';
  const gumColor = '#DE7987';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650" width="1000" height="650">
    <defs>
      <radialGradient id="faceGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#EAC1A5"/>
        <stop offset="100%" stop-color="#D7A98B"/>
      </radialGradient>
      <linearGradient id="toothShading" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#D8D0BA"/>
        <stop offset="30%" stop-color="${teethColor}"/>
        <stop offset="90%" stop-color="${teethColor}"/>
        <stop offset="100%" stop-color="#CFE5F0"/>
      </linearGradient>
    </defs>
    <!-- Facial Background -->
    <rect width="1000" height="650" fill="url(#faceGrad)"/>
    
    <!-- Philtrum & Upper Lip Base -->
    <path d="M 440 180 Q 500 200 560 180 Q 500 230 440 180 Z" fill="#D29B7F" opacity="0.4"/>
    
    <!-- Intraoral Dark Cavity -->
    <path d="M 280 340 Q 500 260 720 340 Q 500 480 280 340 Z" fill="#220D12"/>

    <!-- Maxillary Gingiva -->
    <path d="M 310 330 Q 500 ${isGummy ? 240 : 275} 690 330 Q 500 300 310 330 Z" fill="${gumColor}"/>
    
    <!-- Existing Upper Teeth (FDI 13 to 23) -->
    <!-- 13 Canine -->
    <path d="M 320 335 C 330 315 355 315 365 335 C 370 365 355 400 340 405 C 330 400 315 365 320 335 Z" fill="url(#toothShading)" stroke="#9E9580" stroke-width="1.5"/>
    <!-- 12 Lateral -->
    <path d="M 370 330 C 380 310 405 310 415 330 C 420 365 410 400 395 402 C 380 400 365 365 370 330 Z" fill="url(#toothShading)" stroke="#9E9580" stroke-width="1.5"/>
    <!-- 11 Central -->
    <path d="M 420 325 C 435 300 475 300 495 325 C 500 370 495 415 460 418 C 425 415 415 370 420 325 Z" fill="url(#toothShading)" stroke="#9E9580" stroke-width="1.5"/>
    <!-- 21 Central -->
    <path d="M 505 325 C 525 300 565 300 580 325 C 585 370 575 415 540 418 C 505 415 500 370 505 325 Z" fill="url(#toothShading)" stroke="#9E9580" stroke-width="1.5"/>
    <!-- 22 Lateral -->
    <path d="M 585 330 C 595 310 620 310 630 330 C 635 365 620 400 605 402 C 590 400 580 365 585 330 Z" fill="url(#toothShading)" stroke="#9E9580" stroke-width="1.5"/>
    <!-- 23 Canine -->
    <path d="M 635 335 C 645 315 670 315 680 335 C 685 365 670 400 660 405 C 645 400 630 365 635 335 Z" fill="url(#toothShading)" stroke="#9E9580" stroke-width="1.5"/>

    <!-- Lower Lip Framing (Smile Arc) -->
    <path d="M 260 340 C 350 450 650 450 740 340 C 660 495 340 495 260 340 Z" fill="${lipColor}"/>

    <!-- Upper Lip Framing -->
    <path d="M 260 340 C 370 280 470 295 500 305 C 530 295 630 280 740 340 C 640 260 360 260 260 340 Z" fill="${lipColor}"/>

    <!-- Lip Highlights -->
    <path d="M 440 445 Q 500 455 560 445" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.3" fill="none"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const SAMPLE_CASES: Case[] = [
  {
    id: 'case_sample_1',
    patientIdentifier: 'PT-2026-081',
    patientName: 'Emma V. (Altered Passive Eruption)',
    dentistId: 'demo-dentist-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'designed',
    notes: 'Patient complaints: "Too much gum showing when smiling and teeth look short and square." High smile line with intact biological width.',
    activePhotoType: 'smile',
    consentGranted: true,
    photos: {
      smile: {
        url: createSampleSmileSvg(true),
        orientationDeg: 0,
        calibration: {
          isCalibrated: true,
          p1: { x: 420, y: 325 },
          p2: { x: 495, y: 325 },
          realDistanceMm: 8.6, // Actual central incisor width in mm
          pixelsPerMm: 8.72
        }
      }
    },
    guides: {
      midline: { p1: { x: 500, y: 150 }, p2: { x: 500, y: 550 } },
      bipupillary: { p1: { x: 200, y: 220 }, p2: { x: 800, y: 220 } },
      smileArc: [
        { x: 300, y: 360 },
        { x: 500, y: 440 },
        { x: 700, y: 360 }
      ],
      incisalPlane: { p1: { x: 320, y: 410 }, p2: { x: 680, y: 410 } }
    },
    measurements: {
      13: { fdi: 13, currentWidthMm: 7.6, currentHeightMm: 8.5, probingDepthMm: 2.0, boneSoundingMm: 4.5, keratinizedTissueWidthMm: 5.0, cejLocationMm: 1.5, phenotype: 'thick_flat', restorativeStatus: 'natural' },
      12: { fdi: 12, currentWidthMm: 6.8, currentHeightMm: 7.8, probingDepthMm: 2.5, boneSoundingMm: 4.8, keratinizedTissueWidthMm: 5.5, cejLocationMm: 1.8, phenotype: 'thick_flat', restorativeStatus: 'natural' },
      11: { fdi: 11, currentWidthMm: 8.6, currentHeightMm: 9.0, probingDepthMm: 2.5, boneSoundingMm: 4.2, keratinizedTissueWidthMm: 6.0, cejLocationMm: 2.0, phenotype: 'thick_flat', restorativeStatus: 'natural' },
      21: { fdi: 21, currentWidthMm: 8.6, currentHeightMm: 9.0, probingDepthMm: 2.5, boneSoundingMm: 4.2, keratinizedTissueWidthMm: 6.0, cejLocationMm: 2.0, phenotype: 'thick_flat', restorativeStatus: 'natural' },
      22: { fdi: 22, currentWidthMm: 6.8, currentHeightMm: 7.8, probingDepthMm: 2.5, boneSoundingMm: 4.8, keratinizedTissueWidthMm: 5.5, cejLocationMm: 1.8, phenotype: 'thick_flat', restorativeStatus: 'natural' },
      23: { fdi: 23, currentWidthMm: 7.6, currentHeightMm: 8.5, probingDepthMm: 2.0, boneSoundingMm: 4.5, keratinizedTissueWidthMm: 5.0, cejLocationMm: 1.5, phenotype: 'thick_flat', restorativeStatus: 'natural' }
    },
    revisions: [
      {
        id: 'rev_1',
        revisionNumber: 1,
        timestamp: new Date().toISOString(),
        isDentistApproved: true,
        teeth: {
          13: { fdi: 13, form: 'oval', x: 34.2, y: 55.0, width: 7.8, height: 9.8, rotation: -3, gingivalShiftMm: 1.2, incisalExtensionMm: 0.1, shade: 'BL3' },
          12: { fdi: 12, form: 'oval', x: 39.5, y: 54.5, width: 7.0, height: 8.8, rotation: -2, gingivalShiftMm: 1.5, incisalExtensionMm: 0.2, shade: 'BL3' },
          11: { fdi: 11, form: 'oval', x: 45.8, y: 54.0, width: 8.6, height: 10.8, rotation: 0, gingivalShiftMm: 1.8, incisalExtensionMm: 0.0, shade: 'BL3' },
          21: { fdi: 21, form: 'oval', x: 54.2, y: 54.0, width: 8.6, height: 10.8, rotation: 0, gingivalShiftMm: 1.8, incisalExtensionMm: 0.0, shade: 'BL3' },
          22: { fdi: 22, form: 'oval', x: 60.5, y: 54.5, width: 7.0, height: 8.8, rotation: 2, gingivalShiftMm: 1.5, incisalExtensionMm: 0.2, shade: 'BL3' },
          23: { fdi: 23, form: 'oval', x: 65.8, y: 55.0, width: 7.8, height: 9.8, rotation: 3, gingivalShiftMm: 1.2, incisalExtensionMm: 0.1, shade: 'BL3' }
        }
      }
    ],
    activeRevisionId: 'rev_1',
    simulations: []
  },
  {
    id: 'case_sample_2',
    patientIdentifier: 'PT-2026-094',
    patientName: 'David M. (Incisal Wear & Chipping)',
    dentistId: 'demo-dentist-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    notes: 'Nocturnal bruxism with loss of incisal edge dominance. Tooth 21 mesio-incisal chipping. Needs evaluation of incisal lengthening.',
    activePhotoType: 'smile',
    consentGranted: false,
    photos: {
      smile: {
        url: createSampleSmileSvg(false),
        orientationDeg: 0,
        calibration: {
          isCalibrated: false // Uncalibrated to showcase proportional mode!
        }
      }
    },
    guides: {
      midline: { p1: { x: 500, y: 150 }, p2: { x: 500, y: 550 } },
      bipupillary: { p1: { x: 200, y: 220 }, p2: { x: 800, y: 220 } },
      smileArc: [
        { x: 300, y: 380 },
        { x: 500, y: 440 },
        { x: 700, y: 380 }
      ],
      incisalPlane: { p1: { x: 320, y: 410 }, p2: { x: 680, y: 410 } }
    },
    measurements: {
      11: { fdi: 11, currentWidthMm: 8.5, currentHeightMm: 8.0, probingDepthMm: 1.8, phenotype: 'thick_scalloped', restorativeStatus: 'wear_facet' },
      21: { fdi: 21, currentWidthMm: 8.5, currentHeightMm: 7.6, probingDepthMm: 1.8, phenotype: 'thick_scalloped', restorativeStatus: 'fractured' }
      // Missing other teeth measurements to demonstrate "Further assessment needed" state!
    },
    revisions: [
      {
        id: 'rev_wear_1',
        revisionNumber: 1,
        timestamp: new Date().toISOString(),
        isDentistApproved: false,
        teeth: {
          13: { fdi: 13, form: 'square', x: 34.2, y: 55.0, width: 7.8, height: 9.5, rotation: -2, gingivalShiftMm: 0, incisalExtensionMm: 1.0, shade: 'A1' },
          12: { fdi: 12, form: 'square', x: 39.5, y: 54.5, width: 7.0, height: 8.5, rotation: -1, gingivalShiftMm: 0, incisalExtensionMm: 1.2, shade: 'A1' },
          11: { fdi: 11, form: 'square', x: 45.8, y: 54.0, width: 8.6, height: 10.5, rotation: 0, gingivalShiftMm: 0, incisalExtensionMm: 1.8, shade: 'A1' },
          21: { fdi: 21, form: 'square', x: 54.2, y: 54.0, width: 8.6, height: 10.5, rotation: 0, gingivalShiftMm: 0, incisalExtensionMm: 2.2, shade: 'A1' },
          22: { fdi: 22, form: 'square', x: 60.5, y: 54.5, width: 7.0, height: 8.5, rotation: 1, gingivalShiftMm: 0, incisalExtensionMm: 1.2, shade: 'A1' },
          23: { fdi: 23, form: 'square', x: 65.8, y: 55.0, width: 7.8, height: 9.5, rotation: 2, gingivalShiftMm: 0, incisalExtensionMm: 1.0, shade: 'A1' }
        }
      }
    ],
    activeRevisionId: 'rev_wear_1',
    simulations: []
  }
];
