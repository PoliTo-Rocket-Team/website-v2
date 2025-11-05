"use server";

import { createSupabaseClient } from "@/utils/supabase/client";

export type FAQPage = "home" | "apply" | "account";

export interface FAQ {
  id: number;
  page: FAQPage;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string | null;
  updated_by: number | null;
  display_order: number;
}

export async function getFAQsByPage(page: FAQPage): Promise<FAQ[]> {
  const supabase = await createSupabaseClient();

  const { data: faqs, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("page", page)
    .order("display_order", { ascending: true });

  if (error) {
    console.error(`Error getting FAQs for page ${page}:`, error);
    return [];
  }

  return faqs || [];
}

export async function getAllFAQs(): Promise<FAQ[]> {
  const supabase = await createSupabaseClient();

  const { data: faqs, error } = await supabase
    .from("faqs")
    .select("*")
    .order("page", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error getting all FAQs:", error);
    return [];
  }

  return faqs || [];
}
