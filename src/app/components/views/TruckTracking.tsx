import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { CheckCircle, Clock, Navigation, Route, Truck } from 'lucide-react';
import type { OutgoingRelease } from '../../hooks/useInventoryState';
import { backendApi, type TruckLiveLocation, type TruckerReleaseRecord } from '../../services/backendApi';
import { authApi, type UserProfile } from '../../services/authApi';
import { findPanayLgu } from '../../data/panayLguDirectory';

type TruckStatus = 'In Transit' | 'Loading' | 'Delivered';

interface TruckPackageInfo {
  drNumber: string;
  destination: string;
  quantity: number;
  category: string;
  coords: [number, number] | null;
}

interface TruckRoute {
  id: string;
  truckName: string;
  driver: string;
  status: TruckStatus;
  origin: string;
  destination: string;
  cargo: string;
  eta: string;
  updatedAt: string;
  originPosition: [number, number];
  position: [number, number];
  destinationPosition: [number, number] | null;
  assignedPackagesList: TruckPackageInfo[];
  isLive: boolean;
  accuracy?: number | null;
  progress: number;
  checkpoints: {
    label: string;
    time: string;
    note: string;
    completed: boolean;
  }[];
}

interface RouteMetrics {
  distanceKm: number;
  durationMinutes: number;
}

type RoutingControlWithEvents = L.Routing.Control & {
  on: (eventName: 'routesfound' | 'routingerror', handler: (event: {
    routes?: Array<{
      coordinates?: L.LatLng[];
      summary?: {
        totalDistance?: number;
        totalTime?: number;
      };
    }>;
  }) => void) => RoutingControlWithEvents;
};

const statusColors: Record<TruckStatus, string> = {
  'In Transit': '#1d00c8',
  Loading: '#d97706',
  Delivered: '#16a34a'
};

const WAREHOUSE_COORDS: Record<string, [number, number]> = {
  'dswd oton warehouse': [10.6912, 122.4728],
  'oton warehouse': [10.6912, 122.4728],
  'dswd pototan warehouse': [10.9435, 122.6369],
  'pototan warehouse': [10.9435, 122.6369]
};

const LGU_COORDS: Record<string, [number, number]> = {
  leon: [10.787, 122.3892],
  miagao: [10.6445, 122.2367],
  'barotac nuevo': [10.894, 122.7042],
  'iloilo city': [10.7202, 122.5621],
  oton: [10.6931, 122.4738],
  pototan: [10.9435, 122.6369],
  'san miguel': [10.78, 122.4658],
  'santa barbara': [10.8231, 122.5341],
  passi: [11.1078, 122.6419],
  sara: [11.257, 123.0147],
  dumangas: [10.825, 122.7136]
};

const ADMIN_MAX_ACCEPTED_ACCURACY_METERS = 120;
const ADMIN_STATIONARY_THRESHOLD_METERS = 12;
const ADMIN_SMOOTHING_DISTANCE_METERS = 90;
const ADMIN_SMOOTHING_FACTOR = 0.35;
const ACTIVE_LOCATION_MAX_AGE_MS = 20 * 60 * 1000;

const normalizeKey = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const findCoords = (lookup: Record<string, [number, number]>, value?: string | null) => {
  const normalized = normalizeKey(value);
  if (!normalized) return null;
  return lookup[normalized] ?? Object.entries(lookup).find(([key]) => normalized.includes(key))?.[1] ?? null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

const shortWallet = (address?: string | null) => {
  if (!address) return 'Receiver account';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const isActiveReceiverLocation = (location: TruckLiveLocation) => {
  if (!location || !location.truck_id) return false;
  if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return false;
  return true;
};

const getTruckDistanceMeters = (
  from: Pick<TruckLiveLocation, 'latitude' | 'longitude'>,
  to: Pick<TruckLiveLocation, 'latitude' | 'longitude'>
) => L.latLng(from.latitude, from.longitude).distanceTo(L.latLng(to.latitude, to.longitude));

const stabilizeLiveLocation = (
  previous: TruckLiveLocation | undefined,
  incoming: TruckLiveLocation
): TruckLiveLocation => {
  if (!previous) return incoming;
  return incoming;
};

const releaseByDrNumber = (
  releases: TruckerReleaseRecord[],
  outgoingReleasesList: OutgoingRelease[],
  drNumber?: string | null
) => {
  if (!drNumber) return undefined;
  return releases.find((release) => release.dr_number === drNumber)
    ?? outgoingReleasesList.find((release) => release.drNumber === drNumber);
};

const getReleaseValue = (release: TruckerReleaseRecord | OutgoingRelease | undefined, snakeKey: keyof TruckerReleaseRecord, camelKey: keyof OutgoingRelease) => {
  if (!release) return undefined;
  return (release as TruckerReleaseRecord)[snakeKey] ?? (release as OutgoingRelease)[camelKey];
};

const getProgress = (location: TruckLiveLocation, destination: [number, number] | null) => {
  if (!destination) return 0;
  const current = L.latLng(location.latitude, location.longitude);
  const end = L.latLng(destination[0], destination[1]);
  const distanceToDestination = current.distanceTo(end);
  const roughTotal = Math.max(distanceToDestination + 2500, 1);
  return Math.min(95, Math.max(5, Math.round(100 - (distanceToDestination / roughTotal) * 100)));
};

const toTruckRoute = (
  location: TruckLiveLocation,
  releases: TruckerReleaseRecord[],
  outgoingReleasesList: OutgoingRelease[]
): TruckRoute => {
  const uniqueMap = new Map<string, TruckerReleaseRecord>();
  // 1. Fresh releases from getTruckerReleases (direct query from outgoing_requests)
  for (const rel of releases) {
    if (rel.dr_number) {
      uniqueMap.set(rel.dr_number, rel);
    }
  }

  // 2. Supplement and merge with outgoingReleasesList
  for (const r of outgoingReleasesList) {
    const existing = uniqueMap.get(r.drNumber);
    const mapped: TruckerReleaseRecord = {
      dr_number: r.drNumber,
      lgu_name: r.lguName,
      municipality: r.municipality,
      province: r.province,
      category: r.fnfiCategory,
      amount_approved: r.amountApproved,
      amount_requested: r.amountRequested,
      warehouse_source: r.warehouseSource,
      delivery_status: r.deliveryStatus,
      assigned_truck_id: r.assignedTruckId ?? r.assigned_truck_id,
      tx_hash: r.blockchainTxHash,
      wallet_address: undefined,
      receiver_gps: r.receiverGps,
      destination_address: r.destinationAddress
    };

    if (!existing) {
      uniqueMap.set(r.drNumber, mapped);
    } else {
      const assignedId = existing.assigned_truck_id || mapped.assigned_truck_id;
      const status = (existing.delivery_status === 'In Transit' || mapped.delivery_status === 'In Transit')
        ? 'In Transit'
        : (existing.delivery_status || mapped.delivery_status);

      uniqueMap.set(r.drNumber, {
        ...mapped,
        ...existing,
        assigned_truck_id: assignedId,
        delivery_status: status
      });
    }
  }

  const assignedPackages = Array.from(uniqueMap.values()).filter((r) => {
    if (!r.assigned_truck_id || !location.truck_id) return false;
    return r.assigned_truck_id.trim().toUpperCase() === location.truck_id.trim().toUpperCase();
  });

  const activeAssigned = assignedPackages.filter((r) => !['Delivered', 'Accepted', 'Distributed', 'Cancelled'].includes(r.delivery_status ?? ''));

  let origin = 'DSWD Oton Warehouse';
  let destination = 'Assigned LGU';
  let cargo = 'Standby (0 active packages)';
  let status: TruckStatus = 'Loading';

  const assignedPackagesList: TruckPackageInfo[] = activeAssigned.map((pkg) => {
    let coords: [number, number] | null = null;
    const destText = pkg.destination_address || pkg.lgu_name || pkg.municipality || '';
    const lguLookup = findPanayLgu(destText, pkg.province);
    if (lguLookup) {
      coords = [lguLookup.lat, lguLookup.lng];
    } else if (pkg.receiver_gps) {
      const parts = pkg.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords = [parts[0], parts[1]];
      }
    }
    return {
      drNumber: pkg.dr_number,
      destination: destText || 'Assigned LGU',
      quantity: Number(pkg.amount_approved ?? pkg.amount_requested ?? 0),
      category: pkg.category || 'Relief goods',
      coords
    };
  });

  if (activeAssigned.length > 0) {
    const origins = Array.from(new Set(activeAssigned.map((r) => String(r.warehouse_source || 'DSWD Oton Warehouse'))));
    origin = origins.join(', ');

    const destinations = Array.from(new Set(activeAssigned.map((r) => String(r.destination_address || r.lgu_name || r.municipality || 'Assigned LGU'))));
    destination = destinations.join(', ');

    status = 'In Transit';

    const cargoItems = activeAssigned.map((r) => {
      const qty = Number(r.amount_approved ?? r.amount_requested ?? 0);
      const cat = String(r.category || 'Relief goods');
      const dest = String(r.lgu_name || r.municipality || '');
      const prefix = qty > 0 ? `${qty} ${cat}` : cat;
      return dest ? `${prefix} (${dest})` : prefix;
    });

    if (cargoItems.length > 1) {
      cargo = `${cargoItems.length} Packages: ${cargoItems.join(', ')}`;
    } else {
      cargo = cargoItems[0] || 'Relief goods';
    }
  } else if (assignedPackages.length > 0) {
    status = 'Delivered';
    cargo = 'All assigned packages delivered';
    destination = 'Delivered';
  }

  const originPosition = findCoords(WAREHOUSE_COORDS, origin) ?? WAREHOUSE_COORDS['dswd oton warehouse'];
  
  // Destination position is strictly from the primary active package's pinned coordinates
  const primaryPackageWithCoords = assignedPackagesList.find((p) => p.coords !== null);
  const destinationPosition = primaryPackageWithCoords?.coords ?? null;

  const progress = status === 'Delivered' ? 100 : (activeAssigned.length > 0 && destinationPosition ? getProgress(location, destinationPosition) : 0);

  const activeDrs = activeAssigned.map((r) => r.dr_number);
  const releaseLabel = activeDrs.length > 1
    ? `${activeDrs.length} Packages (${activeDrs.join(', ')})`
    : (activeDrs.length === 1 ? `Release ${activeDrs[0]}` : 'No active package assigned');

  const latestTx = activeAssigned.find((r) => r.tx_hash)?.tx_hash;

  return {
    id: location.truck_id,
    truckName: location.truck_id,
    driver: shortWallet(location.wallet_address),
    status,
    origin,
    destination,
    cargo,
    eta: 'Calculating...',
    updatedAt: formatDateTime(location.updated_at),
    originPosition,
    position: [location.latitude, location.longitude],
    destinationPosition,
    assignedPackagesList,
    isLive: true,
    accuracy: location.accuracy,
    progress,
    checkpoints: [
      {
        label: 'Live phone GPS',
        time: formatDateTime(location.updated_at),
        note: `Captured at ${location.gps_text}${location.accuracy ? `, accuracy ±${Math.round(location.accuracy)}m` : ''}`,
        completed: true
      },
      {
        label: releaseLabel,
        time: latestTx ? 'MetaMask proof recorded' : (activeDrs.length > 0 ? 'Assigned and in transit' : 'Standby'),
        note: latestTx ? `TX ${latestTx.slice(0, 10)}...` : (activeDrs.length > 0 ? `${activeDrs.length} package(s) loaded` : 'Awaiting assignment'),
        completed: Boolean(latestTx || activeDrs.length > 0)
      },
      {
        label: `Destination: ${destination}`,
        time: status === 'Delivered' ? 'Delivered' : (activeAssigned.length > 0 ? 'In Transit' : 'Standby'),
        note: status === 'Delivered'
          ? 'Delivery completed'
          : (destinationPosition
            ? `Pinned GPS: ${destinationPosition[0].toFixed(4)}, ${destinationPosition[1].toFixed(4)}`
            : (activeAssigned.length > 0 ? 'Destination drop-off pin not set' : 'Ready for pickup')),
        completed: status === 'Delivered'
      }
    ]
  };
};

function RoadSnappedRoute({ route, onRouteDataChange }: { route: TruckRoute; onRouteDataChange: (data: RouteMetrics | null) => void }) {
  const map = useMap();

  useEffect(() => {
    onRouteDataChange(null);

    if (!route.destinationPosition || route.status !== 'In Transit') {
      return;
    }

    const control = L.Routing.control({
      waypoints: [L.latLng(route.position), L.latLng(route.destinationPosition)],
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving'
      }),
      lineOptions: {
        styles: [
          { color: '#ffffff', opacity: 0.9, weight: 8 },
          { color: statusColors[route.status] || '#2500ba', opacity: 1, weight: 4.5 }
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0
      },
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      show: false,
      createMarker: () => null
    } as L.Routing.RoutingControlOptions).addTo(map) as RoutingControlWithEvents;

    control.on('routesfound', (event) => {
      const osrmRoute = event.routes?.[0];
      const summary = osrmRoute?.summary;
      if (!summary?.totalDistance || !summary?.totalTime) return;

      onRouteDataChange({
        distanceKm: summary.totalDistance / 1000,
        durationMinutes: Math.round(summary.totalTime / 60)
      });
    });

    control.on('routingerror', () => onRouteDataChange(null));

    return () => {
      map.removeControl(control);
    };
  }, [map, onRouteDataChange, route.position[0], route.position[1], route.destinationPosition?.[0], route.destinationPosition?.[1], route.status]);

  return null;
}

function MapRefCapture({ mapRef }: { mapRef?: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    if (mapRef) {
      mapRef.current = map;
    }
  }, [map, mapRef]);
  return null;
}

function MapCameraController({ selectedRoute }: { selectedRoute: TruckRoute | undefined }) {
  // Intentionally empty — camera moves are triggered only by explicit user button clicks.
  void selectedRoute;
  return null;
}


const createTruckIcon = (status: TruckStatus, isSelected: boolean) => L.divIcon({
  className: 'truck-marker-clean',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
      ${status === 'In Transit' ? '<div style="position: absolute; top: -4px; left: 50%; transform: translateX(-50%); width: 44px; height: 44px; border-radius: 50%; background: #2500ba; opacity: 0.22; animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>' : ''}
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #2500ba;
        border: ${isSelected ? '3px solid #38bdf8' : '2.5px solid #ffffff'};
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

const createDestPinIcon = (isPrimary: boolean) => L.divIcon({
  className: 'dest-marker-clean',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: ${isPrimary ? '#dc2626' : '#2500ba'};
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px ${isPrimary ? 'rgba(220,38,38,0.4)' : 'rgba(37,0,186,0.35)'}, 0 2px 4px rgba(0,0,0,0.1);
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
      <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid ${isPrimary ? '#dc2626' : '#2500ba'}; margin-top: -1px; z-index: 1;"></div>
      <div style="width: 8px; height: 2px; background: rgba(15,23,42,0.2); border-radius: 50%; margin-top: 1px;"></div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  popupAnchor: [0, -36]
});

function RouteMap({
  routes,
  selectedRoute,
  heightClass,
  onRouteDataChange,
  mapRef: externalMapRef
}: {
  routes: TruckRoute[];
  selectedRoute?: TruckRoute;
  heightClass: string;
  onRouteDataChange: (data: RouteMetrics | null) => void;
  mapRef?: React.MutableRefObject<L.Map | null>;
}) {
  const internalMapRef = useRef<L.Map | null>(null);
  const mapRef = externalMapRef || internalMapRef;
  const center = selectedRoute?.position ?? routes[0]?.position ?? [10.72, 122.51];

  return (
    <div className="relative w-full">
      <MapContainer key={selectedRoute ? selectedRoute.id : 'all-trucks'} center={center} zoom={13} scrollWheelZoom className={`${heightClass} w-full`}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapRefCapture mapRef={mapRef} />
        <MapCameraController selectedRoute={selectedRoute} />
        {selectedRoute && selectedRoute.destinationPosition && <RoadSnappedRoute route={selectedRoute} onRouteDataChange={onRouteDataChange} />}

        {/* Destination pins for selected truck */}
        {selectedRoute && selectedRoute.assignedPackagesList.map((pkg, idx) => {
          if (!pkg.coords) return null;
          const isPrimary = idx === 0;
          return (
            <Marker
              key={`${selectedRoute.id}-${pkg.drNumber}`}
              position={pkg.coords}
              icon={createDestPinIcon(isPrimary)}
            >
              <Popup>
                <div className="min-w-40 font-sans p-0.5">
                  <p className={`font-bold text-xs ${isPrimary ? 'text-red-700' : 'text-indigo-700'}`}>
                    {isPrimary ? 'Primary Destination (Active Route)' : 'Assigned Destination'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{pkg.destination}</p>
                  <p className="text-xs font-mono text-gray-600 mt-0.5">DR #{pkg.drNumber} &bull; {pkg.quantity} {pkg.category}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{pkg.coords[0].toFixed(6)}, {pkg.coords[1].toFixed(6)}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Live Truck Markers */}
        {routes.map((route) => (
          <Marker
            key={route.id}
            position={route.position}
            icon={createTruckIcon(route.status, selectedRoute?.id === route.id)}
          >
            <Popup>
              <div className="min-w-44 font-sans p-0.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">{route.truckName}</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                    {route.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{route.driver}</p>
                <p className="mt-1.5 text-xs text-gray-700">Destination: <strong className="text-gray-900">{route.destination}</strong></p>
                <p className="mt-1 text-xs text-gray-700">Cargo: <span className="font-medium">{route.cargo}</span></p>
                <p className="mt-1 font-mono text-[10px] text-gray-500">
                  GPS: {route.position[0].toFixed(6)}, {route.position[1].toFixed(6)}
                </p>
                {route.accuracy != null && (
                  <p className="text-[10px] font-semibold text-emerald-600">
                    Accuracy: &plusmn;{Math.round(route.accuracy)}m (Phone GNSS)
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Utility Controls */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => {
            if (!mapRef.current) return;
            if (routes.length === 0) return;
            const bounds = L.latLngBounds(routes.map(r => [r.position[0], r.position[1]]));
            mapRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
          }}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          Fit Fleet
        </button>
        <button
          onClick={() => {
            if (!selectedRoute || !mapRef.current) return;
            mapRef.current.setView([selectedRoute.position[0], selectedRoute.position[1]], 16, { animate: true });
          }}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          Locate
        </button>
        <button
          onClick={() => mapRef.current?.setView([11.0, 122.5], 9, { animate: true })}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          Overview
        </button>
      </div>
    </div>
  );
}


function EmptyTracker() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Truck className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-lg font-bold text-blue-900">No active receiver tracking yet</h1>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-gray-600">
        The map will populate after a receiver scans/signs a package and shares a live GPS update from the mobile view.
      </p>
    </div>
  );
}

export function TruckTracking({ outgoingReleasesList = [] }: { outgoingReleasesList?: OutgoingRelease[] }) {
  const [liveLocations, setLiveLocations] = useState<Record<string, TruckLiveLocation>>({});
  const [releases, setReleases] = useState<TruckerReleaseRecord[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    authApi.getAllProfiles().then(setProfiles).catch(() => {});
    const unsubProfiles = authApi.subscribeProfiles(() => {
      authApi.getAllProfiles().then(setProfiles).catch(() => {});
    });
    return () => {
      unsubProfiles();
    };
  }, []);

  const lguReceiverIdentifiers = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => {
      if (p.lguName && p.lguName.trim()) {
        if (p.truckId) set.add(p.truckId.toUpperCase());
        if (p.fullName) set.add(p.fullName.trim().replace(/\s+/g, '-').toUpperCase());
        if (p.email) set.add(p.email.split('@')[0].toUpperCase());
        if (p.id) set.add(`RCVR-${p.id.slice(0, 6).toUpperCase()}`);
      }
    });
    return set;
  }, [profiles]);

  const isLguReceiverId = useCallback((truckId?: string | null) => {
    if (!truckId) return false;
    const upper = truckId.toUpperCase();
    if (lguReceiverIdentifiers.has(upper)) return true;
    if (upper.includes('HANDLER') || upper.includes('LGU')) return true;
    return false;
  }, [lguReceiverIdentifiers]);

  useEffect(() => {
    const refreshReleases = () => {
      backendApi.getTruckerReleases()
        .then(setReleases)
        .catch((error) => console.error('Failed to load trucker releases', error));
    };

    const refreshTrucks = () => {
      backendApi.getTruckLiveLocations()
        .then((locations) => {
          const initialMap: Record<string, TruckLiveLocation> = {};
          locations.forEach((loc) => {
            if (loc.truck_id) {
              initialMap[loc.truck_id] = loc;
            }
          });
          setLiveLocations((current) => ({ ...initialMap, ...current }));
        })
        .catch((err) => console.error('Failed to load initial truck locations', err));
    };

    refreshReleases();
    refreshTrucks();

    const unsubTrucks = backendApi.subscribeTruckLiveLocations(
      (location) => {
        setLiveLocations((current) => {
          const nextLocation = stabilizeLiveLocation(current[location.truck_id], location);
          return { ...current, [location.truck_id]: nextLocation };
        });
      },
      (deletedTruckId) => {
        setLiveLocations((current) => {
          const copy = { ...current };
          delete copy[deletedTruckId];
          return copy;
        });
      }
    );

    const unsubDashboard = backendApi.subscribeDashboard(() => {
      refreshReleases();
    });

    const pollTimer = setInterval(() => {
      refreshReleases();
      refreshTrucks();
    }, 3500);

    return () => {
      unsubTrucks();
      unsubDashboard();
      clearInterval(pollTimer);
    };
  }, []);

  const liveTruckRoutes = useMemo(() => Object.values(liveLocations)
    .filter(isActiveReceiverLocation)
    .filter((loc) => !isLguReceiverId(loc.truck_id))
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .map((location) => toTruckRoute(location, releases, outgoingReleasesList)), [liveLocations, releases, outgoingReleasesList, isLguReceiverId]);

  useEffect(() => {
    if (!liveTruckRoutes.length) {
      setSelectedTruckId('');
      return;
    }

    if (!selectedTruckId || !liveTruckRoutes.some((route) => route.id === selectedTruckId)) {
      setSelectedTruckId(liveTruckRoutes[0].id);
    }
  }, [liveTruckRoutes, selectedTruckId]);

  const selectedTruck = liveTruckRoutes.find((route) => route.id === selectedTruckId) ?? liveTruckRoutes[0];

  const handleRouteDataChange = useCallback((data: RouteMetrics | null) => {
    setRouteMetrics(data ? { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes } : null);
  }, []);

  const activeReleases = useMemo(() => {
    return outgoingReleasesList.filter((r) => ['Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus));
  }, [outgoingReleasesList]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trucking & Live GPS Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time GPS stream of active delivery trucks and receivers across Iloilo.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{liveTruckRoutes.length} Active Live GPS</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-700">
            <Truck className="w-3.5 h-3.5" />
            <span>{activeReleases.length} In-Transit Shipments</span>
          </div>
        </div>
      </div>

      {!selectedTruck ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3 shadow-inner">
                <Truck className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">No Receivers Currently Streaming Live GPS</h2>
              <p className="text-sm text-gray-500 max-w-md mt-1">
                When a receiver scans a package QR on their phone or clicks "Pick up and Scan", their live road route will appear here in real-time.
              </p>
            </div>
          </div>

          {activeReleases.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-4">Pending Outgoing Releases for Pickup</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs font-bold uppercase text-gray-400">
                      <th className="pb-3">DR Number</th>
                      <th className="pb-3">Destination</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeReleases.map((item) => (
                      <tr key={item.drNumber} className="hover:bg-gray-50">
                        <td className="py-3 font-mono font-bold text-blue-800">{item.drNumber}</td>
                        <td className="py-3 font-semibold text-gray-800">{item.lguName || item.municipality}</td>
                        <td className="py-3 text-gray-600">{item.fnfiCategory}</td>
                        <td className="py-3 font-semibold text-gray-900">{item.amountApproved.toLocaleString()}</td>
                        <td className="py-3">
                          <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            {item.deliveryStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* Left Column: Truck details and checkpoints */}
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-blue-900">{selectedTruck.truckName}</h2>
                  <p className="text-xs font-semibold text-gray-500">{selectedTruck.driver || 'Active Receiver'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {selectedTruck.status}
                </span>
              </div>

              {liveTruckRoutes.length > 1 && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Select Active Truck</label>
                  <div className="mt-2 space-y-1.5">
                    {liveTruckRoutes.map((route) => (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => setSelectedTruckId(route.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition text-left border ${
                          selectedTruckId === route.id ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span>{route.truckName} ({route.destination})</span>
                        <span className="text-blue-700 font-mono">{route.progress}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 p-3.5 space-y-2 border border-blue-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Origin:</span>
                  <span className="font-bold text-gray-800">{selectedTruck.origin}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Destination:</span>
                  <span className="font-bold text-blue-800">{selectedTruck.destination}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Cargo:</span>
                  <span className="font-bold text-gray-800">{selectedTruck.cargo}</span>
                </div>
              </div>

              {selectedTruck.assignedPackagesList.length > 1 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-purple-900 uppercase">
                    Assigned Packages ({selectedTruck.assignedPackagesList.length})
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedTruck.assignedPackagesList.map((pkg, idx) => (
                      <div key={pkg.drNumber} className="bg-white rounded-md p-2 border border-purple-100 text-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#2500ba]">DR #{pkg.drNumber}</span>
                            {idx === 0 && <span className="text-[8px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold uppercase">Active Route</span>}
                          </div>
                          <p className="text-[10px] text-gray-500 truncate max-w-[180px]">To: {pkg.destination}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {pkg.quantity} {pkg.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-blue-600" /> Distance
                  </span>
                  <p className="mt-1 text-base font-bold text-gray-900">
                    {selectedTruck.status !== 'In Transit'
                      ? 'Standby'
                      : (routeMetrics ? `${routeMetrics.distanceKm.toFixed(1)} km` : (selectedTruck.destinationPosition ? 'Calculating...' : 'No Pin'))}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Drive Time
                  </span>
                  <p className="mt-1 text-base font-bold text-gray-900">
                    {selectedTruck.status !== 'In Transit'
                      ? 'Standby'
                      : (routeMetrics ? formatDuration(routeMetrics.durationMinutes) : (selectedTruck.destinationPosition ? 'Calculating...' : 'No Pin'))}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                  <span>Progress</span>
                  <span className="text-blue-800">{selectedTruck.progress}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${selectedTruck.progress}%` }} />
                </div>
              </div>
            </div>

            {/* Checkpoints */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery Checkpoints</h3>
              <div className="space-y-3">
                {selectedTruck.checkpoints.map((checkpoint, index) => (
                  <div key={`${selectedTruck.id}-${checkpoint.label}`} className="flex items-start gap-3 relative pb-2">
                    {index < selectedTruck.checkpoints.length - 1 && (
                      <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      checkpoint.completed ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{checkpoint.label}</p>
                      <p className="text-[11px] text-gray-500">{checkpoint.time}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{checkpoint.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Full Interactive Road-Snapped Map */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-gray-800">Live Road Map: {selectedTruck.origin} → {selectedTruck.destination}</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">Updated: {selectedTruck.updatedAt}</span>
            </div>

            {/* Horizontal Fleet Card Strip */}
            {liveTruckRoutes.length > 0 && (
              <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-200 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 mr-1">Fleet:</span>
                {liveTruckRoutes.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => {
                      setSelectedTruckId(route.id);
                      mapRef.current?.setView([route.position[0], route.position[1]], 14, { animate: true });
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      selectedTruckId === route.id
                        ? 'bg-[#2500ba] text-white border-[#2500ba] shadow-sm font-bold'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#2500ba]/40 font-medium'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${selectedTruckId === route.id ? 'bg-white animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                    <span>{route.truckName}</span>
                    <span className={`text-[10px] ${selectedTruckId === route.id ? 'text-white/80' : 'text-gray-400'}`}>
                      ({route.destination})
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-[560px]">
              <RouteMap
                routes={liveTruckRoutes}
                selectedRoute={selectedTruck}
                heightClass="h-[560px]"
                onRouteDataChange={handleRouteDataChange}
                mapRef={mapRef}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
