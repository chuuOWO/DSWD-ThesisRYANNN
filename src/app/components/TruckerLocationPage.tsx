'use client';

import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react';
import {
  Check,
  ChevronLeft,
  ClipboardList,
  Home,
  Loader2,
  LocateFixed,
  MapPin,
  Radio,
  ScanLine,
  ShieldCheck,
  Truck,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
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

const WAREHOUSE_POSITION: [number, number] = [10.6912, 122.4728];
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

const makeTemporaryQrPayload = (): QrPayload => {
  const token = Math.floor(1000 + Math.random() * 9000);
  return {
    drNumber: `TMP-DR-${token}`,
    handoverContractId: `TMP-HANDOVER-${token}`,
    category: 'Family Food Packs',
    quantity: 850,
    batchTokenIds: [`BATCH-TMP-${token}`],
    batchQuantities: [850],
    from: 'DSWD Oton Main Warehouse',
    to: 'Leon Municipal Office'
  };
};

const parseQrPayload = (value: string): QrPayload => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('QR code is empty.');

  try {
    const data = JSON.parse(trimmed) as Partial<QrPayload>;
    const batchTokenIds = Array.isArray(data.batchTokenIds) && data.batchTokenIds.length ? data.batchTokenIds.map(String) : [`BATCH-${Date.now()}`];
    const batchQuantities = Array.isArray(data.batchQuantities) && data.batchQuantities.length ? data.batchQuantities.map(Number) : [Number(data.quantity ?? 1)];

    return {
      drNumber: String(data.drNumber || `TMP-DR-${Date.now()}`),
      handoverContractId: String(data.handoverContractId || `HANDOVER-${Date.now()}`),
      category: String(data.category || 'Relief Goods'),
      quantity: Number(data.quantity ?? (batchQuantities.reduce((sum, amount) => sum + amount, 0) || 1)),
      batchTokenIds,
      batchQuantities,
      from: String(data.from || 'DSWD Oton Main Warehouse'),
      to: String(data.to || 'Leon Municipal Office')
    };
  } catch {
    return {
      ...makeTemporaryQrPayload(),
      batchTokenIds: [trimmed],
      handoverContractId: `HANDOVER-${trimmed}`
    };
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
  const receiverId = props.profile?.truckId || (typeof props.profile?.fullName === 'string' && props.profile.fullName.trim() ? props.profile.fullName.trim().replace(/\s+/g, '-').toUpperCase() : 'TRK-001');
  return (
    <TruckerErrorBoundary receiverId={receiverId} onSignOut={props.onSignOut}>
      <TruckerLocationPageContent {...props} />
    </TruckerErrorBoundary>
  );
}

function TruckerLocationPageContent({ profile, onSignOut }: TruckerLocationPageProps) {
  const receiverId = profile?.truckId || (typeof profile?.fullName === 'string' && profile.fullName.trim() ? profile.fullName.trim().replace(/\s+/g, '-').toUpperCase() : 'TRK-001');
  const storageKey = `trucker_active_delivery_${receiverId}`;

  const [step, setStep] = useState<Step>('pickup');
  const [inventory, setInventory] = useState(initialInventory);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Point your camera at the QR code.');
  const [manualQr, setManualQr] = useState('');
  
  const [activePayload, setActivePayload] = useState<QrPayload | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<QrPayload>;
          if (parsed && typeof parsed.drNumber === 'string') {
            return {
              drNumber: String(parsed.drNumber),
              handoverContractId: String(parsed.handoverContractId || `HANDOVER-${parsed.drNumber}`),
              category: String(parsed.category || 'Relief Goods'),
              quantity: Number(parsed.quantity ?? 1),
              batchTokenIds: Array.isArray(parsed.batchTokenIds) ? parsed.batchTokenIds.map(String) : [],
              batchQuantities: Array.isArray(parsed.batchQuantities) ? parsed.batchQuantities.map(Number) : [],
              from: String(parsed.from || 'DSWD Oton Main Warehouse'),
              to: String(parsed.to || 'Leon Municipal Office')
            };
          }
        }
      }
    } catch {
      // ignore corrupted storage
    }
    return null;
  });

  const [handoverToast, setHandoverToast] = useState<string | null>(null);
  const [location, setLocation] = useState<PhoneLocation | null>(null);
  const [release, setRelease] = useState<TruckerReleaseRecord | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const activePayloadRef = useRef<QrPayload | null>(activePayload);
  useEffect(() => {
    activePayloadRef.current = activePayload;
  }, [activePayload]);

  const lastProcessedLocRef = useRef<PhoneLocation | null>(null);
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
    return WAREHOUSE_POSITION;
  }, [location]);
  
  const isInTransit = Boolean(activePayload);

  // 1. Continuous Local GPS watcher (runs all the time, Maxim-style)
  useEffect(() => {
    getBrowserLocation()
      .then((loc) => {
        lastProcessedLocRef.current = loc;
        setLocation(loc);
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
        if (accuracy && accuracy > 50) return;

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

        lastProcessedLocRef.current = updatedLoc;
        setLocation(updatedLoc);

        // Broadcast to Supabase ONLY if in active custody
        const currentPayload = activePayloadRef.current;
        if (currentPayload) {
          void backendApi.upsertTruckLiveLocation({
            truck_id: receiverId,
            dr_number: currentPayload.drNumber,
            latitude: updatedLoc.latitude,
            longitude: updatedLoc.longitude,
            gps_text: formatGps(updatedLoc),
            accuracy: updatedLoc.accuracy ? Math.round(updatedLoc.accuracy) : null,
            tx_hash: `RCVR-SIG-${Date.now()}`,
            wallet_address: profile?.walletAddress || '0xReceiverWallet',
            proof_mode: 'signature',
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
  }, [profile?.walletAddress, receiverId]);

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
        const [releases, locations] = await Promise.all([
          backendApi.getTruckerReleases(),
          backendApi.getTruckLiveLocations()
        ]);

        if (!isSubscribed) return;
        const currentRelease = releases[0] ?? null;
        setRelease(currentRelease);

        const currentActive = activePayloadRef.current;
        const activeTruckLoc = locations.find(
          (loc) => loc.truck_id === receiverId && loc.proof_mode !== 'delivered'
        );

        if (currentActive) {
          // If we currently have active custody, check if recipient signed receipt in database
          const matchingReq = releases.find((r) => r.dr_number === currentActive.drNumber);
          const isDeliveredLoc = locations.find(
            (loc) => loc.truck_id === receiverId && loc.proof_mode === 'delivered' && loc.dr_number === currentActive.drNumber
          );

          if ((matchingReq && ['Accepted', 'Delivered'].includes(matchingReq.delivery_status)) || isDeliveredLoc) {
            try {
              localStorage.removeItem(storageKey);
            } catch {}
            setActivePayload(null);
            setInventory(initialInventory);
            setHandoverToast(`✓ Package ${currentActive.drNumber} was accepted by the recipient! Custody auto-cleared.`);
            setTimeout(() => setHandoverToast(null), 6000);
          }
        } else if (activeTruckLoc) {
          // Restore activePayload from database if trucker refreshed while in transit
          const matchingRelease = releases.find((r) => r.dr_number === activeTruckLoc.dr_number) || currentRelease;
          let restoredPayload: QrPayload;
          if (matchingRelease) {
            restoredPayload = releaseToPayload(matchingRelease);
          } else {
            restoredPayload = {
              drNumber: activeTruckLoc.dr_number,
              handoverContractId: `HANDOVER-${activeTruckLoc.dr_number}`,
              category: 'Relief Goods',
              quantity: 1,
              batchTokenIds: [`BATCH-${activeTruckLoc.dr_number}`],
              batchQuantities: [1],
              from: 'DSWD Oton Main Warehouse',
              to: 'Leon Municipal Office'
            };
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify(restoredPayload));
          } catch {}
          setActivePayload(restoredPayload);
          setInventory({
            batchTokenId: restoredPayload.batchTokenIds[0] ?? restoredPayload.handoverContractId,
            category: restoredPayload.category,
            quantity: restoredPayload.quantity,
            status: 'In transit',
            remarks: ''
          });
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
        console.warn('GPS lookup fallback in signAndShare:', gpsErr);
        nextLocation = location ?? {
          latitude: WAREHOUSE_POSITION[0],
          longitude: WAREHOUSE_POSITION[1],
          accuracy: 10,
          timestamp: new Date().toISOString()
        };
      }

      lastProcessedLocRef.current = nextLocation;
      setLocation(nextLocation);
      setRecenterTrigger((prev) => prev + 1);

      try {
        await backendApi.upsertTruckLiveLocation({
          truck_id: receiverId,
          dr_number: payload.drNumber,
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
          gps_text: formatGps(nextLocation),
          accuracy: nextLocation.accuracy ? Math.round(nextLocation.accuracy) : null,
          tx_hash: `RCVR-SIG-${Date.now()}`,
          wallet_address: profile?.walletAddress || '0xReceiverWallet',
          proof_mode: 'signature',
          updated_at: new Date().toISOString()
        });
      } catch (apiErr) {
        console.warn('Supabase upsert live location error:', apiErr);
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {}

      setActivePayload(payload);
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
      setCameraMessage('Camera unavailable. Use manual input or test scan.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const Detector = (window as BarcodeDetectorWindow).BarcodeDetector;
      if (!Detector) {
        setCameraMessage('Camera is ready. Use manual input or test scan.');
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
      setCameraMessage('Camera permission was denied. Use manual input or test scan.');
    }
  };

  const handleTemporaryScan = () => {
    if (release) {
      void signAndShare(releaseToPayload(release));
      return;
    }
    void signAndShare(makeTemporaryQrPayload());
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
                <Polyline
                  positions={[WAREHOUSE_POSITION, currentPosition, destinationPosition]}
                  pathOptions={{ color: '#2500ba', weight: 4, opacity: 0.8, dashArray: '6, 6' }}
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

          {/* Active Custody Floating Popup (When carrying package) */}
          {isInTransit && activePayload && (
            <div className="absolute left-4 right-4 top-4 z-10 rounded-xl bg-white/95 p-3.5 shadow-lg border-2 border-emerald-500/30 backdrop-blur-sm transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                    <Radio size={14} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-bold text-gray-900">Package in Active Custody</p>
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <p className="text-[10px] font-semibold text-[#2500ba] mt-0.5">
                      DR #{activePayload.drNumber} • {activePayload.quantity} {activePayload.category}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] text-gray-600 mt-1">
                      <MapPin size={11} className="text-red-500 flex-shrink-0" />
                      <span className="font-medium truncate">To: {activePayload.to}</span>
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 whitespace-nowrap">
                  LIVE GPS ON
                </span>
              </div>
              <p className="mt-2 text-[8.5px] text-gray-400 italic">
                * Custody will automatically clear when the destination officer scans & accepts receipt.
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
              <span>{isInTransit ? '1 package in custody' : 'Map Live • Standby'}</span>
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
              manualQr={manualQr}
              setManualQr={setManualQr}
              onManual={() => handleQrValue(manualQr)}
              onTemporaryScan={handleTemporaryScan}
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
  manualQr,
  setManualQr,
  onManual,
  onTemporaryScan,
  cameraOpen,
  closeCamera,
  videoRef,
  message,
  isSigning
}: {
  onClose: () => void;
  onStart: () => void;
  manualQr: string;
  setManualQr: (value: string) => void;
  onManual: () => void;
  onTemporaryScan: () => void;
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
        <p className="text-xs font-bold">Scan QR code</p>
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
        className="mx-auto mt-3 rounded-full bg-white px-6 py-2.5 text-[10px] font-bold text-[#2500ba] disabled:opacity-50"
      >
        {cameraOpen ? 'Close camera' : 'Open camera'}
      </button>

      <button
        type="button"
        onClick={onTemporaryScan}
        disabled={isSigning}
        className="mx-auto mt-2 rounded-full bg-[#2500ba] px-6 py-2.5 text-[10px] font-bold text-white shadow hover:bg-blue-800 disabled:opacity-50"
      >
        {isSigning ? 'Signing...' : 'Temporary scan package'}
      </button>

      <div className="mx-auto mt-auto w-full max-w-[310px] rounded-xl bg-white p-3 text-[#15132d]">
        <p className="mb-1 text-[10px] font-bold text-[#2500ba]">Manual QR fallback</p>
        <input
          value={manualQr}
          onChange={(e) => setManualQr(e.target.value)}
          placeholder="Paste token ID or JSON payload"
          className="w-full rounded-lg border p-2.5 text-[10px]"
        />
        <button
          onClick={onManual}
          disabled={isSigning}
          className="mt-2 w-full rounded-lg bg-[#2500ba] py-2.5 text-[10px] font-bold text-white disabled:opacity-50"
        >
          Use scanned value
        </button>
      </div>
    </div>
  );
}

export type { Inventory };
export { initialInventory };

