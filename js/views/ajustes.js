import { getAll, put, remove, getSetting, setSetting, clearAllStores, exportAll, importAll } from '../db/database.js';
import { uid, escapeHtml, CATEGORIAS_DEFECTO, downloadFile, csvRow, formatEur } from '../utils/format.js';
import { formatDate } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';
import { updateExplotacionName } from '../utils/appstate.js';
import {
  gdriveIsConfigured, gdriveIsAuthenticated, gdriveHasSavedConnection,
  gdriveGetLastSync, gdriveSignIn, gdriveSignInSilent, gdriveSignOut,
  gdriveUpload, gdriveDownload, gdriveGetFileInfo, gdriveInit
} from '../utils/gdrive.js';
import { APP_VERSION } from '../version.js';

function renderDriveSection() {
  if (!gdriveIsConfigured()) {
    return `
      <div class="settings-section-title">☁️ Google Drive</div>
      <div class="card">
        <p class="text-muted text-small">Para activar la sincronización entre dispositivos, edita el archivo <strong>js/config.js</strong> y añade tu Client ID de Google Cloud Console.</p>
      </div>`;
  }
  const connected = gdriveIsAuthenticated();
  const hasSaved = gdriveHasSavedConnection();
  const lastSync = gdriveGetLastSync();
  const lastSyncLabel = lastSync
    ? `Última sincronización: ${new Date(lastSync).toLocaleString('es-ES')}`
    : 'Nunca sincronizado';

  return `
    <div class="settings-section-title">☁️ Google Drive</div>
    <div class="card">
      ${connected ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--color-success);display:inline-block;"></span>
          <span style="font-weight:500;">Conectado</span>
        </div>
        <p class="text-muted text-small" style="margin-bottom:12px;">${lastSyncLabel}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="drive-upload">⬆ Subir a Drive</button>
          <button class="btn btn-secondary" id="drive-download">⬇ Descargar de Drive</button>
          <button class="btn btn-secondary" id="drive-disconnect">Desconectar</button>
        </div>
      ` : `
        <p class="text-muted text-small" style="margin-bottom:12px;">Sincroniza tus datos entre ordenador y móvil a través de Google Drive.</p>
        ${hasSaved ? `
          <p class="text-muted text-small" style="margin-bottom:12px;" id="drive-status-msg">Reconectando...</p>
          <button class="btn btn-primary" id="drive-connect" style="display:none;">🔗 Reconectar con Google Drive</button>
        ` : `
          <button class="btn btn-primary" id="drive-connect">🔗 Conectar con Google Drive</button>
        `}
      `}
    </div>`;
}

export async function renderAjustes(container) {
  const explotacion = await getSetting('explotacion_nombre') ?? '';
  const categorias = await getAll('categorias');

  container.innerHTML = `
    <div class="page-header"><h1 class="page-title">Ajustes</h1></div>

    <!-- Explotación -->
    <div class="settings-section">
      <div class="settings-section-title">Mi explotación</div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Nombre de la explotación</label>
          <input class="form-control" id="aj-nombre" value="${escapeHtml(explotacion)}" placeholder="Ej: Ganadería González">
        </div>
        <button class="btn btn-primary" id="aj-save-nombre">Guardar nombre</button>
      </div>
    </div>

    <!-- Categorías -->
    <div class="settings-section">
      <div class="settings-section-title">Categorías</div>
      <div class="card">
        <div class="tabs" style="margin-bottom:16px;">
          <button class="tab-btn active" data-cattab="ingreso">Ingresos</button>
          <button class="tab-btn" data-cattab="gasto">Gastos</button>
        </div>
        <div id="cat-list"></div>
        <div class="divider"></div>
        <div class="form-group" style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1">
            <label class="form-label">Nueva categoría</label>
            <input class="form-control" id="cat-nueva" placeholder="Nombre de la categoría">
          </div>
          <button class="btn btn-primary" id="cat-add">Añadir</button>
        </div>
      </div>
    </div>

    <!-- Exportar / Importar -->
    <div class="settings-section">
      <div class="settings-section-title">Copia de seguridad</div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" id="export-json">📦 Exportar backup JSON</button>
          <button class="btn btn-secondary" id="export-animales-csv">📄 Exportar animales CSV</button>
          <button class="btn btn-secondary" id="export-tx-csv">📄 Exportar transacciones CSV</button>
        </div>
        <div>
          <label class="form-label">Restaurar backup JSON</label>
          <input type="file" class="form-control" id="import-json" accept=".json" style="padding:8px;">
        </div>
      </div>
    </div>

    <!-- Google Drive -->
    <div class="settings-section" id="drive-section">
      ${renderDriveSection()}
    </div>

    <!-- Versión -->
    <div class="settings-section">
      <p class="text-muted text-small" style="text-align:center;">Versión: <code>${APP_VERSION}</code></p>
    </div>

    <!-- Zona peligrosa -->
    <div class="settings-section">
      <div class="settings-section-title">Zona peligrosa</div>
      <div class="danger-zone">
        <div class="settings-section-title">⚠ Borrar todos los datos</div>
        <p class="text-muted text-small" style="margin-bottom:12px;">Esta acción eliminará permanentemente todos los animales, eventos, transacciones y categorías.</p>
        <button class="btn btn-danger" id="btn-delete-all">🗑 Borrar todo</button>
      </div>
    </div>`;

  let catTab = 'ingreso';
  const renderCats = () => {
    const list = container.querySelector('#cat-list');
    const cats = categorias.filter(c => c.tipo === catTab);
    list.innerHTML = cats.length === 0
      ? `<div class="empty-state" style="padding:20px;"><p>Sin categorías de ${catTab}.</p></div>`
      : cats.map(c => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border);">
          <span style="flex:1">${escapeHtml(c.nombre)}${c.sistema ? ' <span class="badge" style="font-size:0.7rem">sistema</span>' : ''}</span>
          ${!c.sistema ? `<button class="btn btn-sm btn-danger" data-catdel="${c.id}">🗑</button>` : ''}
        </div>`).join('');
    list.querySelectorAll('[data-catdel]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = categorias.findIndex(c => c.id === btn.dataset.catdel);
        if (idx !== -1) {
          await remove('categorias', categorias[idx].id);
          categorias.splice(idx, 1);
          renderCats();
          showToast('Categoría eliminada');
        }
      });
    });
  };

  container.querySelectorAll('[data-cattab]').forEach(btn => {
    btn.addEventListener('click', () => {
      catTab = btn.dataset.cattab;
      container.querySelectorAll('[data-cattab]').forEach(b => b.classList.toggle('active', b.dataset.cattab === catTab));
      renderCats();
    });
  });
  renderCats();

  container.querySelector('#aj-save-nombre').addEventListener('click', async () => {
    const name = container.querySelector('#aj-nombre').value.trim();
    await setSetting('explotacion_nombre', name);
    await updateExplotacionName();
    showToast('Nombre guardado');
  });

  container.querySelector('#cat-add').addEventListener('click', async () => {
    const nombre = container.querySelector('#cat-nueva').value.trim();
    if (!nombre) { showToast('Escribe un nombre', 'error'); return; }
    const nueva = { id: uid(), nombre, tipo: catTab, sistema: false };
    await put('categorias', nueva);
    categorias.push(nueva);
    container.querySelector('#cat-nueva').value = '';
    renderCats();
    showToast('Categoría añadida');
  });

  // Exportar JSON
  container.querySelector('#export-json').addEventListener('click', async () => {
    const data = await exportAll();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `ganaderia-backup-${date}.json`, 'application/json');
    showToast('Backup exportado');
  });

  // Exportar animales CSV
  container.querySelector('#export-animales-csv').addEventListener('click', async () => {
    const animales = await getAll('animales');
    const BOM = '﻿';
    const header = csvRow(['Crotal','Nombre','Especie','Raza','Sexo','Estado','Fecha nacimiento','Peso actual','Notas']);
    const rows = animales.map(a => csvRow([
      a.crotal, a.nombre, a.especie, a.raza, a.sexo, a.status,
      a.fechaNacimiento ? formatDate(a.fechaNacimiento) : '',
      a.currentWeight ?? '', a.notas ?? ''
    ]));
    downloadFile(BOM + [header, ...rows].join('\r\n'), 'animales.csv', 'text/csv;charset=utf-8');
    showToast('CSV exportado');
  });

  // Exportar transacciones CSV
  container.querySelector('#export-tx-csv').addEventListener('click', async () => {
    const [txs, cats] = await Promise.all([getAll('transacciones'), getAll('categorias')]);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c.nombre]));
    const BOM = '﻿';
    const header = csvRow(['Fecha','Tipo','Categoría','Importe','Descripción','Referencia']);
    const rows = txs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(t => csvRow([
      formatDate(t.fecha), t.tipo, catMap[t.categoriaId] ?? '', t.importe, t.descripcion ?? '', t.referencia ?? ''
    ]));
    downloadFile(BOM + [header, ...rows].join('\r\n'), 'transacciones.csv', 'text/csv;charset=utf-8');
    showToast('CSV exportado');
  });

  // Importar JSON
  container.querySelector('#import-json').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { showToast('Archivo JSON inválido', 'error'); return; }
    const counts = `Animales: ${data.animales?.length ?? 0}, Eventos: ${data.eventos?.length ?? 0}, Transacciones: ${data.transacciones?.length ?? 0}`;
    confirmModal(`¿Importar backup? Se combinarán con los datos actuales.<br><small>${counts}</small>`, async () => {
      await importAll(data);
      showToast('Backup importado correctamente');
    }, false);
    e.target.value = '';
  });

  // Google Drive
  const refreshDriveSection = () => {
    const section = container.querySelector('#drive-section');
    if (section) section.innerHTML = renderDriveSection();
    bindDriveListeners();
  };

  const bindDriveListeners = () => {
    container.querySelector('#drive-connect')?.addEventListener('click', async () => {
      try {
        await gdriveInit();
        try { await gdriveSignInSilent(); } catch { await gdriveSignIn(); }
        // si Drive ya tiene datos, descargar; si no, subir los locales
        const fileInfo = await gdriveGetFileInfo();
        if (fileInfo) {
          const result = await gdriveDownload();
          if (result) await importAll(result.data);
          showToast('Conectado. Datos descargados de Drive');
        } else {
          const data = await exportAll();
          await gdriveUpload(data);
          showToast('Conectado y backup subido a Drive');
        }
        refreshDriveSection();
      } catch (e) {
        showToast('Error al conectar con Drive', 'error');
        console.error(e);
      }
    });

    // reconexión silenciosa automática si ya había conexión previa
    if (gdriveHasSavedConnection() && !gdriveIsAuthenticated()) {
      gdriveInit().then(() => gdriveSignInSilent()).then(async () => {
        if (!container.querySelector('#drive-status-msg')) return;
        try {
          const fileInfo = await gdriveGetFileInfo();
          if (fileInfo) {
            const lastSync = gdriveGetLastSync();
            if (!lastSync || new Date(fileInfo.modifiedTime) > new Date(lastSync)) {
              const result = await gdriveDownload();
              if (result) await importAll(result.data);
            } else {
              await gdriveUpload(await exportAll());
            }
          }
        } catch {}
        refreshDriveSection();
      }).catch(() => {
        const statusMsg = container.querySelector('#drive-status-msg');
        const connectBtn = container.querySelector('#drive-connect');
        if (statusMsg) statusMsg.textContent = 'Sesión expirada.';
        if (connectBtn) connectBtn.style.display = '';
      });
    }

    container.querySelector('#drive-upload')?.addEventListener('click', async () => {
      try {
        const data = await exportAll();
        await gdriveUpload(data);
        showToast('Backup subido a Drive');
        refreshDriveSection();
      } catch (e) {
        showToast('Error al subir a Drive', 'error');
        console.error(e);
      }
    });

    container.querySelector('#drive-download')?.addEventListener('click', async () => {
      confirmModal('¿Descargar datos desde Drive? Los datos locales se combinarán con los de Drive.', async () => {
        try {
          const result = await gdriveDownload();
          if (!result) { showToast('No hay backup en Drive', 'error'); return; }
          await importAll(result.data);
          const nAnimales = result.data.animales?.length ?? 0;
          showToast(`Drive: ${nAnimales} animales descargados`);
          refreshDriveSection();
        } catch (e) {
          showToast('Error al descargar de Drive', 'error');
          console.error(e);
        }
      });
    });

    container.querySelector('#drive-disconnect')?.addEventListener('click', () => {
      confirmModal('¿Desconectar Google Drive? Los datos locales no se borrarán.', () => {
        gdriveSignOut();
        showToast('Desconectado de Google Drive');
        refreshDriveSection();
      });
    });
  };

  bindDriveListeners();

  // Borrar todo
  container.querySelector('#btn-delete-all').addEventListener('click', () => {
    confirmModal('⚠ ¿Estás seguro? Se borrarán TODOS los datos permanentemente.', () => {
      confirmModal('Esta es la segunda confirmación. ¿Confirmas el borrado total?', async () => {
        await clearAllStores();
        showToast('Todos los datos han sido eliminados');
        renderAjustes(container);
      });
    });
  });
}
