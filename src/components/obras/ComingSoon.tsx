import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="p-6">
      <Card className="bg-card border-border p-12 text-center space-y-3">
        <Icon className="h-10 w-10 mx-auto text-muted-foreground/60" />
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">Módulo em desenvolvimento.</p>
        <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">
          em breve
        </span>
      </Card>
    </div>
  );
}
