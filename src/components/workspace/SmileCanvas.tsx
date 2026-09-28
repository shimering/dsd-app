import React, { useRef, useState, useEffect } from 'react';
import { 
  Case, 
  ToothTransform, 
  Point2D, 
  CalibrationData 
} from '../../types';
import { TOOTH_TEMPLATES, getToothTypeFromFdi, isRightQuadrant } from '../../lib/tooth-templates';
import { 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Move, 
  Ruler, 
  Check, 
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface SmileCanvasProps {
  currentCase: Case;
  selectedFdi: number;
  onSelectTooth: (fdi: number) => void;
  onUpdateToothTransform: (fdi: number, updates: Partial<ToothTransform>) => void;
  onUpdateCalibration: (calibration: CalibrationData) => void;
  onUpdateGuides: (guides: any) => void;
  showMidline: boolean;
  showSmileArc: boolean;
  showTeethOverlay: boolean;
  overlayOpacity: number;
}

export const SmileCanvas: React.FC<SmileCanvasProps> = ({
  currentCase,
  selectedFdi,
  onSelectTooth,
  onUpdateToothTransform,
  onUpdateCalibration,
  onUpdateGuides,
  showMidline,
  showSmileArc,
  showTeethOverlay,
  overlayOpacity
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calibration tool state
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibPointA, setCalibPointA] = useState<Point2D>({ x: 420, y: 325 });
  const [calibPointB, setCalibPointB] = useState<Point2D>({ x: 495, y: 325 });
  const [knownDistanceMm, setKnownDistanceMm] = useState<number>(8.5);

  const activePhoto = currentCase.photos[currentCase.activePhotoType];
  const calibration = activePhoto?.calibration || { isCalibrated: false };
  const isCalibrated = calibration.isCalibrated;
  const pixelsPerMm = calibration.pixelsPerMm || 1;

  const activeRevision = currentCase.revisions.find(r => r.id === currentCase.activeRevisionId) || currentCase.revisions[0];
  const teeth = activeRevision?.teeth || {};

  // Handle Dragging a tooth
  const [draggingFdi, setDraggingFdi] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<Point2D>({ x: 0, y: 0 });

  const handleToothMouseDown = (fdi: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTooth(fdi);
    setDraggingFdi(fdi);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingFdi && teeth[draggingFdi]) {
      const dx = (e.clientX - dragStart.x) / (zoom * 10);
      const dy = (e.clientY - dragStart.y) / (zoom * 10);

      const tooth = teeth[draggingFdi];
      onUpdateToothTransform(draggingFdi, {
        x: Math.min(90, Math.max(10, tooth.x + dx)),
        y: Math.min(90, Math.max(10, tooth.y + dy))
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y)
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingFdi(null);
    setIsPanning(false);
  };

  // Calibration Confirm
  const applyCalibration = () => {
    const dx = calibPointB.x - calibPointA.x;
    const dy = calibPointB.y - calibPointA.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    if (pixelDistance > 10 && knownDistanceMm > 0) {
      const calculatedPxPerMm = pixelDistance / knownDistanceMm;
      onUpdateCalibration({
        isCalibrated: true,
        p1: calibPointA,
        p2: calibPointB,
        realDistanceMm: knownDistanceMm,
        pixelsPerMm: calculatedPxPerMm
      });
      setIsCalibrating(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-clinical-darkest select-none overflow-hidden rounded-xl border border-clinical-border">
      
      {/* Top Floating Mini-Bar: Zoom & Viewport controls */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-clinical-surface/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-clinical-border shadow-lg">
        <button
          onClick={() => setZoom(prev => Math.max(0.6, prev - 0.2))}
          className="p-1 rounded text-slate-300 hover:text-white hover:bg-clinical-border text-xs"
          title="Zoom Out"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] text-cyan-400 px-1 font-semibold">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(prev => Math.min(3.0, prev + 0.2))}
          className="p-1 rounded text-slate-300 hover:text-white hover:bg-clinical-border text-xs"
          title="Zoom In"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <div className="h-3 w-px bg-slate-700 mx-1" />
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="text-[10px] font-mono text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-clinical-border"
        >
          RESET
        </button>
      </div>

      {/* Top Right Mini-Bar: Calibration Tool Toggle */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        {isCalibrating ? (
          <div className="flex items-center gap-2 bg-clinical-surface/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/50 shadow-xl">
            <span className="text-[11px] text-cyan-300 font-medium">Real Distance:</span>
            <input
              type="number"
              step="0.1"
              value={knownDistanceMm}
              onChange={(e) => setKnownDistanceMm(parseFloat(e.target.value) || 1)}
              className="w-14 bg-clinical-darkest border border-clinical-border rounded px-1.5 py-0.5 text-xs text-white font-mono"
            />
            <span className="text-xs text-slate-400 font-mono">mm</span>
            <button
              onClick={applyCalibration}
              className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-0.5 rounded text-xs font-medium"
            >
              <Check className="w-3 h-3" />
              <span>Confirm</span>
            </button>
            <button
              onClick={() => setIsCalibrating(false)}
              className="text-xs text-slate-400 hover:text-slate-200 px-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCalibrating(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow-lg border transition-all ${
              isCalibrated
                ? 'bg-clinical-surface/90 text-slate-300 border-clinical-border hover:border-cyan-600'
                : 'bg-amber-950/80 text-amber-200 border-amber-600/80 animate-pulse'
            }`}
          >
            <Ruler className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isCalibrated ? 'Recalibrate Scale' : 'Calibrate Scale (mm)'}</span>
          </button>
        )}
      </div>

      {/* Main Viewport & Interactive Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center cursor-crosshair overflow-hidden"
        onMouseDown={(e) => {
          if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
      >
        <div
          className="relative transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: '1000px',
            height: '650px'
          }}
        >
          {/* Layer 1: Patient Background Photo */}
          {activePhoto?.url && (
            <img
              src={activePhoto.url}
              alt="Patient Smile"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              style={{
                transform: `rotate(${activePhoto.orientationDeg || 0}deg)`
              }}
            />
          )}

          {/* Layer 2: Vector Guides & Calibration Line SVG */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 1000 650">
            {/* Facial Midline (Vertical reference: Glabella to Philtrum) */}
            {showMidline && (
              <g className="transition-opacity duration-200">
                <line
                  x1={currentCase.guides.midline.p1.x}
                  y1={currentCase.guides.midline.p1.y}
                  x2={currentCase.guides.midline.p2.x}
                  y2={currentCase.guides.midline.p2.y}
                  stroke="#06B6D4"
                  strokeWidth="1.8"
                  strokeDasharray="6 4"
                />
                <circle cx={currentCase.guides.midline.p1.x} cy={currentCase.guides.midline.p1.y} r="4" fill="#06B6D4" />
                <circle cx={currentCase.guides.midline.p2.x} cy={currentCase.guides.midline.p2.y} r="4" fill="#06B6D4" />
                <text x={currentCase.guides.midline.p1.x + 8} y={currentCase.guides.midline.p1.y + 10} fill="#06B6D4" fontSize="10" fontFamily="monospace">
                  FACIAL MIDLINE
                </text>
              </g>
            )}

            {/* Bipupillary Horizontal Plane Reference */}
            {showMidline && (
              <g className="transition-opacity duration-200 opacity-60">
                <line
                  x1={currentCase.guides.bipupillary.p1.x}
                  y1={currentCase.guides.bipupillary.p1.y}
                  x2={currentCase.guides.bipupillary.p2.x}
                  y2={currentCase.guides.bipupillary.p2.y}
                  stroke="#14B8A6"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <text x={currentCase.guides.bipupillary.p1.x} y={currentCase.guides.bipupillary.p1.y - 6} fill="#14B8A6" fontSize="9" fontFamily="monospace">
                  BIPUPILLARY HORIZONTAL
                </text>
              </g>
            )}

            {/* Smile Arc (Spline along lower lip) */}
            {showSmileArc && (
              <g className="transition-opacity duration-200">
                <path
                  d={`M ${currentCase.guides.smileArc[0].x} ${currentCase.guides.smileArc[0].y} Q ${currentCase.guides.smileArc[1].x} ${currentCase.guides.smileArc[1].y} ${currentCase.guides.smileArc[2].x} ${currentCase.guides.smileArc[2].y}`}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.2"
                  strokeDasharray="5 3"
                />
                <text x={currentCase.guides.smileArc[1].x - 30} y={currentCase.guides.smileArc[1].y + 18} fill="#F59E0B" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  SMILE ARC CURVE
                </text>
              </g>
            )}

            {/* Active Calibration Line */}
            {isCalibrating && (
              <g className="pointer-events-auto">
                <line
                  x1={calibPointA.x}
                  y1={calibPointA.y}
                  x2={calibPointB.x}
                  y2={calibPointB.y}
                  stroke="#22D3EE"
                  strokeWidth="2.5"
                />
                <circle
                  cx={calibPointA.x}
                  cy={calibPointA.y}
                  r="7"
                  fill="#06B6D4"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="cursor-move"
                />
                <circle
                  cx={calibPointB.x}
                  cy={calibPointB.y}
                  r="7"
                  fill="#06B6D4"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="cursor-move"
                />
              </g>
            )}
          </svg>

          {/* Layer 3: Interactive Tooth 2D Outlines (FDI 13 to 23) */}
          {showTeethOverlay && (
            <div className="absolute inset-0 pointer-events-auto z-20" style={{ opacity: overlayOpacity }}>
              {[13, 12, 11, 21, 22, 23].map((fdi) => {
                const tooth = teeth[fdi];
                if (!tooth) return null;

                const isSelected = selectedFdi === fdi;
                const toothType = getToothTypeFromFdi(fdi);
                const isRight = isRightQuadrant(fdi);
                const template = TOOTH_TEMPLATES[tooth.form] || TOOTH_TEMPLATES.rounded;
                const outlinePath = template.outlinePath(toothType, isRight);

                // Tooth box size in canvas pixels
                const toothWidthPx = isCalibrated ? tooth.width * pixelsPerMm : tooth.width * 10;
                const toothHeightPx = isCalibrated ? tooth.height * pixelsPerMm : tooth.height * 10;
                const leftPx = (tooth.x / 100) * 1000 - toothWidthPx / 2;
                const topPx = (tooth.y / 100) * 650 - toothHeightPx / 2;

                // Proposed gingival movement in px
                const gingivalShiftPx = isCalibrated ? (tooth.gingivalShiftMm || 0) * pixelsPerMm : 0;
                const incisalExtensionPx = isCalibrated ? (tooth.incisalExtensionMm || 0) * pixelsPerMm : 0;

                return (
                  <div
                    key={fdi}
                    onMouseDown={(e) => handleToothMouseDown(fdi, e)}
                    className={`absolute cursor-move transition-shadow duration-100 group ${
                      isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-clinical-darkest shadow-xl' : 'hover:ring-1 hover:ring-teal-400/80'
                    }`}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: `${toothWidthPx}px`,
                      height: `${toothHeightPx}px`,
                      transform: `rotate(${tooth.rotation}deg)`,
                      transformOrigin: '50% 50%'
                    }}
                  >
                    {/* SVG Tooth Outline */}
                    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                      {/* Proposed Gingival Shift Indicator (Apical dashed contour) */}
                      {tooth.gingivalShiftMm > 0.1 && (
                        <path
                          d={outlinePath}
                          fill="none"
                          stroke="#34D399"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                          style={{
                            transform: `translateY(-${(gingivalShiftPx / toothHeightPx) * 100}%)`,
                            transformOrigin: '50% 0%'
                          }}
                        />
                      )}

                      {/* Main Tooth Contour */}
                      <path
                        d={outlinePath}
                        fill={isSelected ? 'rgba(6, 182, 212, 0.18)' : 'rgba(20, 184, 166, 0.10)'}
                        stroke={isSelected ? '#06B6D4' : '#14B8A6'}
                        strokeWidth={isSelected ? '2.5' : '1.8'}
                        className="transition-colors"
                      />

                      {/* Proposed Incisal Extension (Coronal dashed line) */}
                      {tooth.incisalExtensionMm > 0.1 && (
                        <line
                          x1="16"
                          y1={94 + (incisalExtensionPx / toothHeightPx) * 100}
                          x2="84"
                          y2={94 + (incisalExtensionPx / toothHeightPx) * 100}
                          stroke="#38BDF8"
                          strokeWidth="2.5"
                          strokeDasharray="3 2"
                        />
                      )}
                    </svg>

                    {/* Badge: FDI Number + Dimension */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-clinical-darkest/90 border border-clinical-border px-1.5 py-0.5 rounded text-[10px] font-mono pointer-events-none whitespace-nowrap shadow-md">
                      <span className={isSelected ? 'text-cyan-400 font-bold' : 'text-slate-300'}>
                        #{fdi}
                      </span>
                      <span className="text-slate-400">
                        {isCalibrated ? `${tooth.width.toFixed(1)}×${tooth.height.toFixed(1)}mm` : `${Math.round(tooth.width)}%`}
                      </span>
                    </div>

                    {/* Touch handles for iPad / Touch devices (>= 44px hit bounds) */}
                    {isSelected && (
                      <>
                        <div className="absolute -top-2 -left-2 w-5 h-5 bg-cyan-500 rounded-full border-2 border-white shadow-md cursor-nwse-resize" />
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full border-2 border-white shadow-md cursor-nesw-resize" />
                        <div className="absolute -bottom-2 -left-2 w-5 h-5 bg-cyan-500 rounded-full border-2 border-white shadow-md cursor-nesw-resize" />
                        <div className="absolute -bottom-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full border-2 border-white shadow-md cursor-nwse-resize" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Bottom Canvas Footer: Calibration details & Guidance */}
      <div className="bg-clinical-surface/80 border-t border-clinical-border px-3 py-1.5 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span>Active Tooth: <strong className="text-cyan-400">FDI #{selectedFdi}</strong></span>
          <span>Scale: {isCalibrated ? `${pixelsPerMm.toFixed(2)} px/mm` : 'Uncalibrated Proportions'}</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Tooth Contour
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Proposed Gingival Movement
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Smile Arc
          </span>
        </div>
      </div>

    </div>
  );
};
