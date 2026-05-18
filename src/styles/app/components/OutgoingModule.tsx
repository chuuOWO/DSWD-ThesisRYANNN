import { useState } from 'react';
import { Search, Filter, Plus, Edit, Paperclip, Download, Calendar } from 'lucide-react';

type DeliveryStatus = 'Pending Request' | 'For Allocation' | 'Allocated' | 'Released' | 'In Transit' | 'Delivered' | 'Distributed' | 'Completed';

interface OutgoingRequest {
  id: string;
  incidentName: string;
  incidentCode: string;
  province: string;
  municipality: string;
  lguRequestCode: string;
  dateRequested: string;
  itemTypeRequested: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  releasedQuantity: number;
  deliveryMode: string;
  warehouseSource: string;
  allocationDate: string;
  actualDeliveryDate: string;
  deliveryStatus: DeliveryStatus;
  distributionStatus: string;
  remarks: string;
}

export function OutgoingModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock data
  const outgoingRequests: OutgoingRequest[] = [
    {
      id: 'OUT-2026-001',
      incidentName: 'Typhoon Ambo Response',
      incidentCode: 'INC-2026-05-001',
      province: 'Iloilo',
      municipality: 'Leon',
      lguRequestCode: 'LGU-LEON-001',
      dateRequested: '2026-05-10',
      itemTypeRequested: 'Food Packs',
      requestedQuantity: 1000,
      allocatedQuantity: 800,
      releasedQuantity: 800,
      deliveryMode: 'Truck',
      warehouseSource: 'Warehouse 1',
      allocationDate: '2026-05-11',
      actualDeliveryDate: '2026-05-12',
      deliveryStatus: 'Delivered',
      distributionStatus: 'Ongoing',
      remarks: 'Priority delivery'
    },
    {
      id: 'OUT-2026-002',
      incidentName: 'Flooding Emergency',
      incidentCode: 'INC-2026-05-002',
      province: 'Iloilo',
      municipality: 'Miag-ao',
      lguRequestCode: 'LGU-MIAG-001',
      dateRequested: '2026-05-11',
      itemTypeRequested: 'Hygiene Kits',
      requestedQuantity: 500,
      allocatedQuantity: 500,
      releasedQuantity: 500,
      deliveryMode: 'Truck',
      warehouseSource: 'Warehouse 2',
      allocationDate: '2026-05-12',
      actualDeliveryDate: '',
      deliveryStatus: 'In Transit',
      distributionStatus: 'Pending',
      remarks: ''
    },
    {
      id: 'OUT-2026-003',
      incidentName: 'Typhoon Ambo Response',
      incidentCode: 'INC-2026-05-001',
      province: 'Iloilo',
      municipality: 'Banate Nuevo',
      lguRequestCode: 'LGU-BANATE-001',
      dateRequested: '2026-05-09',
      itemTypeRequested: 'Family Kits',
      requestedQuantity: 750,
      allocatedQuantity: 600,
      releasedQuantity: 0,
      deliveryMode: 'Truck',
      warehouseSource: 'Warehouse 1',
      allocationDate: '2026-05-10',
      actualDeliveryDate: '',
      deliveryStatus: 'Allocated',
      distributionStatus: 'Pending',
      remarks: 'Awaiting transport availability'
    },
    {
      id: 'OUT-2026-004',
      incidentName: 'Evacuation Support',
      incidentCode: 'INC-2026-05-003',
      province: 'Iloilo',
      municipality: 'Guinhol',
      lguRequestCode: 'LGU-GUINHOL-001',
      dateRequested: '2026-05-12',
      itemTypeRequested: 'Sleeping Kits',
      requestedQuantity: 300,
      allocatedQuantity: 0,
      releasedQuantity: 0,
      deliveryMode: 'Truck',
      warehouseSource: 'TBD',
      allocationDate: '',
      actualDeliveryDate: '',
      deliveryStatus: 'For Allocation',
      distributionStatus: 'Pending',
      remarks: 'Urgent request'
    }
  ];

  const getStatusColor = (status: DeliveryStatus) => {
    const colors = {
      'Pending Request': 'bg-gray-100 text-gray-700',
      'For Allocation': 'bg-yellow-100 text-yellow-700',
      'Allocated': 'bg-blue-100 text-blue-700',
      'Released': 'bg-indigo-100 text-indigo-700',
      'In Transit': 'bg-purple-100 text-purple-700',
      'Delivered': 'bg-green-100 text-green-700',
      'Distributed': 'bg-teal-100 text-teal-700',
      'Completed': 'bg-emerald-100 text-emerald-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const filteredRequests = outgoingRequests.filter(request => {
    const matchesSearch =
      request.incidentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.municipality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.lguRequestCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.itemTypeRequested.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProvince = selectedProvince === 'All' || request.province === selectedProvince;
    const matchesStatus = selectedStatus === 'All' || request.deliveryStatus === selectedStatus;

    return matchesSearch && matchesProvince && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Outgoing Module</h1>
          <p className="text-sm text-gray-600 mt-1">Track FNFI requests and deliveries to LGUs</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Request
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by incident, municipality, request code, or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Province Filter */}
          <div>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Provinces</option>
              <option>Iloilo</option>
              <option>Antique</option>
              <option>Capiz</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All Status</option>
              <option>Pending Request</option>
              <option>For Allocation</option>
              <option>Allocated</option>
              <option>Released</option>
              <option>In Transit</option>
              <option>Delivered</option>
              <option>Distributed</option>
              <option>Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Request Code</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Incident</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Municipality</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Item Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Requested</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Allocated</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Released</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Delivery Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-tight">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sm text-gray-900">{request.lguRequestCode}</div>
                    <div className="text-xs text-gray-500">{request.dateRequested}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sm text-gray-900">{request.incidentName}</div>
                    <div className="text-xs text-gray-500">{request.incidentCode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sm text-gray-900">{request.municipality}</div>
                    <div className="text-xs text-gray-500">{request.province}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-sm text-gray-900">{request.itemTypeRequested}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-gray-900">{request.requestedQuantity.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-blue-600">{request.allocatedQuantity.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-green-600">{request.releasedQuantity.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(request.deliveryStatus)}`}>
                      {request.deliveryStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {request.actualDeliveryDate || 'TBD'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Paperclip className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Download className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">No requests found matching your filters</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm font-semibold text-gray-600">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{outgoingRequests.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm font-semibold text-gray-600">In Transit</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {outgoingRequests.filter(r => r.deliveryStatus === 'In Transit').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm font-semibold text-gray-600">Delivered</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {outgoingRequests.filter(r => r.deliveryStatus === 'Delivered').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm font-semibold text-gray-600">Pending Allocation</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {outgoingRequests.filter(r => r.deliveryStatus === 'For Allocation').length}
          </p>
        </div>
      </div>
    </div>
  );
}
