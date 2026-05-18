import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import { CheckCircle, ChevronDown, Clock, Flag, MapPin, Navigation, PackageCheck, Truck } from 'lucide-react';

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
  position: [number, number];
  destinationPosition: [number, number];
  progress: number;
  path: [number, number][];
  checkpoints: {
    label: string;
    time: string;
    note: string;
    completed: boolean;
  }[];
}

const truckRoutes: TruckRoute[] = [
  {
    id: 'TRK-001',
    truckName: 'Truck 1',
    driver: 'Juan Dela Cruz',
    status: 'In Transit',
    origin: 'DSWD Oton Warehouse',
    destination: 'Leon',
    cargo: '850 Family Food Packs',
    eta: '35 mins',
    updatedAt: '16 Jan 2026, 12:26:05',
    position: [10.7435, 122.4858],
    destinationPosition: [10.787, 122.3892],
    progress: 68,
    path: [
      [10.6912, 122.4728],
      [10.704, 122.4775],
      [10.7245, 122.4828],
      [10.7435, 122.4858],
      [10.787, 122.3892]
    ],
    checkpoints: [
      { label: 'Departed Oton Warehouse', time: '16 Jan 2026, 11:15:00', note: 'Release documents verified', completed: true },
      { label: 'Checkpoint: San Miguel Road', time: '16 Jan 2026, 11:48:12', note: 'GPS ping confirmed', completed: true },
      { label: 'Current: Iloilo-Leon Road', time: '16 Jan 2026, 12:26:05', note: 'En route to Leon', completed: true },
      { label: 'Destination: Leon', time: 'ETA 35 mins', note: 'Pending LGU handover', completed: false }
    ]
  },
  {
    id: 'TRK-002',
    truckName: 'Truck 3',
    driver: 'Maria Santos',
    status: 'In Transit',
    origin: 'DSWD Oton Warehouse',
    destination: 'Miagao',
    cargo: '320 Hygiene Kits',
    eta: '52 mins',
    updatedAt: '16 Jan 2026, 12:26:05',
    position: [10.7058, 122.5165],
    destinationPosition: [10.6445, 122.2367],
    progress: 42,
    path: [
      [10.6912, 122.4728],
      [10.7004, 122.4938],
      [10.7058, 122.5165],
      [10.6806, 122.3776],
      [10.6445, 122.2367]
    ],
    checkpoints: [
      { label: 'Departed Oton Warehouse', time: '16 Jan 2026, 11:32:10', note: 'Cargo loaded and sealed', completed: true },
      { label: 'Checkpoint: Iloilo City Boundary', time: '16 Jan 2026, 12:04:44', note: 'Passed first checkpoint', completed: true },
      { label: 'Current: General Luna Corridor', time: '16 Jan 2026, 12:26:05', note: 'Continuing southbound', completed: true },
      { label: 'Destination: Miagao', time: 'ETA 52 mins', note: 'Pending LGU receiving scan', completed: false }
    ]
  },
  {
    id: 'TRK-003',
    truckName: 'Truck 6',
    driver: 'Paolo Reyes',
    status: 'In Transit',
    origin: 'DSWD Pototan Warehouse',
    destination: 'Barotac Nuevo',
    cargo: '140 Sleeping Kits',
    eta: '1 hr 10 mins',
    updatedAt: '16 Jan 2026, 12:26:05',
    position: [10.7233, 122.5558],
    destinationPosition: [10.894, 122.7042],
    progress: 31,
    path: [
      [10.9435, 122.6369],
      [10.8298, 122.602],
      [10.7233, 122.5558],
      [10.816, 122.6402],
      [10.894, 122.7042]
    ],
    checkpoints: [
      { label: 'Departed Pototan Warehouse', time: '16 Jan 2026, 11:05:30', note: 'Sleeping kits released', completed: true },
      { label: 'Checkpoint: Pototan Crossing', time: '16 Jan 2026, 11:42:18', note: 'Route status normal', completed: true },
      { label: 'Current: Diversion Road', time: '16 Jan 2026, 12:26:05', note: 'Approaching next checkpoint', completed: true },
      { label: 'Destination: Barotac Nuevo', time: 'ETA 1 hr 10 mins', note: 'Pending arrival confirmation', completed: false }
    ]
  }
];

const statusColors: Record<TruckStatus, string> = {
  'In Transit': '#1d00c8',
  Loading: '#d97706',
  Delivered: '#16a34a'
};

function RouteMap({
  routes,
  selectedRoute,
  heightClass,
  gpsTrail
}: {
  routes: TruckRoute[];
  selectedRoute?: TruckRoute;
  heightClass: string;
  gpsTrail?: [number, number][];
}) {
  const center = selectedRoute?.position ?? [10.72, 122.51];
  const zoom = selectedRoute ? 13 : 13;
  const selectedRoutes = selectedRoute ? [selectedRoute] : routes;

  return (
    <MapContainer
      key={selectedRoute ? selectedRoute.id : 'all-trucks'}
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className={`${heightClass} w-full`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {gpsTrail && gpsTrail.length > 0 && (
        <Polyline
          positions={gpsTrail}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 5'
          }}
        />
      )}

      {selectedRoutes.map((route) => (
        <Polyline
          key={`${route.id}-route`}
          positions={route.path}
          pathOptions={{
            color: statusColors[route.status],
            weight: selectedRoute?.id === route.id ? 5 : 4,
            opacity: selectedRoute && selectedRoute.id !== route.id ? 0.35 : 0.9
          }}
        />
      ))}

      {selectedRoute && (
        <CircleMarker
          center={selectedRoute.destinationPosition}
          radius={10}
          pathOptions={{
            color: '#dc2626',
            weight: 3,
            fillColor: '#ffffff',
            fillOpacity: 1
          }}
        >
          <Popup>
            <div className="min-w-40">
              <p className="font-bold text-gray-900">Destination</p>
              <p className="text-sm text-gray-700">{selectedRoute.destination}</p>
              <p className="text-xs text-gray-500 mt-1">ETA: {selectedRoute.eta}</p>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {routes.map((route) => (
        <CircleMarker
          key={route.id}
          center={route.position}
          radius={selectedRoute?.id === route.id ? 12 : 10}
          pathOptions={{
            color: '#ffffff',
            weight: 3,
            fillColor: statusColors[route.status],
            fillOpacity: 0.95
          }}
        >
          <Popup>
            <div className="min-w-44">
              <p className="font-bold text-gray-900">{route.truckName}</p>
              <p className="text-sm text-gray-700">{route.driver}</p>
              <p className="text-sm text-gray-700 mt-2">To {route.destination}</p>
              <p className="text-sm font-semibold text-gray-900 mt-2">{route.cargo}</p>
              <p className="text-xs text-gray-500 mt-1">Progress: {route.progress}%</p>
              <p className="text-xs text-gray-500 mt-1">ETA: {route.eta}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export function TruckTracking() {
  const [selectedTruckId, setSelectedTruckId] = useState(truckRoutes[0].id);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<[number, number] | null>(null);
  const [gpsTrail, setGpsTrail] = useState<[number, number][]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const selectedTruck = truckRoutes.find((route) => route.id === selectedTruckId) ?? truckRoutes[0];
  
  // Use live GPS position if available, otherwise fall back to mock position
  const displayedTruck = gpsPosition ? { ...selectedTruck, position: gpsPosition } : selectedTruck;
  const mapRoutes = isMapOpen ? truckRoutes : [displayedTruck];

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported');
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords: [number, number] = [latitude, longitude];
        setGpsPosition(newCoords);
        setGpsTrail((prevPath) => [...prevPath, newCoords]);
        setGpsError(null);
      },
      (error) => {
        setGpsError(`GPS: ${error.message}`);
      },
      geoOptions
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <div className="space-y-6">
      {gpsError && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
          ⚠ {gpsError}
        </div>
      )}
      {!isMapOpen ? (
        <div className="max-w-sm bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h1 className="text-lg font-bold text-blue-800 mb-4">Goods Tracker</h1>

          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((current) => !current)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-lg border border-indigo-100 text-sm font-bold text-blue-900 shadow-sm"
              aria-expanded={isDropdownOpen}
            >
              <span>{selectedTruck.truckName}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute z-[1000] mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                {truckRoutes.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => {
                      setSelectedTruckId(route.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      selectedTruckId === route.id
                        ? 'bg-blue-50 text-blue-800 font-bold'
                        : 'text-gray-700 hover:bg-gray-50 font-semibold'
                    }`}
                  >
                    <span className="block">{route.truckName}</span>
                    <span className="block text-xs font-medium text-gray-500">Heading to {route.destination}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden mb-4">
            <RouteMap routes={[selectedTruck]} selectedRoute={selectedTruck} heightClass="h-56" gpsTrail={gpsTrail} />
          </div>

          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="w-full py-3 border-2 border-blue-700 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
          >
            Open Map
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-blue-800">Goods Tracker</h1>
              <p className="text-sm text-gray-600 mt-1">Current trucks and delivery destinations.</p>
            </div>

            <button
              type="button"
              onClick={() => setIsMapOpen(false)}
              className="self-start lg:self-auto px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Widget
            </button>
          </div>

          <RouteMap routes={mapRoutes} selectedRoute={selectedTruck} heightClass="h-[520px]" gpsTrail={gpsTrail} />

          <div className="p-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <div>
              <h2 className="text-sm font-bold text-blue-800 mb-4">{selectedTruck.truckName} History</h2>
              <div className="space-y-0">
                {selectedTruck.checkpoints.map((checkpoint, index) => (
                  <div key={`${selectedTruck.id}-${checkpoint.label}`} className="relative flex gap-3 pb-5">
                    {index < selectedTruck.checkpoints.length - 1 && (
                      <span className="absolute left-[9px] top-6 bottom-0 w-px bg-gray-200" />
                    )}
                    <span
                      className={`mt-1 w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10 ${
                        checkpoint.completed ? 'bg-green-600' : 'bg-red-500'
                      }`}
                    />
                    <span>
                      <span className="block text-sm font-bold text-blue-800">{checkpoint.label}</span>
                      <span className="block text-xs text-gray-500">{checkpoint.time}</span>
                      <span className="block text-xs text-gray-600 mt-1">{checkpoint.note}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase">Select Truck</p>
                <div className="mt-3 space-y-2">
                  {truckRoutes.map((route) => (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setSelectedTruckId(route.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedTruckId === route.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-bold text-gray-900">{route.truckName}</span>
                        <span className="block text-xs text-gray-500">To {route.destination}</span>
                      </span>
                      <span className="text-xs font-bold text-blue-800">{route.progress}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-blue-800">{selectedTruck.truckName}</h2>
                    <p className="text-sm font-semibold text-gray-700">
                      {selectedTruck.origin} to {selectedTruck.destination}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
                    <Flag className="w-4 h-4 text-red-600" />
                    <span>{selectedTruck.destination}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-600 mb-2">
                    <span>Start</span>
                    <span>{selectedTruck.progress}% complete</span>
                    <span>Finish</span>
                  </div>
                  <div className="h-3 rounded-full bg-white border border-blue-100 overflow-hidden">
                    <div className="h-full bg-blue-700 rounded-full" style={{ width: `${selectedTruck.progress}%` }} />
                  </div>
                </div>
              </div>

              <h2 className="text-lg font-bold text-blue-800">Current Trucks</h2>
              <p className="text-sm font-semibold text-blue-800 mb-1">Incoming Deliveries:</p>
              <ul className="space-y-1">
                {truckRoutes.map((route) => (
                  <li key={route.id} className="text-sm font-semibold text-blue-800">
                    {route.truckName} En Route To {route.destination}
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                {truckRoutes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedTruckId(route.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selectedTruckId === route.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-blue-700" />
                      <span className="text-sm font-bold text-gray-900">{route.truckName}</span>
                      {selectedTruckId === route.id && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                    </div>
                    <div className="space-y-2 text-xs text-gray-700">
                      <div className="flex gap-2">
                        <Navigation className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span>{route.origin}</span>
                      </div>
                      <div className="flex gap-2">
                        <MapPin className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                        <span>{route.destination}</span>
                      </div>
                      <div className="flex gap-2">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{route.cargo}</span>
                      </div>
                      <div className="flex gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>{route.eta}</span>
                      </div>
                      <div>
                        <div className="flex justify-between font-semibold text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{route.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-blue-700 rounded-full" style={{ width: `${route.progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
