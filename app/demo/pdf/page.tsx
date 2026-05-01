import { notFound } from "next/navigation";

export default function PDFDemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          PDF Demo Disabled
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          This temporary demo page is kept as a build-safe placeholder and is
          hidden in production.
        </p>
      </div>
    </div>
  );
}
