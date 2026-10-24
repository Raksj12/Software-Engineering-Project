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
    res.json({ token: createToken(authUser), user: authUser, expiresIn: "8h" });
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
    const { fullName, email } = req.body as {
      fullName?: string;
      email?: string;
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
    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, full_name AS "fullName", role, status`,
      [name, newEmail, req.user!.id]
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

app.get("/api/buyer/account", authRequired, requireRoles("buyer"), (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/seller/account", authRequired, requireRoles("seller"), (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/admin/account", authRequired, requireRoles("admin"), (req, res) => {
  res.json({ user: req.user });
});

// Get books for the wishlist page
app.get("/api/products", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, author, status, stock
       FROM products
       ORDER BY id`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.use("/api/wishlist", wishlistRoutes);

// Only logged in buyers can access review submission
app.use("/api/reviews", authRequired, requireRoles("buyer"), reviewsRoutes);

app.use("/api/admin", authRequired, requireRoles("admin"), adminRouter);
app.use("/api/notifications", authRequired, notificationsRouter);
app.use("/api/listings", searchRouter);
app.use("/api/seller/orders", authRequired, requireRoles("seller"), fulfillmentRouter);

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