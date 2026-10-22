import { Router } from "express";
import { pool } from "./db.js";

export async function createNotification(userId: number, message: string): Promise<void> {
  await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [userId, message]);
}

export const notificationsRouter = Router();

notificationsRouter.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT id, message, is_read AS "isRead", created_at AS "createdAt"
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id],
  );
  res.json({ notifications: result.rows });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const result = await pool.query(
    "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id",
    [Number(req.params.id), req.user!.id],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json({ ok: true });
});