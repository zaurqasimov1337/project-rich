import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground shadow-[var(--shadow-sm)] transition-colors duration-150 placeholder:text-muted hover:border-muted/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50 read-only:bg-muted-bg/50',
          error && 'animate-soft-shake border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  ),
);
Input.displayName = 'Input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-[13px] font-medium text-foreground', className)} {...props} />
  );
}
