import React from 'react';
import { 
  Sparkles, 
  FileDown, 
  RotateCcw, 
  Camera, 
  Ruler, 
  Layers, 
  FileText, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Case } from '../types';
import { isGeminiConfigured } from '../lib/gemini';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  activeTab: 'photos' | 'measurements' | 'gallery' | 'simulation' | 'plan';
  setActiveTab: (tab: 'photos' | 'measurements' | 'gallery' | 'simulation' | 'plan') => void;
  currentCase: Case;
  allCases: Case[];
  onSelectCase: (caseId: string) => void;
  onResetDesign: () => void;
  onExportPdf: () => void;
  onOpenAiSuggestions: () => void;
  isCalibrated: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentCase,
  allCases,
  onSelectCase,
  onResetDesign,
  onExportPdf,
  onOpenAiSuggestions,
  isCalibrated
}) => {
  return (
    <header className="bg-clinical-surface border-b border-clinical-border sticky top-0 z-40 px-3 md:px-6 py-2.5">
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Patient Selector */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8 2 5 5 5 9c0 5 3 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>
                <path d="M8 9a4 4 0 0 0 8 0"/>
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-teal-300">
                Digital Smile Design
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Evaluation Prototype
              </span>
            </div>
          </div>

          {/* Case Dropdown */}
          <div className="relative">
            <select
              value={currentCase.id}
              onChange={(e) => onSelectCase(e.target.value)}
              className="bg-clinical-darkest border border-clinical-border text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            >
              {allCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.patientName || c.patientIdentifier}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Tabs (Strict non-overlapping responsive pill navigation) */}
        <nav className="flex items-center gap-1 bg-clinical-darkest p-1 rounded-xl border border-clinical-border overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'photos'
                ? 'bg-clinical-surface text-cyan-400 shadow-sm border border-clinical-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photos</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'gallery'
                ? 'bg-clinical-surface text-cyan-400 shadow-sm border border-clinical-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tooth Gallery</span>
          </button>

          <button
            onClick={() => setActiveTab('measurements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'measurements'
                ? 'bg-clinical-surface text-cyan-400 shadow-sm border border-clinical-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Measurements</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'simulation'
                ? 'bg-clinical-surface text-cyan-400 shadow-sm border border-clinical-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Simulation</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'plan'
                ? 'bg-clinical-surface text-cyan-400 shadow-sm border border-clinical-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Treatment Plan</span>
          </button>
        </nav>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Calibration Badge */}
          <div 
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
              isCalibrated 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' 
                : 'bg-amber-950/60 text-amber-300 border-amber-800'
            }`}
            title={isCalibrated ? 'Millimeter display active' : 'Uncalibrated photo: showing proportions only'}
          >
            {isCalibrated ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>CALIBRATED (mm)</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>PROPORTIONS (%)</span>
              </>
            )}
          </div>

          {/* AI Suggestions Trigger */}
          <button
            onClick={onOpenAiSuggestions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/20 to-teal-500/20 text-cyan-300 hover:from-cyan-600/30 hover:to-teal-500/30 border border-cyan-700/50 text-xs font-medium shadow-sm transition-all"
            title="Ask Gemini 3.8 Flash for aesthetic smile recommendations"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">AI Suggestions</span>
          </button>

          {/* Reset / Undo */}
          <button
            onClick={onResetDesign}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-clinical-border border border-transparent transition-all"
            title="Reset Design Overlay"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Export PDF */}
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clinical-darkest hover:bg-clinical-border text-slate-200 border border-clinical-border text-xs font-medium transition-all"
            title="Export printable clinical treatment report"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>

      </div>
    </header>
  );
};
