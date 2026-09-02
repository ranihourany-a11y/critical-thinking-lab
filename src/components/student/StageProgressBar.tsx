import React from 'react';
import { PedagogicalStage } from '@/lib/db/schema';
import { clsx } from 'clsx';

export const STAGES_LIST: { key: PedagogicalStage; label: string; step: number }[] = [
  { key: 'baseline', label: 'الموقف المبدئي', step: 1 },
  { key: 'understanding', label: 'فحص المفاهيم', step: 2 },
  { key: 'evidence', label: 'الأدلة والبيانات', step: 3 },
  { key: 'source_check', label: 'موثوقية المصادر', step: 4 },
  { key: 'causal_reasoning', label: 'التحليل السببي', step: 5 },
  { key: 'counter_argument', label: 'الحجج المضادة', step: 6 },
  { key: 'reflection', label: 'التأمل الختامي', step: 7 },
];

export function StageProgressBar({ currentStage }: { currentStage: PedagogicalStage }) {
  const currentIndex = STAGES_LIST.findIndex((s) => s.key === currentStage);
  const activeIndex = currentIndex === -1 ? (currentStage === 'submitted' ? 7 : 0) : currentIndex;

  return (
    <div className="w-full bg-white border-b border-brand-slate-200 py-3 px-4 shadow-xs">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-brand-navy">
            مسار التفكير الناقد (مرحلة {Math.min(activeIndex + 1, 7)} من 7)
          </span>
          <span className="text-xs font-semibold text-brand-teal px-2 py-0.5 bg-brand-teal-50 rounded-full">
            {STAGES_LIST[activeIndex]?.label || 'التأمل النهائي'}
          </span>
        </div>

        {/* Progress bar line */}
        <div className="w-full bg-brand-slate-100 rounded-full h-2 overflow-hidden flex">
          <div
            className="bg-brand-teal h-2 transition-all duration-500 rounded-full"
            style={{ width: `${((activeIndex + 1) / 7) * 100}%` }}
          />
        </div>

        {/* Responsive steps dots */}
        <div className="hidden sm:flex justify-between items-center mt-2.5 px-1">
          {STAGES_LIST.map((stg, idx) => {
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            return (
              <div key={stg.key} className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    isDone
                      ? 'bg-brand-teal text-white'
                      : isCurrent
                      ? 'bg-brand-navy text-white ring-2 ring-brand-teal ring-offset-1'
                      : 'bg-brand-slate-200 text-brand-slate-500'
                  )}
                >
                  {isDone ? '✓' : stg.step}
                </div>
                <span
                  className={clsx(
                    'text-[11px] mt-1 font-medium',
                    isCurrent ? 'text-brand-navy font-bold' : 'text-brand-slate-400'
                  )}
                >
                  {stg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
