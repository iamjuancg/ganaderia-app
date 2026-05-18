import { getAll, put, remove } from '../db/database.js';
import { uid, TIPOS_EVENTO, eventoIcon, eventoLabel, escapeHtml, formatEur } from '../utils/format.js';
import { formatDate, todayISO } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';
import { buildDropdown, initDropdownCloser } from '../utils/dropdown.js';

let filterTipos = new Set(), filterFechaDesde = '', filterFechaHasta = '';
let filterExplotaciones = new Set();
let _explotaciones = [];

export async function renderEventos(container) {
  _explotaciones = await getAll('explotaciones');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Eventos del rebaño</h1>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;" id="ev-filter-bar">
      <div id="ev-dropdown-tipo" class="fi-dropdown"></div>
      <input type="date" class="form-control" id="ev-filter-desde" value="${filterFechaDesde}" title="Desde" style="width:140px;">
      <input type="date" class="form-control" id="ev-filter-hasta" value="${filterFechaHasta}" title="Hasta" style="width:140px;">
      ${_explotaciones.length > 0 ? `<div id="ev-dropdown-explot" class="fi-dropdown"></div>` : ''}
      <button class="btn btn-sm btn-secondary" id="ev-clear-filters" style="display:none;">✕ Limpiar</button>
    </div>
    <div id="eventos-list"></div>`;

  const refresh = () => loadEventos(container);

  container.querySelector('#ev-filter-desde').addEventListener('change', e => { filterFechaDesde = e.target.value; refresh(); });
  container.querySelector('#ev-filter-hasta').addEventListener('change', e => { filterFechaHasta = e.target.value; refresh(); });
  container.querySelector('#ev-clear-filters').addEventListener('click', () => {
    filterTipos = new Set();
    filterExplotaciones = new Set();
    filterFechaDesde = '';
    filterFechaHasta = '';
    container.querySelector('#ev-filter-desde').value = '';
    container.querySelector('#ev-filter-hasta').value = '';
    refresh();
  });

  initDropdownCloser();
  await loadEventos(container);
}

async function loadEventos(container) {
  const tipoItems = TIPOS_EVENTO.map(t => ({ id: t.value, nombre: `${t.icon} ${t.label}` }));
  buildDropdown(container, 'ev-dropdown-tipo', 'Tipo', tipoItems, filterTipos, () => loadEventos(container));
  if (_explotaciones.length > 0) {
    buildDropdown(container, 'ev-dropdown-explot', 'Explotación', _explotaciones, filterExplotaciones, () => loadEventos(container));
  }

  const activeCount = filterTipos.size + filterExplotaciones.size + (filterFechaDesde ? 1 : 0) + (filterFechaHasta ? 1 : 0);
  const clearBtn = container.querySelector('#ev-clear-filters');
  if (clearBtn) clearBtn.style.display = activeCount > 0 ? '' : 'none';

  const [eventos, animales] = await Promise.all([getAll('eventos'), getAll('animales')]);
  const animalMap = Object.fromEntries(animales.map(a => [a.id, a]));
  const explotMap = Object.fromEntries(_explotaciones.map(e => [e.id, e.nombre]));

  let filtered = [...eventos];
  if (filterTipos.size > 0) filtered = filtered.filter(e => filterTipos.has(e.tipo));
  if (filterFechaDesde) filtered = filtered.filter(e => e.fecha >= filterFechaDesde);
  if (filterFechaHasta) filtered = filtered.filter(e => e.fecha <= filterFechaHasta + 'T23:59:59');
  if (filterExplotaciones.size > 0) filtered = filtered.filter(e => filterExplotaciones.has(animalMap[e.animalId]?.explotacionId));
  filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const list = container.querySelector('#eventos-list');
  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>No hay eventos</h3>
      <p>Los eventos aparecerán aquí al registrarlos desde la ficha de un animal.</p>
    </div>`;
    return;
  }

  const showExplot = _explotaciones.length > 0;
  list.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Animal</th>${showExplot ? '<th>Explotación</th>' : ''}<th>Descripción</th><th>Datos</th><th>Acciones</th>
    </tr></thead>
    <tbody>${filtered.map(ev => {
      const a = animalMap[ev.animalId];
      const explotNombre = showExplot && a?.explotacionId ? explotMap[a.explotacionId] : null;
      return `<tr>
        <td>${formatDate(ev.fecha)}</td>
        <td>${eventoIcon(ev.tipo)} ${eventoLabel(ev.tipo)}</td>
        <td>${a ? `<strong>${escapeHtml(a.crotal)}</strong>${a.nombre ? ' ' + escapeHtml(a.nombre) : ''}` : '—'}</td>
        ${showExplot ? `<td>${explotNombre ? escapeHtml(explotNombre) : '<span class="text-muted">—</span>'}</td>` : ''}
        <td>${escapeHtml(ev.descripcion) || '—'}</td>
        <td>${ev.peso ? ev.peso + ' kg' : ''}${ev.importe ? formatEur(ev.importe) : ''}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${ev.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${ev.id}">🗑</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table></div>`;

  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [allEvs, allAnimales] = await Promise.all([getAll('eventos'), getAll('animales')]);
      const ev = allEvs.find(e => e.id === btn.dataset.id);
      if (!ev) return;
      const animal = allAnimales.find(a => a.id === ev.animalId);
      const { overlay } = openModal({ title: 'Editar evento', bodyHtml: '<div id="evf-slot"></div>' });
      renderEventoForm(overlay.querySelector('#evf-slot'), animal, () => { overlay.remove(); loadEventos(container); }, ev);
    });
  });

  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const allEvs = await getAll('eventos');
      const ev = allEvs.find(e => e.id === btn.dataset.id);
      if (!ev) return;
      const msg = ev.transaccionId
        ? '¿Eliminar este evento? También se eliminará la transacción de finanzas vinculada.'
        : '¿Eliminar este evento?';
      confirmModal(msg, async () => {
        await remove('eventos', ev.id);
        if (ev.transaccionId) await remove('transacciones', ev.transaccionId);
        if ((ev.tipo === 'venta' || ev.tipo === 'muerte') && ev.animalId) {
          const allAnimales = await getAll('animales');
          const anim = allAnimales.find(a => a.id === ev.animalId);
          const expectedStatus = ev.tipo === 'venta' ? 'vendido' : 'muerto';
          if (anim && anim.status === expectedStatus) {
            await put('animales', { ...anim, status: 'activo', updatedAt: new Date().toISOString() });
          }
        }
        showToast('Evento eliminado');
        loadEventos(container);
      });
    });
  });
}

export async function renderEventoForm(slot, animal, onSave, ev = null) {
  const allAnimales = await getAll('animales');

  slot.innerHTML = `
    <div class="form-group">
      <label class="form-label">Animal</label>
      <select class="form-control" id="evf-animal">
        ${allAnimales.map(a => `<option value="${a.id}" ${(ev?.animalId ?? animal?.id) === a.id ? 'selected' : ''}>${escapeHtml(a.crotal)}${a.nombre ? ' — ' + a.nombre : ''}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Tipo de evento *</label>
        <select class="form-control" id="evf-tipo">
          ${TIPOS_EVENTO.map(t => `<option value="${t.value}" ${(ev?.tipo ?? '') === t.value ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha *</label>
        <input type="date" class="form-control" id="evf-fecha" value="${ev ? ev.fecha.split('T')[0] : todayISO()}">
      </div>
    </div>
    <div id="evf-extra"></div>
    <div class="form-group">
      <label class="form-label">Descripción / notas</label>
      <textarea class="form-control" id="evf-desc" rows="2">${escapeHtml(ev?.descripcion ?? '')}</textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
      <button class="btn btn-primary" id="evf-save">${ev ? 'Guardar cambios' : 'Guardar evento'}</button>
    </div>`;

  const updateExtra = () => {
    const tipo = slot.querySelector('#evf-tipo').value;
    const extra = slot.querySelector('#evf-extra');
    const sameType = ev?.tipo === tipo;
    if (tipo === 'peso') {
      extra.innerHTML = `<div class="form-group"><label class="form-label">Peso (kg)</label><input type="number" inputmode="decimal" class="form-control" id="evf-peso" min="0" step="0.1" value="${sameType && ev?.peso != null ? ev.peso : ''}"></div>`;
    } else if (['venta', 'compra'].includes(tipo)) {
      extra.innerHTML = `<div class="grid-2">
        <div class="form-group"><label class="form-label">Importe (€)</label><input type="number" inputmode="decimal" class="form-control" id="evf-importe" min="0" step="0.01" value="${sameType && ev?.importe != null ? ev.importe : ''}"></div>
        <div class="form-group"><label class="form-label">${tipo === 'venta' ? 'Comprador' : 'Vendedor'}</label><input class="form-control" id="evf-contraparte" value="${sameType ? escapeHtml(ev?.contraparte ?? '') : ''}"></div>
      </div>`;
    } else {
      extra.innerHTML = '';
    }
  };
  slot.querySelector('#evf-tipo').addEventListener('change', updateExtra);
  updateExtra();

  slot.querySelector('#evf-save').addEventListener('click', async () => {
    const animalId = slot.querySelector('#evf-animal').value;
    const tipo = slot.querySelector('#evf-tipo').value;
    const fecha = slot.querySelector('#evf-fecha').value;
    if (!fecha) { showToast('La fecha es obligatoria', 'error'); return; }

    const importe = slot.querySelector('#evf-importe')?.value ? Number(slot.querySelector('#evf-importe').value) : null;

    const allAnimales2 = await getAll('animales');
    const anim = allAnimales2.find(a => a.id === animalId);

    let transaccionId = ev?.transaccionId ?? null;

    if ((tipo === 'venta' || tipo === 'compra') && importe) {
      if (!transaccionId) transaccionId = uid();
      await put('transacciones', {
        id: transaccionId,
        tipo: tipo === 'venta' ? 'ingreso' : 'gasto',
        importe,
        fecha: new Date(fecha).toISOString(),
        categoriaId: tipo === 'venta' ? 'sys-venta-animales' : 'sys-compra-animales',
        descripcion: `${tipo === 'venta' ? 'Venta' : 'Compra'}: ${anim?.crotal ?? ''}${anim?.nombre ? ' — ' + anim.nombre : ''}`,
        referencia: null,
        explotacionId: anim?.explotacionId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (transaccionId) {
      await remove('transacciones', transaccionId);
      transaccionId = null;
    }

    const record = {
      id: ev?.id ?? uid(),
      animalId,
      tipo,
      fecha: new Date(fecha).toISOString(),
      descripcion: slot.querySelector('#evf-desc').value.trim() || null,
      peso: slot.querySelector('#evf-peso')?.value ? Number(slot.querySelector('#evf-peso').value) : null,
      importe,
      contraparte: slot.querySelector('#evf-contraparte')?.value.trim() || null,
      transaccionId,
      createdAt: ev?.createdAt ?? new Date().toISOString(),
    };

    await put('eventos', record);

    if (anim) {
      if (tipo === 'peso' && record.peso) {
        await put('animales', { ...anim, currentWeight: record.peso, weightDate: record.fecha, updatedAt: new Date().toISOString() });
      } else if (!ev) {
        if (tipo === 'venta') await put('animales', { ...anim, status: 'vendido', updatedAt: new Date().toISOString() });
        else if (tipo === 'muerte') await put('animales', { ...anim, status: 'muerto', updatedAt: new Date().toISOString() });
      }
    }

    showToast(ev ? 'Evento actualizado' : 'Evento registrado');
    onSave();
  });
}

export async function renderEventosAnimal(animalId) {
  const eventos = await getAll('eventos');
  return eventos.filter(e => e.animalId === animalId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
