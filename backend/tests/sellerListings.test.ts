import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { createToken } from "../src/auth.js";
import { pool } from "../src/db.js";

// REQ-010: material edits (title, author, description, ISBN) send a listing back to pending review;
// other edits keep it live. Each test uses its own seller, buyer, and listings, removed afterwards.

type TestUser = { id: number; email: string; fullName: string; role: "buyer" | "seller"; status: "approved" };

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ISBN = "9780306406157";
const OTHER_ISBN = "0306406152";
let seller: TestUser;
let otherSeller: TestUser;
let buyer: TestUser;
let genre: string;

async function makeUser(name: string, role: TestUser["role"]): Promise<TestUser> {
  const email = `${name}-${suffix}@bookhaven.test`;
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1, 'test-hash', $2, $3, 'approved') RETURNING id`,
    [email, `Test ${name}`, role],
  );
  return { id: Number(result.rows[0].id), email, fullName: `Test ${name}`, role, status: "approved" };
}

const baseListing = () => ({
  title: `Edit Review ${suffix}`,
  author: "Test Author",
  genre,
  description: "Original description",
  condition: "used",
  price: "12.50",
  stock: 3,
});

async function makeListing(status = "approved", rejectionReason: string | null = null): Promise<number> {
  const listing = baseListing();
  const result = await pool.query(
    `INSERT INTO products (seller_id, title, author, isbn, genre, condition, description, price, stock, status, rejection_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [seller.id, listing.title, listing.author, ISBN, genre, listing.condition, listing.description,
      listing.price, listing.stock, status, rejectionReason],
  );
  return Number(result.rows[0].id);
}

async function send(user: TestUser, method: "PATCH" | "POST", path: string, body: object) {
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

const edit = (id: number, changes: object, user = seller) =>
  send(user, "PATCH", `/seller/listings/${id}`, { ...baseListing(), ...changes });

const listingRow = async (id: number) =>
  (await pool.query(`SELECT status, isbn, rejection_reason AS "rejectionReason" FROM products WHERE id=$1`, [id])).rows[0];

before(async () => {
  seller = await makeUser("review-seller", "seller");
  otherSeller = await makeUser("review-other-seller", "seller");
  buyer = await makeUser("review-buyer", "buyer");
  const genres = await pool.query("SELECT name FROM genres ORDER BY id LIMIT 1");
  assert.ok(genres.rowCount, "The genres table must be seeded for listing tests.");
  genre = genres.rows[0].name;
});

after(async () => {
  await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%${suffix}%`]);
  await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [[seller.id, otherSeller.id, buyer.id]]);
});

test("Price, stock, genre, and condition edits keep an approved listing live", async () => {
  const id = await makeListing();

  const response = await edit(id, { price: "9.99", stock: 10, condition: "new" });

  assert.equal(response.status, 200);
  assert.equal(response.data.sentForReview, false);
  assert.equal((await listingRow(id)).status, "approved");
});

for (const [field, changes] of [
  ["title", { title: `Edit Review ${suffix} (2nd edition)` }],
  ["author", { author: "A Different Author" }],
  ["description", { description: "A rewritten description" }],
  ["ISBN", { isbn: OTHER_ISBN }],
] as const) {
  test(`Changing the ${field} sends an approved listing back to pending review`, async () => {
    const id = await makeListing();

    const response = await edit(id, changes);

    assert.equal(response.status, 200);
    assert.equal(response.data.sentForReview, true);
    assert.equal(response.data.listing.status, "pending");
    assert.match(response.data.message, new RegExp(`the ${field} changed`));
    assert.equal((await listingRow(id)).status, "pending");

    const notice = await pool.query("SELECT 1 FROM notifications WHERE message LIKE $1", [`%changed the ${field} of listing "%${suffix}%`]);
    assert.ok(notice.rowCount, "Admins should be notified that the listing needs review again.");
  });
}

test("Re-entering the same ISBN with hyphens is not a material change", async () => {
  const id = await makeListing();

  const response = await edit(id, { isbn: "978-0-306-40615-7" });

  assert.equal(response.data.sentForReview, false);
  assert.equal((await listingRow(id)).status, "approved");
});

test("An invalid ISBN is rejected and the listing is unchanged", async () => {
  const id = await makeListing();

  const response = await edit(id, { isbn: "1234567890" });

  assert.equal(response.status, 400);
  assert.deepEqual(await listingRow(id), { status: "approved", isbn: ISBN, rejectionReason: null });
});

test("A material edit resubmits a rejected listing and clears the rejection reason", async () => {
  const id = await makeListing("rejected", "Description is misleading");

  const response = await edit(id, { description: "An accurate description" });

  assert.equal(response.data.sentForReview, true);
  assert.deepEqual(await listingRow(id), { status: "pending", isbn: ISBN, rejectionReason: null });
});

test("Sellers cannot edit another seller's listing", async () => {
  const id = await makeListing();

  const response = await edit(id, { title: "Hijacked" }, otherSeller);

  assert.equal(response.status, 404);
  assert.equal((await listingRow(id)).status, "approved");
});

test("A listing sent back to review cannot be checked out from a cart", async () => {
  const id = await makeListing();
  const cart = await pool.query("INSERT INTO carts (buyer_id) VALUES ($1) RETURNING id", [buyer.id]);
  await pool.query("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 1)", [cart.rows[0].id, id]);
  await edit(id, { title: `Edit Review ${suffix} (retitled)` });

  const response = await send(buyer, "POST", "/orders/checkout", {
    shippingAddress: "1 Test Lane",
    taxState: "TX",
    card: { name: "Test Buyer", number: "4111111111111111", expiry: "12/30", cvv: "123" },
  });

  assert.equal(response.status, 409);
  assert.match(response.data.error, /not currently available/);
  const stock = await pool.query("SELECT stock FROM products WHERE id=$1", [id]);
  assert.equal(stock.rows[0].stock, 3);
});

test("Several material changes are all named in the admin flag", async () => {
  const id = await makeListing();

  const response = await edit(id, { author: "Another Author", isbn: OTHER_ISBN });

  assert.equal(response.data.sentForReview, true);
  assert.match(response.data.message, /the author and ISBN changed/);
});

test("Invalid stock on edit gets a stock-specific error", async () => {
  const id = await makeListing();

  const response = await edit(id, { stock: -1 });

  assert.equal(response.status, 400);
  assert.match(response.data.error, /Stock must be a whole number/);
});
