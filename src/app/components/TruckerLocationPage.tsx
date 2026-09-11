'use client';

import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react';
import {
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
  ShieldCheck,
  Truck,
  UserRound,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import type { UserProfile } from '../services/authApi';
import { backendApi, type TruckerReleaseRecord } from '../services/backendApi';

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

type Step = 'pickup' | 'scan' | 'verify' | 'inventory' | 'success' | 'arrived' | 'profile';
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
};

const initialInventory: Inventory = {
  batchTokenId: '',
  category: 'Relief Goods',
  quantity: 0,
  status: 'Waiting for pickup scan',
  remarks: ''
};

const DEFAULT_MAP_CENTER: [number, number] = [10.7202, 122.5621];
const DEFAULT_DESTINATION_POSITION: [number, number] = [10.787, 122.3892];

const LGU_COORDS: Record<string, [number, number]> = {
  leon: [10.787, 122.3892],
  miagao: [10.6445, 122.2367],
  'barotac nuevo': [10.894, 122.7042],
  'iloilo city': [10.7202, 122.5621],
  oton: [10.6931, 122.4738],
  pototan: [10.9435, 122.6369]
};

const normalizeKey = (value?: string | null) => value?.trim().toLowerCase() ?? '';
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

const findDestinationPosition = (destination?: string | null): [number, number] => {
  if (!destination || typeof destination !== 'string') return DEFAULT_DESTINATION_POSITION;
  const normalized = normalizeKey(destination);
  const found =
    LGU_COORDS[normalized] ??
    Object.entries(LGU_COORDS).find(([key]) => normalized.includes(key))?.[1];
  if (found && isValidCoordinate(found)) return found;
  return DEFAULT_DESTINATION_POSITION;
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

const smoothCoordinate = (prev: number, next: number, alpha = 0.4) => {
  if (typeof prev !== 'number' || isNaN(prev)) return next;
  if (typeof next !== 'number' || isNaN(next)) return prev;
  return prev + alpha * (next - prev);
};

const parseQrPayload = (value: string): QrPayload => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('QR code is empty.');

  try {
    const data = JSON.parse(trimmed) as Partial<QrPayload>;
    const batchTokenIds = Array.isArray(data.batchTokenIds) && data.batchTokenIds.length ? data.batchTokenIds.map(String) : [`BATCH-${Date.now()}`];
    const batchQuantities = Array.isArray(data.batchQuantities) && data.batchQuantities.length ? data.batchQuantities.map(Number) : [Number(data.quantity ?? 1)];

    if (!data.drNumber) {
      throw new Error('QR code does not contain a DR number.');
    }

    return {
      drNumber: String(data.drNumber),
      handoverContractId: String(data.handoverContractId || `HANDOVER-${data.drNumber}`),
      category: String(data.category || 'Relief Goods'),
      quantity: Number(data.quantity ?? (batchQuantities.reduce((sum, amount) => sum + amount, 0) || 1)),
      batchTokenIds,
      batchQuantities,
      from: String(data.from || 'DSWD Oton Main Warehouse'),
      to: String(data.to || 'Assigned LGU')
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
      (error) => reject(new Error(error.message || 'GPS permission denied.')),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  });

const releaseToPayload = (release: TruckerReleaseRecord): QrPayload => {
  const allocatedBatches = release.allocated_batches ?? [];
  return {
    drNumber: release.dr_number,
    handoverContractId: release.handover_contract_id || `HANDOVER-${release.dr_number}`,
    category: release.category || 'Relief Goods',
    quantity: Number(release.amount_approved ?? release.amount_requested ?? 1),
    batchTokenIds: allocatedBatches.map((batch) => String(batch.batchTokenId || '')).filter(Boolean),
    batchQuantities: allocatedBatches.map((batch) => Number(batch.quantity ?? 0)).filter((quantity) => quantity > 0),
    from: release.warehouse_source || 'DSWD Oton Main Warehouse',
    to: release.lgu_name || release.municipality || 'Leon Municipal Office'
  };
};

function MapController({ center, recenterKey }: { center: [number, number]; recenterKey: number }) {
  const map = useMap();
  const isInitialMount = useRef(true);

  // Recenter only when recenter button is clicked (recenterKey > 0)
  useEffect(() => {
    if (!map || recenterKey === 0 || !isValidCoordinate(center)) return;
    try {
      const size = map.getSize();
      if (size && size.x > 0 && size.y > 0) {
        map.panTo(center, { animate: true, duration: 0.8 });
      }
    } catch {
      // safe fallback
    }
  }, [recenterKey, center, map]);

  // Smooth follow when driver moves > 35m
  useEffect(() => {
    if (!map || !isValidCoordinate(center)) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      const size = map.getSize();
      if (size && size.x > 0 && size.y > 0) {
        const currentCenter = map.getCenter();
        if (currentCenter) {
          const dist = getDistanceMeters(currentCenter.lat, currentCenter.lng, center[0], center[1]);
          if (dist > 35) {
            map.panTo(center, { animate: true, duration: 1.0 });
          }
        }
      }
    } catch {
      // safe fallback
    }
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
        <Polyline
          positions={roadCoordinates}
          pathOptions={{
            color: '#2500ba',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round'
          }}
        />
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

class TruckerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TruckerLocationPage ErrorBoundary caught:', error, errorInfo);
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

interface TruckerLocationPageProps {
  profile?: UserProfile | null;
  onSignOut?: () => void;
}

export function TruckerLocationPage(props: TruckerLocationPageProps) {
  const receiverId = useMemo(() => getReceiverIdentifier(props.profile), [props.profile]);
  return (
    <TruckerErrorBoundary receiverId={receiverId} onSignOut={props.onSignOut}>
      <TruckerLocationPageContent {...props} />
    </TruckerErrorBoundary>
  );
}

function TruckerLocationPageContent({ profile, onSignOut }: TruckerLocationPageProps) {
  const receiverId = useMemo(() => getReceiverIdentifier(profile), [profile]);
  const storageKey = `trucker_active_packages_${receiverId}`;
  const lastKnownPosKey = `trucker_last_known_pos_${receiverId}`;

  const [step, setStep] = useState<Step>('pickup');
  const [inventory, setInventory] = useState(initialInventory);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Point your camera at the QR code.');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
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

  const [release, setRelease] = useState<TruckerReleaseRecord | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const activePackagesRef = useRef<QrPayload[]>(activePackages);
  useEffect(() => {
    activePackagesRef.current = activePackages;
  }, [activePackages]);

  const activePayload = activePackages[activePackages.length - 1] ?? null;

  const lastProcessedLocRef = useRef<PhoneLocation | null>(location);
  const watchIdRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const cameraOpenRef = useRef(false);

  const destinationName = activePayload?.to || release?.lgu_name || 'Leon LGU Office';
  const destinationPosition = useMemo(() => findDestinationPosition(destinationName), [destinationName]);
  const currentPosition: [number, number] = useMemo(() => {
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number' && !isNaN(location.latitude) && !isNaN(location.longitude)) {
      return [location.latitude, location.longitude];
    }
    return DEFAULT_MAP_CENTER;
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

        // Broadcast to Supabase ONLY if in active custody
        const currentPackages = activePackagesRef.current;
        if (currentPackages && currentPackages.length > 0) {
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
        const releases = await backendApi.getTruckerReleases(receiverId);

        if (!isSubscribed) return;
        const currentRelease = releases[0] ?? null;
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
            const deliveredCount = currentPackages.length - remainingPackages.length;
            try {
              localStorage.setItem(storageKey, JSON.stringify(remainingPackages));
            } catch {}
            setActivePackages(remainingPackages);
            if (remainingPackages.length === 0) {
              setInventory(initialInventory);
            }
            setHandoverToast(`✓ ${deliveredCount} package(s) updated/cleared from custody.`);
            setTimeout(() => setHandoverToast(null), 6000);
          }
        }
      } catch (error) {
        console.warn('Failed to verify trucker custody status:', error);
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

  const signAndShare = async (payload: QrPayload) => {
    setIsSigning(true);
    stopCamera();

    try {
      let nextLocation: PhoneLocation;
      try {
        nextLocation = await getBrowserLocation();
      } catch (gpsErr) {
        console.warn('GPS lookup fallback in signAndShare, using current location:', gpsErr);
        nextLocation = location ?? {
          latitude: DEFAULT_MAP_CENTER[0],
          longitude: DEFAULT_MAP_CENTER[1],
          accuracy: 25,
          timestamp: new Date().toISOString()
        };
      }

      saveLocationState(nextLocation);
      setRecenterTrigger((prev) => prev + 1);

      // Assign package to this truck in Supabase outgoing_requests
      await backendApi.assignTruckToRelease(payload.drNumber, receiverId, 'In Transit');

      const updatedPackages = [
        ...activePackages.filter((p) => p.drNumber !== payload.drNumber),
        payload
      ];

      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedPackages));
      } catch {}

      setActivePackages(updatedPackages);

      try {
        await backendApi.upsertTruckLiveLocation({
          truck_id: receiverId,
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
          gps_text: formatGps(nextLocation),
          accuracy: nextLocation.accuracy ? Math.round(nextLocation.accuracy) : null,
          wallet_address: profile?.walletAddress || '0xReceiverWallet',
          updated_at: new Date().toISOString()
        });
      } catch (apiErr) {
        console.warn('Supabase upsert live location error:', apiErr);
      }

      setInventory({
        batchTokenId: payload.batchTokenIds[0] ?? payload.handoverContractId,
        category: payload.category,
        quantity: payload.quantity,
        status: 'In transit',
        remarks: ''
      });
      nav('verify');
    } catch (error) {
      console.error('Scan custody error:', error);
      nav('scan');
      setCameraMessage(error instanceof Error ? error.message : 'Scan processing failed.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleQrValue = (value: string) => {
    try {
      void signAndShare(parseQrPayload(value));
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : 'Invalid QR payload.');
    }
  };

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
        
        <header className="z-10 flex items-center justify-between bg-[#2500ba] px-5 py-4 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/10">
              <Truck size={16} />
            </div>
            <div>
              <p className="text-[11px] font-semibold">Trucker View</p>
              <p className="text-[10px] text-white/70">
                {receiverId} • {profile?.fullName || 'Oton Warehouse'}
              </p>
            </div>
          </div>
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded border border-white/80 bg-red-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-600 transition"
            >
              Sign out
            </button>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded border-2 border-white bg-red-500">
              <Truck size={18} />
            </div>
          )}
        </header>

        <div className="relative flex-1 overflow-hidden bg-[#f5f5f5]">
          
          <div className="absolute inset-0 z-0">
            <MapContainer center={currentPosition} zoom={14} scrollWheelZoom={false} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={currentPosition} recenterKey={recenterTrigger} />

              <CircleMarker
                center={destinationPosition}
                radius={8}
                pathOptions={{ color: '#ef4444', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
              >
                <Popup>{destinationName}</Popup>
              </CircleMarker>

              <CircleMarker
                center={currentPosition}
                radius={10}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#2500ba',
                  fillOpacity: 1
                }}
              >
                <Popup>{isInTransit ? `In Custody (${receiverId})` : 'Driver Location'}</Popup>
              </CircleMarker>

              {isInTransit && isValidCoordinate(currentPosition) && isValidCoordinate(destinationPosition) && (
                <RoadLockedDeliveryRoute
                  currentPosition={currentPosition}
                  destinationPosition={destinationPosition}
                />
              )}
            </MapContainer>
          </div>

          {/* Floating Toast when handover is confirmed */}
          {handoverToast && (
            <div className="absolute top-4 left-4 right-4 z-30 rounded-xl bg-emerald-600 p-3 text-white shadow-lg flex items-center gap-2 animate-bounce">
              <ShieldCheck size={18} className="flex-shrink-0" />
              <p className="text-[10px] font-bold leading-tight">{handoverToast}</p>
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

              {/* Collapsible Dropdown List */}
              {isDropdownOpen && (
                <div className="mt-2.5 max-h-[180px] space-y-2 overflow-y-auto border-t border-gray-100 pt-2.5 pr-1">
                  {activePackages.map((pkg, idx) => (
                    <div
                      key={pkg.drNumber || idx}
                      className="rounded-xl border border-gray-200 bg-gray-50/90 p-2.5 text-left text-xs transition hover:bg-white relative group"
                    >
                      <div className="flex items-center justify-between pr-5">
                        <span className="font-bold text-[#2500ba] text-[10.5px]">DR #{pkg.drNumber}</span>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-800">
                          {pkg.quantity} {pkg.category}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9.5px] text-gray-600">
                        <MapPin size={11} className="text-red-500 flex-shrink-0" />
                        <span className="truncate font-medium">To: {pkg.to}</span>
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
                  ))}

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

          {/* Recenter Button */}
          <button
            type="button"
            onClick={() => setRecenterTrigger((prev) => prev + 1)}
            className="absolute bottom-24 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2500ba] shadow-lg border border-gray-200 hover:bg-blue-50 active:scale-95 transition"
            title="Recenter Map on Driver"
            aria-label="Recenter Map"
          >
            <LocateFixed size={18} />
          </button>

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
              className="w-full rounded-full bg-[#2500ba] py-2.5 text-[10px] font-bold text-white shadow-sm hover:bg-blue-800 active:scale-[0.99] transition flex items-center justify-center gap-1.5"
            >
              <ScanLine size={13} />
              {isInTransit ? 'Scan Next Package / Pickup' : 'Pick up and Scan Now'}
            </button>
          </div>

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

          {step === 'verify' && (
            <Modal title="Verify Goods" icon={<ClipboardList />} onClose={() => nav('pickup')}>
              <p className="text-center text-[10px] text-[#2500ba]">DR: {activePayload?.drNumber}</p>
              <p className="text-center text-[10px] text-gray-500">{inventory.quantity} {inventory.category}</p>
              <div className="mt-4 space-y-2">
                <div className="rounded-lg bg-[#eceafa] p-3 text-[10px]">
                  GPS captured <Check size={13} className="float-right text-[#2500ba]" />
                </div>
                <div className="rounded-lg bg-[#eceafa] p-3 text-[10px]">
                  Sealed and untampered <Check size={13} className="float-right text-[#2500ba]" />
                </div>
              </div>
              <button
                onClick={() => nav('inventory')}
                className="mt-4 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white"
              >
                Verify and Update goods
              </button>
            </Modal>
          )}

          {step === 'inventory' && (
            <Modal title="Update Inventory" onClose={() => nav('verify')}>
              <label className="text-[10px] font-semibold">Item name</label>
              <input
                value={inventory.category}
                onChange={(e) => setInventory({ ...inventory, category: e.target.value })}
                className="mt-1 w-full rounded-lg border p-3 text-xs"
              />
              <label className="mt-3 block text-[10px] font-semibold">Amount</label>
              <input
                type="number"
                value={inventory.quantity}
                onChange={(e) => setInventory({ ...inventory, quantity: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border p-3 text-xs"
              />
              <label className="mt-3 block text-[10px] font-semibold">Remarks</label>
              <textarea
                value={inventory.remarks}
                onChange={(e) => setInventory({ ...inventory, remarks: e.target.value })}
                placeholder="Describe the current status of goods"
                className="mt-1 h-20 w-full resize-none rounded-lg border p-3 text-xs"
              />
              <button
                onClick={() => {
                  setInventory({ ...inventory, status: 'In transit' });
                  nav('success');
                }}
                className="mt-4 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white"
              >
                Done
              </button>
            </Modal>
          )}

          {/* Success Modal */}
          {step === 'success' && (
            <Modal title="Verification Successful!" icon={<ClipboardList />} onClose={() => nav('pickup')}>
              <p className="text-center text-[10px] text-gray-500">
                Inventory updated instantly<br />
                Status: <b className="text-[#2500ba]">{inventory.status}</b>
              </p>
              <button
                onClick={() => nav('arrived')}
                className="mt-5 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white"
              >
                Done
              </button>
            </Modal>
          )}

          {/* Arrived Modal */}
          {step === 'arrived' && (
            <Modal title="Shipment In Transit" icon={<ClipboardList />} onClose={() => nav('pickup')}>
              <p className="text-center text-[10px] text-gray-500">
                Shipment is now in transit.<br />
                {inventory.quantity} {inventory.category}
              </p>
              <button
                onClick={() => nav('pickup')}
                className="mt-5 w-full rounded-lg bg-[#2500ba] py-3 text-[10px] font-bold text-white"
              >
                View Live Map
              </button>
            </Modal>
          )}

          {/* Profile Modal */}
          {step === 'profile' && (
            <Modal title="Driver Profile" icon={<UserRound />} onClose={() => nav('pickup')}>
              <div className="mt-2 space-y-2 text-left text-xs">
                <div className="rounded-lg bg-gray-50 p-2.5 border">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Driver Name</p>
                  <p className="font-semibold text-gray-800">{profile?.fullName || 'Relief Driver'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Truck ID</p>
                  <p className="font-semibold text-gray-800">{receiverId}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5 border">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Wallet Address</p>
                  <p className="font-mono text-[10px] text-gray-800 truncate">{profile?.walletAddress || '0xReceiverWallet'}</p>
                </div>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="mt-4 w-full rounded-lg bg-red-500 py-2.5 text-xs font-bold text-white hover:bg-red-600 transition"
                >
                  Sign Out
                </button>
              )}
            </Modal>
          )}

        </div>

        {/* Bottom Navigation Bar (Original UI) */}
        <nav className="z-10 flex h-14 items-center justify-around border-t bg-white text-[#2500ba] shadow-sm">
          <button
            onClick={() => nav('pickup')}
            aria-label="Home"
            className={`p-2 transition ${step === 'pickup' ? 'text-[#2500ba]' : 'text-gray-400'}`}
          >
            <Home size={21} />
          </button>

          <button
            onClick={() => nav('scan')}
            aria-label="Scan"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#2500ba] text-white shadow-lg ring-4 ring-white active:scale-95 transition"
          >
            <ScanLine size={26} />
          </button>

          <button
            onClick={() => nav('profile')}
            aria-label="Profile"
            className={`p-2 transition ${step === 'profile' ? 'text-[#2500ba]' : 'text-gray-400'}`}
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
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#15131f]/90 p-5 text-white">
      <div className="flex items-center justify-between">
        <button onClick={onClose} aria-label="Back"><ChevronLeft /></button>
        <p className="text-xs font-bold">Scan Package QR Code</p>
        <Zap size={16} />
      </div>

      <div className="relative mx-auto mt-12 aspect-square w-full max-w-[250px] overflow-hidden rounded-2xl border-4 border-[#2500ba] bg-black">
        <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraOpen ? 'opacity-100' : 'opacity-25'}`} />
        {!cameraOpen && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ScanLine size={80} className="text-white animate-pulse" />
          </div>
        )}
        <div className="absolute left-5 right-5 top-1/2 h-0.5 bg-[#2500ba]" />
        {isSigning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="mt-2 text-[10px] text-white">Processing...</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-white/75">{message}</p>

      <button
        onClick={cameraOpen ? closeCamera : onStart}
        disabled={isSigning}
        className="mx-auto mt-4 rounded-full bg-white px-6 py-2.5 text-[10px] font-bold text-[#2500ba] disabled:opacity-50 hover:bg-gray-100 transition"
      >
        {cameraOpen ? 'Close camera' : 'Open camera'}
      </button>
    </div>
  );
}

export type { Inventory };
export { initialInventory };

