import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info";
}

const variantStyles = {
  default: {
    icon: "from-primary/15 to-primary/5 text-primary",
    trendUp: "text-emerald-600 bg-emerald-50",
    trendDown: "text-red-600 bg-red-50",
  },
  primary: {
    icon: "from-blue-500/15 to-cyan-500/5 text-blue-600",
    trendUp: "text-blue-600 bg-blue-50",
    trendDown: "text-red-600 bg-red-50",
  },
  success: {
    icon: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    trendUp: "text-emerald-700 bg-emerald-100",
    trendDown: "text-amber-600 bg-amber-50",
  },
  warning: {
    icon: "from-amber-500/15 to-orange-500/5 text-amber-600",
    trendUp: "text-emerald-600 bg-emerald-50",
    trendDown: "text-orange-600 bg-orange-50",
  },
  info: {
    icon: "from-emerald-500/15 to-purple-500/5 text-violet-600",
    trendUp: "text-violet-600 bg-violet-50",
    trendDown: "text-red-600 bg-red-50",
  },
};

export function StatCard({ 
  label, 
  value, 
  helper, 
  icon, 
  trend,
  variant = "default" 
}: StatCardProps) {
  const styles = variantStyles[variant];
  
  return (
    <Card className="group relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
      {/* Subtle gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      <CardHeader className="relative flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted truncate">{label}</p>
          <CardTitle className="mt-2 text-2xl sm:text-3xl tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            {value}
          </CardTitle>
        </div>
        {icon ? (
          <div className={cn(
            "shrink-0 rounded-2xl bg-gradient-to-br p-3 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg",
            styles.icon
          )}>
            {icon}
          </div>
        ) : null}
      </CardHeader>
      
      <CardContent className="relative pt-0">
        {trend ? (
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trend.direction === "up" ? styles.trendUp : 
              trend.direction === "down" ? styles.trendDown : "bg-slate-100 text-slate-600"
            )}>
              {trend.direction === "up" && "↑"}
              {trend.direction === "down" && "↓"}
              {trend.direction === "neutral" && "→"}
              {trend.value}
            </span>
            {trend.label && (
              <span className="text-xs text-muted">{trend.label}</span>
            )}
          </div>
        ) : helper ? (
          <p className="text-sm text-muted">{helper}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
