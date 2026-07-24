import { cn } from '@/lib/utils';

/** Loading placeholder block with a soft left-to-right shimmer sweep. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg bg-muted-bg', className)} />;
}

/** A stack of row skeletons for lists/tables. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 p-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
