'use client';

import { Component, Fragment, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Home,
  Loader2,
  LocateFixed,
  MapPin,
  Package,
  Radio,
  ScanLine,
  Settings,
  ShieldCheck,
  Smartphone,
  Truck,
  UserRound,
  Trash2,
  X,
  ExternalLink
} from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

import type { UserProfile } from '../../services/authApi';
import { backendApi, type ReceiverReleaseRecord } from '../../services/backendApi';
import { blockchain } from '../../services/blockchain';
import { findPanayLgu } from '../../data/panayLguDirectory';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import { ProfileSettingsModal } from '../modals/ProfileSettingsModal';
import { sanitizeNumbersOnly } from '../../lib/inputValidation';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';

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

type Step = 'pickup' | 'scan' | 'sign_custody' | 'verify' | 'inventory' | 'success' | 'arrived' | 'profile';
type Inventory = { batchTokenId: string; category: string; quantity: number; status: string; remarks: string };
type PhoneLocation = { latitude: number; longitude: number; accuracy?: number | null; timestamp: string };
type QrPayload = {
  drNumber: string;
  handoverContractId: string;
  category: string;
  quantity: number;
  batchTokenIds: string[];
  batchQuantities: number[];
  from: string;
  to: string;
  destinationCoords?: [number, number];
};

const initialInventory: Inventory = {
  batchTokenId: '',
  category: 'Relief Goods',
  quantity: 0,
  status: 'Waiting for pickup scan',
  remarks: ''
};

const DEFAULT_PANAY_BOUNDS_CENTER: [number, number] = [10.9000, 122.5000];

const createDestinationPinIcon = (isSelectedOrLabel?: boolean | string, maybeSelected?: boolean) => {
  return L.divIcon({
    className: 'destination-marker-pin',
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
};

const createDriverVehicleIcon = (accuracy?: number | null) => L.divIcon({
  className: 'driver-vehicle-puck',
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

const destinationPinIcon = createDestinationPinIcon(true);

const formatGps = (location: PhoneLocation) => `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
const formatCoordinate = (value: number) => value.toFixed(6);

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

const smoothCoordinate = (prev: number, next: number, alpha = 0.6) => {
  if (typeof prev !== 'number' || isNaN(prev)) return next;
  if (typeof next !== 'number' || isNaN(next)) return prev;
  return prev + alpha * (next - prev);
};

const parseQrPayload = (value: string): QrPayload => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('QR code is empty.');

  // 1. Check if the value is a URL (MetaMask Universal Link or HTTP/HTTPS)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('metamask://')) {
    try {
      const urlQueryIndex = trimmed.indexOf('?');
      if (urlQueryIndex !== -1) {
        const queryString = trimmed.slice(urlQueryIndex + 1);
        const params = new URLSearchParams(queryString);

        // Check for full JSON payload in 'data' or 'payload'
        const rawData = params.get('data') || params.get('payload');
        if (rawData) {
          try {
            const parsed = JSON.parse(decodeURIComponent(rawData));
            if (parsed && typeof parsed.drNumber === 'string') {
              return parseQrPayload(JSON.stringify(parsed));
            }
          } catch {}
        }

        // Check for 'dr' or 'drNumber' param
        const drParam = params.get('dr') || params.get('drNumber');
        if (drParam) {
          const qty = Number(params.get('qty') || 100);
          return {
            drNumber: drParam,
            handoverContractId: `HANDOVER-${drParam.replace('DR-', '')}`,
            category: params.get('cat') || 'Food Pack',
            quantity: qty,
            batchTokenIds: [`BATCH-${drParam}`],
            batchQuantities: [qty],
            from: params.get('from') || 'DSWD Logistics Hub',
            to: params.get('to') || 'Assigned LGU'
          };
        }
      }
    } catch {}
  }

  // 2. Standard JSON manifest parsing
  try {
    const data = JSON.parse(trimmed) as Partial<QrPayload>;
    const batchTokenIds = Array.isArray(data.batchTokenIds) && data.batchTokenIds.length ? data.batchTokenIds.map(String) : [`BATCH-${data.drNumber || 'MANIFEST'}`];
    const batchQuantities = Array.isArray(data.batchQuantities) && data.batchQuantities.length ? data.batchQuantities.map(Number) : [Number(data.quantity ?? 1)];

    if (!data.drNumber) {
      throw new Error('QR code does not contain a DR number.');
    }

    const destinationCoords = Array.isArray(data.destinationCoords) && isValidCoordinate(data.destinationCoords as any)
      ? [Number(data.destinationCoords[0]), Number(data.destinationCoords[1])] as [number, number]
      : undefined;

    return {
      drNumber: String(data.drNumber),
      handoverContractId: String(data.handoverContractId || `HANDOVER-${data.drNumber}`),
      category: String(data.category || 'Relief Goods'),
      quantity: Number(data.quantity ?? (batchQuantities.reduce((sum, amount) => sum + amount, 0) || 1)),
      batchTokenIds,
      batchQuantities,
      from: String(data.from || 'DSWD Oton Main Warehouse'),
      to: String(data.to || 'Assigned LGU'),
      destinationCoords
    };
  } catch (err) {
    if (trimmed.startsWith('DR-') || trimmed.startsWith('INC-')) {
      return {
        drNumber: trimmed,
        handoverContractId: `HANDOVER-${trimmed}`,
        category: 'Relief Goods',
        quantity: 1,
        batchTokenIds: [`BATCH-${trimmed}`],
        batchQuantities: [1],
        from: 'DSWD Oton Main Warehouse',
        to: 'Assigned LGU'
      };
    }
    throw new Error(err instanceof Error ? err.message : 'Invalid QR code format. Please scan a valid shipment QR code.');
  }
};

const getBrowserLocation = () =>
  new Promise<PhoneLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support GPS location.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          reject(new Error('Invalid GPS coordinates received.'));
          return;
        }
        resolve({
          latitude: lat,
          longitude: lng,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        });
      },
      (error) => reject(new Error(error.message || 'GPS permission denied on mobile device.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  });

const releaseToPayload = (release: ReceiverReleaseRecord): QrPayload => {
  const allocatedBatches = release.allocated_batches ?? [];
  let destinationCoords: [number, number] | undefined = undefined;
  if (release.receiver_gps) {
    const parts = release.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      destinationCoords = [parts[0], parts[1]];
    }
  }
  if (!destinationCoords) {
    const lguLookup = findPanayLgu(
      release.destination_address || release.lgu_name || release.municipality || '',
      release.province || undefined
    );
    if (lguLookup) {
      destinationCoords = [lguLookup.lat, lguLookup.lng];
    }
  }

  return {
    drNumber: release.dr_number,
    handoverContractId: release.handover_contract_id || `HANDOVER-${release.dr_number}`,
    category: release.category || 'Relief Goods',
    quantity: Number(release.amount_approved ?? release.amount_requested ?? 1),
    batchTokenIds: allocatedBatches.map((batch) => String(batch.batchTokenId || '')).filter(Boolean),
    batchQuantities: allocatedBatches.map((batch) => Number(batch.quantity ?? 0)).filter((quantity) => quantity > 0),
    from: release.warehouse_source || 'DSWD Oton Main Warehouse',
    to: release.destination_address || release.lgu_name || release.municipality || 'Assigned LGU',
    destinationCoords
  };
};

function MapController({
  center,
  destination,
  recenterKey,
  fitRouteTrigger
}: {
  center: [number, number] | null;
  destination?: [number, number] | null;
  recenterKey: number;
  fitRouteTrigger?: number;
}) {
  const map = useMap();
  const isInitialMount = useRef(true);

  // 1. Auto-fit bounds whenever center & destination are valid, or center on whichever is available
  useEffect(() => {
    if (!map) return;
    if (center && isValidCoordinate(center) && destination && isValidCoordinate(destination)) {
      try {
        const bounds = L.latLngBounds([center, destination]);
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 14,
          animate: true,
          duration: 1.2
        });
      } catch {}
    } else if (center && isValidCoordinate(center)) {
      try {
        map.setView(center, 15, { animate: true, duration: 1.0 });
      } catch {}
    } else if (destination && isValidCoordinate(destination)) {
      try {
        map.setView(destination, 14, { animate: true, duration: 1.0 });
      } catch {}
    }
  }, [map, destination?.[0], destination?.[1], center?.[0], center?.[1], fitRouteTrigger]);

  // 2. Recenter on driver when recenter button is clicked
  useEffect(() => {
    if (!map || recenterKey === 0 || !center || !isValidCoordinate(center)) return;
    try {
      map.setView(center, 15, { animate: true, duration: 0.8 });
    } catch {}
  }, [recenterKey, center, map]);

  // 3. Smooth follow when driver moves > 35m
  useEffect(() => {
    if (!map || !center || !isValidCoordinate(center)) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      const currentCenter = map.getCenter();
      if (currentCenter) {
        const dist = getDistanceMeters(currentCenter.lat, currentCenter.lng, center[0], center[1]);
        if (dist > 35) {
          map.panTo(center, { animate: true, duration: 1.0 });
        }
      }
    } catch {}
  }, [center, map]);

  return null;
}

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

          // Check first road point distance from currentPosition
          const firstRoadPoint = coords[0];
          const distMeters = getDistanceMeters(
            currentPosition[0],
            currentPosition[1],
            firstRoadPoint[0],
            firstRoadPoint[1]
          );

          // If off-road (> 15 meters), draw dashed connector line to the nearest road entry
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
      {/* 1. Dashed Off-Road Connector to the nearest road entrance */}
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

      {/* 2. Solid Road-Locked Path along the streets/highways to the destination */}
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

const getReceiverIdentifier = (profile?: UserProfile | null) => {
  if (profile?.truckId && profile.truckId.trim()) return profile.truckId.trim();
  if (profile?.fullName && profile.fullName.trim()) return profile.fullName.trim().replace(/\s+/g, '-').toUpperCase();
  if (profile?.email && profile.email.trim()) return profile.email.split('@')[0].toUpperCase();
  if (profile?.id) return `RCVR-${profile.id.slice(0, 6).toUpperCase()}`;
  return 'DRIVER';
};

interface ErrorBoundaryProps {
  children: ReactNode;
  receiverId?: string;
  onSignOut?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ReceiverErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ReceiverPage ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    try {
      if (this.props.receiverId) {
        localStorage.removeItem(`trucker_active_packages_${this.props.receiverId}`);
        localStorage.removeItem(`trucker_active_delivery_${this.props.receiverId}`);
      }
      localStorage.removeItem('trucker_active_delivery_TRK-001');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#e7e6ea] p-4 flex items-center justify-center font-sans">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Truck size={28} />
            </div>
            <h2 className="text-base font-bold text-gray-800">Receiver View Recovered</h2>
            <p className="text-xs text-gray-500">
              An unexpected render error occurred. You can safely reload the map or clear saved state.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full rounded-xl bg-[#2500ba] py-2.5 text-xs font-bold text-white shadow hover:bg-blue-800 transition"
              >
                Reload Map View
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full rounded-xl border border-gray-300 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Clear Saved Data & Refresh
              </button>
              {this.props.onSignOut && (
                <button
                  type="button"
                  onClick={this.props.onSignOut}
                  className="w-full rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white hover:bg-red-600 transition"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

const checkIsMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
  const isTouchScreen = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 1024;
  return isMobileUA || isTouchScreen;
};

export interface ReceiverPageProps {
  profile?: UserProfile | null;
  onSignOut?: () => void;
}

export function ReceiverPage(props: ReceiverPageProps) {
  const receiverId = useMemo(() => getReceiverIdentifier(props.profile), [props.profile]);
  const [isMobile, setIsMobile] = useState(checkIsMobileDevice);
  const [devBypassMobile, setDevBypassMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(checkIsMobileDevice());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isMobile && !devBypassMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-400/30 shadow-inner">
            <Smartphone className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">Smartphone Required</h2>
          <p className="text-xs text-slate-300 mb-6 leading-relaxed">
            The <strong>Receiver GPS Module</strong> requires mobile hardware GNSS / satellite sensors. 
            Laptops and desktop computers do not have GPS chips and report inaccurate IP routing (e.g. Manila telecom hubs).
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left text-xs space-y-2.5 text-slate-300">
            <div className="flex items-center gap-2 font-bold text-white">
              <MapPin size={14} className="text-blue-400" />
              <span>How to run this properly:</span>
            </div>
            <p>1. Open this page (<strong>/receiver</strong>) on your smartphone browser (Chrome or Safari).</p>
            <p>2. Allow location permissions when prompted to enable real-time satellite tracking.</p>
          </div>
          <button
            type="button"
            onClick={() => setDevBypassMobile(true)}
            className="w-full py-2.5 px-4 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-semibold text-slate-200 transition"
          >
            Developer Testing: Continue in Browser
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReceiverErrorBoundary receiverId={receiverId} onSignOut={props.onSignOut}>
      <ReceiverPageContent {...props} />
    </ReceiverErrorBoundary>
  );
}

function ReceiverPageContent({ profile, onSignOut }: ReceiverPageProps) {
  const receiverId = useMemo(() => getReceiverIdentifier(profile), [profile]);
  const storageKey = `trucker_active_packages_${receiverId}`;
  const lastKnownPosKey = `trucker_last_known_pos_${receiverId}`;

  const [step, setStep] = useState<Step>('pickup');
  const [inventory, setInventory] = useState(initialInventory);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Point your camera at the QR code.');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);
  
  const [activePackages, setActivePackages] = useState<QrPayload[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        // Clean legacy single-item keys
        localStorage.removeItem('trucker_active_delivery_TRK-001');
        localStorage.removeItem(`trucker_active_delivery_${receiverId}`);

        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.filter((p) => p && typeof p.drNumber === 'string');
          }
        }
      }
    } catch {
      // ignore corrupted storage
    }
    return [];
  });

  const [handoverToast, setHandoverToast] = useState<string | null>(null);
  const [location, setLocation] = useState<PhoneLocation | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedPos = localStorage.getItem(lastKnownPosKey);
        if (savedPos) {
          const parsed = JSON.parse(savedPos) as Partial<PhoneLocation>;
          if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number' && !isNaN(parsed.latitude) && !isNaN(parsed.longitude)) {
            return {
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              accuracy: parsed.accuracy ?? null,
              timestamp: parsed.timestamp || new Date().toISOString()
            };
          }
        }
      }
    } catch {}
    return null;
  });

  const [release, setRelease] = useState<ReceiverReleaseRecord | null>(null);
  const [allReleases, setAllReleases] = useState<ReceiverReleaseRecord[]>([]);
  const [isSigning, setIsSigning] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const [pendingCustody, setPendingCustody] = useState<{
    payload: QrPayload;
    location: PhoneLocation;
    matchingRelease?: ReceiverReleaseRecord;
  } | null>(null);
  const [isMetaMaskSigning, setIsMetaMaskSigning] = useState(false);
  const [metaMaskSignError, setMetaMaskSignError] = useState<string | null>(null);
  const [verifiedQuantity, setVerifiedQuantity] = useState<number>(1);
  const [pendingVerifyPayload, setPendingVerifyPayload] = useState<QrPayload | null>(null);
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null);

  const activePackagesRef = useRef<QrPayload[]>(activePackages);
  useEffect(() => {
    activePackagesRef.current = activePackages;
  }, [activePackages]);

  const [selectedDrNumber, setSelectedDrNumber] = useState<string | null>(null);

  useEffect(() => {
    if (activePackages.length === 0) {
      setSelectedDrNumber(null);
    } else if (!selectedDrNumber || !activePackages.some((p) => p.drNumber === selectedDrNumber)) {
      setSelectedDrNumber(activePackages[0].drNumber);
    }
  }, [activePackages, selectedDrNumber]);

  const activePayload = useMemo(() => {
    if (!activePackages.length) return null;
    return (selectedDrNumber ? activePackages.find((p) => p.drNumber === selectedDrNumber) : null)
      || activePackages[0]
      || null;
  }, [activePackages, selectedDrNumber]);

  const activeRelease = useMemo(() => {
    if (activePayload?.drNumber) {
      return allReleases.find((r) => r.dr_number === activePayload.drNumber) || null;
    }
    return null;
  }, [activePayload?.drNumber, allReleases]);

  const lastProcessedLocRef = useRef<PhoneLocation | null>(location);
  const watchIdRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const cameraOpenRef = useRef(false);

  const [fitRouteTrigger, setFitRouteTrigger] = useState(0);

  const destinationInfo = useMemo(() => {
    if (!activePackages.length || !activePayload) {
      return {
        name: '',
        position: null,
        isPinned: false
      };
    }

    // 1. Exact coordinates from scanned QR
    if (activePayload?.destinationCoords && isValidCoordinate(activePayload.destinationCoords)) {
      return {
        name: activePayload.to,
        position: activePayload.destinationCoords,
        isPinned: true
      };
    }
    // 2. Exact coordinates from Supabase release matching this package (receiver_gps)
    const targetRelease = activeRelease;
    if (targetRelease?.receiver_gps) {
      const parts = targetRelease.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return {
          name: targetRelease.destination_address || targetRelease.lgu_name || activePayload?.to || 'Pinned Drop-Off Facility',
          position: [parts[0], parts[1]] as [number, number],
          isPinned: true
        };
      }
    }

    // 3. Authoritative fallback from Panay LGU Directory (Every municipality on Panay)
    const lguLookup = findPanayLgu(
      targetRelease?.destination_address ||
      targetRelease?.lgu_name ||
      targetRelease?.municipality ||
      activePayload?.to ||
      '',
      targetRelease?.province || undefined
    );
    if (lguLookup) {
      return {
        name: lguLookup.defaultFacility || `${lguLookup.municipality} Terminal`,
        position: [lguLookup.lat, lguLookup.lng] as [number, number],
        isPinned: true
      };
    }

    return {
      name: activePayload?.to || 'Drop-Off Pin Not Set',
      position: null,
      isPinned: false
    };
  }, [activePackages.length, activePayload, activeRelease]);

  // Compute destination pins for all active packages in custody
  const allPackageDestinations = useMemo(() => {
    if (!activePackages.length) return [];
    return activePackages.map((pkg) => {
      let position: [number, number] | null = null;
      let name = pkg.to || 'Assigned LGU';

      if (pkg.destinationCoords && isValidCoordinate(pkg.destinationCoords)) {
        position = pkg.destinationCoords;
      } else {
        const matchingRelease = allReleases.find((r) => r.dr_number === pkg.drNumber);
        if (matchingRelease?.receiver_gps) {
          const parts = matchingRelease.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            position = [parts[0], parts[1]];
            name = matchingRelease.destination_address || matchingRelease.lgu_name || pkg.to;
          }
        }
        if (!position) {
          const lguLookup = findPanayLgu(
            matchingRelease?.destination_address ||
            matchingRelease?.lgu_name ||
            matchingRelease?.municipality ||
            pkg.to ||
            '',
            matchingRelease?.province || undefined
          );
          if (lguLookup) {
            position = [lguLookup.lat, lguLookup.lng];
            name = lguLookup.defaultFacility || `${lguLookup.municipality} Terminal`;
          }
        }
      }

      const isSelected = pkg.drNumber === activePayload?.drNumber;
      return {
        drNumber: pkg.drNumber,
        category: pkg.category,
        quantity: pkg.quantity,
        name,
        position,
        isSelected
      };
    });
  }, [activePackages, allReleases, activePayload?.drNumber]);

  const destinationName = destinationInfo.name;
  const destinationPosition = destinationInfo.position;
  const currentPosition: [number, number] | null = useMemo(() => {
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number' && !isNaN(location.latitude) && !isNaN(location.longitude)) {
      return [location.latitude, location.longitude];
    }
    return null;
  }, [location]);
  
  const isInTransit = activePackages.length > 0;
  const totalQuantity = useMemo(() => activePackages.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0), [activePackages]);
  const handleRemovePackage = (drNumber: string) => {
    const updated = activePackages.filter((p) => p.drNumber !== drNumber);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    setActivePackages(updated);
    if (updated.length === 0) {
      setInventory(initialInventory);
      setIsDropdownOpen(false);
    }
    void backendApi.assignTruckToRelease(drNumber, null, 'Released').catch(() => {});
  };

  const handleClearAllPackages = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    for (const pkg of activePackages) {
      void backendApi.assignTruckToRelease(pkg.drNumber, null, 'Released').catch(() => {});
    }
    setActivePackages([]);
    setInventory(initialInventory);
    setIsDropdownOpen(false);
  };

  const saveLocationState = (nextLoc: PhoneLocation) => {
    lastProcessedLocRef.current = nextLoc;
    setLocation(nextLoc);
    try {
      localStorage.setItem(lastKnownPosKey, JSON.stringify(nextLoc));
    } catch {}
  };

  // 1. Continuous Local GPS watcher (runs all the time, Maxim-style)
  useEffect(() => {
    getBrowserLocation()
      .then((loc) => {
        saveLocationState(loc);
        setRecenterTrigger((prev) => prev + 1);
      })
      .catch((err) => console.warn('Initial GPS lookup:', err));

    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (nextPos) => {
        const rawLat = nextPos.coords.latitude;
        const rawLng = nextPos.coords.longitude;
        const accuracy = nextPos.coords.accuracy;

        if (typeof rawLat !== 'number' || typeof rawLng !== 'number' || isNaN(rawLat) || isNaN(rawLng)) return;
        if (accuracy && accuracy > 150) return;

        const prev = lastProcessedLocRef.current;
        if (prev) {
          const distance = getDistanceMeters(prev.latitude, prev.longitude, rawLat, rawLng);
          if (distance < 5) return;
        }

        const smoothedLat = prev ? smoothCoordinate(prev.latitude, rawLat, 0.4) : rawLat;
        const smoothedLng = prev ? smoothCoordinate(prev.longitude, rawLng, 0.4) : rawLng;

        const updatedLoc: PhoneLocation = {
          latitude: smoothedLat,
          longitude: smoothedLng,
          accuracy,
          timestamp: new Date().toISOString()
        };

        saveLocationState(updatedLoc);

        // Broadcast to Supabase ONLY if in active custody and not an LGU receiver
        const currentPackages = activePackagesRef.current;
        const isLguReceiver = Boolean(profile?.lguName && profile.lguName.trim());
        if (currentPackages && currentPackages.length > 0 && !isLguReceiver) {
          void backendApi.upsertTruckLiveLocation({
            truck_id: receiverId,
            latitude: updatedLoc.latitude,
            longitude: updatedLoc.longitude,
            gps_text: formatGps(updatedLoc),
            accuracy: updatedLoc.accuracy ? Math.round(updatedLoc.accuracy) : null,
            wallet_address: profile?.walletAddress || '0xReceiverWallet',
            updated_at: new Date().toISOString()
          }).catch(() => {});
        }
      },
      (err) => console.warn('Continuous GPS Watch:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );

    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [lastKnownPosKey, profile?.walletAddress, receiverId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      cameraOpenRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // 2. Sync releases and verify active custody state on mount & realtime
  useEffect(() => {
    let isSubscribed = true;

    const checkCustodyStatus = async () => {
      try {
        const releases = await backendApi.getReceiverReleases();

        if (!isSubscribed) return;
        setAllReleases(releases);
        const currentRelease = releases.find((r) => r.assigned_truck_id === receiverId) || releases[0] || null;
        setRelease(currentRelease);

        const currentPackages = activePackagesRef.current;
        if (currentPackages && currentPackages.length > 0) {
          const remainingPackages = currentPackages.filter((pkg) => {
            const matchingReq = releases.find((r) => r.dr_number === pkg.drNumber);
            if (!matchingReq) return false;
            const isAssignedToMe = matchingReq.assigned_truck_id === receiverId;
            const isDone = ['Delivered', 'Accepted', 'Distributed'].includes(matchingReq.delivery_status ?? '');
            return isAssignedToMe && !isDone;
          });

          if (remainingPackages.length !== currentPackages.length) {
            const removedPackages = currentPackages.filter((pkg) => !remainingPackages.some((r) => r.drNumber === pkg.drNumber));
            try {
              localStorage.setItem(storageKey, JSON.stringify(remainingPackages));
            } catch {}
            setActivePackages(remainingPackages);
            if (remainingPackages.length === 0) {
              setInventory(initialInventory);
            }
            const handoverNote = removedPackages.map((p) => {
              const req = releases.find((r) => r.dr_number === p.drNumber);
              if (req?.assigned_truck_id && req.assigned_truck_id !== receiverId) {
                return `DR #${p.drNumber} transferred to ${req.assigned_truck_id}`;
              }
              return `DR #${p.drNumber} delivered/accepted`;
            }).join(', ');
            setHandoverToast(handoverNote);
            setTimeout(() => setHandoverToast(null), 7000);
          }

          // Automatically backfill pinned destination coordinates from Supabase if missing
          let updatedAnyCoords = false;
          const currentPkgs = remainingPackages.length !== currentPackages.length ? remainingPackages : currentPackages;
          const updatedWithCoords = currentPkgs.map((pkg) => {
            if (!pkg.destinationCoords) {
              const req = releases.find((r) => r.dr_number === pkg.drNumber);
              if (req?.receiver_gps) {
                const parts = req.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  updatedAnyCoords = true;
                  return { ...pkg, destinationCoords: [parts[0], parts[1]] as [number, number] };
                }
              }
            }
            return pkg;
          });

          if (updatedAnyCoords) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(updatedWithCoords));
            } catch {}
            setActivePackages(updatedWithCoords);
          }
        }
      } catch (error) {
        console.warn('Failed to verify receiver custody status:', error);
      }
    };

    void checkCustodyStatus();

    const unsubscribe = backendApi.subscribeDashboard(() => {
      void checkCustodyStatus();
    });

    const interval = setInterval(() => {
      void checkCustodyStatus();
    }, 5000);

    return () => {
      isSubscribed = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [receiverId, storageKey]);

  const stopCamera = () => {
    cameraOpenRef.current = false;
    setCameraOpen(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const nav = (nextStep: Step) => {
    if (cameraOpen) stopCamera();
    setStep(nextStep);
  };

  const handleInitiateCustody = async (payload: QrPayload) => {
    stopCamera();
    setMetaMaskSignError(null);
    setIsSigning(true);

    try {
      // Guard against re-scanning already completed/accepted packages
      let matchingDbRelease = allReleases.find((r) => r.dr_number === payload.drNumber);
      if (!matchingDbRelease) {
        try {
          const freshReleases = await backendApi.getReceiverReleases();
          matchingDbRelease = freshReleases.find((r) => r.dr_number === payload.drNumber);
        } catch {}
      }

      if (matchingDbRelease && ['Delivered', 'Accepted', 'Distributed'].includes(matchingDbRelease.delivery_status ?? '')) {
        setHandoverToast(`Delivery Already Completed: Shipment ${payload.drNumber} has already been delivered and accepted by the LGU. This QR code is closed and cannot be picked up again.`);
        setTimeout(() => setHandoverToast(null), 8000);
        nav('pickup');
        return;
      }

      // Auto-attach pinned GPS from Supabase if not present in scanned QR
      if (!payload.destinationCoords) {
        if (matchingDbRelease?.receiver_gps) {
          const parts = matchingDbRelease.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            payload = { ...payload, destinationCoords: [parts[0], parts[1]] };
          }
        }
      }

      // Ensure on-chain batch tokens from database are used if available
      if (matchingDbRelease?.allocated_batches && matchingDbRelease.allocated_batches.length > 0) {
        const validBatches = matchingDbRelease.allocated_batches.filter(b => b.batchTokenId);
        if (validBatches.length > 0) {
          payload = {
            ...payload,
            batchTokenIds: validBatches.map(b => b.batchTokenId),
            batchQuantities: validBatches.map(b => Number(b.quantity) || 1)
          };
        }
      }

      let nextLocation: PhoneLocation;
      try {
        nextLocation = await getBrowserLocation();
      } catch (gpsErr) {
        console.warn('GPS lookup in handleInitiateCustody:', gpsErr);
        if (location && isValidCoordinate([location.latitude, location.longitude])) {
          nextLocation = location;
        } else {
          setCameraMessage('Mobile phone GPS required: Satellite GPS permission is needed to accept custody.');
          nav('pickup');
          return;
        }
      }

      saveLocationState(nextLocation);
      setRecenterTrigger((prev) => prev + 1);

      const custodyData = {
        payload,
        location: nextLocation,
        matchingRelease: matchingDbRelease
      };

      setPendingCustody(custodyData);
      setVerifiedQuantity(payload.quantity);
      setPendingVerifyPayload(payload);

      // Navigate to the explicit MetaMask confirmation screen
      nav('sign_custody');

      // Trigger MetaMask signature immediately
      void handleExecuteCustodySign(custodyData);
    } catch (error) {
      console.error('Scan custody initiate error:', error);
      nav('scan');
      setCameraMessage(error instanceof Error ? error.message : 'Scan processing failed.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleExecuteCustodySign = async (custodyOverride?: {
    payload: QrPayload;
    location: PhoneLocation;
    matchingRelease?: ReceiverReleaseRecord;
  }) => {
    const custody = custodyOverride || pendingCustody;
    if (!custody) return;
    const { payload, location: nextLocation } = custody;
    setIsMetaMaskSigning(true);
    setMetaMaskSignError(null);

    let activeProofHash: string | undefined = undefined;
    let activeWalletAddr = profile?.walletAddress || '0xReceiverWallet';

    try {
      const proof = await blockchain.signReleaseProof({
        drNumber: payload.drNumber,
        handoverContractId: payload.handoverContractId || `HANDOVER-${payload.drNumber.replace('DR-', '')}`,
        category: payload.category,
        quantity: payload.quantity,
        batchTokenIds: payload.batchTokenIds || [],
        batchQuantities: payload.batchQuantities || [payload.quantity],
        from: payload.from || 'DSWD Logistics Hub',
        to: payload.to || 'Assigned LGU',
        gps: `${nextLocation.latitude.toFixed(5)}, ${nextLocation.longitude.toFixed(5)}`
      });
      activeProofHash = proof.hash;
      activeWalletAddr = proof.walletAddress;
      if (proof.hash) {
        setConfirmedTxHash(proof.hash);
      }

      await backendApi.assignTruckToRelease(payload.drNumber, receiverId, 'In Transit');
      if (activeProofHash) {
        await backendApi.updateOutgoing(payload.drNumber, {
          senderSignature: activeProofHash,
          txHash: activeProofHash,
          walletAddress: activeWalletAddr,
          deliveryStatus: 'In Transit'
        }).catch(() => {});
      }

      const updatedPackages = [
        ...activePackages.filter((p) => p.drNumber !== payload.drNumber),
        payload
      ];

      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedPackages));
      } catch {}

      setActivePackages(updatedPackages);
      setFitRouteTrigger((prev) => prev + 1);

      const isLguReceiver = Boolean(profile?.lguName && profile.lguName.trim());
      if (!isLguReceiver) {
        try {
          await backendApi.upsertTruckLiveLocation({
            truck_id: receiverId,
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
            gps_text: formatGps(nextLocation),
            accuracy: nextLocation.accuracy ? Math.round(nextLocation.accuracy) : null,
            wallet_address: activeWalletAddr,
            updated_at: new Date().toISOString()
          });
        } catch (apiErr) {
          console.warn('Supabase upsert live location error:', apiErr);
        }
      }

      setInventory({
        batchTokenId: payload.batchTokenIds[0] ?? payload.handoverContractId,
        category: payload.category,
        quantity: payload.quantity,
        status: 'In transit',
        remarks: ''
      });

      setVerifiedQuantity(payload.quantity);
      setPendingVerifyPayload(payload);
      setPendingCustody(null);

      setHandoverToast(`On-chain custody transfer confirmed on Sepolia for ${payload.drNumber}`);
      setTimeout(() => setHandoverToast(null), 7000);

      nav('verify');
    } catch (err: any) {
      console.warn('Receiver sign custody error:', err);
      const msg = err?.message || 'MetaMask transaction was cancelled or reverted on Sepolia.';
      setMetaMaskSignError(msg);
    } finally {
      setIsMetaMaskSigning(false);
    }
  };

  const handleQrValue = (value: string) => {
    try {
      const payload = parseQrPayload(value);
      void handleInitiateCustody(payload);
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : 'Invalid QR payload.');
    }
  };

  // Auto-detect package when opened via MetaMask Universal Link (?dr=... or ?data=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const urlDr = urlParams.get('dr');
    const urlData = urlParams.get('data') || urlParams.get('payload');

    if (urlDr || urlData) {
      try {
        let payloadToLoad: QrPayload | null = null;
        if (urlData) {
          payloadToLoad = parseQrPayload(decodeURIComponent(urlData));
        } else if (urlDr) {
          payloadToLoad = parseQrPayload(urlDr);
        }
        if (payloadToLoad) {
          window.history.replaceState({}, '', window.location.pathname);
          void handleInitiateCustody(payloadToLoad);
        }
      } catch (err) {
        console.warn('URL QR payload auto-load error:', err);
      }
    }
  }, [allReleases]);

  const startCamera = async () => {
    cameraOpenRef.current = true;
    setCameraOpen(true);
    setCameraMessage('Requesting camera access...');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera unavailable.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const Detector = (window as BarcodeDetectorWindow).BarcodeDetector;
      if (!Detector) {
        setCameraMessage('Point camera at QR code.');
        return;
      }

      detectorRef.current = new Detector({ formats: ['qr_code'] });
      const scan = async () => {
        if (!videoRef.current || !cameraOpenRef.current || !detectorRef.current || isSigning) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes[0]?.rawValue) handleQrValue(codes[0].rawValue);
        } catch {
          setCameraMessage('Keep the QR centered in the frame.');
        }
        if (cameraOpenRef.current) requestAnimationFrame(scan);
      };

      const video = videoRef.current;
      if (video) video.onloadeddata = () => requestAnimationFrame(scan);
    } catch {
      setCameraMessage('Camera permission was denied.');
    }
  };

  const isFlow = step !== 'pickup';

  return (
    <main className="min-h-screen bg-[#e7e6ea] p-0 text-[#15132d] sm:p-5 flex items-center justify-center font-sans">
      <section className="mx-auto flex h-screen w-full max-w-[390px] flex-col overflow-hidden bg-white shadow-xl sm:h-[800px] sm:rounded-[28px] relative">
        
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
                    alt={profile.fullName || 'Receiver Avatar'}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {(profile?.fullName || receiverId || 'RC').slice(0, 2).toUpperCase()}
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
              <p className="text-[10px] text-white/70 truncate max-w-[140px]">
                {receiverId} • {profile?.fullName || 'Oton Warehouse'}
              </p>
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

        {/* GPS Satellite Signal Status HUD Bar */}
        {!location ? (
          <div className="bg-amber-500 text-white px-3 py-1.5 text-[9.5px] font-semibold flex items-center justify-between z-10 shadow-inner">
            <div className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin flex-shrink-0" />
              <span>Acquiring mobile phone satellite GPS...</span>
            </div>
            <span className="text-[8.5px] bg-amber-600/80 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              No Fix
            </span>
          </div>
        ) : (location.accuracy ?? 0) > 45 ? (
          <div className="bg-amber-600 text-white px-3 py-1.5 text-[9.5px] font-semibold flex items-center justify-between z-10 shadow-inner">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle size={13} className="text-yellow-200 flex-shrink-0" />
              <span className="truncate">Weak GPS Signal (±{Math.round(location.accuracy!)}m). Inaccurate tracking.</span>
            </div>
            <span className="text-[8.5px] bg-amber-700/80 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex-shrink-0 ml-1">
              Weak
            </span>
          </div>
        ) : (
          <div className="bg-emerald-700 text-emerald-50 px-3 py-1 text-[9px] font-medium flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>Satellite GPS: ±{Math.round(location.accuracy || 10)}m</span>
            </div>
            <span className="text-[8.5px] text-emerald-200 font-mono">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </span>
          </div>
        )}

        <div className="relative flex-1 overflow-hidden bg-[#f8fafc]">
          
          <div className="absolute inset-0 z-0">
            <MapContainer
              center={currentPosition || DEFAULT_PANAY_BOUNDS_CENTER}
              zoom={currentPosition ? 15 : 10}
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
                center={currentPosition}
                destination={destinationPosition}
                recenterKey={recenterTrigger}
                fitRouteTrigger={fitRouteTrigger}
              />

              {isInTransit && allPackageDestinations.map((pkgDest) => {
                if (!pkgDest.position || !isValidCoordinate(pkgDest.position)) return null;
                const isSelected = pkgDest.isSelected;
                return (
                  <Fragment key={pkgDest.drNumber}>
                    <Marker
                      position={pkgDest.position}
                      icon={createDestinationPinIcon(isSelected ? 'LGU DESTINATION' : `DR #${pkgDest.drNumber}`, isSelected)}
                      eventHandlers={{
                        click: () => {
                          setSelectedDrNumber(pkgDest.drNumber);
                        }
                      }}
                    >
                      <Popup>
                        <div className="text-center font-sans p-1">
                          <p className={`text-[10px] font-extrabold uppercase ${isSelected ? 'text-blue-700' : 'text-purple-600'}`}>
                            {isSelected ? 'Active Destination (Navigating)' : 'Assigned Drop-off'}
                          </p>
                          <p className="text-xs font-bold text-gray-900 mt-0.5">{pkgDest.name}</p>
                          <p className="text-[10px] font-mono text-gray-500 mt-0.5">DR #{pkgDest.drNumber} • {pkgDest.quantity} {pkgDest.category}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{pkgDest.position[0].toFixed(6)}, {pkgDest.position[1].toFixed(6)}</p>
                          <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">Verified Drop-off Facility</p>
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => setSelectedDrNumber(pkgDest.drNumber)}
                              className="mt-2 w-full rounded-md bg-[#2500ba] px-2 py-1 text-[10px] font-bold text-white shadow hover:bg-[#1f009e]"
                            >
                              Switch Navigation to This
                            </button>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  </Fragment>
                );
              })}

              {currentPosition && isValidCoordinate(currentPosition) && (
                <Marker
                  position={currentPosition}
                  icon={createDriverVehicleIcon(location?.accuracy)}
                >
                  <Popup>
                    <div className="text-center font-sans p-1">
                      <p className="text-[10px] font-extrabold text-[#2500ba]">
                        {isInTransit ? `In Custody (${receiverId})` : 'Driver Location'}
                      </p>
                      <p className="text-[9px] text-gray-500 mt-0.5">
                        {currentPosition[0].toFixed(6)}, {currentPosition[1].toFixed(6)}
                      </p>
                      {location?.accuracy && (
                        <p className="text-[9px] font-semibold text-emerald-600">
                          GNSS Accuracy: ±{Math.round(location.accuracy)}m
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}

              {isInTransit && currentPosition && destinationPosition && isValidCoordinate(currentPosition) && isValidCoordinate(destinationPosition) && (
                <RoadLockedDeliveryRoute
                  currentPosition={currentPosition}
                  destinationPosition={destinationPosition}
                />
              )}
            </MapContainer>
          </div>

          {/* Missing Pin Warning when in custody but no GPS coordinates are pinned */}
          {isInTransit && !destinationPosition && (
            <div className="absolute top-20 left-3 right-3 z-10 rounded-xl bg-red-600/95 text-white p-2.5 shadow-lg flex items-center gap-2 backdrop-blur-sm border border-red-400">
              <MapPin size={16} className="flex-shrink-0 text-white" />
              <div className="text-[10px] leading-tight">
                <p className="font-bold">Destination Drop-Off Pin Missing</p>
                <p className="text-[9px] opacity-90">No GPS coordinates pinned for &quot;{destinationName}&quot;. Route cannot be drawn until pinned.</p>
              </div>
            </div>
          )}

          {/* Floating Toast when handover is confirmed */}
          {handoverToast && (
            <div className={`absolute top-4 left-4 right-4 z-30 rounded-xl p-3 text-white shadow-lg flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
              handoverToast.includes('Delivery Already Completed') || handoverToast.includes('cannot be picked up')
                ? 'bg-amber-600 border border-amber-500'
                : 'bg-emerald-600'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="flex-shrink-0" />
                <p className="text-[10px] font-bold leading-tight">{handoverToast}</p>
              </div>
              <button
                type="button"
                onClick={() => setHandoverToast(null)}
                className="p-1 text-white/80 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Active Custody Floating Popup (When carrying 1 or more packages) */}
          {isInTransit && activePackages.length > 0 && (
            <div className="absolute left-3 right-3 top-3 z-10 max-h-[300px] overflow-hidden rounded-2xl bg-white/95 p-3 shadow-xl border-2 border-emerald-500/40 backdrop-blur-md transition-all">
              {/* Header bar / Dropdown Toggle */}
              <div
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center justify-between gap-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                    <Radio size={15} className="animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-bold text-gray-900 truncate">
                        {activePackages.length === 1 ? '1 Package in Active Custody' : `${activePackages.length} Packages in Active Custody`}
                      </p>
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <p className="text-[9.5px] font-semibold text-[#2500ba] truncate">
                      Total {totalQuantity} items • LIVE GPS ON
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                    {isDropdownOpen ? 'Hide' : `${activePackages.length} pkgs`}
                  </span>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                    aria-label="Toggle package list"
                  >
                    {isDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Quick Multi-Package Navigation Selector */}
              {activePackages.length > 1 && (
                <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-gray-100 pt-2">
                  <span className="text-[9px] font-bold text-gray-500 uppercase flex-shrink-0">Target:</span>
                  {activePackages.map((pkg) => {
                    const isSelected = pkg.drNumber === activePayload?.drNumber;
                    const pkgDest = allPackageDestinations.find((d) => d.drNumber === pkg.drNumber);
                    const hasCoords = Boolean(pkgDest?.position);
                    return (
                      <button
                        key={pkg.drNumber}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDrNumber(pkg.drNumber);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9.5px] font-bold transition flex-shrink-0 border ${
                          isSelected
                            ? 'bg-[#2500ba] text-white border-[#2500ba] shadow-sm'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        <span>DR #{pkg.drNumber}</span>
                        {isSelected && <span className="rounded bg-white/20 px-1 text-[8px] uppercase">Active</span>}
                        {!hasCoords && <span className="rounded bg-red-500 text-white px-1 text-[8px]">No GPS</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Collapsible Dropdown List */}
              {isDropdownOpen && (
                <div className="mt-2.5 max-h-[180px] space-y-2 overflow-y-auto border-t border-gray-100 pt-2.5 pr-1">
                  {activePackages.map((pkg, idx) => {
                    const isSelected = pkg.drNumber === activePayload?.drNumber;
                    const pkgDest = allPackageDestinations.find((d) => d.drNumber === pkg.drNumber);
                    const hasCoords = Boolean(pkgDest?.position);
                    return (
                      <div
                        key={pkg.drNumber || idx}
                        onClick={() => setSelectedDrNumber(pkg.drNumber)}
                        className={`rounded-xl border p-2.5 text-left text-xs transition cursor-pointer relative group ${
                          isSelected
                            ? 'border-[#2500ba] bg-blue-50/90 shadow-sm'
                            : 'border-gray-200 bg-gray-50/90 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between pr-5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#2500ba] text-[10.5px]">DR #{pkg.drNumber}</span>
                            {isSelected && (
                              <span className="rounded bg-[#2500ba] text-white px-1.5 py-0.2 text-[8px] font-extrabold uppercase">
                                Navigating
                              </span>
                            )}
                          </div>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-800">
                            {pkg.quantity} {pkg.category}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[9.5px]">
                          <div className="flex items-center gap-1 text-gray-600 truncate">
                            <MapPin size={11} className={hasCoords ? 'text-red-500 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                            <span className="truncate font-medium">To: {pkg.to}</span>
                          </div>
                          {!hasCoords && (
                            <span className="text-[8.5px] font-bold text-red-600 bg-red-50 px-1 rounded flex-shrink-0">
                              Pin Missing
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePackage(pkg.drNumber);
                          }}
                          className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600 transition"
                          title="Remove package from active custody"
                          aria-label="Remove package"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearAllPackages();
                    }}
                    className="w-full mt-2 rounded-lg border border-red-200 bg-red-50 py-1.5 text-[9.5px] font-bold text-red-600 hover:bg-red-100 transition flex items-center justify-center gap-1"
                  >
                    <Trash2 size={11} />
                    Clear All Active Custody
                  </button>
                </div>
              )}

              <p className="mt-2 text-[8px] text-gray-400 italic">
                * Custody will automatically clear as each recipient officer scans & accepts receipt.
              </p>
            </div>
          )}

          {/* Recenter & Fit Route Floating Buttons */}
          <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2">
            {destinationPosition && isValidCoordinate(destinationPosition) && (
              <button
                type="button"
                onClick={() => setFitRouteTrigger((prev) => prev + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-700 shadow-lg border border-gray-200 hover:bg-blue-50 active:scale-95 transition"
                title={`Fit Entire Route to ${destinationName}`}
                aria-label="Fit Route"
              >
                <MapPin size={18} className="text-red-500" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setRecenterTrigger((prev) => prev + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2500ba] shadow-lg border border-gray-200 hover:bg-blue-50 active:scale-95 transition"
              title="Recenter Map on Driver"
              aria-label="Recenter Map"
            >
              <LocateFixed size={18} />
            </button>
          </div>

          {/* Bottom Action Sheet (Always ready to scan anything) */}
          <div className="absolute bottom-3 left-4 right-4 z-10 rounded-xl bg-white p-3 shadow-md border border-gray-100">
            <div className="mb-2 flex justify-between text-[9px] text-gray-500">
              <span>{isInTransit ? `${activePackages.length} package${activePackages.length > 1 ? 's' : ''} in custody` : 'Map Live • Standby'}</span>
              <span className={`font-bold ${isInTransit ? 'text-emerald-600' : 'text-[#2500ba]'}`}>
                {isInTransit ? 'DASHBOARD TRACKING ON' : 'LOCAL GPS ONLY'}
              </span>
            </div>

            {location && (
              <p className="mb-2 text-[9px] font-mono text-gray-400">
                {formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}
                {location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : ''}
              </p>
            )}

            <button
              type="button"
              onClick={() => nav('scan')}
              className="w-full rounded-full bg-[#2500ba] py-3 text-[11px] font-bold text-white shadow-md hover:bg-blue-800 active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              <ScanLine size={15} />
              {isInTransit ? 'Scan Next Package / Pickup' : 'Pick up and Scan Package QR'}
            </button>
          </div>

          {/* 5 Dots Smooth Loading Screens */}
          <FiveDotsLoadingModal
            isOpen={isInitialLoading}
            title="Connecting Receiver Terminal"
            subtitle="Calibrating satellite sensors & syncing shipments..."
          />

          <FiveDotsLoadingModal
            isOpen={isSigning}
            title="Registering Package Custody"
            subtitle="Locking satellite coordinates & updating live custody..."
          />

          {isFlow && <div className="absolute inset-0 z-20 bg-black/65" />}

          {step === 'scan' && (
            <ScanModal
              onClose={() => nav('pickup')}
              onStart={startCamera}
              cameraOpen={cameraOpen}
              closeCamera={stopCamera}
              videoRef={videoRef}
              message={cameraMessage}
              isSigning={isSigning}
            />
          )}

          {step === 'sign_custody' && (
            <FiveDotsLoadingModal
              isOpen={step === 'sign_custody'}
              title="Opening MetaMask..."
              subtitle={
                metaMaskSignError
                  ? metaMaskSignError
                  : 'Please approve the proof of custody in your MetaMask wallet...'
              }
              onRetry={() => void handleExecuteCustodySign()}
              onClose={() => {
                setIsMetaMaskSigning(false);
                setPendingCustody(null);
                nav('pickup');
              }}
            />
          )}

          {step === 'verify' && (
            <Modal
              title="Verify Package Count"
              icon={<ClipboardList size={22} className="text-[#2500ba]" />}
              onClose={() => nav('pickup')}
            >
              <div className="text-center mt-1">
                <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                  On-Chain Custody Confirmed
                </span>
                <p className="text-sm font-extrabold text-gray-900 mt-1">
                  {pendingVerifyPayload?.drNumber || activePayload?.drNumber}
                </p>
                <p className="text-xs text-gray-600 font-semibold mt-0.5">
                  {pendingVerifyPayload?.category || activePayload?.category}
                </p>
                {confirmedTxHash && (
                  <div className="mt-2 flex justify-center">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${confirmedTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold hover:bg-emerald-100 transition shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sepolia Tx: {confirmedTxHash.slice(0, 8)}...{confirmedTxHash.slice(-6)}</span>
                      <ExternalLink className="w-3 h-3 text-emerald-600" />
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2 text-left">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5 space-y-1 text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Destination:</span>
                    <span className="font-bold text-gray-800 text-right truncate max-w-[170px]">
                      {pendingVerifyPayload?.to || activePayload?.to}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Origin:</span>
                    <span className="font-semibold text-gray-700 text-right truncate max-w-[170px]">
                      {pendingVerifyPayload?.from || activePayload?.from}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Commodity:</span>
                    <span className="font-semibold text-gray-700 text-right truncate max-w-[170px]">
                      {pendingVerifyPayload?.category || activePayload?.category}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-center">
                  <label className="block text-[11px] font-bold text-gray-800 mb-1">
                    Verified Number of Packages
                  </label>
                  <p className="text-[9.5px] text-gray-500 mb-2">
                    Verify physical count loaded on vehicle before departure.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setVerifiedQuantity((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-extrabold text-xl flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={verifiedQuantity || ''}
                      onChange={(e) => {
                        const cleaned = sanitizeNumbersOnly(e.target.value);
                        const val = cleaned ? parseInt(cleaned, 10) : 0;
                        setVerifiedQuantity(val);
                      }}
                      className="w-24 text-center font-mono font-extrabold text-xl py-2 px-2 border-2 border-[#2500ba] rounded-xl text-[#2500ba] bg-white focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setVerifiedQuantity((prev) => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-[#2500ba] hover:bg-blue-800 text-white font-extrabold text-xl flex items-center justify-center shadow-md transition active:scale-95 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={async () => {
                    const activeDr = pendingVerifyPayload?.drNumber || activePayload?.drNumber;
                    if (activeDr) {
                      const origQty = pendingVerifyPayload?.quantity || activePayload?.quantity || verifiedQuantity;
                      if (verifiedQuantity !== origQty) {
                        try {
                          await backendApi.updateOutgoing(activeDr, {
                            amountApproved: verifiedQuantity,
                            amountRequested: verifiedQuantity
                          });
                        } catch (err) {
                          console.warn('Update verified quantity error:', err);
                        }
                      }
                      const updated = activePackages.map((pkg) =>
                        pkg.drNumber === activeDr ? { ...pkg, quantity: verifiedQuantity } : pkg
                      );
                      try {
                        localStorage.setItem(storageKey, JSON.stringify(updated));
                      } catch {}
                      setActivePackages(updated);
                    }
                    setHandoverToast(`Custody confirmed: ${verifiedQuantity} packages in transit.`);
                    setTimeout(() => setHandoverToast(null), 5000);
                    setPendingVerifyPayload(null);
                    nav('pickup');
                  }}
                  className="w-full rounded-xl bg-[#2500ba] py-3 text-xs font-bold text-white shadow-md hover:bg-blue-800 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  <span>Confirm Packages & Start Delivery</span>
                </button>
              </div>
            </Modal>
          )}

        </div>

        {/* Bottom Navigation Bar (Original UI) */}
        <nav className="z-10 flex h-14 items-center justify-around border-t bg-white text-[#2500ba] shadow-sm">
          <button
            onClick={() => nav('pickup')}
            aria-label="Home"
            className={`p-2 transition ${step === 'pickup' ? 'text-[#2500ba]' : 'text-gray-400'} cursor-pointer`}
          >
            <Home size={21} />
          </button>

          <button
            onClick={() => nav('scan')}
            aria-label="Scan"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#2500ba] text-white shadow-lg ring-4 ring-white active:scale-95 transition cursor-pointer"
          >
            <ScanLine size={26} />
          </button>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            aria-label="Profile"
            className="p-2 transition text-gray-400 hover:text-[#2500ba] cursor-pointer"
          >
            <UserRound size={21} />
          </button>
        </nav>

      </section>
    </main>
  );
}

function Modal({ title, icon, children, onClose }: { title: string; icon?: ReactNode; children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute left-5 right-5 top-1/2 z-30 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl border border-gray-100">
      <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-[#2500ba]">
        <X size={16} />
      </button>
      {icon && (
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#dedafb] text-[#2500ba]">
          {icon}
        </div>
      )}
      <h2 className="text-center text-xs font-bold text-[#2500ba]">{title}</h2>
      {children}
    </div>
  );
}

function ScanModal({
  onClose,
  onStart,
  cameraOpen,
  closeCamera,
  videoRef,
  message,
  isSigning
}: {
  onClose: () => void;
  onStart: () => void;
  cameraOpen: boolean;
  closeCamera: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  message: string;
  isSigning: boolean;
}) {
  useEffect(() => {
    if (!cameraOpen) {
      onStart();
    }
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between overflow-hidden bg-[#15131f]/95 p-5 text-white">
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs font-bold">Scan Package QR Code</p>
            <p className="text-[9.5px] text-white/60">Align camera with package QR</p>
          </div>
          <div className="h-8 w-8" />
        </div>

        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[230px] overflow-hidden rounded-3xl border-4 border-[#2500ba] bg-black shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${cameraOpen ? 'opacity-100' : 'opacity-25'}`}
          />
          {!cameraOpen && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <ScanLine size={64} className="text-white/60 animate-pulse" />
              <p className="text-[10px] text-white/50">Starting Camera...</p>
            </div>
          )}
          {cameraOpen && (
            <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-white/75 px-4 leading-relaxed">{message}</p>
      </div>

      <div className="space-y-3 pb-2">
        <button
          onClick={cameraOpen ? closeCamera : onStart}
          disabled={isSigning}
          className="w-full rounded-2xl bg-white py-2.5 text-xs font-bold text-[#2500ba] shadow-lg disabled:opacity-50 hover:bg-gray-100 active:scale-[0.99] transition flex items-center justify-center gap-2"
        >
          <ScanLine size={15} />
          {cameraOpen ? 'Pause Camera' : 'Start Camera Scanner'}
        </button>
        <p className="text-center text-[9.5px] text-white/40">
          Direct camera QR code scanning only.
        </p>
      </div>
    </div>
  );
}

export type { Inventory };
export { initialInventory };
export { ReceiverPage as ReceiverLocationPage, ReceiverPage as TruckerLocationPage };

