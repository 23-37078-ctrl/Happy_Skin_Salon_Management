export function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-[#F8DCEB]/70 ${className}`} />
  );
}

export function HeroSkeleton() {
  return (
    <div className="rounded-[2rem] bg-gradient-to-br from-[#F8DCEB] via-[#FFF8FB] to-white p-5 shadow-[0_24px_70px_rgba(214,90,154,0.12)] sm:p-8">
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-12 w-4/5 sm:h-16" />
          <Skeleton className="h-5 w-2/3" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-12 w-full rounded-full sm:w-44" />
            <Skeleton className="h-12 w-full rounded-full sm:w-40" />
          </div>
        </div>
        <Skeleton className="h-48 rounded-[1.75rem]" />
      </div>
    </div>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-[1.5rem]" />
      ))}
    </div>
  );
}

export function AppointmentCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#F3E8EF] bg-white shadow-[0_18px_55px_rgba(31,41,55,0.06)]">
      <div className="border-b border-[#F3E8EF] p-5 sm:p-7">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-7 w-56" />
      </div>
      <div className="p-5 sm:p-7">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-48" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[1.25rem]" />
          ))}
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-11 w-full rounded-full sm:w-32" />
          <Skeleton className="h-11 w-full rounded-full sm:w-32" />
          <Skeleton className="h-11 w-full rounded-full sm:w-24" />
        </div>
      </div>
    </div>
  );
}

export function CardRailSkeleton({ count = 4 }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-48 w-[19rem] flex-shrink-0 rounded-[1.75rem] sm:w-[22rem]"
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="rounded-[2rem] border border-[#F3E8EF] bg-white p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-[1.25rem]" />
        ))}
      </div>
    </div>
  );
}
