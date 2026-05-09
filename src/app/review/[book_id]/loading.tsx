export default function ReviewLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="h-9 w-3/4 animate-pulse rounded bg-[#ebe5dc]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-[#ebe5dc]" />
        <div className="flex gap-2">
          <div className="h-7 w-20 animate-pulse rounded-full bg-[#ebe5dc]" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-[#ebe5dc]" />
        </div>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-7 w-7 animate-pulse rounded-full bg-[#ebe5dc]"
          />
        ))}
      </div>

      <div className="min-h-[120px] animate-pulse rounded-button bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
      <div className="h-11 w-full animate-pulse rounded-button bg-[#ebe5dc]" />
    </div>
  );
}
