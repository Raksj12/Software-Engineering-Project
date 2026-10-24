import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

// Get books the buyer can review
router.get("/eligible", async (req, res, next) => {
  try {
    // Only buyers can see their eligible books
    if (!req.user || req.user.role !== "buyer") {
      res.status(403).json({
        error: "Only logged-in buyers can access this.",
      });
      return;
    }

    // Find delivered books the buyer has not reviewed
    const result = await pool.query(
      `SELECT DISTINCT p.id, p.title
       FROM products p
       JOIN order_items oi ON p.id = oi.product_id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.buyer_id = $1
         AND o.status = 'delivered'
         AND NOT EXISTS (
           SELECT 1
           FROM reviews r
           WHERE r.buyer_id = $1
             AND r.product_id = p.id
         )
       ORDER BY p.title`,
      [req.user.id]
    );

    res.json({ books: result.rows });
  } catch (error) {
    next(error);
  }
});


// Submit a book review
router.post("/", async (req, res, next) => {
  try {
    // Only buyers can submit reviews
    if (!req.user || req.user.role !== "buyer") {
      res.status(403).json({
        error: "Only logged-in buyers can submit reviews.",
      });
      return;
    }

    const { productId, rating, body } = req.body;

    // Make sure all fields are valid
    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      typeof body !== "string" ||
      !body.trim()
    ) {
      res.status(400).json({
        error: "A book, rating from 1 to 5, and written review are required.",
      });
      return;
    }

    // Check if the buyer purchased and received this book
    const purchase = await pool.query(
      `SELECT 1
       FROM orders
       JOIN order_items ON orders.id = order_items.order_id
       WHERE orders.buyer_id = $1
         AND order_items.product_id = $2
         AND orders.status = 'delivered'
       LIMIT 1`,
      [req.user.id, productId]
    );

    if (purchase.rows.length === 0) {
      res.status(403).json({
        error: "You can only review books you have purchased and received.",
      });
      return;
    }

    // Get prohibited phrases from the database
    const prohibitedWords = await pool.query(
      "SELECT phrase FROM prohibited_words"
    );

    // Check if the review contains a prohibited phrase
    const reviewText = body.toLowerCase();

    const prohibited = prohibitedWords.rows.find(
      (row) => reviewText.includes(row.phrase.toLowerCase())
    );

    if (prohibited) {
      res.status(400).json({
        error: "Your review contains prohibited content. Please edit it.",
      });
      return;
    }

    // Check if the buyer already reviewed this book
    const existingReview = await pool.query(
      `SELECT id
       FROM reviews
       WHERE buyer_id = $1
         AND product_id = $2`,
      [req.user.id, productId]
    );

    if (existingReview.rows.length > 0) {
      res.status(409).json({
        error: "You have already reviewed this book.",
      });
      return;
    }

    // Save the rating and review to the database
    const result = await pool.query(
      `INSERT INTO reviews (buyer_id, product_id, rating, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, productId, rating, body.trim()]
    );

    res.status(201).json({
      message: "Review submitted successfully.",
      review: result.rows[0],
    });
  } catch (error: unknown) {
    // Handle duplicate reviews
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "You have already reviewed this book.",
      });
      return;
    }

    next(error);
  }
});

export default router;