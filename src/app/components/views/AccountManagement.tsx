'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
  X,
  ExternalLink,
  Key
} from 'lucide-react';
import { authApi, type UserProfile } from '../../services/authApi';
import { blockchain } from '../../services/blockchain';
import { PANAY_LGUS, type LguLocation } from '../../data/panayLguDirectory';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';

/**
 * Extracts strictly the municipality name from any raw string,
 * cleaning away facility descriptions (e.g. "Leon (Leon Municipal Office)" -> "Leon").
 */
export function extractCleanMunicipality(rawName?: string | null): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  // 1. Exact match with a Panay municipality
  const exact = PANAY_LGUS.find(
    (l) => l.municipality.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact.municipality;

  // 2. Sort by length descending to match longer municipality names first (e.g. "San Jose de Buenavista")
  const sorted = [...PANAY_LGUS].sort(
    (a, b) => b.municipality.length - a.municipality.length
  );
  const starts = sorted.find((l) =>
    trimmed.toLowerCase().startsWith(l.municipality.toLowerCase())
  );
  if (starts) return starts.municipality;

  const includes = sorted.find((l) =>
    trimmed.toLowerCase().includes(l.municipality.toLowerCase())
  );
  if (includes) return includes.municipality;

  // 3. Fallback: strip parenthesis or facility suffixes
  return trimmed
    .split('(')[0]
    .replace(/municipal.*|city.*|office.*|government.*|evacuation.*|hall.*|warehouse.*/i, '')
    .trim();
}

interface MunicipalitySearchPickerProps {
  value: string;
  onChange: (municipality: string) => void;
  disabled?: boolean;
}

function MunicipalitySearchPicker({
  value,
  onChange,
  disabled = false
}: MunicipalitySearchPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (value) setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Look up province for the currently selected municipality
  const matchedLgu = useMemo(() => {
    if (!value) return null;
    return (
      PANAY_LGUS.find(
        (l) => l.municipality.toLowerCase() === value.toLowerCase()
      ) ?? null
    );
  }, [value]);

  // Filter Panay LGUs by query (municipality or province)
  const filteredLgus = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...PANAY_LGUS].sort((a, b) => a.municipality.localeCompare(b.municipality));
    }
    return PANAY_LGUS.filter(
      (l) =>
        l.municipality.toLowerCase().includes(q) ||
        l.province.toLowerCase().includes(q)
    ).sort((a, b) => {
      const aStarts = a.municipality.toLowerCase().startsWith(q);
      const bStarts = b.municipality.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.municipality.localeCompare(b.municipality);
    });
  }, [query]);

  // If a municipality is assigned and not in edit mode, display the clean assigned badge
  if (value && !isEditing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-bold shadow-sm">
          <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
          <span>{value}</span>
          {matchedLgu && (
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.5 rounded">
              {matchedLgu.province}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            setIsOpen(true);
            setQuery('');
          }}
          disabled={disabled}
          title="Change municipality"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition border border-gray-200 shadow-2xs active:scale-95 disabled:opacity-50"
        >
          <Search className="w-3 h-3" />
          Change
        </button>

        <button
          type="button"
          onClick={() => onChange('')}
          disabled={disabled}
          title="Unassign and set to Field Receiver mode"
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-gray-200 shadow-2xs active:scale-95 disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      </div>
    );
  }

  // Otherwise, render the municipality search bar & typeahead suggestions
  return (
    <div ref={containerRef} className="relative w-full min-w-[240px] max-w-sm">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              if (value) setIsEditing(false);
            }
          }}
          placeholder="Search municipality (e.g. Leon, Miag-ao)..."
          disabled={disabled}
          className="w-full pl-8 pr-16 py-2 text-xs font-semibold rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white shadow-sm"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setIsOpen(false);
              }}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded bg-gray-100 transition"
              title="Done editing"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100 animate-in fade-in-50 duration-100">
          {/* Quick reset to unassigned receiver mode */}
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsEditing(false);
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50 flex items-center gap-2 transition"
          >
            <Truck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>🚫 Unassigned / Receiver</span>
          </button>

          {filteredLgus.length === 0 ? (
            <div className="p-3 text-center text-xs text-gray-400">
              No municipality found matching &quot;{query}&quot;
            </div>
          ) : (
            filteredLgus.map((lgu) => {
              const isSelected = value.toLowerCase() === lgu.municipality.toLowerCase();
              return (
                <button
                  key={lgu.municipality}
                  type="button"
                  onClick={() => {
                    onChange(lgu.municipality);
                    setQuery('');
                    setIsEditing(false);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-blue-50 transition ${
                    isSelected ? 'bg-indigo-50/70 font-bold text-indigo-900' : 'text-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'text-indigo-600' : 'text-gray-400'
                      }`}
                    />
                    <span className="font-bold">{lgu.municipality}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {lgu.province}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface AccountManagementProps {
  currentAdminEmail?: string;
}

export function AccountManagement({ currentAdminEmail }: AccountManagementProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'receiver' | 'dswd_admin'>('all');
  const [lguFilter, setLguFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Local pending assignments: userId -> clean municipality name (empty string means receiver / unassigned)
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Updating Account Profile');
  const [modalSubtitle, setModalSubtitle] = useState('Persisting LGU assignment to Supabase...');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Blockchain Operator Authorization states
  const [authStatusMap, setAuthStatusMap] = useState<Record<string, boolean>>({});
  const [authorizingWallet, setAuthorizingWallet] = useState<string | null>(null);
  const [blockchainNotice, setBlockchainNotice] = useState<{ type: 'success' | 'error'; message: string; txHash?: string } | null>(null);
  const [customWalletInput, setCustomWalletInput] = useState('');
  const [isAuthorizingCustom, setIsAuthorizingCustom] = useState(false);

  const checkBlockchainAuth = async (profilesList: UserProfile[]) => {
    const status: Record<string, boolean> = {};
    for (const p of profilesList) {
      if (p.walletAddress) {
        try {
          status[p.walletAddress.toLowerCase()] = await blockchain.isOperatorAuthorized(p.walletAddress);
        } catch {
          status[p.walletAddress.toLowerCase()] = false;
        }
      }
    }
    setAuthStatusMap(status);
  };

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await authApi.getAllProfiles();
      setProfiles(data);
      // Initialize pending assignments map with clean municipality names
      const map: Record<string, string> = {};
      data.forEach((p) => {
        map[p.id] = extractCleanMunicipality(p.lguName);
      });
      setAssignments(map);
      // Check blockchain custody authorization status for linked wallets
      void checkBlockchainAuth(data);
    } catch (err) {
      console.warn('Failed to load profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorizeWallet = async (walletAddress: string) => {
    setAuthorizingWallet(walletAddress);
    setBlockchainNotice(null);
    try {
      const proof = await blockchain.authorizeOperator(walletAddress);
      setAuthStatusMap((prev) => ({ ...prev, [walletAddress.toLowerCase()]: true }));
      setBlockchainNotice({
        type: 'success',
        message: `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} authorized on Sepolia smart contract!`,
        txHash: proof.hash
      });
    } catch (err: any) {
      setBlockchainNotice({
        type: 'error',
        message: err?.message || 'Failed to authorize wallet on blockchain.'
      });
    } finally {
      setAuthorizingWallet(null);
    }
  };

  const handleAuthorizeCustomWallet = async () => {
    const addr = customWalletInput.trim();
    if (!addr) return;
    setIsAuthorizingCustom(true);
    setBlockchainNotice(null);
    try {
      const proof = await blockchain.authorizeOperator(addr);
      setAuthStatusMap((prev) => ({ ...prev, [addr.toLowerCase()]: true }));
      setBlockchainNotice({
        type: 'success',
        message: `Wallet ${addr.slice(0, 6)}...${addr.slice(-4)} authorized on Sepolia smart contract!`,
        txHash: proof.hash
      });
      setCustomWalletInput('');
    } catch (err: any) {
      setBlockchainNotice({
        type: 'error',
        message: err?.message || 'Failed to authorize custom wallet on blockchain.'
      });
    } finally {
      setIsAuthorizingCustom(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    const unsub = authApi.subscribeProfiles(() => {
      loadProfiles();
    });
    return unsub;
  }, []);

  const handleLguChange = (userId: string, newMunicipality: string) => {
    setAssignments((prev) => ({
      ...prev,
      [userId]: newMunicipality
    }));
  };

  const handleSaveAssignment = async (profile: UserProfile) => {
    const targetMunicipality = assignments[profile.id] || null;
    setSavingUserId(profile.id);
    setModalTitle(`Assigning ${profile.fullName || profile.email}`);
    setModalSubtitle(
      targetMunicipality
        ? `Designating account as Official LGU Receiver for ${targetMunicipality}...`
        : 'Reverting account to Field Receiver mode...'
    );
    setIsModalOpen(true);

    try {
      await authApi.assignProfileLgu(profile.id, targetMunicipality);

      // Keep modal open briefly to complete the 5 dots animation cleanly
      setTimeout(() => {
        setIsModalOpen(false);
        setSavingUserId(null);
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profile.id ? { ...p, lguName: targetMunicipality } : p
          )
        );
        setToastMessage({
          type: 'success',
          text: targetMunicipality
            ? `Successfully assigned ${profile.fullName || profile.email} as official LGU receiver for ${targetMunicipality}!`
            : `Set ${profile.fullName || profile.email} to Field Receiver mode.`
        });
      }, 1500);
    } catch (err) {
      setTimeout(() => {
        setIsModalOpen(false);
        setSavingUserId(null);
        setToastMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to update account assignment.'
        });
      }, 1000);
    }
  };

  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);

  const handleVerifyUser = async (user: UserProfile) => {
    setVerifyingUserId(user.id);
    setModalTitle('Verifying Account');
    setModalSubtitle(`Activating ${user.email} for DSWD system access...`);
    setIsModalOpen(true);
    try {
      await authApi.verifyProfile(user.id);
      setToastMessage({
        type: 'success',
        text: `Account for ${user.fullName} (${user.email}) has been successfully verified!`
      });
      await loadProfiles();
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to verify account.'
      });
    } finally {
      setIsModalOpen(false);
      setVerifyingUserId(null);
    }
  };

  const handleDeclineUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to decline registration for ${user.email}?`)) return;
    setVerifyingUserId(user.id);
    try {
      await authApi.rejectProfile(user.id);
      setToastMessage({
        type: 'success',
        text: `Registration for ${user.email} has been declined.`
      });
      await loadProfiles();
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to decline registration.'
      });
    } finally {
      setVerifyingUserId(null);
    }
  };

  const pendingProfiles = useMemo(() => {
    return profiles.filter((p) => p.status === 'pending');
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Pending accounts are managed in the dedicated Signups Awaiting Verification queue at the bottom
      if (p.status === 'pending') return false;

      const cleanLgu = extractCleanMunicipality(p.lguName);
      const matchSearch =
        p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.truckId && p.truckId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cleanLgu && cleanLgu.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole =
        roleFilter === 'all' ? true : p.role === roleFilter;

      const isAssigned = Boolean(cleanLgu && cleanLgu.trim());
      const matchLgu =
        lguFilter === 'all'
          ? true
          : lguFilter === 'assigned'
          ? isAssigned
          : !isAssigned && p.role === 'receiver';

      return matchSearch && matchRole && matchLgu;
    });
  }, [profiles, searchQuery, roleFilter, lguFilter]);

  const stats = useMemo(() => {
    const verifiedProfiles = profiles.filter((p) => p.status !== 'pending' && p.status !== 'rejected');
    const total = verifiedProfiles.length;
    const pending = profiles.filter((p) => p.status === 'pending').length;
    const lguReceivers = verifiedProfiles.filter(
      (p) => p.role === 'receiver' && extractCleanMunicipality(p.lguName)
    ).length;
    const receivers = verifiedProfiles.filter(
      (p) => p.role === 'receiver' && !extractCleanMunicipality(p.lguName)
    ).length;
    const admins = verifiedProfiles.filter((p) => p.role === 'dswd_admin').length;
    return { total, pending, lguReceivers, receivers, admins };
  }, [profiles]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 5-Dot Loading Modal for Comfy Admin UI */}
      <FiveDotsLoadingModal
        isOpen={isModalOpen}
        title={modalTitle}
        subtitle={modalSubtitle}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-blue-600" />
            Receiver Account & LGU Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Assign registered receiver accounts to Panay LGU municipalities (LGU Receiver) or field delivery (Receiver).
          </p>
        </div>

        <button
          type="button"
          onClick={loadProfiles}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Accounts
        </button>
      </div>

      {/* Toast alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm font-semibold animate-in fade-in duration-150 ${
            toastMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{stats.total}</p>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Accounts</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-sm flex items-center gap-4 bg-gradient-to-br from-indigo-50/50 to-white">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-indigo-900">{stats.lguReceivers}</p>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">LGU Receivers</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm flex items-center gap-4 bg-gradient-to-br from-purple-50/50 to-white">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-purple-900">{stats.receivers}</p>
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Receivers</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm flex items-center gap-4 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-900">{stats.admins}</p>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">DSWD Admins</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search accounts by name, email, truck ID, or municipality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Roles
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('receiver')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === 'receiver' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receivers
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('dswd_admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === 'dswd_admin' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admins
            </button>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setLguFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                lguFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setLguFilter('assigned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                lguFilter === 'assigned' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              LGU Receiver
            </button>
            <button
              type="button"
              onClick={() => setLguFilter('unassigned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                lguFilter === 'unassigned' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receiver
            </button>
          </div>
        </div>
      </div>

      {/* Blockchain Authorization Notice */}
      {blockchainNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            blockchainNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-bold">{blockchainNotice.message}</p>
              {blockchainNotice.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${blockchainNotice.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 underline font-mono text-[11px] inline-flex items-center gap-1 hover:text-emerald-900 mt-0.5"
                >
                  View on Sepolia Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBlockchainNotice(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sepolia Blockchain Custody Authorization Strip */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-extrabold text-sm flex items-center gap-1.5 text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Smart Contract Custody Authorization
          </h4>
          <p className="text-xs text-blue-200/80 mt-0.5">
            Authorize receiver wallets to sign and take custody of ERC-1155 tokens on Sepolia.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="0x Receiver Wallet Address"
            value={customWalletInput}
            onChange={(e) => setCustomWalletInput(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white/10 border border-white/20 text-white placeholder-blue-300/50 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full sm:w-64"
          />
          <button
            type="button"
            onClick={handleAuthorizeCustomWallet}
            disabled={isAuthorizingCustom || !customWalletInput.trim()}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            {isAuthorizingCustom ? 'Authorizing...' : 'Authorize on Sepolia'}
          </button>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/75 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-gray-900">User Account Directory</h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black">
              {filteredProfiles.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">Changes take effect immediately on next login</p>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-700">No matching accounts found</p>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[380px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Account Info</th>
                  <th className="px-6 py-3.5">System Role</th>
                  <th className="px-6 py-3.5">Truck ID</th>
                  <th className="px-6 py-3.5">Assigned LGU Municipality</th>
                  <th className="px-6 py-3.5">MetaMask & Blockchain Custody</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProfiles.map((profile) => {
                  const originalCleanLgu = extractCleanMunicipality(profile.lguName);
                  const currentPendingLgu = assignments[profile.id] ?? originalCleanLgu;
                  const hasChanged = currentPendingLgu !== originalCleanLgu;
                  const isCurrentAdmin =
                    currentAdminEmail &&
                    profile.email.toLowerCase() === currentAdminEmail.toLowerCase();
                  const isLgu = profile.role === 'receiver' && Boolean(currentPendingLgu.trim());

                  return (
                    <tr key={profile.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              profile.role === 'dswd_admin'
                                ? 'bg-emerald-100 text-emerald-800'
                                : isLgu
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {profile.fullName
                              ? profile.fullName.slice(0, 2).toUpperCase()
                              : profile.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 leading-tight flex items-center gap-1.5">
                              {profile.fullName || 'DSWD Officer'}
                              {isCurrentAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-gray-200 text-gray-700 text-[10px] font-extrabold">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                              {profile.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                            profile.role === 'dswd_admin'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {profile.role === 'dswd_admin' ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              DSWD Admin
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Receiver
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {profile.truckId ? (
                          <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">
                            {profile.truckId}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
                      </td>

                      <td className="px-6 py-4 relative">
                        {profile.role === 'receiver' ? (
                          <div className="space-y-1.5 max-w-sm">
                            <MunicipalitySearchPicker
                              value={currentPendingLgu}
                              onChange={(muni) => handleLguChange(profile.id, muni)}
                              disabled={savingUserId === profile.id}
                            />

                            <div className="flex items-center gap-2">
                              {currentPendingLgu ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                                  <Building2 className="w-3 h-3" />
                                  Official LGU Receiver ({currentPendingLgu})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700">
                                  <Truck className="w-3 h-3" />
                                  Field Delivery / Receiver Mode
                                </span>
                              )}
                              {hasChanged && (
                                <span className="text-[10px] font-black uppercase text-amber-600 animate-pulse">
                                  • Unsaved
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Admin (Full Central Access)
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {profile.role === 'dswd_admin' ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span>Central Admin (Contract Owner)</span>
                          </div>
                        ) : profile.walletAddress ? (
                          <div className="space-y-1">
                            <p className="font-mono text-xs text-gray-800 font-bold">
                              {profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}
                            </p>
                            {authStatusMap[profile.walletAddress.toLowerCase()] ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                On-Chain Authorized
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Pending Auth
                                </span>
                                <button
                                  type="button"
                                  disabled={authorizingWallet === profile.walletAddress}
                                  onClick={() => handleAuthorizeWallet(profile.walletAddress!)}
                                  className="px-2 py-0.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-[10px] font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                >
                                  <Key className="w-2.5 h-2.5" />
                                  {authorizingWallet === profile.walletAddress ? 'Authorizing...' : 'Authorize'}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No wallet linked</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {profile.role === 'receiver' && (
                          <button
                            type="button"
                            disabled={!hasChanged || savingUserId === profile.id}
                            onClick={() => handleSaveAssignment(profile)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
                              hasChanged
                                ? 'bg-[#2500ba] text-white hover:bg-[#1f009e] ring-2 ring-indigo-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            }`}
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingUserId === profile.id ? 'Saving...' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Signups Awaiting Verification Area (Bottom of Page) */}
      <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Signups Awaiting Verification</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  {pendingProfiles.length} Pending
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                New accounts created by Admins, Receivers, or LGU Receivers. Hover over any email chip to inspect credentials and verify access.
              </p>
            </div>
          </div>
        </div>

        {pendingProfiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400 bg-gray-50/50">
            No registrations currently awaiting verification. All registered accounts are up to date.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 pt-1">
            {pendingProfiles.map((user) => (
              <div key={user.id} className="relative group">
                {/* Email Chip */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-amber-300 shadow-xs hover:border-amber-500 hover:shadow-md transition cursor-pointer select-none">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-mono font-bold text-gray-800">{user.email}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    user.role === 'dswd_admin'
                      ? 'bg-blue-100 text-blue-800'
                      : user.lguName
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {user.role === 'dswd_admin' ? 'Admin' : (user.lguName ? 'LGU Receiver' : 'Receiver')}
                  </span>
                </div>

                {/* Hover Details Popover Card */}
                <div className="absolute bottom-full left-0 mb-2 w-80 p-4 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 space-y-3">
                  {/* Popover Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                    <div>
                      <p className="text-xs font-black text-gray-900">{user.fullName || 'No Name'}</p>
                      <p className="text-[11px] font-mono text-gray-500">{user.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${
                      user.role === 'dswd_admin'
                        ? 'bg-blue-100 text-blue-800'
                        : user.lguName
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {user.role === 'dswd_admin' ? 'DSWD Admin' : (user.lguName ? 'LGU Receiver' : 'Receiver')}
                    </span>
                  </div>

                  {/* Popover Metadata */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="font-semibold text-gray-500">Designation:</span>
                      <span className="font-bold text-gray-800">
                        {user.role === 'dswd_admin'
                          ? 'Central Admin'
                          : user.lguName
                          ? `${extractCleanMunicipality(user.lguName)} LGU`
                          : user.truckId || 'Field Delivery Receiver'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600">
                      <span className="font-semibold text-gray-500">MetaMask Wallet:</span>
                      <span className="font-mono text-gray-800 font-bold">
                        {user.walletAddress
                          ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                          : 'None (Unlinked)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600">
                      <span className="font-semibold text-gray-500">Registered:</span>
                      <span className="text-[11px] text-gray-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {/* Popover Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={verifyingUserId === user.id}
                      onClick={() => handleVerifyUser(user)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verify Account
                    </button>

                    <button
                      type="button"
                      disabled={verifyingUserId === user.id}
                      onClick={() => handleDeclineUser(user)}
                      className="py-1.5 px-3 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
