import * as Store from './store.js';
import { APP_CONFIG } from '../config.js';
import { CATEGORIES, escHtml, plural, coordsToString, buildRouteUrl } from './utils.js';

let currentLocId = null;
let currentDayId = null;

export function getCurrentLocId() { return currentLocId; }
export function getCurrentDayId() { return currentDayId; }
export function setCurrentDayId(id) { currentDayId = id; }

export function renderHome() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-home').classList.add('active');
  const locs = Store.getLocations();
  const el = document.getElementById('page-home');

  if (!locs.length) {
    el.innerHTML = `
      <div class="page-header"><h2>Мои локации</h2></div>
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:8px;">🧳</div>
        <h3>Пока нет ни одной локации</h3>
        <p>Добавьте локацию, чтобы начать планирование</p>
        <button class="btn btn-primary" style="margin-top:16px" data-action="add-location">+ Новая локация</button>
      </div>`;
    return;
  }

  let html = `<div class="page-header"><h2>Мои локации</h2><button class="btn btn-primary" data-action="add-location">+ Новая локация</button></div><div class="locations-grid">`;
  for (const loc of locs) {
    const places = Store.getPlaces(loc.id);
    const eat = places.filter(p => p.category === 'eat').length;
    const walk = places.filter(p => p.category === 'walk').length;
    const see = places.filter(p => p.category === 'see').length;
    const days = Store.getRoutes(loc.id).length;
    html += `<div class="card location-card">
      <div class="card-actions">
        <button class="btn btn-icon btn-sm" data-action="edit-location" data-id="${loc.id}" title="Редактировать">✎</button>
        <button class="btn btn-icon btn-sm btn-danger" data-action="delete-location" data-id="${loc.id}" title="Удалить">✕</button>
      </div>
      <h3>${escHtml(loc.name)}</h3>
      ${loc.hotelName ? `<div class="hotel">${escHtml(loc.hotelName)}</div>` : ''}
      ${loc.description ? `<div class="desc">${escHtml(loc.description)}</div>` : ''}
      <div class="meta">
        <span>🍽 ${eat}</span><span>🚶 ${walk}</span><span>👁 ${see}</span>
        ${days ? `<span>📅 ${days} ${plural(days, 'день', 'дня', 'дней')}</span>` : ''}
      </div>
      <div class="actions">
        <button class="btn btn-primary btn-sm" data-action="view-location" data-id="${loc.id}">Подробнее</button>
        <button class="btn btn-sm" data-action="view-route" data-id="${loc.id}">Маршруты</button>
      </div>
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

export async function renderLocation(locId) {
  currentLocId = locId;
  const loc = Store.getLocation(locId);
  if (!loc) { renderHome(); return; }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-location');
  el.classList.add('active');

  const places = Store.getPlaces(locId);
  const eatPlaces = places.filter(p => p.category === 'eat');
  const walkPlaces = places.filter(p => p.category === 'walk');
  const seePlaces = places.filter(p => p.category === 'see');
  const hasAPI = !!APP_CONFIG.ymapsApiKey;

  el.innerHTML = `
    <div class="page-header">
      <button class="btn" data-action="navigate" data-href="">← Назад</button>
      <h2>${escHtml(loc.name)}</h2>
      <button class="btn" data-action="view-route" data-id="${locId}">Маршруты</button>
      <button class="btn btn-sm" data-action="edit-location" data-id="${locId}">✎</button>
    </div>

    <div class="hotel-info">
      <div class="hi-name">${loc.hotelName ? '🏨 ' + escHtml(loc.hotelName) : '📍 Проживание'}</div>
      <div class="hi-coords">Координаты: <span data-action="copy-coords" data-coords="${loc.coords.lat},${loc.coords.lng}">${coordsToString(loc.coords)}</span></div>
    </div>

    ${!hasAPI ? `<div class="no-api-warning">⚠ Яндекс.Карты не подключены. Укажите API-ключ в config.js для отображения карты и поиска мест.</div>` : ''}

    <div class="search-section">
      <input type="text" id="place-search" placeholder="🔍 Поиск места (например, Эйфелева башня)..." ${!hasAPI ? 'disabled' : ''}>
      <div id="search-results" class="search-results" style="display:none"></div>
    </div>

    <div id="map-container"></div>

    <div class="places-section" style="margin-top:16px">
      <div class="category-tabs">
        ${Object.entries(CATEGORIES).map(([k, v]) =>
          `<button class="category-tab active" data-cat="${k}" data-action="switch-cat">${v.icon} ${v.label}</button>`
        ).join('')}
        <button class="btn btn-sm" data-action="add-place" style="margin-left:auto">+ Место</button>
      </div>
      ${['eat','walk','see'].map(cat => `
        <div class="category-panel active" data-cat-panel="${cat}">
          <div class="places-list" data-category="${cat}" data-locid="${locId}">
            ${(cat === 'eat' ? eatPlaces : cat === 'walk' ? walkPlaces : seePlaces).map(p => placeCard(p)).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;
}

export function reRenderPlaces(locId) {
  const loc = Store.getLocation(locId);
  if (!loc) return;
  const places = Store.getPlaces(locId);
  ['eat','walk','see'].forEach(cat => {
    const list = document.querySelector(`.places-list[data-category="${cat}"][data-locid="${locId}"]`);
    if (list) {
      list.innerHTML = places.filter(p => p.category === cat).map(p => placeCard(p)).join('');
    }
  });
}

function placeCard(p) {
  const cat = CATEGORIES[p.category];
  return `<div class="place-card" draggable="true" data-drag-id="${p.id}">
    <div class="cat-icon">${cat.icon}</div>
    <div class="info">
      <div class="name">${escHtml(p.name)}</div>
      ${p.description ? `<div class="desc">${escHtml(p.description)}</div>` : ''}
      <div class="coords">${coordsToString(p.coords)}</div>
    </div>
    <div class="actions-pl">
      <button class="btn btn-sm btn-primary" data-action="add-to-route" data-id="${p.id}" title="Добавить в маршрут">+</button>
      <button class="btn btn-sm btn-icon" data-action="edit-place" data-id="${p.id}" title="Редактировать">✎</button>
      <button class="btn btn-sm btn-icon btn-danger" data-action="delete-place" data-id="${p.id}" title="Удалить">✕</button>
    </div>
  </div>`;
}

export async function renderRoute(locId) {
  currentLocId = locId;
  const loc = Store.getLocation(locId);
  if (!loc) { renderHome(); return; }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-route');
  el.classList.add('active');

  const routes = Store.getRoutes(locId);
  const allPlaces = Store.getPlaces(locId);

  if (!routes.length) {
    const r = Store.addRoute({ locationId: locId, dayNumber: 1, placeIds: [] });
    routes.push(r);
  }

  if (!currentDayId || !routes.find(r => r.id === currentDayId)) {
    currentDayId = routes[0].id;
  }

  const currentRoute = routes.find(r => r.id === currentDayId) || routes[0];
  if (currentRoute) currentDayId = currentRoute.id;

  el.innerHTML = `
    <div class="page-header">
      <button class="btn" data-action="navigate" data-href="">← Назад</button>
      <h2>${escHtml(loc.name)} — Маршруты</h2>
      <button class="btn" data-action="navigate" data-href="/location/${locId}">Места</button>
    </div>

    <div class="route-header">
      <div class="day-tabs">
        ${routes.map((r, i) =>
          `<button class="day-tab ${r.id === currentDayId ? 'active' : ''}" data-action="switch-day" data-id="${r.id}">День ${r.dayNumber}</button>`
        ).join('')}
        <button class="btn btn-sm" data-action="add-day" title="Добавить день">+ День</button>
      </div>
    </div>

    ${routes.map(r => `
      <div class="day-panel ${r.id === currentDayId ? 'active' : ''}" data-day="${r.id}">
        <div class="day-content">
          <div class="day-left">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <strong>День ${r.dayNumber}</strong>
              <button class="btn btn-sm btn-danger" data-action="delete-day" data-id="${r.id}" ${routes.length <= 1 ? 'disabled' : ''}>✕ День</button>
            </div>
            <div class="route-places-list" data-route-id="${r.id}">
              ${r.placeIds.map((pid, idx) => {
                const p = allPlaces.find(x => x.id === pid);
                if (!p) return '';
                const cat = CATEGORIES[p.category];
                return `<div class="route-place-card" draggable="true" data-drag-id="${p.id}" data-route-id="${r.id}">
                  <div class="rp-num">${idx + 1}</div>
                  <div class="rp-info">
                    <div class="rp-name">${cat.icon} ${escHtml(p.name)}</div>
                    <div class="rp-cat">${cat.label}</div>
                  </div>
                  <button class="btn btn-sm btn-icon btn-danger" data-action="remove-from-route" data-place-id="${p.id}" data-route-id="${r.id}" title="Убрать">✕</button>
                </div>`;
              }).join('')}
              ${r.placeIds.length === 0 ? '<div style="color:var(--text2);font-size:13px;padding:12px">Нет мест в маршруте. Добавьте из списка справа.</div>' : ''}
            </div>
            <div class="day-notes">
              <textarea placeholder="Заметки на день..." data-route-id="${r.id}" data-action="notes-input">${escHtml(r.notes || '')}</textarea>
            </div>
            ${r.placeIds.length >= 2 ? `<button class="btn btn-primary" style="margin-top:8px" data-action="build-route" data-id="${r.id}" data-locid="${locId}">🧭 Построить маршрут в Яндекс.Картах</button>` : ''}
          </div>
          <div class="day-right">
            <strong style="display:block;margin-bottom:8px;font-size:14px">Доступные места</strong>
            <div class="available-places" data-route-id="${r.id}">
              ${allPlaces.map(p => {
                const cat = CATEGORIES[p.category];
                const inDay = r.placeIds.includes(p.id);
                return `<div class="available-place ${inDay ? '' : ''}" data-action="toggle-route-place" data-place-id="${p.id}" data-route-id="${r.id}" style="${inDay ? 'opacity:0.4' : ''}">
                  <span class="ap-icon">${cat.icon}</span>
                  <span class="ap-name">${escHtml(p.name)}</span>
                  <span style="margin-left:auto;font-size:11px;color:var(--text2)">${inDay ? '✓' : '+'}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `).join('')}`;
}

export function renderSettings() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-settings').classList.add('active');

  const el = document.getElementById('page-settings');
  el.innerHTML = `
    <div class="page-header">
      <h2>Настройки</h2>
      <button class="btn" data-action="navigate" data-href="">← На главную</button>
    </div>
    <div class="settings-section">
      <h3>📦 Импорт / Экспорт данных</h3>
      <p>Экспортируйте данные для резервного копирования или переноса на другое устройство. Импортируйте ранее сохранённые данные.</p>
      <div class="settings-actions">
        <button class="btn btn-primary" data-action="export-data">💾 Скачать данные (JSON)</button>
        <button class="btn" data-action="import-data">📂 Загрузить данные (JSON)</button>
        <input type="file" id="import-file" accept=".json" style="display:none" data-action="import-file">
        <button class="btn btn-danger" data-action="reset-data">🔄 Сбросить к примеру</button>
      </div>
    </div>`;
}

export function showModal(title, bodyHtml) {
  const overlay = document.getElementById('modal-overlay');
  overlay.querySelector('.modal-box h3').textContent = title;
  overlay.querySelector('.modal-body').innerHTML = bodyHtml;
  overlay.classList.add('open');
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

export function showAddLocationModal() {
  showModal('Новая локация', `
    <form data-form="add-location">
      <div class="form-group"><label>Название локации *</label><input name="name" required placeholder="Например: Париж"></div>
      <div class="form-group"><label>Название отеля / проживания</label><input name="hotelName" placeholder="Например: Отель Le Grand"></div>
      <div class="form-row">
        <div class="form-group"><label>Широта *</label><input name="lat" type="number" step="any" required placeholder="48.8566"></div>
        <div class="form-group"><label>Долгота *</label><input name="lng" type="number" step="any" required placeholder="2.3522"></div>
      </div>
      <div class="form-group"><label>Описание</label><textarea name="description" placeholder="Краткое описание поездки"></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close-modal">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>`);
}

export function showEditLocationModal(id) {
  const loc = Store.getLocation(id);
  if (!loc) return;
  showModal('Редактировать локацию', `
    <form data-form="edit-location" data-id="${id}">
      <div class="form-group"><label>Название локации *</label><input name="name" required value="${escHtml(loc.name)}"></div>
      <div class="form-group"><label>Название отеля / проживания</label><input name="hotelName" value="${escHtml(loc.hotelName || '')}"></div>
      <div class="form-row">
        <div class="form-group"><label>Широта *</label><input name="lat" type="number" step="any" required value="${loc.coords.lat}"></div>
        <div class="form-group"><label>Долгота *</label><input name="lng" type="number" step="any" required value="${loc.coords.lng}"></div>
      </div>
      <div class="form-group"><label>Описание</label><textarea name="description">${escHtml(loc.description || '')}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close-modal">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>`);
}

export function showAddPlaceModal(locId, category, prefilled) {
  const catOpts = Object.entries(CATEGORIES).map(([k, v]) =>
    `<option value="${k}" ${k === category ? 'selected' : ''}>${v.icon} ${v.label}</option>`
  ).join('');
  showModal('Новое место', `
    <form data-form="add-place" data-locid="${locId}">
      <div class="form-group"><label>Название *</label><input name="name" required value="${escHtml(prefilled?.name || '')}"></div>
      <div class="form-group"><label>Категория *</label><select name="category">${catOpts}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Широта *</label><input name="lat" type="number" step="any" required value="${prefilled?.coords?.lat || ''}"></div>
        <div class="form-group"><label>Долгота *</label><input name="lng" type="number" step="any" required value="${prefilled?.coords?.lng || ''}"></div>
      </div>
      <div class="form-group"><label>Описание</label><textarea name="description">${escHtml(prefilled?.description || '')}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close-modal">Отмена</button>
        <button type="submit" class="btn btn-primary">Добавить</button>
      </div>
    </form>`);
}

export function showEditPlaceModal(id) {
  const p = Store.getPlace(id);
  if (!p) return;
  const catOpts = Object.entries(CATEGORIES).map(([k, v]) =>
    `<option value="${k}" ${k === p.category ? 'selected' : ''}>${v.icon} ${v.label}</option>`
  ).join('');
  showModal('Редактировать место', `
    <form data-form="edit-place" data-id="${id}">
      <div class="form-group"><label>Название *</label><input name="name" required value="${escHtml(p.name)}"></div>
      <div class="form-group"><label>Категория *</label><select name="category">${catOpts}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Широта *</label><input name="lat" type="number" step="any" required value="${p.coords.lat}"></div>
        <div class="form-group"><label>Долгота *</label><input name="lng" type="number" step="any" required value="${p.coords.lng}"></div>
      </div>
      <div class="form-group"><label>Описание</label><textarea name="description">${escHtml(p.description || '')}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close-modal">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>`);
}

export function showAddToRouteModal(placeId, locId) {
  const routes = Store.getRoutes(locId);
  const p = Store.getPlace(placeId);
  if (!p) return;
  const dayOpts = routes.map(r =>
    `<option value="${r.id}">День ${r.dayNumber}${r.placeIds.includes(placeId) ? ' (уже в маршруте)' : ''}</option>`
  ).join('');
  showModal('Добавить в маршрут', `
    <form data-form="add-to-route" data-place-id="${placeId}" data-locid="${locId}">
      <p><strong>${escHtml(p.name)}</strong></p>
      <div class="form-group" style="margin-top:12px">
        <label>Выберите день</label>
        <select name="routeId">
          ${dayOpts}
          <option value="new">+ Создать новый день</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-action="close-modal">Отмена</button>
        <button type="submit" class="btn btn-primary">Добавить</button>
      </div>
    </form>`);
}
