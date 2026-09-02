import React from 'react';

export interface ConfidenceSliderProps {
  value: number; // 1 to 5
  onChange: (value: number) => void;
  label?: string;
  id?: string;
}

export function ConfidenceSlider({
  value,
  onChange,
  label = 'مستوى الثقة في الموقف (1 إلى 5):',
  id = 'confidence-slider',
}: ConfidenceSliderProps) {
  const levels = [
    { num: 1, label: 'غير متأكد تماماً' },
    { num: 2, label: 'أميل إلى هذا الرأي' },
    { num: 3, label: 'واثق بدرجة متوسطة' },
    { num: 4, label: 'واثق جداً' },
    { num: 5, label: 'شديد اليقين بناءً على الأدلة' },
  ];

  return (
    <div className="w-full space-y-3 p-4 bg-brand-slate-100 rounded-xl border border-brand-slate-200">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-bold text-brand-navy">
          {label}
        </label>
        <span className="text-base font-extrabold text-brand-teal px-3 py-1 bg-white rounded-lg border border-brand-teal-200">
          {value} من 5
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-3 bg-brand-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-teal min-h-[44px]"
      />

      <div className="flex justify-between items-center text-xs font-semibold text-brand-slate-600 px-1">
        {levels.map((lvl) => (
          <button
            type="button"
            key={lvl.num}
            onClick={() => onChange(lvl.num)}
            className={`cursor-pointer transition-colors text-center px-2 py-1 rounded-md min-h-[32px] ${
              value === lvl.num ? 'bg-brand-teal text-white font-bold' : 'hover:text-brand-teal'
            }`}
          >
            {lvl.num} - {lvl.label}
          </button>
        ))}
      </div>
    </div>
  );
}
