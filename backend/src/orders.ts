import { Router } from "express";
import { pool } from "./db.js";
import { createNotification, notifyAdmins } from "./notifications.js";

export const ordersRouter = Router();

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
// REQ-035: refund requests are only accepted within this many days of the order date.
const parsedRefundWindow = Number(process.env.REFUND_WINDOW_DAYS);
export const REFUND_WINDOW_DAYS = Number.isInteger(parsedRefundWindow) && parsedRefundWindow > 0 ? parsedRefundWindow : 30;
const TAX_RATES: Record<string, number> = {
  AL: 0.04, AK: 0, AZ: 0.056, AR: 0.065, CA: 0.0725, CO: 0.029, CT: 0.0635, DE: 0,
  FL: 0.06, GA: 0.04, HI: 0.04, ID: 0.06, IL: 0.0625, IN: 0.07, IA: 0.06, KS: 0.065,
  KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06, MA: 0.0625, MI: 0.06, MN: 0.06875,
  MS: 0.07, MO: 0.04225, MT: 0, NE: 0.055, NV: 0.0685, NH: 0, NJ: 0.06625,
  NM: 0.05, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575, OK: 0.045, OR: 0,
  PA: 0.06, RI: 0.07, SC: 0.06, SD: 0.045, TN: 0.07, TX: 0.0625, UT: 0.0485,
  VT: 0.06, VA: 0.043, WA: 0.065, WV: 0.06, WI: 0.05, WY: 0.04,
};

function clientIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (value || req.socket.remoteAddress || "").trim() || null;
}

function resolveTaxState(req: Parameters<typeof clientIp>[0], requestedState: unknown): string {
  const requested = text(requestedState).toUpperCase();
  const ip = clientIp(req);
  const configured = process.env.IP_STATE_MAP?.split(",").map((entry) => entry.trim().split(":"));
  const mapped = configured?.find(([address]) => address === ip)?.[1]?.toUpperCase();
  const state = mapped || requested;
  if (!Object.prototype.hasOwnProperty.call(TAX_RATES, state)) {
    throw new Error("A valid two-letter US state is required for tax calculation.");
  }
  return state;
}

ordersRouter.get("/checkout-summary", async (req, res) => {
  let taxState: string;
  try { taxState = resolveTaxState(req, req.query.taxState); } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "A valid tax state is required." }); return;
  }
  const useStoreCredit = req.query.useStoreCredit === "true";
  const result = await pool.query(
    `SELECT p.id, p.title, p.author, p.price, p.status, p.stock, ci.quantity
     FROM carts c
     JOIN cart_items ci ON ci.cart_id=c.id
     JOIN products p ON p.id=ci.product_id
     WHERE c.buyer_id=$1 ORDER BY p.title, p.id`,
    [req.user!.id],
  );
  // REQ-030: flag anything checkout would reject, so the buyer sees it during review rather than after submitting.
  const itemIssue = (item: { status: string; stock: number; quantity: number }): string | null => {
    if (item.status !== "approved") return "No longer available";
    if (item.stock < item.quantity) return item.stock > 0 ? `Only ${item.stock} left in stock` : "Out of stock";
    return null;
  };
  const subtotal = Number(result.rows.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0).toFixed(2));
  const taxRate = TAX_RATES[taxState];
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));
  const account = await pool.query("SELECT store_credit FROM users WHERE id=$1", [req.user!.id]);
  const availableCredit = Number(account.rows[0]?.store_credit || 0);
  const storeCreditApplied = useStoreCredit ? Math.min(availableCredit, total) : 0;
  const items = result.rows.map((item) => ({
    productId: Number(item.id),
    title: item.title,
    author: item.author,
    quantity: item.quantity,
    unitPrice: Number(item.price).toFixed(2),
    lineTotal: (Number(item.price) * Number(item.quantity)).toFixed(2),
    issue: itemIssue(item),
  }));
  res.json({
    items,
    canCheckout: items.length > 0 && items.every((item) => item.issue === null),
    subtotal: subtotal.toFixed(2),
    taxState,
    taxRate,
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
    availableCredit: availableCredit.toFixed(2),
    storeCreditApplied: storeCreditApplied.toFixed(2),
    paymentDue: (total - storeCreditApplied).toFixed(2),
  });
});

ordersRouter.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT o.id, o.status, o.total_amount AS "totalAmount", o.shipping_address AS "shippingAddress",
            o.refund_status AS "refundStatus", o.refund_reason AS "refundReason", o.created_at AS "createdAt",
            o.created_at + make_interval(days => $2::int) AS "refundDeadline",
            (o.created_at > NOW() - make_interval(days => $2::int)) AS "refundWindowOpen",
            COALESCE(json_agg(json_build_object('productId', oi.product_id, 'title', p.title,
              'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'fulfillmentStatus', oi.fulfillment_status,
              'cancelReason', oi.cancel_reason, 'refundAmount', oi.refund_amount))
              FILTER (WHERE oi.product_id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
     WHERE o.buyer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user!.id, REFUND_WINDOW_DAYS],
  );
  res.json({ orders: result.rows, refundWindowDays: REFUND_WINDOW_DAYS });
});

ordersRouter.post("/:orderId/refund", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const reason = text(req.body?.reason);
  const refundMethod = req.body?.refundMethod === "store_credit" ? "store_credit" : req.body?.refundMethod === "original_payment" ? "original_payment" : "";
  if (!Number.isInteger(orderId) || orderId < 1 || !reason || !refundMethod) {
    res.status(400).json({ error: "A valid order, refund reason, and refund method are required." }); return;
  }
  // REQ-037: the request, the order status change, and the seller notifications commit together,
  // so a request can never exist without its sellers having been told about it.
  const client = await pool.connect();
  let refund: Record<string, unknown> | undefined;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO refund_requests (order_id,buyer_id,reason,refund_method,refund_amount)
       SELECT id,buyer_id,$3,$4,
              total_amount - COALESCE((SELECT SUM(refund_amount) FROM order_items WHERE order_id=orders.id), 0)
       FROM orders
       WHERE id=$1 AND buyer_id=$2 AND status IN ('paid','processing','shipped','delivered')
         AND refund_status='none'
         AND created_at > NOW() - make_interval(days => $5::int)
       RETURNING id, order_id AS "orderId", status, reason, created_at AS "createdAt"`,
      [orderId, req.user!.id, reason, refundMethod, REFUND_WINDOW_DAYS],
    );
    refund = result.rows[0];
    if (refund) {
      await client.query("UPDATE orders SET refund_status='requested', refund_reason=$2, updated_at=NOW() WHERE id=$1", [orderId, reason]);
      // Look up each seller on the order along with only their own books, so each notice names what concerns them.
      const sellers = await client.query(
        `SELECT oi.seller_id AS "sellerId", array_agg(p.title ORDER BY p.title) AS titles
         FROM order_items oi JOIN products p ON p.id=oi.product_id
         WHERE oi.order_id=$1 GROUP BY oi.seller_id`,
        [orderId],
      );
      for (const seller of sellers.rows as { sellerId: string; titles: string[] }[]) {
        const books = seller.titles.map((title) => `"${title}"`).join(", ");
        await client.query(
          "INSERT INTO notifications (user_id, message) VALUES ($1, $2)",
          [seller.sellerId, `Refund requested for order #${orderId} (your items: ${books}): ${reason}`],
        );
      }
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (!refund) {
    // Work out why the insert matched nothing. Expiry is computed with the DB clock so it agrees with the INSERT guard.
    const existing = await pool.query(
      `SELECT buyer_id AS "buyerId", refund_status AS "refundStatus", status,
              created_at + make_interval(days => $2::int) AS deadline,
              created_at <= NOW() - make_interval(days => $2::int) AS expired
       FROM orders WHERE id=$1`,
      [orderId, REFUND_WINDOW_DAYS],
    );
    const order = existing.rows[0];
    if (!order || Number(order.buyerId) !== req.user!.id) { res.status(404).json({ error: "Order not found." }); return; }
    if (order.refundStatus !== "none" || !["paid", "processing", "shipped", "delivered"].includes(order.status)) {
      res.status(409).json({ error: "This order is not eligible or already has a refund request." }); return;
    }
    if (order.expired) {
      const deadline = new Date(order.deadline).toISOString().slice(0, 10);
      res.status(400).json({ error: `Refund requests must be made within ${REFUND_WINDOW_DAYS} days of the order (deadline was ${deadline}).` }); return;
    }
    res.status(409).json({ error: "This order is not eligible or already has a refund request." }); return;
  }
  await notifyAdmins(`Buyer #${req.user!.id} requested a return/refund for order #${orderId}: ${reason}`);
  res.status(201).json({ refund });
});

ordersRouter.patch("/:orderId", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const shippingAddress = text(req.body?.shippingAddress);
  if (!Number.isInteger(orderId) || orderId < 1 || !shippingAddress) {
    res.status(400).json({ error: "A valid order and shipping address are required." });
    return;
  }
  const result = await pool.query(
    `UPDATE orders SET shipping_address=$1, updated_at=NOW()
     WHERE id=$2 AND buyer_id=$3 AND status='paid' AND refund_status='none'
     RETURNING id, shipping_address AS "shippingAddress"`,
    [shippingAddress, orderId, req.user!.id],
  );
  if (!result.rowCount) {
    res.status(409).json({ error: "Only paid orders without a return or refund request can be edited." });
    return;
  }
  await notifyAdmins(`Buyer #${req.user!.id} edited the shipping address for order #${orderId}.`);
  res.json({ order: result.rows[0], message: "Order shipping address updated." });
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
  let taxState: string;
  try { taxState = resolveTaxState(req, body.taxState); } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "A valid tax state is required." }); return;
  }

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
    const subtotal = Number(price) * quantity;
    const taxRate = TAX_RATES[taxState];
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const total = subtotal + taxAmount;

    const order = await client.query(
      `INSERT INTO orders (buyer_id, status, total_amount, shipping_address, tax_state, tax_rate, tax_amount, ip_address)
       VALUES ($1, 'paid', $2, $3, $4, $5, $6, $7) RETURNING id, created_at AS "createdAt"`,
      [req.user!.id, total, shippingAddress, taxState, taxRate, taxAmount, clientIp(req)],
    );
    const orderId = order.rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, seller_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, productId, sellerId, quantity, price],
    );
    await client.query("COMMIT");

    await createNotification(sellerId, `New order #${orderId}: ${quantity} x "${title}".`);
    await notifyAdmins(`Buyer #${req.user!.id} placed order #${orderId} for ${quantity} x "${title}".`);

    res.status(201).json({
      order: {
        id: orderId,
        title,
        quantity,
        unitPrice: price,
        total: total.toFixed(2),
        subtotal: subtotal.toFixed(2),
        taxState,
        taxRate,
        taxAmount: taxAmount.toFixed(2),
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
  const useStoreCredit = req.body?.useStoreCredit === true;
  let taxState: string;
  try { taxState = resolveTaxState(req, req.body?.taxState); } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "A valid tax state is required." }); return;
  }
  if (!shippingAddress) { res.status(400).json({ error: "Shipping address is required." }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cart = await client.query(
      `SELECT ci.product_id AS "productId", ci.quantity, p.title, p.price, p.stock,
              p.seller_id AS "sellerId", p.status
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
      // A listing can leave the storefront after it was carted (e.g. re-review after a material edit, REQ-010).
      if (item.status !== "approved") {
        await client.query("ROLLBACK");
        res.status(409).json({ error: `"${item.title}" is not currently available. Remove it from your cart to continue.` });
        return;
      }
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

    const subtotal = cart.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const taxRate = TAX_RATES[taxState];
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const total = subtotal + taxAmount;
    // REQ-030: the buyer approves a specific total on the review step. If prices or the cart changed since,
    // refuse rather than charge an amount they never saw.
    const expectedTotal = req.body?.expectedTotal;
    if (expectedTotal !== undefined && Math.abs(Number(expectedTotal) - Number(total.toFixed(2))) >= 0.005) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: `Your order total changed to $${total.toFixed(2)} since you reviewed it. Please review your order again.`,
        code: "TOTAL_CHANGED",
      });
      return;
    }
    const account = await client.query(
      "SELECT store_credit FROM users WHERE id=$1 FOR UPDATE",
      [req.user!.id],
    );
    const availableCredit = Number(account.rows[0]?.store_credit || 0);
    const storeCreditApplied = useStoreCredit ? Math.min(availableCredit, total) : 0;
    const paymentAmount = Number((total - storeCreditApplied).toFixed(2));
    if (paymentAmount > 0) {
      const invalidCard = cardError(req.body?.card ?? {});
      if (invalidCard) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: invalidCard });
        return;
      }
    }
    if (storeCreditApplied > 0) {
      await client.query(
        "UPDATE users SET store_credit=store_credit-$1, updated_at=NOW() WHERE id=$2",
        [storeCreditApplied, req.user!.id],
      );
    }
    const order = await client.query(
      `INSERT INTO orders (buyer_id, status, total_amount, shipping_address, tax_state, tax_rate, tax_amount, ip_address,
                           store_credit_applied, payment_amount)
       VALUES ($1, 'paid', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at AS "createdAt"`,
      [req.user!.id, total, shippingAddress, taxState, taxRate, taxAmount, clientIp(req), storeCreditApplied, paymentAmount],
    );

    for (const item of cart.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.rows[0].id, item.productId, item.sellerId, item.quantity, item.price],
      );

      await createNotification(item.sellerId, `New order #${order.rows[0].id}: ${item.quantity} x "${item.title}".`);
    }
    await notifyAdmins(`Buyer #${req.user!.id} placed cart order #${order.rows[0].id} with ${cart.rows.length} listing(s).`);

    await client.query(
      "DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE buyer_id = $1)",
      [req.user!.id],
    );
    await client.query("COMMIT");

    res.status(201).json({
      order: {
        id: order.rows[0].id,
        total: total.toFixed(2),
        subtotal: subtotal.toFixed(2),
        taxState,
        taxRate,
        taxAmount: taxAmount.toFixed(2),
        storeCreditApplied: storeCreditApplied.toFixed(2),
        paymentAmount: paymentAmount.toFixed(2),
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