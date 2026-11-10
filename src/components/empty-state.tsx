import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-surface px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </span>
      <div className="space-y-1">
        <h2 className="font-display text-xl">{title}</h2>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">{children}</p>
      </div>
      {action}
    </section>
  );
}
