import { getAll, put, remove } from '../db/database.js';
import { uid, escapeHtml, formatEur } from '../utils/format.js';
import { formatDate, todayISO, getYear, currentYear } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';

let activeTab = 'ingreso', filterYear = currentYear();
let filterCats = new Set();
let filterExplotaciones = new Set();

function chip(label, active, attr, val) {
  const cls = active ? 'btn-primary' : 'btn-secondary';
  return `<button class="btn btn-sm ${cls}" style="border-radius:20px;" ${attr}="${escapeHtml(val)}">${escapeHtml(label)}</button>`;
}

export async function renderFinanzas(container) {
  const years = await getAvailableYears();

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Finanzas</h1>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" id="btn-nuevo-ingreso">+ Ingreso</button>
        <button class="btn btn-secondary" id="btn-nuevo-gasto">+ Gasto</button>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <label class="form-label" style="margin:0;white-space:nowrap;">Año:</label>
      <select class="form-control" id="fi-year" style="width:110px;">
        ${years.map(y => `<option value="${y}" ${filterYear === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>

    <div id="fi-chips" style="margin-bottom:8px;"></div>

    <div id="summary-bar-finanzas"></div>

    <div class="tabs">
      <button class="tab-btn ${activeTab === 'ingreso' ? 'active' : ''}" data-tab="ingreso">Ingresos</button>
      <button class="tab-btn ${activeTab === 'gasto' ? 'active' : ''}" data-tab="gasto">Gastos</button>
    </div>

    <div id="finanzas-list"></div>`;

  const refresh = () => loadFinanzas(container);

  container.querySelector('#btn-nuevo-ingreso').addEventListener('click', () => {
    const { overlay } = openModal({ title: 'Nuevo ingreso', bodyHtml: '<div id="tf-slot"></div>' });
    renderTransaccionForm(overlay.querySelector('#tf-slot'), 'ingreso', null, () => { overlay.remove(); refresh(); });
  });
  container.querySelector('#btn-nuevo-gasto').addEventListener('click', () => {
    const { overlay } = openModal({ title: 'Nuevo gasto', bodyHtml: '<div id="tf-slot"></div>' });
    renderTransaccionForm(overlay.querySelector('#tf-slot'), 'gasto', null, () => { overlay.remove(); refresh(); });
  });

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      filterCats = new Set();
      refresh();
    });
  });
  container.querySelector('#fi-year').addEventListener('change', e => { filterYear = Number(e.target.value); refresh(); });

  await loadFinanzas(container);
}

async function getAvailableYears() {
  const txs = await getAll('transacciones');
  const years = [...new Set(txs.map(t => getYear(t.fecha)).filter(Boolean))];
  if (!years.includes(currentYear())) years.push(currentYear());
  return years.sort((a, b) => b - a);
}

async function loadFinanzas(container) {
  const [transacciones, categorias, explotaciones] = await Promise.all([
    getAll('transacciones'), getAll('categorias'), getAll('explotaciones')
  ]);
  const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
  const explotMap = Object.fromEntries(explotaciones.map(e => [e.id, e.nombre]));
  const catsTab = categorias.filter(c => c.tipo === activeTab);
  const showExplot = explotaciones.length > 0;

  // --- Chips ---
  const chipsEl = container.querySelector('#fi-chips');
  if (chipsEl) {
    const explotRow = showExplot ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;">
        <span class="text-muted text-small" style="min-width:80px;">Explotación:</span>
        ${chip('Todas', filterExplotaciones.size === 0, 'data-explot', '')}
        ${explotaciones.map(e => chip(e.nombre, filterExplotaciones.has(e.id), 'data-explot', e.id)).join('')}
      </div>` : '';

    const catRow = catsTab.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        <span class="text-muted text-small" style="min-width:80px;">Categoría:</span>
        ${chip('Todas', filterCats.size === 0, 'data-cat', '')}
        ${catsTab.map(c => chip(c.nombre, filterCats.has(c.id), 'data-cat', c.id)).join('')}
      </div>` : '';

    chipsEl.innerHTML = explotRow + catRow;

    chipsEl.querySelectorAll('[data-explot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.explot;
        if (id === '') filterExplotaciones.clear();
        else { if (filterExplotaciones.has(id)) filterExplotaciones.delete(id); else filterExplotaciones.add(id); }
        loadFinanzas(container);
      });
    });
    chipsEl.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cat;
        if (id === '') filterCats.clear();
        else { if (filterCats.has(id)) filterCats.delete(id); else filterCats.add(id); }
        loadFinanzas(container);
      });
    });
  }

  // --- Tabs active ---
  container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));

  // --- Filtrado lista ---
  let filtered = transacciones.filter(t => t.tipo === activeTab && getYear(t.fecha) === filterYear);
  if (filterExplotaciones.size > 0) filtered = filtered.filter(t => filterExplotaciones.has(t.explotacionId));
  if (filterCats.size > 0) filtered = filtered.filter(t => filterCats.has(t.categoriaId));
  filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // --- Summary (respeta ambos filtros) ---
  let forSummary = transacciones.filter(t => getYear(t.fecha) === filterYear);
  if (filterExplotaciones.size > 0) forSummary = forSummary.filter(t => filterExplotaciones.has(t.explotacionId));
  let summaryIng = forSummary.filter(t => t.tipo === 'ingreso');
  let summaryGast = forSummary.filter(t => t.tipo === 'gasto');
  if (filterCats.size > 0 && activeTab === 'ingreso') summaryIng = summaryIng.filter(t => filterCats.has(t.categoriaId));
  if (filterCats.size > 0 && activeTab === 'gasto') summaryGast = summaryGast.filter(t => filterCats.has(t.categoriaId));

  const ingresos = summaryIng.reduce((s, t) => s + t.importe, 0);
  const gastos = summaryGast.reduce((s, t) => s + t.importe, 0);
  const balance = ingresos - gastos;

  const summaryBar = container.querySelector('#summary-bar-finanzas');
  if (summaryBar) summaryBar.innerHTML = `<div class="summary-bar">
    <div class="summary-item"><div class="summary-label">Ingresos ${filterYear}</div><div class="summary-value income">${formatEur(ingresos)}</div></div>
    <div class="summary-item"><div class="summary-label">Gastos ${filterYear}</div><div class="summary-value expense">${formatEur(gastos)}</div></div>
    <div class="summary-item"><div class="summary-label">Balance</div><div class="summary-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}">${formatEur(balance)}</div></div>
  </div>`;

  const list = container.querySelector('#finanzas-list');
  if (!list) return;

  const tabTotal = filtered.reduce((s, t) => s + t.importe, 0);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${activeTab === 'ingreso' ? '💶' : '💸'}</div>
      <h3>No hay ${activeTab === 'ingreso' ? 'ingresos' : 'gastos'}</h3>
      <p>Pulsa el botón superior para registrar uno.</p>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div style="text-align:right;margin-bottom:8px;font-size:0.9rem;color:var(--color-text-muted);">
      Total: <strong style="color:${activeTab === 'ingreso' ? 'var(--color-primary)' : 'var(--color-danger)'}">${formatEur(tabTotal)}</strong>
      (${filtered.length} registros)
    </div>
    <div class="table-container"><table>
      <thead><tr>
        <th>Fecha</th><th>Categoría</th>${showExplot ? '<th>Explotación</th>' : ''}<th>Descripción</th><th>Referencia</th><th style="text-align:right">Importe</th><th>Acciones</th>
      </tr></thead>
      <tbody>${filtered.map(t => `<tr>
        <td>${formatDate(t.fecha)}</td>
        <td>${escapeHtml(catMap[t.categoriaId]?.nombre) || '—'}</td>
        ${showExplot ? `<td>${t.explotacionId ? escapeHtml(explotMap[t.explotacionId] ?? '—') : '<span class="text-muted">—</span>'}</td>` : ''}
        <td>${escapeHtml(t.descripcion) || '—'}</td>
        <td>${escapeHtml(t.referencia) || '—'}</td>
        <td style="text-align:right;font-weight:600;color:${activeTab === 'ingreso' ? 'var(--color-primary)' : 'var(--color-danger)'}">${formatEur(t.importe)}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${t.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${t.id}">🗑</button>
        </td>
      </tr>`).join('')}
      </tbody>
    </table></div>`;

  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const all = await getAll('transacciones');
      const tx = all.find(t => t.id === btn.dataset.id);
      const { overlay } = openModal({ title: `Editar ${tx.tipo}`, bodyHtml: '<div id="tf-slot"></div>' });
      renderTransaccionForm(overlay.querySelector('#tf-slot'), tx.tipo, tx, () => { overlay.remove(); loadFinanzas(container); });
    });
  });
  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmModal('¿Eliminar esta transacción?', async () => {
        await remove('transacciones', btn.dataset.id);
        showToast('Transacción eliminada');
        loadFinanzas(container);
      });
    });
  });
}

export async function renderTransaccionForm(slot, tipo, tx, onSave) {
  const [categorias, explotaciones] = await Promise.all([getAll('categorias'), getAll('explotaciones')]);
  const cats = categorias.filter(c => c.tipo === tipo);

  slot.innerHTML = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Importe (€) *</label>
        <input type="number" inputmode="decimal" class="form-control" id="tf-importe" min="0" step="0.01" value="${tx?.importe ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Fecha *</label>
        <input type="date" class="form-control" id="tf-fecha" value="${tx?.fecha?.split('T')[0] ?? todayISO()}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Categoría *</label>
        <select class="form-control" id="tf-cat">
          <option value="">— Selecciona —</option>
          ${cats.map(c => `<option value="${c.id}" ${tx?.categoriaId === c.id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
        </select>
      </div>
      ${explotaciones.length > 0 ? `
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Explotación</label>
        <select class="form-control" id="tf-explotacion">
          <option value="">— Sin asignar —</option>
          ${explotaciones.map(e => `<option value="${e.id}" ${tx?.explotacionId === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input class="form-control" id="tf-desc" value="${escapeHtml(tx?.descripcion ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Referencia / nº factura</label>
      <input class="form-control" id="tf-ref" value="${escapeHtml(tx?.referencia ?? '')}">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
      <button class="btn btn-primary" id="tf-save">Guardar</button>
    </div>`;

  slot.querySelector('#tf-save').addEventListener('click', async () => {
    const importe = Number(slot.querySelector('#tf-importe').value);
    const fecha = slot.querySelector('#tf-fecha').value;
    const categoriaId = slot.querySelector('#tf-cat').value;
    if (!importe || importe <= 0) { showToast('El importe debe ser mayor que 0', 'error'); return; }
    if (!fecha) { showToast('La fecha es obligatoria', 'error'); return; }
    if (!categoriaId) { showToast('Selecciona una categoría', 'error'); return; }

    const record = {
      id: tx?.id ?? uid(),
      tipo,
      importe,
      fecha: new Date(fecha).toISOString(),
      categoriaId,
      explotacionId: slot.querySelector('#tf-explotacion')?.value || null,
      descripcion: slot.querySelector('#tf-desc').value.trim() || null,
      referencia: slot.querySelector('#tf-ref').value.trim() || null,
      createdAt: tx?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await put('transacciones', record);
    showToast(tx ? 'Transacción actualizada' : `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado`);
    onSave();
  });
}
