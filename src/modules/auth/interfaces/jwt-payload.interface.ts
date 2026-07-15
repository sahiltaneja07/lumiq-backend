import { Role } from '../../../common/enums/role.enum';

/**
 * Payload embedded inside every Access JWT.
 * Keep it small — it is base64-encoded in every request header.
 */
export interface JwtPayload {
  /** User UUID */
  sub: string;
  /** User email */
  email: string;
  /** Assigned roles */
  roles: Role[];
  /** Token type discriminator */
  type: 'access';
}

/**
 * Payload embedded inside every Refresh JWT.
 */
export interface JwtRefreshPayload {
  /** User UUID */
  sub: string;
  /** DB-stored refresh token UUID (used to revoke specific tokens) */
  tokenId: string;
  /** Token type discriminator */
  type: 'refresh';
}
