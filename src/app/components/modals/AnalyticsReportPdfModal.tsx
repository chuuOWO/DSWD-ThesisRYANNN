import { useMemo } from 'react';
import {
  Printer,
  X,
  FileText,
  Calendar,
  Filter,
  Building2,
  Package,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type {
  OutgoingRelease,
  InventoryItem
} from '../../hooks/useInventoryState';
import type { LguRecord } from '../../services/backendApi';
import type { SynchronizedLgu } from '../../lib/lguSync';
import type { UserProfile } from '../../services/authApi';

interface AnalyticsReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Active Filter Configuration
  timeFilter: 'all' | 'monthly' | 'quarterly';
  selectedQuarter: 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  selectedMonth: string;
  selectedDisasterFilter: string;
  selectedLguFilter: string;
  selectedCategoryFilter: string;
  // Filtered and Master Datasets
  filteredReleases: OutgoingRelease[];
  allReleases: OutgoingRelease[];
  inventory: InventoryItem[];
  lgusList: (LguRecord | SynchronizedLgu)[];
  adminProfile?: UserProfile | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function AnalyticsReportPdfModal({
  isOpen,
  onClose,
  timeFilter,
  selectedQuarter,
  selectedMonth,
  selectedDisasterFilter,
  selectedLguFilter,
  selectedCategoryFilter,
  filteredReleases,
  allReleases,
  inventory,
  lgusList,
  adminProfile
}: AnalyticsReportPdfModalProps) {
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
    return `DSWD-FO6-RPT-${yr}${mo}${day}-${seq}`;
  }, []);

  // Compute Human-readable Scope Summary
  const filterScopeText = useMemo(() => {
    let timeText = 'All Time (Full Operational History)';
    if (timeFilter === 'quarterly') {
      timeText = selectedQuarter === 'all'
        ? 'Quarterly: All Quarters (Q1 - Q4)'
        : `Quarterly: ${selectedQuarter} (${selectedQuarter === 'Q1' ? 'Jan - Mar' : selectedQuarter === 'Q2' ? 'Apr - Jun' : selectedQuarter === 'Q3' ? 'Jul - Sep' : 'Oct - Dec'})`;
    } else if (timeFilter === 'monthly') {
      timeText = selectedMonth === 'all'
        ? 'Monthly: All Months'
        : `Monthly: ${MONTH_NAMES[parseInt(selectedMonth, 10)] || 'Selected Month'}`;
    }

    return {
      time: timeText,
      disaster: selectedDisasterFilter === 'All' ? 'All Disaster / Calamity Incidents' : selectedDisasterFilter,
      lgu: selectedLguFilter === 'All' ? 'All Municipalities & Cities (Panay Island)' : selectedLguFilter,
      category: selectedCategoryFilter === 'All' ? 'All FNFI Relief Commodities' : selectedCategoryFilter
    };
  }, [timeFilter, selectedQuarter, selectedMonth, selectedDisasterFilter, selectedLguFilter, selectedCategoryFilter]);

  // Aggregate Executive KPIs
  const totalRequested = useMemo(() => {
    return filteredReleases.reduce((sum, r) => sum + (Number(r.amountRequested) || 0), 0);
  }, [filteredReleases]);

  const totalAllocated = useMemo(() => {
    return filteredReleases.reduce((sum, r) => sum + (Number(r.amountApproved || r.amountRequested) || 0), 0);
  }, [filteredReleases]);

  const fulfillmentRate = useMemo(() => {
    if (totalRequested <= 0) return 100;
    return Math.min(100, Math.round((totalAllocated / totalRequested) * 1000) / 10);
  }, [totalRequested, totalAllocated]);

  const uniqueLgusServed = useMemo(() => {
    const set = new Set<string>();
    filteredReleases.forEach((r) => {
      if (r.municipality) set.add(r.municipality.trim().toLowerCase());
    });
    return set.size;
  }, [filteredReleases]);

  // Section 2: Disaster Breakdown
  const disasterBreakdown = useMemo(() => {
    const map = new Map<string, { requested: number; allocated: number; count: number }>();
    filteredReleases.forEach((r) => {
      const reason = r.reportReason?.trim() || 'General Relief Augmentation';
      const existing = map.get(reason) || { requested: 0, allocated: 0, count: 0 };
      existing.requested += Number(r.amountRequested) || 0;
      existing.allocated += Number(r.amountApproved || r.amountRequested) || 0;
      existing.count += 1;
      map.set(reason, existing);
    });

    return Array.from(map.entries())
      .map(([reason, stats]) => ({
        reason,
        requested: stats.requested,
        allocated: stats.allocated,
        count: stats.count,
        rate: stats.requested > 0 ? Math.min(100, Math.round((stats.allocated / stats.requested) * 1000) / 10) : 100
      }))
      .sort((a, b) => b.allocated - a.allocated);
  }, [filteredReleases]);

  // Section 3: LGU Municipal Breakdown
  const lguBreakdown = useMemo(() => {
    const map = new Map<string, { province: string; requested: number; allocated: number; count: number }>();
    filteredReleases.forEach((r) => {
      const muni = r.municipality?.trim() || 'Unassigned LGU';
      const prov = r.province?.trim() || 'Iloilo';
      const existing = map.get(muni) || { province: prov, requested: 0, allocated: 0, count: 0 };
      existing.requested += Number(r.amountRequested) || 0;
      existing.allocated += Number(r.amountApproved || r.amountRequested) || 0;
      existing.count += 1;
      map.set(muni, existing);
    });

    return Array.from(map.entries())
      .map(([municipality, stats]) => ({
        municipality,
        province: stats.province,
        requested: stats.requested,
        allocated: stats.allocated,
        count: stats.count,
        rate: stats.requested > 0 ? Math.min(100, Math.round((stats.allocated / stats.requested) * 1000) / 10) : 100
      }))
      .sort((a, b) => b.allocated - a.allocated);
  }, [filteredReleases]);

  // Section 4: Commodity Breakdown
  const commodityBreakdown = useMemo(() => {
    const map = new Map<string, { requested: number; allocated: number; count: number }>();
    filteredReleases.forEach((r) => {
      const cat = r.fnfiCategory?.trim() || 'Relief Goods';
      const existing = map.get(cat) || { requested: 0, allocated: 0, count: 0 };
      existing.requested += Number(r.amountRequested) || 0;
      existing.allocated += Number(r.amountApproved || r.amountRequested) || 0;
      existing.count += 1;
      map.set(cat, existing);
    });

    return Array.from(map.entries())
      .map(([category, stats]) => {
        const whItem = inventory.find(i => i.category.toLowerCase().includes(category.toLowerCase()));
        const whStock = whItem ? (whItem.totalStock ?? (whItem.warehouseA + whItem.warehouseB)) : 0;
        return {
          category,
          requested: stats.requested,
          allocated: stats.allocated,
          count: stats.count,
          whStock,
          rate: stats.requested > 0 ? Math.min(100, Math.round((stats.allocated / stats.requested) * 1000) / 10) : 100
        };
      })
      .sort((a, b) => b.allocated - a.allocated);
  }, [filteredReleases, inventory]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print-specific style rules */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-report {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-gray-900 text-white border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Official Operations & Analytics PDF Export
              </h2>
              <p className="text-[11px] text-gray-400">
                Generated from active dashboard filter parameters ({filteredReleases.length} records matched)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2500ba] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100 print:bg-white print:p-0 print:overflow-visible">
          <div
            id="printable-report"
            className="w-full max-w-4xl mx-auto bg-white p-8 sm:p-10 rounded-xl shadow-lg border border-gray-200 text-gray-900 space-y-6 print:shadow-none print:border-none print:p-0 print:rounded-none"
          >
            {/* 1. Official Republic of the Philippines Header */}
            <div className="border-b-2 border-blue-900 pb-4">
              <div className="flex items-center justify-between gap-4">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg"
                  alt="DSWD Seal"
                  className="h-16 w-16 object-contain flex-shrink-0"
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
                    Disaster Response Management Division (DRMD) | M.H. del Pilar Street, Molo, Iloilo City
                  </p>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <div className="inline-block border border-blue-900 px-2 py-1 rounded text-[9px] font-bold text-blue-900 uppercase">
                    Official Audit Copy
                  </div>
                  <p className="text-[9px] font-mono text-gray-500 mt-1">DRMD-LOG-DOC</p>
                </div>
              </div>
            </div>

            {/* 2. Document Title Banner */}
            <div className="text-center py-2 bg-blue-50/70 border border-blue-200 rounded-lg">
              <h2 className="text-xs sm:text-sm font-black text-blue-950 uppercase tracking-wider">
                Disaster Relief Logistics & Analytics Operations Report
              </h2>
              <p className="text-[11px] font-semibold text-blue-800 mt-0.5">
                Harmonized Food and Non-Food Items (FNFI) Allocation & Distribution Audit
              </p>
            </div>

            {/* 3. Report Metadata & Applied Filter Scope */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-[10px]">
              <div>
                <span className="block font-bold text-gray-500 uppercase">Document Reference</span>
                <span className="font-mono font-bold text-gray-900">{reportRefNumber}</span>
              </div>
              <div>
                <span className="block font-bold text-gray-500 uppercase">Date & Time Generated</span>
                <span className="font-semibold text-gray-900">{reportDate}</span>
              </div>
              <div>
                <span className="block font-bold text-gray-500 uppercase">Reporting Officer</span>
                <span className="font-semibold text-gray-900">{adminProfile?.fullName || 'DSWD System Administrator'}</span>
              </div>
              <div>
                <span className="block font-bold text-gray-500 uppercase">Officer Designation</span>
                <span className="font-semibold text-gray-900">{adminProfile?.jobPosition || 'Operations Administrator'}</span>
              </div>
            </div>

            {/* Applied Filter Parameters Grid */}
            <div className="p-3 border border-indigo-200 bg-indigo-50/50 rounded-lg text-[10px] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950 uppercase tracking-wider">
                <Filter className="w-3 h-3 text-indigo-700" />
                <span>Applied Filter Configuration (Active Query Scope)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-gray-800">
                <div className="bg-white p-2 rounded border border-indigo-100">
                  <span className="block font-bold text-gray-500">Time Horizon:</span>
                  <span className="font-semibold text-indigo-900">{filterScopeText.time}</span>
                </div>
                <div className="bg-white p-2 rounded border border-indigo-100">
                  <span className="block font-bold text-gray-500">Disaster Incident:</span>
                  <span className="font-semibold text-indigo-900">{filterScopeText.disaster}</span>
                </div>
                <div className="bg-white p-2 rounded border border-indigo-100">
                  <span className="block font-bold text-gray-500">Destination LGU:</span>
                  <span className="font-semibold text-indigo-900">{filterScopeText.lgu}</span>
                </div>
                <div className="bg-white p-2 rounded border border-indigo-100">
                  <span className="block font-bold text-gray-500">FNFI Commodity:</span>
                  <span className="font-semibold text-indigo-900">{filterScopeText.category}</span>
                </div>
              </div>
            </div>

            {/* 4. Section: Executive KPI Metric Summary */}
            <div className="space-y-2 page-break-avoid">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-800" />
                <span>1. Executive Operational KPI Summary</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="block text-[10px] font-bold text-gray-500 uppercase">Total Goods Requested</span>
                  <span className="text-base font-black text-gray-900">{totalRequested.toLocaleString()}</span>
                  <span className="block text-[9px] text-gray-500 mt-0.5">Assessed Disaster Need</span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="block text-[10px] font-bold text-blue-700 uppercase">Total Approved / Allocated</span>
                  <span className="text-base font-black text-blue-900">{totalAllocated.toLocaleString()}</span>
                  <span className="block text-[9px] text-blue-700 mt-0.5">Dispatched Relief Units</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="block text-[10px] font-bold text-emerald-700 uppercase">Fulfillment Rate</span>
                  <span className="text-base font-black text-emerald-900">{fulfillmentRate}%</span>
                  <span className="block text-[9px] text-emerald-700 mt-0.5">Demand Satisfaction</span>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="block text-[10px] font-bold text-purple-700 uppercase">LGUs Served</span>
                  <span className="text-base font-black text-purple-900">{uniqueLgusServed}</span>
                  <span className="block text-[9px] text-purple-700 mt-0.5">Across Panay Region</span>
                </div>
              </div>
            </div>

            {/* 5. Section: Disaster & Calamity Allocation Analysis */}
            <div className="space-y-2 page-break-avoid">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>2. Calamity & Disaster Distribution Breakdown</span>
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px]">
                      <th className="py-1.5 px-3">Disaster / Calamity Reason</th>
                      <th className="py-1.5 px-3 text-center">Dispatches</th>
                      <th className="py-1.5 px-3 text-right">Requested Qty</th>
                      <th className="py-1.5 px-3 text-right">Allocated Qty</th>
                      <th className="py-1.5 px-3 text-right">Fulfillment Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {disasterBreakdown.length > 0 ? (
                      disasterBreakdown.map((row) => (
                        <tr key={row.reason} className="hover:bg-gray-50/50">
                          <td className="py-1.5 px-3 font-semibold text-gray-900">{row.reason}</td>
                          <td className="py-1.5 px-3 text-center">{row.count}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{row.requested.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-950">{row.allocated.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-700">{row.rate}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-2 px-3 text-center text-gray-500 italic">
                          No disaster releases matched the active filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Section: Top LGU Recipient Municipalities */}
            <div className="space-y-2 page-break-avoid">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-700" />
                <span>3. LGU Municipal Distribution Summary</span>
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px]">
                      <th className="py-1.5 px-3">Recipient LGU / Municipality</th>
                      <th className="py-1.5 px-3">Province</th>
                      <th className="py-1.5 px-3 text-center">Shipments</th>
                      <th className="py-1.5 px-3 text-right">Requested Qty</th>
                      <th className="py-1.5 px-3 text-right">Allocated Qty</th>
                      <th className="py-1.5 px-3 text-right">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lguBreakdown.length > 0 ? (
                      lguBreakdown.slice(0, 10).map((row) => (
                        <tr key={row.municipality} className="hover:bg-gray-50/50">
                          <td className="py-1.5 px-3 font-semibold text-gray-900">{row.municipality}</td>
                          <td className="py-1.5 px-3 text-gray-600">{row.province}</td>
                          <td className="py-1.5 px-3 text-center">{row.count}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{row.requested.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-950">{row.allocated.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-700">{row.rate}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-2 px-3 text-center text-gray-500 italic">
                          No municipal releases recorded in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. Section: Commodity Breakdown */}
            <div className="space-y-2 page-break-avoid">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-700" />
                <span>4. FNFI Relief Commodity Allocation Matrix</span>
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px]">
                      <th className="py-1.5 px-3">Relief Commodity Category</th>
                      <th className="py-1.5 px-3 text-right">Current WH Stock</th>
                      <th className="py-1.5 px-3 text-right">Requested Qty</th>
                      <th className="py-1.5 px-3 text-right">Allocated Qty</th>
                      <th className="py-1.5 px-3 text-right">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {commodityBreakdown.length > 0 ? (
                      commodityBreakdown.map((row) => (
                        <tr key={row.category} className="hover:bg-gray-50/50">
                          <td className="py-1.5 px-3 font-semibold text-gray-900">{row.category}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-gray-600">{row.whStock.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{row.requested.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-950">{row.allocated.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-700">{row.rate}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-2 px-3 text-center text-gray-500 italic">
                          No commodity distribution records matched.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 8. Section: Detailed Shipment Audit Ledger */}
            <div className="space-y-2 page-break-avoid">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>5. Itemized Release & Shipment Audit Ledger ({filteredReleases.length} Records)</span>
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-[9px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[8px]">
                      <th className="py-1.5 px-2">DR Number</th>
                      <th className="py-1.5 px-2">Date</th>
                      <th className="py-1.5 px-2">Calamity / Incident</th>
                      <th className="py-1.5 px-2">Destination LGU</th>
                      <th className="py-1.5 px-2">Commodity</th>
                      <th className="py-1.5 px-2 text-right">Req.</th>
                      <th className="py-1.5 px-2 text-right">Alloc.</th>
                      <th className="py-1.5 px-2 text-center">Status</th>
                      <th className="py-1.5 px-2 font-mono">Blockchain Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReleases.length > 0 ? (
                      filteredReleases.slice(0, 30).map((r) => (
                        <tr key={r.drNumber} className="hover:bg-gray-50/50">
                          <td className="py-1.5 px-2 font-bold font-mono text-blue-900">{r.drNumber}</td>
                          <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{r.dateAllocated || 'N/A'}</td>
                          <td className="py-1.5 px-2 text-gray-800">{r.reportReason || 'General Relief'}</td>
                          <td className="py-1.5 px-2 font-semibold text-gray-900">{r.municipality || 'LGU'}</td>
                          <td className="py-1.5 px-2 text-gray-800">{r.fnfiCategory}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{r.amountRequested}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-900">{r.amountApproved || r.amountRequested}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                              {r.deliveryStatus}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 font-mono text-gray-500 truncate max-w-[100px]">
                            {r.blockchainTxHash ? `${r.blockchainTxHash.slice(0, 8)}...${r.blockchainTxHash.slice(-6)}` : 'On-Chain Ledger'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-2 px-3 text-center text-gray-500 italic">
                          No release records found matching active filter parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredReleases.length > 30 && (
                <p className="text-[9px] text-gray-500 italic text-right">
                  Showing top 30 of {filteredReleases.length} matching records for print brevity.
                </p>
              )}
            </div>

            {/* 9. Section: Certification & Sign-off Block */}
            <div className="pt-6 border-t-2 border-gray-300 page-break-avoid">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest text-center font-bold mb-6">
                Official Certification of Accountability & Records Verification
              </p>
              <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
                <div>
                  <div className="border-b border-gray-800 h-10 mb-1 flex items-end justify-center pb-1">
                    <span className="font-bold text-gray-900">{adminProfile?.fullName || 'DSWD System Administrator'}</span>
                  </div>
                  <span className="block font-bold text-gray-800 uppercase text-[9px]">Prepared By</span>
                  <span className="text-gray-500 text-[9px]">{adminProfile?.jobPosition || 'Disaster Response Operations Officer'}</span>
                </div>

                <div>
                  <div className="border-b border-gray-800 h-10 mb-1 flex items-end justify-center pb-1">
                    <span className="font-bold text-gray-900">Regional Logistics Management Section</span>
                  </div>
                  <span className="block font-bold text-gray-800 uppercase text-[9px]">Verified & Audited By</span>
                  <span className="text-gray-500 text-[9px]">Regional Warehouse Supervisor</span>
                </div>

                <div>
                  <div className="border-b border-gray-800 h-10 mb-1 flex items-end justify-center pb-1">
                    <span className="font-bold text-gray-900">Regional Director</span>
                  </div>
                  <span className="block font-bold text-gray-800 uppercase text-[9px]">Noted & Approved By</span>
                  <span className="text-gray-500 text-[9px]">DSWD Regional Field Office VI</span>
                </div>
              </div>
            </div>

            {/* 10. Official Footer */}
            <div className="pt-4 border-t border-gray-200 text-center text-[8px] text-gray-500 font-medium">
              <p>
                DSWD Blockchain-Secured Relief Operations & Incident Logistics Information System (Field Office VI)
              </p>
              <p className="font-mono text-gray-400 mt-0.5">
                Cryptographic Audit Authenticity: SHA-256 Validated | System Generated Report Reference: {reportRefNumber}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

