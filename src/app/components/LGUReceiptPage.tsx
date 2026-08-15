import { useMemo, useState } from 'react';
import { CheckCircle, FileSignature, PackageCheck, ShieldCheck } from 'lucide-react';
import type { OutgoingRelease } from '../hooks/useInventoryState';
import type { UserProfile } from '../services/authApi';

interface LGUReceiptPageProps {
  profile: UserProfile;
  releases: OutgoingRelease[];
  onAccept: (drNumber: string) => Promise<{ ok: boolean; message: string }>;
  onSignOut: () => void;
}

export function LGUReceiptPage({ profile, releases, onAccept, onSignOut }: LGUReceiptPageProps) {
  const [activeDr, setActiveDr] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const receiptQueue = useMemo(() => {
    const normalizedLgu = (profile.lguName ?? '').trim().toLowerCase();

    return releases.filter((release) => {
      const isReady = ['Released', 'In Transit', 'Delivered'].includes(release.deliveryStatus);
      const matchesLgu = !normalizedLgu || release.lguName.toLowerCase().includes(normalizedLgu);
      return isReady && matchesLgu;
    });
  }, [profile.lguName, releases]);

  const handleAccept = async (drNumber: string) => {
    setActiveDr(drNumber);
    setMessage(null);

    const result = await onAccept(drNumber);
    setMessage({ ok: result.ok, text: result.message });
    setActiveDr(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-md min-h-[calc(100vh-2rem)] bg-white border border-gray-200 rounded-[28px] shadow-sm overflow-hidden flex flex-col">
        <div className="bg-blue-800 text-white p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-100">LGU Receipt View</p>
            <h1 className="text-lg font-bold">{profile.lguName || profile.fullName || 'LGU User'}</h1>
          </div>
          <button type="button" onClick={onSignOut} className="h-9 px-3 rounded-lg bg-white/10 text-xs font-bold hover:bg-white/20">
            Sign Out
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-blue-900">
              Confirm package custody with MetaMask once the truck arrives. GPS is not required for this role right now.
            </p>
          </div>

          {message && (
            <div className={`rounded-lg border p-4 text-sm font-semibold ${message.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-3">
            {receiptQueue.length === 0 && (
              <div className="rounded-lg border border-gray-200 p-6 text-center">
                <PackageCheck className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="font-bold text-gray-900">No receipt queue yet</p>
                <p className="text-sm text-gray-500 mt-1">Released deliveries assigned to this LGU will appear here.</p>
              </div>
            )}

            {receiptQueue.map((release) => (
              <div key={release.drNumber} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">{release.drNumber}</p>
                    <h2 className="font-bold text-gray-900">{release.lguName}</h2>
                    <p className="text-sm text-gray-600">{release.amountApproved || release.amountRequested} {release.fnfiCategory}</p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{release.deliveryStatus}</span>
                </div>

                {release.receiverSignature ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-bold text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    Receipt already signed
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={activeDr === release.drNumber}
                    onClick={() => handleAccept(release.drNumber)}
                    className="w-full h-11 rounded-lg bg-blue-700 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-800 disabled:opacity-60"
                  >
                    <FileSignature className="w-4 h-4" />
                    {activeDr === release.drNumber ? 'Opening MetaMask...' : 'Sign Receipt'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
