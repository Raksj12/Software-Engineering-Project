import { Router } from "express";
import { pool } from "./db.js";

export const searchRouter = Router();

// Column expressions come from this fixed list, never from user input.
const FIELDS: Record<string, string> = {
  title: "p.title",
  author: "p.author",
  genre: "p.genre",
  isbn: "replace(p.isbn, '-', '')",
};

searchRouter.get("/", async (req, res) => {
  const field = typeof req.query.field === "string" ? req.query.field : "title";
  const genre = typeof req.query.genre === "string" ? req.query.genre.trim() : "";
  let q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const column = FIELDS[field];
  if (!column) {
    res.status(400).json({ error: "field must be title, author, genre, or isbn." });
    return;
  }
  if (field === "isbn") q = q.replace(/[-\s]/g, "");

  const params: string[] = [];
  let where = "p.status = 'approved'";
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    where += ` AND ${column} ILIKE $${params.length}`;
  }
  if (genre) {
    params.push(genre);
    where += ` AND lower(p.genre) = lower($${params.length})`;
  }
  const result = await pool.query(
    `SELECT p.id, p.title, p.author, p.isbn, p.genre, p.condition, p.price, p.stock,
            p.image_path AS "imagePath", (p.stock = 0) AS "outOfStock", u.full_name AS "sellerName"
     FROM products p JOIN users u ON u.id = p.seller_id
     WHERE ${where} ORDER BY p.title ASC`,
    params,
  );
  res.json({
    products: result.rows,
    message: result.rows.length ? undefined : "No results found.",
  });
});

searchRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  const result = await pool.query(
    `SELECT p.id, p.title, p.author, p.isbn, p.genre, p.condition, p.description, p.price, p.stock,
            p.image_path AS "imagePath", u.full_name AS "sellerName"
     FROM products p JOIN users u ON u.id = p.seller_id
     WHERE p.id = $1 AND p.status = 'approved'`,
    [id],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  res.json({ product: result.rows[0] });
});