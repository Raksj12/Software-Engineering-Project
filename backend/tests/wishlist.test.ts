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

async function sendWishlistRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  loggedIn = true,
  body?: object
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
      `http://localhost:${address.port}/api/wishlist${path}`,
      {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
    );

    return response.status;
  } finally {
    server.close();
  }
}

// Wishlist requires login
test("Wishlist requires login", async () => {
  const status = await sendWishlistRequest("GET", "/", false);

  assert.equal(status, 401);
});

// Buyers can view their wishlist
test("Buyer can view wishlist", async () => {
  const status = await sendWishlistRequest("GET", "/");

  assert.equal(status, 200);
});

// Invalid book IDs cannot be added
test("Wishlist rejects invalid book ID", async () => {
  const status = await sendWishlistRequest("POST", "/", true, {
    productId: -1,
  });

  assert.equal(status, 400);
});

// Books that do not exist cannot be added
test("Wishlist rejects missing books", async () => {
  const status = await sendWishlistRequest("POST", "/", true, {
    productId: 999999,
  });

  assert.equal(status, 404);
});

// Invalid book IDs cannot be removed
test("Wishlist rejects invalid removal ID", async () => {
  const status = await sendWishlistRequest("DELETE", "/-1");

  assert.equal(status, 400);
});