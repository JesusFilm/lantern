import sharp from "sharp";
import { AccessError } from "./membership.js";
import { DEFAULT_MISSION_IMAGE, MAX_MISSION_IMAGE_BYTES, MAX_MISSION_IMAGE_EDGE } from "../shared/mission-image.js";

/** Decode and re-encode raster uploads; never persist caller-supplied URLs or metadata. */
export async function normalizeMissionImage(value: string | null): Promise<string | null> {
  if (value === null || value === DEFAULT_MISSION_IMAGE) return value;
  const fail = () => new AccessError(400, "Choose a valid PNG, JPEG or WebP image up to 512 KB.");
  if (value.length > Math.ceil(MAX_MISSION_IMAGE_BYTES / 3) * 4 + 40) throw fail();
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw fail();
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length > MAX_MISSION_IMAGE_BYTES || bytes.toString("base64") !== match[2]) throw fail();
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== match[1] || (metadata.pages ?? 1) > 1) throw fail();
    const output = await image.rotate().resize({ width: MAX_MISSION_IMAGE_EDGE, height: MAX_MISSION_IMAGE_EDGE,
      fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (output.length > MAX_MISSION_IMAGE_BYTES) throw fail();
    return `data:image/webp;base64,${output.toString("base64")}`;
  } catch { throw fail(); }
}
