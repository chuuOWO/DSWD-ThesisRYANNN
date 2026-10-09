import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  FileText,
  Building2,
  Package,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import type { UserProfile } from '../../services/authApi';
import { backendApi } from '../../services/backendApi';

export interface InventoryReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Selected Filter Configuration
  facilityScope: 'main' | 'oton' | 'pototan' | 'all' | 'lgu';
  selectedLguFilter: string;
  selectedCategory: string;
  searchQuery: string;
  stockHealthFilter: 'all' | 'low' | 'expiring' | 'optimal';
  // Filtered and aggregated datasets
  filteredData: Array<{
    category: string;
    warehouseA: number;
    warehouseB: number;
    totalStock: number;
    released: number;
    available: number;
    expiringItems: number;
    lguTotal?: number;
    grandTotal?: number;
    selectedLguStock?: number;
  }>;
  allData: Array<{
    category: string;
    warehouseA: number;
    warehouseB: number;
    totalStock: number;
    released: number;
    available: number;
    expiringItems: number;
    lguTotal?: number;
    grandTotal?: number;
    selectedLguStock?: number;
  }>;
  lowStockItems: Array<{
    category: string;
    available: number;
  }>;
  totalExpiring: number;
  warehouseATotal: number;
  warehouseBTotal: number;
  totalMainWarehouse: number;
  totalLGUWarehouse: number;
  totalReleased: number;
  adminProfile?: UserProfile | null;
}

export function InventoryReportPdfModal({
  isOpen,
  onClose,
  facilityScope,
  selectedLguFilter,
  selectedCategory,
  searchQuery,
  stockHealthFilter,
  filteredData,
  allData,
  lowStockItems,
  totalExpiring,
  warehouseATotal,
  warehouseBTotal,
  totalMainWarehouse,
  totalLGUWarehouse,
  totalReleased,
  adminProfile
}: InventoryReportPdfModalProps) {
  if (!isOpen) return null;

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
    const seq = Math.floor(1000 + Math.random() * 9000);
    return `DSWD-FO6-INV-${yr}${mo}${day}-${seq}`;
  }, []);

  // Compute Human-readable Scope Summary
  const filterScopeText = useMemo(() => {
    let scopeText = 'Main Regional Warehouses (Oton & Pototan Hubs)';
    if (facilityScope === 'oton') {
      scopeText = 'Oton Main Warehouse Hub Only (Western Panay)';
    } else if (facilityScope === 'pototan') {
      scopeText = 'Pototan Main Warehouse Hub Only (Central Panay)';
    } else if (facilityScope === 'all') {
      scopeText = 'Consolidated Regional Facilities (Main Hubs + All LGUs)';
    } else if (facilityScope === 'lgu') {
      scopeText = `LGU Prepositioned Stock Only ${selectedLguFilter !== 'All' ? `(${selectedLguFilter})` : '(All Municipalities)'}`;
    }

    let healthText = 'All Buffer Levels';
    if (stockHealthFilter === 'low') {
      healthText = 'Low Stock Buffer (< 500 units)';
    } else if (stockHealthFilter === 'expiring') {
      healthText = 'Expiring Soon (<= 30 Days)';
    } else if (stockHealthFilter === 'optimal') {
      healthText = 'Adequate Buffer (>= 500 units)';
    }

    return {
      scope: scopeText,
      lgu: selectedLguFilter === 'All' ? 'All Municipalities (Panay Island)' : selectedLguFilter,
      category: selectedCategory === 'All' ? 'All Commodity Categories' : selectedCategory,
      health: healthText,
      search: searchQuery.trim() ? `"${searchQuery.trim()}"` : 'None (All Items)'
    };
  }, [facilityScope, selectedLguFilter, selectedCategory, stockHealthFilter, searchQuery]);

  // Aggregate Filtered Totals
  const filteredTotals = useMemo(() => {
    const totalOton = filteredData.reduce((sum, item) => sum + (item.warehouseA || 0), 0);
    const totalPototan = filteredData.reduce((sum, item) => sum + (item.warehouseB || 0), 0);
    const totalHubStock = filteredData.reduce((sum, item) => sum + (item.totalStock || 0), 0);
    const totalLguPrepositioned = filteredData.reduce((sum, item) => sum + (item.selectedLguStock ?? item.lguTotal ?? 0), 0);
    const grandConsolidated = filteredData.reduce((sum, item) => sum + (item.grandTotal ?? (item.totalStock + (item.lguTotal || 0))), 0);
    const totalDispatched = filteredData.reduce((sum, item) => sum + (item.released || 0), 0);

    const totalAvailable = filteredData.reduce((sum, item) => {
      const activeBuffer =
        facilityScope === 'oton'
          ? item.warehouseA
          : facilityScope === 'pototan'
          ? item.warehouseB
          : facilityScope === 'lgu'
          ? (item.selectedLguStock || 0)
          : facilityScope === 'all'
          ? (item.grandTotal || item.totalStock)
          : item.totalStock;
      return sum + activeBuffer;
    }, 0);

    const totalFilteredExpiring = filteredData.reduce((sum, item) => sum + (item.expiringItems || 0), 0);
    const filteredLowStockCount = filteredData.filter((item) => {
      const buffer =
        facilityScope === 'oton'
          ? item.warehouseA
          : facilityScope === 'pototan'
          ? item.warehouseB
          : facilityScope === 'lgu'
          ? (item.selectedLguStock || 0)
          : facilityScope === 'all'
          ? (item.grandTotal || item.totalStock)
          : item.totalStock;
      return buffer < 500;
    }).length;

    return {
      totalOton,
      totalPototan,
      totalHubStock,
      totalLguPrepositioned,
      grandConsolidated,
      totalDispatched,
      totalAvailable,
      totalFilteredExpiring,
      filteredLowStockCount
    };
  }, [filteredData, facilityScope]);

  const handlePrint = () => {
    backendApi.logActivity({
      action: 'EXPORT_INVENTORY_REPORT',
      entityType: 'InventoryReport',
      entityId: reportRefNumber,
      actorName: adminProfile?.fullName || 'Administrator',
      actorEmail: adminProfile?.email || 'admin@dswd.gov.ph',
      actorRole: adminProfile?.role || 'dswd_admin',
      actorWallet: adminProfile?.walletAddress,
      details: `Generated and exported official inventory PDF report (${reportRefNumber}) for ${filterScopeText.scope}. Filter: ${filterScopeText.lgu}, Category: ${filterScopeText.category}.`,
      metadata: {
        reportRefNumber,
        facilityScope,
        selectedLguFilter,
        selectedCategory,
        stockHealthFilter,
        totalItemsCount: filteredData.length,
        grandConsolidated: filteredTotals.grandConsolidated
      }
    }).catch(() => {});

    window.print();
  };

  const portalContent = (
    <div id="inventory-pdf-modal-portal">
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
          #inventory-pdf-modal-portal {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          #inventory-pdf-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }

          #inventory-pdf-modal-container {
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

          #printable-inventory-report-wrapper {
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
        id="inventory-pdf-modal-backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
      >
        <div
          id="inventory-pdf-modal-container"
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
                  Official Regional Inventory PDF Export
                </h2>
                <p className="text-[11px] text-gray-400">
                  Reflecting active filters ({filteredData.length} commodities matched)
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
            id="printable-inventory-report-wrapper"
            className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100 print:bg-white print:p-0 print:overflow-visible"
          >
            <div className="print-page max-w-4xl mx-auto bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-gray-200 print:border-none print:shadow-none print:p-0 print:max-w-none space-y-6">
              {/* 1. Official Republic of the Philippines Letterhead */}
              <div className="border-b-2 border-blue-900 pb-5 text-center page-break-avoid">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs">
                    DSWD
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                      Republic of the Philippines
                    </p>
                    <h1 className="text-base font-extrabold text-blue-950 uppercase tracking-tight">
                      Department of Social Welfare and Development
                    </h1>
                    <p className="text-xs font-bold text-blue-900">
                      Field Office VI &bull; Western Visayas Logistics &amp; Supply Chain Management Division
                    </p>
                  </div>
                </div>

                <div className="mt-3 inline-block bg-blue-50 border border-blue-200 rounded-lg px-4 py-1">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-950">
                    REGIONAL INVENTORY STOCK &amp; WAREHOUSE PREPOSITIONING REPORT
                  </span>
                </div>

                {/* Metadata Row */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-600 border-t border-gray-100 pt-3">
                  <div>
                    <span className="font-semibold text-gray-400 block uppercase">Reference No.</span>
                    <span className="font-mono font-bold text-gray-900">{reportRefNumber}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-400 block uppercase">Generated At</span>
                    <span className="font-bold text-gray-900">{reportDate}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-400 block uppercase">Generated By</span>
                    <span className="font-bold text-gray-900 truncate">
                      {adminProfile?.fullName || 'Logistics Officer'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-400 block uppercase">Audit Classification</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                      Official DROMIC Audit
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Active Filter Scope Banner */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 page-break-avoid text-xs">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-700" />
                    <span className="font-bold text-gray-900 uppercase tracking-wide">
                      Selected Operational View &amp; Filters
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">
                    {filteredData.length} of {allData.length} Commodities Filtered
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
                  <div>
                    <span className="text-gray-500 font-medium block">Facility Scope:</span>
                    <span className="font-bold text-gray-900">{filterScopeText.scope}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium block">Municipality / LGU:</span>
                    <span className="font-bold text-gray-900">{filterScopeText.lgu}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium block">Commodity Category:</span>
                    <span className="font-bold text-gray-900">{filterScopeText.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium block">Buffer Health Filter:</span>
                    <span className="font-bold text-gray-900">{filterScopeText.health}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium block">Search Query:</span>
                    <span className="font-bold text-gray-900">{filterScopeText.search}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium block">Reporting Regional Centers:</span>
                    <span className="font-bold text-gray-900">Oton &amp; Pototan Hubs</span>
                  </div>
                </div>
              </div>

              {/* 3. Executive Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 page-break-avoid">
                <div className="bg-blue-50/70 rounded-xl p-3 border border-blue-200">
                  <div className="flex items-center justify-between text-blue-800 mb-1">
                    <span className="text-[10px] font-bold uppercase">Filtered Buffer</span>
                    <Package className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold font-mono text-blue-950">
                    {filteredTotals.totalAvailable.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-blue-700 mt-0.5">Active Scope Available</p>
                </div>

                {facilityScope !== 'lgu' && (
                  <>
                    <div className="bg-green-50/70 rounded-xl p-3 border border-green-200">
                      <div className="flex items-center justify-between text-green-800 mb-1">
                        <span className="text-[10px] font-bold uppercase">Oton Hub</span>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <p className="text-xl font-bold font-mono text-green-950">
                        {filteredTotals.totalOton.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-green-700 mt-0.5">Western Panay Hub</p>
                    </div>

                    <div className="bg-purple-50/70 rounded-xl p-3 border border-purple-200">
                      <div className="flex items-center justify-between text-purple-800 mb-1">
                        <span className="text-[10px] font-bold uppercase">Pototan Hub</span>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <p className="text-xl font-bold font-mono text-purple-950">
                        {filteredTotals.totalPototan.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-purple-700 mt-0.5">Central Panay Hub</p>
                    </div>
                  </>
                )}

                {(facilityScope === 'all' || facilityScope === 'lgu') && (
                  <div className="bg-indigo-50/70 rounded-xl p-3 border border-indigo-200">
                    <div className="flex items-center justify-between text-indigo-800 mb-1">
                      <span className="text-[10px] font-bold uppercase">Prepositioned LGU</span>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-bold font-mono text-indigo-950">
                      {filteredTotals.totalLguPrepositioned.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-indigo-700 mt-0.5">Municipal Reserves</p>
                  </div>
                )}

                <div className="bg-orange-50/70 rounded-xl p-3 border border-orange-200">
                  <div className="flex items-center justify-between text-orange-800 mb-1">
                    <span className="text-[10px] font-bold uppercase">Dispatched Relief</span>
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold font-mono text-orange-950">
                    {filteredTotals.totalDispatched.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-orange-700 mt-0.5">Released Outgoing</p>
                </div>

                <div className="bg-red-50/70 rounded-xl p-3 border border-red-200">
                  <div className="flex items-center justify-between text-red-800 mb-1">
                    <span className="text-[10px] font-bold uppercase">Expiring &le;30d</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold font-mono text-red-950">
                    {filteredTotals.totalFilteredExpiring.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-red-700 mt-0.5">Critical Shelf-Life</p>
                </div>

                <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200">
                  <div className="flex items-center justify-between text-amber-800 mb-1">
                    <span className="text-[10px] font-bold uppercase">Low Stock Categories</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold font-mono text-amber-950">
                    {filteredTotals.filteredLowStockCount}
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5">Buffer &lt; 500 units</p>
                </div>
              </div>

              {/* 4. Detailed Inventory Stock Audit Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden page-break-avoid">
                <div className="bg-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 uppercase">
                    Comprehensive Commodity Reserve Audit
                  </span>
                  <span className="text-[10px] font-bold text-gray-600">
                    {filteredData.length} records matching active filter
                  </span>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50 border-b border-gray-200 font-bold uppercase text-[9px] text-gray-600">
                    <tr>
                      <th className="px-3 py-2.5">Commodity Category</th>
                      {facilityScope !== 'lgu' && (
                        <>
                          <th className="px-3 py-2.5 text-right text-green-700">Oton Hub</th>
                          <th className="px-3 py-2.5 text-right text-purple-700">Pototan Hub</th>
                        </>
                      )}
                      {facilityScope === 'main' && (
                        <th className="px-3 py-2.5 text-right text-gray-900">Total Hub</th>
                      )}
                      {(facilityScope === 'all' || facilityScope === 'lgu') && (
                        <th className="px-3 py-2.5 text-right text-indigo-700">
                          {selectedLguFilter !== 'All' ? selectedLguFilter : 'Prepositioned'}
                        </th>
                      )}
                      {facilityScope === 'all' && (
                        <th className="px-3 py-2.5 text-right text-gray-900">Grand Total</th>
                      )}
                      <th className="px-3 py-2.5 text-right text-orange-600">Dispatched</th>
                      <th className="px-3 py-2.5 text-right text-blue-700">Available Buffer</th>
                      <th className="px-3 py-2.5 text-center text-red-600">Expiring (&le;30d)</th>
                      <th className="px-3 py-2.5 text-center">Buffer Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.map((item) => {
                      const displayAvailable =
                        facilityScope === 'oton'
                          ? item.warehouseA
                          : facilityScope === 'pototan'
                          ? item.warehouseB
                          : facilityScope === 'lgu'
                          ? (item.selectedLguStock || 0)
                          : facilityScope === 'all'
                          ? (item.grandTotal || item.totalStock)
                          : item.totalStock;

                      const isLowStock = displayAvailable < 500;
                      const isOptimal = displayAvailable >= 1000;

                      return (
                        <tr key={item.category} className="hover:bg-gray-50/70">
                          <td className="px-3 py-2 font-bold text-gray-900 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{item.category}</span>
                          </td>

                          {facilityScope !== 'lgu' && (
                            <>
                              <td className="px-3 py-2 text-right font-mono font-bold text-green-700">
                                {item.warehouseA.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-purple-700">
                                {item.warehouseB.toLocaleString()}
                              </td>
                            </>
                          )}

                          {facilityScope === 'main' && (
                            <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">
                              {item.totalStock.toLocaleString()}
                            </td>
                          )}

                          {(facilityScope === 'all' || facilityScope === 'lgu') && (
                            <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700">
                              {(item.selectedLguStock ?? item.lguTotal ?? 0).toLocaleString()}
                            </td>
                          )}

                          {facilityScope === 'all' && (
                            <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">
                              {(item.grandTotal ?? item.totalStock).toLocaleString()}
                            </td>
                          )}

                          <td className="px-3 py-2 text-right font-mono font-bold text-orange-600">
                            {item.released.toLocaleString()}
                          </td>

                          <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">
                            {displayAvailable.toLocaleString()}
                          </td>

                          <td className="px-3 py-2 text-center">
                            {item.expiringItems > 0 ? (
                              <span className="font-bold text-red-700 font-mono text-[10px]">
                                {item.expiringItems.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">0</span>
                            )}
                          </td>

                          <td className="px-3 py-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : isOptimal
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isLowStock
                                ? 'Low Buffer'
                                : isOptimal
                                ? 'Optimal Buffer'
                                : 'Adequate Stock'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                          No commodities matching active filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Summary Totals Row */}
                  {filteredData.length > 0 && (
                    <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 text-[11px]">
                      <tr>
                        <td className="px-3 py-2.5 text-gray-900 uppercase">
                          Total ({filteredData.length} Commodities)
                        </td>
                        {facilityScope !== 'lgu' && (
                          <>
                            <td className="px-3 py-2.5 text-right font-mono text-green-800">
                              {filteredTotals.totalOton.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-purple-800">
                              {filteredTotals.totalPototan.toLocaleString()}
                            </td>
                          </>
                        )}
                        {facilityScope === 'main' && (
                          <td className="px-3 py-2.5 text-right font-mono text-gray-900">
                            {filteredTotals.totalHubStock.toLocaleString()}
                          </td>
                        )}
                        {(facilityScope === 'all' || facilityScope === 'lgu') && (
                          <td className="px-3 py-2.5 text-right font-mono text-indigo-800">
                            {filteredTotals.totalLguPrepositioned.toLocaleString()}
                          </td>
                        )}
                        {facilityScope === 'all' && (
                          <td className="px-3 py-2.5 text-right font-mono text-gray-900">
                            {filteredTotals.grandConsolidated.toLocaleString()}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right font-mono text-orange-700">
                          {filteredTotals.totalDispatched.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-blue-800">
                          {filteredTotals.totalAvailable.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-red-700">
                          {filteredTotals.totalFilteredExpiring.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-center text-[10px] text-gray-600">
                          Certified
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* 5. Buffer Risk Advisory & Expiration Notices Block */}
              {(lowStockItems.length > 0 || totalExpiring > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 page-break-avoid text-xs">
                  {lowStockItems.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-yellow-900 font-bold mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span>Low Stock Buffer Advisory ({lowStockItems.length} Categories)</span>
                      </div>
                      <p className="text-[11px] text-yellow-800 mb-2">
                        Commodities operating under the recommended minimum 500-unit disaster contingency threshold:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lowStockItems.map((item) => (
                          <span
                            key={item.category}
                            className="bg-white border border-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold text-yellow-950 font-mono"
                          >
                            {item.category}: {item.available.toLocaleString()} units
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {totalExpiring > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-red-900 font-bold mb-1">
                        <Clock className="w-4 h-4 text-red-600" />
                        <span>Critical Shelf-Life Expiration Alert ({totalExpiring.toLocaleString()} Units)</span>
                      </div>
                      <p className="text-[11px] text-red-800">
                        {totalExpiring.toLocaleString()} items are nearing expiration within 30 calendar days across warehouses. Recommended for priority dispatch or FIFO distribution to active LGU staging centers.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 6. Official Sign-off & Verification Footer */}
              <div className="border-t border-gray-200 pt-6 mt-6 page-break-avoid space-y-4">
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-8">
                      Prepared By:
                    </p>
                    <div className="border-b border-gray-400 pb-1">
                      <p className="font-bold text-gray-900">{adminProfile?.fullName || 'Logistics Officer'}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {adminProfile?.role === 'dswd_admin' ? 'DSWD Admin / Supply Officer' : 'Inventory Custodian'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-8">
                      Verified By:
                    </p>
                    <div className="border-b border-gray-400 pb-1">
                      <p className="font-bold text-gray-900">DRMD Logistics Section Head</p>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Disaster Response Management Division</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-8">
                      Approved By:
                    </p>
                    <div className="border-b border-gray-400 pb-1">
                      <p className="font-bold text-gray-900">Regional Director</p>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">DSWD Field Office VI</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Blockchain-Verified Telemetry &amp; Warehouse Physical Balance Record</span>
                  </div>
                  <span>Confidential Government Document &bull; For Official Disaster Logistics Use</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}

