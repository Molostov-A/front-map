const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.utf8';

function rasterStyle({ tiles, tileSize = 256, maxzoom = 19, attribution, background = '#0b0d10' }) {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      basemap: { type: 'raster', tiles, tileSize, maxzoom, attribution }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': background } },
      { id: 'basemap', type: 'raster', source: 'basemap' }
    ]
  };
}

const google = (lyrs) => [
  `https://mt0.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}&hl=ru`,
  `https://mt1.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}&hl=ru`,
  `https://mt2.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}&hl=ru`,
  `https://mt3.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}&hl=ru`
];

const yandex = (l) => [
  `https://core-renderer-tiles.maps.yandex.net/tiles?l=${l}&x={x}&y={y}&z={z}&scale=1&lang=ru_RU`
];

const carto = (name) => [
  `https://a.basemaps.cartocdn.com/${name}/{z}/{x}/{y}.png`,
  `https://b.basemaps.cartocdn.com/${name}/{z}/{x}/{y}.png`,
  `https://c.basemaps.cartocdn.com/${name}/{z}/{x}/{y}.png`
];

export const BASEMAPS = [
  { id: 'liberty', group: 'Вектор', label: 'Схема (OpenFreeMap)', kind: 'liberty' },

  { id: 'carto-light', group: 'OSM', label: 'Схема (CARTO)', style: rasterStyle({ tiles: carto('light_all'), attribution: '© OpenStreetMap, © CARTO' }) },
  { id: 'osm', group: 'OSM', label: 'Схема (OSM)', style: rasterStyle({ tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap' }) },

  { id: 'google-scheme', group: 'Google', label: 'Схема', style: rasterStyle({ tiles: google('m'), attribution: '© Google' }) },
  { id: 'google-sat', group: 'Google', label: 'Спутник', style: rasterStyle({ tiles: google('s'), attribution: '© Google' }) },
  { id: 'google-hybrid', group: 'Google', label: 'Гибрид', style: rasterStyle({ tiles: google('y'), attribution: '© Google' }) },
  { id: 'google-terrain', group: 'Google', label: 'Рельеф', style: rasterStyle({ tiles: google('p'), attribution: '© Google' }) },

  { id: 'yandex-scheme', group: 'Яндекс', label: 'Схема', style: rasterStyle({ tiles: yandex('map'), attribution: '© Яндекс' }) },
  { id: 'yandex-sat', group: 'Яндекс', label: 'Спутник', style: rasterStyle({ tiles: yandex('sat'), attribution: '© Яндекс' }) },
  { id: 'yandex-hybrid', group: 'Яндекс', label: 'Гибрид', style: rasterStyle({ tiles: yandex('sat,skl'), attribution: '© Яндекс' }) }
];

export const DEFAULT_BASEMAP_ID = 'liberty';

export const basemapById = (id) => BASEMAPS.find((b) => b.id === id);
