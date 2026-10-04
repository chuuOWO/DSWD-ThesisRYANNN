import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  CheckCircle,
  Clock,
  Navigation,
  Route,
  Truck,
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
  Package,
  Layers,
  ListOrdered
} from 'lucide-react';
import type { OutgoingRelease } from '../../hooks/useInventoryState';
import { backendApi, type TruckLiveLocation, type ReceiverReleaseRecord } from '../../services/backendApi';
import { authApi, type UserProfile } from '../../services/authApi';
import { findPanayLgu } from '../../data/panayLguDirectory';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';

type TruckStatus = 'In Transit' | 'Loading' | 'Delivered';

interface TruckPackageInfo {
  drNumber: string;
  destination: string;
  quantity: number;
  category: string;
  coords: [number, number] | null;
  priorityOrder?: number;
  isHeld?: boolean;
}

interface TruckRoute {
  id: string;
  truckName: string;
  driver: string;
  driverName?: string;
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
  releases: ReceiverReleaseRecord[],
  outgoingReleasesList: OutgoingRelease[],
  drNumber?: string | null
) => {
  if (!drNumber) return undefined;
  return releases.find((release) => release.dr_number === drNumber)
    ?? outgoingReleasesList.find((release) => release.drNumber === drNumber);
};

const getReleaseValue = (release: ReceiverReleaseRecord | OutgoingRelease | undefined, snakeKey: keyof ReceiverReleaseRecord, camelKey: keyof OutgoingRelease) => {
  if (!release) return undefined;
  return (release as ReceiverReleaseRecord)[snakeKey] ?? (release as OutgoingRelease)[camelKey];
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
  releases: ReceiverReleaseRecord[],
  outgoingReleasesList: OutgoingRelease[],
  priorityMap: Record<string, number> = {},
  heldMap: Record<string, boolean> = {},
  profiles: UserProfile[] = []
): TruckRoute => {
  const matchingProfile = profiles.find((p) =>
    (p.truckId && p.truckId.trim().toUpperCase() === location.truck_id.trim().toUpperCase()) ||
    (location.wallet_address && p.walletAddress && p.walletAddress.trim().toLowerCase() === location.wallet_address.trim().toLowerCase())
  );
  const driverName = matchingProfile?.fullName;

  const uniqueMap = new Map<string, ReceiverReleaseRecord>();
  // 1. Fresh releases from getReceiverReleases (direct query from outgoing_requests)
  for (const rel of releases) {
    if (rel.dr_number) {
      uniqueMap.set(rel.dr_number, rel);
    }
  }

  // 2. Supplement and merge with outgoingReleasesList
  for (const r of outgoingReleasesList) {
    const existing = uniqueMap.get(r.drNumber);
    const mapped: ReceiverReleaseRecord = {
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
      destination_address: r.destinationAddress,
      delivery_priority: undefined,
      is_held: undefined
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
        receiver_gps: existing.receiver_gps || mapped.receiver_gps,
        destination_address: existing.destination_address || mapped.destination_address,
        municipality: existing.municipality || mapped.municipality,
        province: existing.province || mapped.province,
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

    // 1. Exact pinned GPS from release takes highest priority
    if (pkg.receiver_gps) {
      const parts = pkg.receiver_gps.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords = [parts[0], parts[1]];
      }
    }

    // 2. Directory lookup fallback if exact GPS is not pinned
    if (!coords) {
      const lguLookup = findPanayLgu(pkg.municipality || pkg.lgu_name || destText, pkg.province);
      if (lguLookup) {
        coords = [lguLookup.lat, lguLookup.lng];
      }
    }

    const isHeld = heldMap[pkg.dr_number] ?? Boolean(pkg.is_held);
    const priorityOrder = priorityMap[pkg.dr_number] ?? (pkg.delivery_priority ?? 0);

    return {
      drNumber: pkg.dr_number,
      destination: destText || 'Assigned LGU',
      quantity: Number(pkg.amount_approved ?? pkg.amount_requested ?? 0),
      category: pkg.category || 'Relief goods',
      coords,
      priorityOrder,
      isHeld
    };
  });

  // Sort assigned packages: non-held first sorted by priorityOrder ascending, then held packages
  assignedPackagesList.sort((a, b) => {
    if (Boolean(a.isHeld) !== Boolean(b.isHeld)) {
      return a.isHeld ? 1 : -1;
    }
    return (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0);
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
      let destTag = String(r.municipality || r.lgu_name || '').trim();
      while (/\s*\([^)]*\)\s*\([^)]*\)/.test(destTag)) {
        destTag = destTag.replace(/\s*\([^)]*\)\s*(\([^)]*\))$/, '$1');
      }
      destTag = destTag.replace(/\s*\([^)]*\)$/, '').trim() || destTag;
      const prefix = qty > 0 ? `${qty} ${cat}` : cat;
      return destTag ? `${prefix} (${destTag})` : prefix;
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
  
  // Destination position is strictly from the FIRST active, non-held package with pinned coordinates
  const primaryPackageWithCoords = assignedPackagesList.find((p) => !p.isHeld && p.coords !== null);
  const destinationPosition = primaryPackageWithCoords?.coords ?? assignedPackagesList[0]?.coords ?? null;
  const activeDestinationName = primaryPackageWithCoords?.destination ?? assignedPackagesList[0]?.destination ?? destination;

  if (primaryPackageWithCoords) {
    destination = activeDestinationName;
  }

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
    driverName,
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
          attribution={MAP_TILE_CONFIG.attribution}
          url={MAP_TILE_CONFIG.url}
          subdomains={MAP_TILE_CONFIG.subdomains}
          maxZoom={MAP_TILE_CONFIG.maxZoom}
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
                <p className="text-xs text-gray-600 mt-0.5">{route.driverName || route.driver}</p>
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
          Fit All
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
  const [releases, setReleases] = useState<ReceiverReleaseRecord[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [packagePriorities, setPackagePriorities] = useState<Record<string, number>>({});
  const [heldPackages, setHeldPackages] = useState<Record<string, boolean>>({});
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
    .map((location) => toTruckRoute(location, releases, outgoingReleasesList, packagePriorities, heldPackages, profiles)),
    [liveLocations, releases, outgoingReleasesList, isLguReceiverId, packagePriorities, heldPackages, profiles]);

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

  const handleMovePackage = (pkgIndex: number, direction: 'up' | 'down') => {
    if (!selectedTruck || !selectedTruck.assignedPackagesList) return;
    const currentPackages = selectedTruck.assignedPackagesList;
    const targetIndex = direction === 'up' ? pkgIndex - 1 : pkgIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentPackages.length) return;

    const currentPkg = currentPackages[pkgIndex];
    const targetPkg = currentPackages[targetIndex];

    const currentPriority = targetIndex;
    const targetPriority = pkgIndex;

    setPackagePriorities(prev => ({
      ...prev,
      [currentPkg.drNumber]: currentPriority,
      [targetPkg.drNumber]: targetPriority
    }));

    backendApi.updatePackagePriority(currentPkg.drNumber, currentPriority);
    backendApi.updatePackagePriority(targetPkg.drNumber, targetPriority);
  };

  const handleToggleHold = (drNumber: string) => {
    const isCurrentlyHeld = heldPackages[drNumber] ?? false;
    const nextHeld = !isCurrentlyHeld;

    setHeldPackages(prev => ({
      ...prev,
      [drNumber]: nextHeld
    }));

    backendApi.updatePackagePriority(drNumber, packagePriorities[drNumber] ?? 0, nextHeld);
  };

  const activeReleases = useMemo(() => {
    return outgoingReleasesList.filter((r) => ['Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus));
  }, [outgoingReleasesList]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Live Receiver Tracking</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time GPS stream of active receivers across Iloilo.</p>
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Receiver Code
                  </label>
                  <select
                    value={selectedTruckId}
                    onChange={(e) => {
                      setSelectedTruckId(e.target.value);
                      const target = liveTruckRoutes.find(t => t.id === e.target.value);
                      if (target && mapRef.current) {
                        mapRef.current.setView([target.position[0], target.position[1]], 14, { animate: true });
                      }
                    }}
                    className="w-full text-sm font-bold text-blue-900 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2500ba] cursor-pointer"
                  >
                    {liveTruckRoutes.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.truckName} {truck.driverName ? `(${truck.driverName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex-shrink-0 self-end mb-1">
                  {selectedTruck.status}
                </span>
              </div>

              <div className="rounded-lg bg-blue-50/70 p-3.5 border border-blue-100 divide-y divide-blue-100/60 text-xs">
                <div className="grid grid-cols-[85px_1fr] gap-2 py-1.5 items-start">
                  <span className="text-gray-500 font-semibold">Origin:</span>
                  <span className="font-bold text-gray-800 break-words text-left leading-relaxed">{selectedTruck.origin}</span>
                </div>
                <div className="grid grid-cols-[85px_1fr] gap-2 py-1.5 items-start">
                  <span className="text-gray-500 font-semibold">Destination:</span>
                  <span className="font-bold text-blue-900 break-words text-left leading-relaxed">{selectedTruck.destination}</span>
                </div>
                <div className="grid grid-cols-[85px_1fr] gap-2 py-1.5 items-start">
                  <span className="text-gray-500 font-semibold">Cargo:</span>
                  <span className="font-bold text-gray-800 break-words text-left leading-relaxed">{selectedTruck.cargo}</span>
                </div>
                <div className="grid grid-cols-[85px_1fr] gap-2 py-1.5 items-start">
                  <span className="text-gray-500 font-semibold">Receiver:</span>
                  <span className="font-bold text-blue-900 break-words text-left leading-relaxed">{selectedTruck.driverName || selectedTruck.driver || 'Assigned Receiver'}</span>
                </div>
              </div>

              {/* Delivery Priority Sequence & Route Controls */}
              {selectedTruck.assignedPackagesList.length > 0 && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ListOrdered className="w-4 h-4 text-[#2500ba]" />
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        Cargo Delivery Sequence ({selectedTruck.assignedPackagesList.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#2500ba] bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                      Admin Priority
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500 leading-tight">
                    Change order or hold packages. Active map route and GPS destination immediately snap to #1.
                  </p>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedTruck.assignedPackagesList.map((pkg, idx) => {
                      const isActiveRoute = idx === 0 && !pkg.isHeld;
                      return (
                        <div
                          key={pkg.drNumber}
                          className={`rounded-lg p-2.5 border transition-all text-xs flex items-center justify-between gap-2 ${
                            pkg.isHeld
                              ? 'bg-amber-50/70 border-amber-200 opacity-80'
                              : isActiveRoute
                              ? 'bg-white border-[#2500ba] shadow-sm ring-1 ring-[#2500ba]/40'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                pkg.isHeld
                                  ? 'bg-amber-200 text-amber-900'
                                  : isActiveRoute
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {pkg.isHeld ? 'HELD' : `#${idx + 1}`}
                              </span>
                              <span className="font-bold text-[#2500ba]">DR #{pkg.drNumber}</span>
                              {isActiveRoute && (
                                <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold uppercase tracking-wider animate-pulse">
                                  Active Route
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-700 font-semibold truncate mt-0.5">
                              {pkg.destination}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {pkg.quantity} {pkg.category}
                            </p>
                          </div>

                          {/* Priority Action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              title="Move Up in Delivery Priority"
                              disabled={idx === 0}
                              onClick={() => handleMovePackage(idx, 'up')}
                              className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Move Down in Delivery Priority"
                              disabled={idx === selectedTruck.assignedPackagesList.length - 1}
                              onClick={() => handleMovePackage(idx, 'down')}
                              className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title={pkg.isHeld ? 'Resume Package Delivery' : 'Hold Package Delivery'}
                              onClick={() => handleToggleHold(pkg.drNumber)}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                                pkg.isHeld
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                              }`}
                            >
                              {pkg.isHeld ? (
                                <>
                                  <Play className="w-2.5 h-2.5" />
                                  <span>Resume</span>
                                </>
                              ) : (
                                <>
                                  <Pause className="w-2.5 h-2.5" />
                                  <span>Hold</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
          </div>

          {/* Right Column: Full Interactive Road-Snapped Map */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-gray-800">Map</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">Updated: {selectedTruck.updatedAt}</span>
            </div>

            <div className="flex-1 min-h-[640px]">
              <RouteMap
                routes={liveTruckRoutes}
                selectedRoute={selectedTruck}
                heightClass="h-[640px]"
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
