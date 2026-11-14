import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/index.js";
import { pool } from "../src/db.js";

// REQ-052: a book's public review endpoint returns the average rating alongside the individual reviews.
// Uses its own seller, buyers, books, and reviews, all removed afterwards.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userIds: number[] = [];
let reviewedBook: number;
let unreviewedBook: number;

async function makeUser(name: string, role: "buyer" | "seller"): Promise<number> {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1, 'test-hash', $2, $3, 'approved') RETURNING id`,
    [`${name}-${suffix}@bookhaven.test`, `Reviewer ${name}`, role],
  );
  const id = Number(result.rows[0].id);
  userIds.push(id);
  return id;
}

async function makeBook(sellerId: number, title: string): Promise<number> {
  const result = await pool.query(
    `INSERT INTO products (seller_id, title, author, price, stock, status)
     VALUES ($1, $2, 'Test Author', 9.99, 1, 'approved') RETURNING id`,
    [sellerId, `${title} ${suffix}`],
  );
  return Number(result.rows[0].id);
}

async function getReviews(productId: number | string) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start test server.");
    const response = await fetch(`http://localhost:${address.port}/api/products/${productId}/reviews`);
    return { status: response.status, data: await response.json() };
  } finally {
    server.close();
  }
}

before(async () => {
  const seller = await makeUser("reviews-seller", "seller");
  reviewedBook = await makeBook(seller, "Reviewed");
  unreviewedBook = await makeBook(seller, "Unreviewed");
  // Ratings 5, 4, and 2, written a day apart, oldest first: average 11 / 3 = 3.67.
  for (const [index, rating] of [5, 4, 2].entries()) {
    const buyer = await makeUser(`reviews-buyer-${index}`, "buyer");
    await pool.query(
      `INSERT INTO reviews (buyer_id, product_id, rating, body, created_at)
       VALUES ($1, $2, $3, $4, NOW() - make_interval(days => $5::int))`,
      [buyer, reviewedBook, rating, `Rated ${rating}`, 3 - index],
    );
  }
});

after(async () => {
  await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [userIds]);
});

test("Book reviews include the average rating across all reviews", async () => {
  const response = await getReviews(reviewedBook);

  assert.equal(response.status, 200);
  assert.equal(response.data.reviews.length, 3);
  assert.ok(Math.abs(response.data.averageRating - 11 / 3) < 1e-9);
});

test("Individual reviews are listed newest first with rating, text, and reviewer", async () => {
  const response = await getReviews(reviewedBook);

  assert.deepEqual(
    response.data.reviews.map((review: { rating: number; body: string; buyerName: string }) => [review.rating, review.body, review.buyerName]),
    [
      [2, "Rated 2", "Reviewer reviews-buyer-2"],
      [4, "Rated 4", "Reviewer reviews-buyer-1"],
      [5, "Rated 5", "Reviewer reviews-buyer-0"],
    ],
  );
});

test("A book with no reviews has no average", async () => {
  const response = await getReviews(unreviewedBook);

  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { averageRating: null, reviews: [] });
});

test("An invalid book id is rejected", async () => {
  const response = await getReviews("abc");

  assert.equal(response.status, 400);
});
