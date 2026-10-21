import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "buyer" | "seller" | "admin";
export type UserStatus = "pending" | "approved" | "disabled";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function secret(): string {
  return process.env.AUTH_SECRET || "development-only-change-me";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function createToken(user: AuthUser): string {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function parseToken(token: string): AuthUser | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub: number;
      email: string;
      fullName: string;
      role: Role;
      status: UserStatus;
      exp: number;
    };
    if (!parsed.sub || !parsed.email || !parsed.role || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: parsed.sub, email: parsed.email, fullName: parsed.fullName, role: parsed.role, status: parsed.status };
  } catch {
    return null;
  }
}
