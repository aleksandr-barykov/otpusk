export function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function plural(n, one, few, many) {
  n = Math.abs(n) % 100;
  if (n > 10 && n < 20) return many;
  n = n % 10;
  if (n === 1) return one;
  if (n > 1 && n < 5) return few;
  return many;
}

export function coordsToString(c) {
  if (!c) return '';
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

export function ymapsCoords(c) {
  return [c.lng, c.lat];
}

export function fromYmapsCoords(arr) {
  return { lat: arr[1], lng: arr[0] };
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('data')) e.dataset[k.slice(4).toLowerCase()] = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

export const CATEGORIES = {
  eat: { icon: '🍽', label: 'Где поесть', color: '#4CAF50' },
  walk: { icon: '🚶', label: 'Где погулять', color: '#2196F3' },
  see: { icon: '👁', label: 'Что посмотреть', color: '#FF9800' }
};

export function timeToMinutes(str) {
  if (!str) return 540;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function buildRouteUrl(locCoords, route, places) {
  const items = route.items || (Array.isArray(route) ? route : []);
  if (!items.length) return null;
  const points = [];
  items.forEach(item => {
    if (item.placeId === '__hotel__') {
      points.push(locCoords);
    } else {
      const p = places.find(x => x.id === item.placeId);
      if (p) points.push(p.coords);
    }
  });
  if (points.length < 2) return null;
  const coordsStr = points.map(c => `${c.lat},${c.lng}`).join('~');
  return `https://yandex.ru/maps/?rtext=~${coordsStr}&rtt=mt`;
}
