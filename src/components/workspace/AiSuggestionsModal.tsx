import React, { useState } from 'react';
import { AiSuggestion, Case, ToothFormType } from '../../types';
import { requestAiAestheticSuggestions, isGeminiConfigured } from '../../lib/gemini';
import { 
  Sparkles, 
  X, 
  Check, 
  ArrowRight, 
  HelpCircle, 
  Layers, 
  Smile, 
  Loader2 
} from 'lucide-react';

interface AiSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: Case;
  onApplySuggestion: (suggestion: AiSuggestion) => void;
}

export const AiSuggestionsModal: React.FC<AiSuggestionsModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  onApplySuggestion
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [sequence, setSequence] = useState<string[]>([]);
  const [perioSummary, setPerioSummary] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const result = await requestAiAestheticSuggestions(currentCase);
      setSuggestions(result.suggestions);
      setSequence(result.sequence);
      setPerioSummary(result.perioSummary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-clinical-surface border border-clinical-border w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-clinical-border flex items-center justify-between bg-clinical-darkest/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>AI Aesthetic Smile Gallery Suggestions</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Harmonious options based on facial proportions, smile arc, lip line, and dentition.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-clinical-border transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Clinical Mandate Alert */}
          <div className="p-3 bg-cyan-950/30 border border-cyan-800/60 rounded-xl text-xs text-cyan-200/90 flex items-start gap-2.5">
            <Smile className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Clinical Esthetic Principle:</strong> AI suggestions are presented as harmonious options. Facial shape does not rigidly dictate tooth form. All options remain fully editable by the dentist.
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs font-mono text-slate-300">
                Evaluating facial thirds, smile curvature & biological clearance...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestions.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="bg-clinical-darkest border border-clinical-border hover:border-cyan-500/60 rounded-xl p-4 flex flex-col justify-between transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-clinical-border pb-2.5">
                      <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                        Option #{idx + 1}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {s.recommendedShade}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {s.styleName}
                      </h4>
                      <span className="text-xs font-medium text-teal-400 uppercase tracking-wide">
                        Form: {s.toothTemplate}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                      <div>
                        <strong className="text-[11px] text-slate-400 block font-semibold">Facial Proportions:</strong>
                        <p className="text-[11px] text-slate-300">{s.facialProportionRationale}</p>
                      </div>
                      <div>
                        <strong className="text-[11px] text-slate-400 block font-semibold">Smile Arc Harmony:</strong>
                        <p className="text-[11px] text-slate-300">{s.smileArcAlignment}</p>
                      </div>
                      <div>
                        <strong className="text-[11px] text-slate-400 block font-semibold">Lip Line Dynamics:</strong>
                        <p className="text-[11px] text-slate-300">{s.lipLineDynamics}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onApplySuggestion(s);
                      onClose();
                    }}
                    className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition-all"
                  >
                    <span>Apply to Smile Design</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
