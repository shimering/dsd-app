import React, { useState, useEffect } from 'react';
import { Case, ToothTransform, CalibrationData, ToothFormType, ToothMeasurement, AiSuggestion, SimulationJob } from './types';
import { SAMPLE_CASES } from './lib/sample-data';
import { Header } from './components/Header';
import { SmileCanvas } from './components/workspace/SmileCanvas';
import { ToothCustomizer } from './components/workspace/ToothCustomizer';
import { PeriodontalInspector } from './components/workspace/PeriodontalInspector';
import { PhotosView } from './components/workspace/PhotosView';
import { TreatmentPlanView } from './components/workspace/TreatmentPlanView';
import { AiSuggestionsModal } from './components/workspace/AiSuggestionsModal';
import { SimulationModal } from './components/workspace/SimulationModal';
import { exportTreatmentPlanPdf } from './lib/pdf-export';
import { evaluatePeriodontalCandidate } from './lib/clinical-engine';
import { 
  Eye, 
  EyeOff, 
  Layers, 
  Activity, 
  Sliders, 
  Sparkles, 
  Check, 
  AlertCircle 
} from 'lucide-react';

export const App: React.FC = () => {
  // Case management
  const [cases, setCases] = useState<Case[]>(() => {
    const saved = localStorage.getItem('dsd_app_cases');
    return saved ? JSON.parse(saved) : SAMPLE_CASES;
  });
  const [currentCaseId, setCurrentCaseId] = useState<string>(SAMPLE_CASES[0].id);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'photos' | 'measurements' | 'gallery' | 'simulation' | 'plan'>('gallery');

  // Active FDI Tooth (default 11: Maxillary Right Central Incisor)
  const [selectedFdi, setSelectedFdi] = useState<number>(11);

  // Right sidebar tab (on Desktop / iPad)
  const [sidebarTab, setSidebarTab] = useState<'tooth' | 'perio'>('tooth');

  // Canvas visual guides toggles
  const [showMidline, setShowMidline] = useState<boolean>(true);
  const [showSmileArc, setShowSmileArc] = useState<boolean>(true);
  const [showTeethOverlay, setShowTeethOverlay] = useState<boolean>(true);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.9);

  // Modals
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showSimulationModal, setShowSimulationModal] = useState<boolean>(false);

  // Find active case
  const currentCase = cases.find(c => c.id === currentCaseId) || cases[0];
  const activePhoto = currentCase.photos[currentCase.activePhotoType];
  const isCalibrated = activePhoto?.calibration?.isCalibrated || false;

  const activeRevision = currentCase.revisions.find(r => r.id === currentCase.activeRevisionId) || currentCase.revisions[0];
  const currentToothTransform = activeRevision?.teeth[selectedFdi] || {
    fdi: selectedFdi,
    form: 'rounded',
    x: 50,
    y: 50,
    width: 8.5,
    height: 10.5,
    rotation: 0,
    gingivalShiftMm: 0,
    incisalExtensionMm: 0,
    shade: 'A1'
  };

  // Save cases to local storage whenever modified
  useEffect(() => {
    localStorage.setItem('dsd_app_cases', JSON.stringify(cases));
  }, [cases]);

  // Update a single tooth's 2D vector parameters
  const handleUpdateToothTransform = (fdi: number, updates: Partial<ToothTransform>) => {
    setCases(prev => prev.map(c => {
      if (c.id !== currentCase.id) return c;
      const updatedRevisions = c.revisions.map(rev => {
        if (rev.id !== c.activeRevisionId) return rev;
        const currentTooth = rev.teeth[fdi];
        return {
          ...rev,
          teeth: {
            ...rev.teeth,
            [fdi]: { ...currentTooth, ...updates }
          }
        };
      });
      return { ...c, revisions: updatedRevisions };
    }));
  };

  // Apply a tooth form across all 6 visible upper teeth (13 to 23)
  const handleApplyFormToAll = (form: ToothFormType) => {
    setCases(prev => prev.map(c => {
      if (c.id !== currentCase.id) return c;
      const updatedRevisions = c.revisions.map(rev => {
        if (rev.id !== c.activeRevisionId) return rev;
        const newTeeth = { ...rev.teeth };
        [13, 12, 11, 21, 22, 23].forEach(fdi => {
          if (newTeeth[fdi]) {
            newTeeth[fdi] = { ...newTeeth[fdi], form };
          }
        });
        return { ...rev, teeth: newTeeth };
      });
      return { ...c, revisions: updatedRevisions };
    }));
  };

  // Update Tooth Probing Measurement
  const handleUpdateMeasurement = (fdi: number, updates: Partial<ToothMeasurement>) => {
    setCases(prev => prev.map(c => {
      if (c.id !== currentCase.id) return c;
      return {
        ...c,
        measurements: {
          ...c.measurements,
          [fdi]: { ...c.measurements[fdi], ...updates }
        }
      };
    }));
  };

  // Update Photo Calibration (mm scale)
  const handleUpdateCalibration = (calibration: CalibrationData) => {
    setCases(prev => prev.map(c => {
      if (c.id !== currentCase.id) return c;
      const photoType = c.activePhotoType;
      const currentPhoto = c.photos[photoType];
      if (!currentPhoto) return c;
      return {
        ...c,
        photos: {
          ...c.photos,
          [photoType]: {
            ...currentPhoto,
            calibration
          }
        }
      };
    }));
  };

  // Apply AI Suggestion to Design
  const handleApplyAiSuggestion = (sug: AiSuggestion) => {
    handleApplyFormToAll(sug.toothTemplate);
    [13, 12, 11, 21, 22, 23].forEach(fdi => {
      handleUpdateToothTransform(fdi, { shade: sug.recommendedShade });
    });
  };

  // Reset overlay
  const handleResetDesign = () => {
    if (confirm('Reset 2D tooth design to default baseline?')) {
      const defaultCase = SAMPLE_CASES.find(sc => sc.id === currentCase.id) || SAMPLE_CASES[0];
      setCases(prev => prev.map(c => c.id === currentCase.id ? { ...c, revisions: defaultCase.revisions } : c));
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    const evaluations: any = {};
    [13, 12, 11, 21, 22, 23].forEach(fdi => {
      evaluations[fdi] = evaluatePeriodontalCandidate(
        currentCase.measurements[fdi],
        activeRevision?.teeth[fdi],
        isCalibrated
      );
    });
    exportTreatmentPlanPdf(currentCase, evaluations);
  };

  return (
    <div className="flex flex-col min-h-screen bg-clinical-darkest text-slate-100 selection:bg-cyan-500/20">
      
      {/* 1. Universal Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentCase={currentCase}
        allCases={cases}
        onSelectCase={setCurrentCaseId}
        onResetDesign={handleResetDesign}
        onExportPdf={handleExportPdf}
        onOpenAiSuggestions={() => setShowAiModal(true)}
        isCalibrated={isCalibrated}
      />

      {/* 2. Main Content Views */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* TAB A: PHOTOS MANAGEMENT */}
        {activeTab === 'photos' && (
          <PhotosView
            currentCase={currentCase}
            onUpdatePhoto={(type, url, deg) => {
              setCases(prev => prev.map(c => {
                if (c.id !== currentCase.id) return c;
                return {
                  ...c,
                  photos: {
                    ...c.photos,
                    [type]: { url, orientationDeg: deg, calibration: { isCalibrated: false } }
                  }
                };
              }));
            }}
            onSelectActivePhoto={(type) => {
              setCases(prev => prev.map(c => c.id === currentCase.id ? { ...c, activePhotoType: type } : c));
              setActiveTab('gallery');
            }}
          />
        )}

        {/* TAB B: SMILE DESIGN WORKSPACE (Canvas + Controls) */}
        {(activeTab === 'gallery' || activeTab === 'measurements') && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 md:p-4 max-w-[1920px] mx-auto w-full h-[calc(100vh-65px)] overflow-hidden">
            
            {/* Left Column: Quick Toolbox (Hidden on small mobile, docked on desktop) */}
            <div className="hidden xl:flex xl:col-span-2 flex-col gap-3 h-full overflow-y-auto">
              <div className="p-3 bg-clinical-surface rounded-xl border border-clinical-border space-y-4">
                <h4 className="text-xs font-bold text-slate-200 border-b border-clinical-border pb-2 flex items-center justify-between">
                  <span>Visual Guides</span>
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                </h4>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-clinical-darkest">
                    <span className="text-slate-300">Facial Midline</span>
                    <input
                      type="checkbox"
                      checked={showMidline}
                      onChange={(e) => setShowMidline(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-clinical-darkest">
                    <span className="text-slate-300">Smile Arc Curve</span>
                    <input
                      type="checkbox"
                      checked={showSmileArc}
                      onChange={(e) => setShowSmileArc(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-clinical-darkest">
                    <span className="text-slate-300">Tooth Overlays</span>
                    <input
                      type="checkbox"
                      checked={showTeethOverlay}
                      onChange={(e) => setShowTeethOverlay(e.target.checked)}
                      className="accent-teal-500 rounded"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-clinical-border">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Overlay Opacity:</span>
                    <span className="font-mono text-cyan-400">{Math.round(overlayOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Simulation Quick Launch Card */}
              <div className="p-4 bg-gradient-to-br from-cyan-950/60 to-teal-950/40 rounded-xl border border-cyan-800/60 flex flex-col justify-between gap-3 shadow-lg">
                <div>
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Smile Simulation</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Render photorealistic post-op previews with lifelike enamel & stippled margins.
                  </p>
                </div>
                <button
                  onClick={() => setShowSimulationModal(true)}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Launch Simulation</span>
                </button>
              </div>
            </div>

            {/* Center Column: Interactive Canvas */}
            <div className="col-span-1 lg:col-span-8 xl:col-span-7 h-full flex flex-col">
              <SmileCanvas
                currentCase={currentCase}
                selectedFdi={selectedFdi}
                onSelectTooth={setSelectedFdi}
                onUpdateToothTransform={handleUpdateToothTransform}
                onUpdateCalibration={handleUpdateCalibration}
                onUpdateGuides={(guides) => {
                  setCases(prev => prev.map(c => c.id === currentCase.id ? { ...c, guides } : c));
                }}
                showMidline={showMidline}
                showSmileArc={showSmileArc}
                showTeethOverlay={showTeethOverlay}
                overlayOpacity={overlayOpacity}
              />
            </div>

            {/* Right Column: Customizer & Periodontal Inspector */}
            <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col h-full overflow-hidden">
              {/* Tab Switcher between Tooth Design & Periodontics */}
              <div className="flex items-center gap-1 bg-clinical-surface p-1 rounded-xl border border-clinical-border mb-2 shrink-0">
                <button
                  onClick={() => setSidebarTab('tooth')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === 'tooth'
                      ? 'bg-clinical-darkest text-cyan-300 font-bold border border-clinical-border shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Tooth Design</span>
                </button>

                <button
                  onClick={() => setSidebarTab('perio')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === 'perio'
                      ? 'bg-clinical-darkest text-cyan-300 font-bold border border-clinical-border shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Periodontics</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                {sidebarTab === 'tooth' ? (
                  <ToothCustomizer
                    selectedFdi={selectedFdi}
                    toothTransform={currentToothTransform}
                    onUpdateTransform={(updates) => handleUpdateToothTransform(selectedFdi, updates)}
                    onApplyFormToAll={handleApplyFormToAll}
                    isCalibrated={isCalibrated}
                    onSavePreset={() => alert(`Saved design as preset for FDI #${selectedFdi}`)}
                  />
                ) : (
                  <PeriodontalInspector
                    selectedFdi={selectedFdi}
                    onSelectTooth={setSelectedFdi}
                    measurements={currentCase.measurements}
                    toothTransforms={activeRevision?.teeth || {}}
                    onUpdateMeasurement={handleUpdateMeasurement}
                    isCalibrated={isCalibrated}
                  />
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB C: SIMULATION VIEW */}
        {activeTab === 'simulation' && (
          <div className="p-4 flex items-center justify-center h-full">
            <button
              onClick={() => setShowSimulationModal(true)}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-xl text-sm"
            >
              Open Interactive Simulation Comparison
            </button>
          </div>
        )}

        {/* TAB D: TREATMENT PLAN SUMMARY */}
        {activeTab === 'plan' && (
          <TreatmentPlanView
            currentCase={currentCase}
            onExportPdf={handleExportPdf}
            isCalibrated={isCalibrated}
          />
        )}

      </main>

      {/* AI Suggestions Modal */}
      <AiSuggestionsModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        currentCase={currentCase}
        onApplySuggestion={handleApplyAiSuggestion}
      />

      {/* Simulation Modal */}
      <SimulationModal
        isOpen={showSimulationModal || activeTab === 'simulation'}
        onClose={() => {
          setShowSimulationModal(false);
          if (activeTab === 'simulation') setActiveTab('gallery');
        }}
        currentCase={currentCase}
        onSaveSimulation={(sim) => {
          setCases(prev => prev.map(c => c.id === currentCase.id ? { ...c, simulations: [...c.simulations, sim] } : c));
        }}
        onGrantConsent={() => {
          setCases(prev => prev.map(c => c.id === currentCase.id ? { ...c, consentGranted: true } : c));
        }}
      />

    </div>
  );
};
export default App;
