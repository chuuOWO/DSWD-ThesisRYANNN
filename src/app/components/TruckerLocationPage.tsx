import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, LocateFixed, MapPin, Navigation, Radio, Truck } from 'lucide-react';
import { backendApi } from '../services/backendApi';
import { blockchain, BlockchainProof } from '../services/blockchain';

interface LiveLocationPayload {
  truck_id: string;
  dr_number: string;
  latitude: number;
  longitude: number;
  gps_text: string;
  accuracy: number | null;
  tx_hash?: string | null;
  wallet_address?: string | null;
  proof_mode?: string | null;
  updated_at: string;
}

interface ReleaseDetails {
  drNumber: string;
  handoverContractId: string;
  destination: string;
  cargo: string;
  category: string;
  quantity: number;
  batchTokenIds: string[];
  batchQuantities: number[];
  from: string;
}

const DEFAULT_TRUCKS: Record<string, ReleaseDetails> = {
  'TRK-001': {
    drNumber: 'DR-2026-001',
    handoverContractId: 'HANDOVER-2026-001',
    destination: 'Leon Municipal Office',
    cargo: '850 Family Food Packs',
    category: 'Family Food Packs',
    quantity: 850,
    batchTokenIds: ['BATCH-TRK-001-DEMO'],
    batchQuantities: [850],
    from: 'Oton Main Warehouse'
  },
  'TRK-002': {
    drNumber: 'DR-2026-002',
    handoverContractId: 'HANDOVER-2026-002',
    destination: 'Miagao Municipal Office',
    cargo: '320 Hygiene Kits',
    category: 'Hygiene Kits',
    quantity: 320,
    batchTokenIds: ['BATCH-TRK-002-DEMO'],
    batchQuantities: [320],
    from: 'Oton Main Warehouse'
  },
  'TRK-003': {
    drNumber: 'DR-2026-003',
    handoverContractId: 'HANDOVER-2026-003',
    destination: 'Barotac Nuevo Municipal Office',
    cargo: '140 Sleeping Kits',
    category: 'Sleeping Kits',
    quantity: 140,
    batchTokenIds: ['BATCH-TRK-003-DEMO'],
    batchQuantities: [140],
    from: 'Pototan Main Warehouse'
  }
};

const MAX_ACCEPTED_ACCURACY_METERS = 100;
const MIN_STATIONARY_MOVE_METERS = 10;
const MIN_STATIONARY_UPDATE_MS = 15000;
const SMOOTHING_FACTOR = 0.35;
const MAX_SHARED_GPS_AGE_MS = 5 * 60 * 1000;

const formatCoordinates = (latitude: number, longitude: number) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

const parseCsv = (value: string | null) =>
  value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];

const getReleaseDetailsFromParams = (params: URLSearchParams, fallback: ReleaseDetails): ReleaseDetails => {
  const batchTokenIds = parseCsv(params.get('batchTokenIds'));
  const batchQuantities = parseCsv(params.get('batchQuantities'))
    .map(Number)
    .filter((quantity) => Number.isFinite(quantity) && quantity > 0);
  const quantity = Number(params.get('quantity'));

  return {
    drNumber: params.get('drNumber') || fallback.drNumber,
    handoverContractId: params.get('handoverContractId') || fallback.handoverContractId,
    destination: params.get('destination') || fallback.destination,
    cargo: params.get('cargo') || fallback.cargo,
    category: params.get('category') || fallback.category,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : fallback.quantity,
    batchTokenIds: batchTokenIds.length > 0 ? batchTokenIds : fallback.batchTokenIds,
    batchQuantities: batchQuantities.length > 0 ? batchQuantities : fallback.batchQuantities,
    from: params.get('from') || fallback.from
  };
};

const getDistanceMeters = (
  from: Pick<LiveLocationPayload, 'latitude' | 'longitude'>,
  to: Pick<LiveLocationPayload, 'latitude' | 'longitude'>
) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getGpsErrorMessage = (error: unknown) => {
  const gpsError = error as GeolocationPositionError;

  if (gpsError?.code === 1) {
    return 'GPS permission was denied. In phone settings, allow Location for MetaMask, then reload this page.';
  }

  if (gpsError?.code === 2) {
    return 'GPS position is unavailable. Turn on phone Location/GPS, then try again outdoors or near a window.';
  }

  if (gpsError?.code === 3) {
    return 'GPS took too long to respond. I will try a lower-accuracy fallback.';
  }

  return error instanceof Error ? error.message : 'Unable to capture phone GPS.';
};

const getSigningErrorMessage = (error: unknown) => {
  const ethereumError = error as { code?: number; shortMessage?: string; reason?: string; message?: string };

  if (ethereumError?.code === 4001) {
    return 'MetaMask signing was cancelled by the user.';
  }

  return ethereumError?.shortMessage
    || ethereumError?.reason
    || ethereumError?.message
    || 'MetaMask signing failed.';
};

export function TruckerLocationPage() {
  const params = new URLSearchParams(window.location.search);
  const truckId = params.get('truckId') || 'TRK-001';
  const truckInfo = getReleaseDetailsFromParams(params, DEFAULT_TRUCKS[truckId] ?? DEFAULT_TRUCKS['TRK-001']);
  const [isSharing, setIsSharing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [lastPayload, setLastPayload] = useState<LiveLocationPayload | null>(null);
  const [releaseProof, setReleaseProof] = useState<BlockchainProof | null>(null);
  const [gpsDebug, setGpsDebug] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const lastAcceptedPayloadRef = useRef<LiveLocationPayload | null>(null);
  const lastSentAtRef = useRef(0);
  const releaseProofRef = useRef<BlockchainProof | null>(null);

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

  const getCurrentGpsPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
      });
    });

  const getFallbackGpsPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 10000
      });
    });

  const getWatchGpsPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      let didFinish = false;
      const timeoutId = window.setTimeout(() => {
        if (didFinish) return;
        didFinish = true;
        navigator.geolocation.clearWatch(id);
        reject(new Error('GPS watch timed out. Please keep MetaMask open and allow precise location.'));
      }, 20000);

      const id = navigator.geolocation.watchPosition(
        (position) => {
          if (didFinish) return;
          didFinish = true;
          window.clearTimeout(timeoutId);
          navigator.geolocation.clearWatch(id);
          resolve(position);
        },
        (error) => {
          if (didFinish) return;
          didFinish = true;
          window.clearTimeout(timeoutId);
          navigator.geolocation.clearWatch(id);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000
        }
      );
    });

  const captureBestGpsPosition = async () => {
    try {
      return await getWatchGpsPosition();
    } catch (watchError) {
      console.warn('High-accuracy GPS watch failed', watchError);
      setGpsDebug(`watchPosition failed: ${getGpsErrorMessage(watchError)}`);
      setMessage({ type: 'info', text: getGpsErrorMessage(watchError) });
    }

    try {
      return await getCurrentGpsPosition();
    } catch (currentError) {
      console.warn('High-accuracy current GPS failed', currentError);
      setGpsDebug(`getCurrentPosition failed: ${getGpsErrorMessage(currentError)}`);
      setMessage({ type: 'info', text: getGpsErrorMessage(currentError) });
    }

    try {
      return await getFallbackGpsPosition();
    } catch (fallbackError) {
      setGpsDebug(`fallback GPS failed: ${getGpsErrorMessage(fallbackError)}`);
      throw fallbackError;
    }
  };

  const signReleaseWithGps = async (gps: string) => {
    const proof = await blockchain.signRelease({
      drNumber: truckInfo.drNumber,
      handoverContractId: truckInfo.handoverContractId,
      category: truckInfo.category,
      quantity: truckInfo.quantity,
      batchTokenIds: truckInfo.batchTokenIds,
      batchQuantities: truckInfo.batchQuantities,
      from: truckInfo.from,
      to: truckInfo.destination,
      gps
    });

    releaseProofRef.current = proof;
    setReleaseProof(proof);

    backendApi.updateOutgoing(truckInfo.drNumber, {
      deliveryStatus: 'Released',
      senderGps: gps,
      txHash: proof.hash,
      handoverContractId: truckInfo.handoverContractId,
      senderSignature: proof.hash,
      walletAddress: proof.walletAddress
    }).catch((error) => {
      console.warn('MetaMask proof created, but outgoing request update failed', error);
    });

    return proof;
  };

  const makeLocationPayload = (
    latitude: number,
    longitude: number,
    accuracy: number | null,
    proof = releaseProofRef.current
  ): LiveLocationPayload => ({
      truck_id: truckId,
      dr_number: truckInfo.drNumber,
      latitude,
      longitude,
      gps_text: formatCoordinates(latitude, longitude),
      accuracy,
      tx_hash: proof?.hash ?? null,
      wallet_address: proof?.walletAddress ?? null,
      proof_mode: proof?.mode ?? null,
      updated_at: new Date().toISOString()
    });

  const savePayload = async (payload: LiveLocationPayload) => {
    const previousPayload = lastAcceptedPayloadRef.current;
    const now = Date.now();

    if (previousPayload && payload.accuracy !== null && payload.accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
      setMessage({ type: 'info', text: `GPS signal is weak (${payload.accuracy}m accuracy). Waiting for a cleaner reading.` });
      return;
    }

    if (previousPayload) {
      const distanceMoved = getDistanceMeters(previousPayload, payload);
      const recentlySent = now - lastSentAtRef.current < MIN_STATIONARY_UPDATE_MS;

      if (distanceMoved < MIN_STATIONARY_MOVE_METERS && recentlySent) {
        setLastPayload({
          ...previousPayload,
          accuracy: payload.accuracy,
          updated_at: payload.updated_at
        });
        return;
      }

      if (distanceMoved < 80) {
        payload.latitude = previousPayload.latitude + (payload.latitude - previousPayload.latitude) * SMOOTHING_FACTOR;
        payload.longitude = previousPayload.longitude + (payload.longitude - previousPayload.longitude) * SMOOTHING_FACTOR;
        payload.gps_text = formatCoordinates(payload.latitude, payload.longitude);
      }
    }

    setLastPayload(payload);
    lastAcceptedPayloadRef.current = payload;
    lastSentAtRef.current = now;

    try {
      await backendApi.upsertTruckLiveLocation(payload);
      setMessage({ type: 'success', text: 'Live GPS sent to admin tracking map.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unknown Supabase error';
      setMessage({ type: 'error', text: `GPS captured, but live tracking save failed: ${text}` });
    }
  };

  const saveLocation = async (position: GeolocationPosition, proof = releaseProofRef.current) => {
    const { latitude, longitude, accuracy } = position.coords;
    const roundedAccuracy = Number.isFinite(accuracy) ? Math.round(accuracy) : null;
    await savePayload(makeLocationPayload(latitude, longitude, roundedAccuracy, proof));
  };

  const getLatestSharedGps = async () => {
    const locations = await backendApi.getTruckLiveLocations();
    const location = locations.find((item) => item.truck_id === truckId);

    if (!location) {
      throw new Error('No shared GPS found yet. Open this same trucker link in Chrome/Safari and tap Start GPS Only first.');
    }

    const updatedAt = location.updated_at ? new Date(location.updated_at).getTime() : 0;
    const ageMs = Date.now() - updatedAt;

    if (!updatedAt || ageMs > MAX_SHARED_GPS_AGE_MS) {
      throw new Error('The shared GPS is too old. Refresh it from Chrome/Safari, then sign again in MetaMask.');
    }

    return location;
  };

  const startLiveWatch = (proof = releaseProofRef.current) => {
    const id = navigator.geolocation.watchPosition(
      (nextPosition) => {
        saveLocation(nextPosition, proof);
      },
      (error) => {
        setIsSharing(false);
        setMessage({ type: 'error', text: getGpsErrorMessage(error) });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 12000
      }
    );

    setWatchId(id);
    setIsSharing(true);
  };

  const startGpsOnlySharing = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'This browser does not support GPS location sharing.' });
      return;
    }

    setIsSigning(true);
    setMessage({ type: 'info', text: 'Starting GPS-only sharing for MetaMask signing.' });

    captureBestGpsPosition()
      .then(async (position) => {
        await saveLocation(position, releaseProofRef.current);
        startLiveWatch(releaseProofRef.current);
        setMessage({ type: 'success', text: 'GPS-only sharing is live. Open this same link in MetaMask and sign with latest GPS.' });
      })
      .catch((error) => {
        setMessage({ type: 'error', text: getGpsErrorMessage(error) });
      })
      .finally(() => {
        setIsSigning(false);
      });
  };

  const startSharing = async () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'This browser does not support GPS location sharing.' });
      return;
    }

    setIsSigning(true);
    setMessage({ type: 'info', text: 'Capturing phone GPS before opening MetaMask...' });

    try {
      const position = await captureBestGpsPosition();
      const gps = formatCoordinates(position.coords.latitude, position.coords.longitude);
      setMessage({ type: 'info', text: 'GPS captured. Starting live tracking, then opening MetaMask.' });
      await saveLocation(position, releaseProofRef.current);
      startLiveWatch(releaseProofRef.current);

      try {
        const proof = releaseProofRef.current ?? await signReleaseWithGps(gps);
        await saveLocation(position, proof);
        setMessage({ type: 'success', text: 'MetaMask proof recorded. Live GPS is sharing to admin tracking.' });
      } catch (signingError) {
        console.error('MetaMask signing failed', signingError);
        setMessage({
          type: 'error',
          text: `Live GPS is sharing, but MetaMask proof failed: ${getSigningErrorMessage(signingError)}`
        });
      }
    } catch (error) {
      const gpsErrorText = getGpsErrorMessage(error);

      try {
        const location = await getLatestSharedGps();
        const gps = location.gps_text || formatCoordinates(location.latitude, location.longitude);
        setMessage({ type: 'info', text: 'Using latest shared GPS. Confirm the release in MetaMask.' });

        const proof = releaseProofRef.current ?? await signReleaseWithGps(gps);
        await savePayload({
          ...location,
          dr_number: truckInfo.drNumber,
          tx_hash: proof.hash,
          wallet_address: proof.walletAddress,
          proof_mode: proof.mode,
          updated_at: new Date().toISOString()
        });
        setMessage({ type: 'success', text: 'MetaMask proof recorded with latest shared GPS.' });
      } catch (fallbackError) {
        const fallbackText = fallbackError instanceof Error ? fallbackError.message : getSigningErrorMessage(fallbackError);
        setMessage({ type: 'error', text: `${gpsErrorText} ${fallbackText}` });
      }
    } finally {
      setIsSigning(false);
    }
  };

  const signWithLatestSharedGps = async () => {
    setIsSigning(true);
    setMessage({ type: 'info', text: 'Loading latest shared GPS, then opening MetaMask.' });

    try {
      const location = await getLatestSharedGps();
      const gps = location.gps_text || formatCoordinates(location.latitude, location.longitude);
      const proof = releaseProofRef.current ?? await signReleaseWithGps(gps);
      await savePayload({
        ...location,
        dr_number: truckInfo.drNumber,
        tx_hash: proof.hash,
        wallet_address: proof.walletAddress,
        proof_mode: proof.mode,
        updated_at: new Date().toISOString()
      });
      setMessage({ type: 'success', text: 'MetaMask proof recorded with latest shared GPS.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : getSigningErrorMessage(error);
      setMessage({ type: 'error', text });
    } finally {
      setIsSigning(false);
    }
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
            disabled={isSigning}
          >
            <LocateFixed className="w-5 h-5" />
            {isSigning ? 'Opening MetaMask...' : isSharing ? 'Stop Sharing Location' : 'Sign & Share Location'}
          </button>

          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">No-Typing GPS Bridge</p>
            <button
              type="button"
              onClick={startGpsOnlySharing}
              disabled={isSigning}
              className="w-full min-h-11 rounded-lg border border-blue-700 text-blue-700 text-sm font-bold hover:bg-blue-50 disabled:opacity-60"
            >
              Start GPS Only
            </button>
            <button
              type="button"
              onClick={signWithLatestSharedGps}
              disabled={isSigning}
              className="w-full min-h-11 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 disabled:opacity-60"
            >
              Sign Latest Shared GPS
            </button>
            <p className="text-xs text-gray-500">
              Use GPS Only in Chrome/Safari, then sign the latest shared GPS in MetaMask.
            </p>
          </div>

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

          {gpsDebug && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              {gpsDebug}
            </div>
          )}

          {lastPayload && (
            <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-2">
              <p><span className="font-bold">GPS:</span> {lastPayload.gps_text}</p>
              <p><span className="font-bold">Accuracy:</span> {lastPayload.accuracy ?? 'N/A'} meters</p>
              <p><span className="font-bold">Updated:</span> {new Date(lastPayload.updated_at).toLocaleString()}</p>
              {releaseProof && (
                <>
                  <p><span className="font-bold">Wallet:</span> {releaseProof.walletAddress}</p>
                  <p><span className="font-bold">Proof:</span> {releaseProof.hash.slice(0, 18)}...</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
