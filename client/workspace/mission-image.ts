import { MAX_MISSION_IMAGE_BYTES, MAX_MISSION_IMAGE_EDGE } from "../../shared/mission-image.js";

/** Keep uploads within the existing document request limit before sending to the server. */
export async function prepareMissionImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)
    throw new Error("Choose a PNG, JPEG or WebP image up to 10 MB.");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This image could not be opened. Choose another image."); });
  try {
    if (bitmap.width * bitmap.height > 16_000_000) throw new Error("Choose an image with at most 16 million pixels.");
    const scale = Math.min(1, MAX_MISSION_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable. Try another browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.85);
    if (!result.startsWith("data:image/webp;base64,") || result.length > Math.ceil(MAX_MISSION_IMAGE_BYTES / 3) * 4 + 23)
      throw new Error("This image is too detailed to save. Choose a smaller or simpler image.");
    return result;
  } finally { bitmap.close(); }
}
