import { Case } from "../types";
import { createCase, activeRevision, now, uid } from "./case-model";
import { defaultGuides } from "./geometry";
import {
  TOOTH_TEMPLATES,
  getToothTypeFromFdi,
  isRightQuadrant,
} from "./tooth-templates";
export function createDemoCase(): Case {
  const c = createCase("DEMO · Natural smile");
  c.isDemo = true;
  const teeth = Object.values(activeRevision(c).teeth)
    .map(
      (t) =>
        `<g transform="translate(${t.x} ${t.y})"><svg x="${-t.widthPx / 2}" y="${-t.heightPx / 2}" width="${t.widthPx}" height="${t.heightPx}" viewBox="0 0 100 100"><path d="${TOOTH_TEMPLATES.rounded.outlinePath(getToothTypeFromFdi(t.fdi), isRightQuadrant(t.fdi))}" fill="url(#enamel)" stroke="#b7ad96" stroke-width="1.2"/></svg></g>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650"><defs><radialGradient id="skin"><stop stop-color="#e9c9b1"/><stop offset="1" stop-color="#bd8d79"/></radialGradient><linearGradient id="enamel" x2=".2" y2="1"><stop stop-color="#ddd4bf"/><stop offset=".3" stop-color="#f1eddf"/><stop offset=".86" stop-color="#ede8d9"/><stop offset="1" stop-color="#ccd6d3"/></linearGradient></defs><rect width="1000" height="650" fill="url(#skin)"/><path d="M190 330 Q500 200 810 330 Q500 530 190 330" fill="#40222a"/><path d="M285 324 Q500 260 718 324 L680 365 Q500 303 320 365Z" fill="#c9898e"/>${teeth}<path d="M186 330 Q365 266 500 277 Q649 261 814 330 Q634 238 501 248 Q350 232 186 330" fill="#b66e72"/><path d="M186 330 Q500 469 814 330 Q676 493 500 485 Q319 493 186 330" fill="#b66e72"/><path d="M322 433 Q500 475 682 433" fill="none" stroke="#d9a0a0" stroke-width="5" opacity=".5"/></svg>`;
  const id = uid();
  c.photos = [
    {
      id,
      type: "maximum_smile",
      mediaKey: "",
      name: "Illustrated demo smile",
      width: 1000,
      height: 650,
      mimeType: "image/svg+xml",
      orientationDeg: 0,
      calibration: { isCalibrated: false },
      guides: defaultGuides(1000, 650),
      capturedAt: now(),
      qualityReviewed: false,
      filters: "none",
      isIllustration: true,
      url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    },
  ];
  c.activePhotoId = id;
  c.revisions[0].photoId = id;
  return c;
}
