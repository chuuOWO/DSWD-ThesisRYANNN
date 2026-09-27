'use client';

import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';

export interface FiveDotsLoadingModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
  speedMs?: number;
}

export function FiveDotsLoadingModal({
  isOpen,
  title = 'Loading...',
  subtitle = 'Please wait while we update your live status...',
  onComplete,
  speedMs = 280
}: FiveDotsLoadingModalProps) {
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setFilledCount(0);
      return;
    }

    const interval = setInterval(() => {
      setFilledCount((prev) => {
        if (prev >= 5) {
          if (onComplete) onComplete();
          return 5;
        }
        return prev + 1;
      });
    }, speedMs);

    return () => clearInterval(interval);
  }, [isOpen, onComplete, speedMs]);

  if (!isOpen) return null;

  // As requested: strictly say "Loading..." while filling in, and "Done!" on completion
  const statusText = filledCount < 5 ? 'Loading...' : 'Done!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 transition-all">
      <div className="w-full max-w-[290px] rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2500ba] to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <Radio size={26} className={filledCount < 5 ? 'animate-pulse' : ''} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h3>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{subtitle}</p>
        </div>

        {/* 5 Dots Filling In Animation */}
        <div className="flex items-center justify-center gap-2.5 py-1">
          {[1, 2, 3, 4, 5].map((dotNum) => {
            const isFilled = dotNum <= filledCount;
            return (
              <span
                key={dotNum}
                className={`h-3.5 w-3.5 rounded-full transition-all duration-300 transform ${
                  isFilled
                    ? 'bg-[#2500ba] scale-110 shadow-sm shadow-indigo-500/50 ring-2 ring-indigo-200'
                    : 'bg-slate-200 scale-90'
                }`}
              />
            );
          })}
        </div>

        <p className={`text-xs font-bold transition-all min-h-[18px] ${filledCount === 5 ? 'text-green-600' : 'text-[#2500ba]'}`}>
          {statusText}
        </p>
      </div>
    </div>
  );
}

