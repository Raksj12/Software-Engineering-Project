import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { createToken } from "../src/auth.js";
import { pool } from "../src/db.js";

// REQ-030: the pre-payment summary is itemized, flags problems, and checkout only charges the total
// the buyer reviewed. Uses its own buyer, seller, books, and cart, all removed afterwards.

type TestUser = { id: number; email: string; fullName: string; role: "buyer" | "seller"; status: "approved" };

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CARD = { name: "Test Buyer", number: "4111 1111 1111 1111", expiry: "12/30", cvv: "123" };
let buyer: TestUser;
let seller: TestUser;
let cartId: number;
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

async function makeBook(title: string, price: number): Promise<number> {
  const result = await pool.query(
    `INSERT INTO products (seller_id, title, author, price, stock, status)
     VALUES ($1, $2, 'Test Author', $3, 5, 'approved') RETURNING id`,
    [seller.id, `${title} ${suffix}`, price],
  );
  return Number(result.rows[0].id);
}

async function request(method: "GET" | "POST", path: string, body?: object) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start test server.");
    const response = await fetch(`http://localhost:${address.port}/api/orders${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${createToken(buyer)}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  } finally {
    server.close();
  }
}

const summary = () => request("GET", "/checkout-summary?taxState=TX&useStoreCredit=false");
const checkout = (expectedTotal?: string) =>
  request("POST", "/checkout", { shippingAddress: "1 Test Lane", taxState: "TX", card: CARD, expectedTotal });

before(async () => {
  buyer = await makeUser("checkout-buyer", "buyer");
  seller = await makeUser("checkout-seller", "seller");
  cartId = Number((await pool.query("INSERT INTO carts (buyer_id) VALUES ($1) RETURNING id", [buyer.id])).rows[0].id);
});

// Fresh books and cart for each test: 2 x $10.00 + 1 x $5.00 = $25.00, TX tax 6.25% = $1.56, total $26.56.
beforeEach(async () => {
  await pool.query("DELETE FROM cart_items WHERE cart_id=$1", [cartId]);
  bookA = await makeBook("Alpha", 10);
  bookB = await makeBook("Beta", 5);
  await pool.query(
    "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 2), ($1, $3, 1)",
    [cartId, bookA, bookB],
  );
});

after(async () => {
  await pool.query("DELETE FROM orders WHERE buyer_id=$1", [buyer.id]);
  await pool.query("DELETE FROM notifications WHERE message LIKE $1 OR message LIKE $2", [`%${suffix}%`, `Buyer #${buyer.id} %`]);
  await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [[buyer.id, seller.id]]);
});

test("Checkout summary itemizes every line before payment", async () => {
  const response = await summary();

  assert.equal(response.status, 200);
  assert.equal(response.data.canCheckout, true);
  assert.deepEqual(
    response.data.items.map((item: Record<string, unknown>) => [item.productId, item.author, item.quantity, item.unitPrice, item.lineTotal, item.issue]),
    [
      [bookA, "Test Author", 2, "10.00", "20.00", null],
      [bookB, "Test Author", 1, "5.00", "5.00", null],
    ],
  );
  assert.equal(response.data.subtotal, "25.00");
  assert.equal(response.data.taxState, "TX");
  assert.equal(response.data.taxAmount, "1.56");
  assert.equal(response.data.total, "26.56");
  assert.equal(response.data.paymentDue, "26.56");
});

test("Checkout summary flags unavailable and short-stock items", async () => {
  await pool.query("UPDATE products SET status='pending' WHERE id=$1", [bookA]);
  await pool.query("UPDATE products SET stock=0 WHERE id=$1", [bookB]);

  const response = await summary();

  assert.equal(response.data.canCheckout, false);
  assert.deepEqual(response.data.items.map((item: { issue: string }) => item.issue), ["No longer available", "Out of stock"]);
});

test("Checkout refuses a total that changed after review and charges nothing", async () => {
  const reviewed = (await summary()).data.total;
  await pool.query("UPDATE products SET price=12 WHERE id=$1", [bookA]);

  const response = await checkout(reviewed);

  assert.equal(response.status, 409);
  assert.equal(response.data.code, "TOTAL_CHANGED");
  // 2 x $12.00 + $5.00 = $29.00, TX tax $1.81, new total $30.81
  assert.match(response.data.error, /\$30\.81/);
  const orders = await pool.query("SELECT 1 FROM orders WHERE buyer_id=$1 AND total_amount=30.81", [buyer.id]);
  assert.equal(orders.rowCount, 0);
  const stock = await pool.query("SELECT stock FROM products WHERE id=$1", [bookA]);
  assert.equal(stock.rows[0].stock, 5);
  const cart = await pool.query("SELECT COUNT(*) FROM cart_items WHERE cart_id=$1", [cartId]);
  assert.equal(cart.rows[0].count, "2");
});

test("Checkout places the order when the reviewed total still matches", async () => {
  const reviewed = (await summary()).data.total;

  const response = await checkout(reviewed);

  assert.equal(response.status, 201);
  assert.equal(response.data.order.total, "26.56");
  const cart = await pool.query("SELECT COUNT(*) FROM cart_items WHERE cart_id=$1", [cartId]);
  assert.equal(cart.rows[0].count, "0");
});

test("An empty cart cannot proceed past the summary", async () => {
  await pool.query("DELETE FROM cart_items WHERE cart_id=$1", [cartId]);

  const response = await summary();

  assert.deepEqual(response.data.items, []);
  assert.equal(response.data.canCheckout, false);
});
