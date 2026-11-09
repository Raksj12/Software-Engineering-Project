import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "./db.js";
import { parseToken } from "./auth.js";

const router = Router();

function buyerRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? parseToken(token) : null;

  if (!user) {
    res.status(401).json({ error: "Please log in." });
    return;
  }

  if (user.role !== "buyer") {
    res.status(403).json({ error: "Only buyers can use wishlists." });
    return;
  }

  req.user = user;
  next();
}

router.use(buyerRequired);

// View wishlist
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.author, p.status, p.stock
       FROM wishlists w
       JOIN products p ON w.product_id = p.id
       WHERE w.buyer_id = $1
       ORDER BY w.created_at DESC`,
      [req.user!.id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Add book to wishlist
router.post("/", async (req, res, next) => {
  try {
    const productId = Number(req.body.productId);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      res.status(400).json({ error: "Invalid product ID." });
      return;
    }

    const product = await pool.query(
      "SELECT id, status, stock FROM products WHERE id = $1",
      [productId]
    );

    if (product.rows.length === 0) {
      res.status(404).json({ error: "Book not found." });
      return;
    }

    if (product.rows[0].status !== "approved" || product.rows[0].stock <= 0) {
      res.status(400).json({ error: "This book is unavailable." });
      return;
    }

    const result = await pool.query(
      `INSERT INTO wishlists (buyer_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING product_id`,
      [req.user!.id, productId]
    );

    if (result.rowCount === 0) {
      res.status(409).json({ error: "This book is already in your wishlist." });
      return;
    }

    res.status(201).json({ message: "Book added to wishlist." });
  } catch (error) {
    next(error);
  }
});

// Remove book from wishlist
router.delete("/:productId", async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      res.status(400).json({ error: "Invalid product ID." });
      return;
    }

    const result = await pool.query(
      `DELETE FROM wishlists
       WHERE buyer_id = $1 AND product_id = $2`,
      [req.user!.id, productId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Book is not in your wishlist." });
      return;
    }

    res.json({ message: "Book removed from wishlist." });
  } catch (error) {
    next(error);
  }
});

export default router;
