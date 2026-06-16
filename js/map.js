import { APP_CONFIG } from '../config.js';
import { ymapsCoords, fromYmapsCoords } from './utils.js';

let ready = false;
let YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker;
let mapInstance = null;
let markers = [];

export async function loadAPI() {
  if (ready) return;
  const key = APP_CONFIG.ymapsApiKey;
  if (!key) throw new Error('Укажите API-ключ Яндекс.Карт в config.js');
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://api-maps.yandex.ru/3.0/?apikey=${key}&lang=ru_RU`;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не удалось загрузить Яндекс.Карты'));
    document.head.appendChild(s);
  });
  await ymaps3.ready;
  YMap = ymaps3.YMap;
  YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer;
  YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer;
  YMapMarker = ymaps3.YMapMarker;
  ready = true;
}

export async function initMap(container, center, zoom = 14) {
  if (!ready) await loadAPI();
  if (mapInstance) destroyMap();
  mapInstance = new YMap(container, {
    location: { center: ymapsCoords(center), zoom },
    mode: 'vector',
    features: { autoFitToViewport: 'always' }
  });
  mapInstance.addChild(new YMapDefaultSchemeLayer());
  mapInstance.addChild(new YMapDefaultFeaturesLayer());
  return mapInstance;
}

export function destroyMap() {
  if (mapInstance) { mapInstance.destroy(); mapInstance = null; }
  while (markers.length) markers.pop();
}

export function addMarker(coords, html, id) {
  if (!mapInstance) return;
  const el = document.createElement('div');
  el.innerHTML = html;
  el.className = 'ymaps-marker';
  if (id) el.dataset.markerId = id;
  const m = new YMapMarker({ coordinates: ymapsCoords(coords) }, el);
  mapInstance.addChild(m);
  markers.push({ id, m, el });
  return m;
}

export function removeMarker(id) {
  const i = markers.findIndex(x => x.id === id);
  if (i === -1) return;
  mapInstance.removeChild(markers[i].m);
  markers.splice(i, 1);
}

export function clearMarkers() {
  markers.forEach(x => mapInstance.removeChild(x.m));
  markers = [];
}

export async function searchPlaces(query) {
  const key = APP_CONFIG.ymapsApiKey;
  if (!key) return [];
  const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${key}&geocode=${encodeURIComponent(query)}&format=json&results=5&lang=ru_RU`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    const members = d.response?.GeoObjectCollection?.featureMember || [];
    return members.map(m => {
      const g = m.GeoObject;
      const [lng, lat] = g.Point.pos.split(' ').map(Number);
      return { name: g.name, description: g.description, coords: { lat, lng } };
    });
  } catch {
    return [];
  }
}

export function hasAPIKey() {
  return !!APP_CONFIG.ymapsApiKey;
}
