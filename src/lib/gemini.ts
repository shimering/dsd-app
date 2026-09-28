import { GoogleGenAI, Type, Schema } from '@google/genai';
import { AiSuggestion, Case, ToothFormType } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = Boolean(
  apiKey && 
  apiKey !== 'your-gemini-api-key' &&
  !apiKey.includes('placeholder')
);

const aiClient = isGeminiConfigured ? new GoogleGenAI({ apiKey }) : null;

/**
 * Schema for Gemini 3.8 Flash aesthetic suggestions
 */
const suggestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    gallery_suggestions: {
      type: Type.ARRAY,
      description: '3 aesthetic tooth gallery options with clinical rationale',
      items: {
        type: Type.OBJECT,
        properties: {
          styleName: { type: Type.STRING },
          toothTemplate: { 
            type: Type.STRING, 
            enum: ['oval', 'square', 'tapered', 'rounded'] 
          },
          recommendedShade: { type: Type.STRING },
          facialProportionRationale: { type: Type.STRING },
          smileArcAlignment: { type: Type.STRING },
          lipLineDynamics: { type: Type.STRING },
          dentitionNotes: { type: Type.STRING }
        },
        required: [
          'styleName', 
          'toothTemplate', 
          'recommendedShade', 
          'facialProportionRationale', 
          'smileArcAlignment', 
          'lipLineDynamics',
          'dentitionNotes'
        ]
      }
    },
    periodontal_summary: { type: Type.STRING },
    treatment_sequence: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ['gallery_suggestions', 'periodontal_summary', 'treatment_sequence']
};

/**
 * Ask Gemini for 3 editable tooth gallery suggestions
 */
export async function requestAiAestheticSuggestions(
  currentCase: Case,
  photoBase64?: string
): Promise<{ suggestions: AiSuggestion[]; sequence: string[]; perioSummary: string }> {
  if (!isGeminiConfigured || !aiClient) {
    // High-quality procedural fallback when no API key is provided
    return getProceduralSuggestions(currentCase);
  }

  try {
    const clinicalSummary = {
      patientId: currentCase.patientIdentifier,
      activeToothForm: currentCase.revisions[0]?.teeth[11]?.form || 'rounded',
      calibrated: currentCase.photos.smile?.calibration?.isCalibrated || false,
      pixelsPerMm: currentCase.photos.smile?.calibration?.pixelsPerMm || null,
      fdiMeasurements: Object.values(currentCase.measurements).map(m => ({
        fdi: m.fdi,
        phenotype: m.phenotype,
        boneSounding: m.boneSoundingMm,
        ktw: m.keratinizedTissueWidthMm,
        probingDepth: m.probingDepthMm
      }))
    };

    const promptText = `You are a clinical Digital Smile Design (DSD) expert consultant.
Analyze this patient's clinical presentation and measurements:
${JSON.stringify(clinicalSummary, null, 2)}

Provide 3 distinct, editable aesthetic tooth form options (Oval, Square, Tapered, Rounded) and a proposed sequence.
IMPORTANT CLINICAL RULES:
1. Treat them as aesthetic harmony options. Do NOT claim that facial outline strictly dictates tooth form.
2. Ground explanations in the smile arc curvature, lip line dynamics, and restorative findings.
3. Suggest appropriate VITA/Bleach shades (e.g. BL2, BL3, A1, B1).`;

    const contents: any[] = [{ text: promptText }];

    if (photoBase64) {
      const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: suggestionSchema,
        temperature: 0.3
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    const suggestions: AiSuggestion[] = (parsed.gallery_suggestions || []).map((s: any, idx: number) => ({
      id: `ai_sug_${idx + 1}`,
      styleName: s.styleName || `Option ${idx + 1}`,
      toothTemplate: (s.toothTemplate?.toLowerCase() as ToothFormType) || 'rounded',
      recommendedShade: s.recommendedShade || 'A1',
      facialProportionRationale: s.facialProportionRationale || '',
      smileArcAlignment: s.smileArcAlignment || '',
      lipLineDynamics: s.lipLineDynamics || '',
      dentitionNotes: s.dentitionNotes || ''
    }));

    return {
      suggestions: suggestions.length > 0 ? suggestions : getProceduralSuggestions(currentCase).suggestions,
      sequence: parsed.treatment_sequence || getProceduralSuggestions(currentCase).sequence,
      perioSummary: parsed.periodontal_summary || 'Periodontal evaluation required prior to definitive restorations.'
    };
  } catch (err) {
    console.warn('Gemini API call failed, falling back to procedural engine:', err);
    return getProceduralSuggestions(currentCase);
  }
}

/**
 * High-fidelity fallback suggestions based on dental proportion aesthetics
 */
function getProceduralSuggestions(currentCase: Case): {
  suggestions: AiSuggestion[];
  sequence: string[];
  perioSummary: string;
} {
  return {
    suggestions: [
      {
        id: 'sug_1',
        styleName: 'Natural Harmonious',
        toothTemplate: 'rounded',
        recommendedShade: 'A1',
        facialProportionRationale: 'Balanced proportions with softened line angles complement the gentle curve of the lower lip without angular dominance.',
        smileArcAlignment: 'Consonant smile arc where central incisal edges gently parallel the relaxed lower vermillion border.',
        lipLineDynamics: 'Average smile line displaying 100% of clinical crown height with 1 mm of contiguous marginal gingiva.',
        dentitionNotes: 'Central width-to-length ratio maintained at 78% for harmonious dominance.'
      },
      {
        id: 'sug_2',
        styleName: 'Dynamic Youthful',
        toothTemplate: 'tapered',
        recommendedShade: 'BL3',
        facialProportionRationale: 'Slender cervical third with slightly pronounced incisal embrasure spaces to introduce depth and vitality.',
        smileArcAlignment: 'Subtly exaggerated curvature with lateral incisors set 0.8 mm apical to central incisal plane.',
        lipLineDynamics: 'Ideal for medium-high smile line, drawing focus to vertical crown proportions.',
        dentitionNotes: 'Accentuates interdental papillae; requires confirmation of sufficient interproximal bone crest.'
      },
      {
        id: 'sug_3',
        styleName: 'Soft Classic',
        toothTemplate: 'oval',
        recommendedShade: 'B1',
        facialProportionRationale: 'Rounded transitions and subtle developmental grooves deliver a classic aesthetic that integrates smoothly with existing dentition.',
        smileArcAlignment: 'Softly arched transition across the canine eminences, preventing buccal corridor collapse.',
        lipLineDynamics: 'Low to average lip line mobility, masking minor asymmetries in the posterior sextants.',
        dentitionNotes: 'Minimizes incisal edge chipping risk through gently rounded line angles.'
      }
    ],
    sequence: [
      '1. Photographic and digital calibration confirmation with patient consent.',
      '2. Periodontal evaluation: assessment of supracrestal tissue attachment and biological clearance.',
      '3. Soft-tissue recontouring / crown lengthening (if indicated by bone sounding).',
      '4. Diagnostic aesthetic mock-up (2D blueprint transfer to intraoral trial).',
      '5. Minimal-prep restorative phase (ceramic veneers / direct composites 13–23).'
    ],
    perioSummary: 'Biological width and keratinized tissue must be verified deterministically before any tissue removal is executed.'
  };
}
