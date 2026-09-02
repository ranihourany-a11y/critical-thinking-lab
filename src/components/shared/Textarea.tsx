import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, rows = 4, ...props }, ref) => {
    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-brand-navy">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={twMerge(
            clsx(
              'w-full px-4 py-3 rounded-xl border bg-white text-brand-navy placeholder:text-brand-slate-400 text-base leading-relaxed transition-all duration-200 resize-y',
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

Textarea.displayName = 'Textarea';
