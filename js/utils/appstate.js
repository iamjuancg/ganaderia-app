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

export async function renderTitularBar() {
  const titulares = await getAll('titulares');
  const bar = document.getElementById('titular-bar');
  if (!bar) return;
  if (titulares.length === 0) {
    bar.style.display = 'none';
    return;
  }
  if (_activeTitularId !== 'all' && !titulares.find(t => t.id === _activeTitularId)) {
    _activeTitularId = 'all';
    sessionStorage.setItem('activeTitularId', 'all');
  }
  bar.style.display = '';
  bar.innerHTML = `
    <span class="titular-bar-icon">👤</span>
    <div class="titular-tabs">
      <button class="titular-tab${_activeTitularId === 'all' ? ' active' : ''}" data-tid="all">Todos</button>
      ${titulares.map(t => `<button class="titular-tab${_activeTitularId === t.id ? ' active' : ''}" data-tid="${t.id}"${t.nif ? ` title="${escapeHtml(t.nif)}"` : ''}>${escapeHtml(t.nombre)}</button>`).join('')}
    </div>`;
  bar.querySelectorAll('.titular-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTitularId(btn.dataset.tid);
      bar.querySelectorAll('.titular-tab').forEach(b => b.classList.toggle('active', b.dataset.tid === _activeTitularId));
      window.dispatchEvent(new CustomEvent('titular-changed'));
    });
  });
}
