import type { Photo, Point } from './domain';
import type { BasicToolId, BasicTemplate } from './basicFrameSchema';
import {
  curvePath,
  templateBounds,
  templatePaths,
  toolLabel,
} from './basicFrame';

export const visibleTemplates = (
  photo: Photo,
  activeId: BasicToolId | null,
  showAll: boolean,
  confirmedOnly = false,
) =>
  (photo.dsd?.basicFrame?.templates ?? []).filter(
    (t) =>
      t.status !== 'unavailable' &&
      (!confirmedOnly || t.status === 'confirmed') &&
      (confirmedOnly || showAll || t.id === activeId || t.id === 'midline'),
  );
export function frameHandles(t: BasicTemplate, scale: number) {
  const b = templateBounds(t);
  if (!b) return null;
  return {
    move: { x: b.center.x, y: b.maxY + 28 / scale },
    scale: { x: b.maxX + 12 / scale, y: b.maxY + 12 / scale },
    rotate: { x: b.center.x, y: b.minY - 28 / scale },
  };
}
export type FrameHit = {
  id: BasicToolId;
  mode: 'move' | 'scale' | 'rotate' | 'anchor';
  path?: string;
  key?: string;
};
export function hitFrame(
  photo: Photo,
  id: BasicToolId | null,
  p: Point,
  scale: number,
): FrameHit | null {
  const t = photo.dsd?.basicFrame?.templates.find(
    (t) => t.id === id && t.status !== 'unavailable',
  );
  if (!t) return null;
  const radius = 14 / scale,
    near = (q: Point) => Math.hypot(p.x - q.x, p.y - q.y) < radius;
  for (const path of t.paths)
    for (const a of path.anchors)
      if (a.point && near(a.point))
        return { id: t.id, mode: 'anchor', path: path.key, key: a.key };
  const handles = frameHandles(t, scale);
  if (handles)
    for (const mode of ['move', 'scale', 'rotate'] as const)
      if (near(handles[mode])) return { id: t.id, mode };
  return null;
}
export function drawBasicFrame(
  ctx: CanvasRenderingContext2D,
  photo: Photo,
  activeId: BasicToolId | null,
  showAll: boolean,
  scale: number,
  confirmedOnly = false,
) {
  for (const t of visibleTemplates(photo, activeId, showAll, confirmedOnly)) {
    const selected = t.id === activeId && !confirmedOnly;
    ctx.save();
    ctx.lineWidth = (selected ? 2 : 1.5) / scale;
    ctx.setLineDash(t.status === 'draft' ? [5 / scale, 4 / scale] : []);
    templatePaths(t).forEach((path, index) => {
      ctx.strokeStyle =
        t.id === 'smile-curve' && index === 1
          ? '#f5c482'
          : selected
            ? '#ffd38a'
            : '#64e1df';
      const pts = path.anchors.flatMap((a) => (a.point ? [a.point] : []));
      if (!pts.length) return;
      if (t.id.endsWith('curve')) ctx.stroke(new Path2D(curvePath(path)));
      else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
      if (selected && !t.placement)
        path.anchors.forEach((a) => {
          if (!a.point) return;
          ctx.beginPath();
          ctx.arc(a.point.x, a.point.y, 4 / scale, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        });
    });
    ctx.setLineDash([]);
    const b = templateBounds(t);
    if (b) {
      ctx.font = `500 ${11 / scale}px sans-serif`;
      ctx.fillStyle = '#15323b';
      const label = `${toolLabel(t.id)}${t.status === 'draft' ? ' · draft' : ''}`;
      ctx.fillRect(
        b.minX,
        b.minY - 18 / scale,
        ctx.measureText(label).width + 8 / scale,
        16 / scale,
      );
      ctx.fillStyle = '#fff';
      ctx.fillText(label, b.minX + 4 / scale, b.minY - 6 / scale);
    }
    const handles = selected ? frameHandles(t, scale) : null;
    if (handles) {
      for (const mode of ['move', 'scale', 'rotate'] as const) {
        const p = handles[mode];
        ctx.fillStyle = mode === 'move' ? '#047f82' : '#ffd38a';
        ctx.strokeStyle = '#15323b';
        ctx.beginPath();
        if (mode === 'scale')
          ctx.rect(p.x - 6 / scale, p.y - 6 / scale, 12 / scale, 12 / scale);
        else ctx.arc(p.x, p.y, 7 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
