import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-brand-navy">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={twMerge(
            clsx(
              'w-full px-4 py-2.5 rounded-xl border bg-white text-brand-navy placeholder:text-brand-slate-400 text-base transition-all duration-200 min-h-[44px]',
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-brand-slate-300 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal',
              className
            )
          )}
          {...props}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {helperText && !error && <p className="text-xs text-brand-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
