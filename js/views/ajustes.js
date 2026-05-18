import { getAll, put, remove, getSetting, setSetting, clearAllStores, exportAll, importAll, replaceAll } from '../db/database.js';
import { uid, escapeHtml, CATEGORIAS_DEFECTO, downloadFile, csvRow, formatEur } from '../utils/format.js';
import { formatDate } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';
import { updateExplotacionName, renderTitularBar } from '../utils/appstate.js';
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
  const explotacion = await getSetting('explotacion_nombre');
  const [categorias, explotaciones, empleados, titulares] = await Promise.all([getAll('categorias'), getAll('explotaciones'), getAll('empleados'), getAll('titulares')]);
  let ssPct = parseFloat(await getSetting('ss_porcentaje')) || 30;

  container.innerHTML = `
    <div class="page-header"><h1 class="page-title">Ajustes</h1></div>

    <!-- Titulares -->
    <div class="settings-section">
      <div class="settings-section-title">Titulares</div>
      <div class="card">
        <p class="text-muted text-small" style="margin-bottom:12px;">Cada titular tiene su propio P&amp;L. Los gastos sin titular asignado se reparten proporcionalmente entre todos.</p>
        <div id="titulares-list"></div>
        <div class="divider"></div>
        <button class="btn btn-primary" id="titular-add-btn" style="margin-top:4px;">+ Añadir titular</button>
      </div>
    </div>

    <!-- Explotación -->
    <div class="settings-section">
      <div class="settings-section-title">Mi explotación</div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">Nombre de la explotación</label>
          <input class="form-control" id="aj-nombre" value="${escapeHtml(explotacion ?? '')}" placeholder="Ej: Ganadería González">
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
        <button class="btn btn-primary" id="cat-add-btn" style="margin-top:4px;">+ Nueva categoría</button>
      </div>
    </div>

    <!-- Explotaciones -->
    <div class="settings-section">
      <div class="settings-section-title">Explotaciones</div>
      <div class="card">
        <div id="explot-list"></div>
        <div class="divider"></div>
        <button class="btn btn-primary" id="explot-add-btn" style="margin-top:4px;">+ Añadir explotación</button>
      </div>
    </div>

    <!-- Empleados -->
    <div class="settings-section">
      <div class="settings-section-title">Empleados</div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--color-bg);border-radius:8px;border:1px solid var(--color-border);margin-bottom:16px;flex-wrap:wrap;">
          <span style="font-size:0.88rem;color:var(--color-text-muted);flex:1;min-width:160px;">% Seguridad Social empleador</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" class="form-control" id="aj-ss-pct" style="width:72px;text-align:center;" min="0" max="100" step="0.01" value="${ssPct}">
            <span style="font-size:0.88rem;color:var(--color-text-muted);">%</span>
            <button class="btn btn-sm btn-secondary" id="aj-save-ss">Guardar</button>
          </div>
        </div>
        <div id="empleados-list"></div>
        <div class="divider"></div>
        <button class="btn btn-primary" id="empleado-add-btn" style="margin-top:4px;">+ Añadir empleado</button>
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

  await renderTitularBar(container);

  let catTab = 'ingreso';
  const renderCats = () => {
    const list = container.querySelector('#cat-list');
    const cats = categorias.filter(c => c.tipo === catTab).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    list.innerHTML = cats.length === 0
      ? `<div class="empty-state" style="padding:20px;"><p>Sin categorías de ${catTab}.</p></div>`
      : cats.map(c => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border);">
          <span style="flex:1">${escapeHtml(c.nombre)}${c.sistema ? ' <span class="badge" style="font-size:0.7rem">sistema</span>' : ''}</span>
          ${!c.sistema ? `
            <button class="btn btn-sm btn-secondary" data-catedit="${c.id}" title="Editar">✏️</button>
            <button class="btn btn-sm btn-danger" data-catdel="${c.id}" title="Eliminar">🗑</button>` : ''}
        </div>`).join('');

    list.querySelectorAll('[data-catedit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = categorias.find(c => c.id === btn.dataset.catedit);
        if (!cat) return;
        const { overlay } = openModal({
          title: 'Editar categoría',
          bodyHtml: `
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input class="form-control" id="ce-nombre" value="${escapeHtml(cat.nombre)}">
            </div>`,
          footerHtml: `
            <button class="btn btn-secondary" id="ce-cancel">Cancelar</button>
            <button class="btn btn-primary" id="ce-save">Guardar</button>`
        });
        overlay.querySelector('#ce-cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#ce-save').addEventListener('click', async () => {
          const nombre = overlay.querySelector('#ce-nombre').value.trim();
          if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
          const idx = categorias.findIndex(c => c.id === cat.id);
          const updated = { ...cat, nombre };
          await put('categorias', updated);
          if (idx !== -1) categorias[idx] = updated;
          overlay.remove();
          renderCats();
          showToast('Categoría actualizada');
        });
      });
    });

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

  const openEditExplot = (explot) => {
    const { overlay } = openModal({
      title: `Editar: ${explot.nombre}`,
      bodyHtml: `
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-control" id="ee-nombre" value="${escapeHtml(explot.nombre)}">
        </div>
        <div class="grid-2" style="gap:10px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Hectáreas <span class="text-muted" style="font-weight:normal;">(opcional)</span></label>
            <input type="number" inputmode="decimal" class="form-control" id="ee-tamano" min="0" step="0.01" value="${explot.tamano ?? ''}" placeholder="Ej: 150">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Renta anual <span class="text-muted" style="font-weight:normal;">(€)</span></label>
            <input type="number" inputmode="decimal" class="form-control" id="ee-renta" min="0" step="0.01" value="${explot.rentaAnual ?? ''}" placeholder="0.00">
          </div>
        </div>`,
      footerHtml: `
        <button class="btn btn-secondary" id="ee-cancel">Cancelar</button>
        <button class="btn btn-primary" id="ee-save">Guardar</button>`
    });
    overlay.querySelector('#ee-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ee-save').addEventListener('click', async () => {
      const nombre = overlay.querySelector('#ee-nombre').value.trim();
      if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
      const tamanoVal = overlay.querySelector('#ee-tamano').value;
      const tamano = tamanoVal !== '' ? Number(tamanoVal) : null;
      const rentaVal = overlay.querySelector('#ee-renta').value;
      const rentaAnual = rentaVal !== '' && rentaVal !== null ? Number(rentaVal) : null;
      const idx = explotaciones.findIndex(e => e.id === explot.id);
      const updated = { ...explot, nombre, tamano, rentaAnual };
      await put('explotaciones', updated);
      if (idx !== -1) explotaciones[idx] = updated;
      overlay.remove();
      renderExplots();
      showToast('Explotación actualizada');
    });
  };

  const renderExplots = () => {
    const list = container.querySelector('#explot-list');
    if (explotaciones.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:20px;"><p>Sin explotaciones creadas. Añade una para poder asignar animales a cada una.</p></div>`;
    } else {
      const totalHa = explotaciones.reduce((s, e) => s + (parseFloat(e.tamano) || 0), 0);
      const totalRenta = explotaciones.reduce((s, e) => s + (e.rentaAnual || 0), 0);
      const filas = explotaciones.map(e => {
        const extras = [
          e.tamano != null && e.tamano !== '' ? `<span class="text-muted text-small">📐 ${parseFloat(e.tamano)} ha</span>` : '',
          e.rentaAnual != null ? `<span class="text-muted text-small">💶 ${formatEur(e.rentaAnual)}/año</span>` : '',
        ].filter(Boolean).join(' &nbsp;');
        return `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--color-border);">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">${escapeHtml(e.nombre)}</div>
            ${extras ? `<div style="margin-top:2px;">${extras}</div>` : ''}
          </div>
          <button class="btn btn-sm btn-secondary" data-explodit="${e.id}" title="Editar">✏️</button>
          <button class="btn btn-sm btn-danger" data-explodel="${e.id}" title="Eliminar">🗑</button>
        </div>`;
      }).join('');
      const haItem = totalHa > 0 ? `<div class="summary-item"><div class="summary-label">Hectáreas totales</div><div class="summary-value">${totalHa} ha</div></div>` : '';
      const rentaItem = totalRenta > 0 ? `<div class="summary-item"><div class="summary-label">Renta total/año</div><div class="summary-value income">${formatEur(totalRenta)}</div></div>` : '';
      const totales = (totalHa > 0 || totalRenta > 0) ? `<div class="summary-bar" style="margin-top:8px;margin-bottom:0;">${haItem}${rentaItem}</div>` : '';
      list.innerHTML = filas + totales;
    }
    list.querySelectorAll('[data-explodit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const explot = explotaciones.find(e => e.id === btn.dataset.explodit);
        if (explot) openEditExplot(explot);
      });
    });

    list.querySelectorAll('[data-explodel]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.explodel;
        const idx = explotaciones.findIndex(e => e.id === id);
        if (idx === -1) return;
        const explot = explotaciones[idx];

        const [animales, transacciones] = await Promise.all([getAll('animales'), getAll('transacciones')]);
        const afAnimales = animales.filter(a => a.explotacionId === id);
        const afTx = transacciones.filter(t => t.explotacionId === id);
        const otras = explotaciones.filter(e => e.id !== id);

        // Sin registros asociados: confirmación simple
        if (afAnimales.length === 0 && afTx.length === 0) {
          confirmModal(`¿Eliminar la explotación <strong>${escapeHtml(explot.nombre)}</strong>?`, async () => {
            await remove('explotaciones', id);
            explotaciones.splice(idx, 1);
            renderExplots();
            showToast('Explotación eliminada');
          });
          return;
        }

        const detalle = [
          afAnimales.length > 0 ? `${afAnimales.length} animal${afAnimales.length !== 1 ? 'es' : ''}` : '',
          afTx.length > 0 ? `${afTx.length} transacción${afTx.length !== 1 ? 'es' : ''}` : '',
        ].filter(Boolean).join(' y ');

        const { overlay } = openModal({
          title: `Eliminar: ${explot.nombre}`,
          bodyHtml: `
            <p>Esta explotación tiene <strong>${detalle}</strong> asignados. ¿Qué quieres hacer con ellos?</p>
            <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">
              <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;">
                <input type="radio" name="del-opt" value="unassign" checked style="margin-top:3px;flex-shrink:0;">
                <span>
                  <strong>Dejar sin asignar</strong><br>
                  <span class="text-muted text-small">Se conservan todos los registros pero sin explotación.</span>
                </span>
              </label>
              ${otras.length > 0 ? `
              <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;" id="opt-move-label">
                <input type="radio" name="del-opt" value="move" style="margin-top:3px;flex-shrink:0;">
                <span>
                  <strong>Mover a otra explotación</strong><br>
                  <select class="form-control" id="del-target" style="margin-top:6px;" disabled>
                    ${otras.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('')}
                  </select>
                </span>
              </label>` : ''}
              <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;">
                <input type="radio" name="del-opt" value="delete" style="margin-top:3px;flex-shrink:0;">
                <span>
                  <strong style="color:var(--color-danger);">Borrar todo lo asociado</strong><br>
                  <span class="text-muted text-small">Se eliminarán los animales, sus eventos y las transacciones de esta explotación.</span>
                </span>
              </label>
            </div>`,
          footerHtml: `
            <button class="btn btn-secondary" id="del-cancel">Cancelar</button>
            <button class="btn btn-danger" id="del-confirm">Eliminar explotación</button>`
        });

        overlay.querySelectorAll('[name="del-opt"]').forEach(radio => {
          radio.addEventListener('change', () => {
            const sel = overlay.querySelector('#del-target');
            if (sel) sel.disabled = radio.value !== 'move' || !radio.checked;
          });
        });

        overlay.querySelector('#del-cancel').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#del-confirm').addEventListener('click', async () => {
          const action = overlay.querySelector('[name="del-opt"]:checked')?.value;
          const targetId = overlay.querySelector('#del-target')?.value ?? null;
          overlay.remove();

          if (action === 'unassign') {
            await Promise.all([
              ...afAnimales.map(a => put('animales', { ...a, explotacionId: null })),
              ...afTx.map(t => put('transacciones', { ...t, explotacionId: null })),
            ]);
          } else if (action === 'move' && targetId) {
            await Promise.all([
              ...afAnimales.map(a => put('animales', { ...a, explotacionId: targetId })),
              ...afTx.map(t => put('transacciones', { ...t, explotacionId: targetId })),
            ]);
          } else if (action === 'delete') {
            const eventos = await getAll('eventos');
            const animalIds = new Set(afAnimales.map(a => a.id));
            await Promise.all([
              ...afAnimales.map(a => remove('animales', a.id)),
              ...eventos.filter(e => animalIds.has(e.animalId)).map(e => remove('eventos', e.id)),
              ...afTx.map(t => remove('transacciones', t.id)),
            ]);
          }

          await remove('explotaciones', id);
          explotaciones.splice(idx, 1);
          renderExplots();
          showToast('Explotación eliminada');
        });
      });
    });
  };
  renderExplots();

  const openEditEmpleado = (emp) => {
    const isNew = !emp;
    const { overlay } = openModal({
      title: isNew ? 'Nuevo empleado' : `Editar: ${emp.nombre}`,
      bodyHtml: `
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-control" id="em-nombre" value="${escapeHtml(emp?.nombre ?? '')}">
        </div>
        <div class="grid-2" style="gap:10px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">DNI / NIF</label>
            <input class="form-control" id="em-dni" value="${escapeHtml(emp?.dni ?? '')}" placeholder="12345678X">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Puesto / Rol</label>
            <input class="form-control" id="em-puesto" value="${escapeHtml(emp?.puesto ?? '')}" placeholder="Ej: Peón">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Sueldo bruto anual (€)</label>
          <input type="number" inputmode="decimal" class="form-control" id="em-sueldo" min="0" step="0.01" value="${emp?.sueldoBruto ?? ''}" placeholder="0.00">
        </div>`,
      footerHtml: `
        <button class="btn btn-secondary" id="em-cancel">Cancelar</button>
        <button class="btn btn-primary" id="em-save">${isNew ? 'Añadir' : 'Guardar'}</button>`
    });
    if (isNew) overlay.querySelector('#em-nombre').focus();
    overlay.querySelector('#em-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#em-save').addEventListener('click', async () => {
      const nombre = overlay.querySelector('#em-nombre').value.trim();
      if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
      const sueldoVal = overlay.querySelector('#em-sueldo').value;
      const record = {
        id: emp?.id ?? uid(),
        nombre,
        dni: overlay.querySelector('#em-dni').value.trim() || null,
        puesto: overlay.querySelector('#em-puesto').value.trim() || null,
        sueldoBruto: sueldoVal !== '' ? Number(sueldoVal) : null,
      };
      await put('empleados', record);
      const idx = empleados.findIndex(e => e.id === record.id);
      if (idx !== -1) empleados[idx] = record;
      else empleados.push(record);
      overlay.remove();
      renderEmpleados();
      showToast(isNew ? 'Empleado añadido' : 'Empleado actualizado');
    });
  };

  const renderEmpleados = () => {
    const list = container.querySelector('#empleados-list');
    const ss = parseFloat(container.querySelector('#aj-ss-pct')?.value) || ssPct;
    const sorted = [...empleados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const avatarColors = ['#2d6a4f','#40916c','#264653','#e76f51','#457b9d','#6d6875','#e9c46a','#e63946'];
    const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

    if (sorted.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-icon">👷</div><p>Sin empleados registrados.</p></div>`;
      return;
    }

    const filas = sorted.map((e, i) => {
      const bruto = e.sueldoBruto || 0;
      const ssCost = bruto * ss / 100;
      const total = bruto + ssCost;
      const color = avatarColors[i % avatarColors.length];
      const meta = [
        e.puesto ? escapeHtml(e.puesto) : '',
        e.dni ? `DNI: ${escapeHtml(e.dni)}` : '',
      ].filter(Boolean).join(' · ');
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;border:1px solid var(--color-border);margin-bottom:8px;">
        <div style="width:44px;height:44px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;flex-shrink:0;">${initials(e.nombre)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.98rem;">${escapeHtml(e.nombre)}</div>
          ${meta ? `<div style="font-size:0.82rem;color:var(--color-text-muted);margin-top:2px;">${meta}</div>` : ''}
          ${bruto > 0 ? `<div style="margin-top:6px;font-size:0.82rem;display:flex;gap:12px;flex-wrap:wrap;color:var(--color-text-muted);">
            <span>Bruto <strong style="color:var(--color-text)">${formatEur(bruto)}</strong></span>
            <span>SS (${ss}%) <strong style="color:var(--color-text)">${formatEur(ssCost)}</strong></span>
            <span>Total <strong style="color:var(--color-primary)">${formatEur(total)}</strong></span>
          </div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-sm btn-secondary" data-empedit="${e.id}" title="Editar">✏️</button>
          <button class="btn btn-sm btn-danger" data-empdel="${e.id}" title="Eliminar">🗑</button>
        </div>
      </div>`;
    }).join('');

    const totalBruto = sorted.reduce((s, e) => s + (e.sueldoBruto || 0), 0);
    const totalSS = totalBruto * ss / 100;
    const totalCoste = totalBruto + totalSS;
    const totales = totalBruto > 0 ? `<div class="summary-bar" style="margin-top:8px;margin-bottom:0;">
      <div class="summary-item"><div class="summary-label">Bruto total</div><div class="summary-value">${formatEur(totalBruto)}</div></div>
      <div class="summary-item"><div class="summary-label">SS total</div><div class="summary-value expense">${formatEur(totalSS)}</div></div>
      <div class="summary-item"><div class="summary-label">Coste total</div><div class="summary-value income">${formatEur(totalCoste)}</div></div>
    </div>` : '';

    list.innerHTML = filas + totales;

    list.querySelectorAll('[data-empedit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const emp = empleados.find(e => e.id === btn.dataset.empedit);
        if (emp) openEditEmpleado(emp);
      });
    });
    list.querySelectorAll('[data-empdel]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = empleados.findIndex(e => e.id === btn.dataset.empdel);
        if (idx !== -1) {
          await remove('empleados', empleados[idx].id);
          empleados.splice(idx, 1);
          renderEmpleados();
          showToast('Empleado eliminado');
        }
      });
    });
  };
  renderEmpleados();

  container.querySelector('#aj-save-ss').addEventListener('click', async () => {
    const pct = parseFloat(container.querySelector('#aj-ss-pct').value);
    if (isNaN(pct) || pct < 0 || pct > 100) { showToast('Porcentaje no válido', 'error'); return; }
    await setSetting('ss_porcentaje', pct);
    ssPct = pct;
    renderEmpleados();
    showToast('Porcentaje SS guardado');
  });

  container.querySelector('#empleado-add-btn').addEventListener('click', () => openEditEmpleado(null));

  container.querySelector('#explot-add-btn').addEventListener('click', () => {
    const { overlay } = openModal({
      title: 'Nueva explotación',
      bodyHtml: `
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-control" id="en-nombre" placeholder="Ej: Finca Norte">
        </div>
        <div class="grid-2" style="gap:10px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Hectáreas <span class="text-muted" style="font-weight:normal;">(opcional)</span></label>
            <input type="number" inputmode="decimal" class="form-control" id="en-tamano" min="0" step="0.01" placeholder="Ej: 150">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Renta anual <span class="text-muted" style="font-weight:normal;">(opcional, €)</span></label>
            <input type="number" inputmode="decimal" class="form-control" id="en-renta" min="0" step="0.01" placeholder="0.00">
          </div>
        </div>`,
      footerHtml: `
        <button class="btn btn-secondary" id="en-cancel">Cancelar</button>
        <button class="btn btn-primary" id="en-save">Añadir</button>`
    });
    overlay.querySelector('#en-nombre').focus();
    overlay.querySelector('#en-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#en-save').addEventListener('click', async () => {
      const nombre = overlay.querySelector('#en-nombre').value.trim();
      if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
      const tamanoVal = overlay.querySelector('#en-tamano').value;
      const tamano = tamanoVal !== '' ? Number(tamanoVal) : null;
      const rentaVal = overlay.querySelector('#en-renta').value;
      const rentaAnual = rentaVal !== '' ? Number(rentaVal) : null;
      const nueva = { id: uid(), nombre, tamano, rentaAnual };
      await put('explotaciones', nueva);
      explotaciones.push(nueva);
      overlay.remove();
      renderExplots();
      showToast('Explotación añadida');
    });
  });

  const openEditTitular = (tit) => {
    const isNew = !tit;
    const { overlay } = openModal({
      title: isNew ? 'Nuevo titular' : `Editar: ${tit.nombre}`,
      bodyHtml: `
        <div class="form-group">
          <label class="form-label">Nombre / Razón social *</label>
          <input class="form-control" id="ti-nombre" value="${escapeHtml(tit?.nombre ?? '')}" placeholder="Ej: Juan García López">
        </div>
        <div class="form-group">
          <label class="form-label">NIF / CIF</label>
          <input class="form-control" id="ti-nif" value="${escapeHtml(tit?.nif ?? '')}" placeholder="Ej: 12345678X">
        </div>`,
      footerHtml: `
        <button class="btn btn-secondary" id="ti-cancel">Cancelar</button>
        <button class="btn btn-primary" id="ti-save">${isNew ? 'Añadir' : 'Guardar'}</button>`
    });
    overlay.querySelector('#ti-nombre').focus();
    overlay.querySelector('#ti-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ti-save').addEventListener('click', async () => {
      const nombre = overlay.querySelector('#ti-nombre').value.trim();
      if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
      const nif = overlay.querySelector('#ti-nif').value.trim() || null;
      const record = { id: tit?.id ?? uid(), nombre, nif, createdAt: tit?.createdAt ?? new Date().toISOString() };
      await put('titulares', record);
      const idx = titulares.findIndex(t => t.id === record.id);
      if (idx !== -1) titulares[idx] = record; else titulares.push(record);
      overlay.remove();
      renderTitulares();
      await renderTitularBar(container);
      showToast(isNew ? 'Titular añadido' : 'Titular actualizado');
    });
  };

  const renderTitulares = () => {
    const list = container.querySelector('#titulares-list');
    if (titulares.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:20px;"><p>Sin titulares. Añade uno para poder filtrar por titular en todas las vistas.</p></div>`;
      return;
    }
    list.innerHTML = titulares.map(t => `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--color-border);">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;">${escapeHtml(t.nombre)}</div>
          ${t.nif ? `<div style="font-size:0.82rem;color:var(--color-text-muted);">NIF/CIF: ${escapeHtml(t.nif)}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-secondary" data-titedit="${t.id}" title="Editar">✏️</button>
        <button class="btn btn-sm btn-danger" data-titdel="${t.id}" title="Eliminar">🗑</button>
      </div>`).join('');

    list.querySelectorAll('[data-titedit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tit = titulares.find(t => t.id === btn.dataset.titedit);
        if (tit) openEditTitular(tit);
      });
    });
    list.querySelectorAll('[data-titdel]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.titdel;
        const tit = titulares.find(t => t.id === id);
        if (!tit) return;
        const [animales, transacciones] = await Promise.all([getAll('animales'), getAll('transacciones')]);
        const afAnimales = animales.filter(a => a.titularId === id);
        const afTx = transacciones.filter(t => t.titularId === id);
        const otras = titulares.filter(t => t.id !== id);

        if (afAnimales.length === 0 && afTx.length === 0) {
          confirmModal(`¿Eliminar el titular <strong>${escapeHtml(tit.nombre)}</strong>?`, async () => {
            await remove('titulares', id);
            titulares.splice(titulares.findIndex(t => t.id === id), 1);
            renderTitulares();
            await renderTitularBar(container);
            showToast('Titular eliminado');
          });
          return;
        }

        const detalle = [
          afAnimales.length > 0 ? `${afAnimales.length} animal${afAnimales.length !== 1 ? 'es' : ''}` : '',
          afTx.length > 0 ? `${afTx.length} transacción${afTx.length !== 1 ? 'es' : ''}` : '',
        ].filter(Boolean).join(' y ');

        const { overlay } = openModal({
          title: `Eliminar: ${tit.nombre}`,
          bodyHtml: `
            <p>Este titular tiene <strong>${detalle}</strong> asignados. ¿Qué hacer con ellos?</p>
            <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">
              <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;">
                <input type="radio" name="tdel-opt" value="unassign" checked style="margin-top:3px;flex-shrink:0;">
                <span><strong>Dejar sin titular</strong><br><span class="text-muted text-small">Los registros se conservan como "compartidos".</span></span>
              </label>
              ${otras.length > 0 ? `
              <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;">
                <input type="radio" name="tdel-opt" value="move" style="margin-top:3px;flex-shrink:0;">
                <span><strong>Mover a otro titular</strong><br>
                  <select class="form-control" id="tdel-target" style="margin-top:6px;" disabled>
                    ${otras.map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('')}
                  </select>
                </span>
              </label>` : ''}
            </div>`,
          footerHtml: `
            <button class="btn btn-secondary" id="tdel-cancel">Cancelar</button>
            <button class="btn btn-danger" id="tdel-confirm">Eliminar titular</button>`
        });
        overlay.querySelectorAll('[name="tdel-opt"]').forEach(r => {
          r.addEventListener('change', () => {
            const sel = overlay.querySelector('#tdel-target');
            if (sel) sel.disabled = r.value !== 'move' || !r.checked;
          });
        });
        overlay.querySelector('#tdel-cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#tdel-confirm').addEventListener('click', async () => {
          const action = overlay.querySelector('[name="tdel-opt"]:checked')?.value;
          const targetId = overlay.querySelector('#tdel-target')?.value ?? null;
          overlay.remove();
          if (action === 'unassign') {
            await Promise.all([
              ...afAnimales.map(a => put('animales', { ...a, titularId: null })),
              ...afTx.map(t => put('transacciones', { ...t, titularId: null })),
            ]);
          } else if (action === 'move' && targetId) {
            await Promise.all([
              ...afAnimales.map(a => put('animales', { ...a, titularId: targetId })),
              ...afTx.map(t => put('transacciones', { ...t, titularId: targetId })),
            ]);
          }
          await remove('titulares', id);
          titulares.splice(titulares.findIndex(t => t.id === id), 1);
          renderTitulares();
          await renderTitularBar(container);
          showToast('Titular eliminado');
        });
      });
    });
  };
  renderTitulares();

  container.querySelector('#titular-add-btn').addEventListener('click', () => openEditTitular(null));

  container.querySelector('#aj-save-nombre').addEventListener('click', async () => {
    const name = container.querySelector('#aj-nombre').value.trim();
    await setSetting('explotacion_nombre', name);
    await updateExplotacionName();
    showToast('Nombre guardado');
  });

  container.querySelector('#cat-add-btn').addEventListener('click', () => {
    const tipo = catTab;
    const { overlay } = openModal({
      title: `Nueva categoría de ${tipo === 'ingreso' ? 'ingreso' : 'gasto'}`,
      bodyHtml: `
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-control" id="cn-nombre" placeholder="Nombre de la categoría">
        </div>`,
      footerHtml: `
        <button class="btn btn-secondary" id="cn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="cn-save">Añadir</button>`
    });
    const input = overlay.querySelector('#cn-nombre');
    input.focus();
    overlay.querySelector('#cn-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cn-save').addEventListener('click', async () => {
      const nombre = input.value.trim();
      if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
      const nueva = { id: uid(), nombre, tipo, sistema: false };
      await put('categorias', nueva);
      categorias.push(nueva);
      overlay.remove();
      renderCats();
      showToast('Categoría añadida');
    });
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
          if (result) await replaceAll(result.data);
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
              if (result) await replaceAll(result.data);
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
      confirmModal('¿Descargar datos desde Drive? Los datos locales serán reemplazados por los de Drive.', async () => {
        try {
          const result = await gdriveDownload();
          if (!result) { showToast('No hay backup en Drive', 'error'); return; }
          await replaceAll(result.data);
          const nAnimales = result.data.animales?.length ?? 0;
          const nTx = result.data.transacciones?.length ?? 0;
          showToast(`Drive: ${nAnimales} animales, ${nTx} transacciones`);
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
