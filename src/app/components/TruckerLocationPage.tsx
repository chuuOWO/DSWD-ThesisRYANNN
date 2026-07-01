import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, LocateFixed, MapPin, Navigation, Radio, Truck } from 'lucide-react';
import { backendApi } from '../services/backendApi';

interface LiveLocationPayload {
  truck_id: string;
  dr_number: string;
  latitude: number;
  longitude: number;
  gps_text: string;
  accuracy: number | null;
  updated_at: string;
}

const DEFAULT_TRUCKS: Record<string, { drNumber: string; destination: string; cargo: string }> = {
  'TRK-001': { drNumber: 'DR-2026-001', destination: 'Leon Municipal Office', cargo: '850 Family Food Packs' },
  'TRK-002': { drNumber: 'DR-2026-002', destination: 'Miagao Municipal Office', cargo: '320 Hygiene Kits' },
  'TRK-003': { drNumber: 'DR-2026-003', destination: 'Barotac Nuevo Municipal Office', cargo: '140 Sleeping Kits' }
};

const formatCoordinates = (latitude: number, longitude: number) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

export function TruckerLocationPage() {
  const params = new URLSearchParams(window.location.search);
  const truckId = params.get('truckId') || 'TRK-001';
  const truckInfo = DEFAULT_TRUCKS[truckId] ?? DEFAULT_TRUCKS['TRK-001'];
  const [isSharing, setIsSharing] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [lastPayload, setLastPayload] = useState<LiveLocationPayload | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isSecureForGps = useMemo(() => (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ), []);

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  const saveLocation = async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    const payload: LiveLocationPayload = {
      truck_id: truckId,
      dr_number: truckInfo.drNumber,
      latitude,
      longitude,
      gps_text: formatCoordinates(latitude, longitude),
      accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
      updated_at: new Date().toISOString()
    };

    setLastPayload(payload);

    try {
      await backendApi.upsertTruckLiveLocation(payload);
      setMessage({ type: 'success', text: 'Live GPS sent to admin tracking map.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unknown Supabase error';
      setMessage({ type: 'error', text: `GPS captured, but live tracking save failed: ${text}` });
    }
  };

  const startSharing = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'This browser does not support GPS location sharing.' });
      return;
    }

    setIsSharing(true);
    setMessage({ type: 'info', text: 'Requesting GPS permission...' });

    const id = navigator.geolocation.watchPosition(
      (position) => {
        saveLocation(position);
      },
      (error) => {
        setIsSharing(false);
        setMessage({ type: 'error', text: error.message || 'GPS permission denied or unavailable.' });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000
      }
    );

    setWatchId(id);
  };

  const stopSharing = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setIsSharing(false);
    setMessage({ type: 'info', text: 'Live GPS sharing stopped.' });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-sm min-h-[calc(100vh-2rem)] bg-white rounded-[28px] shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="bg-blue-800 text-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-100">Trucker View</p>
              <h1 className="text-lg font-bold">{truckId}</h1>
            </div>
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {!isSecureForGps && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Phone GPS needs HTTPS. Use the ngrok HTTPS URL for real phone testing.
            </div>
          )}

          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <Radio className={`w-9 h-9 ${isSharing ? 'text-green-600' : 'text-blue-700'}`} />
            </div>
            <p className="text-lg font-bold text-gray-900">{isSharing ? 'Sharing Live GPS' : 'Ready to Share GPS'}</p>
            <p className="text-sm text-gray-500 mt-1">Keep this page open while moving.</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex gap-3">
              <Navigation className="w-5 h-5 text-blue-700 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Delivery</p>
                <p className="text-sm font-semibold text-gray-900">{truckInfo.drNumber}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Destination</p>
                <p className="text-sm font-semibold text-gray-900">{truckInfo.destination}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Truck className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Cargo</p>
                <p className="text-sm font-semibold text-gray-900">{truckInfo.cargo}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={isSharing ? stopSharing : startSharing}
            className={`w-full min-h-14 rounded-lg text-white font-bold flex items-center justify-center gap-2 ${
              isSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            <LocateFixed className="w-5 h-5" />
            {isSharing ? 'Stop Sharing Location' : 'Start Sharing Location'}
          </button>

          {message && (
            <div className={`rounded-lg border p-4 flex gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-900'
                : message.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <p className="text-sm font-semibold">{message.text}</p>
            </div>
          )}

          {lastPayload && (
            <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-2">
              <p><span className="font-bold">GPS:</span> {lastPayload.gps_text}</p>
              <p><span className="font-bold">Accuracy:</span> {lastPayload.accuracy ?? 'N/A'} meters</p>
              <p><span className="font-bold">Updated:</span> {new Date(lastPayload.updated_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
