import Hero from "@/components/hero";

export default async function Home() {
  return (
    <>
      <Hero />
      <main className="flex-1 flex flex-col gap-6 px-4">
        <p className="text-lg text-center">
          This is home page content
        </p>

      </main>
    </>
  );
}
