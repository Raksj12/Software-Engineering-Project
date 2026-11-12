import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { createToken } from "../src/auth.js";

const buyer = {
  id: 2,
  email: "buyer@bookhaven.test",
  fullName: "Test Buyer",
  role: "buyer" as const,
  status: "approved" as const,
};

const anotherBuyer = {
  id: 999999,
  email: "anotherbuyer@bookhaven.test",
  fullName: "Another Buyer",
  role: "buyer" as const,
  status: "approved" as const,
};

async function sendOrderRequest(
  method: "GET" | "POST",
  path: string,
  loggedIn = true,
  body?: object,
  user = buyer
) {
  const server = app.listen(0);

  try {
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not start test server.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (loggedIn) {
      headers.Authorization = `Bearer ${createToken(user)}`;
    }

    const response = await fetch(
      `http://localhost:${address.port}/api/orders${path}`,
      {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
    );

    const data = await response.json();

    return {
      status: response.status,
      data,
    };
  } finally {
    server.close();
  }
}

// Buyers must log in to view order history
test("Order history requires login", async () => {
  const response = await sendOrderRequest("GET", "/", false);

  assert.equal(response.status, 401);
});

// Buyers can view their order history
test("Buyer can view order history", async () => {
  const response = await sendOrderRequest("GET", "/");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.data.orders));
});

// Buyers should only see their own orders
test("Buyer cannot view another buyer's orders", async () => {
  const response = await sendOrderRequest(
    "GET",
    "/",
    true,
    undefined,
    anotherBuyer
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.data.orders, []);
});

// Buyers must log in to request refunds
test("Refund request requires login", async () => {
  const response = await sendOrderRequest(
    "POST",
    "/1/refund",
    false,
    { reason: "Damaged book" }
  );

  assert.equal(response.status, 401);
});

// Refund requests must include a reason
test("Refund request requires a reason", async () => {
  const response = await sendOrderRequest(
    "POST",
    "/1/refund",
    true,
    { reason: "" }
  );

  assert.equal(response.status, 400);
});

// Invalid order IDs should be rejected
test("Refund rejects invalid order ID", async () => {
  const response = await sendOrderRequest(
    "POST",
    "/-1/refund",
    true,
    { reason: "Damaged book" }
  );

  assert.equal(response.status, 400);
});

// Refunds cannot be requested for missing orders
test("Refund rejects missing orders", async () => {
  const response = await sendOrderRequest(
    "POST",
    "/999999/refund",
    true,
    { reason: "Damaged book", refundMethod: "original_payment" }
  );

  assert.equal(response.status, 404);
});
