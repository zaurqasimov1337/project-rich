import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, options, placeholder, ...props }, ref) => (
    <div className="w-full">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full cursor-pointer rounded-lg border border-border bg-input px-3 text-sm text-foreground shadow-[var(--shadow-sm)] transition-colors duration-150 hover:border-muted/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50',
          error && 'border-danger',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  ),
);
Select.displayName = 'Select';
