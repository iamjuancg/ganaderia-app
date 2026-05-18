import { getAll, put, remove } from '../db/database.js';
import { uid, TIPOS_EVENTO, eventoIcon, eventoLabel, escapeHtml, formatEur } from '../utils/format.js';
import { formatDate, todayISO } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';
import { buildDropdown, initDropdownCloser } from '../utils/dropdown.js';
import { getActiveTitularId } from '../utils/appstate.js';

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
  const activeTitularId = getActiveTitularId();
  if (activeTitularId !== 'all') filtered = filtered.filter(e => animalMap[e.animalId]?.titularId === activeTitularId);
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

  // Separate individual events from batch groups
  const batchMap = new Map();
  const individualEvs = [];
  for (const ev of filtered) {
    if (ev.batchId) {
      if (!batchMap.has(ev.batchId)) batchMap.set(ev.batchId, []);
      batchMap.get(ev.batchId).push(ev);
    } else {
      individualEvs.push(ev);
    }
  }

  const displayItems = [
    ...individualEvs.map(ev => ({ type: 'single', ev, sortDate: ev.fecha })),
    ...[...batchMap.entries()].map(([batchId, evs]) => ({ type: 'batch', batchId, evs, sortDate: evs[0].fecha })),
  ].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

  const showExplot = _explotaciones.length > 0;

  const renderSingleRow = (ev) => {
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
  };

  const renderBatchGroup = (batchId, evs) => {
    const firstEv = evs[0];
    const totalImporte = evs.reduce((s, e) => s + (e.importe || 0), 0);
    const preview = evs.slice(0, 3).map(ev => {
      const a = animalMap[ev.animalId];
      return a ? escapeHtml(a.crotal) : '—';
    }).join(', ') + (evs.length > 3 ? ` +${evs.length - 3} más` : '');

    const headerRow = `<tr style="background:var(--color-bg);">
      <td>${formatDate(firstEv.fecha)}</td>
      <td>${eventoIcon(firstEv.tipo)} ${eventoLabel(firstEv.tipo)}</td>
      <td${showExplot ? ' colspan="2"' : ''}>
        <span style="font-weight:600;">📦 Lote: ${evs.length} animales</span>
        <div style="font-size:0.78rem;color:var(--color-text-muted);margin-top:2px;">${preview}</div>
      </td>
      <td>${escapeHtml(firstEv.descripcion) || '—'}</td>
      <td>${totalImporte > 0 ? formatEur(totalImporte) : '—'}</td>
      <td class="td-actions">
        <button class="btn btn-sm" data-action="toggle-batch" data-batch-id="${batchId}" style="background:var(--color-border);">▶ Ver</button>
        <button class="btn btn-sm btn-secondary" data-action="edit-batch" data-batch-id="${batchId}">Editar</button>
        <button class="btn btn-sm btn-danger" data-action="delete-batch" data-batch-id="${batchId}">🗑</button>
      </td>
    </tr>`;

    const detailRows = evs.map(ev => {
      const a = animalMap[ev.animalId];
      const explotNombre = showExplot && a?.explotacionId ? explotMap[a.explotacionId] : null;
      return `<tr class="batch-detail-row" data-batch-id="${batchId}" style="display:none;">
        <td style="color:var(--color-text-muted);font-size:0.8rem;padding-left:16px;">↳</td>
        <td></td>
        <td>${a ? `<strong>${escapeHtml(a.crotal)}</strong>${a.nombre ? ' ' + escapeHtml(a.nombre) : ''}` : '—'}</td>
        ${showExplot ? `<td>${explotNombre ? escapeHtml(explotNombre) : '<span class="text-muted">—</span>'}</td>` : ''}
        <td>${escapeHtml(ev.descripcion) || '—'}</td>
        <td>${ev.peso ? ev.peso + ' kg' : ''}${ev.importe ? formatEur(ev.importe) : ''}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${ev.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${ev.id}">🗑</button>
        </td>
      </tr>`;
    }).join('');

    return headerRow + detailRows;
  };

  list.innerHTML = `<div class="table-container"><table>
    <thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Animal / Lote</th>${showExplot ? '<th>Explotación</th>' : ''}<th>Descripción</th><th>Datos</th><th>Acciones</th>
    </tr></thead>
    <tbody>${displayItems.map(item =>
      item.type === 'single' ? renderSingleRow(item.ev) : renderBatchGroup(item.batchId, item.evs)
    ).join('')}
    </tbody>
  </table></div>`;

  // Toggle batch rows
  list.querySelectorAll('[data-action="toggle-batch"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const batchId = btn.dataset.batchId;
      const rows = list.querySelectorAll(`.batch-detail-row[data-batch-id="${batchId}"]`);
      const isOpen = rows[0]?.style.display !== 'none';
      rows.forEach(r => r.style.display = isOpen ? 'none' : '');
      btn.textContent = isOpen ? '▶ Ver' : '▼ Ocultar';
    });
  });

  // Edit batch
  list.querySelectorAll('[data-action="edit-batch"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const batchId = btn.dataset.batchId;
      const [allEvs, allAnimales] = await Promise.all([getAll('eventos'), getAll('animales')]);
      const batchEvs = allEvs.filter(e => e.batchId === batchId);
      const { overlay } = openModal({ title: `Editar lote (${batchEvs.length} animales)`, bodyHtml: '<div id="bef-slot"></div>' });
      renderBatchEditForm(overlay.querySelector('#bef-slot'), batchEvs, allAnimales, () => {
        overlay.remove();
        loadEventos(container);
      });
    });
  });

  // Delete batch
  list.querySelectorAll('[data-action="delete-batch"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const batchId = btn.dataset.batchId;
      const allEvs = await getAll('eventos');
      const batchEvs = allEvs.filter(e => e.batchId === batchId);
      confirmModal(`¿Eliminar el lote completo? Se borrarán ${batchEvs.length} eventos y sus transacciones vinculadas.`, async () => {
        const allAnimales = await getAll('animales');
        for (const ev of batchEvs) {
          await remove('eventos', ev.id);
          if (ev.transaccionId) await remove('transacciones', ev.transaccionId);
          if ((ev.tipo === 'venta' || ev.tipo === 'muerte') && ev.animalId) {
            const anim = allAnimales.find(a => a.id === ev.animalId);
            const expectedStatus = ev.tipo === 'venta' ? 'vendido' : 'muerto';
            if (anim && anim.status === expectedStatus) {
              await put('animales', { ...anim, status: 'activo', updatedAt: new Date().toISOString() });
            }
          }
        }
        showToast(`Lote de ${batchEvs.length} eventos eliminado`);
        loadEventos(container);
      });
    });
  });

  // Individual edit
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

  // Individual delete
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

async function renderBatchEditForm(slot, events, allAnimales, onSave) {
  const animalMap = Object.fromEntries(allAnimales.map(a => [a.id, a]));
  const firstEv = events[0];
  const toRemove = new Set();

  const renderAnimalList = () => {
    const el = slot.querySelector('#bef-anim-list');
    if (!el) return;
    const remaining = events.filter(ev => !toRemove.has(ev.id));
    el.innerHTML = remaining.map(ev => {
      const a = animalMap[ev.animalId];
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--color-border);">
        <span style="flex:1;font-size:0.88rem;">${a ? `<strong>${escapeHtml(a.crotal)}</strong>${a.nombre ? ' — ' + escapeHtml(a.nombre) : ''}` : '—'}</span>
        <button type="button" class="btn btn-sm btn-danger" data-remove-ev="${ev.id}" style="padding:2px 8px;line-height:1;">✕</button>
      </div>`;
    }).join('') + (toRemove.size > 0
      ? `<div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:6px;">${toRemove.size} animal(es) se eliminarán del lote al guardar.</div>`
      : '');
    el.querySelectorAll('[data-remove-ev]').forEach(btn => {
      btn.addEventListener('click', () => { toRemove.add(btn.dataset.removeEv); renderAnimalList(); });
    });
  };

  slot.innerHTML = `
    <div class="form-group">
      <div class="form-label">Animales del lote (${events.length})</div>
      <div id="bef-anim-list" style="max-height:150px;overflow-y:auto;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;padding:4px 10px;"></div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Tipo de evento *</label>
        <select class="form-control" id="bef-tipo">
          ${TIPOS_EVENTO.map(t => `<option value="${t.value}" ${firstEv.tipo === t.value ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha *</label>
        <input type="date" class="form-control" id="bef-fecha" value="${firstEv.fecha.split('T')[0]}">
      </div>
    </div>
    <div id="bef-extra"></div>
    <div class="form-group">
      <label class="form-label">Descripción / notas</label>
      <textarea class="form-control" id="bef-desc" rows="2">${escapeHtml(firstEv.descripcion ?? '')}</textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
      <button class="btn btn-primary" id="bef-save">Guardar cambios</button>
    </div>`;

  renderAnimalList();

  const updateExtra = () => {
    const tipo = slot.querySelector('#bef-tipo').value;
    const extra = slot.querySelector('#bef-extra');
    const sameType = firstEv.tipo === tipo;
    if (tipo === 'peso') {
      extra.innerHTML = `<div class="form-group"><label class="form-label">Peso (kg)</label><input type="number" inputmode="decimal" class="form-control" id="bef-peso" min="0" step="0.1" value="${sameType && firstEv.peso != null ? firstEv.peso : ''}"></div>`;
    } else if (['venta', 'compra'].includes(tipo)) {
      const totalLote = sameType ? events.reduce((s, e) => s + (e.importe || 0), 0) : 0;
      extra.innerHTML = `<div class="grid-2">
        <div class="form-group"><label class="form-label">Importe total lote (€)</label><input type="number" inputmode="decimal" class="form-control" id="bef-importe" min="0" step="0.01" value="${totalLote > 0 ? parseFloat(totalLote.toFixed(2)) : ''}"></div>
        <div class="form-group"><label class="form-label">${tipo === 'venta' ? 'Comprador' : 'Vendedor'}</label><input class="form-control" id="bef-contraparte" value="${sameType ? escapeHtml(firstEv.contraparte ?? '') : ''}"></div>
      </div>`;
    } else {
      extra.innerHTML = '';
    }
  };
  slot.querySelector('#bef-tipo').addEventListener('change', updateExtra);
  updateExtra();

  slot.querySelector('#bef-save').addEventListener('click', async () => {
    const tipo = slot.querySelector('#bef-tipo').value;
    const fecha = slot.querySelector('#bef-fecha').value;
    if (!fecha) { showToast('La fecha es obligatoria', 'error'); return; }
    const fechaISO = new Date(fecha).toISOString();
    const importe = slot.querySelector('#bef-importe')?.value ? Number(slot.querySelector('#bef-importe').value) : null;
    const peso = slot.querySelector('#bef-peso')?.value ? Number(slot.querySelector('#bef-peso').value) : null;
    const contraparte = slot.querySelector('#bef-contraparte')?.value.trim() || null;
    const descripcion = slot.querySelector('#bef-desc').value.trim() || null;

    const freshAnimales = await getAll('animales');

    // First pass: delete removed events and their transactions
    for (const ev of events) {
      if (!toRemove.has(ev.id)) continue;
      await remove('eventos', ev.id);
      if (ev.transaccionId) await remove('transacciones', ev.transaccionId);
      if ((ev.tipo === 'venta' || ev.tipo === 'muerte') && ev.animalId) {
        const anim = freshAnimales.find(a => a.id === ev.animalId);
        const expectedStatus = ev.tipo === 'venta' ? 'vendido' : 'muerto';
        if (anim && anim.status === expectedStatus) {
          await put('animales', { ...anim, status: 'activo', updatedAt: new Date().toISOString() });
        }
      }
    }

    const remaining = events.filter(ev => !toRemove.has(ev.id));

    // Delete all existing transactions from remaining events (will recreate one)
    for (const ev of remaining) {
      if (ev.transaccionId) await remove('transacciones', ev.transaccionId);
    }

    // Create ONE transaction for the total lot amount
    const remainingAnimals = remaining.map(ev => freshAnimales.find(a => a.id === ev.animalId));
    const batchTitularIdSet = new Set(remainingAnimals.map(a => a?.titularId ?? null));
    const batchTitularId = batchTitularIdSet.size === 1 ? [...batchTitularIdSet][0] : null;

    let batchTransaccionId = null;
    if ((tipo === 'venta' || tipo === 'compra') && importe && remaining.length > 0) {
      batchTransaccionId = uid();
      const firstAnim = remainingAnimals[0];
      await put('transacciones', {
        id: batchTransaccionId,
        tipo: tipo === 'venta' ? 'ingreso' : 'gasto',
        importe,
        fecha: fechaISO,
        categoriaId: tipo === 'venta' ? 'sys-venta-animales' : 'sys-compra-animales',
        descripcion: `${tipo === 'venta' ? 'Venta' : 'Compra'} lote: ${remaining.length} animales`,
        referencia: null,
        explotacionId: firstAnim?.explotacionId ?? null,
        titularId: batchTitularId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const importePerAnimal = importe && remaining.length > 0 ? importe / remaining.length : null;

    // Second pass: update remaining events
    for (let i = 0; i < remaining.length; i++) {
      const ev = remaining[i];
      const anim = freshAnimales.find(a => a.id === ev.animalId);
      const transaccionId = i === 0 ? batchTransaccionId : null;

      await put('eventos', { ...ev, tipo, fecha: fechaISO, descripcion, peso, importe: importePerAnimal, contraparte, transaccionId, updatedAt: new Date().toISOString() });

      if (anim) {
        if (tipo === 'peso' && peso) {
          await put('animales', { ...anim, currentWeight: peso, weightDate: fechaISO, updatedAt: new Date().toISOString() });
        } else if (tipo === 'venta') {
          await put('animales', { ...anim, status: 'vendido', updatedAt: new Date().toISOString() });
        } else if (tipo === 'muerte') {
          await put('animales', { ...anim, status: 'muerto', updatedAt: new Date().toISOString() });
        }
      }
    }

    showToast('Lote actualizado');
    onSave();
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
        titularId: anim?.titularId ?? null,
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
      batchId: ev?.batchId ?? null,
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
