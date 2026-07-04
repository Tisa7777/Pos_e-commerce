import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "card" | "circle" | "text" | "avatar";
  lines?: number;
}

export function Skeleton({ 
  className, 
  variant = "default",
  lines = 1 
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]";
  
  const variantClasses = {
    default: "rounded-lg",
    card: "rounded-2xl",
    circle: "rounded-full",
    text: "rounded",
    avatar: "rounded-full",
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i}
            className={cn(
              baseClasses,
              variantClasses.text,
              "h-4 w-full",
              i === lines - 1 && "w-3/4"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white/95 p-4 shadow-[var(--shadow-card)]">
      <div className="aspect-[4/3] rounded-xl bg-slate-100 animate-pulse" />
      <div className="mt-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-5 w-2/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
        <div className="flex gap-2 pt-2">
          <div className="h-10 flex-1 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-[1.5rem] border border-white/60 bg-[var(--card)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex justify-between">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-8 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 p-4">
      {Array.from({ length: columns }).map((_, i) => (
        <div 
          key={i}
          className={cn(
            "h-4 rounded bg-slate-100 animate-pulse",
            i === 0 ? "w-1/4" : i === columns - 1 ? "w-20" : "flex-1"
          )}
        />
      ))}
    </div>
  );
}
