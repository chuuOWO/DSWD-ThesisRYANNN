'use client';

import { useState, useEffect } from 'react';
import { 
  Boxes, 
  Building2, 
  MapPin, 
  Plus, 
  Warehouse, 
  ShieldCheck, 
  X, 
  Check, 
  Trash2,
  ExternalLink,
  Pencil,
  Search,
  Archive,
  RotateCcw,
  Truck
} from 'lucide-react';
import {
  backendApi,
  type LguRecord,
  type ProvinceRecord,
  type WarehouseRecord,
  type SupplySourceRecord,
  type KitTypeRecord,
  type TruckRecord,
  type TruckInput
} from '../../services/backendApi';

type MasterTab = 'kits' | 'sources' | 'lgus' | 'warehouses' | 'trucks';

export interface MasterDataViewProps {
  inventoryState?: {
    refreshKitTypes?: () => Promise<any> | void;
    refreshSupplySources?: () => Promise<any> | void;
    refreshWarehouses?: () => Promise<any> | void;
    refreshProvinces?: () => Promise<any> | void;
    refreshLgus?: () => Promise<any> | void;
    refreshTrucks?: () => Promise<any> | void;
  };
}

export function MasterDataView({ inventoryState }: MasterDataViewProps = {}) {
  const [activeTab, setActiveTab] = useState<MasterTab>('kits');
  
  const [kitTypes, setKitTypes] = useState<KitTypeRecord[]>([]);
  const [sources, setSources] = useState<SupplySourceRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [provinces, setProvinces] = useState<ProvinceRecord[]>([]);
  const [dbLgus, setDbLgus] = useState<LguRecord[]>([]);
  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState('All');
  const [lguStatusFilter, setLguStatusFilter] = useState<'active' | 'archived'>('active');
  const [kitStatusFilter, setKitStatusFilter] = useState<'active' | 'archived'>('active');

  // Search & Filter state
  const [kitSearch, setKitSearch] = useState('');
  const [kitCategoryFilter, setKitCategoryFilter] = useState<'All' | 'Food Item' | 'Non-Food Item'>('All');
  const [sourceSearch, setSourceSearch] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const [truckStatusFilter, setTruckStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

  // Modals state
  const [isAddKitOpen, setIsAddKitOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isAddLguOpen, setIsAddLguOpen] = useState(false);
  const [isAddProvinceOpen, setIsAddProvinceOpen] = useState(false);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isAddTruckOpen, setIsAddTruckOpen] = useState(false);

  // Edit Kit Modal state
  const [editingKit, setEditingKit] = useState<KitTypeRecord | null>(null);
  const [editKitName, setEditKitName] = useState('');
  const [editKitCategory, setEditKitCategory] = useState<'Food Item' | 'Non-Food Item'>('Non-Food Item');
  const [editKitUnit, setEditKitUnit] = useState('kits');
  const [editKitDesc, setEditKitDesc] = useState('');

  // Edit Truck Modal state
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);
  const [editTruckPlate, setEditTruckPlate] = useState('');
  const [editTruckModel, setEditTruckModel] = useState('');
  const [editTruckCapacity, setEditTruckCapacity] = useState('5000');

  // Form states
  const [newKitName, setNewKitName] = useState('');
  const [newKitCategory, setNewKitCategory] = useState<'Food Item' | 'Non-Food Item'>('Non-Food Item');
  const [newKitUnit, setNewKitUnit] = useState('kits');
  const [newKitDesc, setNewKitDesc] = useState('');

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState('Regional Logistics Hub');
  const [newSourceRegion, setNewSourceRegion] = useState('Region VI (Western Visayas)');
  const [newSourceLocation, setNewSourceLocation] = useState('');

  const [newProvinceName, setNewProvinceName] = useState('');

  const [newLguName, setNewLguName] = useState('');
  const [newLguProvince, setNewLguProvince] = useState('');
  const [newLguLat, setNewLguLat] = useState('10.7000');
  const [newLguLng, setNewLguLng] = useState('122.5000');
  const [newLguOfficer, setNewLguOfficer] = useState('');
  const [newLguPhone, setNewLguPhone] = useState('');

  const [newWhName, setNewWhName] = useState('');
  const [newWhProvince, setNewWhProvince] = useState('');
  const [newWhMuni, setNewWhMuni] = useState('Oton');
  const [newWhCapacity, setNewWhCapacity] = useState('50000');
  const [newWhLat, setNewWhLat] = useState('10.7000');
  const [newWhLng, setNewWhLng] = useState('122.5000');

  const [newTruckId, setNewTruckId] = useState('');
  const [newTruckPlate, setNewTruckPlate] = useState('');
  const [newTruckModel, setNewTruckModel] = useState('Isuzu Forward 6-Wheeler (5-Ton)');
  const [newTruckCapacity, setNewTruckCapacity] = useState('5000');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [kits, srcs, whs, provs, lgus, trks] = await Promise.all([
        backendApi.getKitTypes(true),
        backendApi.getSupplySources(),
        backendApi.getWarehouses(),
        backendApi.getProvinces(true),
        backendApi.getLgus(undefined, true),
        backendApi.getTrucks(true)
      ]);
      setKitTypes(kits);
      setSources(srcs);
      setWarehouses(whs);
      setProvinces(provs);
      setDbLgus(lgus);
      setTrucks(trks);
      if (provs.length > 0) {
        setNewLguProvince(prev => prev || provs[0].name);
        setNewWhProvince(prev => prev || provs[0].name);
      }
    } catch (err) {
      console.error('Failed to load master data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, []);

  const handleAddKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitName.trim()) return;

    try {
      const res = await backendApi.createKitType({
        name: newKitName.trim(),
        category: newKitCategory,
        unitType: newKitUnit.trim() || 'kits',
        description: newKitDesc.trim() || 'Custom relief goods package'
      });
      await backendApi.logActivity({
        action: 'KIT_TYPE_CREATED',
        entityType: 'KitType',
        entityId: res?.id || newKitName.trim(),
        details: `Created relief commodity kit type: ${newKitName.trim()} (${newKitCategory})`,
        metadata: { name: newKitName.trim(), category: newKitCategory, unitType: newKitUnit.trim() || 'kits' }
      }).catch(() => {});

      const updated = await backendApi.getKitTypes(true);
      setKitTypes(updated);
      setNewKitName('');
      setNewKitDesc('');
      setIsAddKitOpen(false);
      await inventoryState?.refreshKitTypes?.();
      showToast(`Added new kit type: ${newKitName.trim()}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add kit type');
    }
  };

  const handleEditKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKit || !editKitName.trim()) return;

    try {
      await backendApi.updateKitType(editingKit.id, {
        name: editKitName.trim(),
        category: editKitCategory,
        unitType: editKitUnit.trim() || 'kits',
        description: editKitDesc.trim() || 'Custom relief goods package'
      });
      await backendApi.logActivity({
        action: 'KIT_TYPE_UPDATED',
        entityType: 'KitType',
        entityId: editingKit.id,
        details: `Updated commodity kit type: ${editKitName.trim()}`,
        metadata: { id: editingKit.id, name: editKitName.trim(), category: editKitCategory }
      }).catch(() => {});

      const updated = await backendApi.getKitTypes(true);
      setKitTypes(updated);
      setEditingKit(null);
      await inventoryState?.refreshKitTypes?.();
      showToast(`Updated kit type: ${editKitName.trim()}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update kit type');
    }
  };

  const handleDeleteKit = async (id: string) => {
    try {
      const kit = kitTypes.find(k => k.id === id);
      const res = await backendApi.deleteKitType(id);
      await backendApi.logActivity({
        action: 'KIT_TYPE_DELETED',
        entityType: 'KitType',
        entityId: id,
        details: `${res?.softDeleted ? 'Archived (deactivated)' : 'Deleted'} commodity kit type: ${kit?.name || id}`
      }).catch(() => {});

      if (res?.softDeleted) {
        setKitTypes(prev => prev.map(k => k.id === id ? { ...k, isActive: false } : k));
        showToast('Kit type has historical inventory records and was safely archived from active operations');
      } else {
        setKitTypes(prev => prev.filter(k => k.id !== id));
        showToast('Kit type removed');
      }
      await inventoryState?.refreshKitTypes?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete kit type');
    }
  };

  const handleRestoreKit = async (id: string) => {
    try {
      const kit = kitTypes.find(k => k.id === id);
      await backendApi.restoreKitType(id);
      await backendApi.logActivity({
        action: 'KIT_TYPE_RESTORED',
        entityType: 'KitType',
        entityId: id,
        details: `Restored commodity kit type: ${kit?.name || id}`
      }).catch(() => {});

      setKitTypes(prev => prev.map(k => k.id === id ? { ...k, isActive: true } : k));
      await inventoryState?.refreshKitTypes?.();
      showToast(`Restored kit type: ${kit?.name || id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore kit type');
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    try {
      await backendApi.createSupplySource({
        name: newSourceName.trim(),
        shortCode: newSourceName.trim().slice(0, 8).toUpperCase(),
        facilityType: newSourceType,
        region: newSourceRegion.trim(),
        location: newSourceLocation.trim() || 'Panay Region'
      });
      await backendApi.logActivity({
        action: 'SUPPLY_SOURCE_CREATED',
        entityType: 'SupplySource',
        entityId: newSourceName.trim(),
        details: `Registered logistics supply source: ${newSourceName.trim()} (${newSourceType})`
      }).catch(() => {});

      const updated = await backendApi.getSupplySources();
      setSources(updated);
      setNewSourceName('');
      setNewSourceLocation('');
      setIsAddSourceOpen(false);
      await inventoryState?.refreshSupplySources?.();
      showToast(`Added supply source: ${newSourceName.trim()}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add supply source');
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      const src = sources.find(s => s.id === id);
      const res = await backendApi.deleteSupplySource(id);
      await backendApi.logActivity({
        action: 'SUPPLY_SOURCE_DELETED',
        entityType: 'SupplySource',
        entityId: id,
        details: `${res?.softDeleted ? 'Archived (deactivated)' : 'Deleted'} logistics supply source: ${src?.name || id}`
      }).catch(() => {});

      if (res?.softDeleted) {
        setSources(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s));
        showToast('Supply source has existing records and was safely archived from active operations');
      } else {
        setSources(prev => prev.filter(s => s.id !== id));
        showToast('Supply source removed');
      }
      await inventoryState?.refreshSupplySources?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete supply source');
    }
  };

  const handleAddProvince = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newProvinceName.trim();
    if (!clean) return;

    try {
      await backendApi.createProvince(clean);
      await backendApi.logActivity({
        action: 'PROVINCE_CREATED',
        entityType: 'Province',
        entityId: clean,
        details: `Registered administrative province: ${clean}`
      }).catch(() => {});

      const updated = await backendApi.getProvinces();
      setProvinces(updated);
      setNewProvinceName('');
      setIsAddProvinceOpen(false);
      await inventoryState?.refreshProvinces?.();
      showToast(`Registered new province: ${clean}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add province');
    }
  };

  const handleAddLgu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLguName.trim()) return;

    const lat = parseFloat(newLguLat) || 10.7000;
    const lng = parseFloat(newLguLng) || 122.5000;

    try {
      const res = await backendApi.createLgu({
        municipality: newLguName.trim(),
        province: newLguProvince || provinces[0]?.name || 'Iloilo',
        lguName: `${newLguName.trim()} Municipal Hall`,
        contactPerson: newLguOfficer.trim() || undefined,
        contactNumber: newLguPhone.trim() || undefined,
        latitude: lat,
        longitude: lng
      });
      await backendApi.logActivity({
        action: 'LGU_CREATED',
        entityType: 'LGU',
        entityId: res?.id || newLguName.trim(),
        details: `Registered LGU municipality: ${newLguName.trim()} (${newLguProvince || provinces[0]?.name || 'Iloilo'})`,
        metadata: { municipality: newLguName.trim(), province: newLguProvince || provinces[0]?.name || 'Iloilo' }
      }).catch(() => {});

      const updated = await backendApi.getLgus();
      setDbLgus(updated);
      setNewLguName('');
      setNewLguOfficer('');
      setNewLguPhone('');
      setIsAddLguOpen(false);
      await inventoryState?.refreshLgus?.();
      showToast(`Registered new LGU municipality: ${newLguName.trim()}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to register LGU');
    }
  };

  const handleArchiveLgu = async (id: string) => {
    try {
      const lgu = dbLgus.find(l => l.id === id);
      await backendApi.deleteLgu(id);
      await backendApi.logActivity({
        action: 'ARCHIVE_LGU',
        entityType: 'lgu',
        entityId: id,
        details: `Archived municipality ${lgu?.municipality || id} (${lgu?.province || ''})`
      });
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      await inventoryState?.refreshLgus?.();
      showToast(`Archived municipality: ${lgu?.municipality || id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive LGU');
    }
  };

  const handleRestoreLgu = async (id: string) => {
    try {
      const lgu = dbLgus.find(l => l.id === id);
      await backendApi.restoreLgu(id);
      await backendApi.logActivity({
        action: 'RESTORE_LGU',
        entityType: 'lgu',
        entityId: id,
        details: `Restored municipality ${lgu?.municipality || id} (${lgu?.province || ''})`
      });
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      await inventoryState?.refreshLgus?.();
      showToast(`Restored municipality: ${lgu?.municipality || id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore LGU');
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim()) return;

    try {
      const res = await backendApi.createWarehouse({
        name: newWhName.trim(),
        province: newWhProvince || provinces[0]?.name || 'Iloilo',
        municipality: newWhMuni.trim(),
        capacityPacks: parseInt(newWhCapacity, 10) || 50000,
        latitude: parseFloat(newWhLat) || 10.7000,
        longitude: parseFloat(newWhLng) || 122.5000
      });
      await backendApi.logActivity({
        action: 'WAREHOUSE_CREATED',
        entityType: 'Warehouse',
        entityId: (res as any)?.id || newWhName.trim(),
        details: `Registered warehouse storage facility: ${newWhName.trim()} in ${newWhMuni.trim()}, ${newWhProvince || provinces[0]?.name || 'Iloilo'} (Capacity: ${newWhCapacity})`,
        metadata: { name: newWhName.trim(), municipality: newWhMuni.trim(), capacity: newWhCapacity }
      }).catch(() => {});

      const updated = await backendApi.getWarehouses();
      setWarehouses(updated);
      setNewWhName('');
      setIsAddWarehouseOpen(false);
      await inventoryState?.refreshWarehouses?.();
      showToast(`Registered warehouse facility: ${newWhName.trim()}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to register warehouse');
    }
  };

  const filteredKitTypes = kitTypes.filter(k => {
    const matchesStatus = kitStatusFilter === 'active' ? (k.isActive !== false) : (k.isActive === false);
    if (!matchesStatus) return false;
    const matchesCategory = kitCategoryFilter === 'All' || k.category === kitCategoryFilter;
    if (!matchesCategory) return false;
    if (kitSearch.trim()) {
      const q = kitSearch.toLowerCase();
      return k.name.toLowerCase().includes(q) || (k.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredSources = sources.filter(s => {
    if (sourceSearch.trim()) {
      const q = sourceSearch.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredLgus = dbLgus.filter(l => {
    const matchesStatus = lguStatusFilter === 'active' ? (l.isActive !== false) : (l.isActive === false);
    if (!matchesStatus) return false;
    if (selectedProvinceFilter === 'All') return true;
    return l.province.toLowerCase() === selectedProvinceFilter.toLowerCase();
  });

  const suggestNextTruckId = () => {
    let maxNum = 0;
    for (const t of trucks) {
      const match = t.truckId.match(/^TRUCK-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = maxNum + 1;
    return `TRUCK-${nextNum.toString().padStart(2, '0')}`;
  };

  const openAddTruckModal = () => {
    setNewTruckId(suggestNextTruckId());
    setNewTruckPlate('');
    setNewTruckModel('Isuzu Forward 6-Wheeler (5-Ton)');
    setNewTruckCapacity('5000');
    setIsAddTruckOpen(true);
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTruckId.trim() || !newTruckPlate.trim()) return;

    try {
      const created = await backendApi.createTruck({
        truckId: newTruckId.trim().toUpperCase(),
        plateNumber: newTruckPlate.trim().toUpperCase(),
        model: newTruckModel.trim() || 'Generic Transport Truck (5-Ton)',
        capacityKg: Number(newTruckCapacity) || 5000,
        isActive: true
      });

      await backendApi.logActivity({
        action: 'TRUCK_CREATED',
        entityType: 'Truck',
        entityId: created.truckId,
        details: `Registered convoy transport vehicle: ${created.truckId} (${created.plateNumber}) - ${created.model} [${created.capacityKg} kg payload]`,
        metadata: { truckId: created.truckId, plateNumber: created.plateNumber, capacityKg: created.capacityKg }
      }).catch(() => {});

      const updated = await backendApi.getTrucks(true);
      setTrucks(updated);
      setIsAddTruckOpen(false);
      await inventoryState?.refreshTrucks?.();
      showToast(`Registered vehicle ${created.truckId} (${created.plateNumber})`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to register vehicle');
    }
  };

  const handleEditTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTruck || !editTruckPlate.trim()) return;

    try {
      await backendApi.updateTruck(editingTruck.truckId, {
        plateNumber: editTruckPlate.trim().toUpperCase(),
        model: editTruckModel.trim() || 'Generic Transport Truck (5-Ton)',
        capacityKg: Number(editTruckCapacity) || 5000
      });

      await backendApi.logActivity({
        action: 'TRUCK_UPDATED',
        entityType: 'Truck',
        entityId: editingTruck.truckId,
        details: `Updated convoy transport vehicle: ${editingTruck.truckId} (${editTruckPlate.trim().toUpperCase()}) - ${editTruckModel.trim()}`,
        metadata: { truckId: editingTruck.truckId, plateNumber: editTruckPlate.trim().toUpperCase() }
      }).catch(() => {});

      const updated = await backendApi.getTrucks(true);
      setTrucks(updated);
      setEditingTruck(null);
      await inventoryState?.refreshTrucks?.();
      showToast(`Updated vehicle details for ${editingTruck.truckId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update vehicle');
    }
  };

  const handleArchiveTruck = async (truckId: string) => {
    try {
      await backendApi.archiveTruck(truckId);
      await backendApi.logActivity({
        action: 'TRUCK_ARCHIVED',
        entityType: 'Truck',
        entityId: truckId,
        details: `Archived convoy transport vehicle ${truckId}`
      }).catch(() => {});

      const updated = await backendApi.getTrucks(true);
      setTrucks(updated);
      await inventoryState?.refreshTrucks?.();
      showToast(`Archived vehicle ${truckId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive vehicle');
    }
  };

  const handleRestoreTruck = async (truckId: string) => {
    try {
      await backendApi.restoreTruck(truckId);
      await backendApi.logActivity({
        action: 'TRUCK_RESTORED',
        entityType: 'Truck',
        entityId: truckId,
        details: `Restored convoy transport vehicle ${truckId}`
      }).catch(() => {});

      const updated = await backendApi.getTrucks(true);
      setTrucks(updated);
      await inventoryState?.refreshTrucks?.();
      showToast(`Restored vehicle ${truckId} to active fleet`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore vehicle');
    }
  };

  const filteredTrucks = trucks.filter((t) => {
    const matchesStatus =
      truckStatusFilter === 'all'
        ? true
        : truckStatusFilter === 'active'
        ? t.isActive !== false
        : t.isActive === false;
    if (!matchesStatus) return false;

    if (truckSearch.trim()) {
      const q = truckSearch.toLowerCase();
      return (
        t.truckId.toLowerCase().includes(q) ||
        t.plateNumber.toLowerCase().includes(q) ||
        (t.model || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Data & Directory</h1>
          <p className="text-sm text-gray-600 mt-1">
            Centralized scalability hub: register relief kit commodities, regional supply sources, municipal LGUs, warehouse facilities, and convoy transport fleet.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('kits')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'kits'
              ? 'bg-[#2500ba] text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Boxes size={15} />
          <span>Kit Types ({kitTypes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sources')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'sources'
              ? 'bg-[#2500ba] text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Building2 size={15} />
          <span>Supply Sources ({sources.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lgus')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'lgus'
              ? 'bg-[#2500ba] text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <MapPin size={15} />
          <span>Municipalities & Provinces ({filteredLgus.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'warehouses'
              ? 'bg-[#2500ba] text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Warehouse size={15} />
          <span>Warehouses & Facilities ({warehouses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trucks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'trucks'
              ? 'bg-[#2500ba] text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Truck size={15} />
          <span>Convoy Fleet ({trucks.length})</span>
        </button>
      </div>

      {/* TAB 1: KIT TYPES (FNFI CATALOG) */}
      {activeTab === 'kits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Relief Goods Catalog</h2>
              <p className="text-xs text-gray-500">Authorized items for incoming allocation and outgoing dispatch</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddKitOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Kit Type</span>
            </button>
          </div>

          {/* Status, Search and Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 border border-gray-200">
              <button
                type="button"
                onClick={() => setKitStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  kitStatusFilter === 'active' ? 'bg-[#2500ba] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({kitTypes.filter(k => k.isActive !== false).length})
              </button>
              <button
                type="button"
                onClick={() => setKitStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  kitStatusFilter === 'archived' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Archived ({kitTypes.filter(k => k.isActive === false).length})
              </button>
            </div>

            <div className="flex flex-1 sm:justify-end gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search kit types by name or description..."
                  value={kitSearch}
                  onChange={(e) => setKitSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2500ba]/20 focus:border-[#2500ba] bg-white"
                />
              </div>
              <select
                value={kitCategoryFilter}
                onChange={(e) => setKitCategoryFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2500ba]/20 font-medium bg-white"
              >
                <option value="All">All Categories</option>
                <option value="Food Item">Food Item</option>
                <option value="Non-Food Item">Non-Food Item</option>
              </select>
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto pr-1">
            {filteredKitTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No kit types found matching criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredKitTypes.map((kit) => (
                  <div key={kit.id} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            kit.category === 'Food Item' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {kit.category}
                          </span>
                          {kit.isActive === false && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                              Archived
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mt-1">{kit.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {kit.isActive === false ? (
                          <button
                            type="button"
                            onClick={() => handleRestoreKit(kit.id)}
                            className="p-1 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Restore kit type to active catalog"
                          >
                            <RotateCcw size={13} />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingKit(kit);
                                setEditKitName(kit.name);
                                setEditKitCategory(kit.category);
                                setEditKitUnit(kit.unitType);
                                setEditKitDesc(kit.description || '');
                              }}
                              className="p-1 rounded-lg text-gray-400 hover:text-[#2500ba] hover:bg-blue-50 transition cursor-pointer"
                              title="Edit kit type"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKit(kit.id)}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Remove kit type"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{kit.description}</p>
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Unit: <strong className="text-gray-800">{kit.unitType}</strong></span>
                      {kit.isActive === false ? (
                        <span className="flex items-center gap-1 text-amber-600 font-semibold">
                          <Archive size={12} /> Archived FNFI
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <ShieldCheck size={12} /> Active FNFI
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLY SOURCES */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">National & Regional Supply Facilities</h2>
              <p className="text-xs text-gray-500">Origin centers for incoming manifests and direct national deliveries</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddSourceOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Supply Source</span>
            </button>
          </div>

          {/* Search Source */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search supply sources by name, region, or location..."
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2500ba]/20 focus:border-[#2500ba]"
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto pr-1">
            {filteredSources.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No supply sources found matching criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSources.map((src) => (
                  <div key={src.id} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                          {src.facilityType}
                        </span>
                        <h3 className="text-sm font-bold text-gray-900 mt-1">{src.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(src.id)}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Remove source"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>Region: <strong className="text-gray-800">{src.region}</strong></p>
                      <p>Location: <span className="text-gray-700">{src.location}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MUNICIPALITIES & PROVINCES */}
      {activeTab === 'lgus' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">LGU Municipalities & Provinces</h2>
              <p className="text-xs text-gray-500">Destination directory for relief operations and live stock materialization</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddProvinceOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 transition shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Province</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddLguOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Municipality</span>
              </button>
            </div>
          </div>

          {/* Status Filter Toggle & Province Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setLguStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lguStatusFilter === 'active' ? 'bg-[#2500ba] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({dbLgus.filter(l => l.isActive !== false).length})
              </button>
              <button
                type="button"
                onClick={() => setLguStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  lguStatusFilter === 'archived' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Archived ({dbLgus.filter(l => l.isActive === false).length})
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <button
                type="button"
                onClick={() => setSelectedProvinceFilter('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedProvinceFilter === 'All'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Provinces
              </button>
              {provinces.map((prov) => (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => setSelectedProvinceFilter(prov.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedProvinceFilter === prov.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {prov.name}
                </button>
              ))}
            </div>
          </div>

          {/* LGUs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredLgus.map((lgu: any) => (
              <div key={lgu.id || lgu.municipality} className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-gray-900">{lgu.municipality}</h4>
                    {lgu.isActive === false && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {lgu.province}
                    </span>
                    {lgu.isActive === false ? (
                      <button
                        type="button"
                        onClick={() => handleRestoreLgu(lgu.id)}
                        className="p-1 rounded-md text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                        title="Restore Municipality"
                      >
                        <RotateCcw size={12} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleArchiveLgu(lgu.id)}
                        className="p-1 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                        title="Archive Municipality"
                      >
                        <Archive size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 font-mono">
                  GPS: {(lgu.latitude ?? lgu.lat)?.toFixed(4)}, {(lgu.longitude ?? lgu.lng)?.toFixed(4)}
                </p>
                {lgu.contactPerson && (
                  <p className="text-[11px] text-gray-600">Officer: {lgu.contactPerson}</p>
                )}
              </div>
            ))}
            {filteredLgus.length === 0 && (
              <div className="col-span-full text-center py-8 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                {lguStatusFilter === 'active' ? 'No active municipalities found matching filter.' : 'No archived municipalities found.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WAREHOUSES & FACILITIES */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Regional Warehouses & Staging Hubs</h2>
              <p className="text-xs text-gray-500">Physical storage centers holding minted emergency inventory</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddWarehouseOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Warehouse</span>
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouses.map((wh) => (
                <div key={wh.id} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">{wh.name}</h3>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Active Storage
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1.5">
                    <p>Location: <strong>{wh.municipality}, {wh.province}</strong></p>
                    <p>Total Holding Capacity: <strong>{wh.capacityPacks.toLocaleString()} relief items</strong></p>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-amber-900">
                        <span className="font-semibold block text-[10px] text-amber-700">Food Capacity (60%)</span>
                        <strong>{Math.round(wh.capacityPacks * 0.6).toLocaleString()}</strong> packs
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded p-1.5 text-blue-900">
                        <span className="font-semibold block text-[10px] text-blue-700">Non-Food Capacity (40%)</span>
                        <strong>{(wh.capacityPacks - Math.round(wh.capacityPacks * 0.6)).toLocaleString()}</strong> kits/units
                      </div>
                    </div>
                    <p className="font-mono text-[11px] text-gray-500 pt-0.5">
                      GPS Coordinates: {wh.latitude.toFixed(4)}, {wh.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CONVOY FLEET */}
      {activeTab === 'trucks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Convoy Transport Fleet</h2>
              <p className="text-xs text-gray-500">
                Registered logistics haulers, relief cargo trucks, and heavy transport vehicles across Western Visayas
              </p>
            </div>
            <button
              type="button"
              onClick={openAddTruckModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus size={15} />
              <span>Register Vehicle</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search convoy fleet by Truck ID, Plate Number, or Model..."
                value={truckSearch}
                onChange={(e) => setTruckSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2500ba]/20 focus:border-[#2500ba]"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTruckStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  truckStatusFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({trucks.length})
              </button>
              <button
                type="button"
                onClick={() => setTruckStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  truckStatusFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({trucks.filter(t => t.isActive !== false).length})
              </button>
              <button
                type="button"
                onClick={() => setTruckStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  truckStatusFilter === 'archived' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Archived ({trucks.filter(t => t.isActive === false).length})
              </button>
            </div>
          </div>

          {/* Vehicles Grid */}
          <div className="max-h-[460px] overflow-y-auto pr-1">
            {filteredTrucks.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-500 border border-dashed border-gray-200 rounded-2xl">
                No convoy vehicles found matching your criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTrucks.map((truck) => (
                  <div
                    key={truck.truckId}
                    className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-3 transition hover:border-gray-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-[#2500ba] border border-blue-200">
                            {truck.truckId}
                          </span>
                          {truck.isActive === false ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                              Archived
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <ShieldCheck size={11} /> Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-[11px] font-mono font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-300">
                            {truck.plateNumber}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTruck(truck);
                            setEditTruckPlate(truck.plateNumber);
                            setEditTruckModel(truck.model);
                            setEditTruckCapacity(String(truck.capacityKg || 5000));
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#2500ba] hover:bg-blue-50 transition cursor-pointer"
                          title="Edit vehicle specifications"
                        >
                          <Pencil size={14} />
                        </button>
                        {truck.isActive === false ? (
                          <button
                            type="button"
                            onClick={() => handleRestoreTruck(truck.truckId)}
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="Restore vehicle to active fleet"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleArchiveTruck(truck.truckId)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="Archive vehicle"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-2.5">
                      <p className="font-semibold text-gray-900">{truck.model || 'Standard Transport Truck'}</p>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>Max Payload:</span>
                        <span className="font-bold text-gray-800">
                          {Number(truck.capacityKg || 5000).toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT KIT TYPE */}
      {editingKit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Edit Kit Type</h3>
              <button type="button" onClick={() => setEditingKit(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditKit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kit Name *</label>
                <input
                  type="text"
                  required
                  value={editKitName}
                  onChange={(e) => setEditKitName(e.target.value)}
                  placeholder="e.g. Water Purification Kit"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={editKitCategory}
                    onChange={(e) => setEditKitCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  >
                    <option value="Food Item">Food Item</option>
                    <option value="Non-Food Item">Non-Food Item</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Unit Type</label>
                  <input
                    type="text"
                    value={editKitUnit}
                    onChange={(e) => setEditKitUnit(e.target.value)}
                    placeholder="kits, packs, boxes"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  value={editKitDesc}
                  onChange={(e) => setEditKitDesc(e.target.value)}
                  placeholder="Specify standard contents and relief specifications"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingKit(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD KIT TYPE */}
      {isAddKitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add New Kit Type</h3>
              <button type="button" onClick={() => setIsAddKitOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddKit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kit Name *</label>
                <input
                  type="text"
                  required
                  value={newKitName}
                  onChange={(e) => setNewKitName(e.target.value)}
                  placeholder="e.g. Water Purification Kit"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={newKitCategory}
                    onChange={(e) => setNewKitCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  >
                    <option value="Food Item">Food Item</option>
                    <option value="Non-Food Item">Non-Food Item</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Unit Type</label>
                  <input
                    type="text"
                    value={newKitUnit}
                    onChange={(e) => setNewKitUnit(e.target.value)}
                    placeholder="kits, packs, boxes"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  value={newKitDesc}
                  onChange={(e) => setNewKitDesc(e.target.value)}
                  placeholder="Specify standard contents and relief specifications"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddKitOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800"
                >
                  Save Kit Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD SUPPLY SOURCE */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add Supply Source</h3>
              <button type="button" onClick={() => setIsAddSourceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddSource} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Source Center Name *</label>
                <input
                  type="text"
                  required
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="e.g. Mindanao Disaster Resource Center (MDRC)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Facility Type</label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                >
                  <option value="National Resource Center">National Resource Center</option>
                  <option value="Regional Logistics Hub">Regional Logistics Hub</option>
                  <option value="Staging Warehouse">Staging Warehouse</option>
                  <option value="External Partner">External Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Region / Province</label>
                <input
                  type="text"
                  value={newSourceRegion}
                  onChange={(e) => setNewSourceRegion(e.target.value)}
                  placeholder="e.g. Region VI"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Location Details</label>
                <input
                  type="text"
                  value={newSourceLocation}
                  onChange={(e) => setNewSourceLocation(e.target.value)}
                  placeholder="Address or hub location"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800"
                >
                  Save Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD PROVINCE */}
      {isAddProvinceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add New Province</h3>
              <button type="button" onClick={() => setIsAddProvinceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddProvince} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Province Name *</label>
                <input
                  type="text"
                  required
                  value={newProvinceName}
                  onChange={(e) => setNewProvinceName(e.target.value)}
                  placeholder="e.g. Guimaras"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddProvinceOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800"
                >
                  Save Province
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD MUNICIPALITY */}
      {isAddLguOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Register New LGU Municipality</h3>
              <button type="button" onClick={() => setIsAddLguOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddLgu} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Municipality Name *</label>
                  <input
                    type="text"
                    required
                    value={newLguName}
                    onChange={(e) => setNewLguName(e.target.value)}
                    placeholder="e.g. Jordan"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Province *</label>
                  <select
                    value={newLguProvince}
                    onChange={(e) => setNewLguProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  >
                    {provinces.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={newLguLat}
                    onChange={(e) => setNewLguLat(e.target.value)}
                    placeholder="10.6000"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={newLguLng}
                    onChange={(e) => setNewLguLng(e.target.value)}
                    placeholder="122.5800"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Officer Name</label>
                <input
                  type="text"
                  value={newLguOfficer}
                  onChange={(e) => setNewLguOfficer(e.target.value)}
                  placeholder="e.g. Officer Juan Dela Cruz"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={newLguPhone}
                  onChange={(e) => setNewLguPhone(e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddLguOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800"
                >
                  Save to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD WAREHOUSE */}
      {isAddWarehouseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add Regional Warehouse</h3>
              <button type="button" onClick={() => setIsAddWarehouseOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddWarehouse} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Warehouse Facility Name *</label>
                <input
                  type="text"
                  required
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  placeholder="e.g. Roxas City Disaster Depot"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Province</label>
                  <select
                    value={newWhProvince}
                    onChange={(e) => setNewWhProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  >
                    {provinces.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Municipality</label>
                  <input
                    type="text"
                    value={newWhMuni}
                    onChange={(e) => setNewWhMuni(e.target.value)}
                    placeholder="e.g. Roxas City"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Capacity (Food Packs)</label>
                <input
                  type="number"
                  value={newWhCapacity}
                  onChange={(e) => setNewWhCapacity(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={newWhLat}
                    onChange={(e) => setNewWhLat(e.target.value)}
                    placeholder="11.5800"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={newWhLng}
                    onChange={(e) => setNewWhLng(e.target.value)}
                    placeholder="122.7500"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddWarehouseOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800"
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER CONVOY VEHICLE */}
      {isAddTruckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2500ba]">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Register Convoy Vehicle</h3>
                  <p className="text-[11px] text-gray-500">Add a transport truck to the regional relief fleet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTruckOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddTruck} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Truck ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTruckId}
                    onChange={(e) => setNewTruckId(e.target.value.toUpperCase())}
                    placeholder="e.g. TRUCK-11"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Format: TRUCK-XX</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Plate Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTruckPlate}
                    onChange={(e) => setNewTruckPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. SAA-1011"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Official LTO Plate</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Vehicle Model & Specifications <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    value={newTruckModel}
                    onChange={(e) => setNewTruckModel(e.target.value)}
                    placeholder="e.g. Isuzu Forward 6-Wheeler (5-Ton)"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Isuzu Forward 6-Wheeler (5-Ton)',
                      'Hino 500 Series (6-Ton)',
                      'Fuso Fighter (7-Ton Heavy)',
                      'Isuzu Elf Light Cargo (3-Ton)',
                      'Mitsubishi Canter (3-Ton)'
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewTruckModel(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
                          newTruckModel === preset
                            ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Max Payload Capacity (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  max="50000"
                  value={newTruckCapacity}
                  onChange={(e) => setNewTruckCapacity(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Standard 5-ton = 5000 kg (~830 Family Food Packs)</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddTruckOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer"
                >
                  Register Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CONVOY VEHICLE */}
      {editingTruck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2500ba]">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Edit Vehicle: {editingTruck.truckId}</h3>
                  <p className="text-[11px] text-gray-500">Update convoy fleet specifications</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTruck(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditTruck} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Plate Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTruckPlate}
                  onChange={(e) => setEditTruckPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. SAA-1001"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Vehicle Model & Specifications <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTruckModel}
                  onChange={(e) => setEditTruckModel(e.target.value)}
                  placeholder="e.g. Isuzu Forward 6-Wheeler (5-Ton)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Max Payload Capacity (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  max="50000"
                  value={editTruckCapacity}
                  onChange={(e) => setEditTruckCapacity(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingTruck(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
