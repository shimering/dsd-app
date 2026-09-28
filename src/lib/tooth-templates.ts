import { ToothFormType } from '../types';

export interface ToothTemplateDefinition {
  name: string;
  description: string;
  aestheticCharacter: string;
  baseWidthRatio: number; // Relative to central incisor (1.0)
  baseHeightRatio: number;
  // Normalized SVG path in a 100x100 coordinate box
  outlinePath: (toothType: 'central' | 'lateral' | 'canine', isRightSide: boolean) => string;
}

export const TOOTH_TEMPLATES: Record<ToothFormType, ToothTemplateDefinition> = {
  oval: {
    name: 'Oval',
    description: 'Rounded line angles with delicate transitional lobes and gentle incisal curves.',
    aestheticCharacter: 'Delicate, dynamic, feminine, soft harmony',
    baseWidthRatio: 1.0,
    baseHeightRatio: 1.0,
    outlinePath: (type, isRight) => {
      if (type === 'canine') {
        return 'M 50 8 C 72 8 88 32 86 65 C 85 82 68 94 50 96 C 32 94 15 82 14 65 C 12 32 28 8 50 8 Z';
      }
      if (type === 'lateral') {
        return 'M 50 10 C 72 10 86 35 84 70 C 82 88 66 94 50 94 C 34 94 18 88 16 70 C 14 35 28 10 50 10 Z';
      }
      // Central Incisor
      const mPoint = isRight ? '84 88' : '16 88';
      const dPoint = isRight ? '16 85' : '84 85';
      return `M 50 8 C 76 8 88 30 87 68 C 86 86 70 94 50 94 C 30 94 14 86 13 68 C 12 30 24 8 50 8 Z`;
    }
  },
  square: {
    name: 'Square',
    description: 'Straight proximal line angles, flat incisal edges, and defined facial lobes.',
    aestheticCharacter: 'Strong, prominent, masculine, decisive presence',
    baseWidthRatio: 1.05,
    baseHeightRatio: 0.96,
    outlinePath: (type, _isRight) => {
      if (type === 'canine') {
        return 'M 50 10 C 78 10 88 28 86 60 C 84 82 72 94 50 96 C 28 94 16 82 14 60 C 12 28 22 10 50 10 Z';
      }
      if (type === 'lateral') {
        return 'M 50 12 C 76 12 85 30 84 66 C 83 88 78 92 50 92 C 22 92 17 88 16 66 C 15 30 24 12 50 12 Z';
      }
      // Central
      return 'M 50 10 C 78 10 88 25 87 65 C 86 88 84 94 50 94 C 16 94 14 88 13 65 C 12 25 22 10 50 10 Z';
    }
  },
  tapered: {
    name: 'Tapered',
    description: 'Narrow cervical neck converging toward the gingival margin with prominent incisal embrasures.',
    aestheticCharacter: 'Youthful, active, slender, energetic balance',
    baseWidthRatio: 0.95,
    baseHeightRatio: 1.04,
    outlinePath: (type, _isRight) => {
      if (type === 'canine') {
        return 'M 50 14 C 68 14 86 35 84 65 C 82 82 66 96 50 97 C 34 96 18 82 16 65 C 14 35 32 14 50 14 Z';
      }
      if (type === 'lateral') {
        return 'M 50 16 C 66 16 85 38 82 70 C 80 88 64 93 50 93 C 36 93 20 88 18 70 C 15 38 34 16 50 16 Z';
      }
      // Central
      return 'M 50 12 C 68 12 88 32 84 68 C 81 88 68 94 50 94 C 32 94 19 88 16 68 C 12 32 32 12 50 12 Z';
    }
  },
  rounded: {
    name: 'Rounded',
    description: 'Harmonious classic balance with softened embrasure spaces and natural line reflections.',
    aestheticCharacter: 'Balanced, timeless, classic, universal aesthetic',
    baseWidthRatio: 1.0,
    baseHeightRatio: 1.0,
    outlinePath: (type, _isRight) => {
      if (type === 'canine') {
        return 'M 50 10 C 74 10 87 30 85 64 C 83 82 68 94 50 96 C 32 94 17 82 15 64 C 13 30 26 10 50 10 Z';
      }
      if (type === 'lateral') {
        return 'M 50 11 C 70 11 86 34 83 68 C 81 88 66 93 50 93 C 34 93 19 88 17 68 C 14 34 30 11 50 11 Z';
      }
      // Central
      return 'M 50 9 C 75 9 87 28 86 66 C 84 87 70 93 50 93 C 30 93 16 87 14 66 C 13 28 25 9 50 9 Z';
    }
  },
  custom: {
    name: 'Custom',
    description: 'Freeform customized contour tailored to patient anatomy.',
    aestheticCharacter: 'Bespoke clinical restoration',
    baseWidthRatio: 1.0,
    baseHeightRatio: 1.0,
    outlinePath: (type, isRight) => TOOTH_TEMPLATES.rounded.outlinePath(type, isRight)
  }
};

export const POPULAR_DENTAL_SHADES = [
  { code: 'BL1', name: 'Bleach 1 (Ultra Bright)', hex: '#FCFDFE', reflection: '0.95' },
  { code: 'BL2', name: 'Bleach 2 (High Value)', hex: '#FAF9F6', reflection: '0.90' },
  { code: 'BL3', name: 'Bleach 3 (Natural Bright)', hex: '#F6F4EE', reflection: '0.86' },
  { code: 'A1', name: 'VITA A1 (Light Natural)', hex: '#F3EFE3', reflection: '0.82' },
  { code: 'A2', name: 'VITA A2 (Standard Natural)', hex: '#EBE4D0', reflection: '0.78' },
  { code: 'B1', name: 'VITA B1 (Light Warm)', hex: '#F5EFE0', reflection: '0.84' },
  { code: 'B2', name: 'VITA B2 (Warm Natural)', hex: '#ECE3CE', reflection: '0.79' }
];

export function getToothTypeFromFdi(fdi: number): 'central' | 'lateral' | 'canine' {
  if (fdi === 11 || fdi === 21) return 'central';
  if (fdi === 12 || fdi === 22) return 'lateral';
  return 'canine';
}

export function isRightQuadrant(fdi: number): boolean {
  return fdi < 20; // 11, 12, 13 are patient's right (quadrant 1)
}
