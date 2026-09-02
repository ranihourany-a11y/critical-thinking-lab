import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'amber' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none min-h-[44px] min-w-[44px] cursor-pointer';

    const variants = {
      primary:
        'bg-brand-teal text-white hover:bg-brand-teal-700 active:bg-brand-teal-800 shadow-sm focus-visible:ring-brand-teal',
      secondary:
        'bg-brand-navy-900 text-white hover:bg-brand-navy-800 active:bg-brand-navy-700 focus-visible:ring-brand-navy-900',
      outline:
        'border-2 border-brand-slate-300 text-brand-navy hover:bg-brand-slate-100 active:bg-brand-slate-200 focus-visible:ring-brand-teal',
      ghost:
        'text-brand-slate-700 hover:bg-brand-slate-100 active:bg-brand-slate-200 focus-visible:ring-brand-teal',
      amber:
        'bg-brand-amber text-white hover:bg-brand-amber-700 active:bg-brand-amber-700 shadow-sm focus-visible:ring-brand-amber',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
    };

    const sizes = {
      sm: 'text-sm px-3 py-1.5 gap-1.5',
      md: 'text-base px-5 py-2.5 gap-2',
      lg: 'text-lg px-6 py-3 gap-2.5 font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>جاري المعالجة...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
