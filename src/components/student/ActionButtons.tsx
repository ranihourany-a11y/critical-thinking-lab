import React from 'react';
import { Button } from '../shared/Button';

export interface ActionButtonsProps {
  onAction: (kind: 'clarification' | 'question' | 'hint') => void;
  hintCount: number;
  maxHints?: number;
  disabled?: boolean;
}

export function ActionButtons({
  onAction,
  hintCount,
  maxHints = 3,
  disabled = false,
}: ActionButtonsProps) {
  const remainingHints = Math.max(0, maxHints - hintCount);

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onAction('clarification')}
        className="text-xs font-semibold hover:border-brand-teal hover:text-brand-teal bg-white"
      >
        💡 طلب توضيح
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onAction('question')}
        className="text-xs font-semibold hover:border-brand-teal hover:text-brand-teal bg-white"
      >
        ❓ اطرح سؤالاً
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || remainingHints <= 0}
        onClick={() => onAction('hint')}
        className="text-xs font-semibold hover:border-brand-amber hover:text-brand-amber bg-white"
      >
        <span>🎯 أحتاج تلميحاً</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-brand-amber-50 text-brand-amber-700 rounded-full font-bold">
          {remainingHints} متبقية
        </span>
      </Button>
    </div>
  );
}
