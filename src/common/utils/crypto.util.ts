import { createHash, randomBytes } from 'crypto';

/** SHA-256 hex digest; refresh tokens are stored only in this form. */
export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** 256-bit URL-safe random string used as an opaque refresh token. */
export const generateOpaqueToken = (): string =>
  randomBytes(32).toString('base64url');