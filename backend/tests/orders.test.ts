import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { createToken } from "../src/auth.js";
import { pool } from "../src/db.js";
import { REFUND_WINDOW_DAYS } from "../src/orders.js";

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

// REQ-035: helpers for orders placed outside the refund window
async function insertOldOrder(refundStatus = "none"): Promise<number> {
  const result = await pool.query(
    `INSERT INTO orders (buyer_id, status, total_amount, shipping_address, refund_status, created_at)
     VALUES ($1, 'delivered', 10, '1 Test Lane', $2, NOW() - make_interval(days => $3::int))
     RETURNING id`,
    [buyer.id, refundStatus, REFUND_WINDOW_DAYS + 1],
  );
  return Number(result.rows[0].id);
}

// Refund requests made after the window has closed are rejected
test("Refund rejects requests outside the return window", async () => {
  const orderId = await insertOldOrder();
  try {
    const response = await sendOrderRequest("POST", `/${orderId}/refund`, true, {
      reason: "Changed my mind",
      refundMethod: "original_payment",
    });

    assert.equal(response.status, 400);
    assert.match(response.data.error, /within \d+ days/);

    const requests = await pool.query("SELECT 1 FROM refund_requests WHERE order_id=$1", [orderId]);
    assert.equal(requests.rowCount, 0);
  } finally {
    await pool.query("DELETE FROM orders WHERE id=$1", [orderId]);
  }
});

// An old order that already has a request reports the duplicate, not the expired window
test("Refund reports duplicate request before expired window", async () => {
  const orderId = await insertOldOrder("requested");
  try {
    const response = await sendOrderRequest("POST", `/${orderId}/refund`, true, {
      reason: "Damaged book",
      refundMethod: "original_payment",
    });

    assert.equal(response.status, 409);
  } finally {
    await pool.query("DELETE FROM orders WHERE id=$1", [orderId]);
  }
});

// Order history tells the buyer whether each order is still inside the window
test("Order history exposes the refund window", async () => {
  const orderId = await insertOldOrder();
  try {
    const response = await sendOrderRequest("GET", "/");

    assert.equal(response.status, 200);
    assert.equal(response.data.refundWindowDays, REFUND_WINDOW_DAYS);
    for (const order of response.data.orders) {
      assert.equal(typeof order.refundWindowOpen, "boolean");
    }
    const oldOrder = response.data.orders.find((order: { id: string | number }) => Number(order.id) === orderId);
    assert.equal(oldOrder.refundWindowOpen, false);
  } finally {
    await pool.query("DELETE FROM orders WHERE id=$1", [orderId]);
  }
});

// REQ-037: each seller on the order is notified about only their own books; other sellers are not
test("Refund request notifies only the sellers on the order", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const makeSeller = async (name: string) => {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, 'test-hash', $2, 'seller', 'approved') RETURNING id`,
      [`${name}-${suffix}@bookhaven.test`, `Test ${name}`],
    );
    return Number(result.rows[0].id);
  };
  const makeBook = async (sellerId: number, title: string) => {
    const result = await pool.query(
      `INSERT INTO products (seller_id, title, author, price, stock, status)
       VALUES ($1, $2, 'Test Author', 5, 1, 'approved') RETURNING id`,
      [sellerId, title],
    );
    return Number(result.rows[0].id);
  };

  const sellerA = await makeSeller("seller-a");
  const sellerB = await makeSeller("seller-b");
  const bystander = await makeSeller("seller-c");
  let orderId = 0;
  try {
    const bookA = await makeBook(sellerA, `Alpha ${suffix}`);
    const bookB = await makeBook(sellerB, `Beta ${suffix}`);
    await makeBook(bystander, `Gamma ${suffix}`);
    const order = await pool.query(
      `INSERT INTO orders (buyer_id, status, total_amount, shipping_address)
       VALUES ($1, 'delivered', 10, '1 Test Lane') RETURNING id`,
      [buyer.id],
    );
    orderId = Number(order.rows[0].id);
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, seller_id, quantity, unit_price)
       VALUES ($1, $2, $3, 1, 5), ($1, $4, $5, 1, 5)`,
      [orderId, bookA, sellerA, bookB, sellerB],
    );

    const response = await sendOrderRequest("POST", `/${orderId}/refund`, true, {
      reason: "Damaged book",
      refundMethod: "original_payment",
    });
    assert.equal(response.status, 201);

    const notices = async (sellerId: number) =>
      (await pool.query("SELECT message FROM notifications WHERE user_id=$1", [sellerId])).rows.map((row) => row.message as string);

    const [aNotices, bNotices, cNotices] = await Promise.all([notices(sellerA), notices(sellerB), notices(bystander)]);
    assert.equal(aNotices.length, 1);
    assert.match(aNotices[0], new RegExp(`order #${orderId}.*Alpha ${suffix}.*Damaged book`));
    assert.doesNotMatch(aNotices[0], /Beta/);
    assert.equal(bNotices.length, 1);
    assert.match(bNotices[0], new RegExp(`Beta ${suffix}`));
    assert.doesNotMatch(bNotices[0], /Alpha/);
    assert.equal(cNotices.length, 0);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%order #${orderId}:%`]);
      await pool.query("DELETE FROM orders WHERE id=$1", [orderId]);
    }
    await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [[sellerA, sellerB, bystander]]);
  }
});
