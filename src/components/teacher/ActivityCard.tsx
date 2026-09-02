'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, getGradeLabel } from '@/lib/db/schema';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { toast } from 'sonner';

export function ActivityCard({ activity }: { activity: Activity }) {
  const handleCopyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(activity.access_code);
    toast.success(`تم نسخ رمز النشاط: ${activity.access_code}`);
  };

  return (
    <Card variant="default" className="hover:border-brand-teal transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <Badge variant={activity.status === 'active' ? 'teal' : activity.status === 'draft' ? 'slate' : 'danger'}>
            {activity.status === 'active' ? 'نشط ومتاح' : activity.status === 'draft' ? 'مسودة' : 'مغلق'}
          </Badge>
          <span className="text-xs font-bold text-brand-slate-500">
            {getGradeLabel(activity.grade_level)}
          </span>
        </div>

        <h3 className="text-lg font-bold text-brand-navy mb-1 leading-snug">
          {activity.title}
        </h3>
        <p className="text-sm text-brand-slate-500 mb-4 line-clamp-2">
          {activity.topic}
        </p>
      </div>

      <div className="pt-4 border-t border-brand-slate-100 space-y-3">
        <div className="flex items-center justify-between bg-brand-slate-50 p-2.5 rounded-xl border border-brand-slate-200">
          <div>
            <span className="text-xs text-brand-slate-500 block">رمز الانضمام:</span>
            <span className="font-mono font-black text-brand-navy tracking-widest text-base">
              {activity.access_code}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="text-xs py-1 px-2.5 min-h-[36px]"
          >
            📋 نسخ الكود
          </Button>
        </div>

        <Link
          href={`/teacher/activities/${activity.id}`}
          className="w-full inline-flex items-center justify-center font-bold text-sm bg-brand-navy-900 text-white hover:bg-brand-navy-800 rounded-xl py-2.5 transition-colors min-h-[44px]"
        >
          متابعة الجلسات والطلاب 👥
        </Link>
      </div>
    </Card>
  );
}
