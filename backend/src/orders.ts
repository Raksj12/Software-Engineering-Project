import { Router } from "express";
import { pool } from "./db.js";
import { createNotification } from "./notifications.js";

export const ordersRouter = Router();

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

// Basic format checks only. Real card validation and a payment gateway come later.
// Card details are never stored.
function cardError(card: Record<string, unknown>): string | null {
  const name = text(card.name);
  const number = text(card.number).replace(/[\s-]/g, "");
  const expiry = text(card.expiry);
  const cvv = text(card.cvv);

  if (!name) return "Cardholder name is required.";
  if (!/^\d{12,19}$/.test(number)) return "Card number must be 12 to 19 digits.";
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return "Expiry must be in MM/YY format.";
  if (!/^\d{3,4}$/.test(cvv)) return "CVV must be 3 or 4 digits.";
  return null;
}

// Buy now: one book, paid immediately
ordersRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const productId = Number(body.productId);
  const quantity = Number(body.quantity);
  const shippingAddress = text(body.shippingAddress);

  if (!Number.isInteger(productId) || productId < 1) {
    res.status(400).json({ error: "Invalid book." });
    return;
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be at least 1." });
    return;
  }
  if (!shippingAddress) {
    res.status(400).json({ error: "Shipping address is required." });
    return;
  }
  const invalidCard = cardError(body.card ?? {});
  if (invalidCard) {
    res.status(400).json({ error: invalidCard });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Decrement stock in one statement so two buyers can't buy the same last copy
    const product = await client.query(
      `UPDATE products SET stock = stock - $2, updated_at = NOW()
       WHERE id = $1 AND status = 'approved' AND stock >= $2
       RETURNING title, price, stock, seller_id AS "sellerId"`,
      [productId, quantity],
    );
    if (!product.rowCount) {
      await client.query("ROLLBACK");
      const exists = await pool.query("SELECT stock FROM products WHERE id = $1 AND status = 'approved'", [productId]);
      if (!exists.rowCount) {
        res.status(404).json({ error: "This book is no longer for sale." });
      } else {
        res.status(409).json({ error: `Only ${exists.rows[0].stock} left in stock.` });
      }
      return;
    }

    const { title, price, stock, sellerId } = product.rows[0];
    const total = Number(price) * quantity;

    const order = await client.query(
      `INSERT INTO orders (buyer_id, status, total_amount, shipping_address)
       VALUES ($1, 'paid', $2, $3) RETURNING id, created_at AS "createdAt"`,
      [req.user!.id, total, shippingAddress],
    );
    const orderId = order.rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, seller_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, productId, sellerId, quantity, price],
    );

    await client.query("COMMIT");

    await createNotification(sellerId, `New order #${orderId}: ${quantity} x "${title}".`);

    res.status(201).json({
      order: {
        id: orderId,
        title,
        quantity,
        unitPrice: price,
        total: total.toFixed(2),
        shippingAddress,
        createdAt: order.rows[0].createdAt,
      },
      remainingStock: stock,
      message: "Your order has been placed.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
