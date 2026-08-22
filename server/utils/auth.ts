import argon2 from "argon2";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomInt } from "crypto";
import { getOrGenerateSecret } from "./required-env";

function getJwtSecret(): string {
  // Use the centralized secret manager which auto-generates in production if needed
  return getOrGenerateSecret('JWT_SECRET') || 'dev-jwt-secret-change-me';
}

// Access token lives 7 days in the JWT, but the cookie maxAge is 15 minutes.
// The client auto-refreshes every 5 minutes to keep the session alive.
// Refresh token is 30 days (cookie + JWT).
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

interface JWTPayload {
  id: string;
  email: string;
  user_type?: string;
  role?: string;
  client_id?: string;
  staff_id?: string;
  permissions?: Record<string, boolean>;
}

// Extract user info from request (set by requireAuth)
export function getUserFromRequest(req: any) {
  return req.user;
}

/**
 * Hash a password (argon2id)
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Compare plain text password with stored password
 * Supports plain text, argon2id, and bcrypt for backward compatibility
 */
export async function comparePassword(
  password: string,
  storedPassword: string
): Promise<boolean> {
  // 1. Try argon2 if hash starts with $argon2
  if (storedPassword?.startsWith("$argon2")) {
    try {
      return await argon2.verify(storedPassword, password);
    } catch (e) {
      return false;
    }
  }

  // 2. Try bcrypt if hash starts with $2
  if (storedPassword?.startsWith("$2")) {
    try {
      return await bcrypt.compare(password, storedPassword);
    } catch (e) {
      return false;
    }
  }

  return false;
}

/**
 * Generate JWT access token (7 days; cookie maxAge is 15 minutes, auto-refreshed every 5 min)
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate refresh token (30 days)
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

export { getJwtSecret };

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Generate a secure random password for staff invitations
 */
export function generateSecurePassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomInt(0, chars.length));
  }
  return password;
}
