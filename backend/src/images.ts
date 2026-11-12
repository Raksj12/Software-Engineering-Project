import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { PoolClient } from "pg";
import { pool } from "./db.js";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Files are kept in memory, then saved to the images table. No fileFilter is used:
// the real type is checked from the file's bytes in detectImageType instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single("image");

// Accepts an optional "image" file field on multipart/form-data requests
export function uploadImage(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Cover image must be 2 MB or smaller."
        : "Upload a single cover image in the image field.";
      res.status(400).json({ error: message });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}

// Identify JPEG, PNG, or WebP by their file signatures, not by the name or browser-supplied type
export function detectImageType(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

// Saves the image and returns the URL path it is served from
export async function saveImage(client: PoolClient, data: Buffer, mimeType: string, uploadedBy: number): Promise<string> {
  const result = await client.query(
    "INSERT INTO images (mime_type, data, uploaded_by) VALUES ($1, $2, $3) RETURNING id",
    [mimeType, data, uploadedBy],
  );
  return `/api/images/${result.rows[0].id}`;
}

export const imagesRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Serve a stored image. Ids are random UUIDs, so images can't be listed or guessed.
imagesRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  const result = await pool.query("SELECT mime_type AS \"mimeType\", data FROM images WHERE id = $1", [id]);
  if (!result.rowCount) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  const { mimeType, data } = result.rows[0];
  res.set({
    "Content-Type": mimeType,
    "Content-Length": String(data.length),
    "Cache-Control": "public, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  res.send(data);
});
