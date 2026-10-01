import { useId } from 'react';
import {
  landmarkSchema,
  outlineSchema,
  alignmentSchema,
  renderResultSchema,
  type Proposal,
  assessmentSchema,
} from './assistProtocol';
import { dsdDefinition } from './dsdCatalog';
import { type Photo } from './domain';
import { lipPath } from './geometry';
import { basicFrameSuggestionSchema } from './basicFrameSchema';
import {
  applyBasicSuggestion,
  templatePaths,
  curvePath,
  toolLabel,
} from './basicFrame';
export function ProposalPreview({
  proposal,
  photo,
  image,
  selectedBasicIds = [],
}: {
  proposal: Proposal;
  photo: Photo;
  image: HTMLImageElement | null;
  selectedBasicIds?: string[];
}) {
  const id = useId().replace(/:/g, '');
  if (!image) return <p>Restore the original photo to review this proposal.</p>;
  const scale = Math.max(photo.width, photo.height) / 650,
    point = (p: { x: number; y: number }) => ({
      x: (p.x * photo.width) / 1000,
      y: (p.y * photo.height) / 1000,
    });
  const label = (
    p: { x: number; y: number },
    text: string,
    key: string | number,
  ) => (
    <text
      key={key}
      x={p.x + 8 * scale}
      y={p.y - 8 * scale}
      fill="white"
      fontSize={14 * scale}
      stroke="#17323d"
      strokeWidth={3 * scale}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
  return (
    <svg
      viewBox={`0 0 ${photo.width} ${photo.height}`}
      role="img"
      aria-label="AI proposal over the source photo"
    >
      <image href={image.src} width={photo.width} height={photo.height} />
      <g fill="#f5c482" stroke="#f5c482" strokeWidth={2 * scale}>
        {proposal.operation === 'basic-frame' &&
          (() => {
            try {
              const next = applyBasicSuggestion(
                photo,
                basicFrameSuggestionSchema.parse(proposal.result),
                selectedBasicIds,
              );
              return next.dsd?.basicFrame?.templates
                .filter(
                  (t) =>
                    selectedBasicIds.includes(t.id) &&
                    t.status !== 'unavailable',
                )
                .map((t) => (
                  <g key={t.id}>
                    {templatePaths(t).map((path) =>
                      t.id.endsWith('curve') ? (
                        <path key={path.key} d={curvePath(path)} fill="none" />
                      ) : (
                        <polyline
                          key={path.key}
                          points={path.anchors
                            .flatMap((a) =>
                              a.point ? [`${a.point.x},${a.point.y}`] : [],
                            )
                            .join(' ')}
                          fill="none"
                        />
                      ),
                    )}
                    {(() => {
                      const p = templatePaths(t)
                        .flatMap((path) => path.anchors)
                        .find((a) => a.point)?.point;
                      return p ? label(p, toolLabel(t.id), t.id) : null;
                    })()}
                  </g>
                ));
            } catch {
              return (
                <text x={10} y={30} fill="white">
                  A suggested guide extends outside the photo. Deselect it to
                  continue.
                </text>
              );
            }
          })()}
        {proposal.operation === 'assessment' &&
          assessmentSchema.parse(proposal.result).measurements.map((m) => {
            const points = m.points.map(point);
            return (
              <g key={m.assessmentId}>
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3 * scale} />
                ))}
                {label(
                  points[0],
                  dsdDefinition(m.assessmentId)!.label,
                  m.assessmentId,
                )}
              </g>
            );
          })}
        {proposal.operation === 'outline' &&
          (() => {
            const points = outlineSchema
              .parse(proposal.result)
              .points.map(point);
            return (
              <>
                <polygon
                  fill="#ffc98720"
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3 * scale} />
                ))}
              </>
            );
          })()}
        {proposal.operation === 'landmarks' &&
          landmarkSchema.parse(proposal.result).measurements.map((m, i) => {
            const [a, b] = m.points.map(point);
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <circle cx={a.x} cy={a.y} r={4 * scale} />
                <circle cx={b.x} cy={b.y} r={4 * scale} />
                {label(a, m.label, i)}
              </g>
            );
          })}
        {proposal.operation === 'alignment' &&
          alignmentSchema.parse(proposal.result).teeth.map((t) => {
            const p = point(t.center),
              w = (t.width * photo.width) / 1000,
              h = (t.height * photo.height) / 1000;
            return (
              <g key={t.fdi}>
                <rect
                  transform={`rotate(${t.rotation} ${p.x} ${p.y})`}
                  x={p.x - w / 2}
                  y={p.y - h / 2}
                  width={w}
                  height={h}
                  fill="#ffc98715"
                />
                {label(p, String(t.fdi), t.fdi)}
              </g>
            );
          })}
      </g>
      {proposal.operation === 'render' &&
        (() => {
          const result = renderResultSchema.parse(proposal.result);
          return (
            <>
              <defs>
                <clipPath id={'proposal-' + id}>
                  <path d={lipPath(photo.lip)} />
                </clipPath>
              </defs>
              <image
                href={`data:${result.mimeType};base64,${result.data}`}
                width={photo.width}
                height={photo.height}
                preserveAspectRatio="none"
                clipPath={`url(#proposal-${id})`}
              />
            </>
          );
        })()}
    </svg>
  );
}
