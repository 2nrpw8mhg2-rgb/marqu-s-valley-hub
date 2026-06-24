import mvLogo from "@/assets/mv-logo.png.asset.json";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={mvLogo.url}
        alt="Marquês Valley — Sustainable Construction"
        className="h-10 w-auto object-contain"
      />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-wide text-foreground">MV OS</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Marquês Valley
        </span>
      </div>
    </div>
  );
}
