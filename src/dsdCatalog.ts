export type DsdView = 'smile' | 'rest' | 'retracted';
export type DsdDefinition = {
  id: string;
  label: string;
  group: string;
  kind: 'distance' | 'guide' | 'polyline';
  instruction: string;
  views: DsdView[];
};
export const ANTERIOR = [13, 12, 11, 21, 22, 23] as const;
const dental: DsdView[] = ['smile', 'retracted'];
const define = (
  id: string,
  label: string,
  group: string,
  kind: DsdDefinition['kind'],
  instruction: string,
  views = dental,
): DsdDefinition => ({ id, label, group, kind, instruction, views });

// Named photo measurements from the DSD protocol. No universal treatment targets.
export const DSD_MEASUREMENTS: DsdDefinition[] = [
  define(
    'facial-horizontal',
    'Facial horizontal / interpupillary line',
    'Facial & dental alignment',
    'guide',
    'Place image-left then image-right pupil centers. Use the whole face to confirm this reference; mark unavailable if the eyes are cropped.',
    ['smile', 'rest'],
  ),
  define(
    'facial-midline',
    'Facial midline',
    'Facial & dental alignment',
    'guide',
    'Place an upper then lower facial midline reference using glabella, nose / philtrum, and chin. Confirm facial asymmetry clinically.',
    ['smile', 'rest'],
  ),
  define(
    'dental-midline',
    'Upper dental midline',
    'Facial & dental alignment',
    'guide',
    'Place the papilla tip between 11 and 21, then their incisal embrasure.',
  ),
  define(
    'incisal-plane',
    'Central incisal plane',
    'Facial & dental alignment',
    'guide',
    'Place the incisal-edge midpoint of 11, then 21 (image left to right).',
  ),
  define(
    'canine-plane',
    'Canine / anterior plane',
    'Facial & dental alignment',
    'guide',
    'Place the cusp tip of 13, then 23. This is the frontal anterior reference, not a full 3D occlusal plane.',
  ),
  define(
    'gingival-reference',
    'Common gingival reference',
    'Gingival & interdental relationships',
    'guide',
    'Place two points above the six anterior gingival margins, parallel to the confirmed facial horizontal. Use this SAME line for every gingival-height measurement.',
  ),
  ...ANTERIOR.flatMap((fdi) => [
    define(
      `width-${fdi}`,
      `${fdi} crown width`,
      'Tooth dimensions & axes',
      'distance',
      `Place mesial and distal borders at the widest visible crown of ${fdi}. Measure apparent frontal width, not an assumed true 3D width.`,
    ),
    define(
      `height-${fdi}`,
      `${fdi} crown height`,
      'Tooth dimensions & axes',
      'distance',
      `Place the gingival zenith then incisal-edge midpoint / canine cusp of ${fdi}. If the cervical margin is hidden, mark unavailable.`,
    ),
    define(
      `axis-${fdi}`,
      `${fdi} crown axis`,
      'Tooth dimensions & axes',
      'guide',
      `Place the cervical crown midpoint then incisal midpoint / cusp of ${fdi}. This is the visible crown axis; the root axis cannot be inferred.`,
    ),
    define(
      `gingival-${fdi}`,
      `${fdi} gingival level`,
      'Gingival & interdental relationships',
      'distance',
      `Place the perpendicular projection on the saved common gingival reference, then the gingival zenith of ${fdi}. All six levels must use the same reference.`,
    ),
    define(
      `zenith-${fdi}`,
      `${fdi} zenith offset`,
      'Gingival & interdental relationships',
      'distance',
      `Place the projection of the gingival zenith on the visible crown axis, then the zenith of ${fdi}; measure perpendicular to that axis.`,
    ),
  ]),
  ...ANTERIOR.slice(0, -1).flatMap((fdi, i) => {
    const pair = `${fdi}-${ANTERIOR[i + 1]}`;
    return [
      define(
        `papilla-${pair}`,
        `${pair} papilla height`,
        'Gingival & interdental relationships',
        'distance',
        `Place the interdental papilla tip then its perpendicular projection on the incisal reference at ${pair}.`,
      ),
      define(
        `contact-${pair}`,
        `${pair} contact length`,
        'Gingival & interdental relationships',
        'distance',
        `Place cervical then incisal limits of the visible contact area between ${pair}. Mark unavailable when these limits cannot be distinguished.`,
      ),
      define(
        `embrasure-${pair}`,
        `${pair} incisal embrasure`,
        'Gingival & interdental relationships',
        'distance',
        `Place the incisal end of the contact area then the embrasure opening at the incisal reference between ${pair}.`,
      ),
    ];
  }),
  ...[12, 22].flatMap((fdi) => [
    define(
      `lateral-step-${fdi}`,
      `${fdi} central-to-lateral incisal step`,
      'Tooth dimensions & axes',
      'distance',
      `Place the perpendicular projection of the ${fdi} incisal midpoint on the central incisal plane, then its incisal midpoint. Use the same plane on both sides.`,
    ),
    define(
      `lateral-gum-${fdi}`,
      `${fdi} lateral gingival offset`,
      'Gingival & interdental relationships',
      'distance',
      `Place the projection of the ${fdi} zenith on the line joining the adjacent central-incisor and canine zeniths, then the ${fdi} zenith.`,
    ),
  ]),
  define(
    'smile-width',
    'Smile width',
    'Smile & lip relationships',
    'distance',
    'Place the inner image-left then image-right lip commissures.',
    ['smile'],
  ),
  define(
    'dentition-width',
    'Visible upper dentition width',
    'Smile & lip relationships',
    'distance',
    'Place the outer border of the most posterior visible upper tooth on each side.',
    ['smile'],
  ),
  define(
    'interlabial-gap',
    'Interlabial gap',
    'Smile & lip relationships',
    'distance',
    'At the dental midline, place the inner upper lip border then inner lower lip border.',
    ['smile'],
  ),
  define(
    'corridor-right',
    'Patient-right buccal corridor',
    'Smile & lip relationships',
    'distance',
    'On image left, place the inner commissure then the outermost visible upper tooth border along the smile-width direction.',
    ['smile'],
  ),
  define(
    'corridor-left',
    'Patient-left buccal corridor',
    'Smile & lip relationships',
    'distance',
    'On image right, place the outermost visible upper tooth border then the inner commissure along the smile-width direction.',
    ['smile'],
  ),
  ...[11, 21].flatMap((fdi) => [
    define(
      `display-${fdi}`,
      `${fdi} incisor display in smile`,
      'Smile & lip relationships',
      'distance',
      `Along the ${fdi} crown axis, place the inner upper lip border then the incisal edge.`,
      ['smile'],
    ),
    define(
      `gum-display-${fdi}`,
      `${fdi} gingival display`,
      'Smile & lip relationships',
      'distance',
      `Place the inner upper lip border then gingival zenith of ${fdi}. Only record exposed gingiva; mark unavailable if the lip covers the margin.`,
      ['smile'],
    ),
    define(
      `rest-display-${fdi}`,
      `${fdi} incisor display at rest`,
      'Resting lip relationships',
      'distance',
      `On a separate lips-at-rest photo, place the inner upper lip border then incisal edge of ${fdi}. Do not use a smile photo.`,
      ['rest'],
    ),
  ]),
  define(
    'incisal-arc',
    'Upper incisal smile arc',
    'Smile & lip relationships',
    'polyline',
    'Trace the incisal edges / cusps from 13 through 12, 11, 21, 22 to 23, then Finish. Compare its shape with the lower-lip curve.',
    ['smile'],
  ),
  define(
    'lower-lip-arc',
    'Lower-lip smile curve',
    'Smile & lip relationships',
    'polyline',
    'Trace the inner lower-lip border from image left to right, then Finish. This reference curve does not replace the later lip outline.',
    ['smile'],
  ),
  define(
    'upper-lip-length',
    'Upper-lip length at rest',
    'Resting lip relationships',
    'distance',
    'On a resting photo, place subnasale then the lower border of the upper lip at the midline.',
    ['rest'],
  ),
];
export const DSD_GROUPS = [
  'Facial & dental alignment',
  'Tooth dimensions & axes',
  'Gingival & interdental relationships',
  'Smile & lip relationships',
  'Resting lip relationships',
];
// A visible zero offset / zero exposed gap is meaningful. Crown dimensions and
// reference lines still require distinct endpoints.
export const dsdAllowsZero = (id: string) =>
  [
    'zenith-',
    'lateral-step-',
    'lateral-gum-',
    'corridor-',
    'gum-display-',
    'rest-display-',
  ].some((prefix) => id.startsWith(prefix));
export const dsdDefinition = (id: string) =>
  DSD_MEASUREMENTS.find((m) => m.id === id);
export const applicableDsd = (view: DsdView) =>
  DSD_MEASUREMENTS.filter((m) => m.views.includes(view));
