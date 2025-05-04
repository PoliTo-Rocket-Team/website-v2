"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const signInWithGoogle = async () => {
  const supabase = await createClient();

  const getURL = () => {
    let url =
      process?.env?.NEXT_PUBLIC_SITE_URL; // Set this to your site URL in production env.
    
    // Guard against undefined URL
    if (!url) {
      throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not set');
      // Or provide a default value:
      // url = 'localhost:3000';
  }
    
    // Make sure to include `https://` when not localhost.
    url = url.startsWith("http") ? url : `https://${url}`;
    // Make sure to include a trailing `/`.
    url = url.endsWith("/") ? url : `${url}/`;
    return url;
  };
  // const { data, error } = await supabase.auth.signInWithOAuth({
  //   provider: "google",
  //   options: {
  //     redirectTo: `${getURL()}/auth/callback`,
  //   },
  // });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "keycloak",
    options: {
      scopes: "openid",
      redirectTo: `${getURL()}auth/callback`,
    },
  });

  if (error) {
    console.error("Error signing in with Google:", error);
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect(data.url);
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/");
};
