import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Layers,
  LocateFixed,
  Package,
  ScanLine,
  Settings,
  Truck,
  X,
  ExternalLink,
  ShieldCheck,
  Menu
} from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

import type { OutgoingRelease } from '../../hooks/useInventoryState';
import { authApi, type UserProfile } from '../../services/authApi';
import { backendApi, type TruckLiveLocation, type LguRecord } from '../../services/backendApi';
import { findMatchingLgu, normalizeLguName } from '../../lib/lguMatching';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import { MobileSettingsModal } from '../modals/MobileSettingsModal';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';
import { formatUserErrorMessage } from '../../lib/errorUtils';

interface LGUReceiverPageProps {
  profile: UserProfile;
  releases: OutgoingRelease[];
  lgusList?: LguRecord[];
  onAccept: (drNumber: string, actorRole?: any, actorLguMunicipality?: string, receiverGps?: string) => Promise<{ ok: boolean; message: string }>;
  onSignOut: () => void;
}

interface BarcodeDetectorResult {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

interface BarcodeDetectorWindow extends Window {
  BarcodeDetector?: BarcodeDetectorConstructor;
}

const DEFAULT_PANAY_CENTER: [number, number] = [10.7202, 122.5621];

const isValidCoordinate = (coord?: [number, number] | null): coord is [number, number] => {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number' &&
    !isNaN(coord[0]) &&
    !isNaN(coord[1])
  );
};

// One-shot silent background GPS lookup for backend audit trail
const getQuickGpsCoords = (): Promise<string | undefined> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
    );
  });

// Clean Modern Marker Icons (Minimalist SVG, signature #2500ba royal indigo, no embedded text)
const destinationPinIcon = L.divIcon({
  className: 'lgu-destination-marker-pin',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #2500ba;
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 14px rgba(37,0,186,0.4), 0 2px 4px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 2;
      ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #2500ba; margin-top: -1px; z-index: 1;"></div>
      <div style="width: 8px; height: 2px; background: rgba(15,23,42,0.2); border-radius: 50%; margin-top: 1px;"></div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  popupAnchor: [0, -38]
});

const truckMarkerIcon = L.divIcon({
  className: 'lgu-truck-marker-pin',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
      <div style="position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 44px; height: 44px; border-radius: 50%; background: #2500ba; opacity: 0.22; animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #2500ba;
        border: 2.5px solid #ffffff;
        box-shadow: 0 6px 16px rgba(37,0,186,0.4), 0 2px 4px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 2;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>
      <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #2500ba; margin-top: -1px; z-index: 1;"></div>
      <div style="width: 10px; height: 3px; background: rgba(15,23,42,0.25); border-radius: 50%; margin-top: 1px;"></div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  popupAnchor: [0, -42]
});

function MapController({
  adminPins,
  trucks,
  fallbackCenter,
  recenterKey
}: {
  adminPins: [number, number][];
  trucks: [number, number][];
  fallbackCenter?: [number, number] | null;
  recenterKey: number;
}) {
  const map = useMap();
  const isInitial = useRef(true);

  const fitAll = () => {
    const allPoints = [...adminPins, ...trucks];
    if (allPoints.length > 0) {
      try {
        if (allPoints.length === 1) {
          map.setView(allPoints[0], 13, { animate: true });
        } else {
          const bounds = L.latLngBounds(allPoints);
          map.fitBounds(bounds, { padding: [55, 55], maxZoom: 14, animate: true });
        }
        return;
      } catch {}
    }
    if (fallbackCenter && isValidCoordinate(fallbackCenter)) {
      map.setView(fallbackCenter, 12, { animate: true });
    }
  };

  useEffect(() => {
    if (!map) return;
    if (isInitial.current) {
      isInitial.current = false;
      fitAll();
    }
  }, [adminPins, trucks, fallbackCenter, map]);

  useEffect(() => {
    if (!map || recenterKey === 0) return;
    fitAll();
  }, [recenterKey]);

  return null;
}

export function LGUReceiverPage({ profile, releases, lgusList, onAccept, onSignOut }: LGUReceiverPageProps) {
  // LGU municipality is strictly assigned by Central Admin from the database profile
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

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

  // Optimistic tracking for accepted packages so they immediately leave the incoming view upon scan
  const [locallyAcceptedDrs, setLocallyAcceptedDrs] = useState<string[]>([]);

  // Municipality is strictly read from profile; only administrators can assign or modify
  const effectiveLguName = (profile.lguName || '').trim();

  const canonicalUserLgu = useMemo(() => {
    if (!effectiveLguName) return null;
    return findMatchingLgu(dbLgus, effectiveLguName);
  }, [dbLgus, effectiveLguName]);

  const targetMuni = (canonicalUserLgu ? canonicalUserLgu.municipality : effectiveLguName).toLowerCase();
  const lguDisplayName = canonicalUserLgu
    ? `${canonicalUserLgu.municipality} LGU Receiver`
    : effectiveLguName
    ? `${effectiveLguName} LGU Receiver`
    : profile.fullName || 'LGU Receiver';

  // Strict municipality resolver for outgoing shipments
  const getReleaseDestinationMuni = (r: OutgoingRelease): string | null => {
    // 1. Direct municipality field if present
    if (r.municipality && typeof r.municipality === 'string' && r.municipality.trim()) {
      const match = findMatchingLgu(dbLgus, r.municipality, r.province);
      if (match) return match.municipality.toLowerCase();
      const raw = normalizeLguName(r.municipality);
      if (raw) return raw;
    }
    // 2. LGU Name field (e.g. "Sigma Municipal Hall" -> "sigma")
    if (r.lguName && typeof r.lguName === 'string' && r.lguName.trim()) {
      const match = findMatchingLgu(dbLgus, r.lguName, r.province);
      if (match) return match.municipality.toLowerCase();
      const raw = normalizeLguName(r.lguName);
      if (raw) return raw;
    }
    // 3. Destination Address (strictly matching known municipality)
    if (r.destinationAddress && typeof r.destinationAddress === 'string' && r.destinationAddress.trim()) {
      const match = findMatchingLgu(dbLgus, r.destinationAddress, r.province);
      if (match) return match.municipality.toLowerCase();
    }
    return null;
  };

  // Strict validation: Release must match this LGU's canonical municipality exactly
  const isReleaseForThisLgu = (r: OutgoingRelease): boolean => {
    if (!targetMuni) return false; // STRICT: if no LGU assigned, NEVER match all!
    const relMuni = getReleaseDestinationMuni(r);
    if (!relMuni) return false;
    return relMuni === targetMuni;
  };

  // 2. Incoming Releases strictly destined for this LGU (excluding accepted)
  const upcomingReleases = useMemo(() => {
    return releases.filter((r) => {
      if (locallyAcceptedDrs.includes(r.drNumber.trim().toUpperCase())) return false;
      const matchesLgu = isReleaseForThisLgu(r);
      const isUpcoming = ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered'].includes(r.deliveryStatus);
      return matchesLgu && isUpcoming;
    });
  }, [releases, targetMuni, locallyAcceptedDrs]);

  const acceptedReleases = useMemo(() => {
    return releases.filter((r) => {
      const matchesLgu = isReleaseForThisLgu(r);
      const isAccepted = r.deliveryStatus === 'Accepted' || locallyAcceptedDrs.includes(r.drNumber.trim().toUpperCase());
      return matchesLgu && isAccepted;
    });
  }, [releases, targetMuni, locallyAcceptedDrs]);

  const currentRelease = upcomingReleases[0] || null;

  // Status check: Has the assigned receiver scanned the package for pickup yet?
  const isPickedUp = useMemo(() => {
    if (!currentRelease) return false;
    return currentRelease.deliveryStatus === 'In Transit' || currentRelease.deliveryStatus === 'Delivered';
  }, [currentRelease]);

  const originWarehouseName = useMemo(() => {
    if (!currentRelease) return 'DSWD Oton Main Warehouse';
    const src = (currentRelease.warehouseSource || '').trim();
    if (src) return src;
    return 'DSWD Oton Main Warehouse';
  }, [currentRelease]);

  // 3. Real-time Live Truck Locations
  const [liveTruckLocations, setLiveTruckLocations] = useState<Record<string, TruckLiveLocation>>({});

  useEffect(() => {
    backendApi.getTruckLiveLocations().then((list) => {
      const map: Record<string, TruckLiveLocation> = {};
      list.forEach((t) => {
        map[t.truck_id] = t;
      });
      setLiveTruckLocations(map);
    });

    const unsub = backendApi.subscribeTruckLiveLocations(
      (upserted) => {
        setLiveTruckLocations((prev) => ({ ...prev, [upserted.truck_id]: upserted }));
      },
      (deletedId) => {
        setLiveTruckLocations((prev) => {
          const next = { ...prev };
          delete next[deletedId];
          return next;
        });
      }
    );

    return () => unsub();
  }, []);


  // 4. Fixed Official Municipality Destination Coordinates (Fixed at LGU)
  const lguInfo = useMemo(() => {
    if (canonicalUserLgu) return canonicalUserLgu;
    if (currentRelease?.municipality) {
      const match = findMatchingLgu(dbLgus, currentRelease.municipality, currentRelease.province);
      if (match) return match;
    }
    if (effectiveLguName) return findMatchingLgu(dbLgus, effectiveLguName);
    return undefined;
  }, [canonicalUserLgu, currentRelease, dbLgus, effectiveLguName]);

  const lguFacilityName = useMemo(() => {
    return lguInfo?.lguName || (effectiveLguName ? `${effectiveLguName} Relief Destination` : 'LGU Destination');
  }, [lguInfo, effectiveLguName]);

  const lguFallbackCoords = useMemo<[number, number] | null>(() => {
    if (lguInfo && typeof lguInfo.latitude === 'number' && typeof lguInfo.longitude === 'number') {
      return [lguInfo.latitude, lguInfo.longitude];
    }
    return [11.0, 122.5];
  }, [lguInfo]);

  // Admin-placed drop-off pins for incoming releases destined for this LGU (strictly release.receiverGps)
  const incomingAdminPins = useMemo(() => {
    return upcomingReleases
      .map((r) => {
        if (!r.receiverGps) return null;
        const parts = r.receiverGps.split(',').map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return {
            release: r,
            coords: [parts[0], parts[1]] as [number, number]
          };
        }
        return null;
      })
      .filter((item): item is { release: OutgoingRelease; coords: [number, number] } => item !== null);
  }, [upcomingReleases]);

  // Active trucks assigned to deliveries for this LGU (In Transit or Delivered with live GPS)
  const incomingTrucks = useMemo(() => {
    return upcomingReleases
      .filter((r) => ['In Transit', 'Delivered'].includes(r.deliveryStatus) && Boolean(r.assignedTruckId))
      .map((r) => {
        const truckId = r.assignedTruckId!;
        const livePos = liveTruckLocations[truckId];
        let coords: [number, number] | null = null;
        if (livePos && typeof livePos.latitude === 'number' && typeof livePos.longitude === 'number') {
          coords = [livePos.latitude, livePos.longitude];
        }
        let dropOffCoords: [number, number] | null = null;
        if (r.receiverGps) {
          const parts = r.receiverGps.split(',').map((s) => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            dropOffCoords = [parts[0], parts[1]];
          }
        }
        return {
          release: r,
          truckId,
          coords,
          dropOffCoords
        };
      })
      .filter((item): item is { release: OutgoingRelease; truckId: string; coords: [number, number]; dropOffCoords: [number, number] | null } => item.coords !== null);
  }, [upcomingReleases, liveTruckLocations]);

  const lguDestinationCoords = useMemo<[number, number] | null>(() => {
    // 1. If release has explicit receiverGps saved, use it
    if (currentRelease?.receiverGps) {
      const parts = currentRelease.receiverGps.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    // 2. Look up from incomingAdminPins
    if (incomingAdminPins[0]?.coords) {
      return incomingAdminPins[0].coords;
    }
    return null;
  }, [currentRelease, incomingAdminPins]);


  // 4. Navigation Drawers & LGU Inventory State (Read-only for LGU recipient)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUpcomingDeliveriesOpen, setIsUpcomingDeliveriesOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [lguStock, setLguStock] = useState<{ foodPacks: number; hygieneKits: number; familyKits: number; lastReported?: string } | null>(null);

  const loadLguStock = async () => {
    if (!targetMuni) return;
    try {
      const reports = await backendApi.getLguPriorityReports(effectiveLguName);
      const matched = reports.find(
        (r) =>
          (r.municipality && findMatchingLgu(dbLgus, r.municipality)?.municipality.toLowerCase() === targetMuni) ||
          (r.lguName && findMatchingLgu(dbLgus, r.lguName)?.municipality.toLowerCase() === targetMuni) ||
          (r.municipality && r.municipality.toLowerCase() === targetMuni) ||
          (r.lguName && r.lguName.toLowerCase().includes(targetMuni))
      );
      if (matched) {
        const fp = matched.foodPacks || 0;
        const hk = matched.hygieneKits || 0;
        const fk = matched.familyKits || 0;
        setLguStock({
          foodPacks: fp,
          hygieneKits: hk,
          familyKits: fk,
          lastReported: matched.reportedAt
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadLguStock();
  }, [targetMuni, effectiveLguName]);

  // 5. Camera QR Scanner & Direct Inventory Acceptance
  const [isScanning, setIsScanning] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Align camera with shipment QR code');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string; txHash?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const cameraOpenRef = useRef(false);

  const startCamera = async () => {
    cameraOpenRef.current = true;
    setIsScanning(true);
    setCameraMessage('Requesting camera access...');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera access not supported on this device/browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const Detector = (window as BarcodeDetectorWindow).BarcodeDetector;
      if (!Detector) {
        setCameraMessage('Point camera at shipment QR code.');
        return;
      }

      detectorRef.current = new Detector({ formats: ['qr_code'] });
      const scan = async () => {
        if (!videoRef.current || !cameraOpenRef.current || !detectorRef.current || isProcessing) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            handleScannedPayload(codes[0].rawValue);
          }
        } catch {
          setCameraMessage('Keep the QR centered in the viewfinder.');
        }
        if (cameraOpenRef.current) requestAnimationFrame(scan);
      };

      const video = videoRef.current;
      if (video) video.onloadeddata = () => requestAnimationFrame(scan);
    } catch {
      setCameraMessage('Camera permission was denied.');
    }
  };

  const stopCamera = () => {
    cameraOpenRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleScannedPayload = async (rawPayload: string) => {
    stopCamera();
    setIsProcessing(true);

    try {
      let drNumber = '';
      let category = 'Relief Goods';
      let quantity = 0;
      let rawTo = '';

      try {
        const parsed = JSON.parse(rawPayload);
        drNumber = parsed.drNumber || '';
        category = parsed.category || currentRelease?.fnfiCategory || 'Relief Goods';
        if (parsed.quantity !== undefined && parsed.quantity !== null && Number(parsed.quantity) > 0) {
          quantity = Number(parsed.quantity);
        }
        rawTo = parsed.to || '';
      } catch {
        if (rawPayload.trim().toUpperCase().startsWith('DR-')) {
          drNumber = rawPayload.trim().toUpperCase();
        } else {
          throw new Error('Invalid QR payload format. Please scan a valid shipment QR code.');
        }
      }

      if (!drNumber) {
        throw new Error('QR payload is missing a valid DR Number.');
      }

      // Find matching release in the system (from props or active upcoming)
      const matchingRelease = releases.find((r) => r.drNumber.toUpperCase() === drNumber.toUpperCase()) || (currentRelease?.drNumber.toUpperCase() === drNumber.toUpperCase() ? currentRelease : null);
      const canonicalDrNumber = (matchingRelease?.drNumber || drNumber).trim();

      if (matchingRelease) {
        category = matchingRelease.fnfiCategory || category;
        if (!quantity || quantity <= 0) {
          quantity = Number(matchingRelease.amountApproved || matchingRelease.amountRequested || 0);
        }
        if (!rawTo) {
          rawTo = matchingRelease.destinationAddress || matchingRelease.lguName || matchingRelease.municipality || '';
        }
      }

      if (!quantity || isNaN(quantity) || quantity <= 0) {
        throw new Error(`Unable to determine verified shipment quantity for ${canonicalDrNumber}. QR payload and registered release record are missing a valid positive quantity.`);
      }

      // Check if already accepted or delivered (double-scan protection & endpoint finality)
      if (
        matchingRelease?.deliveryStatus === 'Accepted' ||
        matchingRelease?.deliveryStatus === 'Distributed' ||
        locallyAcceptedDrs.includes(canonicalDrNumber.toUpperCase())
      ) {
        setIsProcessing(false);
        setToastMessage({
          type: 'error',
          text: `Shipment ${canonicalDrNumber} has already completed its delivery cycle and was accepted into ${effectiveLguName || 'LGU'} inventory. Double-scanning is prohibited.`
        });
        return;
      }

      // STRICT CHAIN OF CUSTODY VALIDATION:
      // Manifest MUST pass from Central Admin -> Assigned Receiver -> LGU Receiver.
      // Direct Admin -> LGU scan is strictly prohibited.
      if (matchingRelease) {
        const allowedTransitStatuses = ['In Transit', 'Delivered'];
        if (!allowedTransitStatuses.includes(matchingRelease.deliveryStatus)) {
          throw new Error(
            `Chain of Custody Violation: Shipment ${canonicalDrNumber} is currently "${matchingRelease.deliveryStatus}". It must be picked up and scanned into transit by the designated receiver before the LGU can accept it.`
          );
        }
      }

      // STRICT DESTINATION VALIDATION:
      // LGU Receivers cannot scan shipments intended for other LGUs, and must have an assigned LGU
      if (!targetMuni) {
        throw new Error('Your account has no designated municipality assigned. Contact Central Admin before accepting deliveries.');
      }

      const destMuni =
        (matchingRelease && getReleaseDestinationMuni(matchingRelease)) ||
        (rawTo && (findMatchingLgu(dbLgus, rawTo)?.municipality.toLowerCase() || normalizeLguName(rawTo))) ||
        '';

      if (!destMuni || destMuni !== targetMuni) {
        const designatedName = (destMuni && findMatchingLgu(dbLgus, destMuni)?.municipality) || destMuni || 'another municipality';
        throw new Error(`Mismatched Destination: Shipment ${canonicalDrNumber} is designated for ${designatedName}, not ${canonicalUserLgu?.municipality || effectiveLguName}. LGU Receivers cannot scan deliveries for other municipalities.`);
      }

      // Resolve authoritative municipality name from database
      const authoritativeLgu = (rawTo && findMatchingLgu(dbLgus, rawTo)) || (matchingRelease?.municipality ? findMatchingLgu(dbLgus, matchingRelease.municipality) : undefined) || canonicalUserLgu;
      const finalMuni = authoritativeLgu?.municipality || canonicalUserLgu?.municipality || effectiveLguName || 'LGU';

      // Capture background GPS location silently for audit log (backend only)
      const receiverGps = await getQuickGpsCoords();

      // Immediately mark as accepted locally so the package leaves the incoming card/map
      setLocallyAcceptedDrs((prev) => [...prev, canonicalDrNumber.toUpperCase()]);

      // Execute on-chain acceptance through inventory state
      const acceptResult = await onAccept(canonicalDrNumber, 'LGUReceiver', finalMuni, receiverGps);
      if (!acceptResult.ok) {
        throw new Error(acceptResult.message || 'Blockchain confirmation failed on Sepolia.');
      }

      const receiptTxHash = (acceptResult as any)?.txHash;

      // Record direct custody acceptance in Supabase
      await backendApi.recordLguReceipt({
        drNumber: canonicalDrNumber,
        lguName: finalMuni,
        municipality: finalMuni,
        category,
        quantity,
        receiverGps,
        receiverSignature: receiptTxHash || `RECEIVER-QR-${Date.now()}`,
        txHash: receiptTxHash
      });

      await loadLguStock();

      // Smooth 5-dot modal completes into "Done!"
      setTimeout(() => {
        setIsProcessing(false);
        setToastMessage({
          type: 'success',
          text: `Delivery ${canonicalDrNumber} confirmed on Sepolia! Handover verified.`,
          txHash: receiptTxHash
        });
      }, 1600);
    } catch (err) {
      setIsProcessing(false);
      setToastMessage({
        type: 'error',
        text: formatUserErrorMessage(err, 'Unable to record shipment receipt. Please check your connection.')
      });
    }
  };

  return (
    <main className="h-[100dvh] w-full bg-[#e7e6ea] p-0 text-[#15132d] sm:p-4 md:p-6 flex items-center justify-center font-sans overflow-hidden">
      {/* Comfy 5-Dot Loading Modal */}
      <FiveDotsLoadingModal
        isOpen={isProcessing}
        title="Processing Delivery Receipt"
        subtitle={`Updating ${effectiveLguName || 'LGU'} warehouse inventory in Supabase...`}
      />

      <section className="mx-auto flex h-full max-h-[100dvh] w-full max-w-full sm:max-w-lg md:max-w-xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[94dvh] sm:max-h-[920px] sm:rounded-3xl relative">
        {/* Header matching ReceiverPage */}
        <header className="z-10 flex items-center justify-between bg-[#2500ba] px-5 py-3.5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative group flex-shrink-0">
              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-full select-none flex-shrink-0 ${
                  !profile?.walletAddress
                    ? 'border-2 border-red-500 ring-2 ring-red-400/60 bg-red-950/30'
                    : 'border border-white/70 bg-white/10'
                }`}
                title={!profile?.walletAddress ? "Open profile settings to provision your Smart Account." : profile?.fullName || 'LGU Officer Profile'}
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName || 'LGU Officer Avatar'}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {(profile?.fullName || effectiveLguName || 'LGU').slice(0, 2).toUpperCase()}
                  </span>
                )}
                {!profile?.walletAddress && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center ring-1 ring-white shadow">
                    <AlertTriangle className="w-2 h-2" />
                  </span>
                )}
              </div>
              {!profile?.walletAddress && (
                <div className="absolute top-full mt-2 left-0 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-red-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-red-700/60">
                  Open profile settings to provision your Smart Account.
                  <div className="absolute -top-1 left-3 border-4 border-transparent border-b-red-900" />
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold flex items-center gap-1.5">
                <span>Receiver View</span>
                <span className="text-[8.5px] bg-white/20 px-1 py-0.2 rounded font-mono">Profile</span>
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-white/90 font-bold truncate max-w-[120px]">
                  {profile?.fullName || 'LGU Officer'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-yellow-950 font-black text-[9px] uppercase tracking-wide shadow-xs border border-yellow-500/40">
                  {effectiveLguName ? `${effectiveLguName} LGU` : 'No LGU Assigned'}
                </span>
              </div>
            </div>
          </div>

        </header>

        {profile && (
          <MobileSettingsModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            profile={profile}
            onSignOut={onSignOut}
          />
        )}

        {/* Unassigned LGU Banner (Central Admin must assign) */}
        {!effectiveLguName && (
          <div className="bg-amber-500 text-white px-3.5 py-2.5 text-xs font-medium flex items-center justify-between z-30 shadow-md border-b border-amber-600">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-100 flex-shrink-0" />
              <div>
                <p className="font-extrabold text-[11px] leading-tight">No Designated LGU Assigned</p>
                <p className="text-[10px] text-amber-100 leading-tight">
                  No municipality is linked to this account. Contact your DSWD Central Administrator to assign your LGU.
                </p>
              </div>
            </div>
            <span className="text-[8.5px] bg-amber-700/90 text-white px-2 py-0.5 rounded font-extrabold uppercase tracking-wide flex-shrink-0 ml-2">
              Admin Action Required
            </span>
          </div>
        )}

        {/* Pre-Pickup Notice: Still in Warehouse (No Warehouse Pin on Map) */}
        {currentRelease && !isPickedUp && (
          <div className="bg-amber-500 text-white px-3.5 py-2 text-xs font-medium flex items-center justify-between z-10 shadow-sm border-b border-amber-600">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-amber-100 flex-shrink-0" />
              <div>
                <p className="font-extrabold text-[11px] leading-tight">Still in Warehouse</p>
                <p className="text-[10px] text-amber-100 leading-tight">
                  Package is at {originWarehouseName}, preparing to be scanned by the assigned receiver.
                </p>
              </div>
            </div>
            <span className="text-[8.5px] bg-amber-700/90 text-white px-2 py-0.5 rounded font-extrabold uppercase tracking-wide flex-shrink-0 ml-2">
              Awaiting Receiver Scan
            </span>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`px-3.5 py-2 text-xs font-bold flex items-center justify-between z-20 shadow-md ${
              toastMessage.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 size={14} className="flex-shrink-0" />
              ) : (
                <AlertCircle size={14} className="flex-shrink-0" />
              )}
              <span className="leading-tight">{toastMessage.text}</span>
              {toastMessage.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${toastMessage.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[11px] font-mono font-bold underline transition ml-1"
                >
                  <ShieldCheck size={11} />
                  <span>Sepolia ({toastMessage.txHash.slice(0, 6)}...{toastMessage.txHash.slice(-4)})</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 opacity-80 hover:opacity-100 ml-2"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Leaflet Map Area */}
        <div className="relative flex-1 overflow-hidden bg-[#f8fafc]">
          <div className="absolute inset-0 z-0">
            <MapContainer
              center={lguDestinationCoords || DEFAULT_PANAY_CENTER}
              zoom={lguDestinationCoords ? 12 : 10}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution={MAP_TILE_CONFIG.attribution}
                url={MAP_TILE_CONFIG.url}
                subdomains={MAP_TILE_CONFIG.subdomains}
                maxZoom={MAP_TILE_CONFIG.maxZoom}
              />

              <MapController
                adminPins={incomingAdminPins.map((p) => p.coords)}
                trucks={incomingTrucks.map((t) => t.coords)}
                fallbackCenter={lguFallbackCoords}
                recenterKey={recenterTrigger}
              />

              {/* Admin Drop-Off Pins (strictly receiverGps placed by admin) */}
              {incomingAdminPins.map(({ release, coords }) => (
                <Marker
                  key={`admin-pin-${release.drNumber}`}
                  position={coords}
                  icon={destinationPinIcon}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#2500ba]">Admin Drop-off Location</p>
                      <p className="font-semibold text-gray-800">{release.drNumber}</p>
                      <p className="text-[11px] text-gray-700">
                        {(release.amountApproved || release.amountRequested || 0).toLocaleString()} {release.fnfiCategory}
                      </p>
                      <p className="text-[10.5px] text-gray-500">
                        {release.destinationAddress || release.municipality || effectiveLguName}
                      </p>
                      <p className="text-[9.5px] font-mono text-gray-400">
                        {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
                      </p>
                      <p className="text-[9.5px] font-bold text-indigo-700">
                        Status: {release.deliveryStatus}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Active En Route Trucks Delivering to this LGU */}
              {incomingTrucks.map(({ release, truckId, coords, dropOffCoords }) => (
                <React.Fragment key={`truck-${release.drNumber}-${truckId}`}>
                  <Marker
                    position={coords}
                    icon={truckMarkerIcon}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-sky-800">Relief Truck: {truckId}</p>
                        <p className="font-semibold text-gray-800">{release.drNumber}</p>
                        <p className="text-[11px] text-gray-700">
                          {(release.amountApproved || release.amountRequested || 0).toLocaleString()} {release.fnfiCategory}
                        </p>
                        <p className="text-[10px] font-mono text-gray-500">Live GPS position</p>
                        <p className="text-[9.5px] font-bold text-emerald-600">
                          En Route to {effectiveLguName || 'Destination'}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                  {dropOffCoords && (
                    <>
                      <Polyline
                        positions={[coords, dropOffCoords]}
                        pathOptions={{
                          color: '#2500ba',
                          weight: 7,
                          opacity: 0.18
                        }}
                      />
                      <Polyline
                        positions={[coords, dropOffCoords]}
                        pathOptions={{
                          color: '#2500ba',
                          weight: 3,
                          opacity: 0.9,
                          dashArray: '6, 8'
                        }}
                      />
                    </>
                  )}
                </React.Fragment>
              ))}
            </MapContainer>
          </div>

          {/* Floating HUD Controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setRecenterTrigger((prev) => prev + 1)}
              title="Recenter map"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-md hover:bg-gray-50 active:scale-95 text-gray-700 border border-gray-200 transition"
            >
              <LocateFixed size={18} />
            </button>
          </div>



        </div>

        {/* Bottom Navigation matching Field Receiver */}
        <nav className="flex h-16 w-full items-center justify-around border-t border-gray-200 bg-white px-6 shadow-lg z-20 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsUpcomingDeliveriesOpen(true)}
            aria-label="Upcoming Deliveries"
            className="p-2 transition text-gray-500 hover:text-[#2500ba] cursor-pointer flex flex-col items-center gap-0.5"
            title="Upcoming Deliveries"
          >
            <Truck size={21} />
            <span className="text-[9px] font-bold">Deliveries</span>
          </button>

          <button
            type="button"
            onClick={startCamera}
            aria-label="Scan Delivery QR Code"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#2500ba] text-white shadow-lg ring-4 ring-white active:scale-95 transition cursor-pointer"
            title="Scan Delivery QR"
          >
            <ScanLine size={26} />
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Navigation Menu"
            className="p-2 transition text-gray-500 hover:text-[#2500ba] cursor-pointer flex flex-col items-center gap-0.5"
            title="Menu"
          >
            <Menu size={22} />
            <span className="text-[9px] font-bold">Menu</span>
          </button>
        </nav>

        {/* Slide-over Hamburger Sidebar Drawer */}
        {isSidebarOpen && (
          <div className="absolute inset-0 z-50 bg-black/50 flex justify-end animate-in fade-in duration-150">
            <div className="w-[82%] max-w-xs h-full bg-white shadow-2xl flex flex-col justify-between p-5 animate-in slide-in-from-right duration-200">
              <div className="space-y-4">
                {/* Header with Close */}
                <div className="flex items-center justify-between border-b pb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2500ba] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {(profile?.fullName || effectiveLguName || 'LG').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-900 leading-tight truncate max-w-[150px]">
                        {profile?.fullName || 'LGU Officer'}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-semibold truncate max-w-[150px]">
                        {effectiveLguName ? `${effectiveLguName} LGU` : 'No LGU Assigned'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Sepolia Smart Account Card */}
                {profile?.walletAddress && (
                  <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-left space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-bold text-purple-900 uppercase tracking-wide">Sepolia Smart Account</span>
                      <a
                        href={`https://sepolia.etherscan.io/address/${profile.walletAddress}#nfttransfers`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9.5px] font-bold text-[#2500ba] hover:underline flex items-center gap-0.5"
                      >
                        <span>Etherscan</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <p className="font-mono text-[10px] text-purple-800 break-all leading-tight">
                      {profile.walletAddress}
                    </p>
                  </div>
                )}

                {/* Navigation Options */}
                <div className="space-y-1.5 pt-1">
                  {/* Option 1: Upcoming Relief Deliveries */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsUpcomingDeliveriesOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-gray-100 text-gray-800 text-xs font-bold transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Truck size={17} className="text-[#2500ba]" />
                      <span>Upcoming Deliveries</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-[#2500ba] font-bold">
                      {upcomingReleases.length}
                    </span>
                  </button>

                  {/* Option 2: Current LGU Stock */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsInventoryOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-gray-100 text-gray-800 text-xs font-bold transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers size={17} className="text-teal-600" />
                      <span>Current LGU Stock</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                      {((lguStock?.foodPacks || 0) + (lguStock?.hygieneKits || 0) + (lguStock?.familyKits || 0)).toLocaleString()}
                    </span>
                  </button>

                  {/* Option 3: Profile & Smart Account Settings */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-gray-100 text-gray-800 text-xs font-bold transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings size={17} className="text-gray-600" />
                      <span>Profile & Settings</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                  </button>

                  {/* Delivery History Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsHistoryOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-gray-100 text-gray-800 text-xs font-bold transition text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <ClipboardList size={17} className="text-emerald-600" />
                      <span>Accepted History</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {acceptedReleases.length}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Scanner Modal Overlay */}
        {isScanning && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col justify-between p-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-white pt-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                  <ScanLine size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold">QR Camera Scanner</p>
                  <p className="text-[10px] text-white/70">Point at delivery QR payload</p>
                </div>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Viewfinder Reticle */}
            <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden rounded-2xl bg-black/60 border border-white/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="relative z-10 w-56 h-56 border-2 border-white/80 rounded-2xl pointer-events-none flex items-center justify-center shadow-2xl">
                <div className="w-48 h-48 border border-white/40 rounded-xl animate-pulse" />
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400" />
              </div>
            </div>

            <div className="space-y-3 pb-2 text-center">
              <p className="text-xs font-medium text-white/80">{cameraMessage}</p>
              <button
                type="button"
                onClick={stopCamera}
                className="w-full rounded-xl bg-white/15 py-2.5 text-xs font-bold text-white hover:bg-white/25 transition border border-white/20"
              >
                Cancel Scanner
              </button>
            </div>
          </div>
        )}

        {/* Upcoming Deliveries Drawer Modal */}
        {isUpcomingDeliveriesOpen && (
          <div className="absolute inset-0 z-40 bg-black/50 flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-white rounded-t-[24px] p-5 space-y-4 max-h-[85%] overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center text-[#2500ba]">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900">Upcoming Deliveries</h3>
                    <p className="text-[10px] text-gray-500">Scheduled inbound shipments for {effectiveLguName || 'your LGU'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUpcomingDeliveriesOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {upcomingReleases.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  <Package size={28} className="mx-auto mb-2 text-gray-300" />
                  <p className="font-bold">No upcoming deliveries scheduled.</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Shipments dispatched by DSWD Central Admin to {effectiveLguName || 'your LGU'} will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {upcomingReleases.map((r) => (
                    <div
                      key={r.drNumber}
                      className="p-3 rounded-xl border border-gray-200 bg-white text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#2500ba] text-[11px]">
                          {r.drNumber}
                        </span>
                        {r.deliveryStatus === 'Delivered' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            Arrived at Terminal
                          </span>
                        ) : r.deliveryStatus === 'In Transit' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            In Transit
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300">
                            Warehouse Prep
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 mt-1">
                        {(r.amountApproved || r.amountRequested || 0).toLocaleString()} {r.fnfiCategory}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Source: {r.warehouseSource || 'DSWD Logistics Hub'} &bull; Vehicle: {r.assignedTruckId || 'Pending'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsUpcomingDeliveriesOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
              >
                Close Deliveries View
              </button>
            </div>
          </div>
        )}

        {/* Read-Only LGU Inventory Drawer Modal */}
        {isInventoryOpen && (
          <div className="absolute inset-0 z-40 bg-black/50 flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-white rounded-t-[24px] p-5 space-y-4 max-h-[88%] overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center text-[#2500ba]">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900">{effectiveLguName || 'LGU'} Warehouse Stock</h3>
                    <p className="text-[10px] text-gray-500">Live on-hand inventory summary</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInventoryOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Priority Status Badge */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <span className="font-semibold text-gray-600">Restocking Status:</span>
                {(() => {
                  const currentFp = lguStock?.foodPacks ?? 0;
                  if (currentFp < 100) {
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                        Urgent Restocking (&lt;100)
                      </span>
                    );
                  }
                  if (currentFp <= 300) {
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                        Moderate Stock (100-300)
                      </span>
                    );
                  }
                  return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Sufficient Stock (&gt;300)
                    </span>
                  );
                })()}
              </div>

              {/* Read-only Stock Display */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-lg font-black text-blue-900">
                    {lguStock?.foodPacks?.toLocaleString() ?? 0}
                  </p>
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Food Packs</p>
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                  <p className="text-lg font-black text-teal-900">
                    {lguStock?.hygieneKits?.toLocaleString() ?? 0}
                  </p>
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">Hygiene</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <p className="text-lg font-black text-purple-900">
                    {lguStock?.familyKits?.toLocaleString() ?? 0}
                  </p>
                  <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">Family Kits</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-1 text-gray-600 border border-gray-100">
                <p className="font-semibold text-gray-800">
                  Designated Municipality: <span className="text-[#2500ba] font-bold">{effectiveLguName || 'Not specified'}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Accepted incoming shipments automatically increment these live amounts. LGU Receivers act strictly as endpoint recipients.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsInventoryOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
              >
                Close Stock View
              </button>
            </div>
          </div>
        )}

        {/* Accepted Deliveries History Drawer Modal */}
        {isHistoryOpen && (
          <div className="absolute inset-0 z-40 bg-black/50 flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-white rounded-t-[24px] p-5 space-y-4 max-h-[85%] overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900">Accepted Shipments</h3>
                    <p className="text-[10px] text-gray-500">Completed deliveries logged for {effectiveLguName || 'your LGU'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {acceptedReleases.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  <Package size={28} className="mx-auto mb-2 text-gray-300" />
                  <p className="font-bold">No accepted deliveries yet.</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Scan shipment QR codes to accept incoming relief packages.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {acceptedReleases.map((r) => (
                    <div key={r.drNumber} className="pt-2 pb-1 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{r.drNumber}</p>
                        <p className="text-[10px] text-gray-500">{r.fnfiCategory} • {r.amountApproved || r.amountRequested} kits</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Accepted
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
              >
                Close History
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export const LGURecieverPage = LGUReceiverPage;
export const LGUReceiptPage = LGUReceiverPage;

