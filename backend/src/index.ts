import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { createToken, hashPassword, parseToken, type AuthUser, type Role, verifyPassword } from "./auth.js";
import wishlistRoutes from "./wishlist.js"; 
import reviewsRoutes from "./reviews.js";

import { searchRouter } from "./searchRoutes.js";
import { fulfillmentRouter } from "./fulfillmentRoutes.js";
import { adminRouter } from "./adminRoutes.js";
import { notificationsRouter } from "./notifications.js";
import { sellerListingsRouter } from "./sellerListings.js";
import { ordersRouter } from "./orders.js";
import { imagesRouter } from "./images.js";
import cartRouter from "./cart.js";

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
    }),

);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", message: "BookHaven API is running" });
});

const authRequired = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? parseToken(token) : null;
  if (!user) {
    res.status(401).json({ error: "A valid Bearer token is required." });
    return;
  }
  req.user = user;
  next();
};

const requireRoles = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: "You do not have permission to access this resource." });
    return;
  }
  next();
};

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { email, password, fullName, role = "buyer" } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      role?: Role;
    };
    if (!email || !password || !fullName || !["buyer", "seller"].includes(role) || password.length < 8) {
      res.status(400).json({ error: "Email, full name, buyer/seller role, and a password of at least 8 characters are required." });
      return;
    }
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, full_name, role, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id, email, full_name AS \"fullName\", role, status",
      [email.trim().toLowerCase(), hashPassword(password), fullName.trim(), role],
    );
    res.status(201).json({ user: result.rows[0], message: "Registration submitted for approval." });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    const result = await pool.query(
      "SELECT id, email, password_hash, full_name AS \"fullName\", role, status FROM users WHERE email = $1",
      [email.trim().toLowerCase()],
    );
    const user = result.rows[0] as (AuthUser & { password_hash: string }) | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    if (user.status !== "approved") {
      res.status(403).json({ error: `This account is ${user.status}.` });
      return;
    }
    const authUser: AuthUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
    res.json({ token: createToken(authUser), user: authUser, expiresIn: "2h" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", authRequired, (_req, res) => {
  res.status(204).send();
});


app.get("/api/auth/me", authRequired, async (req, res, next) => {
  try {
    // Get the user's latest information from the database
    const result = await pool.query(
      `SELECT id, email, full_name AS "fullName", role, status
       FROM users
       WHERE id = $1`,
      [req.user!.id]
    );

    // Check if the user still exists
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Return the updated profile information
    res.set("Cache-Control", "no-store");
    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});


app.patch("/api/auth/me", authRequired, async (req, res, next) => {
  try {
    // Get the updated name and email
    const { fullName, email, password, currentPassword, storeName } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      currentPassword?: string;
      storeName?: string;
    };

    // Clean up the user's input
    const name = fullName?.trim();
    const newEmail = email?.trim().toLowerCase();

    // Make sure both fields are filled out
    if (!name || !newEmail) {
      res.status(400).json({
        error: "Full name and email are required.",
      });
      return;
    }

    // Update the user's information in the database
    if (password) {
      if (!currentPassword || password.length < 8) {
        res.status(400).json({ error: "Current password and a new password of at least 8 characters are required." });
        return;
      }
      const current = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user!.id]);
      if (!current.rowCount || !verifyPassword(currentPassword, current.rows[0].password_hash)) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }
    }
    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           store_name = $4,
           password_hash = COALESCE($5, password_hash),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, full_name AS "fullName", store_name AS "storeName", role, status`,
      [name, newEmail, req.user!.id, storeName?.trim() || null, password ? hashPassword(password) : null]
    );

    // Check if the user exists
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Send back the updated profile
    res.json({
      message: "Profile updated successfully.",
      user: result.rows[0],
    });
  } catch (error: unknown) {
    // Check if the email is already being used
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "An account with that email already exists.",
      });
      return;
    }

    next(error);
  }
});

app.get("/api/buyer/account", authRequired, requireRoles("buyer"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name AS "fullName", role, status, store_credit AS "storeCredit"
       FROM users WHERE id=$1`,
      [req.user!.id],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "Buyer account not found." });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/seller/account", authRequired, requireRoles("seller"), (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/admin/account", authRequired, requireRoles("admin"), (req, res) => {
  res.json({ user: req.user });
});

// Get books for the wishlist page. Only published books, so pending and rejected listings stay hidden.
app.get("/api/products", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, author, status, stock
       FROM products
       WHERE status = 'approved'
       ORDER BY id`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.use("/api/wishlist", wishlistRoutes);

// Only logged in buyers can access review submission
app.use("/api/reviews", authRequired, requireRoles("buyer", "admin"), reviewsRoutes);

app.use("/api/admin", authRequired, requireRoles("admin"), adminRouter);
app.use("/api/notifications", authRequired, notificationsRouter);
app.use("/api/listings", searchRouter);
app.use("/api/seller/orders", authRequired, requireRoles("seller", "admin"), fulfillmentRouter);
app.use("/api/seller/listings", authRequired, requireRoles("seller", "admin"), sellerListingsRouter);
app.use("/api/orders", authRequired, requireRoles("buyer", "admin"), ordersRouter);
app.use("/api/cart", authRequired, requireRoles("buyer", "admin"), cartRouter);
app.use("/api/images", imagesRouter);

app.get("/api/products/:productId/reviews", async (req, res, next) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId < 1) { res.status(400).json({ error: "Invalid product id." }); return; }
  try {
    const result = await pool.query(
      `SELECT r.id, r.rating, r.body, r.created_at AS "createdAt", u.full_name AS "buyerName"
       FROM reviews r JOIN users u ON u.id=r.buyer_id WHERE r.product_id=$1 ORDER BY r.created_at DESC`, [productId],
    );
    const average = result.rows.length
      ? result.rows.reduce((sum, review) => sum + Number(review.rating), 0) / result.rows.length
      : null;
    res.json({ averageRating: average, reviews: result.rows });
  } catch (error) { next(error); }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Page not found." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error:", error);
  res.status(500).json({ error: "Internal server error." });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`BookHaven API is running at http://localhost:${PORT}`);
  });
}

export { app };