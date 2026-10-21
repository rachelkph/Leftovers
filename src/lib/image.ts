import type { ScanKind, ScanRequest, ScanResponse } from './types';
import { accessToken } from './auth';

/** What file pickers should offer: everything image-like, plus iPhone HEIC/HEIF by extension. */
export const IMAGE_ACCEPT = 'image/*,.heic,.heif';

export class ImageError extends Error {}

// HEIC/HEIF files start with an ISO-BMFF "ftyp" box naming one of these brands.
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

/**
 * Is this an iPhone-style HEIC/HEIF photo? Checks the file's first bytes, because
 * browsers other than Safari often report an empty type for .heic files.
 */
async function isHeif(file: File): Promise<boolean> {
  if (/^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (ascii(4, 8) !== 'ftyp') return false;
  if (HEIF_BRANDS.has(ascii(8, 12))) return true;
  // Compatible brands follow the major brand and version.
  for (let i = 16; i + 4 <= head.length; i += 4) if (HEIF_BRANDS.has(ascii(i, i + 4))) return true;
  return false;
}

/** Anything we can turn into a picture: normal images, plus HEIC even when the browser doesn't label it. */
export async function isImageFile(file: File): Promise<boolean> {
  return file.type.startsWith('image/') || (await isHeif(file));
}

/**
 * Decode a photo once, respecting its orientation. The browser's own decoder handles
 * JPEG/PNG/WebP everywhere and HEIC in Safari; other browsers fall back to a HEIC
 * converter that's only downloaded the first time it's needed.
 */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  // createImageBitmap keeps working in background tabs (img.decode() stalls there)
  // and applies the photo's EXIF orientation.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Not natively supported here — see if it's HEIC.
  }
  if (await isHeif(file)) {
    try {
      const { heicTo } = await import('heic-to');
      return await heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } });
    } catch {
      throw new ImageError('We couldn’t open that HEIC photo. Try exporting it as a JPEG.');
    }
  }
  throw new ImageError('We couldn’t open that photo. Try a JPG, PNG or HEIC.');
}

function drawScaled(img: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Small thumbnail stored with the item. */
export function thumbnailFrom(img: ImageBitmap): string {
  return drawScaled(img, 480).toDataURL('image/jpeg', 0.8);
}

/** Downscaled for the vision model (long edge ~1568px is plenty for receipts). */
export function scanPayloadFrom(img: ImageBitmap, kind: ScanKind): ScanRequest {
  const dataUrl = drawScaled(img, 1568).toDataURL('image/jpeg', 0.88);
  return { kind, mediaType: 'image/jpeg', data: dataUrl.split(',')[1] };
}

/** Convenience for places that only need the thumbnail (e.g. "add a photo"). */
export async function toThumbnail(file: File): Promise<string> {
  const img = await decodeImage(file);
  try {
    return thumbnailFrom(img);
  } finally {
    img.close();
  }
}

export async function scan(payload: ScanRequest): Promise<ScanResponse> {
  // With cloud sync on, the hosted scanner only accepts signed-in requests.
  const token = await accessToken();
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as (ScanResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? 'We couldn’t read that image.');
  return body;
}
