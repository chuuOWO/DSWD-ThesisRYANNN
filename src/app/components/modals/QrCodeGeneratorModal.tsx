import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  Check, 
  Copy, 
  Download, 
  Printer, 
  QrCode as QrCodeIcon, 
  X 
} from 'lucide-react';
import type { OutgoingRelease } from '../../hooks/useInventoryState';
import type { LguRecord } from '../../services/backendApi';
import { findMatchingLgu } from '../../lib/lguMatching';
import { formatOutgoingReference } from '../../lib/referenceCodeHelper';

interface QrCodeGeneratorModalProps {
  releases?: OutgoingRelease[];
  initialRelease?: OutgoingRelease | null;
  onClose?: () => void;
  isFullPage?: boolean;
  lgusList?: LguRecord[];
}

export interface ThesisQrPayload {
  drNumber: string;
  handoverContractId: string;
  category: string;
  quantity: number;
  batchTokenIds: string[];
  batchQuantities: number[];
  from: string;
  to: string;
  destinationCoords?: [number, number];
  // Reserved space for blockchain integration
  blockchain: {
    status: string;
    network: string;
    contractAddress: string;
    tokenStandard: string;
    merkleRootHash: string;
    txHash: string | null;
  };
}

export function QrCodeGeneratorModal({
  releases = [],
  initialRelease,
  onClose,
  isFullPage = false,
  lgusList = []
}: QrCodeGeneratorModalProps) {
  const [selectedDr, setSelectedDr] = useState<string>(initialRelease?.drNumber || releases[0]?.drNumber || '');

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Stable snapshot of releases to prevent real-time mobile scans from redrawing or flickering the QR canvas
  const releaseSnapshotRef = useRef<Record<string, OutgoingRelease>>({});

  // Derive active release from outgoing releases with snapshot stability
  const currentRelease = useMemo(() => {
    if (selectedDr && releaseSnapshotRef.current[selectedDr]) {
      return releaseSnapshotRef.current[selectedDr];
    }
    const found = releases.find(r => r.drNumber === selectedDr) || initialRelease || releases[0] || null;
    if (found) {
      releaseSnapshotRef.current[found.drNumber] = found;
    }
    return found;
  }, [selectedDr, initialRelease]);

  // Construct Payload for Receiver App
  const payload: ThesisQrPayload | null = useMemo(() => {
    if (!currentRelease) return null;

    const rawQty = Number(currentRelease.amountApproved || currentRelease.amountRequested || 0);
    // Strict data-integrity safeguard: missing or non-positive quantity must not silently fallback to 100
    if (!rawQty || rawQty <= 0 || isNaN(rawQty)) {
      return null;
    }
    const qty = rawQty;

    const canonicalIncCode = formatOutgoingReference(currentRelease);
    const cleanCode = canonicalIncCode.replace(/[^a-zA-Z0-9]/g, '');
    let batchIds: string[];
    let batchQtys: number[];

    if (currentRelease.allocatedBatches && currentRelease.allocatedBatches.length > 0) {
      const validBatches = currentRelease.allocatedBatches.filter(b => b && b.batchTokenId);
      if (validBatches.length === 1) {
        batchIds = [validBatches[0].batchTokenId];
        batchQtys = [qty];
      } else if (validBatches.length > 1) {
        let remaining = qty;
        batchIds = [];
        batchQtys = [];
        for (let i = 0; i < validBatches.length; i++) {
          if (remaining <= 0) break;
          const b = validBatches[i];
          batchIds.push(b.batchTokenId);
          if (i === validBatches.length - 1) {
            batchQtys.push(remaining);
            remaining = 0;
          } else {
            const rawQ = Number(b.quantity) || 0;
            const takeQ = Math.min(rawQ > 0 ? rawQ : Math.floor(qty / validBatches.length), remaining);
            const finalQ = takeQ > 0 ? takeQ : 1;
            batchQtys.push(finalQ);
            remaining -= finalQ;
          }
        }
        if (remaining > 0 && batchQtys.length > 0) {
          batchQtys[batchQtys.length - 1] += remaining;
        }
      } else {
        batchIds = [`BATCH-${cleanCode}`];
        batchQtys = [qty];
      }
    } else {
      batchIds = [`BATCH-${cleanCode}`];
      batchQtys = [qty];
    }
    let releaseCoords: [number, number] | undefined = undefined;
    if (currentRelease.receiverGps) {
      const parts = currentRelease.receiverGps.split(',').map((s) => Number(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        releaseCoords = [parts[0], parts[1]];
      }
    }

    if (!releaseCoords) {
      const lguName = currentRelease.destinationAddress || currentRelease.lguName || currentRelease.municipality;
      if (lguName) {
        const found = findMatchingLgu(lgusList, lguName, currentRelease.province);
        if (found) {
          releaseCoords = [found.latitude, found.longitude];
        }
      }
    }
    
    return {
      drNumber: canonicalIncCode,
      handoverContractId: currentRelease.handoverContractId || `HANDOVER-${canonicalIncCode}`,
      category: currentRelease.fnfiCategory || 'Food Pack',
      quantity: qty,
      batchTokenIds: batchIds.length > 0 ? batchIds : [`BATCH-${canonicalIncCode}`],
      batchQuantities: batchQtys.length > 0 ? batchQtys : [qty],
      from: currentRelease.warehouseSource || 'DSWD Oton Main Warehouse',
      to: currentRelease.destinationAddress || currentRelease.lguName || 'Assigned LGU',
      destinationCoords: releaseCoords,
      blockchain: {
        status: 'Direct Manifest Scan',
        network: 'Sepolia Testnet (Chain ID 11155111)',
        contractAddress: (import.meta as any).env?.VITE_HANDOVER_CONTRACT_ADDRESS || (import.meta as any).env?.VITE_RELIEF_TRACKER_CONTRACT_ADDRESS || '',
        tokenStandard: 'ERC-1155 Multi-Token Relief Handover',
        merkleRootHash: `0x${Array.from(canonicalIncCode + qty).reduce((acc, char) => acc + char.charCodeAt(0).toString(16), '').padEnd(64, 'a').slice(0, 64)}`,
        txHash: currentRelease.blockchainTxHash || null
      }
    };
  }, [currentRelease, lgusList]);

  const jsonString = useMemo(() => (payload ? JSON.stringify(payload, null, 2) : ''), [payload]);

  // Generate QR Code image from manifest JSON
  useEffect(() => {
    if (!jsonString) {
      setQrDataUrl('');
      return;
    }
    let isCancelled = false;
    QRCode.toDataURL(jsonString, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (!isCancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [jsonString]);

  const handleCopy = () => {
    if (!jsonString) return;
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${payload?.drNumber || 'manifest'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!payload || !qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DSWD Manifest QR - ${payload.drNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 24px; color: #111; background: #fff; }
            .card { max-width: 440px; margin: 0 auto; border: 2px solid #1e40af; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .affix-banner { background: #fef3c7; border: 2px dashed #d97706; color: #92400e; font-weight: 800; font-size: 13px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; letter-spacing: 0.5px; text-transform: uppercase; }
            .affix-sub { font-size: 11px; font-weight: 500; color: #78350f; margin-top: 4px; text-transform: none; }
            h1 { font-size: 18px; color: #1e40af; margin: 0 0 4px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
            h2 { font-size: 14px; color: #4b5563; margin: 0 0 16px 0; font-weight: 600; }
            .qr-wrapper { display: inline-block; padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 16px; }
            img { width: 240px; height: 240px; display: block; }
            .details { text-align: left; font-size: 12px; line-height: 1.6; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .details strong { color: #1e293b; }
            .blockchain { margin-top: 12px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="affix-banner">
              AFFIX / PLACE ON GOODS
              <div class="affix-sub">Attach this official manifest voucher directly to relief goods cargo or pallet for field handover verification</div>
            </div>
            <h1>DSWD Relief Goods Manifest</h1>
            <h2>Allocation Reference: ${payload.drNumber}</h2>
            <div class="qr-wrapper">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
            <div class="details">
              <div><strong>Destination LGU:</strong> ${payload.to}</div>
              <div><strong>Category:</strong> ${payload.category}</div>
              <div><strong>Quantity:</strong> ${payload.quantity.toLocaleString()} kits</div>
              <div><strong>Origin:</strong> ${payload.from}</div>
              <div><strong>Handover ID:</strong> ${payload.handoverContractId}</div>
            </div>
            <div class="blockchain">
              <div><strong>Blockchain Network:</strong> ${payload.blockchain.network}</div>
              <div><strong>Contract:</strong> ${payload.blockchain.contractAddress}</div>
              <div><strong>Merkle Hash:</strong> ${payload.blockchain.merkleRootHash.slice(0, 24)}...</div>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isDroppedOff = Boolean(currentRelease && currentRelease.deliveryStatus === 'Delivered');
  const isCompleted = Boolean(
    currentRelease && ['Accepted', 'Distributed'].includes(currentRelease.deliveryStatus)
  );

  const content = (
    <div className="flex flex-col items-center p-5 sm:p-6 space-y-4">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-blue-700 font-bold text-base">
          <QrCodeIcon className="w-5 h-5 text-blue-600" />
          <h2>Official Manifest QR Voucher</h2>
        </div>
        <span className={`inline-block rounded-full text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider ${
          isCompleted
            ? 'bg-emerald-100 text-emerald-800'
            : isDroppedOff
            ? 'bg-purple-100 text-purple-900 border border-purple-200'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {isCompleted ? 'Completed' : isDroppedOff ? 'Dropped Off' : 'Active Dispatch'}
        </span>
      </div>

      {/* Release Selector if multiple releases and no initial release */}
      {!initialRelease && releases.length > 1 && (
        <div className="w-full">
          <label className="block text-[11px] font-bold text-gray-600 mb-1">Select Outgoing Release</label>
          <select
            value={selectedDr}
            onChange={(e) => setSelectedDr(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
          >
            {releases.map((r) => (
              <option key={r.drNumber} value={r.drNumber}>
                {formatOutgoingReference(r)} — {r.lguName} ({r.amountApproved || r.amountRequested} {r.fnfiCategory})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Release Identifier & Key Details */}
      <div className="w-full text-center">
        <h3 className="text-lg font-black text-gray-900 tracking-tight">
          {payload?.drNumber || (currentRelease ? formatOutgoingReference(currentRelease) : 'No Release Selected')}
        </h3>
        {payload ? (
          <p className="text-xs text-gray-600 mt-0.5">
            <span className="font-semibold text-gray-800">{payload.category}</span> &bull;{' '}
            <span className="font-semibold text-blue-700">{payload.quantity.toLocaleString()} kits</span> &rarr;{' '}
            <span className="font-semibold text-gray-900">{payload.to}</span>
          </p>
        ) : currentRelease ? (
          <p className="text-xs text-red-600 font-semibold mt-0.5">
            Missing valid quantity ({currentRelease.amountApproved || currentRelease.amountRequested || 0})
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">No release selected</p>
        )}
      </div>

      {/* PLACE ON GOODS INSTRUCTION CALLOUT */}
      <div className="w-full rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/90 px-3 py-2.5 text-center">
        <span className="block text-xs font-black tracking-wider text-amber-900 uppercase">
          PLACE / AFFIX ON GOODS
        </span>
        <p className="text-[11px] font-medium text-amber-800 mt-0.5 leading-snug">
          Print and attach this official QR voucher directly onto relief goods cargo or packaging prior to dispatch for field handover verification.
        </p>
      </div>

      {/* QR Code Canvas / Image Card */}
      <div className={`relative p-4 bg-white rounded-2xl shadow-sm border-2 ${
        isCompleted ? 'border-emerald-500/30 opacity-90' : isDroppedOff ? 'border-purple-600/40' : 'border-blue-600/30'
      }`}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR Code for ${payload?.drNumber}`}
            className="w-56 h-56 object-contain rounded-lg"
          />
        ) : (
          <div className="w-56 h-56 flex flex-col items-center justify-center p-4 text-center text-gray-400 text-xs">
            {currentRelease && !payload ? (
              <span className="text-red-600 font-medium">QR disabled: Please allocate a positive quantity for this release.</span>
            ) : releases.length === 0 ? (
              'No Release Available'
            ) : (
              'Generating QR Code...'
            )}
          </div>
        )}
        <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-white text-[9px] font-bold px-3 py-0.5 rounded-full shadow ${
          isCompleted ? 'bg-emerald-700' : isDroppedOff ? 'bg-purple-700' : 'bg-blue-700'
        }`}>
          {isCompleted
            ? 'Completed — QR Closed'
            : isDroppedOff
            ? 'Dropped Off — Ready for LGU Scan'
            : 'Ready for Receiver Scan'}
        </div>
      </div>

      {/* Scan Instructions */}
      <p className="text-[11px] text-gray-500 text-center px-2">
        {isCompleted ? (
          <span className="text-emerald-700 font-semibold">
            This shipment has been accepted into inventory. The delivery cycle is complete and this QR code is closed.
          </span>
        ) : isDroppedOff ? (
          <span className="text-purple-900 font-semibold">
            Shipment dropped off on location by escort officer. Scan with the <strong>LGU Receiver Scanner</strong> to confirm physical receipt and intake into inventory.
          </span>
        ) : (
          <>
            Scan with the <strong>Receiver View Scanner</strong> to accept custody and record cryptographic proof on-chain.
          </>
        )}
      </p>

      {/* Quick Metadata Chips */}
      {currentRelease && (
        <div className="w-full grid grid-cols-2 gap-2 text-[11px] bg-gray-50 rounded-xl p-2.5 border border-gray-200">
          <div>
            <span className="text-gray-500 block text-[10px]">Origin Warehouse:</span>
            <span className="font-semibold text-gray-800 truncate block">{currentRelease.warehouseSource || 'DSWD Oton Main Warehouse'}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Destination LGU:</span>
            <span className="font-semibold text-gray-800 truncate block">{currentRelease.lguName || 'Assigned LGU'}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="w-full grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
        >
          <Printer size={14} />
          Print Manifest
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-800 px-3 py-2.5 text-xs font-bold text-white shadow hover:bg-gray-900 transition"
        >
          <Download size={14} />
          Download PNG
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          {copied ? 'JSON Copied to Clipboard!' : 'Copy Raw QR JSON Payload'}
        </button>
      </div>
    </div>
  );

  if (isFullPage) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-w-md mx-auto">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[94vh] overflow-y-auto">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3.5 top-3.5 z-10 rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition"
          >
            <X size={18} />
          </button>
        )}
        {content}
      </div>
    </div>
  );
}

