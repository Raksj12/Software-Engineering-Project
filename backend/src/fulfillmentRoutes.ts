import { Router, type Request, type Response } from "express";
import { pool } from "./db.js";
import { createNotification } from "./notifications.js";

export const fulfillmentRouter = Router();

fulfillmentRouter.get("/refunds", async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT rr.id, rr.order_id AS "orderId", rr.reason, rr.status, rr.created_at AS "createdAt",
            o.buyer_id AS "buyerId", o.total_amount AS "totalAmount"
     FROM refund_requests rr JOIN orders o ON o.id=rr.order_id
     JOIN order_items oi ON oi.order_id=o.id
     WHERE oi.seller_id=$1 ORDER BY rr.created_at DESC`, [req.user!.id],
  );
  res.json({ refunds: result.rows });
});

fulfillmentRouter.post("/refunds/:id/:decision", async (req, res) => {
  const decision = req.params.decision === "approve" ? "approved" : req.params.decision === "reject" ? "rejected" : "";
  const refundId = Number(req.params.id);
  if (!decision || !Number.isInteger(refundId) || refundId < 1) { res.status(400).json({ error: "Invalid refund decision." }); return; }
  const result = await pool.query(
    `UPDATE refund_requests rr SET status=$1, reviewed_by=$2, reviewed_at=NOW()
     WHERE rr.id=$3 AND rr.status='requested'
       AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id=rr.order_id AND oi.seller_id=$2)
     RETURNING rr.order_id AS "orderId", rr.buyer_id AS "buyerId"`, [decision, req.user!.id, refundId],
  );
  if (!result.rowCount) { res.status(409).json({ error: "Refund not found, not yours, or already reviewed." }); return; }
  const row = result.rows[0];
  if (decision === "approved") {
    await pool.query("UPDATE orders SET refund_status='approved', status='refunded', refunded_at=NOW(), updated_at=NOW() WHERE id=$1", [row.orderId]);
  } else {
    await pool.query("UPDATE orders SET refund_status='rejected', updated_at=NOW() WHERE id=$1", [row.orderId]);
  }
  await createNotification(row.buyerId, `Refund request for order #${row.orderId} was ${decision}.`);
  res.json({ ok: true, status: decision });
});

// Seller sees only items from their own listings, once the order is paid (not 'pending').
fulfillmentRouter.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT oi.order_id AS "orderId", oi.product_id AS "productId", p.title, oi.quantity,
            oi.unit_price AS "unitPrice", oi.fulfillment_status AS "fulfillmentStatus",
            oi.carrier, oi.tracking_number AS "trackingNumber", oi.cancel_reason AS "cancelReason",
            o.shipping_address AS "shippingAddress", o.status AS "paymentStatus", o.created_at AS "createdAt"
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE oi.seller_id = $1 AND o.status <> 'pending'
     ORDER BY o.created_at DESC`,
    [req.user!.id],
  );
  res.json({ items: result.rows });
});

async function moveItem(
  req: Request,
  res: Response,
  from: string[],
  to: string,
  extra: { carrier?: string; tracking?: string; reason?: string },
  message: (title: string) => string,
): Promise<void> {
  const orderId = Number(req.params.orderId);
  const productId = Number(req.params.productId);
  if (!Number.isInteger(orderId) || !Number.isInteger(productId)) {
    res.status(400).json({ error: "Invalid order or product id." });
    return;
  }
  const result = await pool.query(
    `UPDATE order_items oi
     SET fulfillment_status = $1,
         carrier = COALESCE($2, oi.carrier),
         tracking_number = COALESCE($3, oi.tracking_number),
         cancel_reason = COALESCE($4, oi.cancel_reason)
     FROM orders o, products p
     WHERE oi.order_id = o.id AND oi.product_id = p.id
       AND oi.order_id = $5 AND oi.product_id = $6
       AND oi.seller_id = $7
       AND oi.fulfillment_status = ANY($8)
       AND o.status <> 'pending'
     RETURNING o.buyer_id AS "buyerId", p.title`,
    [to, extra.carrier ?? null, extra.tracking ?? null, extra.reason ?? null, orderId, productId, req.user!.id, from],
  );
  if (!result.rowCount) {
    res.status(409).json({ error: "Order item not found, not yours, or not in a valid state for this action." });
    return;
  }
  const { buyerId, title } = result.rows[0];
  if (to === "processing") {
    await pool.query("UPDATE orders SET status='processing', updated_at=NOW() WHERE id=$1 AND status IN ('paid','processing')", [orderId]);
  } else if (to === "shipped") {
    await pool.query("UPDATE orders SET status='shipped', updated_at=NOW() WHERE id=$1 AND status IN ('processing','paid')", [orderId]);
  } else if (to === "cancelled") {
    await pool.query("UPDATE orders SET status='cancelled', refund_status='completed', refunded_at=NOW(), updated_at=NOW() WHERE id=$1 AND status NOT IN ('shipped','delivered','refunded')", [orderId]);
  } else if (to === "delivered") {
    await pool.query("UPDATE orders SET status='delivered', updated_at=NOW() WHERE id=$1 AND status='shipped'", [orderId]);
  }
  await createNotification(buyerId, message(title));
  res.json({ ok: true });
}

// pending -> processing
fulfillmentRouter.post("/:orderId/items/:productId/process", async (req, res) => {
  await moveItem(req, res, ["pending"], "processing", {}, (t) => `Your order for "${t}" is being processed.`);
});

// processing -> shipped (carrier + tracking required)
fulfillmentRouter.post("/:orderId/items/:productId/ship", async (req, res) => {
  const carrier = typeof req.body?.carrier === "string" ? req.body.carrier.trim() : "";
  const tracking = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim() : "";
  if (!carrier || !tracking) {
    res.status(400).json({ error: "carrier and trackingNumber are required." });
    return;
  }
  await moveItem(req, res, ["processing"], "shipped", { carrier, tracking },
    (t) => `Your order for "${t}" has shipped via ${carrier}. Tracking: ${tracking}.`);
});

// pending/processing -> cancelled (reason required, not after shipping)
fulfillmentRouter.post("/:orderId/items/:productId/cancel", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    res.status(400).json({ error: "A cancellation reason is required." });
    return;
  }
 
  await moveItem(req, res, ["pending", "processing"], "cancelled", { reason },
    (t) => `Your order for "${t}" was cancelled: ${reason}`);
});

fulfillmentRouter.post("/:orderId/items/:productId/deliver", async (req, res) => {
  await moveItem(req, res, ["shipped"], "delivered", {},
    (t) => `Your order for "${t}" was delivered.`);
});
