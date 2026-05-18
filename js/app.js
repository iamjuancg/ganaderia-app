import { openDB, exportAll, importAll } from './db/database.js';
import { seedDefaults } from './db/seed.js';
import { updateExplotacionName } from './utils/appstate.js';
import { gdriveInit, gdriveAutoSync, gdriveHandleRedirectToken } from './utils/gdrive.js';
import { renderDashboard } from './views/dashboard.js';
import { renderAnimales } from './views/animales.js';
import { renderEventos } from './views/eventos.js';
import { renderFinanzas } from './views/finanzas.js';
import { renderInformes } from './views/informes.js';
import { renderAjustes } from './views/ajustes.js';

const VIEWS = {
  dashboard: renderDashboard,
  animales: renderAnimales,
  eventos: renderEventos,
  finanzas: renderFinanzas,
  informes: renderInformes,
  ajustes: renderAjustes,
};

async function init() {
  await openDB();
  await seedDefaults();
  await updateExplotacionName();
  setupRouter();
  setupSidebarToggle();
  navigate(location.hash.slice(1) || 'dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  gdriveInit().then(async () => {
    // En iOS PWA el token llega como redirect — extraerlo antes de cualquier otra cosa
    const fromRedirect = gdriveHandleRedirectToken();
    await gdriveAutoSync(importAll, exportAll);
    if (fromRedirect) {
      // Navegar a ajustes para que el usuario vea que está conectado
      navigate('ajustes');
    }
  });
}

function setupSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebar-toggle');
  if (!sidebar || !btn) return;

  const apply = (collapsed) => {
    sidebar.classList.toggle('collapsed', collapsed);
    btn.innerHTML = collapsed ? '&#8250;' : '&#8249;';
    const label = collapsed ? 'Expandir menú' : 'Colapsar menú';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };

  apply(localStorage.getItem('sidebar-collapsed') === '1');

  btn.addEventListener('click', () => {
    const collapsed = !sidebar.classList.contains('collapsed');
    apply(collapsed);
    localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
  });
}

function setupRouter() {
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));

  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const view = a.dataset.view;
      location.hash = view;
    });
  });
}

function navigate(view) {
  if (!VIEWS[view]) view = 'dashboard';

  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });

  const container = document.getElementById('view-container');
  container.innerHTML = '';
  VIEWS[view](container);
}

// Exportar navigate para uso en vistas
export { navigate };

init();
