'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { authApi, type UserProfile } from '../../services/authApi';
import { blockchain } from '../../services/blockchain';
import { PANAY_LGUS } from '../../data/panayLguDirectory';
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

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const matchedLgu = useMemo(() => {
    if (!value) return null;
    return (
      PANAY_LGUS.find(
        (l) => l.municipality.toLowerCase() === value.toLowerCase()
      ) ?? null
    );
  }, [value]);

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

  if (value && !isEditing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-bold shadow-xs">
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
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition border border-gray-200 shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : (value || '')}
          disabled={disabled}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          placeholder={value ? `Current: ${value}` : 'Search Panay municipality...'}
          className="w-full pl-8 pr-8 py-1.5 text-xs font-medium rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs transition"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsEditing(false);
              setIsOpen(false);
            }}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition"
            title="Clear municipality"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 py-1 text-xs">
          <div className="px-3 py-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span>Panay Island Municipalities</span>
            <span>{filteredLgus.length} found</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              setIsEditing(false);
              setQuery('');
            }}
            className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-purple-700 font-semibold border-b border-gray-100 transition ${
              !value ? 'bg-purple-50/60 font-bold' : ''
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Field Receiver / Driver Mode (No LGU)
            </span>
            {!value && <Check className="w-3.5 h-3.5 text-purple-600" />}
          </button>

          {filteredLgus.map((lgu) => {
            const isSelected = value.toLowerCase() === lgu.municipality.toLowerCase();
            return (
              <button
                key={`${lgu.province}-${lgu.municipality}`}
                type="button"
                onClick={() => {
                  onChange(lgu.municipality);
                  setIsOpen(false);
                  setIsEditing(false);
                  setQuery('');
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-indigo-50/70 flex items-center justify-between transition ${
                  isSelected ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span>{lgu.municipality}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-medium px-1.5 py-0.5 rounded bg-gray-100">
                    {lgu.province}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
              </button>
            );
          })}
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
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'dswd_admin' | 'receiver'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Selected profile for full inspection modal
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [isWalletRevealed, setIsWalletRevealed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 5-dot Comfy Loading Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');

  // Blockchain Operator Authorization states
  const [authStatusMap, setAuthStatusMap] = useState<Record<string, boolean>>({});
  const [authorizingWallet, setAuthorizingWallet] = useState<string | null>(null);
  const [blockchainNotice, setBlockchainNotice] = useState<{ type: 'success' | 'error'; message: string; txHash?: string } | null>(null);
  const [customWalletInput, setCustomWalletInput] = useState('');
  const [isAuthorizingCustom, setIsAuthorizingCustom] = useState(false);
  const [isSepoliaStripOpen, setIsSepoliaStripOpen] = useState(false);

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
      const map: Record<string, string> = {};
      data.forEach((p) => {
        map[p.id] = extractCleanMunicipality(p.lguName);
      });
      setAssignments(map);
      void checkBlockchainAuth(data);

      // Keep selectedProfile in sync if open
      if (selectedProfile) {
        const updated = data.find((p) => p.id === selectedProfile.id);
        if (updated) setSelectedProfile(updated);
      }
    } catch (err) {
      console.warn('Failed to load profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    const unsub = authApi.subscribeProfiles(() => {
      loadProfiles();
    });
    return unsub;
  }, []);

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
        : 'Reverting account to Field Delivery Receiver mode...'
    );
    setIsModalOpen(true);

    try {
      await authApi.assignProfileLgu(profile.id, targetMunicipality);

      setTimeout(() => {
        setIsModalOpen(false);
        setSavingUserId(null);
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === profile.id ? { ...p, lguName: targetMunicipality } : p
          )
        );
        if (selectedProfile && selectedProfile.id === profile.id) {
          setSelectedProfile((prev) => prev ? { ...prev, lguName: targetMunicipality } : null);
        }
        setToastMessage({
          type: 'success',
          text: targetMunicipality
            ? `Successfully assigned ${profile.fullName || profile.email} as official LGU receiver for ${targetMunicipality}!`
            : `Set ${profile.fullName || profile.email} to Field Receiver mode.`
        });
      }, 1200);
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

  const handleVerifyUser = async (user: UserProfile) => {
    setModalTitle('Activating Account');
    setModalSubtitle(`Verifying ${user.fullName || user.email} for DSWD system access...`);
    setIsModalOpen(true);
    try {
      await authApi.verifyProfile(user.id);
      setToastMessage({
        type: 'success',
        text: `Account for ${user.fullName || user.email} has been approved and activated!`
      });
      await loadProfiles();
      if (selectedProfile && selectedProfile.id === user.id) {
        setSelectedProfile((prev) => prev ? { ...prev, status: 'verified' } : null);
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to verify account.'
      });
    } finally {
      setIsModalOpen(false);
    }
  };

  const handleDeclineUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to decline registration for ${user.fullName || user.email}?`)) return;
    try {
      await authApi.rejectProfile(user.id);
      setToastMessage({
        type: 'success',
        text: `Registration for ${user.fullName || user.email} has been declined.`
      });
      await loadProfiles();
      if (selectedProfile && selectedProfile.id === user.id) {
        setSelectedProfile((prev) => prev ? { ...prev, status: 'rejected' } : null);
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to decline registration.'
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const verifiedProfiles = profiles.filter((p) => p.status === 'verified');
    const total = profiles.length;
    const pending = profiles.filter((p) => p.status === 'pending').length;
    const admins = verifiedProfiles.filter((p) => p.role === 'dswd_admin').length;
    const lguReceivers = verifiedProfiles.filter(
      (p) => p.role === 'receiver' && extractCleanMunicipality(p.lguName)
    ).length;
    const drivers = verifiedProfiles.filter(
      (p) => p.role === 'receiver' && !extractCleanMunicipality(p.lguName)
    ).length;
    return { total, pending, admins, lguReceivers, drivers };
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const cleanLgu = extractCleanMunicipality(p.lguName);
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        p.email.toLowerCase().includes(query) ||
        p.fullName.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        (p.jobPosition && p.jobPosition.toLowerCase().includes(query)) ||
        (p.phoneNumber && p.phoneNumber.toLowerCase().includes(query)) ||
        (p.truckId && p.truckId.toLowerCase().includes(query)) ||
        (cleanLgu && cleanLgu.toLowerCase().includes(query));

      const matchRole =
        roleFilter === 'all' ? true : p.role === roleFilter;

      const matchStatus =
        statusFilter === 'all' ? true : p.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [profiles, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 5-Dot Loading Modal for Comfy Feedback */}
      <FiveDotsLoadingModal
        isOpen={isModalOpen}
        title={modalTitle}
        subtitle={modalSubtitle}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-[#10069f]" />
            Personnel Directory & Access Management
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Review personnel registrations, verify work credentials, and assign logistics roles across Panay Island.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsSepoliaStripOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-emerald-600" />
            <span>Smart Contract Auth</span>
          </button>

          <button
            type="button"
            onClick={loadProfiles}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-150 ${
            toastMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{stats.total}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Accounts</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-900">{stats.admins}</p>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">DSWD Admins</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-indigo-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-indigo-900">{stats.lguReceivers}</p>
            <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">LGU Receivers</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-purple-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-purple-900">{stats.drivers}</p>
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Relief Drivers</p>
          </div>
        </div>

        <div className={`rounded-2xl p-4 border shadow-2xs flex items-center gap-3 transition-colors ${
          stats.pending > 0
            ? 'bg-amber-50/90 border-amber-300 text-amber-900'
            : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            stats.pending > 0 ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-gray-100 text-gray-500'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black">{stats.pending}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Pending Review</p>
          </div>
        </div>
      </div>

      {/* Collapsible Sepolia Blockchain Authorization Strip */}
      {isSepoliaStripOpen && (
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-sm space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs flex items-center gap-2 text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Sepolia Smart Contract Operator Authorization
            </h4>
            <button
              type="button"
              onClick={() => setIsSepoliaStripOpen(false)}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-blue-200/80">
            Authorize receiver and driver wallets to sign physical cargo handovers and update custody tokens on Ethereum Sepolia.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="0x Wallet Address"
              value={customWalletInput}
              onChange={(e) => setCustomWalletInput(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-white/10 border border-white/20 text-white placeholder-blue-300/40 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 flex-1 min-w-[240px]"
            />
            <button
              type="button"
              onClick={handleAuthorizeCustomWallet}
              disabled={isAuthorizingCustom || !customWalletInput.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              {isAuthorizingCustom ? 'Authorizing...' : 'Authorize on Sepolia'}
            </button>
          </div>
          {blockchainNotice && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
              blockchainNotice.type === 'success' ? 'bg-emerald-900/60 border border-emerald-500 text-emerald-200' : 'bg-red-900/60 border border-red-500 text-red-200'
            }`}>
              <span>{blockchainNotice.message}</span>
              {blockchainNotice.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${blockchainNotice.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-mono text-[10px] text-emerald-300 hover:text-white"
                >
                  View TX
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search personnel by name, email, employee ID, phone, or municipality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#10069f] focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filters */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Roles
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('dswd_admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'dswd_admin' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admins
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('receiver')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'receiver' ? 'bg-white text-blue-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receivers / Drivers
            </button>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'verified' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Verified
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({stats.pending})
            </button>
          </div>
        </div>
      </div>

      {/* Clean Uncluttered User Accounts Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-50/75 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Personnel Directory</h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
              {filteredProfiles.length}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">Click any row to inspect work credentials & manage account</p>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-xs text-gray-700">No matching personnel records found</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Personnel Identity & ID</th>
                  <th className="px-6 py-3">Designation & Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredProfiles.map((profile) => {
                  const isCurrentAdmin =
                    currentAdminEmail &&
                    profile.email.toLowerCase() === currentAdminEmail.toLowerCase();
                  const cleanLgu = extractCleanMunicipality(profile.lguName);
                  const isLgu = profile.role === 'receiver' && Boolean(cleanLgu.trim());
                  const isPending = profile.status === 'pending';

                  return (
                    <tr
                      key={profile.id}
                      onClick={() => {
                        setSelectedProfile(profile);
                        setIsWalletRevealed(false);
                      }}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    >
                      {/* 1. Name & ID */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              profile.role === 'dswd_admin'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isLgu
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {profile.fullName
                              ? profile.fullName.slice(0, 2).toUpperCase()
                              : profile.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 leading-tight flex items-center gap-1.5 truncate">
                              <span>{profile.fullName || 'DSWD Officer'}</span>
                              {isCurrentAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-gray-200 text-gray-700 text-[9px] font-black uppercase">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                              {profile.email}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[9.5px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                ID: {profile.id.slice(0, 8)}...
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(profile.id, profile.id);
                                }}
                                className="text-gray-400 hover:text-gray-700 transition"
                                title="Copy Full ID"
                              >
                                {copiedId === profile.id ? (
                                  <Check className="w-2.5 h-2.5 text-green-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Role & Designation */}
                      <td className="px-6 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              profile.role === 'dswd_admin'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isLgu
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {profile.role === 'dswd_admin' ? (
                              <>
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                DSWD Admin
                              </>
                            ) : isLgu ? (
                              <>
                                <Building2 className="w-3 h-3 text-indigo-600" />
                                LGU Receiver
                              </>
                            ) : (
                              <>
                                <Truck className="w-3 h-3 text-purple-600" />
                                Relief Driver
                              </>
                            )}
                          </span>
                          <p className="text-[11px] text-gray-600 font-medium">
                            {profile.jobPosition || (isLgu ? `${cleanLgu} Focal` : profile.truckId ? `Truck ${profile.truckId}` : 'Regional Staff')}
                          </p>
                        </div>
                      </td>

                      {/* 3. Verification Status (With Warning If Pending) */}
                      <td className="px-6 py-3.5">
                        {isPending ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-bold shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                            <span>Awaiting Verification</span>
                          </div>
                        ) : profile.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold border border-red-200">
                            <X className="w-3 h-3" />
                            Declined
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold border border-green-200">
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              Verified
                            </span>
                            {!profile.walletAddress && (
                              <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> No Wallet
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Action */}
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProfile(profile);
                            setIsWalletRevealed(false);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#10069f] text-[#10069f] hover:bg-blue-50 font-bold text-xs transition cursor-pointer shadow-2xs active:scale-95"
                        >
                          Review Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ====================================================================
          ACCOUNT DETAIL MODAL / DRAWER
          ==================================================================== */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${
                    selectedProfile.role === 'dswd_admin'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedProfile.lguName
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                      : 'bg-purple-100 text-purple-800 border border-purple-300'
                  }`}
                >
                  {selectedProfile.fullName
                    ? selectedProfile.fullName.slice(0, 2).toUpperCase()
                    : selectedProfile.email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">
                    {selectedProfile.fullName || 'DSWD Officer'}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedProfile.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User ID Section (Prominently displayed for all accounts including Admins) */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  {selectedProfile.role === 'dswd_admin' ? 'DSWD Administrator System ID' : 'Account System ID'}
                </p>
                <p className="font-mono text-xs font-bold text-gray-800 break-all select-all mt-0.5">
                  {selectedProfile.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(selectedProfile.id, 'modal-id')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-2xs flex-shrink-0 cursor-pointer"
              >
                {copiedId === 'modal-id' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>

            {/* Official Work ID Photo Viewer */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Official Work / Government ID Credentials
              </label>
              {selectedProfile.workIdUrl ? (
                <div className="p-3 rounded-2xl border border-gray-200 bg-slate-50 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative aspect-4/3 w-48 max-w-full rounded-xl overflow-hidden border border-gray-300 shadow-sm bg-black/5 flex-shrink-0">
                    <img
                      src={selectedProfile.workIdUrl}
                      alt="Work ID Document"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Work ID Photo Submitted</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Uploaded during registration for identity verification and administrative approval.
                    </p>
                    <a
                      href={selectedProfile.workIdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10069f] hover:underline pt-1"
                    >
                      Open Full Size <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 text-center text-xs text-gray-500">
                  <ShieldAlert className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  No Work ID photo was attached during registration.
                </div>
              )}
            </div>

            {/* Detailed Personnel Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Job Position / Designation</span>
                <span className="text-xs font-bold text-gray-800 mt-0.5 block">
                  {selectedProfile.jobPosition || 'Not specified'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Contact Phone Number</span>
                <span className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-gray-500" />
                  {selectedProfile.phoneNumber || 'Not provided'}
                </span>
              </div>
            </div>

            {/* MetaMask Wallet Address with Closed/Open Eye Toggle */}
            <div className="p-4 rounded-2xl border border-gray-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-700" />
                  Linked MetaMask Wallet ID
                </label>
                {selectedProfile.walletAddress && (
                  <button
                    type="button"
                    onClick={() => setIsWalletRevealed((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-gray-900 transition cursor-pointer"
                  >
                    {isWalletRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                        <span>Hide Address</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Reveal Address</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {selectedProfile.walletAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-gray-200">
                    <span className="font-mono text-xs font-bold text-gray-800 break-all select-all">
                      {isWalletRevealed
                        ? selectedProfile.walletAddress
                        : `${selectedProfile.walletAddress.slice(0, 6)}••••••••••••••••••••••••••••••••${selectedProfile.walletAddress.slice(-4)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedProfile.walletAddress!, 'modal-wallet')}
                      className="p-1 text-gray-400 hover:text-gray-700 transition cursor-pointer flex-shrink-0"
                      title="Copy Address"
                    >
                      {copiedId === 'modal-wallet' ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {authStatusMap[selectedProfile.walletAddress.toLowerCase()] ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Authorized on Sepolia Smart Contract
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Pending On-Chain Auth
                        </span>
                        <button
                          type="button"
                          disabled={authorizingWallet === selectedProfile.walletAddress}
                          onClick={() => handleAuthorizeWallet(selectedProfile.walletAddress!)}
                          className="px-2.5 py-1 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-[10px] font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <Key className="w-3 h-3" />
                          {authorizingWallet === selectedProfile.walletAddress ? 'Authorizing...' : 'Authorize Operator'}
                        </button>
                      </div>
                    )}

                    <a
                      href={`https://sepolia.etherscan.io/address/${selectedProfile.walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      Etherscan <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>No MetaMask wallet has been linked to this account yet. The user can link one in Profile Settings.</span>
                </div>
              )}
            </div>

            {/* LGU Municipality Assignment (for Receivers) */}
            {selectedProfile.role === 'receiver' && (
              <div className="space-y-2 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40">
                <label className="block text-xs font-bold text-indigo-950">
                  Assigned Panay LGU Municipality
                </label>
                <p className="text-[11px] text-indigo-700/80">
                  Assign this account as the designated LGU receiver for a Panay municipality, or revert to Field Delivery Driver mode.
                </p>

                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <MunicipalitySearchPicker
                    value={assignments[selectedProfile.id] ?? extractCleanMunicipality(selectedProfile.lguName)}
                    onChange={(muni) => handleLguChange(selectedProfile.id, muni)}
                    disabled={savingUserId === selectedProfile.id}
                  />

                  <button
                    type="button"
                    disabled={savingUserId === selectedProfile.id}
                    onClick={() => handleSaveAssignment(selectedProfile)}
                    className="px-4 py-2 rounded-xl bg-[#2500ba] text-white hover:bg-blue-800 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingUserId === selectedProfile.id ? 'Saving...' : 'Save Assignment'}
                  </button>
                </div>
              </div>
            )}

            {/* Verification / Approval Actions */}
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                <span>Status: </span>
                <span className="font-bold text-gray-800 capitalize">{selectedProfile.status}</span>
              </div>

              <div className="flex items-center gap-2">
                {selectedProfile.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerifyUser(selectedProfile)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Activate Account
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineUser(selectedProfile)}
                      className="px-4 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedProfile(null)}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold transition cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
