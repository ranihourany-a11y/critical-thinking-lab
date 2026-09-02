import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'teal' | 'navy';
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  const variants = {
    default: 'bg-white border border-brand-slate-200 shadow-sm',
    bordered: 'bg-white border-2 border-brand-slate-300',
    elevated: 'bg-white border border-brand-slate-100 shadow-md',
    teal: 'bg-brand-teal-50 border border-brand-teal-200',
    navy: 'bg-brand-navy text-white border border-brand-navy-700',
  };

  return (
    <div
      className={twMerge(
        clsx('rounded-2xl p-6 transition-all duration-200', variants[variant], className)
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  subtitle,
  action,
}: {
  className?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={twMerge(clsx('flex items-start justify-between gap-4 mb-4', className))}>
      <div>
        <h2 className="text-xl font-bold text-brand-navy">{title}</h2>
        {subtitle && <p className="text-sm text-brand-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
