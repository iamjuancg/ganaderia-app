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

export async function updateExplotacionName() {
  const name = await getSetting('explotacion_nombre');
  const el = document.getElementById('sidebar-explotacion');
  if (el) el.textContent = name || 'GanaderíaApp';
  document.title = name ? `${name} — GanaderíaApp` : 'GanaderíaApp';
}

export async function renderTitularBar(viewContainer) {
  const titulares = await getAll('titulares');
  const pageHeader = viewContainer?.querySelector?.('.page-header');
  if (!pageHeader) return;

  pageHeader.querySelector('.titular-slot')?.remove();
  if (titulares.length === 0) return;

  if (_activeTitularId !== 'all' && !titulares.find(t => t.id === _activeTitularId)) {
    _activeTitularId = 'all';
    sessionStorage.setItem('activeTitularId', 'all');
  }

  const slot = document.createElement('div');
  slot.className = 'titular-slot';
  slot.innerHTML = `
    <span class="titular-bar-icon">👤</span>
    <div class="titular-tabs">
      <button class="titular-tab${_activeTitularId === 'all' ? ' active' : ''}" data-tid="all">Todos</button>
      ${titulares.map(t => `<button class="titular-tab${_activeTitularId === t.id ? ' active' : ''}" data-tid="${t.id}"${t.nif ? ` title="${escapeHtml(t.nif)}"` : ''}>${escapeHtml(t.nombre)}</button>`).join('')}
    </div>`;
  pageHeader.appendChild(slot);

  slot.querySelectorAll('.titular-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTitularId(btn.dataset.tid);
      slot.querySelectorAll('.titular-tab').forEach(b => b.classList.toggle('active', b.dataset.tid === _activeTitularId));
      window.dispatchEvent(new CustomEvent('titular-changed'));
    });
  });
}
