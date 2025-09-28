export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`${className} md:space-y-4`}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg shadow-md border border-border animate-pulse"
        >
          <div className="flex flex-col items-start md:items-center flex-1 gap-2 md:grid w-full md:grid-cols-[3fr_2fr_2fr_auto] p-4  md:justify-items-start">
            <div className="h-6 bg-gray-600 rounded w-1/4"></div>
            <div className="h-4 bg-gray-600 rounded w-1/4"></div>
            <div className="h-4 bg-gray-600 rounded w-12"></div>
            <div className="hidden md:block h-4 w-4 bg-gray-600 "></div>
          </div>
        </div>
      ))}
    </div>
  );
}
