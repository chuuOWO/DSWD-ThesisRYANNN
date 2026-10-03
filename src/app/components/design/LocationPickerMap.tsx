import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin, Search, Loader2, Info } from 'lucide-react';
import {
  findPanayLgu,
  PANAY_LGUS,
  PANAY_PROVINCES,
  PANAY_MUNICIPALITIES_BY_PROVINCE
} from '../../data/panayLguDirectory';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';

export interface LocationAddressDetails {
  building: string;
  street: string;
  barangay: string;
  district: string;
  municipality: string;
  province: string;
}

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  destinationAddress?: string;
  onLocationChange: (
    lat: number,
    lng: number,
    address?: string,
    details?: LocationAddressDetails
  ) => void;
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

interface SearchResultItem {
  label: string;
  lat: number;
  lng: number;
  building?: string;
  street?: string;
  barangay?: string;
  district?: string;
  muni?: string;
  prov?: string;
}

function MapPanController({ center, zoom = 14 }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, map, zoom]);
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
  // Structured Panay Island address components
  const [building, setBuilding] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [district, setDistrict] = useState('NA');
  const [selectedProvince, setSelectedProvince] = useState<string>(
    PANAY_PROVINCES.includes(province as any) ? province : 'Iloilo'
  );
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(
    municipality || 'Oton'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [targetZoom, setTargetZoom] = useState<number>(14);
  const [showResults, setShowResults] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);

  // Fallback initial position if 0 or invalid
  const validLat = typeof latitude === 'number' && !isNaN(latitude) && latitude !== 0 ? latitude : 10.6975;
  const validLng = typeof longitude === 'number' && !isNaN(longitude) && longitude !== 0 ? longitude : 122.4764;

  // Helper to compile structured address string
  const compileAddress = (
    b: string,
    s: string,
    brgy: string,
    dist: string,
    mun: string,
    prov: string
  ) => {
    const parts: string[] = [];
    if (b.trim()) parts.push(b.trim());
    if (s.trim()) parts.push(s.trim());
    if (brgy.trim()) parts.push(brgy.trim());
    if (dist.trim() && dist.trim().toUpperCase() !== 'NA') parts.push(dist.trim());
    if (mun.trim()) parts.push(mun.trim());
    if (prov.trim()) parts.push(prov.trim());
    return parts.join(', ');
  };

  const updateAddressFields = (
    nextBuilding: string,
    nextStreet: string,
    nextBarangay: string,
    nextDistrict: string,
    nextMun: string,
    nextProv: string,
    newLat = validLat,
    newLng = validLng
  ) => {
    const compiled = compileAddress(nextBuilding, nextStreet, nextBarangay, nextDistrict, nextMun, nextProv);
    onLocationChange(newLat, newLng, compiled, {
      building: nextBuilding,
      street: nextStreet,
      barangay: nextBarangay,
      district: nextDistrict,
      municipality: nextMun,
      province: nextProv
    });
  };

  // Sync province/municipality if passed from outside
  useEffect(() => {
    if (province && PANAY_PROVINCES.includes(province as any) && province !== selectedProvince) {
      setSelectedProvince(province);
    }
  }, [province]);

  useEffect(() => {
    if (municipality && municipality !== selectedMunicipality) {
      setSelectedMunicipality(municipality);
    }
  }, [municipality]);

  const handleProvinceSelect = (newProv: string) => {
    setSelectedProvince(newProv);
    const munList = PANAY_MUNICIPALITIES_BY_PROVINCE[newProv] || [];
    const newMun = munList[0] || '';
    setSelectedMunicipality(newMun);
    const lgu = findPanayLgu(newMun, newProv);
    const newLat = lgu?.lat || validLat;
    const newLng = lgu?.lng || validLng;
    updateAddressFields(building, street, barangay, district, newMun, newProv, newLat, newLng);
  };

  const handleMunicipalitySelect = (newMun: string) => {
    setSelectedMunicipality(newMun);
    const lgu = findPanayLgu(newMun, selectedProvince);
    const newLat = lgu?.lat || validLat;
    const newLng = lgu?.lng || validLng;
    updateAddressFields(building, street, barangay, district, newMun, selectedProvince, newLat, newLng);
  };

  const handleMarkerDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const latLng = marker.getLatLng();
      updateAddressFields(building, street, barangay, district, selectedMunicipality, selectedProvince, latLng.lat, latLng.lng);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    updateAddressFields(building, street, barangay, district, selectedMunicipality, selectedProvince, lat, lng);
  };

  // Universal building-level search using Photon + Nominatim with Panay directory fallback
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setShowResults(true);

    try {
      const results: SearchResultItem[] = [];

      // 1. Check local Panay directory matches
      const localMatches: SearchResultItem[] = PANAY_LGUS.filter((lgu) =>
        lgu.municipality.toLowerCase().includes(query.toLowerCase()) ||
        lgu.defaultFacility.toLowerCase().includes(query.toLowerCase()) ||
        lgu.province.toLowerCase().includes(query.toLowerCase())
      ).map((lgu) => ({
        label: `${lgu.defaultFacility}, ${lgu.municipality}, ${lgu.province}`,
        lat: lgu.lat,
        lng: lgu.lng,
        building: lgu.defaultFacility,
        street: '',
        barangay: '',
        district: 'NA',
        muni: lgu.municipality,
        prov: lgu.province
      }));

      // 2. Query Photon Geocoding API (biased to Panay Island coords: lat 10.7, lon 122.5)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=10.7&lon=122.5&limit=8`;
        const photonRes = await fetch(photonUrl);
        if (photonRes.ok) {
          const photonJson = await photonRes.json();
          if (photonJson.features && Array.isArray(photonJson.features)) {
            for (const feat of photonJson.features) {
              const coords = feat.geometry?.coordinates;
              const props = feat.properties || {};
              if (Array.isArray(coords) && coords.length >= 2) {
                const lng = coords[0];
                const lat = coords[1];
                const name = props.name || props.street || '';
                const muni = props.city || props.town || props.municipality || '';
                const prov = props.state || '';
                const streetName = props.street || '';
                const districtName = props.district || props.suburb || 'NA';
                const labelParts = [name, streetName, muni, prov].filter(Boolean);
                const label = labelParts.length > 0 ? labelParts.join(', ') : `${name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

                if (name) {
                  results.push({
                    label,
                    lat,
                    lng,
                    building: name,
                    street: streetName,
                    barangay: props.district || '',
                    district: districtName,
                    muni,
                    prov
                  });
                }
              }
            }
          }
        }
      } catch {
        // Photon failed or was blocked; continue to Nominatim
      }

      // 3. Complement/Fallback with OpenStreetMap Nominatim
      if (results.length < 5) {
        try {
          const nominatimQuery = `${query}, Panay, Philippines`;
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ph&q=${encodeURIComponent(nominatimQuery)}&limit=5`;
          const nomRes = await fetch(nomUrl, { headers: { 'Accept-Language': 'en' } });
          if (nomRes.ok) {
            const nomJson = await nomRes.json();
            if (Array.isArray(nomJson)) {
              for (const item of nomJson) {
                const addr = item.address || {};
                const buildingName = addr.amenity || addr.building || addr.office || addr.school || addr.leisure || item.display_name.split(',')[0].trim();
                const road = addr.road || '';
                const brgy = addr.quarter || addr.suburb || addr.village || addr.neighbourhood || '';
                const muni = addr.city || addr.town || addr.municipality || '';
                const prov = addr.state || addr.province || '';
                results.push({
                  label: item.display_name.split(',').slice(0, 4).join(', '),
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                  building: buildingName,
                  street: road,
                  barangay: brgy,
                  district: addr.city_district || 'NA',
                  muni,
                  prov
                });
              }
            }
          }
        } catch {
          // Nominatim failed; fall back
        }
      }

      // Deduplicate results by rounded lat/lng coordinates
      const seen = new Set<string>();
      const combined = [...results, ...localMatches].filter((r) => {
        const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSearchResults(combined.slice(0, 8));
    } catch {
      const localMatches: SearchResultItem[] = PANAY_LGUS.filter((lgu) =>
        lgu.municipality.toLowerCase().includes(query.toLowerCase())
      ).map((lgu) => ({
        label: `${lgu.defaultFacility} (${lgu.municipality}, ${lgu.province})`,
        lat: lgu.lat,
        lng: lgu.lng,
        building: lgu.defaultFacility,
        street: '',
        barangay: '',
        district: 'NA',
        muni: lgu.municipality,
        prov: lgu.province
      }));
      setSearchResults(localMatches);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: SearchResultItem) => {
    let matchedProv = selectedProvince;
    if (item.prov) {
      const foundProv = PANAY_PROVINCES.find((p) => item.prov?.toLowerCase().includes(p.toLowerCase()));
      if (foundProv) matchedProv = foundProv;
    }
    setSelectedProvince(matchedProv);

    let matchedMuni = selectedMunicipality;
    if (item.muni) {
      const muniList = PANAY_MUNICIPALITIES_BY_PROVINCE[matchedProv] || [];
      const foundMuni = muniList.find(
        (m) => item.muni?.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(item.muni!.toLowerCase())
      );
      if (foundMuni) {
        matchedMuni = foundMuni;
      } else {
        matchedMuni = item.muni;
      }
    }
    setSelectedMunicipality(matchedMuni);

    const nextBuilding = item.building || item.label.split(',')[0].trim();
    const nextStreet = item.street || street;
    const nextBarangay = item.barangay || barangay;
    const nextDistrict = item.district || district;

    setBuilding(nextBuilding);
    if (item.street) setStreet(item.street);
    if (item.barangay) setBarangay(item.barangay);
    if (item.district) setDistrict(item.district);

    setTargetZoom(17);

    updateAddressFields(
      nextBuilding,
      nextStreet,
      nextBarangay,
      nextDistrict,
      matchedMuni,
      matchedProv,
      item.lat,
      item.lng
    );
    setSearchQuery(item.label);
    setShowResults(false);
  };

  const resetToMunicipalityCenter = () => {
    setTargetZoom(14);
    const lgu = findPanayLgu(selectedMunicipality || 'Oton', selectedProvince);
    if (lgu) {
      updateAddressFields(
        building || lgu.defaultFacility,
        street,
        barangay,
        district,
        lgu.municipality,
        lgu.province,
        lgu.lat,
        lgu.lng
      );
    }
  };

  const currentCenter = useMemo<[number, number]>(() => [validLat, validLng], [validLat, validLng]);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wide">
          <MapPin className="h-4 w-4 text-[#2500ba]" />
          Destination Delivery Location & Address (Panay Only)
        </label>
        <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {validLat.toFixed(5)}, {validLng.toFixed(5)}
        </span>
      </div>

      {/* Structured Address Entry (Panay Island Only) */}
      <div className="space-y-2.5 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700">Detailed Address Breakdown</span>
          <span className="text-[10px] font-semibold text-[#2500ba] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Panay Island Only (Region VI)
          </span>
        </div>

        {/* Row 1: Building / Facility & Street */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Building / Facility Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={building}
              onChange={(e) => {
                setBuilding(e.target.value);
                updateAddressFields(e.target.value, street, barangay, district, selectedMunicipality, selectedProvince);
              }}
              placeholder="e.g. Municipal Evacuation Center / Gym"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba]"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Street / Road Name
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => {
                setStreet(e.target.value);
                updateAddressFields(building, e.target.value, barangay, district, selectedMunicipality, selectedProvince);
              }}
              placeholder="e.g. Rizal Street, National Highway"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba]"
            />
          </div>
        </div>

        {/* Row 2: Barangay & District */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Barangay <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={barangay}
              onChange={(e) => {
                setBarangay(e.target.value);
                updateAddressFields(building, street, e.target.value, district, selectedMunicipality, selectedProvince);
              }}
              placeholder="e.g. Brgy. Kirayan Sur"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba]"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              District (if applicable, else NA)
            </label>
            <input
              type="text"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                updateAddressFields(building, street, barangay, e.target.value, selectedMunicipality, selectedProvince);
              }}
              placeholder="NA"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba]"
            />
          </div>
        </div>

        {/* Row 3: Province & Municipality Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Province <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProvince}
              onChange={(e) => handleProvinceSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba]"
            >
              {PANAY_PROVINCES.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Municipality / City <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedMunicipality}
              onChange={(e) => handleMunicipalitySelect(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#2500ba]"
            >
              {(PANAY_MUNICIPALITIES_BY_PROVINCE[selectedProvince] || []).map((mun) => (
                <option key={mun} value={mun}>
                  {mun}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compiled Address Summary */}
        <div className="pt-1">
          <label className="block text-[10.5px] font-semibold text-gray-500 mb-0.5">
            Compiled Full Destination Address:
          </label>
          <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 truncate select-all">
            {destinationAddress || 'Building, Barangay, Municipality, Province'}
          </div>
        </div>
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
              placeholder="Search Panay landmark, gym, or school..."
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-xs text-gray-700 focus:border-[#2500ba] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="rounded-lg bg-[#2500ba] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </button>
          <button
            type="button"
            onClick={resetToMunicipalityCenter}
            title="Snap to Municipal Center"
            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition flex items-center gap-1 cursor-pointer"
          >
            <Crosshair className="h-3.5 w-3.5 text-[#2500ba]" />
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
                <MapPin className="h-3 w-3 text-[#2500ba] flex-shrink-0" />
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
            attribution={MAP_TILE_CONFIG.attribution}
            url={MAP_TILE_CONFIG.url}
            subdomains={MAP_TILE_CONFIG.subdomains}
            maxZoom={MAP_TILE_CONFIG.maxZoom}
          />
          <MapPanController center={currentCenter} zoom={targetZoom} />
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
          <span>Drag pin or click map to pinpoint exact delivery facility</span>
        </div>
      </div>
    </div>
  );
}
