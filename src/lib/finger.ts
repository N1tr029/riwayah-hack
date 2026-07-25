/**
 * Finger-on-lens detection for Expo Go.
 *
 * Expo Go can't stream camera frames, so the scan snaps tiny low-quality
 * stills and inspects their average color. With the torch on and a fingertip
 * covering the lens, light passes through blood-filled tissue and the frame
 * becomes overwhelmingly red — an unmistakable signature.
 */

import jpeg from 'jpeg-js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i + 3 < clean.length || (i + 1 < clean.length && o < len); i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = LOOKUP[clean.charCodeAt(i + 2)] || 0;
    const d = LOOKUP[clean.charCodeAt(i + 3)] || 0;
    if (o < len) out[o++] = (a << 2) | (b >> 4);
    if (o < len) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < len) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

export interface FrameColor {
  r: number;
  g: number;
  b: number;
}

/** Average color of a JPEG, sampled sparsely so large frames stay cheap. */
export function averageColor(jpegBase64: string): FrameColor {
  const bytes = base64ToBytes(jpegBase64);
  const { data } = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
  const pixels = data.length / 4;
  const step = Math.max(1, Math.floor(pixels / 4000)) * 4;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += step) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return { r: r / n, g: g / n, b: b / n };
}

/** A torch-lit fingertip reads bright and strongly red-dominant. */
export function looksLikeFinger(c: FrameColor): boolean {
  return c.r > 100 && c.r > 1.5 * c.g && c.r > 1.5 * c.b;
}

export function isFingerFrame(jpegBase64: string): boolean {
  return looksLikeFinger(averageColor(jpegBase64));
}
