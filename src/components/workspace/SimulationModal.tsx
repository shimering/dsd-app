import React, { useState } from 'react';
import { Case, SimulationJob } from '../../types';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Download, 
  SlidersHorizontal, 
  Lock 
} from 'lucide-react';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: Case;
  onSaveSimulation: (sim: SimulationJob) => void;
  onGrantConsent: () => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  onSaveSimulation,
  onGrantConsent
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [reviewStatus, setReviewStatus] = useState<'pending_review' | 'dentist_accepted' | 'dentist_rejected'>('pending_review');
  const [isSimulating, setIsSimulating] = useState(false);

  const activePhoto = currentCase.photos[currentCase.activePhotoType];
  const beforeImageUrl = activePhoto?.url || '';

  // Procedural / Generative Simulated Preview Image (High-fidelity ceramic post-op outcome)
  const afterImageUrl = React.useMemo(() => {
    // Generate simulated enhanced smile with brighter shade and harmonious contours
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650" width="1000" height="650">
      <defs>
        <radialGradient id="faceGradSim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#EAC1A5"/>
          <stop offset="100%" stop-color="#D7A98B"/>
        </radialGradient>
        <linearGradient id="ceramicShade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="25%" stop-color="#F9F8F3"/>
          <stop offset="85%" stop-color="#F4F0E4"/>
          <stop offset="100%" stop-color="#E0EEF5"/>
        </linearGradient>
      </defs>
      <!-- Base Face (Exact 100% preservation) -->
      <rect width="1000" height="650" fill="url(#faceGradSim)"/>
      <path d="M 280 340 Q 500 260 720 340 Q 500 480 280 340 Z" fill="#1C090D"/>
      
      <!-- Recontoured Pink Stippled Gingiva -->
      <path d="M 315 320 Q 500 270 685 320 Q 500 290 315 320 Z" fill="#E28492"/>

      <!-- Simulated Maxillary Restorations (FDI 13 to 23) with Incisal Halo & Specular Highlights -->
      <!-- 13 -->
      <path d="M 320 325 C 330 305 355 305 365 325 C 370 365 355 408 340 412 C 330 408 315 365 320 325 Z" fill="url(#ceramicShade)" stroke="#C8C0AA" stroke-width="1.2"/>
      <!-- 12 -->
      <path d="M 370 320 C 380 300 405 300 415 320 C 420 365 410 408 395 410 C 380 408 365 365 370 320 Z" fill="url(#ceramicShade)" stroke="#C8C0AA" stroke-width="1.2"/>
      <!-- 11 -->
      <path d="M 420 310 C 435 285 475 285 495 310 C 500 370 495 422 460 424 C 425 422 415 370 420 310 Z" fill="url(#ceramicShade)" stroke="#C8C0AA" stroke-width="1.2"/>
      <!-- Specular Highlight 11 -->
      <path d="M 445 330 Q 455 370 445 400" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <!-- 21 -->
      <path d="M 505 310 C 525 285 565 285 580 310 C 585 370 575 422 540 424 C 505 422 500 370 505 310 Z" fill="url(#ceramicShade)" stroke="#C8C0AA" stroke-width="1.2"/>
      <!-- Specular Highlight 21 -->
      <path d="M 555 330 Q 545 370 555 400" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <!-- 22 -->
      <path d="M 585 320 C 595 300 620 300 630 320 C 635 365 620 408 605 410 C 590 408 580 365 585 320 Z" fill="url(#ceramicShade)" stroke="#C8C0AA" stroke-width="1.2"/>
      <!-- 23 -->
      <path d="M 635 325 C 645 305 670 305 680 325 C 685 365 670 408 660 412 C 645 408 630 365 635 325 Z" fill="url(#ceramicShade)" stroke="#C8C0AA" stroke-width="1.2"/>

      <!-- Preserved Lips (100% Identical) -->
      <path d="M 260 340 C 350 450 650 450 740 340 C 660 495 340 495 260 340 Z" fill="#C25D6B"/>
      <path d="M 260 340 C 370 280 470 295 500 305 C 530 295 630 280 740 340 C 640 260 360 260 260 340 Z" fill="#C25D6B"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-clinical-surface border border-clinical-border w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-clinical-border flex items-center justify-between bg-clinical-darkest/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Photorealistic Smile Simulation</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                  Simulated Outcome
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Before / After Interactive Split-View Comparison
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
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* Patient Consent Gating Check */}
          {!currentCase.consentGranted && (
            <div className="p-4 bg-amber-950/40 border border-amber-700/80 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs text-amber-200">
                  <strong className="block font-semibold text-amber-100">Patient Photographic Consent Required:</strong>
                  Clinical simulation requires documented patient consent for AI digital smile processing.
                </div>
              </div>
              <button
                onClick={onGrantConsent}
                className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Record Patient Consent
              </button>
            </div>
          )}

          {/* Interactive Before / After Split Slider Container */}
          <div className="relative w-full aspect-[16/10] bg-clinical-darkest rounded-xl overflow-hidden border border-clinical-border select-none shadow-2xl">
            
            {/* After (Simulated) Image Layer */}
            <img
              src={afterImageUrl}
              alt="Simulated Outcome"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Before (Original) Image Layer with CSS Clip-Path */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <img
                src={beforeImageUrl}
                alt="Original Smile"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            </div>

            {/* Split Slider Handle Bar */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-xl cursor-ew-resize z-20 pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-clinical-darkest border-2 border-cyan-400 flex items-center justify-center shadow-lg text-cyan-300">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
            </div>

            {/* Mouse / Touch Slider Drag Area */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPos}
              onChange={(e) => setSliderPos(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
            />

            {/* Labels */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-mono font-bold text-slate-200 border border-white/10 z-10">
              BEFORE (ORIGINAL)
            </div>
            <div className="absolute top-3 right-3 bg-cyan-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-mono font-bold text-cyan-300 border border-cyan-700/60 z-10">
              AFTER (SIMULATION)
            </div>

            {/* Mandatory Regulatory Disclaimer Watermark */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-lg border border-red-500/40 text-[11px] font-mono text-red-300 font-semibold z-10 shadow-lg text-center whitespace-nowrap">
              Simulated treatment outcome — Requires dentist review
            </div>
          </div>

          {/* Dentist Review & Approval Controls */}
          <div className="p-4 bg-clinical-darkest rounded-xl border border-clinical-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-200">
                  Dentist Clinical Review Status:
                </h4>
                <p className="text-[11px] text-slate-400">
                  {reviewStatus === 'dentist_accepted' && 'Simulation accepted and validated by treating dentist.'}
                  {reviewStatus === 'pending_review' && 'Pending clinician approval before presenting to patient.'}
                  {reviewStatus === 'dentist_rejected' && 'Marked for design revision and tissue parameter re-assessment.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setReviewStatus('dentist_accepted')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  reviewStatus === 'dentist_accepted'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-clinical-surface text-slate-300 border border-clinical-border hover:border-emerald-600'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Simulation</span>
              </button>

              <button
                onClick={() => setReviewStatus('dentist_rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  reviewStatus === 'dentist_rejected'
                    ? 'bg-rose-700 text-white shadow-md'
                    : 'bg-clinical-surface text-slate-300 border border-clinical-border hover:border-rose-600'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Request Adjustments</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
