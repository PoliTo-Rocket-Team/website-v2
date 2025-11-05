import Hero from "@/components/hero";
import { HomeFAQ } from "@/components/home-faq";

export default async function Home() {
  return (
    <>
      <Hero />
      <main className="flex-1 flex flex-col gap-6 w-full px-4 mt-10">
        <p className="text-lg text-center">
          This is home page content
        </p>
        <HomeFAQ />
      </main>
    </>
  );
}
