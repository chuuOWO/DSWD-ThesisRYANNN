import React from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  buttonText?: string;
}

export function SuccessModal({
  isOpen,
  onClose,
  title = 'Successful!',
  message,
  buttonText = 'Done'
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-6 sm:p-7 text-center border border-gray-100 animate-in zoom-in-95 duration-150">
        {/* Soft Purple Badge with Clipboard Checklist Icon */}
        <div className="w-24 h-24 rounded-full bg-[#e3e4fa] flex items-center justify-center mx-auto mb-4.5 shadow-inner">
          <svg
            className="w-12 h-12 text-[#1e00a8]"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Clipboard Frame */}
            <rect x="10" y="11" width="28" height="33" rx="4" />
            {/* Clip at top */}
            <path d="M19 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
            {/* Checkmark 1 & line */}
            <path d="m16 21 2.5 2.5 4.5-4.5" />
            <path d="M26 21h6" />
            {/* Checkmark 2 & line */}
            <path d="m16 28 2.5 2.5 4.5-4.5" />
            <path d="M26 28h6" />
            {/* Checkmark 3 & line */}
            <path d="m16 35 2.5 2.5 4.5-4.5" />
            <path d="M26 35h6" />
          </svg>
        </div>

        {/* Heading */}
        <h3 className="text-xl font-bold text-[#1e00a8] tracking-tight">
          {title}
        </h3>

        {/* Message */}
        <p className="text-xs text-[#20008b]/85 leading-relaxed font-medium mt-2 mb-6 max-w-[260px] mx-auto break-words">
          {message}
        </p>

        {/* Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#1e00a8] text-white font-bold text-sm shadow-md hover:bg-[#150080] transition active:scale-98 cursor-pointer"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
