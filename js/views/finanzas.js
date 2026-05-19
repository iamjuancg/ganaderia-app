import { getAll, put, remove, getByRange } from '../db/database.js';
import { uid, escapeHtml, formatEur } from '../utils/format.js';
import { formatDate, todayISO, getYear, currentYear } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';
import { buildDropdown, initDropdownCloser } from '../utils/dropdown.js';
import { getActiveTitularId, renderTitularFilter, titularMatcher, getCachedTitulares, getCachedExplotaciones } from '../utils/appstate.js';

let activeTab = 'ingreso', filterYear = currentYear();
let filterCatsIng = new Set();
let filterCatsGast = new Set();
let filterExplotaciones = new Set();

export async function renderFinanzas(container) {
  const years = await getAvailableYears();

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Finanzas</h1>
      <div class="action-group">
        <button class="btn btn-primary" id="btn-nuevo-ingreso">+ Ingreso</button>
        <button class="btn btn-secondary" id="btn-nuevo-gasto">+ Gasto</button>
      </div>
    </div>

    <div class="filter-row-tight" id="fi-filter-bar">
      <select class="form-control" id="fi-year" style="width:110px;">
        ${years.map(y => `<option value="${y}" ${filterYear === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <div id="fi-dropdown-explot" class="fi-dropdown"></div>
      <div id="fi-dropdown-ing" class="fi-dropdown"></div>
      <div id="fi-dropdown-gast" class="fi-dropdown"></div>
      <div id="fi-dropdown-titular" class="fi-dropdown"></div>
      <button class="btn btn-sm btn-secondary" id="fi-clear-filters" style="display:none;">✕ Limpiar</button>
    </div>

    <div id="summary-bar-finanzas"></div>

    <div class="tabs">
      <button class="tab-btn ${activeTab === 'ingreso' ? 'active' : ''}" data-tab="ingreso">Ingresos</button>
      <button class="tab-btn ${activeTab === 'gasto' ? 'active' : ''}" data-tab="gasto">Gastos</button>
    </div>

    <div id="finanzas-list"></div>`;

  const refresh = () => loadFinanzas(container);
  await renderTitularFilter(container, 'fi-dropdown-titular', refresh);

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
      refresh();
    });
  });

  container.querySelector('#fi-year').addEventListener('change', e => {
    filterYear = Number(e.target.value);
    refresh();
  });

  container.querySelector('#fi-clear-filters').addEventListener('click', () => {
    filterExplotaciones = new Set();
    filterCatsIng = new Set();
    filterCatsGast = new Set();
    refresh();
  });

  initDropdownCloser();

  // Event delegation: una sola vez. #finanzas-list persiste entre re-renders.
  const list = container.querySelector('#finanzas-list');
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') {
      const all = await getAll('transacciones');
      const tx = all.find(t => t.id === id);
      const { overlay } = openModal({ title: `Editar ${tx.tipo}`, bodyHtml: '<div id="tf-slot"></div>' });
      renderTransaccionForm(overlay.querySelector('#tf-slot'), tx.tipo, tx, () => { overlay.remove(); loadFinanzas(container); });
    } else if (btn.dataset.action === 'delete') {
      confirmModal('¿Eliminar esta transacción?', async () => {
        await remove('transacciones', id);
        showToast('Transacción eliminada');
        loadFinanzas(container);
      });
    }
  });

  await loadFinanzas(container);
}

async function getAvailableYears() {
  const txs = await getAll('transacciones');
  const years = [...new Set(txs.map(t => getYear(t.fecha)).filter(Boolean))];
  if (!years.includes(currentYear())) years.push(currentYear());
  return years.sort((a, b) => b - a);
}

async function loadFinanzas(container) {
  // Rango "amplio" alrededor del año filtrado para tolerar fronteras de zona horaria;
  // el filtro getYear() exacto sigue aplicándose después.
  const yearRangeFrom = `${filterYear - 1}-12-31`;
  const yearRangeTo = `${filterYear + 1}-01-01`;
  const [transacciones, categorias, explotaciones, titulares] = await Promise.all([
    getByRange('transacciones', 'fecha', yearRangeFrom, yearRangeTo),
    getAll('categorias'), getCachedExplotaciones(), getCachedTitulares()
  ]);
  const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
  const explotMap = Object.fromEntries(explotaciones.map(e => [e.id, e.nombre]));
  const titularMap = Object.fromEntries(titulares.map(t => [t.id, t.nombre]));
  const showExplot = explotaciones.length > 0;
  const showTitular = titulares.length > 0;
  const numTitulares = titulares.length;
  const activeTitularId = getActiveTitularId();

  const catIngresos = categorias.filter(c => c.tipo === 'ingreso');
  const catGastos = categorias.filter(c => c.tipo === 'gasto');

  buildDropdown(container, 'fi-dropdown-explot', 'Explotación',
    explotaciones, filterExplotaciones, () => loadFinanzas(container));
  buildDropdown(container, 'fi-dropdown-ing', 'Ingresos',
    catIngresos, filterCatsIng, () => loadFinanzas(container));
  buildDropdown(container, 'fi-dropdown-gast', 'Gastos',
    catGastos, filterCatsGast, () => loadFinanzas(container));

  const activeCount = filterExplotaciones.size + filterCatsIng.size + filterCatsGast.size;
  const clearBtn = container.querySelector('#fi-clear-filters');
  if (clearBtn) clearBtn.style.display = activeCount > 0 ? '' : 'none';

  container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));

  const { titularMatch, efectiveImporte } = titularMatcher(activeTitularId, numTitulares);

  // --- Filtrado lista ---
  let filtered = transacciones.filter(t => t.tipo === activeTab && getYear(t.fecha) === filterYear && titularMatch(t));
  if (filterExplotaciones.size > 0) filtered = filtered.filter(t => filterExplotaciones.has(t.explotacionId));
  if (activeTab === 'ingreso' && filterCatsIng.size > 0) filtered = filtered.filter(t => filterCatsIng.has(t.categoriaId));
  if (activeTab === 'gasto' && filterCatsGast.size > 0) filtered = filtered.filter(t => filterCatsGast.has(t.categoriaId));
  filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // --- Summary ---
  let forSummary = transacciones.filter(t => getYear(t.fecha) === filterYear && titularMatch(t));
  if (filterExplotaciones.size > 0) forSummary = forSummary.filter(t => filterExplotaciones.has(t.explotacionId));
  let summaryIng = forSummary.filter(t => t.tipo === 'ingreso');
  let summaryGast = forSummary.filter(t => t.tipo === 'gasto');
  if (filterCatsIng.size > 0) summaryIng = summaryIng.filter(t => filterCatsIng.has(t.categoriaId));
  if (filterCatsGast.size > 0) summaryGast = summaryGast.filter(t => filterCatsGast.has(t.categoriaId));

  const ingresos = summaryIng.reduce((s, t) => s + efectiveImporte(t), 0);
  const gastos = summaryGast.reduce((s, t) => s + efectiveImporte(t), 0);
  const balance = ingresos - gastos;

  const summaryBar = container.querySelector('#summary-bar-finanzas');
  if (summaryBar) summaryBar.innerHTML = `<div class="summary-bar">
    <div class="summary-item"><div class="summary-label">Ingresos ${filterYear}</div><div class="summary-value income">${formatEur(ingresos)}</div></div>
    <div class="summary-item"><div class="summary-label">Gastos ${filterYear}</div><div class="summary-value expense">${formatEur(gastos)}</div></div>
    <div class="summary-item"><div class="summary-label">Balance</div><div class="summary-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}">${formatEur(balance)}</div></div>
  </div>`;

  const list = container.querySelector('#finanzas-list');
  if (!list) return;

  const tabTotal = filtered.reduce((s, t) => s + efectiveImporte(t), 0);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${activeTab === 'ingreso' ? '💶' : '💸'}</div>
      <h3>No hay ${activeTab === 'ingreso' ? 'ingresos' : 'gastos'}</h3>
      <p>Pulsa el botón superior para registrar uno.</p>
    </div>`;
    return;
  }

  const color = activeTab === 'ingreso' ? 'var(--color-primary)' : 'var(--color-danger)';
  list.innerHTML = `
    <div style="text-align:right;margin-bottom:8px;font-size:0.9rem;color:var(--color-text-muted);">
      Total: <strong style="color:${color}">${formatEur(tabTotal)}</strong>
      (${filtered.length} registros)
    </div>
    <div class="table-container"><table>
      <thead><tr>
        <th>Fecha</th><th>Categoría</th>${showExplot ? '<th>Explotación</th>' : ''}${showTitular ? '<th>Titular</th>' : ''}<th>Descripción</th><th>Referencia</th><th style="text-align:right">Importe</th><th>Acciones</th>
      </tr></thead>
      <tbody>${filtered.map(t => {
        const isShared = activeTitularId !== 'all' && !t.titularId;
        const dispImporte = efectiveImporte(t);
        return `<tr${isShared ? ' style="opacity:0.8;"' : ''}>
          <td>${formatDate(t.fecha)}</td>
          <td>${escapeHtml(catMap[t.categoriaId]?.nombre) || '—'}</td>
          ${showExplot ? `<td>${t.explotacionId ? escapeHtml(explotMap[t.explotacionId] ?? '—') : '<span class="text-muted">—</span>'}</td>` : ''}
          ${showTitular ? `<td>${t.titularId ? escapeHtml(titularMap[t.titularId] ?? '—') : '<span class="text-muted" title="Gasto compartido, repartido entre titulares">comp.</span>'}</td>` : ''}
          <td>${escapeHtml(t.descripcion) || '—'}</td>
          <td>${escapeHtml(t.referencia) || '—'}</td>
          <td style="text-align:right;font-weight:600;color:${color}">${formatEur(dispImporte)}${isShared ? `<span style="font-size:0.75rem;font-weight:400;color:var(--color-text-muted);margin-left:4px;" title="Importe total: ${formatEur(t.importe)}">÷${numTitulares}</span>` : ''}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${t.id}">Editar</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${t.id}">🗑</button>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;

}

export async function renderTransaccionForm(slot, tipo, tx, onSave) {
  const [categorias, explotaciones, titulares] = await Promise.all([getAll('categorias'), getCachedExplotaciones(), getCachedTitulares()]);
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
      ${titulares.length > 0 ? `
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Titular <span class="text-muted" style="font-weight:normal;">(sin asignar = compartido)</span></label>
        <select class="form-control" id="tf-titular">
          <option value="">— Compartido —</option>
          ${titulares.map(t => `<option value="${t.id}" ${tx?.titularId === t.id ? 'selected' : ''}>${escapeHtml(t.nombre)}</option>`).join('')}
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
      titularId: slot.querySelector('#tf-titular')?.value || null,
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
