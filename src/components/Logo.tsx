export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative grid h-9 w-9 place-items-center rounded-md bg-[image:var(--gradient-gold)] shadow-[var(--shadow-gold)]">
        <span className="text-base font-black text-primary-foreground tracking-tighter">MV</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-wide text-foreground">MV OS</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Marquês Valley</span>
      </div>
    </div>
  );
}
