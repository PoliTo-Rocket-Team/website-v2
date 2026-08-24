import { LoadingSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <div className="w-full">
      <div className="flex flex-col my-4 border-b pb-4 md:pb-8">
        <div className="h-7 w-40 rounded bg-muted/40 md:h-8" aria-hidden="true" />
        <div
          className="mt-2 h-4 w-3/4 rounded bg-muted/40 md:mt-4"
          aria-hidden="true"
        />
        <div className="mt-2 h-4 w-2/3 rounded bg-muted/40" aria-hidden="true" />
      </div>
      <div className="w-full relative max-w-5xl mx-auto">
        <LoadingSkeleton className="space-y-2 md:space-y-4" />
      </div>
    </div>
  );
}
