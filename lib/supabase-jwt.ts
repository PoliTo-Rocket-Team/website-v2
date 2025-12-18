import { SignJWT } from "jose";

/**
 * Generates a Supabase-compatible JWT access token for Row Level Security (RLS).
 *
 * Why we need this:
 * - Supabase uses JWT tokens to identify users and enforce RLS policies
 * - Better-auth manages authentication, but Supabase needs its own JWT format
 * - This token allows Supabase to know WHO is making the request (via `auth.uid()`)
 *
 * How it works:
 * 1. Takes user ID and email from better-auth session
 * 2. Creates a JWT with Supabase's expected payload structure
 * 3. Signs it with SUPABASE_JWT_SECRET (same secret Supabase uses)
 * 4. Token is attached to better-auth session via customSession plugin
 * 5. Supabase client includes this token in Authorization header
 * 6. Supabase RLS policies can now access user info via auth.uid()
 *
 * Token payload includes:
 * - sub: User ID (accessible via auth.uid() in RLS policies)
 * - email: User email
 * - role: "authenticated" (indicates this is an authenticated user)
 * - aud: "authenticated" (audience claim)
 * - exp: Expiration time (1 hour)
 *
 * @param userId - The user's unique ID from better-auth
 * @param email - The user's email address
 * @returns A signed JWT token that Supabase can verify and use for RLS
 */
export async function generateSupabaseAccessToken(
  userId: string,
  email: string
) {
  const signingSecret = process.env.SUPABASE_JWT_SECRET;

  if (!signingSecret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured");
  }

  const payload = {
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
    sub: userId,
    email: email,
    role: "authenticated",
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(payload.exp)
    .sign(new TextEncoder().encode(signingSecret));

  return token;
}
