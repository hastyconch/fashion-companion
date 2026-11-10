/** Shown while a page's signed-in content streams in. */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-3 w-16 rounded-full bg-muted" />
        <div className="h-9 w-2/3 rounded-xl bg-muted" />
      </div>
      <div className="h-40 rounded-3xl bg-muted" />
      <div className="h-24 rounded-3xl bg-muted" />
    </div>
  );
}
