// Client-side photo prep: resize + compress to <= ~300 KB (webp, or jpeg where webp encode is unsupported).
const MAX_BYTES = 300_000;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // from-image applies EXIF rotation (phone photos)
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

export async function compressImage(file: File): Promise<Blob> {
  const src = await decode(file);
  const sw = "naturalWidth" in src ? src.naturalWidth : src.width;
  const sh = "naturalHeight" in src ? src.naturalHeight : src.height;
  if (!sw || !sh) throw new Error("decode");

  let maxDim = 1280;
  for (let round = 0; round < 4; round++) {
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff"; // flatten transparency for jpeg fallback
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);

    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      let blob = await toBlob(canvas, "image/webp", q);
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    maxDim = Math.round(maxDim * 0.75);
  }
  throw new Error("too_big");
}
