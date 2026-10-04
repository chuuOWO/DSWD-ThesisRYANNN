// Centralized map tile configuration
// Uses high-contrast, colorful, reliable OpenStreetMap raster tiles application-wide.

export const MAP_TILE_CONFIG = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  subdomains: ['a', 'b', 'c'],
  maxZoom: 19
};

