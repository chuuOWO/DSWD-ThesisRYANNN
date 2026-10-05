'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Layers,
  LocateFixed,
  Minus,
  Package,
  Plus,
  Save,
  ScanLine,
  Settings,
  Truck,
  X
} from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

import type { OutgoingRelease } from '../../hooks/useInventoryState';
import { authApi, type UserProfile } from '../../services/authApi';
import { backendApi, type TruckLiveLocation, type LguRecord } from '../../services/backendApi';
import { findMatchingLgu, normalizeLguName } from '../../lib/lguMatching';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import { ProfileSettingsModal } from '../modals/ProfileSettingsModal';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';

interface LGUReceiverPageProps {
  profile: UserProfile;
  releases: OutgoingRelease[];
  lgusList?: LguRecord[];
  onAccept: (drNumber: string, actorRole?: any, actorLguMunicipality?: string) => Promise<{ ok: boolean; message: string }>;
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
  destinationPos,
  truckPos,
  isPickedUp,
  recenterKey
}: {
  destinationPos: [number, number] | null;
  truckPos?: [number, number] | null;
  isPickedUp: boolean;
  recenterKey: number;
}) {
  const map = useMap();
  const isInitial = useRef(true);

  // Initial bounds: fit between destination and moving truck if picked up, else destination only
  useEffect(() => {
    if (!map) return;
    if (isInitial.current) {
      isInitial.current = false;
      if (isPickedUp && truckPos && isValidCoordinate(truckPos) && destinationPos && isValidCoordinate(destinationPos)) {
        try {
          const bounds = L.latLngBounds([destinationPos, truckPos]);
          map.fitBounds(bounds, { padding: [55, 55], maxZoom: 13, animate: true });
        } catch {}
      } else if (destinationPos && isValidCoordinate(destinationPos)) {
        map.setView(destinationPos, 13, { animate: true });
      }
    }
  }, [destinationPos, truckPos, isPickedUp, map]);

  // Recenter trigger: focus on route or destination
  useEffect(() => {
    if (!map || recenterKey === 0) return;
    if (isPickedUp && truckPos && isValidCoordinate(truckPos) && destinationPos && isValidCoordinate(destinationPos)) {
      try {
        const bounds = L.latLngBounds([destinationPos, truckPos]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true });
      } catch {
        if (destinationPos && isValidCoordinate(destinationPos)) {
          map.setView(destinationPos, 13, { animate: true });
        }
      }
    } else if (destinationPos && isValidCoordinate(destinationPos)) {
      map.setView(destinationPos, 13, { animate: true, duration: 0.8 });
    }
  }, [recenterKey, destinationPos, truckPos, isPickedUp, map]);

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

  // Selected upcoming release index
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (selectedIndex >= upcomingReleases.length) {
      setSelectedIndex(Math.max(0, upcomingReleases.length - 1));
    }
  }, [upcomingReleases.length, selectedIndex]);

  const currentRelease = upcomingReleases[selectedIndex] || upcomingReleases[0] || null;

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

  // Compute live truck position for the selected upcoming delivery (only when picked up)
  const truckLocation = useMemo<[number, number] | null>(() => {
    if (!currentRelease || !isPickedUp) return null;
    const truckId = currentRelease.assignedTruckId;
    if (truckId && liveTruckLocations[truckId]) {
      const t = liveTruckLocations[truckId];
      if (typeof t.latitude === 'number' && typeof t.longitude === 'number') {
        return [t.latitude, t.longitude];
      }
    }
    // Check if any active truck matches
    const firstActive = Object.values(liveTruckLocations)[0];
    if (firstActive && typeof firstActive.latitude === 'number' && typeof firstActive.longitude === 'number') {
      return [firstActive.latitude, firstActive.longitude];
    }
    return null;
  }, [currentRelease, isPickedUp, liveTruckLocations]);

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
    return lguInfo?.lguName || (effectiveLguName ? `${effectiveLguName} Municipal Hall / Evacuation Center` : 'LGU Terminal');
  }, [lguInfo, effectiveLguName]);

  const lguDestinationCoords = useMemo<[number, number] | null>(() => {
    // 1. If release has explicit receiverGps saved, use it
    if (currentRelease?.receiverGps) {
      const parts = currentRelease.receiverGps.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    // 2. Look up municipality from database LGUs
    if (lguInfo && typeof lguInfo.latitude === 'number' && typeof lguInfo.longitude === 'number') {
      return [lguInfo.latitude, lguInfo.longitude];
    }
    return null;
  }, [currentRelease, lguInfo]);

  // Real OSRM Road Route Geometry: Assigned Receiver -> LGU Destination Pin
  const [roadRoute, setRoadRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!isPickedUp || !truckLocation || !lguDestinationCoords) {
      setRoadRoute([]);
      return;
    }

    let isMounted = true;
    const fetchOsrmRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${truckLocation[1]},${truckLocation[0]};${lguDestinationCoords[1]},${lguDestinationCoords[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM network response was not ok');
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
          if (isMounted) {
            setRoadRoute(coords);
          }
          return;
        }
      } catch (err) {
        console.warn('OSRM road route fetch fallback:', err);
      }
      if (isMounted) {
        setRoadRoute([truckLocation, lguDestinationCoords]);
      }
    };

    fetchOsrmRoute();
    return () => {
      isMounted = false;
    };
  }, [isPickedUp, truckLocation?.[0], truckLocation?.[1], lguDestinationCoords?.[0], lguDestinationCoords?.[1]]);

  const routePath = roadRoute;

  // 4. LGU Inventory Drawer State & Supabase Stock
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [lguStock, setLguStock] = useState<{ foodPacks: number; hygieneKits: number; familyKits: number; lastReported?: string } | null>(null);

  // Manage LGU stock states
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [editFoodPacks, setEditFoodPacks] = useState(0);
  const [editHygieneKits, setEditHygieneKits] = useState(0);
  const [editFamilyKits, setEditFamilyKits] = useState(0);

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
        setEditFoodPacks(fp);
        setEditHygieneKits(hk);
        setEditFamilyKits(fk);
      }
    } catch {}
  };

  useEffect(() => {
    loadLguStock();
  }, [targetMuni, effectiveLguName]);

  const handleSaveStock = async () => {
    const muniName = canonicalUserLgu?.municipality || effectiveLguName;
    if (!muniName) {
      setToastMessage({ type: 'error', text: 'No LGU designated for this account.' });
      return;
    }
    const provName = canonicalUserLgu?.province || 'Iloilo';
    setIsSavingStock(true);
    try {
      const fp = Math.max(0, Number(editFoodPacks) || 0);
      const hk = Math.max(0, Number(editHygieneKits) || 0);
      const fk = Math.max(0, Number(editFamilyKits) || 0);

      const urgencyScore = Math.max(10, Math.min(100, Math.round(100 - (fp / 5))));
      const priorityColor: 'Red' | 'Yellow' | 'Green' = fp < 100 ? 'Red' : fp <= 300 ? 'Yellow' : 'Green';
      const recommendation = fp < 100
        ? 'Urgent restocking needed (stock below 100 packs).'
        : fp <= 300
          ? 'Moderate stock levels. Prepare replenishment request.'
          : 'Stock levels sufficient.';

      await backendApi.createLGUInventoryReport({
        municipality: muniName,
        province: provName,
        lguName: `${muniName} Municipal Office`,
        foodPacks: fp,
        hygieneKits: hk,
        familyKits: fk,
        affectedFamilies: 0,
        damageIndex: 0,
        urgencyScore,
        priorityColor,
        recommendation
      });

      setLguStock({
        foodPacks: fp,
        hygieneKits: hk,
        familyKits: fk,
        lastReported: new Date().toISOString()
      });

      setIsEditingStock(false);
      setToastMessage({ type: 'success', text: 'LGU inventory updated and synchronized with Supabase.' });
    } catch (err) {
      setToastMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update LGU stock.' });
    } finally {
      setIsSavingStock(false);
    }
  };

  // 5. Camera QR Scanner & Direct Inventory Acceptance
  const [isScanning, setIsScanning] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Align camera with shipment QR code');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

      // Check if already accepted
      if (matchingRelease?.deliveryStatus === 'Accepted' || locallyAcceptedDrs.includes(canonicalDrNumber.toUpperCase())) {
        setIsProcessing(false);
        setToastMessage({
          type: 'error',
          text: `Shipment ${canonicalDrNumber} has already been received and accepted into ${effectiveLguName || 'LGU'} inventory. This QR code has completed its delivery cycle and is no longer active.`
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

      // OPTION A: STRICT DESTINATION VALIDATION
      // Ensure this LGU only receives shipments assigned to their own municipality
      if (effectiveLguName) {
        const destMuni =
          (matchingRelease && getReleaseDestinationMuni(matchingRelease)) ||
          (rawTo && (findMatchingLgu(dbLgus, rawTo)?.municipality.toLowerCase() || normalizeLguName(rawTo))) ||
          '';

        if (destMuni && targetMuni && destMuni !== targetMuni) {
          const designatedName = findMatchingLgu(dbLgus, destMuni)?.municipality || destMuni || 'another municipality';
          throw new Error(`Mismatched Destination: Shipment ${canonicalDrNumber} is designated for ${designatedName}, not ${canonicalUserLgu?.municipality || effectiveLguName}.`);
        }
      }

      // Resolve authoritative municipality name from database
      const authoritativeLgu = (rawTo && findMatchingLgu(dbLgus, rawTo)) || (matchingRelease?.municipality ? findMatchingLgu(dbLgus, matchingRelease.municipality) : undefined) || canonicalUserLgu;
      const finalMuni = authoritativeLgu?.municipality || canonicalUserLgu?.municipality || effectiveLguName || 'LGU';

      // Capture background GPS location silently for audit log (backend only)
      const receiverGps = await getQuickGpsCoords();

      // Immediately mark as accepted locally so the package leaves the incoming card/map
      setLocallyAcceptedDrs((prev) => [...prev, canonicalDrNumber.toUpperCase()]);

      // Record direct custody acceptance in Supabase
      await backendApi.recordLguReceipt({
        drNumber: canonicalDrNumber,
        lguName: finalMuni,
        municipality: finalMuni,
        category,
        quantity,
        receiverGps,
        receiverSignature: `RECEIVER-QR-${Date.now()}`
      });

      // Update parent inventory state
      await onAccept(canonicalDrNumber, 'LGUReceiver', finalMuni);
      await loadLguStock();

      // Smooth 5-dot modal completes into "Done!"
      setTimeout(() => {
        setIsProcessing(false);
        setToastMessage({
          type: 'success',
          text: `Shipment ${canonicalDrNumber} accepted! Stored ${quantity.toLocaleString()} ${category} into ${finalMuni} inventory.`
        });
      }, 1600);
    } catch (err) {
      setIsProcessing(false);
      setToastMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to record shipment receipt.'
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#e7e6ea] p-0 text-[#15132d] sm:p-5 flex items-center justify-center font-sans">
      {/* Comfy 5-Dot Loading Modal */}
      <FiveDotsLoadingModal
        isOpen={isProcessing}
        title="Processing Delivery Receipt"
        subtitle={`Updating ${effectiveLguName || 'LGU'} warehouse inventory in Supabase...`}
      />

      <section className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-[390px] flex-col overflow-hidden bg-white shadow-xl sm:h-[800px] sm:rounded-[28px] relative">
        {/* Header matching ReceiverPage */}
        <header className="z-10 flex items-center justify-between bg-[#2500ba] px-5 py-3.5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full hover:opacity-90 active:scale-95 transition flex-shrink-0 cursor-pointer ${
                  !profile?.walletAddress
                    ? 'border-2 border-red-500 ring-2 ring-red-400/60 bg-red-950/30'
                    : 'border border-white/70 bg-white/10'
                }`}
                title={!profile?.walletAddress ? "You need to open profile and link it to MetaMask." : "Click to edit profile"}
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
              </button>
              {!profile?.walletAddress && (
                <div className="absolute top-full mt-2 left-0 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-red-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-red-700/60">
                  You need to open profile and link it to MetaMask.
                  <div className="absolute -top-1 left-3 border-4 border-transparent border-b-red-900" />
                </div>
              )}
            </div>
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="cursor-pointer"
              title="Click to edit profile"
            >
              <p className="text-[11px] font-semibold flex items-center gap-1.5 hover:underline">
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

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
              title="Profile Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </header>

        {profile && (
          <ProfileSettingsModal
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
            <div className="flex items-center gap-1.5">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 size={14} className="flex-shrink-0" />
              ) : (
                <AlertCircle size={14} className="flex-shrink-0" />
              )}
              <span className="leading-tight">{toastMessage.text}</span>
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
                destinationPos={lguDestinationCoords}
                truckPos={truckLocation}
                isPickedUp={isPickedUp}
                recenterKey={recenterTrigger}
              />

              {/* 1. Official LGU Destination Pin (Fixed at Sigma / Municipality) */}
              {lguDestinationCoords && isValidCoordinate(lguDestinationCoords) && (
                <Marker
                  position={lguDestinationCoords}
                  icon={destinationPinIcon}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#2500ba]">{effectiveLguName || 'LGU'} Terminal</p>
                      <p className="text-[11px] text-gray-700 mt-0.5">{lguFacilityName}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">
                        {lguDestinationCoords[0].toFixed(5)}, {lguDestinationCoords[1].toFixed(5)}
                      </p>
                      <p className="text-[9.5px] font-semibold text-emerald-600 mt-0.5">
                        Verified LGU Terminal
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* 2. Live En Route Truck Marker (Only when picked up & In Transit) */}
              {isPickedUp && truckLocation && isValidCoordinate(truckLocation) && (
                <Marker
                  position={truckLocation}
                  icon={truckMarkerIcon}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-sky-800">{currentRelease?.drNumber || 'Relief Truck'}</p>
                      <p className="text-[11px] text-gray-700">En Route to {effectiveLguName || 'Destination'}</p>
                      <p className="text-[10px] font-mono text-gray-500">Live GPS position</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* 3. Active Delivery Route Polyline (Only when picked up & In Transit) */}
              {isPickedUp && routePath.length >= 2 && (
                <>
                  <Polyline
                    positions={routePath}
                    pathOptions={{
                      color: '#2500ba',
                      weight: 8,
                      opacity: 0.15
                    }}
                  />
                  <Polyline
                    positions={routePath}
                    pathOptions={{
                      color: '#2500ba',
                      weight: 3.5,
                      opacity: 0.95
                    }}
                  />
                </>
              )}
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

          {/* Floating Package Switcher (if multiple incoming shipments) */}
          {upcomingReleases.length > 1 && (
            <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-md px-2.5 py-1 flex items-center gap-2 text-xs font-bold text-gray-800">
              <button
                type="button"
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                Delivery {selectedIndex + 1} of {upcomingReleases.length}
              </span>
              <button
                type="button"
                disabled={selectedIndex === upcomingReleases.length - 1}
                onClick={() => setSelectedIndex((prev) => Math.min(upcomingReleases.length - 1, prev + 1))}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Bottom Card: Incoming Shipment & Action Button */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-3 bg-gradient-to-t from-black/20 via-transparent to-transparent">
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-200 space-y-3">
              {currentRelease ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-100 text-[#2500ba] font-mono text-[10.5px] font-bold">
                      <Package size={11} />
                      {currentRelease.drNumber}
                    </span>
                    {currentRelease.deliveryStatus === 'Delivered' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Arrived at Terminal
                      </span>
                    ) : isPickedUp ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        In Transit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Still in Warehouse
                      </span>
                    )}
                  </div>

                  <p className="font-extrabold text-sm text-gray-900 leading-tight">
                    {(currentRelease.amountApproved || currentRelease.amountRequested || 0).toLocaleString()} {currentRelease.fnfiCategory}
                  </p>

                  <p className="text-[10.5px] text-gray-500 truncate">
                    {isPickedUp ? (
                      <>Dispatched from {originWarehouseName} &rarr; Destination: <span className="font-bold text-gray-800">{effectiveLguName || 'Your Terminal'}{lguFacilityName ? ` (${lguFacilityName})` : ''}</span></>
                    ) : (
                      <>At {originWarehouseName} (Awaiting receiver pickup scan) &rarr; Destination: <span className="font-bold text-gray-800">{effectiveLguName || 'Your Terminal'}</span></>
                    )}
                  </p>
                </div>
              ) : (
                <div className="text-center py-1">
                  <p className="font-extrabold text-xs text-gray-800">
                    {effectiveLguName ? `No active incoming shipments for ${effectiveLguName}` : 'No municipality selected'}
                  </p>
                  <p className="text-[10.5px] text-gray-500 mt-0.5">
                    {effectiveLguName
                      ? 'Ready to receive packages when trucks arrive at your terminal.'
                      : 'Please select your municipality above to view deliveries.'}
                  </p>
                </div>
              )}

              {/* Main Scan Action Button */}
              <button
                type="button"
                onClick={startCamera}
                className="w-full rounded-xl bg-[#2500ba] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1e0094] active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                <ScanLine size={16} />
                Scan Delivery QR Code to Receive
              </button>

              {/* Auxiliary Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (lguStock) {
                      setEditFoodPacks(lguStock.foodPacks);
                      setEditHygieneKits(lguStock.hygieneKits);
                      setEditFamilyKits(lguStock.familyKits);
                    }
                    setIsEditingStock(false);
                    setIsInventoryOpen(true);
                  }}
                  className="py-1.5 px-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10.5px] font-bold transition flex items-center justify-center gap-1"
                >
                  <Layers size={13} className="text-[#2500ba]" />
                  Manage LGU Stock
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="py-1.5 px-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10.5px] font-bold transition flex items-center justify-center gap-1"
                >
                  <ClipboardList size={13} className="text-emerald-700" />
                  History ({acceptedReleases.length})
                </button>
              </div>
            </div>
          </div>
        </div>

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

        {/* LGU Inventory Drawer Modal */}
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
                    <p className="text-[10px] text-gray-500">Live inventory in Supabase</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingStock && (
                    <button
                      type="button"
                      onClick={() => {
                        if (lguStock) {
                          setEditFoodPacks(lguStock.foodPacks);
                          setEditHygieneKits(lguStock.hygieneKits);
                          setEditFamilyKits(lguStock.familyKits);
                        }
                        setIsEditingStock(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#2500ba]/10 hover:bg-[#2500ba]/20 text-[#2500ba] text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <Edit3 size={12} />
                      Update Stock
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingStock(false);
                      setIsInventoryOpen(false);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Priority Status Badge */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <span className="font-semibold text-gray-600">Restocking Status:</span>
                {(() => {
                  const currentFp = isEditingStock ? editFoodPacks : (lguStock?.foodPacks ?? 0);
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

              {!isEditingStock ? (
                /* Read-only Stock Display */
                <>
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
                      Accepted incoming shipments automatically increment these live amounts. Click &quot;Update Stock&quot; above to report relief distributions or manual counts.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsInventoryOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
                  >
                    Close Stock View
                  </button>
                </>
              ) : (
                /* Editable Stepper Controls */
                <div className="space-y-3">
                  <p className="text-xs text-gray-600">
                    Adjust current on-hand quantities below (e.g. after local relief distribution to barangays):
                  </p>

                  {/* Food Packs Control */}
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">Family Food Packs</p>
                      <p className="text-[10px] text-gray-500">Target baseline: 300+ units</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditFoodPacks(prev => Math.max(0, prev - 10))}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold active:scale-95"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={editFoodPacks}
                        onChange={(e) => setEditFoodPacks(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-8 text-center bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-800 focus:outline-none focus:border-[#2500ba]"
                      />
                      <button
                        type="button"
                        onClick={() => setEditFoodPacks(prev => prev + 10)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Hygiene Kits Control */}
                  <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">Hygiene Kits</p>
                      <p className="text-[10px] text-gray-500">Standard kits</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditHygieneKits(prev => Math.max(0, prev - 10))}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold active:scale-95"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={editHygieneKits}
                        onChange={(e) => setEditHygieneKits(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-8 text-center bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-800 focus:outline-none focus:border-[#2500ba]"
                      />
                      <button
                        type="button"
                        onClick={() => setEditHygieneKits(prev => prev + 10)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Family Kits Control */}
                  <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">Family Kits</p>
                      <p className="text-[10px] text-gray-500">Non-food kits</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditFamilyKits(prev => Math.max(0, prev - 10))}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold active:scale-95"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={editFamilyKits}
                        onChange={(e) => setEditFamilyKits(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 h-8 text-center bg-white border border-gray-300 rounded-lg text-xs font-black text-gray-800 focus:outline-none focus:border-[#2500ba]"
                      />
                      <button
                        type="button"
                        onClick={() => setEditFamilyKits(prev => prev + 10)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingStock(false)}
                      disabled={isSavingStock}
                      className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStock}
                      disabled={isSavingStock}
                      className="flex-[2] py-2.5 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-[#1f009e] transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSavingStock ? (
                        <span>Saving to Supabase...</span>
                      ) : (
                        <>
                          <Save size={14} />
                          <span>Save Stock to Supabase</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
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

