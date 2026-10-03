// Centralized map tile configuration
// CARTO requires an API key (https://carto.com/basemaps/apikey/) to prevent watermarks.
// If VITE_CARTO_API_KEY is set in .env, CARTO Voyager is used without watermarks.
// If VITE_CARTO_API_KEY is omitted, it gracefully falls back to clean OpenStreetMap tiles.

const cartoKey = (import.meta.env.VITE_CARTO_API_KEY || '').trim();

export const MAP_TILE_CONFIG = {
  url: cartoKey
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: cartoKey
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  subdomains: cartoKey ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c'],
  maxZoom: 19
};
