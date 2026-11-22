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
    ["The Fellowship of the Ring", "J. R. R. Tolkien", "9780547928210", "Fantasy", "approved", 18.99, 9],
    ["The Two Towers", "J. R. R. Tolkien", "9780547928203", "Fantasy", "approved", 18.99, 8],
    ["The Return of the King", "J. R. R. Tolkien", "9780547928197", "Fantasy", "approved", 19.99, 7],
    ["A Game of Thrones", "George R. R. Martin", "9780553381689", "Fantasy", "approved", 15.99, 10],
    ["The Name of the Wind", "Patrick Rothfuss", "9780756404741", "Fantasy", "approved", 16.99, 6],
    ["Mistborn", "Brandon Sanderson", "9780765311788", "Fantasy", "approved", 14.99, 11],
    ["The Martian", "Andy Weir", "9780553418026", "Science Fiction", "approved", 13.99, 9],
    ["Project Hail Mary", "Andy Weir", "9780593135228", "Science Fiction", "approved", 18.99, 5],
    ["Ready Player One", "Ernest Cline", "9780307887436", "Science Fiction", "approved", 12.99, 8],
    ["Neuromancer", "William Gibson", "9780441569595", "Science Fiction", "approved", 11.99, 4],
    ["Pride and Prejudice", "Jane Austen", "9780141439518", "Romance", "approved", 8.99, 14],
    ["Jane Eyre", "Charlotte Bronte", "9780141441146", "Romance", "approved", 9.99, 10],
    ["The Notebook", "Nicholas Sparks", "9781455582877", "Romance", "approved", 12.99, 5],
    ["Me Before You", "Jojo Moyes", "9780143124542", "Romance", "approved", 10.99, 7],
    ["The Silent Patient", "Alex Michaelides", "9781250301697", "Mystery", "approved", 13.99, 9],
    ["Gone Girl", "Gillian Flynn", "9780307588364", "Mystery", "approved", 12.99, 12],
    ["The Girl with the Dragon Tattoo", "Stieg Larsson", "9780307454546", "Mystery", "approved", 14.99, 6],
    ["And Then There Were None", "Agatha Christie", "9780062073488", "Mystery", "approved", 11.99, 13],
    ["Atomic Habits", "James Clear", "9780735211292", "Self Help", "approved", 17.99, 15],
    ["The 7 Habits of Highly Effective People", "Stephen R. Covey", "9781982137274", "Self Help", "approved", 16.99, 7],
    ["Deep Work", "Cal Newport", "9781455586691", "Self Help", "approved", 15.99, 10],
    ["Thinking, Fast and Slow", "Daniel Kahneman", "9780374533557", "Psychology", "approved", 16.99, 8],
    ["Sapiens", "Yuval Noah Harari", "9780062316110", "History", "approved", 18.99, 11],
    ["A People's History of the United States", "Howard Zinn", "9780060838652", "History", "approved", 19.99, 5],
    ["The Art of War", "Sun Tzu", "9780140439199", "History", "approved", 7.99, 16],
    ["The Odyssey", "Homer", "9780140268867", "Classics", "approved", 11.99, 9],
    ["Moby-Dick", "Herman Melville", "9780142437247", "Classics", "approved", 10.99, 7],
    ["Little Women", "Louisa May Alcott", "9780147514011", "Classics", "approved", 9.99, 12],
    ["The Catcher in the Rye", "J. D. Salinger", "9780316769488", "Classics", "approved", 10.99, 8],
    ["Frankenstein", "Mary Shelley", "9780141439471", "Classics", "approved", 8.99, 10],
    ["Dracula", "Bram Stoker", "9780141439846", "Classics", "approved", 9.99, 11],
    ["The Alchemist", "Paulo Coelho", "9780061122415", "Fiction", "approved", 12.99, 13],
    ["The Kite Runner", "Khaled Hosseini", "9781594631931", "Fiction", "approved", 14.99, 7],
    ["Life of Pi", "Yann Martel", "9780156027328", "Fiction", "approved", 11.99, 6],
    ["The Book Thief", "Marcus Zusak", "9780375842207", "Fiction", "approved", 12.99, 9],
    ["Circe", "Madeline Miller", "9780316556347", "Fiction", "approved", 15.99, 8],
    ["Where the Crawdads Sing", "Delia Owens", "9780735219090", "Fiction", "approved", 14.99, 10],
    ["Eloquent JavaScript", "Marijn Haverbeke", "9781593279509", "Programming", "approved", 39.99, 6],
    ["You Don't Know JS Yet", "Kyle Simpson", "9781718503114", "Programming", "approved", 32.99, 7],
    ["Python Crash Course", "Eric Matthes", "9781718502704", "Programming", "approved", 44.99, 5],
    ["Fluent Python", "Luciano Ramalho", "9781492056355", "Programming", "approved", 59.99, 4],
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
  console.log(`Database schema and seed data loaded with ${products.length} listings.`);
}

seed().catch((error) => {
  console.error("Database seeding failed:", error);
  process.exitCode = 1;
}).finally(() => pool.end());
