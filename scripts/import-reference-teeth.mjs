// Split the transparent ImageGen atlas into separate FDI crown assets.
// No enamel recoloring or perspective changes are applied during import.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const atlasPath = process.argv[2];
if (!atlasPath)
  throw new Error('Provide the path to the transparent 5 × 2 atlas.');
const url =
  'data:image/png;base64,' + (await fs.readFile(atlasPath)).toString('base64');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const crowns = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const w = canvas.width,
      h = canvas.height,
      n = w * h;
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const visited = new Uint8Array(n),
      queue = new Int32Array(n);
    const components = [];
    for (let i = 0; i < n; i++) {
      if (visited[i] || pixels[i * 4 + 3] <= 8) continue;
      let head = 0,
        tail = 1,
        minX = w,
        minY = h,
        maxX = 0,
        maxY = 0;
      queue[0] = i;
      visited[i] = 1;
      while (head < tail) {
        const p = queue[head++],
          x = p % w,
          y = Math.floor(p / w);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        for (const next of [
          x > 0 ? p - 1 : -1,
          x < w - 1 ? p + 1 : -1,
          p - w,
          p + w,
        ]) {
          if (
            next >= 0 &&
            next < n &&
            !visited[next] &&
            pixels[next * 4 + 3] > 8
          ) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }
      if (tail > n * 0.01) {
        components.push({
          minX,
          minY,
          maxX,
          maxY,
          points: Array.from(queue.subarray(0, tail)),
        });
      }
    }
    const top = components
      .filter((c) => (c.minY + c.maxY) / 2 < h / 2)
      .sort((a, b) => a.minX - b.minX);
    const bottom = components
      .filter((c) => (c.minY + c.maxY) / 2 >= h / 2)
      .sort((a, b) => a.minX - b.minX);
    if (top.length !== 5 || bottom.length !== 5) {
      throw new Error(
        `Expected five separate teeth per row; found ${top.length} and ${bottom.length}.`,
      );
    }
    const fdis = [15, 14, 13, 12, 11, 21, 22, 23, 24, 25];
    return [...top, ...bottom].map((component, index) => {
      const minX = Math.max(0, component.minX - 2),
        minY = Math.max(0, component.minY - 2);
      const width = Math.min(w - 1, component.maxX + 2) - minX + 1;
      const height = Math.min(h - 1, component.maxY + 2) - minY + 1;
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const oc = output.getContext('2d');
      const data = oc.createImageData(width, height);
      const mask = new Uint8Array(width * height);
      // Include one antialiased perimeter pixel, discarding gutter noise.
      for (const p of component.points) {
        const x = (p % w) - minX,
          y = Math.floor(p / w) - minY;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const mx = x + dx,
              my = y + dy;
            if (mx >= 0 && mx < width && my >= 0 && my < height)
              mask[my * width + mx] = 1;
          }
      }
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          if (!mask[p]) continue;
          const source = ((y + minY) * w + x + minX) * 4;
          data.data.set(pixels.subarray(source, source + 4), p * 4);
        }
      oc.putImageData(data, 0, 0);
      return {
        fdi: fdis[index],
        width,
        height,
        png: output.toDataURL('image/png').split(',')[1],
      };
    });
  }, url);
  const outputDir = path.join(root, 'public', 'teeth', 'frontal-reference');
  await fs.mkdir(outputDir, { recursive: true });
  for (const crown of crowns) {
    await fs.writeFile(
      path.join(outputDir, `${crown.fdi}.png`),
      Buffer.from(crown.png, 'base64'),
    );
  }
  const metadata = {
    name: 'Frontal reference',
    perspective: 'Frontal smile view',
    texture: 'natural',
    provenance:
      'Reference-based ImageGen reconstruction with slightly pointed downward canine cusps (13, 23).',
    teeth: crowns.map(({ png, ...crown }) => ({
      ...crown,
      file: `${crown.fdi}.png`,
    })),
  };
  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(metadata, null, 2) + '\n',
  );
  console.log(JSON.stringify(metadata, null, 2));
} finally {
  await browser.close();
}
