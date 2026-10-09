'use client';

import { useEffect, useState } from 'react';
import { Radio, X } from 'lucide-react';

export interface FiveDotsLoadingModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
  onRetry?: () => void;
  onClose?: () => void;
  speedMs?: number;
}

export function FiveDotsLoadingModal({
  isOpen,
  title = 'Loading...',
  subtitle = 'Please wait while we update your live status...',
  onComplete,
  onRetry,
  onClose,
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
          return 1; // loop back so it keeps pulsing while waiting for transaction confirmation
        }
        return prev + 1;
      });
    }, speedMs);

    return () => clearInterval(interval);
  }, [isOpen, onComplete, speedMs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 transition-all">
      <div className="relative w-full max-w-[290px] rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        )}

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2500ba] to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <Radio size={26} className="animate-pulse" />
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

        {/* Click to try again option */}
        {onRetry && (
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-bold text-[#2500ba] hover:underline cursor-pointer block mx-auto py-1"
            >
              Click to try again
            </button>
            <p className="text-[10px] text-slate-400">If the transaction is taking longer than expected</p>
          </div>
        )}
      </div>
    </div>
  );
}

