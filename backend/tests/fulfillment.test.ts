import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { createToken } from "../src/auth.js";
import { pool } from "../src/db.js";

// REQ-043: sellers cancel unshipped items and the buyer is refunded for exactly those items.
// Every test builds its own buyer, sellers, books, and orders, and all of it is removed afterwards.

type TestUser = { id: number; email: string; fullName: string; role: "buyer" | "seller"; status: "approved" };

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let buyer: TestUser;
let sellerA: TestUser;
let sellerB: TestUser;
let bookA: number;
let bookB: number;

async function makeUser(name: string, role: TestUser["role"]): Promise<TestUser> {
  const email = `${name}-${suffix}@bookhaven.test`;
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1, 'test-hash', $2, $3, 'approved') RETURNING id`,
    [email, `Test ${name}`, role],
  );
  return { id: Number(result.rows[0].id), email, fullName: `Test ${name}`, role, status: "approved" };
}

async function makeBook(sellerId: number, title: string, price: number): Promise<number> {
  const result = await pool.query(
    `INSERT INTO products (seller_id, title, author, price, stock, status)
     VALUES ($1, $2, 'Test Author', $3, 5, 'approved') RETURNING id`,
    [sellerId, `${title} ${suffix}`, price],
  );
  return Number(result.rows[0].id);
}

// Order with book A ($10, seller A) and book B ($20, seller B) at 10% tax: total $33.00.
async function makeOrder(storeCreditApplied = 0, fulfillmentB = "pending"): Promise<number> {
  const order = await pool.query(
    `INSERT INTO orders (buyer_id, status, total_amount, shipping_address, tax_rate, tax_amount,
                         store_credit_applied, payment_amount)
     VALUES ($1, 'paid', 33, '1 Test Lane', 0.1, 3, $2, $3) RETURNING id`,
    [buyer.id, storeCreditApplied, 33 - storeCreditApplied],
  );
  const orderId = Number(order.rows[0].id);
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, seller_id, quantity, unit_price, fulfillment_status)
     VALUES ($1, $2, $3, 1, 10, 'pending'), ($1, $4, $5, 1, 20, $6)`,
    [orderId, bookA, sellerA.id, bookB, sellerB.id, fulfillmentB],
  );
  return orderId;
}

async function send(user: TestUser, method: "POST", path: string, body: object) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start test server.");
    const response = await fetch(`http://localhost:${address.port}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${createToken(user)}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  } finally {
    server.close();
  }
}

const cancel = (seller: TestUser, orderId: number, productId: number, reason = "Out of stock") =>
  send(seller, "POST", `/seller/orders/${orderId}/items/${productId}/cancel`, { reason });

const orderRow = async (orderId: number) =>
  (await pool.query(`SELECT status, refund_status AS "refundStatus" FROM orders WHERE id=$1`, [orderId])).rows[0];

before(async () => {
  buyer = await makeUser("cancel-buyer", "buyer");
  sellerA = await makeUser("cancel-seller-a", "seller");
  sellerB = await makeUser("cancel-seller-b", "seller");
  bookA = await makeBook(sellerA.id, "Alpha", 10);
  bookB = await makeBook(sellerB.id, "Beta", 20);
});

after(async () => {
  const ids = [buyer.id, sellerA.id, sellerB.id];
  await pool.query("DELETE FROM orders WHERE buyer_id=$1", [buyer.id]);
  await pool.query("DELETE FROM notifications WHERE message LIKE $1 OR message LIKE $2", [`%${suffix}%`, `Buyer #${buyer.id} %`]);
  await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [ids]);
});

test("Cancellation requires a reason", async () => {
  const orderId = await makeOrder();
  const response = await send(sellerA, "POST", `/seller/orders/${orderId}/items/${bookA}/cancel`, { reason: "" });
  assert.equal(response.status, 400);
});

test("Cancelling one item refunds only that item and leaves the order active", async () => {
  const orderId = await makeOrder();
  const stockBefore = (await pool.query("SELECT stock FROM products WHERE id=$1", [bookA])).rows[0].stock;

  const response = await cancel(sellerA, orderId, bookA);

  assert.equal(response.status, 200);
  assert.equal(response.data.orderCancelled, false);
  assert.deepEqual(response.data.refund, { amount: "11.00", storeCredit: "0.00", originalPayment: "11.00" });
  assert.deepEqual(await orderRow(orderId), { status: "paid", refundStatus: "none" });

  const items = await pool.query(
    `SELECT product_id AS "productId", fulfillment_status AS "status", refund_amount AS "refund"
     FROM order_items WHERE order_id=$1 ORDER BY unit_price`,
    [orderId],
  );
  assert.deepEqual(items.rows.map((row) => [Number(row.productId), row.status, row.refund]), [
    [bookA, "cancelled", "11.00"],
    [bookB, "pending", "0.00"],
  ]);
  const stockAfter = (await pool.query("SELECT stock FROM products WHERE id=$1", [bookA])).rows[0].stock;
  assert.equal(stockAfter, stockBefore + 1);

  const notices = await pool.query("SELECT message FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 1", [buyer.id]);
  assert.match(notices.rows[0].message, /cancelled: Out of stock\. You have been refunded \$11\.00/);
});

test("Cancelling the last item cancels the order and returns store credit first", async () => {
  await pool.query("UPDATE users SET store_credit=0 WHERE id=$1", [buyer.id]);
  const orderId = await makeOrder(15);

  const first = await cancel(sellerA, orderId, bookA);
  assert.deepEqual(first.data.refund, { amount: "11.00", storeCredit: "11.00", originalPayment: "0.00" });

  const second = await cancel(sellerB, orderId, bookB);
  assert.equal(second.status, 200);
  assert.equal(second.data.orderCancelled, true);
  // The last item settles the rest of the $33.00 total: $4.00 of remaining credit, $18.00 to the card.
  assert.deepEqual(second.data.refund, { amount: "22.00", storeCredit: "4.00", originalPayment: "18.00" });
  assert.deepEqual(await orderRow(orderId), { status: "cancelled", refundStatus: "completed" });

  const credit = await pool.query("SELECT store_credit FROM users WHERE id=$1", [buyer.id]);
  assert.equal(credit.rows[0].store_credit, "15.00");
});

test("Shipped items and other sellers' items cannot be cancelled", async () => {
  const orderId = await makeOrder(0, "shipped");

  assert.equal((await cancel(sellerB, orderId, bookB)).status, 409);
  assert.equal((await cancel(sellerB, orderId, bookA)).status, 409);
  assert.equal((await pool.query("SELECT COUNT(*) FROM order_items WHERE order_id=$1 AND fulfillment_status='cancelled'", [orderId])).rows[0].count, "0");
});

test("Cancellation is blocked while the buyer has an open refund request", async () => {
  const orderId = await makeOrder();
  await pool.query("UPDATE orders SET refund_status='requested' WHERE id=$1", [orderId]);

  const response = await cancel(sellerA, orderId, bookA);

  assert.equal(response.status, 409);
  assert.match(response.data.error, /open refund request/);
});

test("A later buyer refund request covers only what was not already refunded", async () => {
  const orderId = await makeOrder();
  await cancel(sellerA, orderId, bookA);

  const response = await send(buyer, "POST", `/orders/${orderId}/refund`, { reason: "Damaged", refundMethod: "original_payment" });

  assert.equal(response.status, 201);
  const request = await pool.query("SELECT refund_amount FROM refund_requests WHERE order_id=$1", [orderId]);
  assert.equal(request.rows[0].refund_amount, "22.00");
});
