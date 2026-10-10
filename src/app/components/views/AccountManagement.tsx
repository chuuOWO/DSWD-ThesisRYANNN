'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  History,
  Key,
  Layers,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  User,
  UserCheck,
  UserX,
  Users,
  X
} from 'lucide-react';
import { authApi, type UserProfile } from '../../services/authApi';
import { backendApi, type LguRecord, type ActivityLogRecord } from '../../services/backendApi';
import { blockchain } from '../../services/blockchain';
import { findMatchingLgu, normalizeLguName } from '../../lib/lguMatching';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import type { OutgoingRelease } from '../../hooks/useInventoryState';

/**
 * Resolves all releases currently in active custody/transit with a given receiver.
 */
export function getActiveCustodyPackages(profile: UserProfile, allReleases: OutgoingRelease[]): OutgoingRelease[] {
  const receiverKeys = [
    profile.truckId?.trim().toLowerCase(),
    profile.fullName?.trim().replace(/\s+/g, '-').toLowerCase(),
    profile.email?.split('@')[0].toLowerCase(),
    profile.id.toLowerCase()
  ].filter(Boolean) as string[];

  return allReleases.filter((r) => {
    const assignedTruck = (r.assignedTruckId || r.assigned_truck_id || '').trim().toLowerCase();
    const isAssigned = receiverKeys.includes(assignedTruck);
    const isActive = ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered'].includes(r.deliveryStatus);
    return isAssigned && isActive;
  });
}

/**
 * Resolves any pending incoming releases in transit to a given municipality.
 */
export function getPendingIncomingToLgu(lguMunicipality: string, allReleases: OutgoingRelease[]): OutgoingRelease[] {
  if (!lguMunicipality) return [];
  const cleanMuni = extractCleanMunicipality(lguMunicipality).toLowerCase();
  return allReleases.filter((r) => {
    const relMuni = (r.municipality || r.lguName || r.destinationAddress || '').toLowerCase();
    const matches = relMuni.includes(cleanMuni);
    const isInTransit = ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered'].includes(r.deliveryStatus);
    return matches && isInTransit;
  });
}

/**
 * Extracts strictly the municipality name from any raw string,
 * cleaning away facility descriptions (e.g. "Leon (Leon Municipal Office)" -> "Leon").
 */
export function extractCleanMunicipality(rawName?: string | null, lgus: LguRecord[] = []): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  // 1. Authoritative lookup from database LGU records if supplied
  if (lgus && lgus.length > 0) {
    const match = findMatchingLgu(lgus, trimmed);
    if (match) return match.municipality;
  }

  // 2. Strip common administrative noise prefixes and facility suffixes
  const cleaned = trimmed
    .split('(')[0]
    .replace(/^lgu\s+of\s+/i, '')
    .replace(/^municipality\s+of\s+/i, '')
    .replace(/^city\s+of\s+/i, '')
    .replace(/^lgu\s+/i, '')
    .replace(/\s+(municipal\s+hall|city\s+hall|drrm\s+office|drrmo|mdrrmo|cdrrmo|pdrrmo|evacuation\s+center|evacuation\s+gym|civic\s+center|terminal|gym|warehouse|office).*$/i, '')
    .trim();

  return cleaned || trimmed;
}

interface MunicipalitySearchPickerProps {
  value: string;
  onChange: (municipality: string) => void;
  disabled?: boolean;
  lgus?: LguRecord[];
}

function MunicipalitySearchPicker({
  value,
  onChange,
  disabled = false,
  lgus = []
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
    return findMatchingLgu(lgus, value) ?? null;
  }, [value, lgus]);

  const filteredLgus = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...lgus].sort((a, b) => (a.municipality || '').localeCompare(b.municipality || ''));
    }
    return lgus.filter(
      (l) =>
        (l.municipality || '').toLowerCase().includes(q) ||
        (l.province || '').toLowerCase().includes(q) ||
        (l.lguName || '').toLowerCase().includes(q)
    ).sort((a, b) => {
      const aStarts = (a.municipality || '').toLowerCase().startsWith(q);
      const bStarts = (b.municipality || '').toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return (a.municipality || '').localeCompare(b.municipality || '');
    });
  }, [query, lgus]);

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
              Field Receiver Mode (No LGU)
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
  releases?: OutgoingRelease[];
  lgusList?: LguRecord[];
}

export function AccountManagement({ currentAdminEmail, releases: propsReleases, lgusList }: AccountManagementProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbReleases, setDbReleases] = useState<OutgoingRelease[]>([]);

  // Authoritative LGU list from Supabase
  const [dbLgus, setDbLgus] = useState<LguRecord[]>(lgusList || []);

  useEffect(() => {
    if (lgusList && lgusList.length > 0) {
      setDbLgus(lgusList);
      return;
    }
    let isMounted = true;
    backendApi.getLgus().then((data) => {
      if (isMounted && data && data.length > 0) {
        setDbLgus(data);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [lgusList]);

  useEffect(() => {
    if (!propsReleases || propsReleases.length === 0) {
      backendApi.getReceiverReleases().then((rows) => {
        setDbReleases(rows.map(r => ({
          drNumber: r.dr_number,
          dateAllocated: r.date_allocated || r.created_at || '',
          lguName: r.lgu_name || '',
          province: r.province || '',
          municipality: r.municipality || '',
          fnfiCategory: r.category || '',
          amountRequested: Number(r.amount_requested || 0),
          amountApproved: Number(r.amount_approved || 0),
          warehouseSource: r.warehouse_source || '',
          deliveryMode: r.delivery_mode || 'Truck',
          deliveryStatus: (r.delivery_status || 'Allocating') as any,
          incidentCode: '',
          allocatedBatches: [],
          assignedTruckId: r.assigned_truck_id,
          assigned_truck_id: r.assigned_truck_id,
          auditTrail: []
        })));
      }).catch(() => {});
    }
  }, [propsReleases]);

  const effectiveReleases = (propsReleases && propsReleases.length > 0) ? propsReleases : dbReleases;
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'dswd_admin' | 'receiver'>('all');
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'verified' | 'pending'>('verified');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Top-level Navigation Switcher: 'directory' | 'logs' | 'user_trails'
  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'logs' | 'user_trails'>('directory');

  // Activity Logs audit trail states
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logEntityFilter, setLogEntityFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLogRecord | null>(null);
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const logsPageSize = 10;

  // Individual User Activity Trail states
  const [selectedUserForTrail, setSelectedUserForTrail] = useState<UserProfile | null>(null);
  const [userTrailLogs, setUserTrailLogs] = useState<ActivityLogRecord[]>([]);
  const [isLoadingUserTrail, setIsLoadingUserTrail] = useState(false);
  const [userTrailSearchQuery, setUserTrailSearchQuery] = useState('');
  const [userTrailActionFilter, setUserTrailActionFilter] = useState('all');
  const [userTrailPage, setUserTrailPage] = useState(1);
  const userTrailPageSize = 10;
  const [userSelectorSearch, setUserSelectorSearch] = useState('');

  // Selected profile for full inspection modal
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [isWalletRevealed, setIsWalletRevealed] = useState(false);
  const [isWorkIdRevealed, setIsWorkIdRevealed] = useState(false);
  const [isIdRevealed, setIsIdRevealed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirmation Modals for Decline and Delete
  const [confirmDeclineUser, setConfirmDeclineUser] = useState<UserProfile | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // 5-dot Comfy Loading Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');

  const loadActivityLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await backendApi.getActivityLogs({ limit: 200 });
      setActivityLogs(logs);
    } catch (err) {
      console.warn('Failed to load activity logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadUserTrail = async (user: UserProfile) => {
    setIsLoadingUserTrail(true);
    try {
      const logs = await backendApi.getUserActivityLogs(user.id, user.email, 200);
      setUserTrailLogs(logs);
    } catch (err) {
      console.warn('Failed to load user trail logs:', err);
    } finally {
      setIsLoadingUserTrail(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'logs') {
      loadActivityLogs();
    }
    if (activeMainTab === 'user_trails') {
      if (!selectedUserForTrail && profiles.length > 0) {
        setSelectedUserForTrail(profiles[0]);
        loadUserTrail(profiles[0]);
      } else if (selectedUserForTrail) {
        loadUserTrail(selectedUserForTrail);
      }
    }
  }, [activeMainTab, selectedUserForTrail?.id, profiles.length]);

  useEffect(() => {
    const unsub = backendApi.subscribeDashboard(() => {
      if (activeMainTab === 'logs') {
        loadActivityLogs();
      }
      if (activeMainTab === 'user_trails' && selectedUserForTrail) {
        loadUserTrail(selectedUserForTrail);
      }
    });
    return unsub;
  }, [activeMainTab, selectedUserForTrail?.id]);

  useEffect(() => {
    loadActivityLogs();
  }, []);

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

  const handleExecuteDecline = async () => {
    if (!confirmDeclineUser) return;
    setIsProcessingAction(true);
    try {
      await authApi.rejectProfile(confirmDeclineUser.id);
      await backendApi.logActivity({
        action: 'DECLINE_USER',
        entityType: 'User',
        entityId: confirmDeclineUser.id,
        details: `Declined and removed registration application for ${confirmDeclineUser.fullName || confirmDeclineUser.email}.`,
        metadata: {
          userId: confirmDeclineUser.id,
          fullName: confirmDeclineUser.fullName,
          email: confirmDeclineUser.email,
          role: confirmDeclineUser.role
        }
      }).catch(() => {});
      setToastMessage({
        type: 'success',
        text: `Registration for ${confirmDeclineUser.fullName || confirmDeclineUser.email} has been declined and removed.`
      });
      await loadProfiles();
      if (selectedProfile && selectedProfile.id === confirmDeclineUser.id) {
        setSelectedProfile(null);
      }
      setConfirmDeclineUser(null);
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to decline registration.'
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRequestDelete = (user: UserProfile) => {
    const isCurrentAdmin = Boolean(
      currentAdminEmail &&
      user.email &&
      user.email.toLowerCase() === currentAdminEmail.toLowerCase()
    );
    if (isCurrentAdmin) {
      setToastMessage({
        type: 'error',
        text: 'Action Denied: You cannot delete your own active administrator account.'
      });
      return;
    }

    const activePackages = getActiveCustodyPackages(user, effectiveReleases);
    if (activePackages.length > 0) {
      setToastMessage({
        type: 'error',
        text: `Cannot delete account: ${user.fullName || user.email} currently has ${activePackages.length} package(s) in active transit/custody (${activePackages.map(p => `#${p.drNumber}`).join(', ')}). Complete or transfer deliveries first.`
      });
      return;
    }

    setConfirmDeleteUser(user);
  };

  const handleExecuteDelete = async () => {
    if (!confirmDeleteUser) return;
    setIsProcessingAction(true);
    try {
      if (confirmDeleteUser.truckId) {
        await backendApi.deleteTruckLiveLocation(confirmDeleteUser.truckId).catch(() => {});
      }
      await authApi.deleteProfile(confirmDeleteUser.id);
      await backendApi.logActivity({
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: confirmDeleteUser.id,
        details: `Permanently deleted account ${confirmDeleteUser.fullName || confirmDeleteUser.email} (${confirmDeleteUser.role}).`,
        metadata: {
          userId: confirmDeleteUser.id,
          fullName: confirmDeleteUser.fullName,
          email: confirmDeleteUser.email,
          role: confirmDeleteUser.role
        }
      }).catch(() => {});
      setToastMessage({
        type: 'success',
        text: `Account for ${confirmDeleteUser.fullName || confirmDeleteUser.email} has been deleted permanently.`
      });
      await loadProfiles();
      if (selectedProfile && selectedProfile.id === confirmDeleteUser.id) {
        setSelectedProfile(null);
      }
      setConfirmDeleteUser(null);
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to delete account.'
      });
    } finally {
      setIsProcessingAction(false);
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

    // 1. Guard against assigning LGU to a receiver holding packages
    const activePackages = getActiveCustodyPackages(profile, effectiveReleases);
    if (activePackages.length > 0) {
      setToastMessage({
        type: 'error',
        text: `Locked: ${profile.fullName || profile.email} currently has ${activePackages.length} package(s) in active transit/custody (${activePackages.map(p => `#${p.drNumber}`).join(', ')}). Complete or transfer deliveries before altering designation.`
      });
      return;
    }

    // 2. Guard against reverting/changing an LGU receiver if incoming shipments are on the road
    const currentCleanLgu = extractCleanMunicipality(profile.lguName);
    if (currentCleanLgu && currentCleanLgu !== targetMunicipality) {
      const pendingIncoming = getPendingIncomingToLgu(currentCleanLgu, effectiveReleases);
      if (pendingIncoming.length > 0) {
        setToastMessage({
          type: 'error',
          text: `Locked: ${currentCleanLgu} currently has ${pendingIncoming.length} shipment(s) in transit (${pendingIncoming.map(p => `#${p.drNumber}`).join(', ')}). Wait until packages are received before reassigning this LGU receiver.`
        });
        return;
      }
    }

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
      await backendApi.logActivity({
        action: targetMunicipality ? 'ASSIGN_LGU' : 'REVERT_RECEIVER',
        entityType: 'User',
        entityId: profile.id,
        details: targetMunicipality
          ? `Designated ${profile.fullName || profile.email} as official LGU receiver for ${targetMunicipality}.`
          : `Reverted ${profile.fullName || profile.email} to Field Receiver mode.`,
        metadata: {
          userId: profile.id,
          targetMunicipality,
          previousMunicipality: profile.lguName
        }
      }).catch(() => {});

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
      await backendApi.logActivity({
        action: 'VERIFY_USER',
        entityType: 'User',
        entityId: user.id,
        details: `Approved and verified account for ${user.fullName || user.email} (${user.role === 'dswd_admin' ? 'DSWD Admin' : 'Receiver'}).`,
        metadata: {
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          lguName: user.lguName,
          truckId: user.truckId
        }
      }).catch(() => {});
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const verifiedProfiles = profiles.filter((p) => p.status === 'verified');
    const total = profiles.length;
    const pending = profiles.filter((p) => p.status === 'pending').length;
    const verified = verifiedProfiles.length;
    const admins = verifiedProfiles.filter((p) => p.role === 'dswd_admin').length;
    const lguReceivers = verifiedProfiles.filter(
      (p) => p.role === 'receiver' && extractCleanMunicipality(p.lguName)
    ).length;
    const fieldReceivers = verifiedProfiles.filter(
      (p) => p.role === 'receiver' && !extractCleanMunicipality(p.lguName)
    ).length;
    return { total, pending, verified, admins, lguReceivers, fieldReceivers };
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const cleanLgu = extractCleanMunicipality(p.lguName);
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        (p.email || '').toLowerCase().includes(query) ||
        (p.fullName || '').toLowerCase().includes(query) ||
        (p.id || '').toLowerCase().includes(query) ||
        (p.jobPosition && p.jobPosition.toLowerCase().includes(query)) ||
        (p.phoneNumber && p.phoneNumber.toLowerCase().includes(query)) ||
        (p.truckId && p.truckId.toLowerCase().includes(query)) ||
        (cleanLgu && cleanLgu.toLowerCase().includes(query));

      const matchRole =
        roleFilter === 'all' ? true : p.role === roleFilter;

      const matchStatus =
        activeDirectoryTab === 'verified' ? p.status === 'verified' : p.status === 'pending';

      return matchSearch && matchRole && matchStatus;
    });
  }, [profiles, searchQuery, roleFilter, activeDirectoryTab]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProfiles.slice(start, start + pageSize);
  }, [filteredProfiles, currentPage, pageSize]);

  const logStats = useMemo(() => {
    const total = activityLogs.length;
    const onChainCount = activityLogs.filter((l) => Boolean(l.txHash)).length;
    const mintCount = activityLogs.filter((l) => l.action === 'MINT_BATCH_TOKEN').length;
    const masterDataCount = activityLogs.filter((l) => l.action.includes('ARCHIVE') || l.action.includes('RESTORE')).length;
    const userAdminCount = activityLogs.filter((l) =>
      ['VERIFY_USER', 'DECLINE_USER', 'DELETE_USER', 'ASSIGN_LGU', 'REVERT_RECEIVER'].includes(l.action)
    ).length;
    return { total, onChainCount, mintCount, masterDataCount, userAdminCount };
  }, [activityLogs]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const q = logSearchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        log.actorName.toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        (log.entityId && log.entityId.toLowerCase().includes(q)) ||
        log.details.toLowerCase().includes(q) ||
        (log.txHash && log.txHash.toLowerCase().includes(q)) ||
        (log.actorWallet && log.actorWallet.toLowerCase().includes(q));

      const matchAction =
        logActionFilter === 'all'
          ? true
          : logActionFilter === 'onchain'
          ? Boolean(log.txHash)
          : log.action === logActionFilter;

      const matchEntity =
        logEntityFilter === 'all'
          ? true
          : log.entityType.toLowerCase() === logEntityFilter.toLowerCase();

      return matchSearch && matchAction && matchEntity;
    });
  }, [activityLogs, logSearchQuery, logActionFilter, logEntityFilter]);

  const totalLogsPages = Math.max(1, Math.ceil(filteredLogs.length / logsPageSize));
  const paginatedLogs = useMemo(() => {
    const start = (logsCurrentPage - 1) * logsPageSize;
    return filteredLogs.slice(start, start + logsPageSize);
  }, [filteredLogs, logsCurrentPage, logsPageSize]);

  const userActionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activityLogs.forEach((log) => {
      if (log.actorId) {
        counts[log.actorId] = (counts[log.actorId] || 0) + 1;
      }
      if (log.entityType === 'User' && log.entityId && log.entityId !== log.actorId) {
        counts[log.entityId] = (counts[log.entityId] || 0) + 1;
      }
    });
    return counts;
  }, [activityLogs]);

  const filteredUserTrailLogs = useMemo(() => {
    return userTrailLogs.filter((log) => {
      const query = userTrailSearchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        log.action.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.entityType.toLowerCase().includes(query) ||
        (log.txHash && log.txHash.toLowerCase().includes(query)) ||
        (log.actorName && log.actorName.toLowerCase().includes(query));

      const matchAction =
        userTrailActionFilter === 'all'
          ? true
          : userTrailActionFilter === 'onchain'
          ? Boolean(log.txHash)
          : log.action === userTrailActionFilter;

      return matchSearch && matchAction;
    });
  }, [userTrailLogs, userTrailSearchQuery, userTrailActionFilter]);

  const totalUserTrailPages = Math.max(1, Math.ceil(filteredUserTrailLogs.length / userTrailPageSize));
  const paginatedUserTrailLogs = useMemo(() => {
    const start = (userTrailPage - 1) * userTrailPageSize;
    return filteredUserTrailLogs.slice(start, start + userTrailPageSize);
  }, [filteredUserTrailLogs, userTrailPage, userTrailPageSize]);

  const userTrailStats = useMemo(() => {
    let onChain = 0;
    let logins = 0;
    let operational = 0;
    let profileUpdates = 0;

    userTrailLogs.forEach((l) => {
      if (l.txHash) onChain++;
      if (l.action === 'USER_LOGIN') logins++;
      if (['UPDATE_PROFILE', 'UPDATE_AVATAR', 'PROVISION_SMART_ACCOUNT', 'ASSIGN_LGU', 'VERIFY_USER'].includes(l.action)) profileUpdates++;
      if (['MINT_BATCH_TOKEN', 'APPROVE_RELEASE', 'RELEASE_APPROVED', 'SIGN_RELEASE', 'CONFIRM_RECEIPT', 'STOCK_RECOUNT', 'EMERGENCY_STOCK_CORRECTION', 'INCOMING_ADDED', 'INCOMING_SUBMITTED', 'INCOMING_VERIFIED', 'INCOMING_EDITED', 'RELEASE_CREATED', 'RELEASE_DISPATCHED', 'RELEASE_EDITED', 'CORRECTION_REQUESTED', 'LGU_REPORT_SUBMITTED', 'EXPORT_INVENTORY_REPORT'].includes(l.action)) operational++;
    });

    return {
      total: userTrailLogs.length,
      onChain,
      logins,
      operational,
      profileUpdates
    };
  }, [userTrailLogs]);

  const filteredSelectorProfiles = useMemo(() => {
    const q = userSelectorSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      (p.fullName && p.fullName.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.role && p.role.toLowerCase().includes(q)) ||
      (p.lguName && p.lguName.toLowerCase().includes(q)) ||
      (p.walletAddress && p.walletAddress.toLowerCase().includes(q))
    );
  }, [profiles, userSelectorSearch]);

  const formatLogTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'MINT_BATCH_TOKEN':
        return { label: 'Token Minted', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'APPROVE_RELEASE':
      case 'RELEASE_APPROVED':
        return { label: 'Release Approved', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'SIGN_RELEASE':
        return { label: 'Handover Signed', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'CONFIRM_RECEIPT':
        return { label: 'Receipt Confirmed', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'INCOMING_ADDED':
        return { label: 'Manifest Created', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'INCOMING_SUBMITTED':
        return { label: 'Manifest Submitted', bg: 'bg-sky-50 text-sky-800 border-sky-200' };
      case 'INCOMING_VERIFIED':
        return { label: 'Manifest Verified', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'INCOMING_EDITED':
        return { label: 'Manifest Edited', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
      case 'RELEASE_CREATED':
        return { label: 'Release Drafted', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'RELEASE_DISPATCHED':
        return { label: 'Cargo In-Transit', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'RELEASE_EDITED':
        return { label: 'Release Edited', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
      case 'CORRECTION_REQUESTED':
        return { label: 'Correction Requested', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'LGU_REPORT_SUBMITTED':
        return { label: 'LGU Report Submitted', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
      case 'STOCK_ADDED':
        return { label: 'Stock Added', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'STOCK_DEDUCTED':
        return { label: 'Stock Deducted', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
      case 'LGU_CREATED':
        return { label: 'LGU Registered', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'LGU_UPDATED':
        return { label: 'LGU Updated', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'PROVINCE_CREATED':
        return { label: 'Province Added', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'WAREHOUSE_CREATED':
        return { label: 'Warehouse Added', bg: 'bg-sky-50 text-sky-800 border-sky-200' };
      case 'KIT_TYPE_CREATED':
        return { label: 'Kit Type Added', bg: 'bg-violet-50 text-violet-800 border-violet-200' };
      case 'KIT_TYPE_UPDATED':
        return { label: 'Kit Type Updated', bg: 'bg-violet-50 text-violet-800 border-violet-200' };
      case 'KIT_TYPE_DELETED':
        return { label: 'Kit Type Removed', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'SUPPLY_SOURCE_CREATED':
        return { label: 'Source Hub Added', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'SUPPLY_SOURCE_DELETED':
        return { label: 'Source Hub Removed', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'EXPORT_INVENTORY_REPORT':
        return { label: 'Inventory Exported', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'VERIFY_USER':
        return { label: 'User Verified', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'DECLINE_USER':
        return { label: 'Registration Declined', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'DELETE_USER':
        return { label: 'Account Deleted', bg: 'bg-red-50 text-red-800 border-red-200' };
      case 'ASSIGN_LGU':
        return { label: 'LGU Designated', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'REVERT_RECEIVER':
        return { label: 'Field Mode Set', bg: 'bg-gray-100 text-gray-800 border-gray-300' };
      case 'ARCHIVE_LGU':
        return { label: 'LGU Archived', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'RESTORE_LGU':
        return { label: 'LGU Restored', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
      case 'ARCHIVE_PROVINCE':
        return { label: 'Province Archived', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'RESTORE_PROVINCE':
        return { label: 'Province Restored', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
      case 'STOCK_RECOUNT':
      case 'EMERGENCY_STOCK_CORRECTION':
        return { label: 'Stock Recounted', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
      case 'USER_LOGIN':
        return { label: 'Session Login', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'USER_LOGOUT':
        return { label: 'Session Logout', bg: 'bg-slate-100 text-slate-700 border-slate-300' };
      case 'USER_SIGNUP':
        return { label: 'Account Registered', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'UPDATE_PROFILE':
        return { label: 'Profile Updated', bg: 'bg-violet-50 text-violet-800 border-violet-200' };
      case 'UPDATE_AVATAR':
        return { label: 'Avatar Changed', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'PROVISION_SMART_ACCOUNT':
        return { label: 'Smart Account Linked', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      default:
        return { label: action.replace(/_/g, ' '), bg: 'bg-gray-50 text-gray-800 border-gray-200' };
    }
  };

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
            {activeMainTab === 'directory' ? (
              <>
                <UserCheck className="w-7 h-7 text-[#10069f]" />
                Personnel Directory & Access Management
              </>
            ) : activeMainTab === 'logs' ? (
              <>
                <Activity className="w-7 h-7 text-[#10069f]" />
                System Activity Logs & Blockchain Audit Trail
              </>
            ) : (
              <>
                <History className="w-7 h-7 text-[#10069f]" />
                User Activity Trails & Individual Account Audit
              </>
            )}
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            {activeMainTab === 'directory'
              ? 'Review personnel registrations, verify work credentials, and assign logistics roles across Panay Island.'
              : activeMainTab === 'logs'
              ? 'Tamper-evident audit trail capturing role assignments, token mints, delivery handovers, and master data changes with on-chain Ethereum Sepolia verification.'
              : 'Granular chronological audit trail per account tracking user sign-ins, profile changes, dispatched goods, smart account bindings, and on-chain proofs.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={
              activeMainTab === 'directory'
                ? loadProfiles
                : activeMainTab === 'logs'
                ? loadActivityLogs
                : () => {
                    loadProfiles();
                    if (selectedUserForTrail) loadUserTrail(selectedUserForTrail);
                  }
            }
            disabled={
              activeMainTab === 'directory'
                ? isLoading
                : activeMainTab === 'logs'
                ? isLoadingLogs
                : isLoadingUserTrail
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                (activeMainTab === 'directory'
                  ? isLoading
                  : activeMainTab === 'logs'
                  ? isLoadingLogs
                  : isLoadingUserTrail)
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Primary Top-Level Navigation Switcher */}
      <div className="flex items-center gap-4 border-b-2 border-gray-200">
        <button
          type="button"
          onClick={() => setActiveMainTab('directory')}
          className={`pb-3 px-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
            activeMainTab === 'directory'
              ? 'border-[#10069f] text-[#10069f]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Personnel Directory</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeMainTab === 'directory' ? 'bg-[#10069f]/10 text-[#10069f]' : 'bg-gray-100 text-gray-600'
          }`}>
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainTab('logs');
            loadActivityLogs();
          }}
          className={`pb-3 px-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
            activeMainTab === 'logs'
              ? 'border-[#10069f] text-[#10069f]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Activity Logs</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeMainTab === 'logs' ? 'bg-[#10069f]/10 text-[#10069f]' : 'bg-gray-100 text-gray-600'
          }`}>
            {activityLogs.length > 0 ? activityLogs.length : 'Audit'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainTab('user_trails');
            if (!selectedUserForTrail && profiles.length > 0) {
              setSelectedUserForTrail(profiles[0]);
              loadUserTrail(profiles[0]);
            } else if (selectedUserForTrail) {
              loadUserTrail(selectedUserForTrail);
            }
          }}
          className={`pb-3 px-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
            activeMainTab === 'user_trails'
              ? 'border-[#10069f] text-[#10069f]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>User Activity Trails</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeMainTab === 'user_trails' ? 'bg-[#10069f]/10 text-[#10069f]' : 'bg-gray-100 text-gray-600'
          }`}>
            {selectedUserForTrail ? (userActionCounts[selectedUserForTrail.id] || userTrailLogs.length) : 'Per User'}
          </span>
        </button>
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

      {activeMainTab === 'directory' && (
        <>
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
            <p className="text-xl font-black text-purple-900">{stats.fieldReceivers}</p>
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Receivers</p>
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

      {/* Two Clear Primary Directory Tabs: Verified Personnel vs Pending Verifications */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveDirectoryTab('verified');
            setCurrentPage(1);
          }}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeDirectoryTab === 'verified'
              ? 'bg-[#10069f] text-white shadow-md shadow-blue-950/20'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verified Personnel</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeDirectoryTab === 'verified' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
          }`}>
            {stats.verified}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveDirectoryTab('pending');
            setCurrentPage(1);
          }}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeDirectoryTab === 'pending'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Verifications</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeDirectoryTab === 'pending' ? 'bg-white/25 text-white' : stats.pending > 0 ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-gray-100 text-gray-700'
          }`}>
            {stats.pending}
          </span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search personnel by name, email, employee ID, phone, or municipality..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#10069f] focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filters */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setRoleFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Roles
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('dswd_admin');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'dswd_admin' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admins
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('receiver');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'receiver' ? 'bg-white text-blue-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receivers
            </button>
          </div>
        </div>
      </div>

      {/* Clean Uncluttered User Accounts Table (5 Rows Viewable Per Frame) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-50/75 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">
              {activeDirectoryTab === 'verified' ? 'Verified Personnel' : 'Pending Registrations'}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
              {filteredProfiles.length}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">Click any row to inspect work credentials & manage account</p>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-xs text-gray-700">
              {activeDirectoryTab === 'verified' ? 'No verified personnel found' : 'No pending registrations awaiting review'}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div>
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Personnel Identity & Credentials</th>
                    <th className="px-6 py-3">Designation & Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {paginatedProfiles.map((profile) => {
                    const isCurrentAdmin =
                      Boolean(currentAdminEmail &&
                      profile.email &&
                      profile.email.toLowerCase() === currentAdminEmail.toLowerCase());
                    const cleanLgu = extractCleanMunicipality(profile.lguName);
                    const isLgu = profile.role === 'receiver' && Boolean(cleanLgu.trim());
                    const isPending = profile.status === 'pending';

                    return (
                      <tr
                        key={profile.id}
                        onClick={() => {
                          setSelectedProfile(profile);
                          setIsWalletRevealed(false);
                          setIsWorkIdRevealed(false);
                          setIsIdRevealed(false);
                        }}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        {/* 1. Name & Masked ID */}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
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
                                    Receiver
                                  </>
                                )}
                              </span>

                              {/* Active Custody Indicator */}
                              {profile.role === 'receiver' && (() => {
                                const activeCount = getActiveCustodyPackages(profile, effectiveReleases).length;
                                if (activeCount === 0) return null;
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="w-2.5 h-2.5 text-amber-700" />
                                    In Transit ({activeCount})
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-[11px] text-gray-600 font-medium">
                              {profile.jobPosition === 'Trucker' ? 'Receiver' : (profile.jobPosition || (isLgu ? `${cleanLgu} Focal` : profile.truckId ? `Code: ${profile.truckId}` : 'Regional Staff'))}
                            </p>
                          </div>
                        </td>

                        {/* 3. Verification Status */}
                        <td className="px-6 py-3.5">
                          {isPending ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-bold shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                              <span>Awaiting Review</span>
                            </div>
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

                        {/* 4. Action Buttons (Pending vs Approved) */}
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyUser(profile)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeclineUser(profile)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[11px] font-bold transition active:scale-95 cursor-pointer flex items-center gap-1"
                                >
                                  <UserX className="w-3 h-3" />
                                  Decline
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProfile(profile);
                                    setIsWalletRevealed(false);
                                    setIsWorkIdRevealed(false);
                                    setIsIdRevealed(false);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#10069f] text-[11px] font-bold transition active:scale-95 cursor-pointer"
                                >
                                  Inspect
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserForTrail(profile);
                                    loadUserTrail(profile);
                                    setUserTrailPage(1);
                                    setActiveMainTab('user_trails');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#10069f] text-[11px] font-bold transition active:scale-95 cursor-pointer flex items-center gap-1"
                                  title="View user activity trail"
                                >
                                  <History className="w-3 h-3" />
                                  Trail
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRequestDelete(profile)}
                                  disabled={isCurrentAdmin}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                  title={isCurrentAdmin ? 'Cannot delete your own account' : 'Delete Account'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 5-Item Pagination Controls */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600">
              <div>
                Showing{' '}
                <span className="font-bold text-gray-900">
                  {filteredProfiles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-bold text-gray-900">
                  {Math.min(currentPage * pageSize, filteredProfiles.length)}
                </span>{' '}
                of <span className="font-bold text-gray-900">{filteredProfiles.length}</span> {activeDirectoryTab === 'verified' ? 'personnel' : 'pending registrations'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <span className="font-bold text-gray-800 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )}

  {activeMainTab === 'logs' && (
    <div className="space-y-6">
      {/* Activity Logs Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{logStats.total}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Actions</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-900">{logStats.onChainCount}</p>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">On-Chain Verified</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-indigo-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-indigo-900">{logStats.mintCount}</p>
            <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Tokens Minted</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-amber-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-amber-900">{logStats.masterDataCount}</p>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Master Data Ops</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-purple-50/50 to-white">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-purple-900">{logStats.userAdminCount}</p>
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Security & RBAC</p>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search logs by actor, action, details, entity, or Sepolia tx hash..."
            value={logSearchQuery}
            onChange={(e) => {
              setLogSearchQuery(e.target.value);
              setLogsCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#10069f] focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action Category Filter */}
          <select
            value={logActionFilter}
            onChange={(e) => {
              setLogActionFilter(e.target.value);
              setLogsCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10069f] cursor-pointer"
          >
            <option value="all">All Actions</option>
            <option value="onchain">On-Chain Sepolia Verified</option>
            <option value="USER_LOGIN">Session Logins</option>
            <option value="USER_LOGOUT">Session Logouts</option>
            <option value="INCOMING_ADDED">Incoming Manifest Created</option>
            <option value="INCOMING_SUBMITTED">Manifest Submitted for Review</option>
            <option value="INCOMING_VERIFIED">Manifest Physically Verified</option>
            <option value="MINT_BATCH_TOKEN">Token Minted (ERC-1155)</option>
            <option value="RELEASE_CREATED">Relief Release Created</option>
            <option value="APPROVE_RELEASE">Release Approved</option>
            <option value="SIGN_RELEASE">Custody Handover Signed</option>
            <option value="RELEASE_DISPATCHED">Dispatched In-Transit</option>
            <option value="CONFIRM_RECEIPT">Delivery Receipt Confirmed</option>
            <option value="CORRECTION_REQUESTED">Correction Requested</option>
            <option value="LGU_REPORT_SUBMITTED">LGU Inventory Report Submitted</option>
            <option value="STOCK_ADDED">Warehouse Stock Added</option>
            <option value="STOCK_DEDUCTED">Warehouse Stock Deducted</option>
            <option value="STOCK_RECOUNT">Physical Stock Recount</option>
            <option value="EXPORT_INVENTORY_REPORT">Inventory Report Exported</option>
            <option value="VERIFY_USER">User Verified</option>
            <option value="DECLINE_USER">Registration Declined</option>
            <option value="DELETE_USER">Account Deleted</option>
            <option value="ASSIGN_LGU">LGU Designated</option>
            <option value="REVERT_RECEIVER">Field Mode Reverted</option>
            <option value="ARCHIVE_LGU">LGU Archived</option>
            <option value="RESTORE_LGU">LGU Restored</option>
            <option value="ARCHIVE_PROVINCE">Province Archived</option>
            <option value="RESTORE_PROVINCE">Province Restored</option>
            <option value="LGU_CREATED">LGU Registered</option>
            <option value="PROVINCE_CREATED">Province Registered</option>
            <option value="WAREHOUSE_CREATED">Warehouse Registered</option>
            <option value="KIT_TYPE_CREATED">Kit Type Registered</option>
            <option value="SUPPLY_SOURCE_CREATED">Supply Hub Registered</option>
          </select>

          {/* Entity Type Filter */}
          <select
            value={logEntityFilter}
            onChange={(e) => {
              setLogEntityFilter(e.target.value);
              setLogsCurrentPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10069f] cursor-pointer"
          >
            <option value="all">All Entities</option>
            <option value="User">User</option>
            <option value="IncomingGoods">Incoming Manifest</option>
            <option value="OutgoingRelease">Outgoing Release</option>
            <option value="BatchToken">Batch Token</option>
            <option value="Warehouse">Warehouse Facility</option>
            <option value="LGU">LGU</option>
            <option value="Province">Province</option>
            <option value="KitType">Commodity Kit Type</option>
            <option value="SupplySource">Logistics Hub Source</option>
            <option value="LGUReport">LGU Inventory Report</option>
            <option value="InventoryReport">Inventory Report Export</option>
          </select>

          {(logSearchQuery || logActionFilter !== 'all' || logEntityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setLogSearchQuery('');
                setLogActionFilter('all');
                setLogEntityFilter('all');
                setLogsCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Sepolia Tx Proof</th>
                <th className="px-5 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#10069f] mb-2" />
                    Loading activity logs...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-bold text-gray-700">No activity logs found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {logSearchQuery || logActionFilter !== 'all' || logEntityFilter !== 'all'
                        ? 'Try clearing or modifying your filter criteria.'
                        : 'System actions and blockchain verifications will appear here as they occur.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 text-[11px] font-mono">
                        {formatLogTimestamp(log.createdAt)}
                      </td>

                      {/* Actor */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 group-hover:text-[#10069f] transition">
                            {log.actorName}
                          </span>
                          {log.actorEmail && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              {log.actorEmail}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            {log.actorRole && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-700">
                                {log.actorRole === 'dswd_admin' ? 'DSWD Admin' : log.actorRole}
                              </span>
                            )}
                            {log.actorWallet && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                {log.actorWallet.slice(0, 6)}...{log.actorWallet.slice(-4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 w-max">
                            {log.entityType}
                          </span>
                          {log.entityId && (
                            <span className="text-[10px] font-mono text-gray-500 mt-0.5 truncate max-w-[140px]" title={log.entityId}>
                              {log.entityId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5 max-w-xs text-gray-700 truncate" title={log.details}>
                        {log.details}
                      </td>

                      {/* Sepolia Tx Proof */}
                      <td className="px-5 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {log.txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-[11px] font-mono font-bold transition group/link"
                            title={`View on Sepolia Etherscan: ${log.txHash}`}
                          >
                            <span>{log.txHash.slice(0, 6)}...{log.txHash.slice(-4)}</span>
                            <ExternalLink className="w-3 h-3 text-indigo-500 group-hover/link:text-indigo-700" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                            Off-Chain
                          </span>
                        )}
                      </td>

                      {/* Inspect */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-[#10069f] hover:bg-blue-50 transition cursor-pointer"
                          title="Inspect Full Audit Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredLogs.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Showing <span className="font-bold text-gray-900">{(logsCurrentPage - 1) * logsPageSize + 1}</span> to{' '}
              <span className="font-bold text-gray-900">
                {Math.min(logsCurrentPage * logsPageSize, filteredLogs.length)}
              </span>{' '}
              of <span className="font-bold text-gray-900">{filteredLogs.length}</span> activity logs
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLogsCurrentPage((p) => Math.max(1, p - 1))}
                disabled={logsCurrentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="font-bold text-gray-800 px-2">
                Page {logsCurrentPage} of {totalLogsPages}
              </span>
              <button
                type="button"
                onClick={() => setLogsCurrentPage((p) => Math.min(totalLogsPages, p + 1))}
                disabled={logsCurrentPage >= totalLogsPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}

  {activeMainTab === 'user_trails' && (
    <div className="space-y-6">
      {/* Account Selector Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#10069f]" />
              Select Personnel Account to Audit
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick any registered personnel to examine their dedicated action history and on-chain proofs.
            </p>
          </div>

          {/* Account Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search accounts by name, role, email..."
              value={userSelectorSearch}
              onChange={(e) => setUserSelectorSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#10069f]"
            />
          </div>
        </div>

        {/* Horizontal Scrollable Account Cards */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1">
          {filteredSelectorProfiles.map((user) => {
            const isSelected = selectedUserForTrail?.id === user.id;
            const actionCount = userActionCounts[user.id] || 0;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedUserForTrail(user);
                  loadUserTrail(user);
                  setUserTrailPage(1);
                }}
                className={`flex-shrink-0 w-64 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-[#10069f] shadow-xs ring-2 ring-[#10069f]/20'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                      user.role === 'dswd_admin'
                        ? 'bg-emerald-100 text-emerald-800'
                        : user.lguName
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#10069f]' : 'text-gray-900'}`}>
                        {user.fullName || 'DSWD Officer'}
                      </p>
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          user.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={user.status === 'verified' ? 'Verified Account' : 'Pending Verification'}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 truncate font-mono mt-0.5">{user.email}</p>
                    <div className="flex items-center justify-between gap-1 mt-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          user.role === 'dswd_admin'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : user.lguName
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {user.role === 'dswd_admin'
                          ? 'Admin'
                          : user.lguName
                          ? `${extractCleanMunicipality(user.lguName)} Focal`
                          : 'Receiver'}
                      </span>
                      <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {actionCount} {actionCount === 1 ? 'action' : 'actions'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredSelectorProfiles.length === 0 && (
            <div className="text-xs text-gray-500 py-3 px-2">No matching accounts found</div>
          )}
        </div>
      </div>

      {/* Selected User Hero Banner */}
      {selectedUserForTrail ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-100">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 shadow-sm ${
                  selectedUserForTrail.role === 'dswd_admin'
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                    : selectedUserForTrail.lguName
                    ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300'
                    : 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                }`}
              >
                {selectedUserForTrail.fullName
                  ? selectedUserForTrail.fullName.slice(0, 2).toUpperCase()
                  : selectedUserForTrail.email.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-gray-900">
                    {selectedUserForTrail.fullName || 'DSWD Officer'}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      selectedUserForTrail.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {selectedUserForTrail.status}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedUserForTrail.role === 'dswd_admin'
                        ? 'bg-blue-100 text-[#10069f]'
                        : selectedUserForTrail.lguName
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {selectedUserForTrail.role === 'dswd_admin'
                      ? 'DSWD Administrator'
                      : selectedUserForTrail.lguName
                      ? `LGU Focal (${extractCleanMunicipality(selectedUserForTrail.lguName)})`
                      : 'Field Receiver'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-mono mt-1">
                  <span>{selectedUserForTrail.email}</span>
                  {selectedUserForTrail.phoneNumber && <span className="font-sans">Phone: {selectedUserForTrail.phoneNumber}</span>}
                  {selectedUserForTrail.truckId && <span>Truck/Plate: #{selectedUserForTrail.truckId}</span>}
                  <span>ID: {selectedUserForTrail.id.slice(0, 8)}...</span>
                </div>

                {/* Smart Account wallet info */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-gray-700">Smart Account:</span>
                  {selectedUserForTrail.walletAddress ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 font-mono text-[11px] text-gray-800">
                      <span>{selectedUserForTrail.walletAddress}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedUserForTrail.walletAddress!, 'trail-user-wallet')}
                        className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                        title="Copy Wallet Address"
                      >
                        {copiedId === 'trail-user-wallet' ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <a
                        href={`https://sepolia.etherscan.io/address/${selectedUserForTrail.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#10069f] hover:underline inline-flex items-center gap-0.5 ml-1 font-bold text-[10px]"
                        title="View on Sepolia Etherscan"
                      >
                        <span>Etherscan</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-gray-400 font-medium italic">
                      Gasless Smart Account auto-provisioned upon next blockchain action
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedProfile(selectedUserForTrail);
                  setIsWalletRevealed(false);
                  setIsWorkIdRevealed(false);
                  setIsIdRevealed(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                Inspect Profile
              </button>
            </div>
          </div>

          {/* Stats for this user */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60">
              <p className="text-xl font-black text-gray-900">{userTrailStats.total}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Total Records</p>
            </div>
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50">
              <p className="text-xl font-black text-indigo-900">{userTrailStats.onChain}</p>
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mt-0.5">On-Chain Verified</p>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <p className="text-xl font-black text-emerald-900">{userTrailStats.logins}</p>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">System Logins</p>
            </div>
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
              <p className="text-xl font-black text-blue-900">{userTrailStats.operational}</p>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mt-0.5">Logistics Operations</p>
            </div>
            <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50">
              <p className="text-xl font-black text-purple-900">{userTrailStats.profileUpdates}</p>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mt-0.5">Security & Identity</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Search & Action Category Filter */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search this user's actions, descriptions, entities, or Sepolia Tx hash..."
            value={userTrailSearchQuery}
            onChange={(e) => {
              setUserTrailSearchQuery(e.target.value);
              setUserTrailPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#10069f] focus:border-transparent transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={userTrailActionFilter}
            onChange={(e) => {
              setUserTrailActionFilter(e.target.value);
              setUserTrailPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#10069f] cursor-pointer"
          >
            <option value="all">All Actions</option>
            <option value="onchain">On-Chain Sepolia Verified</option>
            <option value="USER_LOGIN">Session Logins</option>
            <option value="USER_LOGOUT">Session Logouts</option>
            <option value="USER_SIGNUP">Account Registrations</option>
            <option value="UPDATE_PROFILE">Profile Updates</option>
            <option value="UPDATE_AVATAR">Avatar Changes</option>
            <option value="PROVISION_SMART_ACCOUNT">Smart Account Bindings</option>
            <option value="INCOMING_ADDED">Incoming Manifest Created</option>
            <option value="INCOMING_SUBMITTED">Manifest Submitted</option>
            <option value="INCOMING_VERIFIED">Manifest Verified</option>
            <option value="MINT_BATCH_TOKEN">Token Mints</option>
            <option value="RELEASE_CREATED">Release Drafted</option>
            <option value="APPROVE_RELEASE">Release Approvals</option>
            <option value="SIGN_RELEASE">Handover Signatures</option>
            <option value="RELEASE_DISPATCHED">Dispatched In-Transit</option>
            <option value="CONFIRM_RECEIPT">Receipt Confirmations</option>
            <option value="CORRECTION_REQUESTED">Correction Requested</option>
            <option value="LGU_REPORT_SUBMITTED">LGU Reports Submitted</option>
            <option value="STOCK_RECOUNT">Stock Recounts</option>
            <option value="EXPORT_INVENTORY_REPORT">Inventory Exports</option>
            <option value="ASSIGN_LGU">LGU Designations</option>
            <option value="VERIFY_USER">Account Verifications</option>
          </select>

          {(userTrailSearchQuery || userTrailActionFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setUserTrailSearchQuery('');
                setUserTrailActionFilter('all');
                setUserTrailPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* User Activity Trail Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target Entity</th>
                <th className="px-5 py-3">Audit Details & Summary</th>
                <th className="px-5 py-3">Sepolia Proof</th>
                <th className="px-5 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingUserTrail ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#10069f] mb-2" />
                    Loading activity logs for this user...
                  </td>
                </tr>
              ) : paginatedUserTrailLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-bold text-gray-700">No activity trail records found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {userTrailSearchQuery || userTrailActionFilter !== 'all'
                        ? 'Try clearing or modifying your filter criteria.'
                        : 'Actions taken by or targeting this account will be recorded here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedUserTrailLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 text-[11px] font-mono">
                        {formatLogTimestamp(log.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 w-max">
                            {log.entityType}
                          </span>
                          {log.entityId && (
                            <span className="text-[10px] font-mono text-gray-500 mt-0.5 truncate max-w-[140px]" title={log.entityId}>
                              {log.entityId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5 max-w-sm text-gray-700 truncate" title={log.details}>
                        {log.details}
                      </td>

                      {/* Sepolia Proof */}
                      <td className="px-5 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {log.txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-[11px] font-mono font-bold transition group/link"
                            title={`View on Sepolia Etherscan: ${log.txHash}`}
                          >
                            <span>{log.txHash.slice(0, 6)}...{log.txHash.slice(-4)}</span>
                            <ExternalLink className="w-3 h-3 text-indigo-500 group-hover/link:text-indigo-700" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                            Off-Chain
                          </span>
                        )}
                      </td>

                      {/* Inspect */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-[#10069f] hover:bg-blue-50 transition cursor-pointer"
                          title="Inspect Full Audit Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredUserTrailLogs.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Showing <span className="font-bold text-gray-900">{(userTrailPage - 1) * userTrailPageSize + 1}</span> to{' '}
              <span className="font-bold text-gray-900">
                {Math.min(userTrailPage * userTrailPageSize, filteredUserTrailLogs.length)}
              </span>{' '}
              of <span className="font-bold text-gray-900">{filteredUserTrailLogs.length}</span> activity logs
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUserTrailPage((p) => Math.max(1, p - 1))}
                disabled={userTrailPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="font-bold text-gray-800 px-2">
                Page {userTrailPage} of {totalUserTrailPages}
              </span>
              <button
                type="button"
                onClick={() => setUserTrailPage((p) => Math.min(totalUserTrailPages, p + 1))}
                disabled={userTrailPage >= totalUserTrailPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}

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

            {/* User ID Section (Masked behind Eye Button) */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                    {selectedProfile.role === 'dswd_admin' ? 'DSWD Administrator System ID' : 'Account System ID'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsIdRevealed((prev) => !prev)}
                    className="text-gray-500 hover:text-gray-800 transition cursor-pointer"
                    title={isIdRevealed ? 'Mask ID' : 'Reveal ID'}
                  >
                    {isIdRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
                <p className="font-mono text-xs font-bold text-gray-800 break-all select-all mt-0.5">
                  {isIdRevealed
                    ? selectedProfile.id
                    : `${selectedProfile.id.slice(0, 8)}••••••••••••••••••••••••`}
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

            {/* Official Work / Government ID Photo Viewer (Masked by default with Eye Toggle) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700">
                  Official Work / Government ID Credentials
                </label>
                {selectedProfile.workIdUrl && (
                  <button
                    type="button"
                    onClick={() => setIsWorkIdRevealed((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#10069f] text-[11px] font-bold transition cursor-pointer"
                  >
                    {isWorkIdRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                        <span>Hide Document</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Reveal Document</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {selectedProfile.workIdUrl ? (
                <div className="p-3 rounded-2xl border border-gray-200 bg-slate-50 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative aspect-4/3 w-48 max-w-full rounded-xl overflow-hidden border border-gray-300 shadow-sm bg-black/5 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={selectedProfile.workIdUrl}
                      alt="Work ID Document"
                      className={`w-full h-full object-cover transition duration-300 ${
                        isWorkIdRevealed ? 'blur-none' : 'blur-xl select-none pointer-events-none'
                      }`}
                    />
                    {!isWorkIdRevealed && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center text-white">
                        <Lock className="w-6 h-6 text-amber-400 mb-1" />
                        <span className="text-[10px] font-bold leading-tight">Official ID Masked</span>
                        <span className="text-[8.5px] text-white/80 mt-0.5">Click Reveal to inspect</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Work ID Photo Submitted</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Uploaded during registration for identity verification and administrative approval.
                    </p>
                    {isWorkIdRevealed && (
                      <a
                        href={selectedProfile.workIdUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10069f] hover:underline pt-1"
                      >
                        Open Full Size <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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

            {/* Smart Account Address with Closed/Open Eye Toggle */}
            <div className="p-4 rounded-2xl border border-gray-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-700" />
                  Gasless Smart Account Address
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

                  <div className="flex items-center justify-end">
                    <a
                      href={`https://sepolia.etherscan.io/address/${selectedProfile.walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      View on Etherscan <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>No smart account has been provisioned for this account yet. The user can generate one in Profile Settings.</span>
                </div>
              )}
            </div>

            {/* LGU Municipality Assignment (for Receivers) */}
            {selectedProfile.role === 'receiver' && (() => {
              const activeCustody = getActiveCustodyPackages(selectedProfile, effectiveReleases);
              const currentCleanLgu = extractCleanMunicipality(selectedProfile.lguName);
              const pendingIncoming = currentCleanLgu ? getPendingIncomingToLgu(currentCleanLgu, effectiveReleases) : [];
              const isCustodyLocked = activeCustody.length > 0;
              const isPendingLocked = pendingIncoming.length > 0;
              const isAssignmentLocked = isCustodyLocked || isPendingLocked;

              return (
                <div className="space-y-3 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-indigo-950">
                      Assigned Panay LGU Municipality
                    </label>
                    {isAssignmentLocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3 text-amber-700" />
                        Assignment Locked
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-indigo-700/80">
                    Assign this account as the designated LGU receiver for a Panay municipality, or revert to Field Receiver mode.
                  </p>

                  {/* Warning banner when locked due to active custody */}
                  {isCustodyLocked && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>Active Custody Lockout</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        This receiver is currently carrying <span className="font-bold">{activeCustody.length} active shipment(s)</span> ({activeCustody.map(p => `#${p.drNumber}`).join(', ')}). Role and municipality reassignment are disabled until delivery is completed or transferred to another receiver.
                      </p>
                    </div>
                  )}

                  {/* Warning banner when locked due to pending incoming shipments for this LGU */}
                  {!isCustodyLocked && isPendingLocked && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>Pending Inbound Shipments Lockout</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        <span className="font-bold">{currentCleanLgu}</span> currently has <span className="font-bold">{pendingIncoming.length} inbound shipment(s)</span> in transit ({pendingIncoming.map(p => `#${p.drNumber}`).join(', ')}). Reassigning this receiver is locked until those shipments are accepted.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    <MunicipalitySearchPicker
                      value={assignments[selectedProfile.id] ?? extractCleanMunicipality(selectedProfile.lguName, dbLgus)}
                      onChange={(muni) => handleLguChange(selectedProfile.id, muni)}
                      disabled={savingUserId === selectedProfile.id || isAssignmentLocked}
                      lgus={dbLgus}
                    />

                    <button
                      type="button"
                      disabled={savingUserId === selectedProfile.id || isAssignmentLocked}
                      onClick={() => handleSaveAssignment(selectedProfile)}
                      className="px-4 py-2 rounded-xl bg-[#2500ba] text-white hover:bg-blue-800 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingUserId === selectedProfile.id ? 'Saving...' : 'Save Assignment'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Verification / Approval / Deletion Actions */}
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
                      onClick={() => setConfirmDeclineUser(selectedProfile)}
                      className="px-4 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <UserX className="w-4 h-4" />
                      Decline Registration
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserForTrail(selectedProfile);
                        loadUserTrail(selectedProfile);
                        setUserTrailPage(1);
                        setSelectedProfile(null);
                        setActiveMainTab('user_trails');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#10069f] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      View Action Trail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestDelete(selectedProfile)}
                      className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProfile(null)}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold transition cursor-pointer"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Decline Registration */}
      {confirmDeclineUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-gray-900">Decline Registration?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to decline registration for{' '}
                <strong className="text-gray-900">{confirmDeclineUser.fullName || confirmDeclineUser.email}</strong>?
                This will remove their profile record from the database.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeclineUser(null)}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDecline}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Verified Account */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-gray-900">Permanently Delete Account?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to permanently delete account for{' '}
                <strong className="text-gray-900">{confirmDeleteUser.fullName || confirmDeleteUser.email}</strong>?
                This will remove their identity and system credentials completely. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          ACTIVITY LOG DETAIL MODAL
          ==================================================================== */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 p-6 sm:p-8 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">
                    {getActionBadge(selectedLog.action).label}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {formatLogTimestamp(selectedLog.createdAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actor Details Card */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Initiating Actor</span>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedLog.actorName}</p>
                  <p className="text-xs text-gray-500 font-mono">{selectedLog.actorEmail || 'No email associated'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-[11px] font-bold">
                    {selectedLog.actorRole === 'dswd_admin' ? 'DSWD Admin' : selectedLog.actorRole || 'System'}
                  </span>
                </div>
              </div>
              {selectedLog.actorWallet && (
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500 font-medium">Smart Account:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-gray-800 font-bold break-all">{selectedLog.actorWallet}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedLog.actorWallet!, 'log-wallet')}
                      className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                      title="Copy Address"
                    >
                      {copiedId === 'log-wallet' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Entity & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Target Entity</span>
                <span className="text-xs font-bold text-gray-900 mt-1 block">
                  {selectedLog.entityType} {selectedLog.entityId ? `(#${selectedLog.entityId})` : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Action Code</span>
                <span className="text-xs font-mono font-bold text-gray-900 mt-1 block">
                  {selectedLog.action}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-gray-200 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Summary & Details</span>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                {selectedLog.details}
              </p>
            </div>

            {/* On-Chain Ethereum Sepolia Verification Card */}
            {selectedLog.txHash ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/40 border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-indigo-950">Ethereum Sepolia On-Chain Verification</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Sepolia Testnet
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-indigo-100 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gray-800 break-all select-all font-bold">
                    {selectedLog.txHash}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedLog.txHash!, 'log-tx')}
                    className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer flex-shrink-0"
                    title="Copy Transaction Hash"
                  >
                    {copiedId === 'log-tx' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-end">
                  <a
                    href={`https://sepolia.etherscan.io/tx/${selectedLog.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10069f] text-white text-xs font-bold hover:bg-blue-900 transition shadow-xs"
                  >
                    <span>View on Sepolia Etherscan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>This action was recorded directly in the Supabase audit trail as an administrative operation.</span>
              </div>
            )}

            {/* Metadata Payload Inspection */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Extended Metadata Payload
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(selectedLog.metadata, null, 2), 'log-meta')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10069f] hover:underline cursor-pointer"
                  >
                    {copiedId === 'log-meta' ? (
                      <>
                        <Check className="w-3 h-3 text-green-600" />
                        <span>Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-3.5 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-48 border border-gray-800">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
