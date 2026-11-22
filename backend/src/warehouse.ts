import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";

export const warehouseRouter = Router();

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function warehouseSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function sendWarehouseEvent(sellerId: number, event: string, data: Record<string, unknown>): Promise<void> {
  const result = await pool.query(
    "SELECT endpoint_url AS \"endpointUrl\", signing_secret AS \"signingSecret\" FROM seller_webhooks WHERE seller_id=$1 AND enabled=TRUE",
    [sellerId],
  );
  if (!result.rowCount) return;

  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    event,
    createdAt: new Date().toISOString(),
    data,
  });
  const secret = result.rows[0].signingSecret;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(result.rows[0].endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BookHaven-Event": event,
        "X-BookHaven-Signature": `sha256=${warehouseSignature(payload, secret)}`,
      },
      body: payload,
      signal: controller.signal,
    });
  } catch {
    // Webhook delivery is asynchronous from the storefront operation and must never break an order update.
  } finally {
    clearTimeout(timeout);
  }
}

warehouseRouter.get("/config", async (req, res) => {
  const result = await pool.query(
    `SELECT endpoint_url AS "endpointUrl", signing_secret AS "signingSecret", enabled, updated_at AS "updatedAt"
     FROM seller_webhooks WHERE seller_id=$1`,
    [req.user!.id],
  );
  if (!result.rowCount) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    endpointUrl: result.rows[0].endpointUrl,
    enabled: result.rows[0].enabled,
    updatedAt: result.rows[0].updatedAt,
  });
});

warehouseRouter.put("/config", async (req, res) => {
  const endpointUrl = typeof req.body?.endpointUrl === "string" ? req.body.endpointUrl.trim() : "";
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : true;
  if (!validHttpUrl(endpointUrl) || endpointUrl.length > 2048) {
    res.status(400).json({ error: "Endpoint must be a valid HTTPS URL (HTTP is allowed only for localhost)." });
    return;
  }
  const signingSecret = typeof req.body?.signingSecret === "string" && req.body.signingSecret.trim()
    ? req.body.signingSecret.trim()
    : crypto.randomBytes(32).toString("hex");
  if (signingSecret.length < 16 || signingSecret.length > 256) {
    res.status(400).json({ error: "Signing secret must contain 16 to 256 characters." });
    return;
  }
  const result = await pool.query(
    `INSERT INTO seller_webhooks (seller_id, endpoint_url, signing_secret, enabled)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (seller_id) DO UPDATE SET endpoint_url=EXCLUDED.endpoint_url,
       signing_secret=EXCLUDED.signing_secret, enabled=EXCLUDED.enabled, updated_at=NOW()
     RETURNING endpoint_url AS "endpointUrl", signing_secret AS "signingSecret", enabled, updated_at AS "updatedAt"`,
    [req.user!.id, endpointUrl, signingSecret, enabled],
  );
  res.json({ configured: true, ...result.rows[0] });
});

warehouseRouter.post("/test", async (req, res) => {
  const result = await pool.query(
    "SELECT endpoint_url AS \"endpointUrl\", signing_secret AS \"signingSecret\", enabled FROM seller_webhooks WHERE seller_id=$1",
    [req.user!.id],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Configure a warehouse webhook first." });
    return;
  }
  if (!result.rows[0].enabled) {
    res.status(409).json({ error: "Warehouse webhook is disabled." });
    return;
  }
  await sendWarehouseEvent(req.user!.id, "warehouse.test", { sellerId: req.user!.id, message: "BookHaven webhook test" });
  res.json({ ok: true, message: "Test event sent to the configured warehouse." });
});
