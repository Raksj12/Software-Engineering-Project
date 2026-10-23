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

async function sendReview(
  review: {
    productId: number;
    rating: number;
    body: string;
  },
  loggedIn = true
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
      headers.Authorization = `Bearer ${createToken(buyer)}`;
    }

    const response = await fetch(
      `http://localhost:${address.port}/api/reviews`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(review),
      }
    );

    return response.status;
  } finally {
    server.close();
  }
}

// Reject ratings outside 1 to 5
test("Review rejects an invalid rating", async () => {
  const status = await sendReview({
    productId: 1,
    rating: 6,
    body: "Great book!",
  });

  assert.equal(status, 400);
});

// Require a login token
test("Review requires login", async () => {
  const status = await sendReview(
    {
      productId: 1,
      rating: 5,
      body: "Great book!",
    },
    false
  );

  assert.equal(status, 401);
});

// Reject empty review text
test("Review cannot be empty", async () => {
  const status = await sendReview({
    productId: 1,
    rating: 5,
    body: "",
  });

  assert.equal(status, 400);
});

// Reject ratings below 1
test("Review rejects a zero rating", async () => {
  const status = await sendReview({
    productId: 1,
    rating: 0,
    body: "Great book!",
  });

  assert.equal(status, 400);
});

// Reject invalid book IDs
test("Review rejects an invalid book ID", async () => {
  const status = await sendReview({
    productId: -1,
    rating: 5,
    body: "Great book!",
  });

  assert.equal(status, 400);
});

// Reject books the buyer has not received
test("Review requires a delivered purchase", async () => {
  const status = await sendReview({
    productId: 999999,
    rating: 5,
    body: "Great book!",
  });

  assert.equal(status, 403);
});