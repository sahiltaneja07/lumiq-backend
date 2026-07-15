import * as crypto from 'crypto';

/**
 * Utility for generating and hashing cryptographically-secure tokens.
 * Used for email verification and password reset flows.
 */
export class CryptoUtil {
  /**
   * Generates a URL-safe random hex token.
   * @param byteLength Number of random bytes (default 32 → 64 hex chars)
   */
  static generateToken(byteLength: number = 32): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * One-way SHA-256 hash of a token for safe storage in Redis/DB.
   * Never store raw tokens.
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Constant-time comparison to prevent timing attacks.
   */
  static safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
