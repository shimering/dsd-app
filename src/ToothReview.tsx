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
import { toothSprite } from './assets';
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
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]',
        ),
      );
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
    let teeth = seededTeeth(p).map((t) => ({ ...t, form, texture, shade }));
    if (form === 'frontal-reference' && ready) {
      const crowns = teeth.map((t) => toothSprite(t)!);
      const scale = 1050 / crowns.reduce((sum, crown) => sum + crown.width, 0);
      let x = 75;
      teeth = teeth.map((t, index) => {
        const width = crowns[index].width * scale;
        const height = crowns[index].height * scale;
        const tooth = {
          ...t,
          x: x + width / 2,
          y: t.y + t.height / 2 - height / 2,
          width,
          height,
          rotation: 0,
        };
        x += width;
        return tooth;
      });
    }
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
            <h2>
              {form === 'frontal-reference'
                ? 'Your frontal reference'
                : 'A more natural contour'}
            </h2>
          </div>
          <button aria-label="Close tooth review" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p>
          {form === 'frontal-reference'
            ? 'Ten separate crowns based on your smile reference, preserving the frontal perspective and distinct right and left teeth. Hidden crown edges are reconstructed. This arrangement is a starting point for adjustment on a photo.'
            : 'Rounded cervical contours across every tooth. Premolars show a single buccal cusp. This arrangement is a starting point for adjustment on a photo.'}
        </p>
        <div className="review-canvas">
          <canvas
            ref={canvas}
            width="1200"
            height="420"
            aria-label="All ten upper teeth in the selected library set"
          />
        </div>
        <div className="review-controls">
          <label>
            Form
            <select
              aria-label="Form"
              value={form}
              onChange={(e) => {
                const value = e.target.value as Tooth['form'];
                setForm(value);
                if (value === 'frontal-reference') setTexture('natural');
              }}
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
              aria-label="Texture"
              value={texture}
              disabled={form === 'frontal-reference'}
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
              aria-label="Visual shade"
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
        {form === 'frontal-reference' && (
          <div
            className="reference-crowns"
            aria-label="Individual reference teeth"
          >
            {FDI.map((fdi) => (
              <a
                key={fdi}
                href={`/teeth/frontal-reference/${fdi}.png`}
                download={`frontal-reference-${fdi}.png`}
                aria-label={`Download reference tooth ${fdi}`}
              >
                <img
                  src={`/teeth/frontal-reference/${fdi}.png`}
                  alt={`Tooth ${fdi}`}
                />
                <span>{fdi}</span>
              </a>
            ))}
          </div>
        )}
        <div className="note">
          Patient’s right → {FDI.slice(0, 5).join(' · ')} │{' '}
          {FDI.slice(5).join(' · ')} ← Patient’s left
        </div>
      </section>
    </div>
  );
}
