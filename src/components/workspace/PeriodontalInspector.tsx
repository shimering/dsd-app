import React from 'react';
import { 
  ToothMeasurement, 
  ToothTransform, 
  ClinicalEvaluationResult, 
  PeriodontalPhenotype, 
  RestorativeStatus 
} from '../../types';
import { evaluatePeriodontalCandidate } from '../../lib/clinical-engine';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ShieldAlert, 
  Scissors, 
  Layers 
} from 'lucide-react';

interface PeriodontalInspectorProps {
  selectedFdi: number;
  onSelectTooth: (fdi: number) => void;
  measurements: Record<number, ToothMeasurement>;
  toothTransforms: Record<number, ToothTransform>;
  onUpdateMeasurement: (fdi: number, updates: Partial<ToothMeasurement>) => void;
  isCalibrated: boolean;
}

export const PeriodontalInspector: React.FC<PeriodontalInspectorProps> = ({
  selectedFdi,
  onSelectTooth,
  measurements,
  toothTransforms,
  onUpdateMeasurement,
  isCalibrated
}) => {
  const currentMeasurement = measurements[selectedFdi];
  const currentTransform = toothTransforms[selectedFdi];
  const evaluation: ClinicalEvaluationResult = evaluatePeriodontalCandidate(
    currentMeasurement,
    currentTransform,
    isCalibrated
  );

  const teethList = [13, 12, 11, 21, 22, 23];

  return (
    <div className="flex flex-col gap-4 p-4 bg-clinical-surface rounded-xl border border-clinical-border h-full overflow-y-auto">
      
      {/* Top FDI Tooth Switcher Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm text-slate-100">Periodontal & Bone Findings</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">EFP 2026 Engine</span>
        </div>

        {/* 6 Tooth Pill Buttons */}
        <div className="grid grid-cols-6 gap-1 bg-clinical-darkest p-1 rounded-lg border border-clinical-border">
          {teethList.map((fdi) => {
            const isSelected = selectedFdi === fdi;
            const evalResult = evaluatePeriodontalCandidate(
              measurements[fdi],
              toothTransforms[fdi],
              isCalibrated
            );

            let dotColor = 'bg-slate-500';
            if (evalResult.outcome === 'candidate_gingivectomy') dotColor = 'bg-emerald-400';
            if (evalResult.outcome === 'candidate_crown_lengthening') dotColor = 'bg-sky-400';
            if (evalResult.outcome === 'further_assessment_needed') dotColor = 'bg-amber-400';
            if (evalResult.outcome === 'referral_periodontist') dotColor = 'bg-rose-400';

            return (
              <button
                key={fdi}
                onClick={() => onSelectTooth(fdi)}
                className={`py-1.5 px-1 rounded flex flex-col items-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-clinical-surface text-cyan-300 font-bold border border-cyan-700/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-xs font-mono">#{fdi}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Clinical Measurement Inputs */}
      <div className="bg-clinical-darkest/70 p-3 rounded-lg border border-clinical-border space-y-3">
        <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
          <span>Clinical Probing Findings (#{selectedFdi}):</span>
          <span className="text-[10px] text-cyan-400 font-mono">Clinician Recorded</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Bone Sounding */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Bone Sounding (FGM to Crest):
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 4.2"
                value={currentMeasurement?.boneSoundingMm ?? ''}
                onChange={(e) => onUpdateMeasurement(selectedFdi, {
                  boneSoundingMm: e.target.value === '' ? undefined : parseFloat(e.target.value)
                })}
                className="w-full bg-clinical-surface border border-clinical-border rounded px-2 py-1 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-xs font-mono text-slate-400">mm</span>
            </div>
          </div>

          {/* Keratinized Tissue Width (KTW) */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Keratinized Tissue (KTW):
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 5.5"
                value={currentMeasurement?.keratinizedTissueWidthMm ?? ''}
                onChange={(e) => onUpdateMeasurement(selectedFdi, {
                  keratinizedTissueWidthMm: e.target.value === '' ? undefined : parseFloat(e.target.value)
                })}
                className="w-full bg-clinical-surface border border-clinical-border rounded px-2 py-1 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-xs font-mono text-slate-400">mm</span>
            </div>
          </div>

          {/* Probing Depth */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Sulcus Probing Depth:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 2.0"
                value={currentMeasurement?.probingDepthMm ?? ''}
                onChange={(e) => onUpdateMeasurement(selectedFdi, {
                  probingDepthMm: e.target.value === '' ? undefined : parseFloat(e.target.value)
                })}
                className="w-full bg-clinical-surface border border-clinical-border rounded px-2 py-1 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-xs font-mono text-slate-400">mm</span>
            </div>
          </div>

          {/* CEJ Location */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              FGM to CEJ:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 1.8"
                value={currentMeasurement?.cejLocationMm ?? ''}
                onChange={(e) => onUpdateMeasurement(selectedFdi, {
                  cejLocationMm: e.target.value === '' ? undefined : parseFloat(e.target.value)
                })}
                className="w-full bg-clinical-surface border border-clinical-border rounded px-2 py-1 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-xs font-mono text-slate-400">mm</span>
            </div>
          </div>
        </div>

        {/* Phenotype & Restorative status */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-clinical-border/60">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Periodontal Phenotype:</label>
            <select
              value={currentMeasurement?.phenotype || 'thick_flat'}
              onChange={(e) => onUpdateMeasurement(selectedFdi, { phenotype: e.target.value as PeriodontalPhenotype })}
              className="w-full bg-clinical-surface border border-clinical-border rounded px-2 py-1 text-xs text-slate-200"
            >
              <option value="thick_flat">Thick Flat (Favorable)</option>
              <option value="thick_scalloped">Thick Scalloped</option>
              <option value="thin_scalloped">Thin Scalloped (High Risk)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Restorative Status:</label>
            <select
              value={currentMeasurement?.restorativeStatus || 'natural'}
              onChange={(e) => onUpdateMeasurement(selectedFdi, { restorativeStatus: e.target.value as RestorativeStatus })}
              className="w-full bg-clinical-surface border border-clinical-border rounded px-2 py-1 text-xs text-slate-200"
            >
              <option value="natural">Natural Dentition</option>
              <option value="composite">Composite Restoration</option>
              <option value="veneer">Ceramic Veneer</option>
              <option value="crown">Full Crown</option>
              <option value="wear_facet">Severe Incisal Wear</option>
              <option value="fractured">Fractured Incisal Edge</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deterministic Biological Clearance Evaluation Card */}
      <div className={`p-3.5 rounded-lg border transition-all ${
        evaluation.outcome === 'candidate_gingivectomy'
          ? 'bg-emerald-950/40 border-emerald-700/80 text-emerald-200'
          : evaluation.outcome === 'candidate_crown_lengthening'
          ? 'bg-sky-950/40 border-sky-700/80 text-sky-200'
          : evaluation.outcome === 'referral_periodontist'
          ? 'bg-rose-950/40 border-rose-700/80 text-rose-200'
          : 'bg-amber-950/40 border-amber-700/80 text-amber-200'
      }`}>
        <div className="flex items-start gap-2.5 mb-2">
          {evaluation.outcome === 'candidate_gingivectomy' && <Scissors className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {evaluation.outcome === 'candidate_crown_lengthening' && <Layers className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}
          {evaluation.outcome === 'referral_periodontist' && <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          {evaluation.outcome === 'further_assessment_needed' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
          {evaluation.outcome === 'restorative_only' && <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />}

          <div>
            <h4 className="font-bold text-xs leading-snug">
              {evaluation.headline}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-mono">
              <span>Proposed &Delta;GM: +{(currentTransform?.gingivalShiftMm || 0).toFixed(1)}mm</span>
              {evaluation.remainingBoneClearanceMm !== undefined && (
                <span>| Bone Crest Clearance: {evaluation.remainingBoneClearanceMm.toFixed(1)}mm</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Biological Rationale List */}
        <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1 text-[11px]">
          {evaluation.supportingFindings.map((finding, idx) => (
            <div key={idx} className="flex items-start gap-1.5 opacity-90">
              <span className="text-white/60">•</span>
              <span>{finding}</span>
            </div>
          ))}
        </div>

        {/* Mandatory Clinician Override Checklist */}
        {evaluation.requiresClinicianConfirmation && (
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={currentMeasurement?.boneSoundingMm !== undefined}
                className="accent-cyan-500 rounded"
              />
              <span className="font-medium">Clinician confirms biological clearance</span>
            </label>
            <span className="text-[10px] uppercase font-mono tracking-wider opacity-75">
              Requires In-Person Probe
            </span>
          </div>
        )}
      </div>

    </div>
  );
};
