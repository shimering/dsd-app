import React, { useEffect, useRef, useState } from "react";
import {
  Hand,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo2,
  Redo2,
  Ruler,
  ImagePlus,
} from "lucide-react";
import {
  Case,
  GuideKey,
  PhotoAsset,
  Point2D,
  ToothTransform,
} from "../../types";
import { activePhoto, activeRevision } from "../../lib/case-model";
import {
  clamp,
  fitScale,
  imageToScreen,
  screenToImage,
} from "../../lib/geometry";
import {
  TOOTH_TEMPLATES,
  POPULAR_DENTAL_SHADES,
  getToothTypeFromFdi,
  isRightQuadrant,
} from "../../lib/tooth-templates";
export type SelectedGuide = GuideKey | "calibration" | "none";
const colors: Record<GuideKey, string> = {
  facialMidline: "#59e1d3",
  dentalMidline: "#94c6ff",
  bipupillary: "#a0c4dc",
  incisalPlane: "#fcb975",
  smileArc: "#f5c65c",
  gingivalCurve: "#b9caff",
  papillae: "#ffb9ce",
  canineLines: "#a5dfb6",
};
type Drag = {
  kind: "tooth" | "guide" | "pan" | "pinch";
  start: Point2D;
  pan: Point2D;
  tooth?: ToothTransform;
  index?: number;
  guide?: SelectedGuide;
  distance?: number;
  zoom?: number;
  anchor?: Point2D;
};
export function SmileCanvas({
  currentCase,
  selectedFdi,
  onSelectTooth,
  onUpdateTooth,
  onUpdatePhoto,
  guide,
  onGuide,
  visibleGuides,
  showTeeth,
  opacity,
  onCapture,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  currentCase: Case;
  selectedFdi: number;
  onSelectTooth: (fdi: number) => void;
  onUpdateTooth: (fdi: number, patch: Partial<ToothTransform>) => void;
  onUpdatePhoto: (patch: Partial<PhotoAsset>) => void;
  guide: SelectedGuide;
  onGuide: (g: SelectedGuide) => void;
  visibleGuides: GuideKey[];
  showTeeth: boolean;
  opacity: number;
  onCapture: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const photo = activePhoto(currentCase),
    teeth = activeRevision(currentCase).teeth,
    ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 }),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState<Point2D>({ x: 0, y: 0 }),
    [mode, setMode] = useState<"select" | "pan">("select");
  const [draftTooth, setDraftTooth] = useState<ToothTransform | null>(null),
    [draftPoints, setDraftPoints] = useState<Point2D[] | null>(null),
    [cursor, setCursor] = useState<Point2D | null>(null);
  const pointers = useRef(new Map<number, Point2D>()),
    penPointer = useRef<number | null>(null),
    drag = useRef<Drag | null>(null),
    draftRef = useRef<{ tooth?: ToothTransform; points?: Point2D[] }>({});
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setDraftTooth(null);
    setDraftPoints(null);
    pointers.current.clear();
    drag.current = null;
  }, [photo?.id]);
  const width = photo?.width ?? 1000,
    height = photo?.height ?? 650,
    rotation = photo?.orientationDeg ?? 0;
  const base = fitScale(size.width, size.height, width, height, rotation),
    scale = base * zoom,
    center = { x: size.width / 2 + pan.x, y: size.height / 2 + pan.y };
  const toImage = (p: Point2D) =>
    screenToImage(p, center, width, height, scale, rotation);
  const screenPoint = (e: React.PointerEvent) => {
    const b = ref.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const calibrated = !!photo?.calibration.isCalibrated,
    ppm = photo?.calibration.pixelsPerMm ?? 1;
  const guidePoints =
    guide === "calibration"
      ? [
          photo?.calibration.p1 ?? { x: width * 0.43, y: height * 0.52 },
          photo?.calibration.p2 ?? { x: width * 0.5, y: height * 0.52 },
        ]
      : guide !== "none"
        ? photo?.guides[guide]
        : [];
  const cancel = () => {
    drag.current = null;
    pointers.current.clear();
    penPointer.current = null;
    draftRef.current = {};
    setDraftTooth(null);
    setDraftPoints(null);
    setCursor(null);
  };
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (
      !photo?.url ||
      (e.pointerType === "touch" && penPointer.current !== null)
    )
      return;
    if (e.pointerType === "pen") {
      cancel();
      penPointer.current = e.pointerId;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const screen = screenPoint(e);
    pointers.current.set(e.pointerId, screen);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()],
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      drag.current = {
        kind: "pinch",
        start: mid,
        pan,
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        zoom,
        anchor: toImage(mid),
      };
      draftRef.current = {};
      setDraftTooth(null);
      setDraftPoints(null);
      return;
    }
    const target = (e.target as Element).closest("[data-fdi],[data-point]"),
      point = target?.getAttribute("data-point"),
      fdi = target?.getAttribute("data-fdi");
    draftRef.current = {};
    if (
      mode === "select" &&
      point !== null &&
      point !== undefined &&
      guide !== "none"
    ) {
      drag.current = {
        kind: "guide",
        start: toImage(screen),
        pan,
        index: Number(point),
        guide,
      };
      setCursor(toImage(screen));
    } else if (mode === "select" && fdi) {
      const tooth = teeth[Number(fdi)];
      onSelectTooth(Number(fdi));
      drag.current = { kind: "tooth", start: toImage(screen), pan, tooth };
    } else drag.current = { kind: "pan", start: screen, pan };
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    const screen = screenPoint(e);
    pointers.current.set(e.pointerId, screen);
    const d = drag.current;
    if (d.kind === "pinch" && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()],
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        next = clamp(
          (d.zoom! * Math.hypot(b.x - a.x, b.y - a.y)) /
            Math.max(1, d.distance!),
          0.5,
          12,
        ),
        v = imageToScreen(
          d.anchor!,
          { x: 0, y: 0 },
          width,
          height,
          base * next,
          rotation,
        );
      setZoom(next);
      setPan({
        x: mid.x - size.width / 2 - v.x,
        y: mid.y - size.height / 2 - v.y,
      });
      return;
    }
    if (d.kind === "pan") {
      setPan({
        x: d.pan.x + screen.x - d.start.x,
        y: d.pan.y + screen.y - d.start.y,
      });
      return;
    }
    const p = toImage(screen);
    if (d.kind === "tooth" && d.tooth) {
      const next = {
        ...d.tooth,
        x: clamp(d.tooth.x + p.x - d.start.x, 0, width),
        y: clamp(d.tooth.y + p.y - d.start.y, 0, height),
      };
      draftRef.current = { tooth: next };
      setDraftTooth(next);
    }
    if (d.kind === "guide") {
      const points = [...(guidePoints ?? [])];
      points[d.index!] = { x: clamp(p.x, 0, width), y: clamp(p.y, 0, height) };
      draftRef.current = { points };
      setDraftPoints(points);
      setCursor(points[d.index!]);
    }
  }
  function up(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "tooth" && draftRef.current.tooth) {
      const t = draftRef.current.tooth;
      onUpdateTooth(t.fdi, { x: t.x, y: t.y });
    }
    if (d?.kind === "guide" && draftRef.current.points && photo) {
      if (d.guide === "calibration")
        onUpdatePhoto({
          calibration: {
            isCalibrated: false,
            p1: draftRef.current.points[0],
            p2: draftRef.current.points[1],
          },
        });
      else if (d.guide && d.guide !== "none")
        onUpdatePhoto({
          guides: { ...photo.guides, [d.guide]: draftRef.current.points },
        });
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    cancel();
  }
  const transform = `translate(${center.x} ${center.y}) rotate(${rotation}) scale(${scale}) translate(${-width / 2} ${-height / 2})`;
  function imageLayers(interactive = true) {
    return (
      <>
        <image
          href={photo?.url}
          width={width}
          height={height}
          preserveAspectRatio="none"
        />
        {visibleGuides.map((key) => {
          const points =
            guide === key && draftPoints ? draftPoints : photo?.guides[key];
          if (!points) return null;
          const curve = key === "smileArc" || key === "gingivalCurve";
          return (
            <g
              key={key}
              fill="none"
              stroke={colors[key]}
              strokeWidth={1.5 / scale}
              strokeDasharray={`${5 / scale} ${4 / scale}`}
              pointerEvents="none"
            >
              {curve ? (
                <path
                  d={`M ${points[0].x} ${points[0].y} Q ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y}`}
                />
              ) : key === "papillae" ? (
                points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3 / scale}
                    fill={colors[key]}
                  />
                ))
              ) : key === "canineLines" ? (
                <>
                  <line
                    x1={points[0].x}
                    y1={points[0].y}
                    x2={points[1].x}
                    y2={points[1].y}
                  />
                  <line
                    x1={points[2].x}
                    y1={points[2].y}
                    x2={points[3].x}
                    y2={points[3].y}
                  />
                </>
              ) : (
                <line
                  x1={points[0].x}
                  y1={points[0].y}
                  x2={points[1].x}
                  y2={points[1].y}
                />
              )}
            </g>
          );
        })}
        {showTeeth &&
          Object.values(teeth).map((original) => {
            const t = draftTooth?.fdi === original.fdi ? draftTooth : original,
              path =
                t.customPath ??
                (
                  TOOTH_TEMPLATES[t.form] ?? TOOTH_TEMPLATES.rounded
                ).outlinePath(
                  getToothTypeFromFdi(t.fdi),
                  isRightQuadrant(t.fdi),
                ),
              selected = t.fdi === selectedFdi;
            return (
              <g
                key={t.fdi}
                data-fdi={interactive ? t.fdi : undefined}
                transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}
                opacity={opacity}
                style={{ cursor: "move" }}
              >
                <svg
                  x={-t.widthPx / 2}
                  y={-t.heightPx / 2}
                  width={t.widthPx}
                  height={t.heightPx}
                  viewBox="0 0 100 100"
                  overflow="visible"
                >
                  <path
                    d={path}
                    fill={
                      (POPULAR_DENTAL_SHADES.find((s) => s.code === t.shade)
                        ?.hex ?? "#F3EFE3") + (selected ? "66" : "44")
                    }
                    stroke={selected ? "#a3ffea" : "#66ccbe"}
                    strokeWidth={selected ? 2 : 1.3}
                  />
                  {calibrated && t.gingivalShiftMm !== 0 && (
                    <path
                      d={path}
                      fill="none"
                      stroke="#c6bbff"
                      strokeDasharray="4 3"
                      transform={`translate(0 ${((-t.gingivalShiftMm * ppm) / t.heightPx) * 100})`}
                    />
                  )}{" "}
                  {calibrated && t.incisalExtensionMm !== 0 && (
                    <line
                      x1="15"
                      x2="85"
                      y1={
                        100 + ((t.incisalExtensionMm * ppm) / t.heightPx) * 100
                      }
                      y2={
                        100 + ((t.incisalExtensionMm * ppm) / t.heightPx) * 100
                      }
                      stroke="#94c6ff"
                      strokeDasharray="4 3"
                    />
                  )}
                </svg>
                {selected && (
                  <>
                    <rect
                      x={-t.widthPx / 2 - 3 / scale}
                      y={-t.heightPx / 2 - 3 / scale}
                      width={t.widthPx + 6 / scale}
                      height={t.heightPx + 6 / scale}
                      fill="none"
                      stroke="#5eead4"
                      strokeWidth={1 / scale}
                    />
                    <text
                      x="0"
                      y={-t.heightPx / 2 - 10 / scale}
                      fill="#e9fff7"
                      fontSize={11 / scale}
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      FDI {t.fdi}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        {guide !== "none" &&
          (draftPoints ?? guidePoints ?? []).map((p, i) => (
            <g
              key={i}
              data-point={interactive ? i : undefined}
              style={{ cursor: "move" }}
            >
              <circle cx={p.x} cy={p.y} r={22 / scale} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={6 / scale}
                fill="#5eead4"
                stroke="#fff"
                strokeWidth={2 / scale}
              />
              <text
                x={p.x + 10 / scale}
                y={p.y - 10 / scale}
                fontSize={10 / scale}
                fill="#fff"
                pointerEvents="none"
              >
                {i + 1}
              </text>
            </g>
          ))}
      </>
    );
  }
  return (
    <section className="canvas-shell" aria-label="Patient photo editing canvas">
      <div className="canvas-toolbar">
        <div className="row">
          <button
            className={`btn ${mode === "select" ? "active" : ""}`}
            onClick={() => setMode("select")}
            aria-pressed={mode === "select"}
          >
            <MousePointer2 size={16} />
            <span>Select</span>
          </button>
          <button
            className={`btn ${mode === "pan" ? "active" : ""}`}
            onClick={() => setMode("pan")}
            aria-pressed={mode === "pan"}
          >
            <Hand size={16} />
            <span>Pan</span>
          </button>
          <button
            className="icon-btn"
            aria-label="Undo design change"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-btn"
            aria-label="Redo design change"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="row">
          <button
            className="icon-btn"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => clamp(z / 1.3, 0.5, 12))}
          >
            <ZoomOut size={17} />
          </button>
          <button
            className="icon-btn"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => clamp(z * 1.3, 0.5, 12))}
          >
            <ZoomIn size={17} />
          </button>
          <button
            className="icon-btn"
            aria-label="Fit photo to canvas"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize size={17} />
          </button>
          <button
            className="btn"
            onClick={() => {
              setMode("select");
              onGuide("calibration");
            }}
          >
            <Ruler size={16} />
            <span>Scale</span>
          </button>
        </div>
      </div>
      <div ref={ref} className="canvas-viewport">
        {photo?.url && photo.type !== "video" ? (
          <>
            <svg
              aria-label="Editable smile photo. Use the tooth selector and numeric controls as alternatives to dragging."
              viewBox={`0 0 ${size.width} ${size.height}`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={(e) => {
                if (pointers.current.has(e.pointerId)) cancel();
              }}
              onLostPointerCapture={(e) => {
                if (pointers.current.has(e.pointerId) && drag.current) cancel();
              }}
            >
              <g transform={transform}>{imageLayers()}</g>
            </svg>
            {cursor && (
              <div className="magnifier" aria-hidden="true">
                <svg
                  viewBox={`${cursor.x - width * 0.025} ${cursor.y - height * 0.025} ${width * 0.05} ${height * 0.05}`}
                >
                  <g>{imageLayers(false)}</g>
                  <circle
                    cx={cursor.x}
                    cy={cursor.y}
                    r={width * 0.001}
                    fill="#fff"
                  />
                </svg>
              </div>
            )}
            <span className="canvas-caption">
              {photo.isIllustration
                ? "Illustrated demo · upload patient photo"
                : "Original photo · editable design overlay"}
            </span>
          </>
        ) : (
          <div className="canvas-empty">
            <ImagePlus size={38} />
            <h2>
              {photo?.missing
                ? "Photo unavailable on this device"
                : "Add a patient photo"}
            </h2>
            <p>
              {photo?.missing
                ? "Import a local backup or upload the matching original."
                : "Start with a frontal maximum-smile photo."}
            </p>
            <button className="btn" onClick={onCapture}>
              Open capture
            </button>
          </div>
        )}
      </div>
      <footer className="canvas-footer">
        <span>
          FDI {selectedFdi} · {Math.round(zoom * 100)}% zoom
        </span>
        <span>
          {calibrated
            ? "Photo scale confirmed · projected dimensions"
            : "Photo scale pending · relative design"}
        </span>
        <span className="footer-details">
          Teal: tooth design · Violet: proposed margin
        </span>
      </footer>
    </section>
  );
}
