import { useState } from 'react';
import { Plus, Search, TruckIcon, MapPin, User, AlertCircle, Calendar, CheckCircle } from 'lucide-react';
import { AddReleaseModal } from './AddReleaseModal';

interface InventoryState {
  inventory: { category: string; warehouseA: number; warehouseB: number }[];
  addStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => void;
  deductStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => boolean;
  getAvailableStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse') => number;
}

interface OutgoingModuleProps {
  inventoryState: InventoryState;
}

type DeliveryStatus = 'Allocating' | 'Release' | 'In Transit' | 'Distributed';

interface OutgoingRelease {
  drNumber: string;
  dateAllocated: string;
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
  amountRequested: number;
  amountApproved: number;
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus: DeliveryStatus;
  incidentCode: string;
}

const FNFI_CATEGORIES = [
  'Hygiene Kit',
  'Food Pack',
  'Sleeping Kit',
  'Kitchen Kit',
  'Family Kit',
  'Laminated Sack',
  'RTEF'
];

export function OutgoingModuleNew({ inventoryState }: OutgoingModuleProps) {
  const { inventory, deductStock } = inventoryState;
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<OutgoingRelease | null>(null);
  const [approvalAmount, setApprovalAmount] = useState(0);

  const [outgoingReleasesList, setOutgoingReleasesList] = useState<OutgoingRelease[]>([
    {
      drNumber: 'DR-2026-001',
      dateAllocated: '2026-05-12',
      lguName: 'Leon Municipal Office',
      province: 'Iloilo',
      municipality: 'Leon',
      fnfiCategory: 'Food Pack',
      amountRequested: 500,
      amountApproved: 500,
      warehouseSource: 'Oton Main Warehouse',
      deliveryMode: 'Truck',
      deliveryStatus: 'Distributed',
      incidentCode: 'Emergency relief'
    },
    {
      drNumber: 'DR-2026-002',
      dateAllocated: '2026-05-12',
      lguName: 'Miag-ao Municipal Office',
      province: 'Iloilo',
      municipality: 'Miag-ao',
      fnfiCategory: 'Hygiene Kit',
      amountRequested: 300,
      amountApproved: 300,
      warehouseSource: 'Pototan Main Warehouse',
      deliveryMode: 'Truck',
      deliveryStatus: 'In Transit',
      incidentCode: ''
    },
    {
      drNumber: 'DR-2026-003',
      dateAllocated: '2026-05-11',
      lguName: 'Banate Municipal Office',
      province: 'Iloilo',
      municipality: 'Banate',
      fnfiCategory: 'Sleeping Kit',
      amountRequested: 200,
      amountApproved: 200,
      warehouseSource: 'Leon Municipal Office',
      deliveryMode: 'Pick-up',
      deliveryStatus: 'Release',
      incidentCode: 'Flood response'
    },
    {
      drNumber: 'DR-2026-004',
      dateAllocated: '2026-05-13',
      lguName: 'Guinhol Municipal Office',
      province: 'Iloilo',
      municipality: 'Guinhol',
      fnfiCategory: 'Kitchen Kit',
      amountRequested: 150,
      amountApproved: 0,
      warehouseSource: 'Pototan Main Warehouse',
      deliveryMode: 'Truck',
      deliveryStatus: 'Allocating',
      incidentCode: ''
    }
  ]);

  const handleAddRelease = (newRelease: Omit<OutgoingRelease, 'drNumber'>) => {
    const newDR = `DR-2026-${String(outgoingReleasesList.length + 1).padStart(3, '0')}`;

    // Deduct stock if status is "Release" (approved) AND warehouse is a main warehouse
    if (newRelease.deliveryStatus === 'Release') {
      const isMainWarehouse = newRelease.warehouseSource === 'Oton Main Warehouse' ||
                              newRelease.warehouseSource === 'Pototan Main Warehouse';

      if (isMainWarehouse) {
        const success = deductStock(
          newRelease.fnfiCategory,
          newRelease.warehouseSource as 'Oton Main Warehouse' | 'Pototan Main Warehouse',
          newRelease.amountApproved
        );

        if (!success) {
          alert('Failed to deduct stock. Insufficient inventory.');
          return;
        }
      }
      // For LGU warehouses, skip stock deduction (they manage their own stock)
    }

    const releaseWithDR: OutgoingRelease = {
      ...newRelease,
      drNumber: newDR
    };

    setOutgoingReleasesList([releaseWithDR, ...outgoingReleasesList]);
    setShowReleaseModal(false);
  };

  const openApprovalModal = (release: OutgoingRelease) => {
    setSelectedRelease(release);
    setApprovalAmount(release.amountRequested);
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = () => {
    if (!selectedRelease) return;

    // Validate approved amount
    if (approvalAmount <= 0) {
      alert('Approved amount must be greater than 0');
      return;
    }

    if (approvalAmount > selectedRelease.amountRequested) {
      alert('Approved amount cannot exceed requested amount');
      return;
    }

    // Deduct stock when approving (only for main warehouses)
    const isMainWarehouse = selectedRelease.warehouseSource === 'Oton Main Warehouse' ||
                            selectedRelease.warehouseSource === 'Pototan Main Warehouse';

    if (isMainWarehouse) {
      const success = deductStock(
        selectedRelease.fnfiCategory,
        selectedRelease.warehouseSource as 'Oton Main Warehouse' | 'Pototan Main Warehouse',
        approvalAmount
      );

      if (!success) {
        alert('Failed to approve release. Insufficient inventory in warehouse.');
        return;
      }
    }
    // For LGU warehouses, skip stock deduction (they manage their own stock)

    // Update status to Release and set approved amount
    setOutgoingReleasesList(outgoingReleasesList.map(r =>
      r.drNumber === selectedRelease.drNumber
        ? { ...r, deliveryStatus: 'Release', amountApproved: approvalAmount }
        : r
    ));

    setShowApprovalModal(false);
    setSelectedRelease(null);
    setApprovalAmount(0);
  };

  const getStatusColor = (status: DeliveryStatus) => {
    const colors = {
      'Allocating': 'bg-gray-100 text-gray-700',
      'Release': 'bg-blue-100 text-blue-700',
      'In Transit': 'bg-yellow-100 text-yellow-700',
      'Distributed': 'bg-green-100 text-green-700'
    };
    return colors[status];
  };

  const getStatusIcon = (status: DeliveryStatus) => {
    switch (status) {
      case 'Allocating':
        return '📦';
      case 'Release':
        return '✅';
      case 'In Transit':
        return '🚚';
      case 'Distributed':
        return '✔️';
    }
  };

  const filteredReleases = outgoingReleasesList.filter(release => {
    const matchesSearch =
      release.lguName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.municipality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.fnfiCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.drNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = selectedWarehouse === 'All' || release.warehouseSource === selectedWarehouse;
    const matchesStatus = selectedStatus === 'All' || release.deliveryStatus === selectedStatus;

    return matchesSearch && matchesWarehouse && matchesStatus;
  });

  const allocatingCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'Allocating').length;
  const releaseCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'Release').length;
  const inTransitCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'In Transit').length;
  const distributedCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'Distributed').length;
  const totalApproved = outgoingReleasesList.reduce((sum, r) => sum + r.amountApproved, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoing Module</h1>
          <p className="text-sm text-gray-600 mt-1">Release & Delivery Management</p>
        </div>
        <button
          onClick={() => setShowReleaseModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Release
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Total Approved</p>
              <p className="text-2xl font-bold text-gray-900">{totalApproved.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📦</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Allocating</p>
              <p className="text-2xl font-bold text-gray-600">{allocatingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Release</p>
              <p className="text-2xl font-bold text-blue-600">{releaseCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🚚</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-yellow-600">{inTransitCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✔️</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Distributed</p>
              <p className="text-2xl font-bold text-green-600">{distributedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Allocating Releases - Quick Actions */}
      {allocatingCount > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-700" />
            <h3 className="font-bold text-yellow-900">Pending Approval ({allocatingCount})</h3>
            <span className="text-sm text-yellow-700 ml-2">Review requested amounts and approve allocations</span>
          </div>
          <div className="space-y-3">
            {outgoingReleasesList
              .filter(release => release.deliveryStatus === 'Allocating')
              .map(release => (
                <div key={release.drNumber} className="bg-white rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 grid grid-cols-5 gap-4">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">DR Number</span>
                        <span className="font-bold text-sm text-blue-600">{release.drNumber}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">LGU / Municipality</span>
                        <span className="font-bold text-sm text-gray-900 block">{release.lguName}</span>
                        <span className="text-xs text-gray-600">{release.municipality}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">FNFI Category</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold inline-block">
                          {release.fnfiCategory}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Amount Requested</span>
                        <span className="font-bold text-sm text-gray-900">{release.amountRequested.toLocaleString()} units</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Warehouse</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${
                          release.warehouseSource === 'Oton Main Warehouse'
                            ? 'bg-green-100 text-green-700'
                            : release.warehouseSource === 'Pototan Main Warehouse'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {release.warehouseSource}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openApprovalModal(release)}
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors whitespace-nowrap shadow-sm"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve & Release
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stock Deduction Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-blue-900 text-sm">Automatic Stock Deduction</h3>
            <p className="text-sm text-blue-800 mt-1">
              Stock is automatically deducted from warehouse inventory when admin approves the allocation
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by DR, LGU, municipality, or item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Warehouses</option>
            <option>Oton Main Warehouse</option>
            <option>Pototan Main Warehouse</option>
            <option>Leon Municipal Office</option>
            <option>Miag-ao Municipal Office</option>
            <option>Banate Municipal Office</option>
            <option>Guinhol Municipal Office</option>
            <option>Iloilo City Government</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Status</option>
            <option>Allocating</option>
            <option>Release</option>
            <option>In Transit</option>
            <option>Distributed</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">DR Number</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Date Allocated</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">LGU / Municipality</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">FNFI Category</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Amt Requested</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Amt Approved</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Warehouse</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Delivery Mode</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Incident Code</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReleases.map((release) => (
                <tr key={release.drNumber} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-blue-600">{release.drNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">{release.dateAllocated}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="font-bold text-sm text-gray-900">{release.lguName}</span>
                      </div>
                      <span className="text-xs text-gray-600 ml-6">{release.municipality}, {release.province}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      {release.fnfiCategory}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-900">{release.amountRequested.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${release.amountApproved > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {release.amountApproved > 0 ? release.amountApproved.toLocaleString() : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      release.warehouseSource === 'Oton Main Warehouse'
                        ? 'bg-green-100 text-green-700'
                        : release.warehouseSource === 'Pototan Main Warehouse'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {release.warehouseSource}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <TruckIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{release.deliveryMode}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(release.deliveryStatus)}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(release.deliveryStatus)}`}>
                        {release.deliveryStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{release.incidentCode || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {release.deliveryStatus === 'Allocating' && (
                      <button
                        onClick={() => openApprovalModal(release)}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                    )}
                    {release.deliveryStatus !== 'Allocating' && (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReleases.length === 0 && (
          <div className="text-center py-12">
            <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No outgoing releases found</p>
          </div>
        )}
      </div>

      {/* Add Release Modal */}
      {showReleaseModal && (
        <AddReleaseModal
          onClose={() => setShowReleaseModal(false)}
          onSubmit={handleAddRelease}
          availableStock={inventory}
        />
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Approve Allocation</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">DR Number:</span>
                    <p className="font-bold text-blue-600">{selectedRelease.drNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">LGU:</span>
                    <p className="font-bold text-gray-900">{selectedRelease.lguName}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Category:</span>
                    <p className="font-bold text-gray-900">{selectedRelease.fnfiCategory}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Warehouse:</span>
                    <p className="font-bold text-gray-900">{selectedRelease.warehouseSource}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Amount Requested
                </label>
                <div className="px-4 py-3 bg-gray-100 rounded-lg">
                  <span className="text-lg font-bold text-gray-900">
                    {selectedRelease.amountRequested.toLocaleString()} units
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Amount to Approve <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedRelease.amountRequested}
                  value={approvalAmount}
                  onChange={(e) => setApprovalAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-lg"
                />
                <p className="text-xs text-gray-600 mt-1">
                  You can approve up to {selectedRelease.amountRequested.toLocaleString()} units
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Stock will be automatically deducted from the warehouse upon approval</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRelease(null);
                  setApprovalAmount(0);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
