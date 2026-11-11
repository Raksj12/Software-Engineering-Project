import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "./db.js";
import { createNotification } from "./notifications.js";

export const ordersRouter = Router();

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

ordersRouter.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT o.id, o.status, o.total_amount AS "totalAmount", o.shipping_address AS "shippingAddress",
            o.refund_status AS "refundStatus", o.refund_reason AS "refundReason", o.created_at AS "createdAt",
            COALESCE(json_agg(json_build_object('productId', oi.product_id, 'title', p.title,
              'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'fulfillmentStatus', oi.fulfillment_status))
              FILTER (WHERE oi.product_id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
     WHERE o.buyer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user!.id],
  );
  res.json({ orders: result.rows });
});

ordersRouter.post("/:orderId/refund", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const reason = text(req.body?.reason);
  if (!Number.isInteger(orderId) || orderId < 1 || !reason) {
    res.status(400).json({ error: "A valid order and refund reason are required." }); return;
  }
  const result = await pool.query(
    `INSERT INTO refund_requests (order_id,buyer_id,reason)
     SELECT id,buyer_id,$3 FROM orders
     WHERE id=$1 AND buyer_id=$2 AND status IN ('paid','processing','shipped','delivered')
       AND refund_status='none'
     RETURNING id, order_id AS "orderId", status, reason, created_at AS "createdAt"`,
    [orderId, req.user!.id, reason],
  );
  if (!result.rowCount) {
    const existing = await pool.query("SELECT buyer_id, refund_status, status FROM orders WHERE id=$1", [orderId]);
    if (!existing.rowCount || existing.rows[0].buyer_id !== req.user!.id) { res.status(404).json({ error: "Order not found." }); return; }
    res.status(409).json({ error: "This order is not eligible or already has a refund request." }); return;
  }
  await pool.query("UPDATE orders SET refund_status='requested', refund_reason=$2, updated_at=NOW() WHERE id=$1", [orderId, reason]);
  res.status(201).json({ refund: result.rows[0] });
});

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
       RETURNING title, price, stock, seller_id AS "sellerId", listing_type AS "listingType", digital_url AS "digitalUrl"`,
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

    const { title, price, stock, sellerId, listingType, digitalUrl } = product.rows[0];
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
    if (listingType === "digital") {
      await client.query(
        "INSERT INTO digital_deliveries (order_id, product_id, buyer_id, access_token) VALUES ($1,$2,$3,$4)",
        [orderId, productId, req.user!.id, randomUUID()],
      );
    }

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

ordersRouter.post("/checkout", async (req, res) => {
  const shippingAddress = text(req.body?.shippingAddress);
  const invalidCard = cardError(req.body?.card ?? {});
  if (!shippingAddress) { res.status(400).json({ error: "Shipping address is required." }); return; }
  if (invalidCard) { res.status(400).json({ error: invalidCard }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cart = await client.query(
      `SELECT ci.product_id AS "productId", ci.quantity, p.title, p.price, p.stock,
              p.seller_id AS "sellerId", p.listing_type AS "listingType"
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN products p ON p.id = ci.product_id
       WHERE c.buyer_id = $1
       FOR UPDATE`,
      [req.user!.id],
    );

    if (!cart.rowCount) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Cart is empty." });
      return;
    }

    for (const item of cart.rows) {
      if (item.stock < item.quantity) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: `Only ${item.stock} left for ${item.title}.` });
        return;
      }
      await client.query(
        "UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2",
        [item.quantity, item.productId],
      );
    }

    const total = cart.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const order = await client.query(
      `INSERT INTO orders (buyer_id, status, total_amount, shipping_address)
       VALUES ($1, 'paid', $2, $3)
       RETURNING id, created_at AS "createdAt"`,
      [req.user!.id, total, shippingAddress],
    );

    for (const item of cart.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.rows[0].id, item.productId, item.sellerId, item.quantity, item.price],
      );

      if (item.listingType === "digital") {
        await client.query(
          `INSERT INTO digital_deliveries (order_id, product_id, buyer_id, access_token)
           VALUES ($1, $2, $3, $4)`,
          [order.rows[0].id, item.productId, req.user!.id, randomUUID()],
        );
        await createNotification(item.sellerId, `Digital order #${order.rows[0].id} was fulfilled automatically.`);
      }

      await createNotification(item.sellerId, `New order #${order.rows[0].id}: ${item.quantity} x "${item.title}".`);
    }

    await client.query(
      "DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE buyer_id = $1)",
      [req.user!.id],
    );
    await client.query("COMMIT");

    res.status(201).json({
      order: {
        id: order.rows[0].id,
        total: total.toFixed(2),
        shippingAddress,
        createdAt: order.rows[0].createdAt,
      },
      message: "Your order has been placed.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
