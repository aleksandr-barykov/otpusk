const STORAGE_KEY = 'vacation-planner';
let data = null;

function def() {
  return { version: 3, locations: [], places: [], routes: [], nextIds: { loc: 1, pl: 1, rt: 1 } };
}

function migrate() {
  if (!data || data.version >= 3) return;
  data.routes.forEach(r => {
    if (r.placeIds && !r.items) {
      r.items = r.placeIds.map(id => ({ placeId: id, duration: 60 }));
      delete r.placeIds;
    }
    if (!r.items) r.items = [];
    if (!r.items.length || r.items[0].placeId !== '__hotel__') {
      r.items.unshift({ placeId: '__hotel__', duration: 0 });
    }
    if (!r.startTime) r.startTime = '09:00';
  });
  data.version = 3;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? JSON.parse(raw) : null;
  } catch { data = null; }
  if (!data) data = def();
  migrate();
}

export function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadExample(ex) {
  data = JSON.parse(JSON.stringify(ex));
  if (!data.nextIds) data.nextIds = { loc: 1, pl: 1, rt: 1 };
  save();
}

export function getLocations() { return [...data.locations]; }
export function getLocation(id) { return data.locations.find(l => l.id === id); }

export function addLocation(l) {
  l.id = 'loc-' + data.nextIds.loc++;
  data.locations.push(l);
  save();
  return l;
}

export function updateLocation(id, u) {
  const i = data.locations.findIndex(x => x.id === id);
  if (i === -1) return null;
  Object.assign(data.locations[i], u);
  save();
  return data.locations[i];
}

export function deleteLocation(id) {
  data.locations = data.locations.filter(x => x.id !== id);
  data.places = data.places.filter(x => x.locationId !== id);
  data.routes = data.routes.filter(x => x.locationId !== id);
  save();
}

export function getPlaces(locationId) {
  if (!locationId) return [...data.places];
  const ps = data.places.filter(p => p.locationId === locationId);
  return ps.sort((a, b) => a.order - b.order);
}

export function getPlace(id) { return data.places.find(p => p.id === id); }

export function addPlace(p) {
  p.id = 'pl-' + data.nextIds.pl++;
  p.order = data.places.filter(x => x.locationId === p.locationId).length;
  data.places.push(p);
  save();
  return p;
}

export function updatePlace(id, u) {
  const i = data.places.findIndex(x => x.id === id);
  if (i === -1) return null;
  Object.assign(data.places[i], u);
  save();
  return data.places[i];
}

export function deletePlace(id) {
  data.places = data.places.filter(p => p.id !== id);
  data.routes.forEach(r => {
    if (r.items) r.items = r.items.filter(x => x.placeId !== id);
  });
  save();
}

export function reorderPlaces(locationId, orderedIds) {
  const ps = data.places.filter(p => p.locationId === locationId);
  ps.forEach(p => {
    const idx = orderedIds.indexOf(p.id);
    if (idx !== -1) p.order = idx;
  });
  save();
}

export function getRoutes(locationId) {
  if (!locationId) return [...data.routes];
  return data.routes.filter(r => r.locationId === locationId).sort((a, b) => a.dayNumber - b.dayNumber);
}

export function getRoute(id) { return data.routes.find(r => r.id === id); }

export function addRoute(r) {
  r.id = 'rt-' + data.nextIds.rt++;
  if (!r.items) r.items = [{ placeId: '__hotel__', duration: 0 }];
  if (!r.startTime) r.startTime = '09:00';
  data.routes.push(r);
  save();
  return r;
}

export function updateRoute(id, u) {
  const i = data.routes.findIndex(x => x.id === id);
  if (i === -1) return null;
  Object.assign(data.routes[i], u);
  save();
  return data.routes[i];
}

export function deleteRoute(id) {
  data.routes = data.routes.filter(r => r.id !== id);
  save();
}

export function exportJSON() {
  return JSON.stringify(data, null, 2);
}

export function importJSON(str) {
  try {
    const d = JSON.parse(str);
    if (!d.version || !Array.isArray(d.locations)) return false;
    data = d;
    migrate();
    save();
    return true;
  } catch { return false; }
}
