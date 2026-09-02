import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'teal' | 'navy' | 'amber' | 'slate' | 'success' | 'danger';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'slate', size = 'md', children, ...props }: BadgeProps) {
  const variants = {
    teal: 'bg-brand-teal-50 text-brand-teal-800 border-brand-teal-200',
    navy: 'bg-brand-navy-50 text-brand-navy-900 border-brand-navy-200',
    amber: 'bg-brand-amber-50 text-brand-amber-700 border-brand-amber-200',
    slate: 'bg-brand-slate-100 text-brand-slate-700 border-brand-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 font-medium rounded-full border',
          variants[variant],
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
}
