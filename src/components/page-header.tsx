export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="space-y-2">
      {eyebrow && (
        <p className="text-xs font-medium tracking-[0.25em] text-accent uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl leading-tight md:text-4xl">{title}</h1>
      {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
    </header>
  );
}
