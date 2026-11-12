import { Router, type Request, type Response } from "express";
import { pool } from "./db.js";
import { createNotification, notifyAdmins } from "./notifications.js";
import { isValidIsbn } from "./isbn.js";

export const adminRouter = Router();

adminRouter.get("/inbox", async (_req, res) => {
  const result = await pool.query(
    `SELECT id, message, is_read AS "isRead", created_at AS "createdAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [_req.user!.id],
  );
  res.json({ messages: result.rows });
});

async function logAction(adminId: number, action: string, targetType: string, targetId: number, details?: string) {
  await pool.query(
    "INSERT INTO admin_actions (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)",
    [adminId, action, targetType, targetId, details ?? null],
  );
}

const parseId = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id." });
    return null;
  }
  return id;
};

/* ---------- Accounts ---------- */

adminRouter.get("/users", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const result = await pool.query(
    `SELECT id, email, full_name AS "fullName", role, status, created_at AS "createdAt"
     FROM users WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at`,
    [status],
  );
  res.json({ users: result.rows });
});

const setUserStatus = (newStatus: "approved" | "disabled") => async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  const result = await pool.query(
    `UPDATE users SET status = $1, updated_at = NOW()
     WHERE id = $2 AND role <> 'admin' RETURNING id, email, role, status`,
    [newStatus, id],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  await logAction(req.user!.id, newStatus === "approved" ? "approve_user" : "disable_user", "user", id);
  res.json({ user: result.rows[0] });
};
adminRouter.post("/users/:id/approve", setUserStatus("approved"));
adminRouter.post("/users/:id/disable", setUserStatus("disabled"));

/* ---------- Listing moderation ---------- */

const MATCHES = `COALESCE((SELECT array_agg(w.phrase ORDER BY w.phrase) FROM prohibited_words w
  WHERE position(lower(w.phrase) in lower(p.title)) > 0
     OR position(lower(w.phrase) in lower(COALESCE(p.description, ''))) > 0), '{}')`;

const LISTING_COLUMNS = `p.id, p.title, p.author, p.isbn, p.genre, p.condition, p.description, p.price, p.stock,
  p.image_path AS "imagePath", p.status, p.rejection_reason AS "rejectionReason",
  p.created_at AS "createdAt", u.full_name AS "sellerName", ${MATCHES} AS "matchedPhrases"`;

function withFlags(row: any) {
  return { ...row, flagged: row.matchedPhrases.length > 0, isbnValid: isValidIsbn(row.isbn) };
}

// Queue, oldest submission first
adminRouter.get(["/products", "/listings"], async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "pending";
  const result = await pool.query(
    `SELECT ${LISTING_COLUMNS} FROM products p JOIN users u ON u.id = p.seller_id
     WHERE p.status = $1 ORDER BY p.created_at ASC`,
    [status],
  );
  res.json({ listings: result.rows.map(withFlags) });
});

// Detail: listing + prohibited-word scan + ISBN check
adminRouter.get(["/products/:id", "/listings/:id"], async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const result = await pool.query(
    `SELECT ${LISTING_COLUMNS} FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = $1`,
    [id],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  res.json({ listing: withFlags(result.rows[0]) });
});

adminRouter.post(["/products/:id/approve", "/listings/:id/approve"], async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const current = await pool.query(
    `SELECT isbn, seller_id AS "sellerId", title FROM products WHERE id = $1 AND status = 'pending'`,
    [id],
  );
  if (!current.rowCount) {
    res.status(409).json({ error: "Listing not found or not pending review." });
    return;
  }
  const { isbn, sellerId, title } = current.rows[0];
  if (!isValidIsbn(isbn)) {
    res.status(400).json({ error: "Invalid ISBN. Reject this listing instead." });
    return;
  }
  const updated = await pool.query(
    `UPDATE products SET status = 'approved', rejection_reason = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'pending' RETURNING id`,
    [id],
  );
  if (!updated.rowCount) {
    res.status(409).json({ error: "Listing was already reviewed." });
    return;
  }
  await createNotification(sellerId, `Your listing "${title}" was approved.`);
  await logAction(req.user!.id, "approve_product", "product", id);
  res.json({ ok: true });
});

adminRouter.post(["/products/:id/reject", "/listings/:id/reject"], async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    res.status(400).json({ error: "A rejection reason is required." });
    return;
  }
  const updated = await pool.query(
    `UPDATE products SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'pending' RETURNING seller_id AS "sellerId", title`,
    [id, reason],
  );
  if (!updated.rowCount) {
    res.status(409).json({ error: "Listing not found or not pending review." });
    return;
  }
  const { sellerId, title } = updated.rows[0];
  await createNotification(sellerId, `Your listing "${title}" was rejected: ${reason}`);
  await logAction(req.user!.id, "reject_product", "product", id, reason);
  res.json({ ok: true });
});

const setProductStatus = (from: string, to: string, action: string) => async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  const result = await pool.query(
    "UPDATE products SET status = $3, updated_at = NOW() WHERE id = $1 AND status = $2 RETURNING id",
    [id, from, to],
  );
  if (!result.rowCount) {
    res.status(409).json({ error: `Listing not found or not ${from}.` });
    return;
  }
  await logAction(req.user!.id, action, "product", id);
  res.json({ ok: true });
};
adminRouter.post(["/products/:id/disable", "/listings/:id/disable"], setProductStatus("approved", "archived", "disable_product"));
adminRouter.post(["/products/:id/enable", "/listings/:id/enable"], setProductStatus("archived", "approved", "enable_product"));

/* ---------- Prohibited words ---------- */

adminRouter.get("/prohibited-words", async (_req, res) => {
  const result = await pool.query(`SELECT id, phrase, created_at AS "createdAt" FROM prohibited_words ORDER BY phrase`);
  res.json({ words: result.rows });
});

adminRouter.post("/prohibited-words", async (req, res) => {
  const phrase = typeof req.body?.phrase === "string" ? req.body.phrase.trim().toLowerCase() : "";
  if (!phrase) {
    res.status(400).json({ error: "A word or phrase is required." });
    return;
  }
  try {
    const result = await pool.query(
      "INSERT INTO prohibited_words (phrase, created_by) VALUES ($1, $2) RETURNING id, phrase",
      [phrase, req.user!.id],
    );
    await logAction(req.user!.id, "add_prohibited_word", "prohibited_word", result.rows[0].id, phrase);
    res.status(201).json({ word: result.rows[0] });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "That word or phrase is already on the list." });
      return;
    }
    throw error;
  }
});

// Re-scan pending listings against the current list
adminRouter.post("/prohibited-words/rescan", async (req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.title,
            ARRAY(SELECT w.phrase FROM prohibited_words w
                  WHERE position(lower(w.phrase) in lower(p.title)) > 0
                     OR position(lower(w.phrase) in lower(COALESCE(p.description, ''))) > 0
                  ORDER BY w.phrase) AS "matchedPhrases"
     FROM products p WHERE p.status = 'pending' ORDER BY p.created_at ASC`,
  );
  const flagged = result.rows.filter((r) => r.matchedPhrases.length > 0);
  await logAction(req.user!.id, "rescan_pending", "product", 0, `${flagged.length} flagged`);
  res.json({ flaggedCount: flagged.length, listings: flagged });
});

adminRouter.delete("/prohibited-words/:id", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const result = await pool.query("DELETE FROM prohibited_words WHERE id = $1 RETURNING phrase", [id]);
  if (!result.rowCount) {
    res.status(404).json({ error: "Word not found." });
    return;
  }
  await logAction(req.user!.id, "remove_prohibited_word", "prohibited_word", id, result.rows[0].phrase);
  res.status(204).send();
});

adminRouter.get("/orders", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const result = await pool.query(
    `SELECT o.id, o.buyer_id AS "buyerId", u.email AS "buyerEmail", o.status,
            o.total_amount AS "totalAmount", o.shipping_address AS "shippingAddress",
            o.refund_status AS "refundStatus", o.created_at AS "createdAt"
     FROM orders o JOIN users u ON u.id=o.buyer_id
     WHERE ($1::text IS NULL OR o.status=$1) ORDER BY o.created_at DESC`, [status],
  );
  res.json({ orders: result.rows });
});

adminRouter.get("/refunds", async (_req, res) => {
  const result = await pool.query(
    `SELECT rr.id, rr.order_id AS "orderId", rr.buyer_id AS "buyerId", u.email AS "buyerEmail",
            rr.reason, rr.refund_method AS "refundMethod", rr.refund_amount AS "refundAmount",
            rr.status, rr.reviewed_by AS "reviewedBy", rr.created_at AS "createdAt"
     FROM refund_requests rr JOIN users u ON u.id=rr.buyer_id ORDER BY rr.created_at DESC`,
  );
  res.json({ refunds: result.rows });
});

adminRouter.post("/refunds/:id/:decision", async (req, res) => {
  const decision = req.params.decision === "approve" ? "approved" : req.params.decision === "reject" ? "rejected" : "";
  const id = Number(req.params.id);
  if (!decision || !Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid refund decision." }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT rr.order_id AS "orderId", rr.buyer_id AS "buyerId", rr.refund_method AS "refundMethod",
              rr.refund_amount AS "refundAmount"
       FROM refund_requests rr WHERE rr.id=$1 AND rr.status='requested' FOR UPDATE`,
      [id],
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); res.status(409).json({ error: "Refund not found or already reviewed." }); return; }
    const refund = result.rows[0];
    const approved = decision === "approved";
    await client.query(
      `UPDATE refund_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW(),
       processed_at=CASE WHEN $1='completed' THEN NOW() ELSE processed_at END
       WHERE id=$3`,
      [approved ? "completed" : "rejected", req.user!.id, id],
    );
    if (approved) {
      await client.query(
        "UPDATE orders SET refund_status='completed', status='refunded', refunded_at=NOW(), updated_at=NOW() WHERE id=$1",
        [refund.orderId],
      );
      if (refund.refundMethod === "store_credit") {
        await client.query("UPDATE users SET store_credit=store_credit+$1, updated_at=NOW() WHERE id=$2", [refund.refundAmount, refund.buyerId]);
      }
    } else {
      await client.query("UPDATE orders SET refund_status='rejected', updated_at=NOW() WHERE id=$1", [refund.orderId]);
    }
    await client.query("COMMIT");
    const sellers = await pool.query("SELECT DISTINCT seller_id AS \"sellerId\" FROM order_items WHERE order_id=$1", [refund.orderId]);
    const destination = refund.refundMethod === "store_credit" ? "store credit" : "the original payment method";
    await createNotification(refund.buyerId, `Refund for order #${refund.orderId} was ${approved ? `processed to ${destination}` : "rejected"}.`);
    if (approved) {
      for (const seller of sellers.rows) await createNotification(seller.sellerId, `Refund for order #${refund.orderId} was processed and fulfilled.`);
      await notifyAdmins(`Refund for order #${refund.orderId} was processed and fulfilled by an administrator.`);
    }
    await logAction(req.user!.id, `${decision}_refund`, "refund", id, destination);
    res.json({ ok: true, status: approved ? "completed" : "rejected", refundMethod: refund.refundMethod });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

adminRouter.patch("/orders/:id/status", async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  const allowed = ["paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
  if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid order status." }); return; }
  const result = await pool.query(
    `UPDATE orders SET status=$1, updated_at=NOW()
     WHERE id=$2 RETURNING buyer_id AS "buyerId", id, status`,
    [status, id],
  );
  if (!result.rowCount) { res.status(404).json({ error: "Order not found." }); return; }
  await createNotification(result.rows[0].buyerId, `An administrator updated order #${id} to ${status}.`);
  await logAction(req.user!.id, "override_order_status", "order", id, status);
  res.json({ order: result.rows[0] });
});

adminRouter.get("/earnings", async (_req, res) => {
  const result = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity * oi.unit_price) FILTER (WHERE o.status NOT IN ('cancelled','refunded')), 0) AS "grossSales",
            COUNT(DISTINCT o.id) FILTER (WHERE o.status NOT IN ('cancelled','refunded')) AS "orderCount"
     FROM orders o JOIN order_items oi ON oi.order_id=o.id`,
  );
  res.json(result.rows[0]);
});