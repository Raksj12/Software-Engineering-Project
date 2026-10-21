import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { hashPassword } from "./auth.js";

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql", "schema.sql");

async function seed(): Promise<void> {
  await pool.query(await fs.readFile(schemaPath, "utf8"));
  await pool.query("TRUNCATE reviews, wishlists, prohibited_words, cart_items, carts, order_items, orders, products, users RESTART IDENTITY CASCADE");

  const users = new Map<string, number>();
  for (const user of [
    ["admin@bookhaven.test", "Admin User", "admin", "admin123"],
    ["buyer@bookhaven.test", "Test Buyer", "buyer", "buyer123"],
    ["seller@bookhaven.test", "Test Seller", "seller", "seller123"],
  ] as const) {
    const result = await pool.query<{ id: number }>(
      "INSERT INTO users (email, full_name, password_hash, role, status) VALUES ($1, $2, $3, $4, 'approved') RETURNING id",
      [user[0], user[1], hashPassword(user[3]), user[2]],
    );
    users.set(user[0], result.rows[0].id);
  }

  const products = [];
  for (const product of [
    ["The Pragmatic Programmer", "David Thomas and Andrew Hunt", "9780135957059", "Programming", "approved", 42.99, 8],
    ["Clean Code", "Robert C. Martin", "9780132350884", "Programming", "pending", 35.5, 4],
    ["The Hobbit", "J. R. R. Tolkien", "9780547928227", "Fantasy", "rejected", 14.99, 0],
  ] as const) {
    const result = await pool.query<{ id: number }>(
      "INSERT INTO products (seller_id, title, author, isbn, genre, condition, description, price, stock, image_path, status) VALUES ($1, $2, $3, $4, $5, 'new', $6, $7, $8, $9, $10) RETURNING id",
      [users.get("seller@bookhaven.test"), product[0], product[1], product[2], product[3], `A seeded ${product[0]} listing.`, product[5], product[6], `/uploads/${product[2]}.jpg`, product[4]],
    );
    products.push(result.rows[0].id);
  }

  await pool.query("INSERT INTO reviews (buyer_id, product_id, rating, body) VALUES ($1, $2, 5, 'Excellent condition and quick delivery.'), ($1, $3, 4, 'Useful reference book.')", [users.get("buyer@bookhaven.test"), products[0], products[1]]);
  await pool.query("INSERT INTO wishlists (buyer_id, product_id) VALUES ($1, $2), ($1, $3)", [users.get("buyer@bookhaven.test"), products[0], products[1]]);
  await pool.query("INSERT INTO prohibited_words (phrase, created_by) VALUES ('counterfeit', $1), ('hate speech', $1)", [users.get("admin@bookhaven.test")]);
  console.log("Database schema and seed data loaded.");
}

seed().catch((error) => {
  console.error("Database seeding failed:", error);
  process.exitCode = 1;
}).finally(() => pool.end());
