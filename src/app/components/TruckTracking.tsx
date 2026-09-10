import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { CheckCircle, ChevronDown, Clock, Flag, MapPin, Navigation, PackageCheck, Route, Truck } from 'lucide-react';
import type { OutgoingRelease } from '../hooks/useInventoryState';
import { backendApi, type TruckLiveLocation, type TruckerReleaseRecord } from '../services/backendApi';

type TruckStatus = 'In Transit' | 'Loading' | 'Delivered';

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
  destinationPosition: [number, number];
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

interface RouteData extends RouteMetrics {
  snappedPosition: [number, number];
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
  if (location.proof_mode && location.proof_mode.toLowerCase() === 'delivered') return false;
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

const getProgress = (location: TruckLiveLocation, destination: [number, number]) => {
  const current = L.latLng(location.latitude, location.longitude);
  const end = L.latLng(destination[0], destination[1]);
  const distanceToDestination = current.distanceTo(end);
  const roughTotal = Math.max(distanceToDestination + 2500, 1);
  return Math.min(95, Math.max(5, Math.round(100 - (distanceToDestination / roughTotal) * 100)));
};

const toTruckRoute = (
  location: TruckLiveLocation,
  release?: TruckerReleaseRecord | OutgoingRelease
): TruckRoute => {
  const origin = String(getReleaseValue(release, 'warehouse_source', 'warehouseSource') ?? 'DSWD Oton Warehouse');
  const destination = String(
    getReleaseValue(release, 'lgu_name', 'lguName')
    ?? getReleaseValue(release, 'municipality', 'municipality')
    ?? 'Assigned LGU'
  );
  const category = String(getReleaseValue(release, 'category', 'fnfiCategory') ?? 'Relief goods');
  const quantity = Number(getReleaseValue(release, 'amount_approved', 'amountApproved') ?? 0);
  const status = getReleaseValue(release, 'delivery_status', 'deliveryStatus') === 'Delivered' ? 'Delivered' : 'In Transit';
  const originPosition = findCoords(WAREHOUSE_COORDS, origin) ?? WAREHOUSE_COORDS['dswd oton warehouse'];
  const destinationPosition = findCoords(LGU_COORDS, destination) ?? [location.latitude, location.longitude];
  const progress = status === 'Delivered' ? 100 : getProgress(location, destinationPosition);

  return {
    id: location.truck_id,
    truckName: location.truck_id,
    driver: shortWallet(location.wallet_address),
    status,
    origin,
    destination,
    cargo: quantity > 0 ? `${quantity} ${category}` : category,
    eta: 'Calculating...',
    updatedAt: formatDateTime(location.updated_at),
    originPosition,
    position: [location.latitude, location.longitude],
    destinationPosition,
    isLive: true,
    accuracy: location.accuracy,
    progress,
    checkpoints: [
      {
        label: 'Live phone GPS',
        time: formatDateTime(location.updated_at),
        note: `Captured at ${location.gps_text}${location.accuracy ? `, accuracy ${Math.round(location.accuracy)}m` : ''}`,
        completed: true
      },
      {
        label: location.dr_number ? `Release ${location.dr_number}` : 'Temporary QR proof',
        time: location.tx_hash ? 'MetaMask proof recorded' : 'Awaiting blockchain proof',
        note: location.tx_hash ? `TX ${location.tx_hash.slice(0, 10)}...` : 'Receiver has not signed a proof yet',
        completed: Boolean(location.tx_hash)
      },
      {
        label: `Destination: ${destination}`,
        time: status === 'Delivered' ? 'Delivered' : 'Pending arrival',
        note: status === 'Delivered' ? 'Delivery closed by receiver' : 'Awaiting done delivering confirmation',
        completed: status === 'Delivered'
      }
    ]
  };
};

const getPointAlongRoute = (coordinates: L.LatLng[], progress: number): [number, number] | null => {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return [coordinates[0].lat, coordinates[0].lng];

  const clampedProgress = Math.min(100, Math.max(0, progress));
  const segmentDistances = coordinates.slice(1).map((point, index) => coordinates[index].distanceTo(point));
  const totalDistance = segmentDistances.reduce((sum, distance) => sum + distance, 0);
  let remainingDistance = totalDistance * (clampedProgress / 100);

  for (let index = 0; index < segmentDistances.length; index += 1) {
    const segmentDistance = segmentDistances[index];
    const start = coordinates[index];
    const end = coordinates[index + 1];

    if (remainingDistance <= segmentDistance) {
      const ratio = segmentDistance === 0 ? 0 : remainingDistance / segmentDistance;
      return [start.lat + (end.lat - start.lat) * ratio, start.lng + (end.lng - start.lng) * ratio];
    }

    remainingDistance -= segmentDistance;
  }

  const lastPoint = coordinates[coordinates.length - 1];
  return [lastPoint.lat, lastPoint.lng];
};

function RoadSnappedRoute({ route, onRouteDataChange }: { route: TruckRoute; onRouteDataChange: (data: RouteData | null) => void }) {
  const map = useMap();

  useEffect(() => {
    onRouteDataChange(null);

    const control = L.Routing.control({
      waypoints: [L.latLng(route.originPosition), L.latLng(route.destinationPosition)],
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving'
      }),
      lineOptions: {
        styles: [{ color: statusColors[route.status], opacity: 0.95, weight: 5 }],
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
        durationMinutes: Math.round(summary.totalTime / 60),
        snappedPosition: getPointAlongRoute(osrmRoute.coordinates ?? [], route.progress) ?? route.position
      });
    });

    control.on('routingerror', () => onRouteDataChange(null));

    return () => {
      map.removeControl(control);
    };
  }, [map, onRouteDataChange, route]);

  return null;
}

function LiveTruckMapFocus({ route }: { route?: TruckRoute }) {
  const map = useMap();

  useEffect(() => {
    if (!route?.isLive) return;
    const livePosition = L.latLng(route.position);
    const distanceFromCenter = map.getCenter().distanceTo(livePosition);
    if (distanceFromCenter > 35) map.setView(livePosition, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, route]);

  return null;
}

function RouteMap({
  routes,
  selectedRoute,
  heightClass,
  onRouteDataChange,
  selectedSnappedPosition
}: {
  routes: TruckRoute[];
  selectedRoute?: TruckRoute;
  heightClass: string;
  onRouteDataChange: (data: RouteData | null) => void;
  selectedSnappedPosition?: [number, number];
}) {
  const center = selectedRoute?.position ?? routes[0]?.position ?? [10.72, 122.51];
  const displayRoutes = routes.map((route) =>
    selectedRoute && selectedSnappedPosition && route.id === selectedRoute.id
      ? { ...route, position: selectedSnappedPosition }
      : route
  );

  return (
    <MapContainer key={selectedRoute ? selectedRoute.id : 'all-trucks'} center={center} zoom={13} scrollWheelZoom className={`${heightClass} w-full`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LiveTruckMapFocus route={selectedRoute} />
      {selectedRoute && <RoadSnappedRoute route={selectedRoute} onRouteDataChange={onRouteDataChange} />}

      {selectedRoute && (
        <CircleMarker center={selectedRoute.destinationPosition} radius={10} pathOptions={{ color: '#dc2626', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}>
          <Popup>
            <div className="min-w-40">
              <p className="font-bold text-gray-900">Destination</p>
              <p className="text-sm text-gray-700">{selectedRoute.destination}</p>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {displayRoutes.map((route) => (
        <CircleMarker key={route.id} center={route.position} radius={selectedRoute?.id === route.id ? 12 : 10} pathOptions={{ color: '#ffffff', weight: 3, fillColor: statusColors[route.status], fillOpacity: 0.95 }}>
          <Popup>
            <div className="min-w-44">
              <p className="font-bold text-gray-900">{route.truckName}</p>
              <p className="text-sm text-gray-700">{route.driver}</p>
              <p className="mt-2 text-sm text-gray-700">To {route.destination}</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{route.cargo}</p>
              {route.accuracy && <p className="mt-1 text-xs text-gray-500">Accuracy: {Math.round(route.accuracy)}m</p>}
              <p className="mt-1 text-xs text-gray-500">Progress: {route.progress}%</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
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
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [selectedSnappedPosition, setSelectedSnappedPosition] = useState<[number, number] | undefined>();

  useEffect(() => {
    backendApi.getTruckerReleases()
      .then(setReleases)
      .catch((error) => console.error('Failed to load trucker releases', error));

    return backendApi.subscribeTruckLiveLocations(
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
  }, []);

  const liveTruckRoutes = useMemo(() => Object.values(liveLocations)
    .filter(isActiveReceiverLocation)
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .map((location) => toTruckRoute(location, releaseByDrNumber(releases, outgoingReleasesList, location.dr_number))), [liveLocations, releases, outgoingReleasesList]);

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

  const handleRouteDataChange = useCallback((data: RouteData | null) => {
    setRouteMetrics(data ? { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes } : null);
    setSelectedSnappedPosition(data?.snappedPosition);
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
                      <tr key={item.id} className="hover:bg-gray-50">
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

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-blue-600" /> Distance
                  </span>
                  <p className="mt-1 text-base font-bold text-gray-900">
                    {routeMetrics ? `${routeMetrics.distanceKm.toFixed(1)} km` : 'Calculating...'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Drive Time
                  </span>
                  <p className="mt-1 text-base font-bold text-gray-900">
                    {routeMetrics ? formatDuration(routeMetrics.durationMinutes) : 'Calculating...'}
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
            <div className="flex-1 min-h-[560px]">
              <RouteMap
                routes={liveTruckRoutes}
                selectedRoute={selectedTruck}
                heightClass="h-[560px]"
                onRouteDataChange={handleRouteDataChange}
                selectedSnappedPosition={selectedSnappedPosition}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
