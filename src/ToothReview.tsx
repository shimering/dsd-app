import { useEffect, useRef, useState } from 'react';
import {
  FDI,
  FORMS,
  TEXTURES,
  SHADES,
  newPhoto,
  seededTeeth,
  type Tooth,
} from './domain';
import { drawTooth } from './render';
import { X } from 'lucide-react';

export function ToothReview({
  onClose,
  ready,
}: {
  onClose: () => void;
  ready: boolean;
}) {
  const [form, setForm] = useState<Tooth['form']>('oval'),
    [texture, setTexture] = useState<Tooth['texture']>('natural'),
    [shade, setShade] = useState<Tooth['shade']>('A1'),
    [guides, setGuides] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null),
    dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement,
      el = dialog.current!;
    const controls = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button,input,select'));
    controls()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = controls(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.clearRect(0, 0, 1200, 420);
    const p = newPhoto('Review', '', 1200, 1000, 'image/png');
    p.lip.points = [
      { x: 40, y: 40 },
      { x: 1160, y: 40 },
      { x: 1160, y: 350 },
      { x: 40, y: 350 },
    ];
    const teeth = seededTeeth(p).map((t) => ({ ...t, form, texture, shade }));
    teeth.forEach((t) => drawTooth(ctx, t));
    if (guides) {
      ctx.strokeStyle = '#6ccac055';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(600, 20);
      ctx.lineTo(600, 360);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.font = '500 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7c4c8';
    teeth.forEach((t) => ctx.fillText(String(t.fdi), t.x, 395));
  }, [form, texture, shade, guides, ready]);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="modal tooth-review"
        role="dialog"
        aria-modal="true"
        aria-label="Tooth library review"
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">UPPER ARCH · FDI 15–25</span>
            <h2>A more natural contour</h2>
          </div>
          <button aria-label="Close tooth review" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p>
          Rounded cervical contours across every tooth. Premolars show a single
          buccal cusp. This arrangement is a starting point for adjustment on a
          photo.
        </p>
        <div className="review-canvas">
          <canvas
            ref={canvas}
            width="1200"
            height="420"
            aria-label="All ten upper teeth with corrected cervical contours"
          />
        </div>
        <div className="review-controls">
          <label>
            Form
            <select
              value={form}
              onChange={(e) => setForm(e.target.value as Tooth['form'])}
            >
              {FORMS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Texture
            <select
              value={texture}
              onChange={(e) => setTexture(e.target.value as Tooth['texture'])}
            >
              {TEXTURES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Visual shade
            <select
              value={shade}
              onChange={(e) => setShade(e.target.value as Tooth['shade'])}
            >
              {SHADES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={guides}
              onChange={(e) => setGuides(e.target.checked)}
            />
            Midline
          </label>
        </div>
        <div className="note">
          Patient’s right → {FDI.slice(0, 5).join(' · ')} │{' '}
          {FDI.slice(5).join(' · ')} ← Patient’s left
        </div>
      </section>
    </div>
  );
}
