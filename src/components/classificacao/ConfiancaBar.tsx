export function ConfiancaBar({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color =
    v === 0 ? "bg-muted-foreground/40"
    : v >= 90 ? "bg-emerald-500"
    : v >= 70 ? "bg-amber-500"
    : "bg-red-500";
  const text =
    v === 0 ? "text-muted-foreground"
    : v >= 90 ? "text-emerald-600 dark:text-emerald-400"
    : v >= 70 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[60px]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${v}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums w-9 text-right ${text}`}>{v}%</span>
    </div>
  );
}
