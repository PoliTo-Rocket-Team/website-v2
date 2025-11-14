"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { FAQ } from "./types";

export async function getAllFAQs(): Promise<{ faqs: FAQ[] }> {
  // ! todo caching needs to be added here
  const supabase = await createSupabaseClient();

  const { data: faqs, error } = await supabase
    .from("faqs")
    .select("*")
    .order("page, display_order", { ascending: true });

  if (error) {
    console.error("Error getting all FAQs:", error);
    return { faqs: [] };
  }

  return {
    faqs: faqs || [],
  };
}
