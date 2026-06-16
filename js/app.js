import * as Store from './store.js';
import * as Ui from './ui.js';
import * as Map from './map.js';
import { APP_CONFIG } from '../config.js';
import { debounce, escHtml, buildRouteUrl, CATEGORIES } from './utils.js';

init();

async function init() {
  Store.load();
  if (Store.getLocations().length === 0) {
    try {
      const r = await fetch('data/example.json');
      Store.loadExample(await r.json());
    } catch {}
  }
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('change', handleChange);
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  Map.destroyMap();
  const hash = location.hash.slice(1).replace(/\/$/, '') || '';
  const parts = hash.split('/').filter(Boolean);

  if (parts.length === 0) {
    Ui.renderHome();
  } else if (parts[0] === 'location' && parts.length === 2) {
    Ui.renderLocation(parts[1]);
    setTimeout(() => initMapForLocation(parts[1]), 100);
    setTimeout(() => { setupSearch(); setupDragDrop(); }, 150);
  } else if (parts[0] === 'location' && parts.length === 3 && parts[2] === 'route') {
    Ui.renderRoute(parts[1]);
    setTimeout(setupDragDrop, 100);
  } else if (parts[0] === 'settings') {
    Ui.renderSettings();
  } else {
    Ui.renderHome();
  }
}

async function initMapForLocation(locId) {
  const loc = Store.getLocation(locId);
  if (!loc || !APP_CONFIG.ymapsApiKey) return;
  const c = document.getElementById('map-container');
  if (!c) return;
  try {
    await Map.initMap(c, loc.coords, 14);
    Map.addMarker(loc.coords, '<div style="font-size:28px">🏨</div>', 'hotel');
    const icons = { eat: '🍽', walk: '🚶', see: '👁' };
    Store.getPlaces(locId).forEach(p => {
      Map.addMarker(p.coords, `<div style="font-size:22px">${icons[p.category]}</div>`, p.id);
    });
  } catch (e) { console.warn('Map:', e.message); }
}

function updateMapMarkers(locId) {
  if (!APP_CONFIG.ymapsApiKey) return;
  const icons = { eat: '🍽', walk: '🚶', see: '👁' };
  Map.clearMarkers();
  const loc = Store.getLocation(locId);
  if (loc) Map.addMarker(loc.coords, '<div style="font-size:28px">🏨</div>', 'hotel');
  Store.getPlaces(locId).forEach(p => {
    Map.addMarker(p.coords, `<div style="font-size:22px">${icons[p.category]}</div>`, p.id);
  });
}

function setupSearch() {
  const input = document.getElementById('place-search');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  const doSearch = debounce(async () => {
    const q = input.value.trim();
    if (!q) { results.style.display = 'none'; return; }
    const data = await Map.searchPlaces(q);
    if (data.length === 0) { results.style.display = 'none'; return; }
    results.innerHTML = data.map(r =>
      `<div class="search-result" data-sr-name="${escHtml(r.name)}" data-sr-lat="${r.coords.lat}" data-sr-lng="${r.coords.lng}" data-sr-desc="${escHtml(r.description || '')}">
        <div class="sr-info"><div class="sr-name">${escHtml(r.name)}</div><div class="sr-desc">${escHtml(r.description || '')}</div></div>
        <button class="btn btn-primary btn-sm sr-add">+ Добавить</button>
      </div>`
    ).join('');
    results.style.display = 'block';
    results.querySelectorAll('.sr-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = btn.closest('.search-result');
        const locId = Ui.getCurrentLocId();
        Ui.showAddPlaceModal(locId, null, {
          name: parent.dataset.srName,
          coords: { lat: +parent.dataset.srLat, lng: +parent.dataset.srLng },
          description: parent.dataset.srDesc
        });
        results.style.display = 'none';
        input.value = '';
      });
    });
  }, 400);
  input.addEventListener('input', doSearch);
}

function setupDragDrop() {
  document.querySelectorAll('.places-list').forEach(list => {
    setupDnD(list, (ids) => Store.reorderPlaces(list.dataset.locid, ids));
  });
  document.querySelectorAll('.route-places-list').forEach(list => {
    setupDnD(list, (ids) => {
      Store.updateRoute(list.dataset.routeId, { placeIds: ids });
    });
  });
}

let dragId = null;
function setupDnD(container, onReorder) {
  if (!container) return;
  container.addEventListener('dragstart', (e) => {
    const c = e.target.closest('[data-drag-id]');
    if (!c) return;
    dragId = c.dataset.dragId;
    c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  container.addEventListener('dragend', () => {
    container.querySelectorAll('.dragging,.drag-over').forEach(el => el.classList.remove('dragging', 'drag-over'));
  });
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const c = e.target.closest('[data-drag-id]');
    if (!c || c.dataset.dragId === dragId) return;
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    c.classList.add('drag-over');
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const t = e.target.closest('[data-drag-id]');
    if (!t || !dragId || dragId === t.dataset.dragId) return;
    const dragEl = container.querySelector(`[data-drag-id="${dragId}"]`);
    if (dragEl && t) container.insertBefore(dragEl, t);
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    onReorder([...container.querySelectorAll('[data-drag-id]')].map(el => el.dataset.dragId));
  });
}

function handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;

  if (a === 'navigate') { location.hash = btn.dataset.href; return; }
  if (a === 'close-modal') { Ui.hideModal(); return; }
  if (a === 'add-location') { Ui.showAddLocationModal(); return; }

  if (a === 'edit-location') { Ui.showEditLocationModal(btn.dataset.id); return; }

  if (a === 'delete-location') {
    if (confirm('Удалить локацию и все её места и маршруты?')) {
      Store.deleteLocation(btn.dataset.id);
      handleRoute();
    }
    return;
  }

  if (a === 'view-location') { location.hash = `/location/${btn.dataset.id}`; return; }
  if (a === 'view-route') { location.hash = `/location/${btn.dataset.id}/route`; return; }

  if (a === 'add-place') {
    Ui.showAddPlaceModal(Ui.getCurrentLocId(), null, null);
    return;
  }

  if (a === 'edit-place') { Ui.showEditPlaceModal(btn.dataset.id); return; }

  if (a === 'delete-place') {
    if (confirm('Удалить место?')) {
      Store.deletePlace(btn.dataset.id);
      const locId = Ui.getCurrentLocId();
      if (locId && document.getElementById('page-location').classList.contains('active')) {
        Ui.reRenderPlaces(locId);
        updateMapMarkers(locId);
      } else {
        handleRoute();
      }
    }
    return;
  }

  if (a === 'add-to-route') {
    const locId = Ui.getCurrentLocId() || btn.dataset.locid;
    if (!locId) return;
    const routes = Store.getRoutes(locId);
    if (routes.length === 0) {
      const r = Store.addRoute({ locationId: locId, dayNumber: 1, placeIds: [btn.dataset.id] });
      Ui.hideModal();
      if (confirm('Место добавлено в День 1. Перейти к маршрутам?')) {
        location.hash = `/location/${locId}/route`;
      }
    } else {
      Ui.showAddToRouteModal(btn.dataset.id, locId);
    }
    return;
  }

  if (a === 'toggle-route-place') {
    const pid = btn.dataset.placeId;
    const rid = btn.dataset.routeId;
    const route = Store.getRoute(rid);
    if (!route) return;
    const newIds = route.placeIds.includes(pid)
      ? route.placeIds.filter(x => x !== pid)
      : [...route.placeIds, pid];
    Store.updateRoute(rid, { placeIds: newIds });
    Ui.renderRoute(Ui.getCurrentLocId());
    setTimeout(setupDragDrop, 100);
    return;
  }

  if (a === 'remove-from-route') {
    const pid = btn.dataset.placeId;
    const rid = btn.dataset.routeId;
    const route = Store.getRoute(rid);
    if (!route) return;
    Store.updateRoute(rid, { placeIds: route.placeIds.filter(x => x !== pid) });
    Ui.renderRoute(Ui.getCurrentLocId());
    setTimeout(setupDragDrop, 100);
    return;
  }

  if (a === 'switch-cat') {
    const cat = btn.dataset.cat;
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.category-panel').forEach(p => p.classList.remove('active'));
    const panel = document.querySelector(`.category-panel[data-cat-panel="${cat}"]`);
    if (panel) panel.classList.add('active');
    return;
  }

  if (a === 'switch-day') {
    const id = btn.dataset.id;
    Ui.setCurrentDayId(id);
    document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    const panel = document.querySelector(`.day-panel[data-day="${id}"]`);
    if (panel) panel.classList.add('active');
    return;
  }

  if (a === 'add-day') {
    const locId = Ui.getCurrentLocId();
    const routes = Store.getRoutes(locId);
    const maxDay = routes.length ? Math.max(...routes.map(r => r.dayNumber)) : 0;
    const r = Store.addRoute({ locationId: locId, dayNumber: maxDay + 1, placeIds: [] });
    Ui.setCurrentDayId(r.id);
    Ui.renderRoute(locId);
    setTimeout(setupDragDrop, 100);
    return;
  }

  if (a === 'delete-day') {
    const locId = Ui.getCurrentLocId();
    const rid = btn.dataset.id;
    if (confirm('Удалить этот день?')) {
      Store.deleteRoute(rid);
      Ui.renderRoute(locId);
      setTimeout(setupDragDrop, 100);
    }
    return;
  }

  if (a === 'build-route') {
    const rid = btn.dataset.id;
    const locId = btn.dataset.locid;
    const loc = Store.getLocation(locId);
    const route = Store.getRoute(rid);
    const places = Store.getPlaces(locId);
    if (loc && route && route.placeIds.length >= 2) {
      const url = buildRouteUrl(loc.coords, route.placeIds, places);
      window.open(url, '_blank');
    }
    return;
  }

  if (a === 'export-data') {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement('a');
    aEl.href = url;
    aEl.download = `vacation-planner-${new Date().toISOString().slice(0, 10)}.json`;
    aEl.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (a === 'import-data') {
    document.getElementById('import-file').click();
    return;
  }

  if (a === 'reset-data') {
    if (confirm('Сбросить все данные к примеру? Текущие данные будут потеряны.')) {
      fetch('data/example.json').then(r => r.json()).then(d => {
        Store.loadExample(d);
        handleRoute();
      });
    }
    return;
  }

  if (a === 'copy-coords') {
    navigator.clipboard?.writeText(btn.dataset.coords).catch(() => {});
    return;
  }
}

function handleSubmit(e) {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());

  switch (form.dataset.form) {
    case 'add-location': {
      Store.addLocation({ name: data.name, hotelName: data.hotelName || '', coords: { lat: +data.lat, lng: +data.lng }, description: data.description || '' });
      Ui.hideModal();
      handleRoute();
      break;
    }
    case 'edit-location': {
      Store.updateLocation(form.dataset.id, { name: data.name, hotelName: data.hotelName || '', coords: { lat: +data.lat, lng: +data.lng }, description: data.description || '' });
      Ui.hideModal();
      handleRoute();
      break;
    }
    case 'add-place': {
      const locId = form.dataset.locid || Ui.getCurrentLocId();
      Store.addPlace({ locationId: locId, name: data.name, category: data.category, coords: { lat: +data.lat, lng: +data.lng }, description: data.description || '' });
      Ui.hideModal();
      if (locId && document.getElementById('page-location').classList.contains('active')) {
        Ui.reRenderPlaces(locId);
        updateMapMarkers(locId);
        setTimeout(setupDragDrop, 50);
      } else {
        handleRoute();
      }
      break;
    }
    case 'edit-place': {
      Store.updatePlace(form.dataset.id, { name: data.name, category: data.category, coords: { lat: +data.lat, lng: +data.lng }, description: data.description || '' });
      Ui.hideModal();
      const locId = Ui.getCurrentLocId();
      if (locId && document.getElementById('page-location').classList.contains('active')) {
        Ui.reRenderPlaces(locId);
        updateMapMarkers(locId);
        setTimeout(setupDragDrop, 50);
      } else {
        handleRoute();
      }
      break;
    }
    case 'add-to-route': {
      const pid = form.dataset.placeId;
      const locId = form.dataset.locid;
      let routes = Store.getRoutes(locId);
      if (data.routeId === 'new') {
        const maxDay = routes.length ? Math.max(...routes.map(r => r.dayNumber)) : 0;
        const r = Store.addRoute({ locationId: locId, dayNumber: maxDay + 1, placeIds: [pid] });
        Ui.setCurrentDayId(r.id);
      } else {
        const route = Store.getRoute(data.routeId);
        if (route && !route.placeIds.includes(pid)) {
          Store.updateRoute(data.routeId, { placeIds: [...route.placeIds, pid] });
        }
      }
      Ui.hideModal();
      break;
    }
  }
}

function handleChange(e) {
  if (e.target.id === 'import-file') {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (Store.importJSON(ev.target.result)) {
        handleRoute();
      } else {
        alert('Ошибка: неверный формат JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  if (e.target.matches('.day-notes textarea')) {
    const rid = e.target.dataset.routeId;
    if (rid) Store.updateRoute(rid, { notes: e.target.value });
  }
}
