import { getAll, getSetting } from '../db/database.js';
import { escapeHtml } from './format.js';

let _activeTitularId = sessionStorage.getItem('activeTitularId') || 'all';

export function getActiveTitularId() {
  return _activeTitularId;
}

export function setActiveTitularId(id) {
  _activeTitularId = id || 'all';
  sessionStorage.setItem('activeTitularId', _activeTitularId);
}

// Helpers de filtrado por titular. activeId = id del titular activo o 'all'.
// numTitulares = total de titulares (para split proporcional de compartidas).
// titularMatch: true si la tx pertenece al titular activo o es compartida (sin titularId).
// efectiveImporte: importe a contar; las compartidas se dividen entre numTitulares
//   cuando se filtra por un titular concreto.
export function titularMatcher(activeId, numTitulares) {
  const titularMatch = (t) => {
    if (activeId === 'all') return true;
    return t.titularId === activeId || !t.titularId;
  };
  const efectiveImporte = (t) => {
    if (activeId === 'all' || t.titularId === activeId || numTitulares === 0) return t.importe;
    return t.importe / numTitulares;
  };
  return { titularMatch, efectiveImporte };
}

export async function updateExplotacionName() {
  const name = await getSetting('explotacion_nombre');
  const el = document.getElementById('sidebar-explotacion');
  if (el) el.textContent = name || 'GanaderíaApp';
  document.title = name ? `${name} — GanaderíaApp` : 'GanaderíaApp';
}

// ── Cache en memoria de catálogos pequeños (titulares, explotaciones) ──
// Estos datos cambian raramente (solo desde Ajustes) pero se leen mucho
// (cada apertura de modal de animal/tx). Cache simple invalidado a mano.
const _cache = { titulares: null, explotaciones: null };

export async function getCachedTitulares() {
  if (_cache.titulares === null) _cache.titulares = await getAll('titulares');
  return _cache.titulares;
}

export async function getCachedExplotaciones() {
  if (_cache.explotaciones === null) _cache.explotaciones = await getAll('explotaciones');
  return _cache.explotaciones;
}

export function invalidateTitularesCache() { _cache.titulares = null; }
export function invalidateExplotacionesCache() { _cache.explotaciones = null; }
export function invalidateAllCache() {
  _cache.titulares = null;
  _cache.explotaciones = null;
}

// Filtro de titular tipo dropdown (mismo estilo visual que el de explotaciones).
// Se renderiza en `container.querySelector('#' + wrapperId)` y al cambiar llama a onchange().
export async function renderTitularFilter(container, wrapperId, onchange) {
  const titulares = await getCachedTitulares();
  const wrapper = container.querySelector('#' + wrapperId);
  if (!wrapper) return;

  if (titulares.length === 0) { wrapper.innerHTML = ''; return; }

  if (_activeTitularId !== 'all' && !titulares.find(t => t.id === _activeTitularId)) {
    _activeTitularId = 'all';
    sessionStorage.setItem('activeTitularId', 'all');
  }

  const activeName = _activeTitularId === 'all'
    ? 'Todos'
    : (titulares.find(t => t.id === _activeTitularId)?.nombre ?? 'Todos');
  const isActive = _activeTitularId !== 'all';

  wrapper.innerHTML = `
    <button class="btn btn-secondary fi-dropdown-btn${isActive ? ' fi-dd-active' : ''}">
      👤 ${escapeHtml(activeName)} <span style="margin-left:4px;font-size:0.7rem;">▼</span>
    </button>`;

  const btn = wrapper.querySelector('button');
  btn.addEventListener('click', e => {
    e.stopPropagation();

    document.querySelectorAll('.fi-dropdown-panel').forEach(p => {
      if (!wrapper.contains(p)) p.remove();
    });
    document.querySelectorAll('.fi-dropdown-btn.open').forEach(b => {
      if (b !== btn) b.classList.remove('open');
    });

    const existing = wrapper.querySelector('.fi-dropdown-panel');
    if (existing) { existing.remove(); btn.classList.remove('open'); return; }

    btn.classList.add('open');

    const panel = document.createElement('div');
    panel.className = 'fi-dropdown-panel';

    const items = [{ id: 'all', nombre: 'Todos' }, ...titulares.map(t => ({ id: t.id, nombre: t.nombre }))];
    panel.innerHTML = items.map(item => `
      <label class="fi-dd-item${_activeTitularId === item.id ? ' fi-dd-checked' : ''}">
        <input type="radio" name="titular-filter-${wrapperId}" value="${item.id}" ${_activeTitularId === item.id ? 'checked' : ''}>
        <span>${escapeHtml(item.nombre)}</span>
      </label>`).join('');

    panel.querySelectorAll('input[type=radio]').forEach(radio => {
      radio.addEventListener('change', async () => {
        setActiveTitularId(radio.value);
        panel.remove();
        btn.classList.remove('open');
        await renderTitularFilter(container, wrapperId, onchange);
        if (typeof onchange === 'function') onchange();
      });
    });

    wrapper.appendChild(panel);

    const pr = panel.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8) {
      panel.style.left = 'auto';
      panel.style.right = '0';
    }
  });
}
