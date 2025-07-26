import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

/**
 * This file is responsible for creating a Supabase client instance.
 * It retrieves the session to get the Supabase access token and sets it in the headers.
 * 
 * it is important to use this function while creating the Supabase client
 * to ensure that the access token is included in the requests to be able to use rls policies.
 */
export async function createSupabaseClient() {
  const session = await auth();
  const supabaseAccessToken = session?.supabaseAccessToken;

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
}
