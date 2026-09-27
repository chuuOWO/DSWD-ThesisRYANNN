import { LogOut, X } from 'lucide-react';

interface ConfirmLogoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export function ConfirmLogoutModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Sign Out',
  message = 'Are you sure you want to sign out of your account?'
}: ConfirmLogoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <LogOut className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{message}</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 shadow-md transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

