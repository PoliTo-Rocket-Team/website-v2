"use server";
export default async function updateUser(FormData: FormData) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const formData = Object.fromEntries(FormData.entries());

  console.log("FormData", formData);
}
