import { Router } from "express";
import { pool } from "./db.js";
import { isValidIsbn } from "./isbn.js";
import { detectImageType, saveImage, uploadImage } from "./images.js";
import { notifyAdmins } from "./notifications.js";

export const sellerListingsRouter = Router();

const CONDITIONS = ["new", "used"];

const LISTING_COLUMNS = `id, title, author, isbn, genre, condition, description, price, stock,
  image_path AS "imagePath", status, rejection_reason AS "rejectionReason", created_at AS "createdAt"`;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const parsePrice = (value: unknown): number | null => {
  const raw = text(String(value ?? ""));
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const price = Number(raw);
  return Number.isFinite(price) && price > 0 ? price : null;
};

// Returns the canonical genre name from the genres table, or null if it isn't listed
async function canonicalGenre(value: string): Promise<string | null> {
  const result = await pool.query("SELECT name FROM genres WHERE lower(name) = lower($1)", [value]);
  return result.rowCount ? result.rows[0].name : null;
}

// The logged-in seller's own listings, in every review state
sellerListingsRouter.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT ${LISTING_COLUMNS} FROM products WHERE seller_id = $1 ORDER BY created_at DESC`,
    [req.user!.id],
  );
  res.json({ listings: result.rows });
});

sellerListingsRouter.patch("/:id", async (req, res) => {
  const listingId = Number(req.params.id);
  if (!Number.isInteger(listingId) || listingId < 1) { res.status(400).json({ error: "Invalid listing id." }); return; }
  const body = req.body ?? {};
  const title = text(body.title), author = text(body.author), genre = text(body.genre), description = text(body.description);
  const condition = text(body.condition).toLowerCase();
  const price = parsePrice(body.price), stock = Number(body.stock);
  if (!title || !author || !genre || !description) {
    res.status(400).json({ error: "Title, author, genre, and description are required." }); return;
  }
  if (!CONDITIONS.includes(condition)) { res.status(400).json({ error: "Condition must be new or used." }); return; }
  if (price === null) {
    res.status(400).json({ error: "Enter a valid price greater than 0 with no more than two decimal places (for example, 12.99)." }); return;
  }
  if (!Number.isInteger(stock) || stock < 0) { res.status(400).json({ error: "Stock must be a whole number of 0 or more." }); return; }
  const validGenre = await canonicalGenre(genre);
  if (!validGenre) { res.status(400).json({ error: "Please choose a genre from the list." }); return; }
  // ISBN is optional on edit: leaving it out keeps the current one.
  const isbnProvided = body.isbn !== undefined;
  const isbn = isbnProvided ? text(body.isbn).replace(/[-\s]/g, "") : null;
  if (isbnProvided && !isValidIsbn(isbn!)) {
    res.status(400).json({ error: "Invalid ISBN. Enter a valid ISBN-10 or ISBN-13." }); return;
  }

  // REQ-010: a material edit (title, author, description, or ISBN) sends an approved or rejected listing back to
  // pending review and clears any old rejection reason. Price, stock, and other edits keep the listing live.
  // Changes are compared against the locked current row so the check and the update happen atomically.
  const result = await pool.query(
    `WITH current AS (
       SELECT id AS listing_id, status AS previous_status,
              title IS DISTINCT FROM $1 AS title_changed,
              author IS DISTINCT FROM $2 AS author_changed,
              description IS DISTINCT FROM $4 AS description_changed,
              ($10::text IS NOT NULL AND regexp_replace(COALESCE(isbn, ''), '[-[:space:]]', '', 'g') IS DISTINCT FROM $10)
                AS isbn_changed
       FROM products WHERE id=$8 AND seller_id=$9 FOR UPDATE
     ), review AS (
       SELECT *, previous_status IN ('approved', 'rejected') AND (title_changed OR author_changed OR description_changed OR isbn_changed)
                   AS needs_review
       FROM current
     )
     UPDATE products p SET title=$1, author=$2, genre=$3, description=$4, condition=$5, price=$6, stock=$7,
       isbn=COALESCE($10, p.isbn),
       status=CASE WHEN review.needs_review THEN 'pending' ELSE p.status END,
       rejection_reason=CASE WHEN review.needs_review THEN NULL ELSE p.rejection_reason END,
       updated_at=NOW()
     FROM review WHERE p.id=review.listing_id
     RETURNING ${LISTING_COLUMNS}, review.needs_review AS "sentForReview",
       review.title_changed AS "titleChanged", review.author_changed AS "authorChanged",
       review.description_changed AS "descriptionChanged",
       review.isbn_changed AS "isbnChanged"`,
    [title, author, validGenre, description, condition, price, stock, listingId, req.user!.id, isbn],
  );
  if (!result.rowCount) { res.status(404).json({ error: "Listing not found." }); return; }
  const { sentForReview, titleChanged, authorChanged, descriptionChanged, isbnChanged, ...listing } = result.rows[0];
  if (!sentForReview) {
    res.json({ listing, sentForReview: false, message: "Listing updated." });
    return;
  }
  const fields = [titleChanged && "title", authorChanged && "author", descriptionChanged && "description", isbnChanged && "ISBN"]
    .filter((field): field is string => Boolean(field));
  const changed = fields.length > 1 ? `${fields.slice(0, -1).join(", ")} and ${fields[fields.length - 1]}` : fields[0];
  await notifyAdmins(`Seller #${req.user!.id} changed the ${changed} of listing "${listing.title}"; it needs review again.`);
  res.json({
    listing,
    sentForReview: true,
    message: `Listing updated. Because the ${changed} changed, it is hidden from buyers until an admin reviews it again.`,
  });
});

sellerListingsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid listing id." }); return; }
  const result = await pool.query("DELETE FROM products WHERE id=$1 AND seller_id=$2 AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id=$1) RETURNING id", [id, req.user!.id]);
  if (!result.rowCount) { res.status(409).json({ error: "Listing not found or has existing orders." }); return; }
  res.status(204).send();
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
  const price = parsePrice(body.price);
  const stock = text(String(body.stock ?? "")) === "" ? NaN : Number(body.stock);

  if (!title || !author || !genre || !description) {
    res.status(400).json({ error: "Title, author, genre, and description are required." });
    return;
  }
  const validGenre = await canonicalGenre(genre);
  if (!validGenre) {
    res.status(400).json({ error: "Please choose a genre from the list." });
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
  if (price === null) {
    res.status(400).json({ error: "Enter a valid price greater than 0 with no more than two decimal places (for example, 12.99)." });
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
      [req.user!.id, title, author, isbn, validGenre, condition, description, price, stock, imagePath],
    );
    await client.query("COMMIT");
    await notifyAdmins(`Seller #${req.user!.id} submitted listing "${title}" for moderation.`);
    res.status(201).json({ listing: result.rows[0], message: "Listing submitted for admin review." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});