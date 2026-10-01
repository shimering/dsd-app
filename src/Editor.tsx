import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Maximize,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Hand,
  Ruler,
  Waypoints,
  Triangle,
  Minus,
  Pencil,
  Crosshair,
  ScanLine,
  Undo2,
  Redo2,
  Check,
  X,
} from 'lucide-react';
import {
  activeDesign,
  replaceDesign,
  uid,
  type Photo,
  type Point,
  type Tool,
  type Step,
  type Measurement,
} from './domain';
import { dsdDefinition, dsdAllowsZero } from './dsdCatalog';
import { saveDsdMeasurement } from './dsd';
import {
  getTemplate,
  setTemplate,
  templateBounds,
  templateFits,
  transformTemplate,
  moveAnchor,
} from './basicFrame';
import { drawBasicFrame, hitFrame, type FrameHit } from './frameCanvas';
import type { BasicToolId } from './basicFrameSchema';
import {
  clamp,
  distance,
  fitScale,
  lipPath,
  lipProblem,
  measurementValue,
  pointInPolygon,
  pinchTeeth,
  toImage,
  toScreen,
  toothCorners,
  type View,
} from './geometry';
import { applyView, drawMockup, drawTeeth } from './render';

export type Selection =
  | { kind: 'measurement'; id: string; point: number }
  | { kind: 'lip' | 'calibration'; point: number }
  | { kind: 'tooth'; fdi: number }
  | null;
type Props = {
  photo: Photo;
  image: HTMLImageElement | null;
  renderImage: HTMLImageElement | null;
  step: Step;
  tool: Tool;
  onTool: (t: Tool) => void;
  onChange: (p: Photo) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onCalibrate: (p: Point[]) => void;
  fingerEdit: boolean;
  group: boolean;
  snapping: boolean;
  libraryReady: boolean;
  split: number;
  onSplit: (n: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  assessmentId?: string | null;
  showAllDsd?: boolean;
  basicToolId?: BasicToolId | null;
  showTeethGuides?: boolean;
};
type Drag = {
  type: 'point' | 'tooth' | 'resize' | 'ink' | 'pan' | 'compare' | 'frame';
  frame?: FrameHit;
  origin: Point;
  photo: Photo;
  selection: Selection;
  view: View;
  pointerId: number;
  latest: Photo;
  corner?: number;
  split?: number;
};
type Gesture = {
  ids: [number, number];
  start: View;
  anchor: Point;
  distance: number;
} & (
  | { type: 'view' }
  | {
      type: 'teeth';
      photo: Photo;
      latest: Photo;
      fdi: number | null;
      points: [Point, Point];
      snapping: boolean;
    }
);
const measureTools: [Tool, string, typeof Ruler][] = [
  ['distance', 'Distance', Ruler],
  ['polyline', 'Multi-point length', Waypoints],
  ['angle', 'Angle', Triangle],
  ['guide', 'Reference line', Minus],
  ['ink', 'Freehand', Pencil],
  ['calibrate', 'Calibrate', Crosshair],
];

export function Editor(props: Props) {
  const { photo, image, step, tool, onTool, onChange, selection, onSelect } =
    props;
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    magnifier = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 800, height: 550 }),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState<Point>({ x: 0, y: 0 }),
    [draft, setDraft] = useState<Point[]>([]),
    [preview, setPreview] = useState<Photo | null>(null),
    [cursor, setCursor] = useState<Point | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const current = preview ?? photo,
    photoRef = useRef(current);
  photoRef.current = current;
  const measurementVisible = (m: Measurement) =>
    !m.assessmentId ||
    m.assessmentId === props.assessmentId ||
    (selection?.kind === 'measurement' && selection.id === m.id);
  const view: View = {
    ...size,
    photoWidth: photo.width,
    photoHeight: photo.height,
    rotation: photo.rotation,
    scale:
      fitScale(
        size.width,
        size.height,
        photo.width,
        photo.height,
        photo.rotation,
      ) * zoom,
    pan,
  };
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<Drag | null>(null),
    tap = useRef<{ id: number; point: Point; screen: Point } | null>(null),
    pointers = useRef(new Map<number, { point: Point; type: string }>()),
    pen = useRef<number | null>(null),
    gesture = useRef<Gesture | null>(null);
  const setView = (v: View) => {
    viewRef.current = v;
    setZoom(
      v.scale /
        fitScale(v.width, v.height, v.photoWidth, v.photoHeight, v.rotation),
    );
    setPan(v.pan);
  };
  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: r.width, height: r.height });
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDraft([]);
    setPreview(null);
    drag.current = null;
    pointers.current.clear();
    gesture.current = null;
    tap.current = null;
    pen.current = null;
  }, [photo.id]);
  useEffect(() => {
    setDraft([]);
    draftRef.current = [];
    setPreview(null);
    drag.current = null;
    gesture.current = null;
    tap.current = null;
    pointers.current.clear();
    pen.current = null;
    setCursor(null);
  }, [tool, step, photo.activeDesignId, props.assessmentId, props.basicToolId]);
  const cancel = () => {
    const original =
      gesture.current?.type === 'teeth'
        ? gesture.current.photo
        : drag.current?.photo;
    drag.current = null;
    tap.current = null;
    setPreview(null);
    setDraft([]);
    draftRef.current = [];
    gesture.current = null;
    if (original) photoRef.current = original;
    setCursor(null);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(size.width * ratio);
    el.height = Math.round(size.height * ratio);
    const ctx = el.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, size.width, size.height);
    if (!image) return;
    ctx.save();
    applyView(ctx, view);
    ctx.drawImage(image, 0, 0, photo.width, photo.height);
    ctx.restore();
    ctx.save();
    if (step === 'Compare') {
      ctx.beginPath();
      ctx.rect(size.width * props.split, 0, size.width, size.height);
      ctx.clip();
    }
    applyView(ctx, view);
    if (step === 'Teeth' || step === 'Compare') {
      if (current.lip.closed && !lipProblem(current.lip))
        drawMockup(ctx, current, props.renderImage ?? undefined);
      else if (step === 'Teeth') drawTeeth(ctx, current);
    }
    ctx.restore();
    if (step === 'Compare') return;
    ctx.save();
    applyView(ctx, view);
    const s = view.scale;
    const line = (points: Point[], color: string, dashed = false) => {
      if (!points.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8 / s;
      ctx.setLineDash(dashed ? [6 / s, 5 / s] : []);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const point = (p: Point, selected: boolean) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, (selected ? 6 : 4) / s, 0, Math.PI * 2);
      ctx.fillStyle = selected ? '#ffd38a' : '#fff';
      ctx.fill();
      ctx.lineWidth = 1.5 / s;
      ctx.strokeStyle = '#047f82';
      ctx.stroke();
    };
    if (step === 'Measure') {
      current.measurements.filter(measurementVisible).forEach((m) => {
        const picked =
          selection?.kind === 'measurement' && selection.id === m.id;
        line(
          m.points,
          picked ? '#ffd38a' : m.kind === 'ink' ? '#9bf2df' : '#64e1df',
          m.kind === 'guide',
        );
        if (m.kind !== 'ink' || picked)
          m.points.forEach((p, i) => point(p, picked && selection.point === i));
        const p = m.points[0];
        ctx.font = `500 ${12 / s}px sans-serif`;
        const text = m.label + ' · ' + measurementValue(m, current),
          w = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(15,30,40,.85)';
        ctx.fillRect(p.x + 8 / s, p.y - 24 / s, w + 12 / s, 20 / s);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, p.x + 14 / s, p.y - 10 / s);
      });
      if (current.calibration) {
        line(current.calibration.points, '#eebd76');
        current.calibration.points.forEach((p, i) =>
          point(p, selection?.kind === 'calibration' && selection.point === i),
        );
      }
    }
    if (step === 'Lip outline' || step === 'Teeth') {
      if (current.lip.points.length) {
        ctx.strokeStyle =
          current.lip.closed && !lipProblem(current.lip)
            ? '#7fe3c8'
            : '#ffce80';
        ctx.lineWidth = 1.8 / s;
        ctx.stroke(new Path2D(lipPath(current.lip)));
      }
      if (step === 'Lip outline')
        current.lip.points.forEach((p, i) =>
          point(p, selection?.kind === 'lip' && selection.point === i),
        );
    }
    if (step === 'Teeth' && selection?.kind === 'tooth') {
      const tooth = activeDesign(current)?.teeth.find(
        (t) => t.fdi === selection.fdi,
      );
      if (tooth) {
        const corners = toothCorners(tooth);
        line([...corners, corners[0]], '#8be5d3', true);
        corners.forEach((p) => point(p, false));
      }
    }
    if (step === 'Measure')
      drawBasicFrame(
        ctx,
        current,
        props.basicToolId ?? null,
        !!props.showAllDsd,
        view.scale,
      );
    if (step === 'Teeth' && props.showTeethGuides)
      drawBasicFrame(ctx, current, null, true, view.scale, true);
    if (draft.length) {
      line(
        [...draft, ...(cursor && tool !== 'ink' ? [cursor] : [])],
        '#ffe1ab',
      );
      draft.forEach((p) => point(p, false));
    }
    ctx.restore();
  }, [
    current,
    image,
    props.renderImage,
    view.scale,
    view.rotation,
    size,
    pan,
    draft,
    cursor,
    selection,
    step,
    props.assessmentId,
    props.showAllDsd,
    props.basicToolId,
    props.showTeethGuides,
    tool,
    props.split,
    props.libraryReady,
  ]);
  useEffect(() => {
    const el = magnifier.current;
    if (!el || !image || !cursor) return;
    const ctx = el.getContext('2d')!;
    ctx.clearRect(0, 0, 140, 140);
    const region = 70 / view.scale;
    ctx.drawImage(
      image,
      cursor.x - region / 2,
      cursor.y - region / 2,
      region,
      region,
      0,
      0,
      140,
      140,
    );
    ctx.strokeStyle = '#72e9db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 70);
    ctx.lineTo(80, 70);
    ctx.moveTo(70, 60);
    ctx.lineTo(70, 80);
    ctx.stroke();
  }, [cursor, image, view.scale]);

  const local = (event: { clientX: number; clientY: number }): Point => {
    const rect = host.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const bounded = (p: Point) => ({
    x: clamp(p.x, 0, photo.width),
    y: clamp(p.y, 0, photo.height),
  });
  const hit = (p: Point): Selection => {
    const radius = 18 / viewRef.current.scale;
    let nearest: Selection = null,
      best = radius;
    const check = (point: Point, s: Selection) => {
      const d = distance(p, point);
      if (d < best) {
        best = d;
        nearest = s;
      }
    };
    const c = photoRef.current;
    if (step === 'Measure') {
      c.measurements
        .filter(measurementVisible)
        .forEach((m) =>
          m.points.forEach((point, i) =>
            check(point, { kind: 'measurement', id: m.id, point: i }),
          ),
        );
      c.calibration?.points.forEach((point, i) =>
        check(point, { kind: 'calibration', point: i }),
      );
    }
    if (step === 'Lip outline')
      c.lip.points.forEach((point, i) =>
        check(point, { kind: 'lip', point: i }),
      );
    if (step === 'Teeth') {
      if (selection?.kind === 'tooth' && !props.group) {
        const selected = activeDesign(c)?.teeth.find(
          (t) => t.fdi === selection.fdi,
        );
        if (
          selected &&
          toothCorners(selected).some((q) => distance(p, q) < radius)
        )
          return selection;
      }
      const teeth = [...(activeDesign(c)?.teeth ?? [])].reverse();
      const t = teeth.find(
        (t) => t.visible && pointInPolygon(p, toothCorners(t)),
      );
      if (t) return { kind: 'tooth', fdi: t.fdi };
    }
    return nearest;
  };
  const movePoint = (p: Photo, s: Selection, q: Point): Photo => {
    if (s?.kind === 'lip')
      return {
        ...p,
        lip: {
          ...p.lip,
          closed: false,
          points: p.lip.points.map((v, i) => (i === s.point ? q : v)),
        },
      };
    if (s?.kind === 'calibration' && p.calibration) {
      if (distance(q, p.calibration.points[1 - s.point]) < 2) return p;
      return {
        ...p,
        calibration: {
          ...p.calibration,
          points: p.calibration.points.map((v, i) => (i === s.point ? q : v)),
        },
      };
    }
    if (s?.kind === 'measurement')
      return {
        ...p,
        measurements: p.measurements.map((m) =>
          m.id === s.id
            ? { ...m, points: m.points.map((v, i) => (i === s.point ? q : v)) }
            : m,
        ),
      };
    return p;
  };
  const finish = () => {
    const pts = draftRef.current;
    if (tool === 'polyline' && pts.length >= (props.assessmentId ? 3 : 2)) {
      addMeasurement({
        id: uid(),
        kind: 'polyline',
        label: 'Length ' + (photo.measurements.length + 1),
        points: pts,
      });
      setDraft([]);
      draftRef.current = [];
    }
  };
  const addMeasurement = (measurement: Measurement) => {
    const def = props.assessmentId
      ? dsdDefinition(props.assessmentId)
      : undefined;
    const m =
      def && def.kind === measurement.kind
        ? { ...measurement, assessmentId: def.id, label: def.label }
        : measurement;
    if (
      m.assessmentId &&
      !dsdAllowsZero(m.assessmentId) &&
      m.points.slice(1).some((p, i) => distance(p, m.points[i]) < 1)
    )
      return;
    onChange(saveDsdMeasurement(photo, m));
    onSelect({ kind: 'measurement', id: m.id, point: 0 });
    if (m.assessmentId) onTool('select');
  };
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const screen = local(e);
    if (e.pointerType === 'touch' && pen.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { point: screen, type: e.pointerType });
    if (e.pointerType === 'pen') pen.current = e.pointerId;
    if (gesture.current) return;
    const touches = [...pointers.current.entries()].filter(
      ([, p]) => p.type === 'touch',
    );
    if (touches.length === 2) {
      const base = drag.current?.photo ?? photo;
      drag.current = null;
      tap.current = null;
      setPreview(null);
      setCursor(null);
      photoRef.current = base;
      const center = {
        x: (touches[0][1].point.x + touches[1][1].point.x) / 2,
        y: (touches[0][1].point.y + touches[1][1].point.y) / 2,
      };
      const start = viewRef.current;
      const points: [Point, Point] = [
        toImage(touches[0][1].point, start),
        toImage(touches[1][1].point, start),
      ];
      const picked = hit(points[0]);
      const target =
        selection?.kind === 'tooth'
          ? selection
          : picked?.kind === 'tooth'
            ? picked
            : hit(toImage(center, start));
      const common = {
        ids: [touches[0][0], touches[1][0]] as [number, number],
        start,
        anchor: toImage(center, start),
        distance: Math.max(
          1,
          distance(touches[0][1].point, touches[1][1].point),
        ),
      };
      if (
        step === 'Teeth' &&
        tool === 'select' &&
        activeDesign(base).teeth.some((t) => t.visible) &&
        (props.group || target?.kind === 'tooth')
      ) {
        gesture.current = {
          ...common,
          type: 'teeth',
          photo: base,
          latest: base,
          fdi: props.group
            ? null
            : target!.kind === 'tooth'
              ? target!.fdi
              : null,
          points,
          snapping: props.snapping,
        };
        if (target?.kind === 'tooth') onSelect(target);
        return;
      }
      gesture.current = {
        ...common,
        type: 'view',
      };
      return;
    }
    const p = bounded(toImage(screen, viewRef.current));
    const canEdit = e.pointerType !== 'touch' || props.fingerEdit;
    if (
      !canEdit &&
      step === 'Teeth' &&
      tool === 'select' &&
      (props.group || selection?.kind === 'tooth' || hit(p)?.kind === 'tooth')
    ) {
      tap.current = { id: e.pointerId, point: p, screen };
      return;
    }
    if (step === 'Compare' && tool !== 'pan') {
      drag.current = {
        type: 'compare',
        origin: screen,
        photo,
        selection: null,
        view: viewRef.current,
        pointerId: e.pointerId,
        latest: photo,
        split: props.split,
      };
      props.onSplit(clamp(screen.x / size.width, 0, 1));
      return;
    }
    if (tool === 'pan' || !canEdit || step === 'Photos') {
      drag.current = {
        type: 'pan',
        origin: screen,
        photo,
        selection: null,
        view: viewRef.current,
        pointerId: e.pointerId,
        latest: photo,
      };
      return;
    }
    const raw = toImage(screen, viewRef.current);
    if (raw.x < 0 || raw.y < 0 || raw.x > photo.width || raw.y > photo.height)
      return;
    // A guided redraw places new endpoints even over existing landmarks.
    const frame =
      step === 'Measure' && tool === 'select'
        ? hitFrame(photo, props.basicToolId ?? null, p, viewRef.current.scale)
        : null;
    if (frame) {
      onSelect(null);
      drag.current = {
        type: 'frame',
        frame,
        origin: p,
        photo,
        selection: null,
        view: viewRef.current,
        pointerId: e.pointerId,
        latest: photo,
      };
      setCursor(p);
      return;
    }
    const picked = props.assessmentId && tool !== 'select' ? null : hit(p);
    if (picked) {
      let corner = -1;
      if (picked.kind === 'tooth' && !props.group) {
        const tooth = activeDesign(photo)?.teeth.find(
          (t) => t.fdi === picked.fdi,
        );
        if (tooth)
          corner = toothCorners(tooth).findIndex(
            (q) => distance(p, q) < 18 / viewRef.current.scale,
          );
      }
      onSelect(picked);
      drag.current = {
        type:
          corner >= 0 ? 'resize' : picked.kind === 'tooth' ? 'tooth' : 'point',
        origin: p,
        photo,
        selection: picked,
        view: viewRef.current,
        pointerId: e.pointerId,
        latest: photo,
        corner,
      };
      setCursor(p);
      return;
    }
    if (e.pointerType === 'touch' && tool !== 'ink') {
      tap.current = { id: e.pointerId, point: p, screen };
      return;
    }
    placePoint(p);
    if (tool === 'ink') {
      drag.current = {
        type: 'ink',
        origin: p,
        photo,
        selection: null,
        view: viewRef.current,
        pointerId: e.pointerId,
        latest: photo,
      };
      setDraft([p]);
      draftRef.current = [p];
    }
  };
  const placePoint = (p: Point) => {
    if (tool === 'select') {
      onSelect(null);
      return;
    }
    if (tool === 'lip') {
      if (photo.lip.closed) return;
      onChange({
        ...photo,
        lip: { ...photo.lip, points: [...photo.lip.points, p] },
      });
      onSelect({ kind: 'lip', point: photo.lip.points.length });
      return;
    }
    if (tool === 'ink') return;
    const next = [...draftRef.current, p];
    setDraft(next);
    draftRef.current = next;
    const count = tool === 'angle' ? 3 : tool === 'polyline' ? Infinity : 2;
    if (next.length === count) {
      if (tool === 'calibrate') props.onCalibrate(next);
      else if (tool === 'distance' || tool === 'guide' || tool === 'angle') {
        const id = uid();
        addMeasurement({
          id,
          kind: tool,
          label:
            (tool === 'guide'
              ? 'Reference'
              : tool === 'angle'
                ? 'Angle'
                : 'Distance') +
            ' ' +
            (photo.measurements.length + 1),
          points: next,
        });
      }
      setDraft([]);
      draftRef.current = [];
    }
  };
  const move = (e: React.PointerEvent) => {
    const screen = local(e);
    const tracked = pointers.current.get(e.pointerId);
    if (tracked) tracked.point = screen;
    const g = gesture.current;
    if (g) {
      if (!g.ids.includes(e.pointerId)) return;
      const touches = g.ids.map((id) => pointers.current.get(id));
      if (!touches[0] || !touches[1]) return;
      if (g.type === 'teeth') {
        const design = activeDesign(g.photo);
        const next = replaceDesign(g.photo, {
          ...design,
          teeth: pinchTeeth(
            design.teeth,
            g.fdi,
            g.points,
            [
              toImage(touches[0].point, g.start),
              toImage(touches[1].point, g.start),
            ],
            g.snapping,
            Math.min(100000, photo.width * 2),
            Math.min(100000, photo.height * 2),
          ),
        });
        g.latest = next;
        setPreview(next);
        photoRef.current = next;
        return;
      }
      const center = {
        x: (touches[0].point.x + touches[1].point.x) / 2,
        y: (touches[0].point.y + touches[1].point.y) / 2,
      };
      const scale = clamp(
          (g.start.scale * distance(touches[0].point, touches[1].point)) /
            g.distance,
          0.01,
          20,
        ),
        next = { ...g.start, scale, pan: { x: 0, y: 0 } },
        pos = toScreen(g.anchor, next);
      next.pan = { x: center.x - pos.x, y: center.y - pos.y };
      setView(next);
      return;
    }
    const p = bounded(toImage(screen, viewRef.current));
    if (
      e.pointerType === 'pen' ||
      e.pointerType === 'mouse' ||
      props.fingerEdit
    )
      setCursor(p);
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.type === 'compare') {
      props.onSplit(clamp(screen.x / size.width, 0, 1));
      return;
    }
    if (d.type === 'pan') {
      setView({
        ...d.view,
        pan: {
          x: d.view.pan.x + screen.x - d.origin.x,
          y: d.view.pan.y + screen.y - d.origin.y,
        },
      });
      return;
    }
    if (d.type === 'ink') {
      const points = draftRef.current;
      if (distance(points[points.length - 1], p) > 1) {
        const next = [...points, p];
        setDraft(next);
        draftRef.current = next;
      }
      return;
    }
    let next = d.photo;
    if (d.type === 'frame' && d.frame) {
      const t = getTemplate(d.photo, d.frame.id),
        b = t && templateBounds(t);
      if (t && b) {
        if (d.frame.mode === 'anchor')
          next = moveAnchor(d.photo, t.id, d.frame.path!, d.frame.key!, p);
        else {
          const scale =
            d.frame.mode === 'scale'
              ? distance(p, b.center) /
                Math.max(1, distance(d.origin, b.center))
              : 1;
          const degrees =
            d.frame.mode === 'rotate'
              ? ((Math.atan2(p.y - b.center.y, p.x - b.center.x) -
                  Math.atan2(
                    d.origin.y - b.center.y,
                    d.origin.x - b.center.x,
                  )) *
                  180) /
                Math.PI
              : 0;
          const target =
            d.frame.mode === 'move'
              ? {
                  x: b.center.x + p.x - d.origin.x,
                  y: b.center.y + p.y - d.origin.y,
                }
              : b.center;
          const updated = transformTemplate(
            t,
            b.center,
            target,
            scale,
            degrees,
          );
          if (templateFits(d.photo, updated))
            next = setTemplate(d.photo, updated);
          else next = d.latest;
        }
      }
    }
    if (d.type === 'point') next = movePoint(d.photo, d.selection, p);
    if (d.type === 'resize' && d.selection?.kind === 'tooth') {
      const design = activeDesign(d.photo),
        fdi = d.selection.fdi,
        tooth = design.teeth.find((t) => t.fdi === fdi)!;
      const a = (-tooth.rotation * Math.PI) / 180,
        dx = p.x - tooth.x,
        dy = p.y - tooth.y;
      const width = clamp(
          (2 * Math.abs(dx * Math.cos(a) - dy * Math.sin(a))) /
            (1 +
              ((d.corner ?? 0) < 2 ? -tooth.perspective : tooth.perspective)),
          1,
          photo.width * 2,
        ),
        height = clamp(
          2 * Math.abs(dx * Math.sin(a) + dy * Math.cos(a)),
          1,
          photo.height * 2,
        );
      next = replaceDesign(d.photo, {
        ...design,
        teeth: design.teeth.map((t) =>
          t.fdi === fdi ? { ...t, width, height } : t,
        ),
      });
    }
    if (d.type === 'tooth' && d.selection?.kind === 'tooth') {
      const design = activeDesign(d.photo);
      const fdi = d.selection.fdi;
      next = replaceDesign(d.photo, {
        ...design,
        teeth: design.teeth.map((t) =>
          props.group || t.fdi === fdi
            ? { ...t, x: t.x + p.x - d.origin.x, y: t.y + p.y - d.origin.y }
            : t,
        ),
      });
    }
    d.latest = next;
    setPreview(next);
    photoRef.current = next;
  };
  const up = (e: React.PointerEvent, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    if (pen.current === e.pointerId) pen.current = null;
    if (gesture.current) {
      const g = gesture.current;
      if (!g.ids.includes(e.pointerId)) return;
      gesture.current = null;
      if (g.type === 'teeth') {
        if (!cancelled && JSON.stringify(g.latest) !== JSON.stringify(g.photo))
          onChange(g.latest);
        photoRef.current = cancelled ? g.photo : g.latest;
      }
      drag.current = null;
      tap.current = null;
      setPreview(null);
      setCursor(null);
      return;
    }
    if (tap.current?.id === e.pointerId) {
      if (!cancelled && distance(tap.current.screen, local(e)) < 10)
        if (step === 'Teeth' && tool === 'select')
          onSelect(hit(tap.current.point));
        else placePoint(tap.current.point);
      tap.current = null;
    }
    const d = drag.current;
    if (d?.pointerId === e.pointerId) {
      if (!cancelled) {
        if (
          d.type === 'point' ||
          d.type === 'tooth' ||
          d.type === 'resize' ||
          d.type === 'frame'
        ) {
          if (JSON.stringify(d.latest) !== JSON.stringify(d.photo))
            onChange(d.latest);
        }
        if (d.type === 'ink' && draftRef.current.length >= 2) {
          onChange({
            ...d.photo,
            measurements: [
              ...d.photo.measurements,
              {
                id: uid(),
                kind: 'ink',
                label: 'Annotation ' + (d.photo.measurements.length + 1),
                points: draftRef.current,
              },
            ],
          });
        }
      }
      if (cancelled && d.type === 'compare') props.onSplit(d.split ?? 0.5);
      drag.current = null;
      setPreview(null);
      if (d.type === 'ink') {
        setDraft([]);
        draftRef.current = [];
      }
    }
    setCursor(null);
  };
  const zoomAt = (
    factor: number,
    screen: Point = { x: size.width / 2, y: size.height / 2 },
  ) => {
    const v = viewRef.current,
      anchor = toImage(screen, v),
      next = { ...v, scale: clamp(v.scale * factor, 0.01, 20) };
    const projected = toScreen(anchor, next);
    next.pan = {
      x: v.pan.x + screen.x - projected.x,
      y: v.pan.y + screen.y - projected.y,
    };
    setView(next);
  };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.001), local(e));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  const hint =
    props.assessmentId && dsdDefinition(props.assessmentId)?.kind === tool
      ? dsdDefinition(props.assessmentId)!.instruction
      : step === 'Photos'
        ? 'Original photo · two fingers to navigate'
        : step === 'Lip outline'
          ? 'Trace the inner upper border, then the lower border back to your first point'
          : step === 'Teeth'
            ? tool === 'pan'
              ? 'Two fingers pan and zoom the photo'
              : 'Select a tooth · pinch to scale and twist to rotate · Pan to navigate'
            : step === 'Compare'
              ? 'Drag the divider to compare the same framing'
              : tool === 'calibrate'
                ? 'Place two points across a known reference'
                : tool === 'angle'
                  ? 'Place three points · the second is the vertex'
                  : tool === 'polyline'
                    ? 'Place points, then finish the length'
                    : tool === 'ink'
                      ? 'Draw with your Pencil or mouse'
                      : tool === 'select'
                        ? 'Move a point, or edit its coordinates in the inspector'
                        : 'Place two points on the original photo';
  return (
    <div className="editor-wrap">
      <div className="canvas-toolbar" aria-label="Canvas tools">
        {step !== 'Compare' && (
          <>
            <button
              aria-label="Select and move"
              title="Select and move"
              className={tool === 'select' ? 'active' : ''}
              onClick={() => onTool('select')}
            >
              <MousePointer2 size={19} />
            </button>
            <button
              aria-label="Pan"
              title="Pan"
              className={tool === 'pan' ? 'active' : ''}
              onClick={() => onTool('pan')}
            >
              <Hand size={19} />
            </button>
          </>
        )}
        {step === 'Measure' && (
          <details className="annotation-tools">
            <summary>Annotations</summary>
            <div className="annotation-tool-menu">
              {measureTools.map(([t, label, Icon]) => (
                <button
                  key={t}
                  title={label}
                  aria-label={label}
                  className={tool === t ? 'active' : ''}
                  onClick={() => onTool(t)}
                >
                  <Icon size={19} />
                </button>
              ))}
            </div>
          </details>
        )}
        {step === 'Lip outline' && (
          <button
            aria-label="Trace lip outline"
            title="Trace lip outline"
            className={tool === 'lip' ? 'active' : ''}
            onClick={() => onTool('lip')}
          >
            <ScanLine size={19} />
          </button>
        )}
        <span className="tool-divider" />
        <button
          aria-label="Undo"
          disabled={!props.canUndo}
          onClick={props.onUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          aria-label="Redo"
          disabled={!props.canRedo}
          onClick={props.onRedo}
        >
          <Redo2 size={18} />
        </button>
        <span className="toolbar-spacer" />
        <button aria-label="Zoom out" onClick={() => zoomAt(0.8)}>
          <ZoomOut size={18} />
        </button>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom in" onClick={() => zoomAt(1.25)}>
          <ZoomIn size={18} />
        </button>
        <button
          aria-label="Fit photo"
          title="Fit photo"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Maximize size={18} />
        </button>
      </div>
      <div
        className="canvas-surface"
        ref={host}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => up(e)}
        onPointerCancel={(e) => up(e, true)}
        onLostPointerCapture={(e) => {
          if (
            drag.current?.pointerId === e.pointerId ||
            gesture.current?.ids.includes(e.pointerId)
          )
            up(e, true);
        }}
        data-testid="canvas-surface"
      >
        <canvas ref={canvas} aria-label="Photo editing canvas" />
        {!image && (
          <div className="canvas-message">
            The original photo is missing on this device.
            <br />
            Restore its backup or reattach the same photo.
          </div>
        )}
        {step === 'Compare' && image && (
          <>
            <span className="compare-label before">Before</span>
            <span className="compare-label after">Simulation</span>
            <div
              className="compare-divider"
              style={{ left: props.split * 100 + '%' }}
            >
              <span>↔</span>
            </div>
            <input
              className="compare-slider"
              style={{ pointerEvents: 'none' }}
              type="range"
              aria-label="Comparison divider"
              min="0"
              max="1"
              step=".001"
              value={props.split}
              onChange={(e) => props.onSplit(Number(e.target.value))}
            />
          </>
        )}
        {cursor && step !== 'Photos' && step !== 'Compare' && (
          <canvas
            className="magnifier"
            ref={magnifier}
            width="140"
            height="140"
            aria-label="Point magnifier"
          />
        )}
        {draft.length > 0 && (
          <div className="draft-actions">
            {tool === 'polyline' && (
              <button
                className="primary"
                disabled={draft.length < (props.assessmentId ? 3 : 2)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={finish}
              >
                <Check size={16} />
                Finish length
              </button>
            )}
            <button onPointerDown={(e) => e.stopPropagation()} onClick={cancel}>
              <X size={16} />
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="canvas-footer">
        <span>{hint}</span>
        <span>
          {photo.width} × {photo.height}
        </span>
      </div>
    </div>
  );
}
