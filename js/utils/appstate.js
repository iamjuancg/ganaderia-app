import { getSetting } from '../db/database.js';

export async function updateExplotacionName() {
  const name = await getSetting('explotacion_nombre');
  const el = document.getElementById('sidebar-explotacion');
  if (el) el.textContent = name || 'GanaderíaApp';
  document.title = name ? `${name} — GanaderíaApp` : 'GanaderíaApp';
}
