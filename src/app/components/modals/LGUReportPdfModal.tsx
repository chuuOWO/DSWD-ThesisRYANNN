import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  FileText,
  Building2,
  Package,
  Boxes,
  Clock,
  ShieldCheck,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import type { SynchronizedLgu } from '../../lib/lguSync';
import type { LGUTransaction, LGUExpiryLot } from './LGUDetailModal';
import { backendApi } from '../../services/backendApi';
import { EXPIRY_THRESHOLDS, getExpiryBadgeConfig } from '../../lib/expiryConstants';

export interface LGUReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  lgu: SynchronizedLgu;
  allTransactions: LGUTransaction[];
  allLots: LGUExpiryLot[];
  inventoryDates: Array<{
    category: string;
    onHand: number;
    lastIncomingDate: string | null;
    lastOutgoingDate: string | null;
  }>;
  fefoMetrics: {
    totalLots: number;
    criticalLots: number;
    criticalUnits: number;
    moderateLots: number;
    moderateUnits: number;
    safeLots: number;
    safeUnits: number;
    expiredLots: number;
    expiredUnits: number;
  };
  totalOnHand: number;
  totalInflow: number;
  totalOutflow: number;
  capacityPercent: number;
  maxStockCapacity: number;
}

export function LGUReportPdfModal({
  isOpen,
  onClose,
  lgu,
  allTransactions,
  allLots,
  inventoryDates,
  fefoMetrics,
  totalOnHand,
  totalInflow,
  totalOutflow,
  capacityPercent,
  maxStockCapacity
}: LGUReportPdfModalProps) {
  if (!isOpen || !lgu) return null;

  // Generate reference number & timestamp
  const reportDate = useMemo(() => {
    return new Date().toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, []);

  const reportRefNumber = useMemo(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const muniCode = (lgu.municipality || 'LGU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    const seq = Math.floor(1000 + Math.random() * 9000);
    return `DSWD-FO6-LGU-${muniCode}-${yr}${mo}${day}-${seq}`;
  }, [lgu.municipality]);

  const handlePrint = () => {
    backendApi.logActivity({
      action: 'EXPORT_LGU_REPORT',
      entityType: 'LguReport',
      entityId: reportRefNumber,
      actorName: 'System Administrator',
      actorRole: 'dswd_admin',
      details: `Exported official relief logistics & inventory PDF audit report (${reportRefNumber}) for ${lgu.municipality}, ${lgu.province}.`,
      metadata: {
        reportRefNumber,
        lguId: lgu.id,
        municipality: lgu.municipality,
        province: lgu.province,
        totalOnHand,
        totalLots: allLots.length,
        criticalLots: fefoMetrics.criticalLots
      }
    }).catch(() => {});

    window.print();
  };

  const portalContent = (
    <div id="lgu-pdf-modal-portal">
      {/* Print Stylesheet strictly suppressing #root and enforcing pristine A4 output */}
      <style>{`
        @media print {
          /* 1. Completely hide the main application root */
          #root {
            display: none !important;
          }

          /* 2. Reset html and body for clean A4 printing */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* 3. Hide all interactive controls, overlays, backdrops */
          .no-print {
            display: none !important;
          }

          /* 4. Reset modal wrapper to static document flow */
          #lgu-pdf-modal-portal {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          #lgu-pdf-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }

          #lgu-pdf-modal-container {
            position: static !important;
            max-width: 100% !important;
            max-height: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            display: block !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #printable-lgu-report-wrapper {
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-page {
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }

          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>

      {/* Screen Backdrop */}
      <div
        id="lgu-pdf-modal-backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
      >
        <div
          id="lgu-pdf-modal-container"
          className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none"
        >
          {/* Modal Controls Header (Hidden in Print) */}
          <div className="no-print flex items-center justify-between px-6 py-4 bg-gray-900 text-white border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Official LGU Disaster Relief &amp; Inventory PDF Export
                </h2>
                <p className="text-[11px] text-gray-400">
                  {lgu.municipality}, {lgu.province} &bull; {allLots.length} FEFO lots &bull; {allTransactions.length} logged activities
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-[#2500ba] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
                title="Print or Save official PDF via system print dialog"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition cursor-pointer"
                title="Close PDF Export Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Printable Document Container */}
          <div
            id="printable-lgu-report-wrapper"
            className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100 print:bg-white print:p-0 print:overflow-visible space-y-6 print:space-y-4"
          >
            <div className="print-page w-full max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-lg border border-gray-200 text-gray-900 space-y-6 print:shadow-none print:border-none print:p-0 print:rounded-none">

              {/* 1. Official Republic of the Philippines Header */}
              <div className="border-b-2 border-blue-900 pb-3">
                <div className="flex items-center justify-between gap-4">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg"
                    alt="DSWD Seal"
                    className="h-16 w-16 object-contain shrink-0"
                  />
                  <div className="text-center flex-1">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-600">
                      Republic of the Philippines
                    </p>
                    <h1 className="text-sm font-black text-blue-900 uppercase tracking-tight sm:text-base leading-tight">
                      Department of Social Welfare and Development
                    </h1>
                    <p className="text-xs font-bold text-gray-800">
                      Field Office VI &mdash; Western Visayas
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Disaster Response Management Division (DRMD) &bull; Regional Relief Operations Hub
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="inline-block border border-blue-900 px-2 py-1 rounded text-[9px] font-bold text-blue-900 uppercase">
                      Official Audit Copy
                    </div>
                    <p className="text-[9px] font-mono text-gray-500 mt-1">{reportRefNumber}</p>
                  </div>
                </div>
              </div>

              {/* 2. Document Title Banner */}
              <div className="text-center py-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                <h2 className="text-xs sm:text-sm font-black text-blue-950 uppercase tracking-wider">
                  Local Government Unit (LGU) Relief Inventory &amp; Logistics Audit Report
                </h2>
                <p className="text-[11px] font-semibold text-blue-800 mt-0.5">
                  Prepositioned Disaster Buffer Stock, Inflow/Outflow Ledger &amp; FEFO Shelf-Life Schedule
                </p>
              </div>

              {/* 3. LGU Information & Scope Summary Block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-gray-500">Municipality / City</span>
                  <span className="font-bold text-gray-900 text-sm">{lgu.municipality}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-gray-500">Province</span>
                  <span className="font-bold text-gray-800">{lgu.province}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-gray-500">LGU Code / ID</span>
                  <span className="font-mono font-bold text-purple-700">{lgu.id}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-gray-500">Report Date &amp; Time</span>
                  <span className="font-medium text-gray-800 text-[11px]">{reportDate}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] uppercase font-bold text-gray-500">Facility / Hall</span>
                  <span className="font-medium text-gray-800">{lgu.lguName}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] uppercase font-bold text-gray-500">LGU Relief Contact</span>
                  <span className="font-medium text-gray-800">
                    {lgu.contactPerson || 'Disaster Response Officer'} {lgu.contactNumber ? `(${lgu.contactNumber})` : ''}
                  </span>
                </div>
              </div>

              {/* 4. Executive Key Performance Metrics (KPIs) */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  1. Executive Stockpile &amp; Logistics Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <span className="text-[10px] font-bold text-purple-800 uppercase block">On-Hand Stock</span>
                    <p className="text-xl font-black text-purple-950 mt-0.5">{totalOnHand.toLocaleString()} kits</p>
                    <p className="text-[10px] text-purple-700 mt-0.5">
                      {capacityPercent}% of {maxStockCapacity.toLocaleString()} max buffer
                    </p>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                    <span className="text-[10px] font-bold text-green-800 uppercase block">Total Inflow Received</span>
                    <p className="text-xl font-black text-green-950 mt-0.5">{totalInflow.toLocaleString()} kits</p>
                    <p className="text-[10px] text-green-700 mt-0.5">
                      {allTransactions.filter((t) => t.type === 'Incoming').length} delivery receipts
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-800 uppercase block">Total Dispatched Outflow</span>
                    <p className="text-xl font-black text-blue-950 mt-0.5">{totalOutflow.toLocaleString()} kits</p>
                    <p className="text-[10px] text-blue-700 mt-0.5">
                      {allTransactions.filter((t) => t.type === 'Outgoing').length} outward distributions
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <span className="text-[10px] font-bold text-red-800 uppercase block">Critical Shelf-Life Lots</span>
                    <p className="text-xl font-black text-red-950 mt-0.5">{fefoMetrics.criticalLots} Lots</p>
                    <p className="text-[10px] text-red-700 mt-0.5">
                      {fefoMetrics.criticalUnits.toLocaleString()} units (&le; {EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS}d)
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. On-Hand Category Balance Breakdown */}
              <div className="page-break-avoid">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    2. On-Hand Relief Inventory by Commodity Category
                  </h3>
                  <span className="text-[10px] text-gray-500 font-medium">Authoritative Warehouse Balances</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-3.5 py-2.5">Commodity Category</th>
                        <th className="px-3.5 py-2.5 text-right">On-Hand Quantity</th>
                        <th className="px-3.5 py-2.5">Last Received Date</th>
                        <th className="px-3.5 py-2.5">Last Dispatched Date</th>
                        <th className="px-3.5 py-2.5 text-center">Buffer Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventoryDates.map((item) => (
                        <tr key={item.category} className="hover:bg-gray-50/50">
                          <td className="px-3.5 py-2 font-bold text-gray-900">{item.category}</td>
                          <td className="px-3.5 py-2 text-right font-mono font-bold text-purple-950">
                            {item.onHand.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2 text-gray-600 font-mono text-[11px]">
                            {item.lastIncomingDate || 'None recorded'}
                          </td>
                          <td className="px-3.5 py-2 text-gray-600 font-mono text-[11px]">
                            {item.lastOutgoingDate || 'None recorded'}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.onHand >= 500
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.onHand > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.onHand >= 500 ? 'Adequate' : item.onHand > 0 ? 'Low Stock' : 'Zero Stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. FEFO Inventory Lots & Expiration Schedule */}
              <div className="page-break-avoid">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    3. First-Expiry First-Out (FEFO) Stock Lots Schedule
                  </h3>
                  <span className="text-[10px] text-gray-500 font-medium">Batch Token &amp; Shelf-Life Ledger</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Lot Token ID</th>
                        <th className="px-3 py-2">Reference / DR</th>
                        <th className="px-3 py-2">Commodity</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2">Origin Facility</th>
                        <th className="px-3 py-2">Expiration Date</th>
                        <th className="px-3 py-2 text-center">Shelf-Life Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[11px]">
                      {allLots.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 text-center text-gray-500 italic">
                            No FEFO lots recorded for this facility
                          </td>
                        </tr>
                      ) : (
                        allLots.slice(0, 15).map((lot) => {
                          const cfg = getExpiryBadgeConfig(lot.expiryTier);
                          return (
                            <tr key={lot.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-1.5 font-mono font-bold text-purple-950 truncate max-w-[120px]">
                                {lot.batchTokenId}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-gray-700">{lot.referenceCode}</td>
                              <td className="px-3 py-1.5 font-medium text-gray-900">{lot.category}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-gray-900">
                                {lot.quantity.toLocaleString()} {lot.unit}
                              </td>
                              <td className="px-3 py-1.5 text-gray-600 truncate max-w-[120px]">{lot.source}</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-gray-900">
                                {lot.expirationDate || 'Standard Reserve'}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {lot.expirationDate ? (
                                  <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${cfg.badgeClass}`}>
                                    {cfg.label} ({lot.daysRemaining > 0 ? `${lot.daysRemaining}d` : 'Expired'})
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[10px] italic">Stable Reserve</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {allLots.length > 15 && (
                    <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500 text-center font-medium">
                      Showing top 15 of {allLots.length} recorded inventory lots. Full dataset archived in audit database.
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Transactions History Ledger (Recent Deliveries) */}
              <div className="page-break-avoid">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    4. Recent Logistics Movements &amp; Delivery Receipts
                  </h3>
                  <span className="text-[10px] text-gray-500 font-medium">Complete Inflow &amp; Outflow History</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Flow</th>
                        <th className="px-3 py-2">Reference / DR</th>
                        <th className="px-3 py-2">Commodity Item</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2">Route / Origin</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[11px]">
                      {allTransactions.slice(0, 10).map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                tx.flowLabel === 'Outgoing Release (DR)' || (!tx.flowLabel && tx.referenceCode?.startsWith('DR-'))
                                  ? 'bg-blue-100 text-blue-800'
                                  : tx.flowLabel === 'Incoming Intake (RIS)' || tx.flowLabel === 'Intake (RIS)' || (!tx.flowLabel && (tx.type === 'Incoming' || tx.referenceCode?.startsWith('RIS-') || tx.referenceCode?.startsWith('INC-')))
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {tx.flowLabel || (tx.type === 'Outgoing' ? 'Outgoing Release (DR)' : 'Incoming Intake (RIS)')}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono font-bold text-gray-900">{tx.referenceCode}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800">{tx.category}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-gray-900">
                            {tx.quantity.toLocaleString()} {tx.unit}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 truncate max-w-[140px]" title={`${tx.source} -> ${tx.destination}`}>
                            {tx.source} &rarr; {tx.destination}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 font-mono text-[10px]">{tx.date || 'N/A'}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                tx.status === 'Delivered' || tx.status === 'Accepted'
                                  ? 'bg-green-100 text-green-800'
                                  : tx.status === 'In Transit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 8. Official Certification & Sign-Off Section */}
              <div className="page-break-avoid pt-4 border-t-2 border-gray-200">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-6">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                  <span>
                    Official electronic logistics audit certificate verified by DSWD Disaster Response Management System.
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  <div>
                    <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-900">
                      System Logistics Officer
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase block">Prepared By</span>
                    <span className="text-[9px] text-gray-400">DSWD Regional Hub FO-VI</span>
                  </div>

                  <div>
                    <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-900">
                      {lgu.contactPerson || 'LGU Disaster Coordinator'}
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase block">Verified By</span>
                    <span className="text-[9px] text-gray-400">{lgu.municipality} Disaster Office</span>
                  </div>

                  <div>
                    <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-900">
                      Regional Director / Division Chief
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase block">Approved By</span>
                    <span className="text-[9px] text-gray-400">DSWD Field Office VI</span>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                  <span>CONFIDENTIAL &bull; FOR OFFICIAL DISASTER RESPONSE AUDIT PURPOSES ONLY</span>
                  <span>PAGE 1 OF 1 &bull; {reportRefNumber}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(portalContent, document.body) : null;
}

