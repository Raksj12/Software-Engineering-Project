import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { pool } from "./db.js";
import { hashPassword } from "./auth.js";

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql", "schema.sql");

// Builds a plain placeholder book cover (a solid color with a darker spine) as a PNG
function placeholderCover([r, g, b]: readonly [number, number, number]): Buffer {
  const width = 200;
  const height = 300;
  const spine = 18;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    const shade = x < spine ? 0.6 : 1;
    row.set([Math.round(r * shade), Math.round(g * shade), Math.round(b * shade)], 1 + x * 3);
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));

  const chunk = (type: string, data: Buffer) => {
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const COVER_COLORS = [
  [178, 34, 34], [34, 102, 153], [46, 125, 50], [123, 31, 162], [230, 126, 34],
  [0, 121, 107], [96, 125, 139], [194, 24, 91], [121, 85, 72],
] as const;

async function seed(): Promise<void> {
  await pool.query(await fs.readFile(schemaPath, "utf8"));
  await pool.query("TRUNCATE reviews, wishlists, prohibited_words, cart_items, carts, order_items, orders, products, images, users RESTART IDENTITY CASCADE");

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

  const products: number[] = [];
  for (const product of [
    ["The Pragmatic Programmer", "David Thomas and Andrew Hunt", "9780135957059", "Programming", "approved", 42.99, 8],
    ["Clean Code", "Robert C. Martin", "9780132350884", "Programming", "pending", 35.5, 4],
    ["The Hobbit", "J. R. R. Tolkien", "9780547928227", "Fantasy", "rejected", 14.99, 0],
    ["Introduction to Algorithms", "Thomas H. Cormen et al.", "9780262033848", "Programming", "approved", 89.99, 3],
    ["Design Patterns", "Erich Gamma et al.", "9780201633610", "Programming", "approved", 49.95, 5],
    ["The Great Gatsby", "F. Scott Fitzgerald", "9780743273565", "Classics", "approved", 10.99, 12],
    ["1984", "George Orwell", "9780451524935", "Classics", "approved", 9.99, 7],
    ["To Kill a Mockingbird", "Harper Lee", "9780061120084", "Classics", "approved", 12.5, 6],
    ["Dune", "Frank Herbert", "9780441172719", "Science Fiction", "approved", 11.99, 4],
  ] as const) {
    // Store a placeholder cover in the database, the same way seller uploads are stored
    const image = await pool.query<{ id: string }>(
      "INSERT INTO images (mime_type, data, uploaded_by) VALUES ('image/png', $1, $2) RETURNING id",
      [placeholderCover(COVER_COLORS[products.length % COVER_COLORS.length]), users.get("seller@bookhaven.test")],
    );
    const result = await pool.query<{ id: number }>(
      "INSERT INTO products (seller_id, title, author, isbn, genre, condition, description, price, stock, image_path, status) VALUES ($1, $2, $3, $4, $5, 'new', $6, $7, $8, $9, $10) RETURNING id",
      [users.get("seller@bookhaven.test"), product[0], product[1], product[2], product[3], `A seeded ${product[0]} listing.`, product[5], product[6], `/api/images/${image.rows[0].id}`, product[4]],
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
