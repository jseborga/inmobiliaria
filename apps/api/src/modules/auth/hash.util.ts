import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Genera un refresh token opaco (no JWT) de alta entrop\u00eda. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Hash SHA-256 del refresh token para guardar en DB (nunca el plaintext). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
