"use server";
import { createClient } from "@/utils/supabase/server";

export default async function updateUser(previousState, formData: FormData) {
  const div = await departments_info();
  await new Promise((resolve) => setTimeout(resolve, 4000));
  console.log("FormData", formData);
  return {
    success: true,
  };

  console.log("FormData", formData);
}

export async function divisions_info() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("divisions")
    .select(
      `
    id,
    name,
    code,
    departments (
      id,
      name,
      code
    )
  `
    )
    .is("closed_at", null);
  return data;
}

export async function departments_info() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select(
      `
    id,
    name,
    code ,
    divisions (
      id,
      name,
      code
    )

  `
    )
    .is("closed_at", null);
  return data;
}

export async function getMembers(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      `
    type,
    member_id,
    id,
    title,
    division_id,
    dept_id,
    started_at,
    leaved_at,

    members:member_id (
      discord,
      mobile_number,
      users (
        first_name,
        last_name,
        email,
        linkedin,
        origin,
        level_of_study,
        polito_id,
        program
      )
    ),

    divisions (
      name,
      code,
      id
    ),

    departments (
      name,
      code,
      id
    )
  `
    )
    .is("leaved_at", null);

  // .not('started_at', 'is', null);
}
