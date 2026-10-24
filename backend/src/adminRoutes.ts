import { Router, type Request, type Response } from "express";
import { pool } from "./db.js";
import { createNotification } from "./notifications.js";
import { isValidIsbn } from "./isbn.js";

export const adminRouter = Router();

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