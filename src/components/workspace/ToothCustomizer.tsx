import React from 'react';
import { ToothTransform, ToothFormType } from '../../types';
import { TOOTH_TEMPLATES, POPULAR_DENTAL_SHADES } from '../../lib/tooth-templates';
import { calculateToothProportion } from '../../lib/clinical-engine';
import { Sliders, BookmarkPlus, Check, Sparkles, AlertTriangle } from 'lucide-react';

interface ToothCustomizerProps {
  selectedFdi: number;
  toothTransform: ToothTransform;
  onUpdateTransform: (updates: Partial<ToothTransform>) => void;
  onApplyFormToAll: (form: ToothFormType) => void;
  isCalibrated: boolean;
  onSavePreset: () => void;
}

export const ToothCustomizer: React.FC<ToothCustomizerProps> = ({
  selectedFdi,
  toothTransform,
  onUpdateTransform,
  onApplyFormToAll,
  isCalibrated,
  onSavePreset
}) => {
  const toothTypes = ['oval', 'square', 'tapered', 'rounded'] as ToothFormType[];
  const proportion = calculateToothProportion(toothTransform.width, toothTransform.height);

  return (
    <div className="flex flex-col gap-4 p-4 bg-clinical-surface rounded-xl border border-clinical-border h-full overflow-y-auto">
      
      {/* Header & Active Tooth Identifier */}
      <div className="flex items-center justify-between border-b border-clinical-border pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-slate-100">Tooth Design & Form</h3>
        </div>
        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
          FDI #{selectedFdi}
        </span>
      </div>

      {/* 1. Tooth Form Gallery (Oval, Square, Tapered, Rounded) */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Morphopsychological Template:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {toothTypes.map((form) => {
            const def = TOOTH_TEMPLATES[form];
            const isActive = toothTransform.form === form;
            return (
              <button
                key={form}
                onClick={() => onUpdateTransform({ form })}
                className={`p-2.5 rounded-lg border text-left transition-all relative ${
                  isActive
                    ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/50 shadow-md'
                    : 'bg-clinical-darkest border-clinical-border hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {def.name}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {def.aestheticCharacter}
                </p>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onApplyFormToAll(toothTransform.form)}
          className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium underline block text-right w-full"
        >
          Apply &ldquo;{TOOTH_TEMPLATES[toothTransform.form].name}&rdquo; across entire smile (13–23)
        </button>
      </div>

      {/* 2. Tooth Shade Picker */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
          Aesthetic Shade:
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {POPULAR_DENTAL_SHADES.map((s) => {
            const isSelected = toothTransform.shade === s.code;
            return (
              <button
                key={s.code}
                onClick={() => onUpdateTransform({ shade: s.code })}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-400 text-white shadow-sm'
                    : 'bg-clinical-darkest border-clinical-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-slate-600" style={{ backgroundColor: s.hex }} />
                <span>{s.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Width & Height Sliders with Live Proportion Gauge */}
      <div className="space-y-3 bg-clinical-darkest/60 p-3 rounded-lg border border-clinical-border">
        {/* Width */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">Width ({isCalibrated ? 'mm' : '%'}):</span>
            <span className="font-mono text-cyan-400 font-semibold">
              {isCalibrated ? `${toothTransform.width.toFixed(1)} mm` : `${toothTransform.width.toFixed(0)}%`}
            </span>
          </div>
          <input
            type="range"
            min={isCalibrated ? 5.0 : 50}
            max={isCalibrated ? 11.0 : 120}
            step={isCalibrated ? 0.1 : 1}
            value={toothTransform.width}
            onChange={(e) => onUpdateTransform({ width: parseFloat(e.target.value) })}
            className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Height */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">Height ({isCalibrated ? 'mm' : '%'}):</span>
            <span className="font-mono text-cyan-400 font-semibold">
              {isCalibrated ? `${toothTransform.height.toFixed(1)} mm` : `${toothTransform.height.toFixed(0)}%`}
            </span>
          </div>
          <input
            type="range"
            min={isCalibrated ? 6.0 : 50}
            max={isCalibrated ? 14.0 : 120}
            step={isCalibrated ? 0.1 : 1}
            value={toothTransform.height}
            onChange={(e) => onUpdateTransform({ height: parseFloat(e.target.value) })}
            className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Live Proportion Meter */}
        <div className="pt-2 border-t border-clinical-border/60 flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">W/H Ratio:</span>
          <div className="flex items-center gap-1.5">
            <span className={`font-bold ${proportion.isHarmonious ? 'text-emerald-400' : 'text-amber-400'}`}>
              {proportion.ratioPercent}%
            </span>
            <span className="text-slate-500 text-[10px]">({proportion.statusText})</span>
          </div>
        </div>
      </div>

      {/* 4. Clinical Delta Sliders (Gingival Movement & Incisal Extension) */}
      <div className="space-y-3 bg-clinical-darkest/60 p-3 rounded-lg border border-clinical-border">
        {/* Gingival Margin Shift */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-300 font-medium">Planned Gingival Shift (Apical &Delta;):</span>
            <span className="font-mono text-emerald-400 font-semibold">
              +{toothTransform.gingivalShiftMm.toFixed(1)} mm
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={4.0}
            step={0.1}
            value={toothTransform.gingivalShiftMm}
            onChange={(e) => onUpdateTransform({ gingivalShiftMm: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Movement of gingival margin in millimeters (triggers EFP biological clearance evaluation).
          </p>
        </div>

        {/* Incisal Extension */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-sky-300 font-medium">Incisal Edge Extension:</span>
            <span className="font-mono text-sky-400 font-semibold">
              +{toothTransform.incisalExtensionMm.toFixed(1)} mm
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={3.0}
            step={0.1}
            value={toothTransform.incisalExtensionMm}
            onChange={(e) => onUpdateTransform({ incisalExtensionMm: parseFloat(e.target.value) })}
            className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Axial Rotation */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">Axial Inclination:</span>
            <span className="font-mono text-slate-300 font-semibold">
              {toothTransform.rotation}&deg;
            </span>
          </div>
          <input
            type="range"
            min={-15}
            max={15}
            step={1}
            value={toothTransform.rotation}
            onChange={(e) => onUpdateTransform({ rotation: parseInt(e.target.value) })}
            className="w-full accent-slate-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Save Preset Button */}
      <button
        onClick={onSavePreset}
        className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-clinical-darkest hover:bg-clinical-border border border-clinical-border text-xs text-slate-200 font-medium transition-all"
      >
        <BookmarkPlus className="w-3.5 h-3.5 text-cyan-400" />
        <span>Save as Reusable Custom Preset</span>
      </button>

    </div>
  );
};
