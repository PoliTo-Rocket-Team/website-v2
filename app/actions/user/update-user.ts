"use server";
export default async function updateUser(previousState, formData: FormData) {
  await new Promise((resolve) => setTimeout(resolve, 4000));
  console.log("FormData", formData);
  return {
    success: true,
  };

  console.log("FormData", formData);
}
