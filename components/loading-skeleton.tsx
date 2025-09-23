export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg shadow-md border border-border animate-pulse"
        >
          <div className="flex justify-between items-center border-b px-4 py-4">
            <div className="h-6 bg-gray-600 rounded w-1/3"></div>
            <div className="flex items-center space-x-2">
              <div className="h-4 bg-gray-600 rounded w-32"></div>
              <div className="h-4 bg-gray-600 rounded w-12"></div>
              <div className="h-6 w-12 bg-gray-600 rounded-full"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
