import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin, Search, Loader2, Info } from 'lucide-react';
import { findPanayLgu, PANAY_LGUS } from '../../data/panayLguDirectory';

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  destinationAddress?: string;
  onLocationChange: (lat: number, lng: number, address?: string) => void;
  province?: string;
  municipality?: string;
}

// Custom high-visibility delivery pin marker
const pinIcon = L.divIcon({
  className: 'custom-shopee-pin',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab; transform: translate(-50%, -100%);">
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

function MapPanController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 14), { duration: 1.2 });
  }, [center, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export function LocationPickerMap({
  latitude,
  longitude,
  destinationAddress = '',
  onLocationChange,
  province = 'Iloilo',
  municipality = ''
}: LocationPickerMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [showResults, setShowResults] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);

  // Fallback initial position if 0 or invalid
  const validLat = typeof latitude === 'number' && !isNaN(latitude) && latitude !== 0 ? latitude : 10.6415;
  const validLng = typeof longitude === 'number' && !isNaN(longitude) && longitude !== 0 ? longitude : 122.2352;

  // React to municipality or province changes from the parent form
  useEffect(() => {
    if (!municipality) return;
    const lgu = findPanayLgu(municipality, province);
    if (lgu) {
      onLocationChange(
        lgu.lat,
        lgu.lng,
        destinationAddress || `${lgu.defaultFacility}, ${lgu.municipality}, ${lgu.province}`
      );
    }
  }, [municipality, province]);

  const handleMarkerDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const latLng = marker.getLatLng();
      onLocationChange(latLng.lat, latLng.lng, destinationAddress);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    onLocationChange(lat, lng, destinationAddress);
  };

  // Landmark search using OpenStreetMap Nominatim with local Panay fallback
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setShowResults(true);

    try {
      // 1. Check local Panay directory first
      const localMatches = PANAY_LGUS.filter((lgu) =>
        lgu.municipality.toLowerCase().includes(query.toLowerCase()) ||
        lgu.defaultFacility.toLowerCase().includes(query.toLowerCase())
      ).map((lgu) => ({
        label: `${lgu.defaultFacility} (${lgu.municipality}, ${lgu.province})`,
        lat: lgu.lat,
        lng: lgu.lng
      }));

      // 2. Query Nominatim API for exact landmark in Panay / Western Visayas
      const fullSearchTerm = `${query}, ${municipality || ''} ${province || 'Panay'}, Philippines`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullSearchTerm)}&limit=4`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();

      const onlineMatches = (data as Array<{ display_name: string; lat: string; lon: string }>).map((item) => ({
        label: item.display_name.split(',').slice(0, 3).join(', '),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));

      const combined = [...localMatches, ...onlineMatches];
      setSearchResults(combined.slice(0, 5));
    } catch {
      // Fallback to local matches if offline or API limit
      const localMatches = PANAY_LGUS.filter((lgu) =>
        lgu.municipality.toLowerCase().includes(query.toLowerCase())
      ).map((lgu) => ({
        label: `${lgu.defaultFacility} (${lgu.municipality}, ${lgu.province})`,
        lat: lgu.lat,
        lng: lgu.lng
      }));
      setSearchResults(localMatches);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: { label: string; lat: number; lng: number }) => {
    onLocationChange(item.lat, item.lng, item.label);
    setSearchQuery(item.label);
    setShowResults(false);
  };

  const resetToMunicipalityCenter = () => {
    const lgu = findPanayLgu(municipality || 'Miag-ao', province);
    if (lgu) {
      onLocationChange(lgu.lat, lgu.lng, `${lgu.defaultFacility}, ${lgu.municipality}`);
    }
  };

  const currentCenter = useMemo<[number, number]>(() => [validLat, validLng], [validLat, validLng]);

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wide">
          <MapPin className="h-4 w-4 text-red-600" />
          Delivery Destination Pin & Full Address
        </label>
        <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {validLat.toFixed(5)}, {validLng.toFixed(5)}
        </span>
      </div>

      {/* Full Address Input (Shopee-style) */}
      <div>
        <input
          type="text"
          value={destinationAddress}
          onChange={(e) => onLocationChange(validLat, validLng, e.target.value)}
          placeholder="e.g. Miag-ao Municipal Evacuation Center, Brgy. Kirayan, Miag-ao"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-800 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {/* Mini-Map Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search landmark, street, gym, or building..."
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </button>
          <button
            type="button"
            onClick={resetToMunicipalityCenter}
            title="Snap to Municipal Hall"
            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition flex items-center gap-1"
          >
            <Crosshair className="h-3.5 w-3.5 text-red-600" />
            <span className="hidden sm:inline">Center</span>
          </button>
        </form>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-[1000] mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {searchResults.map((result, idx) => (
              <button
                key={`${result.label}-${idx}`}
                type="button"
                onClick={() => selectSearchResult(result)}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex items-center gap-2"
              >
                <MapPin className="h-3 w-3 text-red-500 flex-shrink-0" />
                <span className="truncate">{result.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Mini-Map Container */}
      <div className="relative h-56 w-full overflow-hidden rounded-lg border border-gray-300 shadow-inner">
        <MapContainer
          center={currentCenter}
          zoom={14}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapPanController center={currentCenter} />
          <MapClickHandler onClick={handleMapClick} />
          <Marker
            ref={markerRef}
            position={currentCenter}
            icon={pinIcon}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd
            }}
          />
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[999] rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-600 shadow backdrop-blur-sm flex items-center gap-1">
          <Info size={12} className="text-[#2500ba] flex-shrink-0" />
          <span>Drag pin or click map to set exact drop-off point</span>
        </div>
      </div>
    </div>
  );
}
