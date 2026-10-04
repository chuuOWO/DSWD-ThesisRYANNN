/**
 * Panay Island Province Boundaries and Mask Utilities
 * Provides polygon contours for Iloilo, Antique, Capiz, and Aklan.
 * Includes point-in-polygon verification and inverted mask coordinates for map spotlighting.
 */

export type PanayProvince = 'Iloilo' | 'Antique' | 'Capiz' | 'Aklan';

export const PANAY_PROVINCE_NAMES: PanayProvince[] = ['Iloilo', 'Antique', 'Capiz', 'Aklan'];

// Coordinates in [lat, lng]
export const PROVINCE_POLYGONS: Record<PanayProvince, [number, number][]> = {
  Antique: [
    [12.15, 121.40],
    [12.15, 122.05],
    [11.75, 122.15],
    [11.55, 122.18],
    [11.35, 122.20],
    [11.15, 122.22],
    [10.95, 122.20],
    [10.75, 122.18],
    [10.55, 122.10],
    [10.35, 122.05],
    [10.35, 121.80],
    [10.50, 121.85],
    [10.75, 121.90],
    [11.00, 121.95],
    [11.30, 121.98],
    [11.60, 121.90],
    [11.80, 121.50],
    [12.00, 121.45],
    [12.15, 121.40]
  ],
  Aklan: [
    [12.05, 121.80],
    [12.05, 122.25],
    [11.85, 122.40],
    [11.65, 122.58],
    [11.52, 122.58],
    [11.42, 122.48],
    [11.38, 122.25],
    [11.45, 122.10],
    [11.65, 122.05],
    [11.80, 121.85],
    [11.95, 121.85],
    [12.05, 121.80]
  ],
  Capiz: [
    [11.65, 122.45],
    [11.65, 122.75],
    [11.62, 122.88],
    [11.55, 123.05],
    [11.38, 123.05],
    [11.22, 122.78],
    [11.20, 122.50],
    [11.22, 122.42],
    [11.38, 122.38],
    [11.52, 122.45],
    [11.65, 122.45]
  ],
  Iloilo: [
    [11.65, 123.25],
    [11.40, 123.25],
    [11.15, 123.18],
    [10.98, 122.90],
    [10.82, 122.75],
    [10.65, 122.62],
    [10.60, 122.45],
    [10.50, 122.20],
    [10.38, 122.00],
    [10.55, 122.05],
    [10.60, 122.10],
    [10.78, 122.22],
    [10.95, 122.30],
    [11.15, 122.38],
    [11.25, 122.48],
    [11.35, 122.95],
    [11.55, 123.10],
    [11.65, 123.25]
  ]
};

export const PROVINCE_CENTERS: Record<PanayProvince, [number, number]> = {
  Iloilo: [10.95, 122.60],
  Capiz: [11.43, 122.70],
  Aklan: [11.65, 122.25],
  Antique: [11.05, 122.05]
};

export const PROVINCE_BOUNDS: Record<PanayProvince, [[number, number], [number, number]]> = {
  Iloilo: [[10.38, 122.00], [11.65, 123.25]],
  Capiz: [[11.20, 122.38], [11.65, 123.05]],
  Aklan: [[11.38, 121.80], [12.05, 122.58]],
  Antique: [[10.35, 121.40], [12.15, 122.22]]
};

// Ray-casting point-in-polygon verification
export function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInProvince(lat: number, lng: number, province: string): boolean {
  const norm = (province || '').trim().toLowerCase();
  const matched = PANAY_PROVINCE_NAMES.find(p => p.toLowerCase() === norm);
  if (!matched) return true; // If unspecified, allow
  return isPointInPolygon(lat, lng, PROVINCE_POLYGONS[matched]);
}

// Inverted mask: World rectangle outer boundary + Inner province hole
// When passed to react-leaflet <Polygon positions={[outer, inner]} />, Leaflet renders
// a dark overlay over the entire globe EXCEPT the selected province.
export function getInvertedMaskPositions(province: string): [number, number][][] {
  const norm = (province || '').trim().toLowerCase();
  const matched = PANAY_PROVINCE_NAMES.find(p => p.toLowerCase() === norm);
  if (!matched) return [];

  const worldOuterRing: [number, number][] = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180]
  ];

  return [worldOuterRing, PROVINCE_POLYGONS[matched]];
}

