import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { warehouseSignature } from "../src/warehouse.js";

async function request(path: string, init: RequestInit = {}) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start test server.");
    return await fetch(`http://localhost:${address.port}${path}`, init);
  } finally {
    server.close();
  }
}

test("Sprint 5 rejects malformed JSON before route work", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(response.status, 400);
});

test("Sprint 5 rejects JSON arrays at mutation endpoints", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "[]",
  });
  assert.equal(response.status, 400);
});

test("Sprint 5 rejects invalid registration input", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "123", fullName: "", role: "admin" }),
  });
  assert.equal(response.status, 400);
});

test("Warehouse signatures are deterministic and secret-specific", () => {
  const payload = '{"event":"warehouse.test"}';
  const first = warehouseSignature(payload, "seller-secret-123");
  assert.equal(first, warehouseSignature(payload, "seller-secret-123"));
  assert.notEqual(first, warehouseSignature(payload, "different-secret"));
  assert.match(first, /^[a-f0-9]{64}$/);
});
