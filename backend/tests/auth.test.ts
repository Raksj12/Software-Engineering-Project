import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  createToken,
  parseToken,
} from "../src/auth.js";

// Test that passwords are hashed
test("Password is hashed", () => {
  const password = "buyer123";
  const hashed = hashPassword(password);

  assert.notEqual(hashed, password);
});

// Test that the correct password works
test("Correct password is accepted", () => {
  const hashed = hashPassword("buyer123");

  assert.equal(verifyPassword("buyer123", hashed), true);
});

// Test that an incorrect password is rejected
test("Incorrect password is rejected", () => {
  const hashed = hashPassword("buyer123");

  assert.equal(verifyPassword("wrongpassword", hashed), false);
});

// Test that a valid login token works
test("Valid login token is accepted", () => {
  const buyer = {
    id: 2,
    email: "buyer@bookhaven.test",
    fullName: "Test Buyer",
    role: "buyer" as const,
    status: "approved" as const,
  };

  const token = createToken(buyer);
  const result = parseToken(token);

  assert.deepEqual(result, buyer);
});

// Test that an invalid login token is rejected
test("Invalid login token is rejected", () => {
  const result = parseToken("invalid-token");

  assert.equal(result, null);
});