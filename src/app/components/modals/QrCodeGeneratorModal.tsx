import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  Check, 
  Copy, 
  Download, 
  ExternalLink, 
  Layers, 
  Printer, 
  QrCode as QrCodeIcon, 
  RefreshCw, 
  Shield, 
  ShieldCheck, 
  Sparkles, 
  Truck, 
  X 
} from 'lucide-react';
import type { OutgoingRelease } from '../../hooks/useInventoryState';
import { PANAY_LGUS } from '../../lib/lguCoordinates';

interface QrCodeGeneratorModalProps {
  releases?: OutgoingRelease[];
  initialRelease?: OutgoingRelease | null;
  onClose?: () => void;
  isFullPage?: boolean;
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
  isFullPage = false
}: QrCodeGeneratorModalProps) {
  const [selectedDr, setSelectedDr] = useState<string>(initialRelease?.drNumber || releases[0]?.drNumber || '');

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derive active release from outgoing releases
  const currentRelease = useMemo(() => {
    return releases.find(r => r.drNumber === selectedDr) || initialRelease || releases[0] || null;
  }, [selectedDr, releases, initialRelease]);

  // Construct Payload for Receiver App
  const payload: ThesisQrPayload | null = useMemo(() => {
    if (!currentRelease) return null;

    const batchIds = currentRelease.allocatedBatches?.map(b => b.batchTokenId) || [`BATCH-${currentRelease.drNumber}`];
    const batchQtys = currentRelease.allocatedBatches?.map(b => b.quantity) || [currentRelease.amountApproved || currentRelease.amountRequested || 100];
    const qty = currentRelease.amountApproved || currentRelease.amountRequested || 100;
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
        const found = PANAY_LGUS.find((l) =>
          lguName.toLowerCase().includes(l.canonicalName.toLowerCase()) ||
          l.canonicalName.toLowerCase().includes(lguName.toLowerCase()) ||
          l.aliases.some((a) => lguName.toLowerCase().includes(a))
        );
        if (found) {
          releaseCoords = found.position;
        }
      }
    }
    
    return {
      drNumber: currentRelease.drNumber,
      handoverContractId: currentRelease.handoverContractId || `HANDOVER-${currentRelease.drNumber}`,
      category: currentRelease.fnfiCategory || 'Food Pack',
      quantity: qty,
      batchTokenIds: batchIds.length > 0 ? batchIds : [`BATCH-${currentRelease.drNumber}`],
      batchQuantities: batchQtys.length > 0 ? batchQtys : [qty],
      from: currentRelease.warehouseSource || 'DSWD Oton Main Warehouse',
      to: currentRelease.destinationAddress || currentRelease.lguName || 'Assigned LGU',
      destinationCoords: releaseCoords,
      blockchain: {
        status: 'Direct Manifest Scan',
        network: 'Sepolia Testnet (Chain ID 11155111)',
        contractAddress: (import.meta as any).env?.VITE_HANDOVER_CONTRACT_ADDRESS || '0x91c976fEe18761d8331d759D24987Ab65ec486A1',
        tokenStandard: 'ERC-1155 Multi-Token Relief Handover',
        merkleRootHash: `0x${Array.from(currentRelease.drNumber + qty).reduce((acc, char) => acc + char.charCodeAt(0).toString(16), '').padEnd(64, 'a').slice(0, 64)}`,
        txHash: currentRelease.blockchainTxHash || null
      }
    };
  }, [currentRelease]);

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
    link.download = `QR-${payload.drNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const packagingDate = currentRelease?.dateAllocated || new Date().toISOString().split('T')[0];
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CARGO STICKER - ${payload?.drNumber}</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0.2in;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              margin: 0;
              padding: 10px;
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .cargo-label {
              border: 3px solid #000;
              padding: 12px;
              height: calc(100% - 24px);
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .header-bar {
              display: flex;
              align-items: center;
              gap: 10px;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
            }
            .seal {
              width: 50px;
              height: 50px;
              object-contain: fit;
            }
            .agency-title {
              font-size: 11px;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              line-height: 1.2;
            }
            .sub-title {
              font-size: 9px;
              font-weight: 700;
              color: #333;
            }
            .manifest-badge {
              margin-top: 8px;
              background: #000;
              color: #fff;
              padding: 4px 8px;
              font-size: 13px;
              font-weight: 900;
              font-family: monospace;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .qr-container {
              text-align: center;
              margin: 8px 0;
              padding: 6px;
              border: 1px dashed #000;
            }
            .qr-container img {
              width: 170px;
              height: 170px;
              display: block;
              margin: 0 auto;
            }
            .tamper-text {
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 4px;
            }
            .data-grid {
              font-size: 10px;
              border-top: 2px solid #000;
              padding-top: 6px;
              line-height: 1.4;
            }
            .data-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .data-label {
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9px;
              color: #444;
            }
            .data-val {
              font-weight: 900;
              font-size: 11px;
            }
            .footer-strip {
              border-top: 1px solid #000;
              padding-top: 4px;
              font-size: 8px;
              font-family: monospace;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="cargo-label">
            <div>
              <div class="header-bar">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg" class="seal" alt="DSWD Seal" />
                <div>
                  <div class="agency-title">DSWD FIELD OPERATIONS</div>
                  <div class="sub-title">RELIEF CARGO DISPATCH MANIFEST</div>
                </div>
              </div>
              <div class="manifest-badge">
                <span>MANIFEST REF:</span>
                <span>${payload?.drNumber}</span>
              </div>
            </div>

            <div class="qr-container">
              <img src="${qrDataUrl}" alt="Cargo QR" />
              <div class="tamper-text">TAMPER-EVIDENT PHYSICAL QR STICKER</div>
            </div>

            <div class="data-grid">
              <div class="data-row">
                <span class="data-label">Item Category:</span>
                <span class="data-val">${payload?.category}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Pack Quantity:</span>
                <span class="data-val">${payload?.quantity.toLocaleString()} Units</span>
              </div>
              <div class="data-row">
                <span class="data-label">Destination LGU:</span>
                <span class="data-val">${payload?.to}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Dispatched By:</span>
                <span class="data-val">${payload?.from}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Packaging Date:</span>
                <span class="data-val">${packagingDate}</span>
              </div>
            </div>

            <div class="footer-strip">
              <span>LEDGER: SEPOLIA (11155111)</span>
              <span>CUSTODIAL HANDOVER READY</span>
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

  const isCompleted = Boolean(
    currentRelease && ['Delivered', 'Accepted', 'Distributed'].includes(currentRelease.deliveryStatus)
  );

  const content = (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Left Column: Form & Configuration */}
      <div className="flex-1 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-blue-700 font-bold text-lg">
            <QrCodeIcon className="w-6 h-6" />
            <h2>Thesis Relief Goods QR Code Generator</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Generates a scannable manifest QR code directly compatible with the <strong>Receiver / Trucker App</strong>. It provides immediate manifest details on scan, with a dedicated slot reserved for blockchain smart contracts.
          </p>
        </div>

        {/* Outgoing Release Selection */}
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <label className="block text-xs font-bold text-gray-700">
            Select Outgoing Release DR
          </label>
          {releases.length === 0 ? (
            <p className="text-xs text-amber-600">No outgoing releases found. Please create and approve an outgoing release first.</p>
          ) : (
            <select
              value={selectedDr}
              onChange={(e) => setSelectedDr(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none"
            >
              {releases.map((r) => (
                <option key={r.drNumber} value={r.drNumber}>
                  {r.drNumber} — {r.lguName} ({r.amountApproved || r.amountRequested} {r.fnfiCategory}) [{r.deliveryStatus}]
                </option>
              ))}
            </select>
          )}

          {currentRelease && (
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 pt-2 border-t border-gray-200">
              <div><span className="font-semibold text-gray-800">Destination:</span> {currentRelease.lguName}</div>
              <div><span className="font-semibold text-gray-800">Status:</span> {currentRelease.deliveryStatus}</div>
              <div><span className="font-semibold text-gray-800">Quantity:</span> {currentRelease.amountApproved || currentRelease.amountRequested} kits</div>
              <div><span className="font-semibold text-gray-800">Origin:</span> {currentRelease.warehouseSource}</div>
            </div>
          )}
        </div>

        {/* Dedicated Blockchain Manifest Slot */}
        {payload && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Blockchain Verification Layer</span>
              </div>
              <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">
                Smart Contract Ready
              </span>
            </div>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              This QR code contains the full manifest payload ready for <strong>Receiver View scan</strong> and cryptographic signing on Sepolia:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/80 rounded-lg p-2.5 border border-indigo-100 font-mono text-gray-700">
              <div>
                <span className="text-gray-400 block">Target Network:</span>
                <span className="font-bold text-indigo-900">{payload.blockchain.network}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Token Standard:</span>
                <span className="font-bold text-indigo-900">{payload.blockchain.tokenStandard}</span>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-gray-400 block">Contract Address:</span>
                <span className="text-gray-900">{payload.blockchain.contractAddress}</span>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-gray-400 block">Merkle Manifest Hash:</span>
                <span className="text-gray-900">{payload.blockchain.merkleRootHash}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Scannable QR Display & Actions */}
      <div className="w-full lg:w-96 flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-6 border border-gray-200">
        <div className="text-center mb-3">
          <span className={`inline-block rounded-full text-[10px] font-bold px-3 py-1 uppercase tracking-wider mb-1 ${
            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {isCompleted ? 'Completed Shipment' : 'Official Manifest QR'}
          </span>
          <h3 className="text-base font-extrabold text-gray-900">{payload?.drNumber || 'No Release'}</h3>
          <p className="text-xs text-gray-500">{payload?.category} &bull; {payload?.quantity.toLocaleString()} kits &rarr; {payload?.to}</p>
        </div>

        {/* QR Code Canvas / Image */}
        <div className={`relative p-4 bg-white rounded-2xl shadow-md border-2 ${
          isCompleted ? 'border-emerald-500/30 opacity-90' : 'border-blue-600/30'
        }`}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${payload?.drNumber}`}
              className="w-56 h-56 object-contain rounded-lg"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-gray-400 text-xs">
              {releases.length === 0 ? 'No Release Available' : 'Generating QR Code...'}
            </div>
          )}
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow ${
            isCompleted ? 'bg-emerald-700' : 'bg-blue-700'
          }`}>
            {isCompleted ? 'Completed — QR Closed' : 'Ready for Receiver Scan'}
          </div>
        </div>

        <p className="text-[11px] text-gray-500 text-center mt-4 px-2">
          {isCompleted ? (
            <span className="text-emerald-700 font-semibold">
              This shipment has been accepted into inventory. The delivery cycle is complete and this QR code is closed.
            </span>
          ) : (
            <>
              Scan with the <strong>Receiver View Scanner</strong> to accept custody and record cryptographic proof on-chain.
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
          >
            <Download size={13} />
            Download PNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-800 px-3 py-2 text-xs font-bold text-white shadow hover:bg-gray-900 transition"
          >
            <Printer size={13} />
            Print Cargo Sticker (4x6)
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
    </div>
  );

  if (isFullPage) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition"
          >
            <X size={18} />
          </button>
        )}
        {content}
      </div>
    </div>
  );
}

