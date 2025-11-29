import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

/**
 * Server-side Supabase client factory.
 * 
 * This function creates a Supabase client instance for use in server actions,
 * API routes, and other server-side code. It retrieves the session to get the
 * Supabase access token and sets it in the headers.
 *
 * It is important to use this function while creating the Supabase client
 * to ensure that the access token is included in the requests to be able to use RLS policies.
 * 
 * Returns a Supabase client:
 * - If session exists, includes user token (for private data + RLS)
 * - Otherwise, returns a public client using anon key
 * 
 * NOTE: This is for server-side use only. Do not use in client components.
 */
export async function createSupabaseClient() {
  const session = await auth();
  const supabaseAccessToken = session?.supabaseAccessToken;
  if (supabaseAccessToken) {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${supabaseAccessToken}`,
          },
        },
      }
    );
  } else {
    // Public client for unauthenticated requests for public data
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }
}

