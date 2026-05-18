import { getSetting } from '../db/database.js';

export async function updateExplotacionName() {
  const name = await getSetting('explotacion_nombre');
  const el = document.getElementById('sidebar-explotacion');
  if (el) el.textContent = name || 'GanaderíaApp';
  document.title = name ? `${name} — GanaderíaApp` : 'GanaderíaApp';
}

export async function updateTitularBar() {
  const nombre = await getSetting('titular_nombre');
  const nif = await getSetting('titular_nif');
  const bar = document.getElementById('titular-bar');
  if (!bar) return;
  if (nombre) {
    bar.innerHTML = '';
    const icon = document.createElement('span');
    icon.textContent = '👤';
    icon.className = 'titular-bar-icon';
    bar.appendChild(icon);
    const nameEl = document.createElement('span');
    nameEl.className = 'titular-bar-nombre';
    nameEl.textContent = nombre;
    bar.appendChild(nameEl);
    if (nif) {
      const sep = document.createElement('span');
      sep.className = 'titular-bar-sep';
      sep.textContent = '·';
      bar.appendChild(sep);
      const nifEl = document.createElement('span');
      nifEl.className = 'titular-bar-nif';
      nifEl.textContent = nif;
      bar.appendChild(nifEl);
    }
    bar.style.display = '';
  } else {
    bar.style.display = 'none';
  }
}
