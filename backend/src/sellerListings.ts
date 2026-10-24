import { Router } from "express";
import { pool } from "./db.js";
import { isValidIsbn } from "./isbn.js";
import { detectImageType, saveImage, uploadImage } from "./images.js";

export const sellerListingsRouter = Router();

const CONDITIONS = ["new", "used"];

const LISTING_COLUMNS = `id, title, author, isbn, genre, condition, description, price, stock,
  image_path AS "imagePath", status, rejection_reason AS "rejectionReason", created_at AS "createdAt"`;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

// The logged-in seller's own listings, in every review state
sellerListingsRouter.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT ${LISTING_COLUMNS} FROM products WHERE seller_id = $1 ORDER BY created_at DESC`,
    [req.user!.id],
  );
  res.json({ listings: result.rows });
});

// New listings start as pending until an admin approves them.
// Sent as multipart/form-data so an optional cover image can be included.
sellerListingsRouter.post("/", uploadImage, async (req, res) => {
  const body = req.body ?? {};
  const title = text(body.title);
  const author = text(body.author);
  const isbn = text(body.isbn).replace(/[-\s]/g, "");
  const genre = text(body.genre);
  const condition = text(body.condition).toLowerCase();
  const description = text(body.description);
  const price = text(String(body.price ?? "")) === "" ? NaN : Number(body.price);
  const stock = text(String(body.stock ?? "")) === "" ? NaN : Number(body.stock);

  if (!title || !author || !genre || !description) {
    res.status(400).json({ error: "Title, author, genre, and description are required." });
    return;
  }
  if (!isValidIsbn(isbn)) {
    res.status(400).json({ error: "Invalid ISBN. Enter a valid ISBN-10 or ISBN-13." });
    return;
  }
  if (!CONDITIONS.includes(condition)) {
    res.status(400).json({ error: "Condition must be new or used." });
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Price must be a number of 0 or more." });
    return;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    res.status(400).json({ error: "Stock must be a whole number of 0 or more." });
    return;
  }

  const imageType = req.file ? detectImageType(req.file.buffer) : null;
  if (req.file && !imageType) {
    res.status(400).json({ error: "Cover image must be a JPEG, PNG, or WebP file." });
    return;
  }

  // Save the image and the listing together so neither is left behind on failure
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const imagePath = req.file && imageType ? await saveImage(client, req.file.buffer, imageType, req.user!.id) : null;
    const result = await client.query(
      `INSERT INTO products (seller_id, title, author, isbn, genre, condition, description, price, stock, image_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING ${LISTING_COLUMNS}`,
      [req.user!.id, title, author, isbn, genre, condition, description, price, stock, imagePath],
    );
    await client.query("COMMIT");
    res.status(201).json({ listing: result.rows[0], message: "Listing submitted for admin review." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
