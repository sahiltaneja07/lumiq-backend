/**
 * Apple Sign-In Strategy — STUB
 *
 * Apple Sign-In requires:
 * 1. An Apple Developer team account with "Sign in with Apple" capability enabled.
 * 2. A private key (.p8 file) to generate a client_secret JWT signed with ES256.
 * 3. The `passport-apple` package: `npm install passport-apple`
 * 4. Service ID, Team ID, Key ID env vars.
 *
 * This file is intentionally left as a stub. To activate it:
 *   1. `npm install passport-apple @types/passport-apple`
 *   2. Set env: APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
 *   3. Replace the stub below with the real PassportStrategy(Strategy, 'apple').
 *   4. Register AppleStrategy in AuthModule providers array.
 *   5. Add GET /auth/apple and GET /auth/apple/callback routes to AuthController.
 *
 * @see https://developer.apple.com/documentation/sign_in_with_apple
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppleStrategy {
  /**
   * Placeholder — not yet active.
   * Remove this class and implement passport-apple strategy when credentials are available.
   */
}
