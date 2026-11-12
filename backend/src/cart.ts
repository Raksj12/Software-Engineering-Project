import { Router } from "express";
import { pool } from "./db.js";

const router = Router();
const id = (v: unknown) => Number.isSafeInteger(Number(v)) && Number(v) > 0;

async function cartId(buyerId: number) {
  const result = await pool.query(
    `INSERT INTO carts (buyer_id) VALUES ($1) ON CONFLICT (buyer_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`, [buyerId],
  );
  return result.rows[0].id;
}

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT ci.product_id AS "productId", p.title, p.author, p.price, p.stock,
            p.image_path AS "imagePath", ci.quantity
     FROM carts c JOIN cart_items ci ON ci.cart_id = c.id JOIN products p ON p.id = ci.product_id
     WHERE c.buyer_id = $1 ORDER BY p.title`, [req.user!.id],
  );
  const subtotal = result.rows.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  res.json({ items: result.rows, subtotal: subtotal.toFixed(2) });
});

router.post("/", async (req, res) => {
  const productId = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity ?? 1);
  if (!id(productId) || !Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "A valid product and quantity are required." }); return;
  }
  const product = await pool.query("SELECT stock FROM products WHERE id=$1 AND status='approved'", [productId]);
  if (!product.rowCount) { res.status(404).json({ error: "Product not found." }); return; }
  if (quantity > product.rows[0].stock) { res.status(409).json({ error: "Not enough stock." }); return; }
  const cid = await cartId(req.user!.id);
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`, [cid, productId, quantity],
  );
  res.status(201).json({ ok: true });
});

router.patch("/:productId", async (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body?.quantity);
  if (!id(productId) || !Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be a positive whole number." }); return;
  }
  const result = await pool.query(
    `UPDATE cart_items ci SET quantity=$1 FROM carts c, products p
     WHERE ci.cart_id=c.id AND ci.product_id=p.id AND c.buyer_id=$2 AND ci.product_id=$3
       AND p.status='approved' AND p.stock >= $1 RETURNING ci.product_id AS "productId", ci.quantity`,
    [quantity, req.user!.id, productId],
  );
  if (!result.rowCount) { res.status(409).json({ error: "Cart item not found or quantity exceeds stock." }); return; }
  res.json({ item: result.rows[0] });
});

router.delete("/:productId", async (req, res) => {
  const result = await pool.query(
    `DELETE FROM cart_items ci USING carts c WHERE ci.cart_id=c.id AND c.buyer_id=$1 AND ci.product_id=$2`,
    [req.user!.id, Number(req.params.productId)],
  );
  if (!result.rowCount) { res.status(404).json({ error: "Cart item not found." }); return; }
  res.status(204).send();
});

router.delete("/", async (req, res) => {
  await pool.query("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE buyer_id=$1)", [req.user!.id]);
  res.status(204).send();
});

export default router;
