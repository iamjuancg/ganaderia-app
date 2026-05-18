import { getAll, put } from '../db/database.js';
import { uid, TIPOS_EVENTO, eventoIcon, eventoLabel, escapeHtml, formatEur } from '../utils/format.js';
import { formatDate, todayISO } from '../utils/date.js';
import { showToast } from '../utils/toast.js';

let filterTipo = '', filterEspecie = '', filterFechaDesde = '', filterFechaHasta = '', filterExplotacion = '';
let _explotaciones = [];

export async function renderEventos(container) {
  _explotaciones = await getAll('explotaciones');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Eventos del rebaño</h1>
    </div>
    <div class="filters-bar">
      <select class="form-control" id="ev-filter-tipo">
        <option value="">Todos los tipos</option>
        ${TIPOS_EVENTO.map(t => `<option value="${t.value}" ${filterTipo === t.value ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
      </select>
      <input type="date" class="form-control" id="ev-filter-desde" value="${filterFechaDesde}" title="Fecha desde">
      <input type="date" class="form-control" id="ev-filter-hasta" value="${filterFechaHasta}" title="Fecha hasta">
      ${_explotaciones.length > 0 ? `
      <select class="form-control" id="ev-filter-explotacion">
        <option value="">Todas las explotaciones</option>
        ${_explotaciones.map(e => `<option value="${e.id}" ${filterExplotacion === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}
      </select>` : ''}
    </div>
    <div id="eventos-list"></div>`;

  const refresh = () => loadEventos(container);

  container.querySelector('#ev-filter-tipo').addEventListener('change', e => { filterTipo = e.target.value; refresh(); });
  container.querySelector('#ev-filter-desde').addEventListener('change', e => { filterFechaDesde = e.target.value; refresh(); });
  container.querySelector('#ev-filter-hasta').addEventListener('change', e => { filterFechaHasta = e.target.value; refresh(); });
  container.querySelector('#ev-filter-explotacion')?.addEventListener('change', e => { filterExplotacion = e.target.value; refresh(); });

  await loadEventos(container);
}

async function loadEventos(container) {
  const [eventos, animales] = await Promise.all([getAll('eventos'), getAll('animales')]);
  const animalMap = Object.fromEntries(animales.map(a => [a.id, a]));
  const explotMap = Object.fromEntries(_explotaciones.map(e => [e.id, e.nombre]));

  let filtered = [...eventos];
  if (filterTipo) filtered = filtered.filter(e => e.tipo === filterTipo);
  if (filterFechaDesde) filtered = filtered.filter(e => e.fecha >= filterFechaDesde);
  if (filterFechaHasta) filtered = filtered.filter(e => e.fecha <= filterFechaHasta + 'T23:59:59');
  if (filterExplotacion) filtered = filtered.filter(e => animalMap[e.animalId]?.explotacionId === filterExplotacion);
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
      <th>Fecha</th><th>Tipo</th><th>Animal</th>${showExplot ? '<th>Explotación</th>' : ''}<th>Descripción</th><th>Datos</th>
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
      </tr>`;
    }).join('')}
    </tbody>
  </table></div>`;
}

export async function renderEventoForm(slot, animal, onSave) {
  const allAnimales = await getAll('animales');

  slot.innerHTML = `
    <div class="form-group">
      <label class="form-label">Animal</label>
      <select class="form-control" id="evf-animal">
        ${allAnimales.map(a => `<option value="${a.id}" ${animal?.id === a.id ? 'selected' : ''}>${escapeHtml(a.crotal)}${a.nombre ? ' — ' + a.nombre : ''}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Tipo de evento *</label>
        <select class="form-control" id="evf-tipo">
          ${TIPOS_EVENTO.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha *</label>
        <input type="date" class="form-control" id="evf-fecha" value="${todayISO()}">
      </div>
    </div>
    <div id="evf-extra"></div>
    <div class="form-group">
      <label class="form-label">Descripción / notas</label>
      <textarea class="form-control" id="evf-desc" rows="2"></textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
      <button class="btn btn-primary" id="evf-save">Guardar evento</button>
    </div>`;

  const updateExtra = () => {
    const tipo = slot.querySelector('#evf-tipo').value;
    const extra = slot.querySelector('#evf-extra');
    if (tipo === 'peso') {
      extra.innerHTML = `<div class="form-group"><label class="form-label">Peso (kg)</label><input type="number" inputmode="decimal" class="form-control" id="evf-peso" min="0" step="0.1"></div>`;
    } else if (['venta', 'compra'].includes(tipo)) {
      extra.innerHTML = `<div class="grid-2">
        <div class="form-group"><label class="form-label">Importe (€)</label><input type="number" inputmode="decimal" class="form-control" id="evf-importe" min="0" step="0.01"></div>
        <div class="form-group"><label class="form-label">${tipo === 'venta' ? 'Comprador' : 'Vendedor'}</label><input class="form-control" id="evf-contraparte"></div>
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

    const record = {
      id: uid(),
      animalId,
      tipo,
      fecha: new Date(fecha).toISOString(),
      descripcion: slot.querySelector('#evf-desc').value.trim() || null,
      peso: slot.querySelector('#evf-peso')?.value ? Number(slot.querySelector('#evf-peso').value) : null,
      importe: slot.querySelector('#evf-importe')?.value ? Number(slot.querySelector('#evf-importe').value) : null,
      contraparte: slot.querySelector('#evf-contraparte')?.value.trim() || null,
      createdAt: new Date().toISOString(),
    };

    await put('eventos', record);

    // Side effects
    const allAnimales = await getAll('animales');
    const anim = allAnimales.find(a => a.id === animalId);
    if (anim) {
      if (tipo === 'peso' && record.peso) {
        anim.currentWeight = record.peso;
        anim.weightDate = record.fecha;
        anim.updatedAt = new Date().toISOString();
        await put('animales', anim);
      } else if (tipo === 'venta') {
        anim.status = 'vendido';
        anim.updatedAt = new Date().toISOString();
        await put('animales', anim);
      } else if (tipo === 'muerte') {
        anim.status = 'muerto';
        anim.updatedAt = new Date().toISOString();
        await put('animales', anim);
      }
    }

    showToast('Evento registrado');
    onSave();
  });
}

export async function renderEventosAnimal(animalId) {
  const eventos = await getAll('eventos');
  return eventos.filter(e => e.animalId === animalId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
