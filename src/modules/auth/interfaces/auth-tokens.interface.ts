/**
 * Pair of tokens returned on login / register / refresh.
 */
export interface AuthTokens {
  /** Short-lived JWT access token (default: 15 min) */
  accessToken: string;
  /** Long-lived JWT refresh token (default: 7 days) */
  refreshToken: string;
  /** Access token expiry in seconds */
  expiresIn: number;
}
