export function ErrorBanner({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-[var(--del-fg)]/30 bg-[var(--del-bg)] px-3 py-1.5 font-sans text-[12px] text-[var(--del-fg)] ${className}`}
    >
      {children}
    </div>
  );
}
