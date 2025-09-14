import React from 'react';
import { X } from 'lucide-react';

export function HealthChip({
  text,
  variant = 'default',
  onRemove,
}: {
  text: string;
  variant?: 'default' | 'present' | 'absent';
  onRemove?: () => void;
}) {
  const bgColor =
    variant === 'present'
      ? 'bg-green-700/50'
      : variant === 'absent'
      ? 'bg-red-700/50'
      : 'bg-slate-700/50';

  return (
    <div className={`${bgColor} px-2 py-1 rounded-md text-slate-200 text-sm inline-flex items-center gap-2`}>
      <span className="truncate max-w-[220px]">{text}</span>
      {onRemove && (
        <button aria-label="Remove" className="rounded-full p-0.5 hover:bg-slate-600/60 text-slate-100" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}


