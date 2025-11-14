"use server";

import Hero from "@/components/hero";
import { FAQ } from "@/components/faq";
import { getAllFAQs } from "@/app/actions/get-faq";

export default async function Home() {
  const homeFaqs = (await getAllFAQs()).faqs.filter(
    faq => faq.page === "home"
  );

  return (
    <>
      <Hero />
      <main className="flex-1 flex flex-col gap-6 w-full px-4 mt-10">
        <p className="text-lg text-center">This is home page content</p>
      </main>
      <FAQ faqs={homeFaqs} className=""/>
    </>
  );
}
