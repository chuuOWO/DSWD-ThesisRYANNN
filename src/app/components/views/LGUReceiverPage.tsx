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
  Menu,
  MapPin,
  Search,
  Calendar,
  Clock,
  Sparkles
} from 'lucide-react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

import type { OutgoingRelease } from '../../hooks/useInventoryState';
import { authApi, type UserProfile } from '../../services/authApi';
import { backendApi, type TruckLiveLocation, type LguRecord } from '../../services/backendApi';
import { findMatchingLgu, normalizeLguName } from '../../lib/lguMatching';
import { getLguStockForCategory, normalizeCategoryName } from '../../lib/lguSync';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import { MobileSettingsModal } from '../modals/MobileSettingsModal';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';
import { formatUserErrorMessage } from '../../lib/errorUtils';
import { formatShipmentReference, formatOutgoingReference, isReplenishCode, formatReplenishReference } from '../../lib/referenceCodeHelper';

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
const GEOFENCE_RADIUS_METERS = 500; // 500 meters geofence radius
const WAREHOUSE_COORDINATES: [number, number] = [10.6975, 122.4764]; // DSWD Regional Warehouse Origin

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

const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const earthRadiusMeters = 6371000;
  const toRadians = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function RoadLockedDeliveryRoute({
  currentPosition,
  destinationPosition
}: {
  currentPosition: [number, number];
  destinationPosition: [number, number];
}) {
  const map = useMap();
  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][] | null>(null);
  const [connectorPoint, setConnectorPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!map || !isValidCoordinate(currentPosition) || !isValidCoordinate(destinationPosition)) {
      setRoadCoordinates(null);
      setConnectorPoint(null);
      return;
    }

    let isMounted = true;
    let control: any = null;

    try {
      control = L.Routing.control({
        waypoints: [
          L.latLng(currentPosition[0], currentPosition[1]),
          L.latLng(destinationPosition[0], destinationPosition[1])
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving'
        }),
        lineOptions: {
          styles: [{ color: '#2500ba', opacity: 0, weight: 0 }],
          extendToWaypoints: false,
          missingRouteTolerance: 0
        },
        addWaypoints: false,
        routeWhileDragging: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        createMarker: () => null
      } as L.Routing.RoutingControlOptions).addTo(map);

      control.on('routesfound', (event: any) => {
        if (!isMounted) return;
        const osrmRoute = event.routes?.[0];
        const rawCoords: L.LatLng[] = osrmRoute?.coordinates ?? [];
        if (rawCoords.length > 0) {
          const coords: [number, number][] = rawCoords.map((c) => [c.lat, c.lng]);
          setRoadCoordinates(coords);

          const firstRoadPoint = coords[0];
          const distMeters = getDistanceMeters(
            currentPosition[0],
            currentPosition[1],
            firstRoadPoint[0],
            firstRoadPoint[1]
          );

          if (distMeters > 15) {
            setConnectorPoint(firstRoadPoint);
          } else {
            setConnectorPoint(null);
          }
        }
      });

      control.on('routingerror', () => {
        if (!isMounted) return;
        setRoadCoordinates([currentPosition, destinationPosition]);
        setConnectorPoint(null);
      });
    } catch {
      if (isMounted) {
        setRoadCoordinates([currentPosition, destinationPosition]);
        setConnectorPoint(null);
      }
    }

    return () => {
      isMounted = false;
      if (control) {
        try {
          map.removeControl(control);
        } catch {}
      }
    };
  }, [map, currentPosition[0], currentPosition[1], destinationPosition[0], destinationPosition[1]]);

  return (
    <>
      {connectorPoint && isValidCoordinate(currentPosition) && isValidCoordinate(connectorPoint) && (
        <Polyline
          positions={[currentPosition, connectorPoint]}
          pathOptions={{
            color: '#2500ba',
            weight: 3.5,
            opacity: 0.9,
            dashArray: '6, 6'
          }}
        />
      )}

      {roadCoordinates && roadCoordinates.length > 0 && (
        <>
          <Polyline
            positions={roadCoordinates}
            pathOptions={{
              color: '#ffffff',
              weight: 8,
              opacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
          <Polyline
            positions={roadCoordinates}
            pathOptions={{
              color: '#2500ba',
              weight: 4.5,
              opacity: 1,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
        </>
      )}
    </>
  );
}

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

// High-accuracy GPS lookup for 500m geofence location enforcement
const getDeviceGpsCoords = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 60000 }
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
  const [lguStock, setLguStock] = useState<{
    foodPacks: number;
    rtef: number;
    hygieneKits: number;
    sleepingKits: number;
    kitchenKits: number;
    familyKits: number;
    laminatedSacks: number;
    stockMap: Record<string, number>;
    lastReported?: string;
  } | null>(null);
  const [lguBatches, setLguBatches] = useState<any[]>([]);
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<'All' | 'Food' | 'Non-Food'>('All');

  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState(false);
  const [discrepancyTargetDr, setDiscrepancyTargetDr] = useState('');
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [isSubmittingDiscrepancy, setIsSubmittingDiscrepancy] = useState(false);

  const loadLguStock = async () => {
    if (!targetMuni) return;
    try {
      const stockMap: Record<string, number> = {};
      let foodPacks = 0;
      let rtef = 0;
      let hygieneKits = 0;
      let sleepingKits = 0;
      let kitchenKits = 0;
      let familyKits = 0;
      let laminatedSacks = 0;
      let lastReported: string | undefined;

      if (canonicalUserLgu?.id) {
        const [v3Stocks, batches] = await Promise.all([
          backendApi.getLguStock(canonicalUserLgu.id).catch(() => []),
          backendApi.getInventoryBatches({ lguId: canonicalUserLgu.id }).catch(() => [])
        ]);

        if (batches && batches.length > 0) {
          setLguBatches(batches);
        }

        if (v3Stocks && v3Stocks.length > 0) {
          lastReported = v3Stocks[0]?.updatedAt;
          v3Stocks.forEach((item) => {
            const rawName = item.kitName || item.kitTypeId || '';
            const canonical = normalizeCategoryName(rawName) || rawName;
            const qty = Number(item.quantity) || 0;
            stockMap[canonical] = (stockMap[canonical] || 0) + qty;
            const nameLower = canonical.toLowerCase();
            if (nameLower.includes('ready-to-eat') || nameLower.includes('rtef')) rtef += qty;
            else if (nameLower.includes('food')) foodPacks += qty;
            else if (nameLower.includes('hygiene')) hygieneKits += qty;
            else if (nameLower.includes('sleeping')) sleepingKits += qty;
            else if (nameLower.includes('kitchen')) kitchenKits += qty;
            else if (nameLower.includes('family')) familyKits += qty;
            else if (nameLower.includes('sack')) laminatedSacks += qty;
          });
        }
      }

      // Merge canonicalUserLgu currentStock if available
      if (canonicalUserLgu?.currentStock) {
        Object.entries(canonicalUserLgu.currentStock).forEach(([cat, val]) => {
          const canonical = normalizeCategoryName(cat) || cat;
          const qty = Number(val) || 0;
          if (!stockMap[canonical]) {
            stockMap[canonical] = qty;
            const nameLower = canonical.toLowerCase();
            if (nameLower.includes('ready-to-eat') || nameLower.includes('rtef')) rtef += qty;
            else if (nameLower.includes('food')) foodPacks += qty;
            else if (nameLower.includes('hygiene')) hygieneKits += qty;
            else if (nameLower.includes('sleeping')) sleepingKits += qty;
            else if (nameLower.includes('kitchen')) kitchenKits += qty;
            else if (nameLower.includes('family')) familyKits += qty;
            else if (nameLower.includes('sack')) laminatedSacks += qty;
          }
        });
      }

      // Fallback to priority reports if no stock rows found
      if (Object.keys(stockMap).length === 0) {
        const reports = await backendApi.getLguPriorityReports(effectiveLguName);
        const matched = reports.find(
          (r) =>
            (r.municipality && findMatchingLgu(dbLgus, r.municipality)?.municipality.toLowerCase() === targetMuni) ||
            (r.lguName && findMatchingLgu(dbLgus, r.lguName)?.municipality.toLowerCase() === targetMuni) ||
            (r.municipality && r.municipality.toLowerCase() === targetMuni) ||
            (r.lguName && r.lguName.toLowerCase().includes(targetMuni))
        );
        if (matched) {
          foodPacks = matched.foodPacks || 0;
          hygieneKits = matched.hygieneKits || 0;
          familyKits = matched.familyKits || 0;
          stockMap['Family Food Pack'] = foodPacks;
          stockMap['Hygiene Kit'] = hygieneKits;
          stockMap['Family Kit'] = familyKits;
          lastReported = matched.reportedAt;
        }
      }

      setLguStock({
        foodPacks,
        rtef,
        hygieneKits,
        sleepingKits,
        kitchenKits,
        familyKits,
        laminatedSacks,
        stockMap,
        lastReported
      });
    } catch {}
  };

  useEffect(() => {
    loadLguStock();
  }, [targetMuni, effectiveLguName, canonicalUserLgu?.id]);

  const lguExpiryLots = useMemo(() => {
    const list: Array<{
      id: string;
      batchTokenId: string;
      commodityName: string;
      quantity: number;
      expirationDate: string;
      daysRemaining: number;
      status: 'expired' | 'critical' | 'warning' | 'moderate' | 'safe';
      drNumber?: string;
      source?: string;
    }> = [];
    const seen = new Set<string>();

    const getDaysRemaining = (expStr?: string | null): number => {
      if (!expStr) return 999;
      const target = new Date(expStr).getTime();
      const now = Date.now();
      return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    };

    // 1. Live database inventory batches for this LGU
    lguBatches.forEach((b) => {
      const token = b.batchTokenId || b.id;
      if (!token || seen.has(token)) return;
      seen.add(token);
      const exp = b.expirationDate;
      const days = getDaysRemaining(exp);
      const status = days <= 0 ? 'expired' : days <= 30 ? 'critical' : days <= 90 ? 'warning' : days <= 120 ? 'moderate' : 'safe';
      list.push({
        id: token,
        batchTokenId: token,
        commodityName: b.kitName || b.kitTypeId || 'Relief Commodity',
        quantity: Number(b.remainingQuantity ?? b.initialQuantity ?? 0),
        expirationDate: exp || 'No date recorded',
        daysRemaining: days,
        status,
        source: 'LGU Warehouse Batch'
      });
    });

    // 2. Batches delivered via verified accepted outgoing releases for this LGU
    acceptedReleases.forEach((r) => {
      let allocs: any = r.allocatedBatches;
      if (typeof allocs === 'string') {
        try { allocs = JSON.parse(allocs); } catch {}
      }
      if (Array.isArray(allocs) && allocs.length > 0) {
        allocs.forEach((a: any, idx: number) => {
          const token = a.batchTokenId || a.batchNumber || `${r.drNumber}-LOT-${idx + 1}`;
          if (seen.has(token)) return;
          seen.add(token);
          const exp = a.expirationDate || (r as any).expirationDate;
          const days = getDaysRemaining(exp);
          const status = days <= 0 ? 'expired' : days <= 30 ? 'critical' : days <= 90 ? 'warning' : days <= 120 ? 'moderate' : 'safe';
          list.push({
            id: token,
            batchTokenId: token,
            commodityName: a.category || r.fnfiCategory || 'Relief Commodity',
            quantity: Number(a.quantity || a.quantityAllocated || 0),
            expirationDate: exp || 'No date recorded',
            daysRemaining: days,
            status,
            drNumber: r.drNumber,
            source: r.warehouseSource || 'Dispatched Consignment'
          });
        });
      } else {
        const token = `DELIVERY-${r.drNumber}`;
        if (!seen.has(token)) {
          seen.add(token);
          const exp = (r as any).expirationDate;
          const days = getDaysRemaining(exp);
          const status = days <= 0 ? 'expired' : days <= 30 ? 'critical' : days <= 90 ? 'warning' : days <= 120 ? 'moderate' : 'safe';
          list.push({
            id: token,
            batchTokenId: token,
            commodityName: r.fnfiCategory || 'Relief Commodity',
            quantity: Number(r.amountApproved || r.amountRequested || 0),
            expirationDate: exp || 'No date recorded',
            daysRemaining: days,
            status,
            drNumber: r.drNumber,
            source: r.warehouseSource || 'Dispatched Consignment'
          });
        }
      }
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [lguBatches, acceptedReleases]);

  const filteredExpiryLots = useMemo(() => {
    return lguExpiryLots.filter((lot) => {
      if (inventoryCategoryFilter === 'Food') {
        const lower = lot.commodityName.toLowerCase();
        if (!lower.includes('food') && !lower.includes('rtef')) return false;
      } else if (inventoryCategoryFilter === 'Non-Food') {
        const lower = lot.commodityName.toLowerCase();
        if (lower.includes('food') || lower.includes('rtef')) return false;
      }
      if (inventorySearchQuery.trim()) {
        const q = inventorySearchQuery.trim().toLowerCase();
        return (
          lot.batchTokenId.toLowerCase().includes(q) ||
          lot.commodityName.toLowerCase().includes(q) ||
          (lot.drNumber && lot.drNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [lguExpiryLots, inventoryCategoryFilter, inventorySearchQuery]);

  const expiryCounts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let moderate = 0;
    let safe = 0;
    lguExpiryLots.forEach((lot) => {
      if (lot.status === 'critical' || lot.status === 'expired') critical++;
      else if (lot.status === 'warning') warning++;
      else if (lot.status === 'moderate') moderate++;
      else safe++;
    });
    return { critical, warning, moderate, safe, total: lguExpiryLots.length };
  }, [lguExpiryLots]);

  // 5. Camera QR Scanner & Direct Inventory Acceptance
  const [isScanning, setIsScanning] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Align camera with shipment QR code');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string; txHash?: string } | null>(null);

  // Geofence Receiving & Inspection Modal States
  const [pendingVerification, setPendingVerification] = useState<{
    drNumber: string;
    category: string;
    quantity: number;
    finalMuni: string;
    matchingRelease: OutgoingRelease | null;
    receiverGpsString: string;
    distanceMeters: number;
    isWarehousePickup: boolean;
    targetFacilityName: string;
    intakeMode?: 'post_dropoff' | 'direct_convoy' | 'warehouse_pickup';
  } | null>(null);
  const [verifiedQuantityInput, setVerifiedQuantityInput] = useState<number>(0);
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [isVerificationSubmitting, setIsVerificationSubmitting] = useState(false);
  const [confirmedDeliveryReceipt, setConfirmedDeliveryReceipt] = useState<{
    drNumber: string;
    category: string;
    quantity: number;
    finalMuni: string;
    txHash: string;
  } | null>(null);

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
      let isDetecting = false;
      let lastScanTime = 0;
      const scan = async () => {
        if (!videoRef.current || !cameraOpenRef.current || !detectorRef.current || isProcessing) return;
        const now = performance.now();
        if (now - lastScanTime >= 150 && !isDetecting) {
          lastScanTime = now;
          isDetecting = true;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              handleScannedPayload(codes[0].rawValue);
              return;
            }
          } catch {
            setCameraMessage('Keep the QR centered in the viewfinder.');
          } finally {
            isDetecting = false;
          }
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
        const upperPayload = rawPayload.trim().toUpperCase();
        if (upperPayload.startsWith('INC-') || upperPayload.startsWith('DR-')) {
          drNumber = upperPayload;
        } else {
          throw new Error('Invalid QR payload format. Please scan a valid shipment QR code.');
        }
      }

      if (!drNumber) {
        throw new Error('QR payload is missing a valid INC Code.');
      }

      // Find matching release in the system (from props or active upcoming)
      const cleanUpper = drNumber.toUpperCase();
      const altUpper = cleanUpper.startsWith('INC-') ? `DR-${cleanUpper.slice(4)}` : (cleanUpper.startsWith('DR-') ? `INC-${cleanUpper.slice(3)}` : cleanUpper);
      const matchingRelease = releases.find((r) => {
        const rUpper = r.drNumber.toUpperCase();
        return rUpper === cleanUpper || rUpper === altUpper;
      }) || ((currentRelease && (currentRelease.drNumber.toUpperCase() === cleanUpper || currentRelease.drNumber.toUpperCase() === altUpper)) ? currentRelease : null);
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

      // CHAIN OF CUSTODY VALIDATION:
      // Allow shipments In Transit / Delivered, as well as direct LGU pickup (Released / Approved / Packed)
      if (matchingRelease) {
        const allowedTransitStatuses = ['In Transit', 'Delivered', 'Released', 'Approved', 'Packed'];
        if (!allowedTransitStatuses.includes(matchingRelease.deliveryStatus)) {
          throw new Error(
            `Shipment ${canonicalDrNumber} is currently "${matchingRelease.deliveryStatus}". It cannot be accepted in its current state.`
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

      // 500-METER GEOFENCE LOCATION ENFORCEMENT:
      // Must check device location against designated LGU drop-off area or warehouse origin
      const currentGps = await getDeviceGpsCoords();
      if (!currentGps) {
        throw new Error('Device GPS Location Required: Satellite geolocation must be enabled to verify you are within 500 meters of the designated area.');
      }

      let targetDropoffCoords: [number, number] | null = null;
      if (matchingRelease?.receiverGps) {
        const [latStr, lngStr] = matchingRelease.receiverGps.split(',').map((s: string) => parseFloat(s.trim()));
        if (!isNaN(latStr) && !isNaN(lngStr)) {
          targetDropoffCoords = [latStr, lngStr];
        }
      }
      if (!targetDropoffCoords && authoritativeLgu?.latitude && authoritativeLgu?.longitude) {
        targetDropoffCoords = [authoritativeLgu.latitude, authoritativeLgu.longitude];
      }
      if (!targetDropoffCoords && canonicalUserLgu?.latitude && canonicalUserLgu?.longitude) {
        targetDropoffCoords = [canonicalUserLgu.latitude, canonicalUserLgu.longitude];
      }

      const distToDropoff = targetDropoffCoords
        ? getDistanceMeters(currentGps.latitude, currentGps.longitude, targetDropoffCoords[0], targetDropoffCoords[1])
        : null;
      const distToWarehouse = getDistanceMeters(
        currentGps.latitude,
        currentGps.longitude,
        WAREHOUSE_COORDINATES[0],
        WAREHOUSE_COORDINATES[1]
      );

      const isWithinDropoff = distToDropoff !== null && distToDropoff <= GEOFENCE_RADIUS_METERS;
      const isWithinWarehouse = distToWarehouse <= GEOFENCE_RADIUS_METERS;
      const isWithinGeofence = isWithinDropoff || isWithinWarehouse;

      if (!isWithinGeofence) {
        const designatedFacility = matchingRelease?.destinationAddress || matchingRelease?.municipality || finalMuni;
        const closestDistance = distToDropoff !== null ? Math.min(distToDropoff, distToWarehouse) : distToWarehouse;
        throw new Error(
          `Geofence Location Check Failed: You must be within ${GEOFENCE_RADIUS_METERS} meters of the designated area (${designatedFacility}) or warehouse pickup site to scan and accept this shipment. Current distance: ${Math.round(closestDistance)} meters.`
        );
      }

      // Geofence verified: Capture coordinates string and launch inspection / verification modal
      const receiverGpsString = `${currentGps.latitude.toFixed(6)}, ${currentGps.longitude.toFixed(6)}`;
      const targetFacilityName = isWithinDropoff
        ? (matchingRelease?.destinationAddress || matchingRelease?.municipality || finalMuni)
        : 'DSWD Regional Warehouse';
      const distanceMeters = isWithinDropoff ? (distToDropoff ?? 0) : distToWarehouse;
      const isWarehousePickupMode = (!isWithinDropoff && isWithinWarehouse) || matchingRelease?.deliveryMode === 'Pick up';
      const isDeliveredMode = matchingRelease?.deliveryStatus === 'Delivered';
      const intakeMode = isWarehousePickupMode
        ? 'warehouse_pickup'
        : isDeliveredMode
        ? 'post_dropoff'
        : 'direct_convoy';

      setPendingVerification({
        drNumber: canonicalDrNumber,
        category,
        quantity,
        finalMuni,
        matchingRelease: matchingRelease || null,
        receiverGpsString,
        distanceMeters,
        isWarehousePickup: isWarehousePickupMode,
        targetFacilityName,
        intakeMode
      });
      setVerifiedQuantityInput(quantity);
      setVerificationRemarks('');
      setIsProcessing(false);
    } catch (err) {
      setIsProcessing(false);
      setToastMessage({
        type: 'error',
        text: formatUserErrorMessage(err, 'Failed to verify shipment scan.')
      });
    }
  };

  const handleConfirmReceipt = async () => {
    if (!pendingVerification) return;
    const { drNumber, category, finalMuni, matchingRelease, receiverGpsString, isWarehousePickup, targetFacilityName } = pendingVerification;
    const effectiveQty = verifiedQuantityInput > 0 ? verifiedQuantityInput : pendingVerification.quantity;

    setIsVerificationSubmitting(true);
    setIsProcessing(true);

    try {
      // Mark DR as locally accepted so UI immediately reflects handover
      setLocallyAcceptedDrs((prev) => [...prev, drNumber.toUpperCase()]);

      // Execute on-chain acceptance through inventory state
      const acceptResult = await onAccept(drNumber, 'LGUReceiver', finalMuni, receiverGpsString);
      if (!acceptResult.ok) {
        throw new Error(acceptResult.message || 'Digital verification receipt failed.');
      }

      const receiptTxHash = (acceptResult as any)?.txHash || '';

      // Record final handover hop note
      const hopNote = isWarehousePickup
        ? `Final custody handover verified and accepted by LGU Receiver at ${targetFacilityName} (Direct Warehouse Pickup).`
        : matchingRelease?.deliveryStatus === 'Delivered'
        ? `Final physical intake verified and accepted by LGU Receiver at ${targetFacilityName} (Post-Drop-Off Delivery). Escort custody fulfilled.`
        : `Final direct intake verified and accepted by LGU Receiver at ${targetFacilityName} (Direct Intake Handover from Convoy ${matchingRelease?.assignedTruckId || 'Truck'}).`;

      const backgroundWrites: Promise<any>[] = [
        backendApi.recordLguReceipt({
          drNumber,
          lguName: finalMuni,
          municipality: finalMuni,
          category,
          quantity: effectiveQty,
          receiverGps: receiverGpsString,
          receiverSignature: receiptTxHash || `LGU-RECEIVER-${Date.now()}`,
          txHash: receiptTxHash
        }),
        backendApi.recordCustodyHop({
          outgoingRequestId: matchingRelease?.id || drNumber,
          sequence: 99,
          fromDriverProfileId: matchingRelease?.assignedDriverProfileId || undefined,
          toDriverProfileId: profile.id,
          fromTruckId: matchingRelease?.assignedTruckId || undefined,
          gpsCoordinates: receiverGpsString,
          blockchainTxHash: receiptTxHash,
          notes: hopNote
        }).catch(() => {}),
        backendApi.appendStockLedger({
          movementType: 'LGU_RECEIVED',
          outgoingRequestId: matchingRelease?.id,
          drNumber,
          destinationLguId: matchingRelease?.destinationLguId || matchingRelease?.lguId,
          quantityChange: effectiveQty,
          referenceTable: 'lgu_inventory_reports',
          referenceId: drNumber,
          gpsCoordinates: receiverGpsString,
          blockchainTxHash: receiptTxHash,
          performedByProfileId: profile.id,
          notes: `Physical relief goods received and verified on-site at ${targetFacilityName}`
        }).catch(() => {})
      ];

      // If discrepancy or inspection notes present, submit discrepancy report
      if (verificationRemarks.trim() || effectiveQty !== pendingVerification.quantity) {
        const noteText = [
          effectiveQty !== pendingVerification.quantity
            ? `Receipt verified count ${effectiveQty} vs manifest ${pendingVerification.quantity}.`
            : '',
          verificationRemarks.trim()
        ].filter(Boolean).join(' ');

        backgroundWrites.push(
          backendApi.createDiscrepancyReport({
            reportType: 'Outgoing',
            drNumber,
            note: noteText,
            reportedByRole: 'LGU Receiver',
            reportedByWallet: profile?.walletAddress || undefined,
            reportedByProfileId: profile?.id
          }).catch(() => {})
        );
      }

      // Clean up truck live location since delivery is finalized
      const deliveredTruckId = matchingRelease?.assignedTruckId || (matchingRelease as any)?.assigned_truck_id;
      if (deliveredTruckId) {
        backgroundWrites.push(backendApi.markTruckLiveLocationDone(deliveredTruckId, drNumber).catch(() => {}));
      }
      backgroundWrites.push(backendApi.markTruckLiveLocationDoneByDr(drNumber).catch(() => {}));

      await Promise.all(backgroundWrites);
      loadLguStock().catch(() => {});

      setConfirmedDeliveryReceipt({
        drNumber,
        category,
        quantity: effectiveQty,
        finalMuni,
        txHash: receiptTxHash
      });
      setPendingVerification(null);
    } catch (err) {
      console.error('Acceptance execution failed:', err);
      setToastMessage({
        type: 'error',
        text: formatUserErrorMessage(err, 'Failed to complete receipt verification.')
      });
    } finally {
      setIsVerificationSubmitting(false);
      setIsProcessing(false);
    }
  };

  return (
    <main className="h-[100dvh] w-full bg-[#e7e6ea] p-0 text-[#15132d] sm:p-4 md:p-6 flex items-center justify-center font-sans overflow-hidden">
      {/* Comfy 5-Dot Loading Modal */}
      <FiveDotsLoadingModal
        isOpen={isProcessing}
        title="Processing Receipt Verification"
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
                <span>LGU Receiver Portal</span>
                <span className="text-[8.5px] bg-white/20 px-1 py-0.2 rounded font-mono">Terminal</span>
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
                  Package is at {originWarehouseName}, preparing to be scanned by the assigned Relief Escort Officer.
                </p>
              </div>
            </div>
            <span className="text-[8.5px] bg-amber-700/90 text-white px-2 py-0.5 rounded font-extrabold uppercase tracking-wide flex-shrink-0 ml-2">
              Awaiting Escort Scan
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
                  <span>Digital Audit ({toastMessage.txHash.slice(0, 6)}...{toastMessage.txHash.slice(-4)})</span>
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

              {/* LGU Destination Geofence Zone Circle */}
              {lguDestinationCoords && (
                <Circle
                  center={lguDestinationCoords}
                  radius={GEOFENCE_RADIUS_METERS}
                  pathOptions={{
                    color: '#059669',
                    fillColor: '#10b981',
                    fillOpacity: 0.10,
                    dashArray: '6, 6',
                    weight: 2
                  }}
                />
              )}

              {/* Admin Drop-Off Pins & Geofence Circles (strictly receiverGps placed by admin) */}
              {incomingAdminPins.map(({ release, coords }) => (
                <React.Fragment key={`admin-pin-${release.drNumber}`}>
                  <Circle
                    center={coords}
                    radius={GEOFENCE_RADIUS_METERS}
                    pathOptions={{
                      color: '#2500ba',
                      fillColor: '#3b82f6',
                      fillOpacity: 0.12,
                      dashArray: '6, 6',
                      weight: 2
                    }}
                  >
                    <Popup>
                      <div className="text-center font-sans p-1">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase">Drop-Off Geofence Zone ({GEOFENCE_RADIUS_METERS}m)</p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5">{release.destinationAddress || release.municipality || effectiveLguName}</p>
                        <p className="text-[10px] text-gray-500 font-mono">INC #{release.drNumber}</p>
                      </div>
                    </Popup>
                  </Circle>
                  <Marker
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
                </React.Fragment>
              ))}

              {/* Active En Route Trucks Delivering to this LGU */}
              {incomingTrucks.map(({ release, truckId, coords, dropOffCoords }) => {
                const isNearDropOff = dropOffCoords
                  ? getDistanceMeters(coords[0], coords[1], dropOffCoords[0], dropOffCoords[1]) <= GEOFENCE_RADIUS_METERS
                  : false;
                return (
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
                          <p className={`text-[9.5px] font-bold ${isNearDropOff ? 'text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded' : 'text-emerald-600'}`}>
                            {isNearDropOff ? 'Inside Drop-Off Geofence' : `En Route to ${effectiveLguName || 'Destination'}`}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                    {dropOffCoords && (
                      <RoadLockedDeliveryRoute
                        currentPosition={coords}
                        destinationPosition={dropOffCoords}
                      />
                    )}
                  </React.Fragment>
                );
              })}
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
                      <span className="text-[9.5px] font-bold text-purple-900 uppercase tracking-wide">Digital Verification Account</span>
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
                        Source: {r.warehouseSource || 'DSWD Logistics Hub'} &bull; Convoy: {r.assignedTruckId || 'Pending'} &bull; Escort: {r.assignedDriverProfileId || r.assignedEscortProfileId ? 'Assigned' : 'Pending'}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUpcomingDeliveriesOpen(false);
                            startCamera();
                          }}
                          className="text-[10px] font-bold text-[#2500ba] hover:text-blue-800 transition flex items-center gap-1 cursor-pointer"
                        >
                          <ScanLine size={12} />
                          <span>Scan to Receive / Drop Off</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscrepancyTargetDr(r.drNumber);
                            setIsDiscrepancyModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition flex items-center gap-1 cursor-pointer"
                        >
                          <AlertTriangle size={11} />
                          <span>Report Issue</span>
                        </button>
                      </div>
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

              {/* 7 Commodities Stock Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Commodity Balances</h4>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Total On-Hand: {((lguStock?.foodPacks || 0) + (lguStock?.rtef || 0) + (lguStock?.hygieneKits || 0) + (lguStock?.sleepingKits || 0) + (lguStock?.kitchenKits || 0) + (lguStock?.familyKits || 0) + (lguStock?.laminatedSacks || 0)).toLocaleString()} units
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide truncate">Family Food Pack</p>
                    <p className="text-base font-black text-blue-900 mt-0.5">
                      {lguStock?.foodPacks?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-blue-600/80 font-medium">Food Relief</span>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide truncate">Ready-to-Eat Food</p>
                    <p className="text-base font-black text-amber-900 mt-0.5">
                      {lguStock?.rtef?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-amber-600/80 font-medium">Emergency Rations</span>
                  </div>

                  <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-2.5">
                    <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide truncate">Hygiene Kit</p>
                    <p className="text-base font-black text-teal-900 mt-0.5">
                      {lguStock?.hygieneKits?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-teal-600/80 font-medium">Sanitation</span>
                  </div>

                  <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-2.5">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide truncate">Sleeping Kit</p>
                    <p className="text-base font-black text-indigo-900 mt-0.5">
                      {lguStock?.sleepingKits?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-indigo-600/80 font-medium">Bedding & Mats</span>
                  </div>

                  <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-2.5">
                    <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide truncate">Kitchen Kit</p>
                    <p className="text-base font-black text-orange-900 mt-0.5">
                      {lguStock?.kitchenKits?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-orange-600/80 font-medium">Cooking Ware</span>
                  </div>

                  <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-2.5">
                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide truncate">Family Kit</p>
                    <p className="text-base font-black text-purple-900 mt-0.5">
                      {lguStock?.familyKits?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-purple-600/80 font-medium">Clothing & Living</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 col-span-2 sm:col-span-2">
                    <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wide truncate">Laminated Sacks</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">
                      {lguStock?.laminatedSacks?.toLocaleString() ?? 0}
                    </p>
                    <span className="text-[9px] text-slate-600 font-medium">Shelter & Storage</span>
                  </div>
                </div>
              </div>

              {/* Detailed FEFO Expiration & Batch Ledger */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-[#2500ba]" />
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Batch Expiry &amp; Stock Ledger
                    </h4>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {filteredExpiryLots.length} lot{filteredExpiryLots.length === 1 ? '' : 's'} tracked
                  </span>
                </div>

                {/* Expiry Risk Counter Badges */}
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <div className="bg-rose-50 border border-rose-200 rounded-lg py-1 px-1.5">
                    <p className="font-extrabold text-rose-700">{expiryCounts.critical}</p>
                    <p className="text-[8px] font-semibold text-rose-600 truncate">&le; 30d Critical</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg py-1 px-1.5">
                    <p className="font-extrabold text-amber-700">{expiryCounts.warning}</p>
                    <p className="text-[8px] font-semibold text-amber-600 truncate">31-90d Warning</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg py-1 px-1.5">
                    <p className="font-extrabold text-blue-700">{expiryCounts.moderate}</p>
                    <p className="text-[8px] font-semibold text-blue-600 truncate">91-120d Moderate</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg py-1 px-1.5">
                    <p className="font-extrabold text-emerald-700">{expiryCounts.safe}</p>
                    <p className="text-[8px] font-semibold text-emerald-600 truncate">&gt; 120d Safe</p>
                  </div>
                </div>

                {/* Search & Category Filter Controls */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={inventorySearchQuery}
                      onChange={(e) => setInventorySearchQuery(e.target.value)}
                      placeholder="Search batch token, commodity, or INC code..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba] focus:border-[#2500ba]"
                    />
                    {inventorySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setInventorySearchQuery('')}
                        className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['All', 'Food', 'Non-Food'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setInventoryCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
                          inventoryCategoryFilter === cat
                            ? 'bg-[#2500ba] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Batch Lots List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {filteredExpiryLots.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                      <Package size={22} className="mx-auto text-gray-300 mb-1" />
                      <p className="text-xs font-semibold text-gray-500">No batch lots match current filters.</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Delivered consignments and recorded stock batches will show expiry details here.
                      </p>
                    </div>
                  ) : (
                    filteredExpiryLots.map((lot) => {
                      const badgeColor =
                        lot.status === 'expired' || lot.status === 'critical'
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : lot.status === 'warning'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : lot.status === 'moderate'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200';

                      const countdownText =
                        lot.daysRemaining <= 0
                          ? 'EXPIRED'
                          : lot.daysRemaining === 999
                          ? 'No Date Set'
                          : `${lot.daysRemaining}d remaining`;

                      return (
                        <div
                          key={lot.id}
                          className="p-2.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-gray-900 text-xs truncate">
                              {lot.commodityName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider shrink-0 ${badgeColor}`}>
                              {countdownText}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-600">
                            <div className="flex items-center gap-1 font-mono text-[10px] text-[#2500ba] font-bold truncate max-w-[60%] bg-blue-50/60 px-1.5 py-0.5 rounded border border-blue-100">
                              <span>Lot:</span>
                              <span className="truncate">{lot.batchTokenId}</span>
                            </div>
                            <span className="font-extrabold text-gray-900 shrink-0">
                              {lot.quantity.toLocaleString()} units
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                            <span className="flex items-center gap-1 truncate">
                              <Calendar size={11} className="text-gray-400 shrink-0" />
                              <span>Exp: {lot.expirationDate}</span>
                            </span>
                            <span className="truncate text-[9px] text-gray-400">
                              {lot.drNumber ? formatShipmentReference(lot.drNumber) : lot.source || 'Local Stock'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-1 text-gray-600 border border-gray-100">
                <p className="font-semibold text-gray-800">
                  Designated Municipality: <span className="text-[#2500ba] font-bold">{effectiveLguName || 'Not specified'}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Accepted incoming shipments automatically increment these live amounts. Prioritize releasing batches with the nearest expiration date when distributing relief goods to beneficiaries.
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
                    <div key={r.drNumber} className="pt-2 pb-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{r.drNumber}</p>
                          <p className="text-[10px] text-gray-500">{r.fnfiCategory} • {r.amountApproved || r.amountRequested} kits</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Accepted
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscrepancyTargetDr(r.drNumber);
                              setIsDiscrepancyModalOpen(true);
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                            title="Report damage or shortage"
                          >
                            <AlertTriangle size={13} />
                          </button>
                        </div>
                      </div>
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

        {/* Discrepancy Reporting Modal */}
        {isDiscrepancyModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900">Report Discrepancy</h3>
                    <p className="text-[10px] text-gray-500 font-mono">{discrepancyTargetDr}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsDiscrepancyModalOpen(false);
                    setDiscrepancyNote('');
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-gray-700 block">
                  Discrepancy / Damage Details:
                </label>
                <textarea
                  value={discrepancyNote}
                  onChange={(e) => setDiscrepancyNote(e.target.value)}
                  placeholder="e.g., Package arrived with water damage; 8 relief food packs unsealed or missing from batch count."
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none min-h-[90px]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDiscrepancyModalOpen(false);
                    setDiscrepancyNote('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDiscrepancy || !discrepancyNote.trim()}
                  onClick={async () => {
                    if (!discrepancyNote.trim()) return;
                    setIsSubmittingDiscrepancy(true);
                    try {
                      await backendApi.createDiscrepancyReport({
                        reportType: 'Outgoing',
                        drNumber: discrepancyTargetDr,
                        note: discrepancyNote.trim(),
                        reportedByRole: 'LGU Receiver',
                        reportedByWallet: profile?.walletAddress || undefined,
                        reportedByProfileId: profile?.id
                      });
                      await backendApi.logActivity({
                        action: 'DISCREPANCY_REPORTED',
                        entityType: 'OutgoingRelease',
                        entityId: discrepancyTargetDr,
                        details: `LGU Receiver (${profile?.fullName || effectiveLguName}) reported discrepancy: ${discrepancyNote.trim()}`,
                        actorId: profile?.id,
                        actorName: profile?.fullName || 'LGU Officer',
                        actorRole: 'LGU Receiver'
                      }).catch(() => {});
                      setIsDiscrepancyModalOpen(false);
                      setDiscrepancyNote('');
                      setToastMessage({
                        type: 'success',
                        text: `Discrepancy report recorded for ${discrepancyTargetDr}.`
                      });
                    } catch (e: any) {
                      setToastMessage({
                        type: 'error',
                        text: e.message || 'Failed to submit discrepancy report.'
                      });
                    } finally {
                      setIsSubmittingDiscrepancy(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition"
                >
                  {isSubmittingDiscrepancy ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Geofence Receiving & Inspection Modal (Matching Field Drop-Off / Receiving Layout) */}
        {pendingVerification && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm max-h-[94%] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setPendingVerification(null)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
              <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-3">
                <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="text-center text-sm font-bold text-gray-900">
                  Confirm Shipment Receipt & Verification
                </h2>

                {/* Geofence Status Badge */}
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">
                        {pendingVerification.isWarehousePickup
                          ? 'Within Warehouse Pickup Geofence'
                          : pendingVerification.matchingRelease?.deliveryStatus === 'Delivered'
                          ? 'Within Drop-Off Geofence (Post-Drop-Off Intake)'
                          : 'Within Drop-Off Geofence (Direct Convoy Handover)'}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-mono">
                        GPS Verified • ±{Math.round(pendingVerification.distanceMeters)}m to {pendingVerification.targetFacilityName}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-extrabold text-[9.5px] uppercase tracking-wide">
                    500m Verified
                  </span>
                </div>

                {/* Package & Shipment Details Card */}
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1.5 text-xs text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-950 text-xs tracking-tight">
                      Shipment {pendingVerification.drNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-900 font-bold text-[10px]">
                      {pendingVerification.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-blue-900">
                    <MapPin size={12} className="text-red-500 shrink-0" />
                    <span className="truncate font-semibold">
                      Receiving Endpoint: {pendingVerification.finalMuni}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">
                    Origin: {pendingVerification.matchingRelease?.warehouseSource || 'DSWD Logistics Hub'}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    Mode: {pendingVerification.isWarehousePickup
                      ? 'Direct Warehouse Pickup (LGU Retrieval)'
                      : pendingVerification.matchingRelease?.deliveryStatus === 'Delivered'
                      ? `Physical Intake (Delivered by Escort - Convoy ${pendingVerification.matchingRelease?.assignedTruckId || 'Vehicle'})`
                      : `Direct Intake Handover (from Convoy ${pendingVerification.matchingRelease?.assignedTruckId || 'Vehicle'})`}
                  </p>
                </div>

                {/* Physical Package Count Verification */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    Verified Received Package Count
                  </label>
                  <p className="text-[9.5px] text-gray-500 mb-2">
                    Manifest: {pendingVerification.quantity} units. Confirm physical items received in good order.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setVerifiedQuantityInput((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-extrabold text-xl flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={verifiedQuantityInput || ''}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '');
                        const val = cleaned ? parseInt(cleaned, 10) : 0;
                        setVerifiedQuantityInput(val);
                      }}
                      className="w-24 text-center font-mono font-extrabold text-xl py-2 px-2 border-2 border-emerald-600 rounded-xl text-emerald-800 bg-white focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setVerifiedQuantityInput((prev) => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xl flex items-center justify-center shadow-md transition active:scale-95 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Inspection Remarks */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-left">
                  <label className="block text-[11px] font-bold text-gray-800 mb-1">
                    Inspection & Receiving Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={verificationRemarks}
                    onChange={(e) => setVerificationRemarks(e.target.value)}
                    placeholder="e.g. Received in good condition by MSWDO staff. Outer seals intact."
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-emerald-600 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingVerification(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isVerificationSubmitting}
                    onClick={() => void handleConfirmReceipt()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>Confirm Receipt &amp; Sign Verification</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Receipt Confirmed Success Modal */}
        {confirmedDeliveryReceipt && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden p-5 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Shipment Intake Confirmed!</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Physical handover verified with digital audit record.
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Shipment:</span>
                  <span className="font-mono font-bold text-gray-900">{formatShipmentReference(confirmedDeliveryReceipt.drNumber)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Verified Units:</span>
                  <span className="font-bold text-emerald-700">{confirmedDeliveryReceipt.quantity} {confirmedDeliveryReceipt.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold">Endpoint:</span>
                  <span className="font-bold text-gray-800">{confirmedDeliveryReceipt.finalMuni}</span>
                </div>
              </div>
              {confirmedDeliveryReceipt.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${confirmedDeliveryReceipt.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-50 border border-blue-200 text-[11px] font-mono text-[#2500ba] font-bold hover:bg-blue-100 transition"
                >
                  <ShieldCheck size={14} className="text-[#2500ba]" />
                  <span>Audit Record: {confirmedDeliveryReceipt.txHash.slice(0, 8)}...{confirmedDeliveryReceipt.txHash.slice(-6)}</span>
                  <ExternalLink size={12} className="text-[#2500ba]" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setConfirmedDeliveryReceipt(null)}
                className="w-full py-2.5 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 transition cursor-pointer"
              >
                Done
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

