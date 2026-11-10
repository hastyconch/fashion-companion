/** Longest side of the stored photo (Claude downsizes anything above ~1568px). */
export const FULL_SIZE = 1600;
/** Longest side of the grid thumbnail (3 columns at 3x on a phone ≈ 400px). */
export const THUMB_SIZE = 480;
const JPEG_QUALITY = 0.85;

/** Scales (width, height) down so the longest side is at most `max`. Never upscales. */
export function fitWithin(width: number, height: number, max: number) {
  if (width <= 0 || height <= 0) throw new Error("Image has no size.");
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export class UnsupportedImageError extends Error {
  constructor() {
    super("This photo format isn't supported here. Try a JPEG or PNG.");
    this.name = "UnsupportedImageError";
  }
}

/**
 * Browser only. Produces the stored photo and its thumbnail as JPEGs.
 * Drawing through a canvas applies the EXIF rotation and drops all metadata,
 * including GPS location. JPEG because iOS Safari can't reliably encode WebP.
 */
export async function preparePhoto(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const image = await loadImage(file);
  const fullCanvas = drawScaled(image, FULL_SIZE);
  const thumbCanvas = drawScaled(fullCanvas, THUMB_SIZE);
  const [full, thumb] = await Promise.all([toJpeg(fullCanvas), toJpeg(thumbCanvas)]);
  return { full, thumb };
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    // Browsers apply EXIF orientation to <img>, so naturalWidth/Height are upright.
    await image.decode();
    return image;
  } catch {
    throw new UnsupportedImageError();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawScaled(source: HTMLImageElement | HTMLCanvasElement, max: number) {
  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const { width, height } = fitWithin(srcWidth, srcHeight, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // White behind transparent PNGs, so they don't turn black as JPEGs.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the photo."))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}
