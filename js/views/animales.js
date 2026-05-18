import { getAll, put, remove } from '../db/database.js';
import { uid, ESPECIES, escapeHtml, formatEur, eventoLabel } from '../utils/format.js';
import { formatDate, todayISO } from '../utils/date.js';
import { showToast } from '../utils/toast.js';
import { openModal, confirmModal } from '../utils/modal.js';
import { renderEventoForm } from './eventos.js';

let sortField = 'crotal', sortDir = 1;
let filterEspecie = '', filterStatus = 'activo', filterSearch = '', filterExplotacion = '';
let _explotaciones = [];

export async function renderAnimales(container) {
  _explotaciones = await getAll('explotaciones');

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Animales</h1>
      <button class="btn btn-primary" id="btn-nuevo-animal">+ Nuevo animal</button>
    </div>

    <div class="filters-bar">
      <input type="search" class="form-control search-input" id="search-animal" placeholder="Buscar crotal, nombre o últimas cifras…" value="${escapeHtml(filterSearch)}">
      <select class="form-control" id="filter-especie">
        <option value="">Todas las especies</option>
        ${ESPECIES.map(e => `<option value="${e}" ${filterEspecie === e ? 'selected' : ''}>${e}</option>`).join('')}
      </select>
      <select class="form-control" id="filter-status">
        <option value="activo" ${filterStatus === 'activo' ? 'selected' : ''}>Activos</option>
        <option value="" ${filterStatus === '' ? 'selected' : ''}>Todos</option>
        <option value="vendido" ${filterStatus === 'vendido' ? 'selected' : ''}>Vendidos</option>
        <option value="muerto" ${filterStatus === 'muerto' ? 'selected' : ''}>Muertos</option>
      </select>
      ${_explotaciones.length > 0 ? `
      <select class="form-control" id="filter-explotacion">
        <option value="">Todas las explotaciones</option>
        ${_explotaciones.map(e => `<option value="${e.id}" ${filterExplotacion === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}
      </select>` : ''}
    </div>

    <div id="animales-list"></div>`;

  const refresh = () => loadAnimales(container);

  container.querySelector('#btn-nuevo-animal').addEventListener('click', () => {
    const { overlay } = openModal({ title: 'Nuevo animal', bodyHtml: '<div id="af-slot"></div>' });
    renderAnimalForm(overlay.querySelector('#af-slot'), null, () => { overlay.remove(); refresh(); });
  });

  container.querySelector('#search-animal').addEventListener('input', e => { filterSearch = e.target.value; refresh(); });
  container.querySelector('#filter-especie').addEventListener('change', e => { filterEspecie = e.target.value; refresh(); });
  container.querySelector('#filter-status').addEventListener('change', e => { filterStatus = e.target.value; refresh(); });
  container.querySelector('#filter-explotacion')?.addEventListener('change', e => { filterExplotacion = e.target.value; refresh(); });

  await loadAnimales(container);
}

async function loadAnimales(container) {
  let animales = await getAll('animales');
  if (filterEspecie) animales = animales.filter(a => a.especie === filterEspecie);
  if (filterStatus) animales = animales.filter(a => a.status === filterStatus);
  if (filterSearch) {
    const q = filterSearch.toLowerCase().trim();
    animales = animales.filter(a => {
      if (a.crotal?.toLowerCase().includes(q)) return true;
      if (a.nombre?.toLowerCase().includes(q)) return true;
      if (/^\d+$/.test(q)) {
        const digits = a.crotal?.replace(/\D/g, '') ?? '';
        if (digits.endsWith(q)) return true;
      }
      return false;
    });
  }
  if (filterExplotacion) animales = animales.filter(a => a.explotacionId === filterExplotacion);
  animales.sort((a, b) => {
    const va = a[sortField] ?? ''; const vb = b[sortField] ?? '';
    return String(va).localeCompare(String(vb)) * sortDir;
  });

  const list = container.querySelector('#animales-list');
  if (!list) return;

  if (animales.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🐄</div>
      <h3>No hay animales</h3>
      <p>Pulsa "+ Nuevo animal" para añadir uno.</p>
    </div>`;
    return;
  }

  const explotMap = Object.fromEntries(_explotaciones.map(e => [e.id, e.nombre]));
  const showExplot = _explotaciones.length > 0;

  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    list.innerHTML = `<div class="animal-cards">${animales.map(a => animalCard(a, explotMap, showExplot)).join('')}</div>`;
  } else {
    list.innerHTML = `<div class="table-container"><table>
      <thead><tr>
        ${['crotal','nombre','especie','raza','sexo','status','fechaNacimiento','currentWeight'].map(f => `
          <th data-field="${f}" class="${sortField === f ? 'sorted' : ''}">${colLabel(f)} ${sortField === f ? (sortDir === 1 ? '▲' : '▼') : ''}</th>`).join('')}
        ${showExplot ? '<th>Explotación</th>' : ''}
        <th>Acciones</th>
      </tr></thead>
      <tbody>${animales.map(a => animalRow(a, explotMap, showExplot)).join('')}</tbody>
    </table></div>`;

    list.querySelectorAll('th[data-field]').forEach(th => {
      th.addEventListener('click', () => {
        const f = th.dataset.field;
        if (sortField === f) sortDir *= -1; else { sortField = f; sortDir = 1; }
        loadAnimales(container);
      });
    });
  }

  list.querySelectorAll('[data-action="detail"]').forEach(btn => {
    btn.addEventListener('click', () => openDetalle(btn.dataset.id, container));
  });
  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const animales2 = await getAll('animales');
      const animal = animales2.find(a => a.id === btn.dataset.id);
      const { overlay } = openModal({ title: 'Editar animal', bodyHtml: '<div id="af-slot"></div>' });
      renderAnimalForm(overlay.querySelector('#af-slot'), animal, () => { overlay.remove(); loadAnimales(container); });
    });
  });
  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmModal('¿Eliminar este animal? Esta acción no se puede deshacer.', async () => {
        await remove('animales', btn.dataset.id);
        showToast('Animal eliminado');
        loadAnimales(container);
      });
    });
  });
  list.querySelectorAll('[data-action="evento"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const animales2 = await getAll('animales');
      const animal = animales2.find(a => a.id === btn.dataset.id);
      const { overlay } = openModal({ title: 'Registrar evento', bodyHtml: '<div id="ev-slot"></div>' });
      renderEventoForm(overlay.querySelector('#ev-slot'), animal, () => { overlay.remove(); loadAnimales(container); });
    });
  });
}

function animalCard(a, explotMap, showExplot) {
  const explotNombre = showExplot && a.explotacionId ? explotMap[a.explotacionId] : null;
  return `<div class="animal-card">
    <div class="animal-card-header">
      <div>
        <div class="animal-card-crotal">${escapeHtml(a.crotal)}</div>
        ${a.nombre ? `<div class="animal-card-name">${escapeHtml(a.nombre)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <span class="badge badge-${a.status}">${a.status}</span>
        ${explotNombre ? `<span class="badge" style="background:var(--color-border);color:var(--color-text-muted);font-size:0.7rem;">${escapeHtml(explotNombre)}</span>` : ''}
      </div>
    </div>
    <div class="animal-card-row">
      <div class="animal-card-field"><span>Especie </span>${escapeHtml(a.especie)}</div>
      ${a.raza ? `<div class="animal-card-field"><span>Raza </span>${escapeHtml(a.raza)}</div>` : ''}
      <div class="animal-card-field"><span>Sexo </span><span class="badge badge-${a.sexo}">${a.sexo}</span></div>
      ${a.currentWeight ? `<div class="animal-card-field"><span>Peso </span>${a.currentWeight} kg</div>` : ''}
    </div>
    <div class="animal-card-actions">
      <button class="btn btn-sm btn-ghost" data-action="detail" data-id="${a.id}">Ver ficha</button>
      <button class="btn btn-sm btn-secondary" data-action="evento" data-id="${a.id}">+ Evento</button>
      <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${a.id}">Editar</button>
      <button class="btn btn-sm btn-danger" data-action="delete" data-id="${a.id}">🗑</button>
    </div>
  </div>`;
}

function animalRow(a, explotMap, showExplot) {
  const explotNombre = showExplot && a.explotacionId ? explotMap[a.explotacionId] : null;
  return `<tr>
    <td><strong>${escapeHtml(a.crotal)}</strong></td>
    <td>${escapeHtml(a.nombre) || '—'}</td>
    <td>${escapeHtml(a.especie)}</td>
    <td>${escapeHtml(a.raza) || '—'}</td>
    <td><span class="badge badge-${a.sexo}">${a.sexo}</span></td>
    <td><span class="badge badge-${a.status}">${a.status}</span></td>
    <td>${formatDate(a.fechaNacimiento)}</td>
    <td>${a.currentWeight ? a.currentWeight + ' kg' : '—'}</td>
    ${showExplot ? `<td>${explotNombre ? escapeHtml(explotNombre) : '<span class="text-muted">—</span>'}</td>` : ''}
    <td class="td-actions">
      <button class="btn btn-sm btn-ghost" data-action="detail" data-id="${a.id}">Ficha</button>
      <button class="btn btn-sm btn-secondary" data-action="evento" data-id="${a.id}">+ Evento</button>
      <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${a.id}">Editar</button>
      <button class="btn btn-sm btn-danger" data-action="delete" data-id="${a.id}">🗑</button>
    </td>
  </tr>`;
}

function colLabel(f) {
  const labels = { crotal: 'Crotal', nombre: 'Nombre', especie: 'Especie', raza: 'Raza', sexo: 'Sexo', status: 'Estado', fechaNacimiento: 'Nacimiento', currentWeight: 'Peso' };
  return labels[f] || f;
}

async function openDetalle(id, container) {
  const [animales, eventos] = await Promise.all([getAll('animales'), getAll('eventos')]);
  const a = animales.find(x => x.id === id);
  if (!a) return;
  const evAnimal = eventos.filter(e => e.animalId === id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const madre = a.madreId ? animales.find(x => x.id === a.madreId) : null;
  const explotNombre = a.explotacionId ? _explotaciones.find(e => e.id === a.explotacionId)?.nombre : null;

  const { overlay } = openModal({
    title: `Ficha: ${a.crotal}${a.nombre ? ' — ' + a.nombre : ''}`,
    bodyHtml: `
      <div class="grid-2">
        <div class="form-group"><div class="form-label">Crotal</div><div>${escapeHtml(a.crotal)}</div></div>
        <div class="form-group"><div class="form-label">Estado</div><div><span class="badge badge-${a.status}">${a.status}</span></div></div>
        <div class="form-group"><div class="form-label">Especie</div><div>${escapeHtml(a.especie)}</div></div>
        <div class="form-group"><div class="form-label">Raza</div><div>${escapeHtml(a.raza) || '—'}</div></div>
        <div class="form-group"><div class="form-label">Sexo</div><div><span class="badge badge-${a.sexo}">${a.sexo}</span></div></div>
        <div class="form-group"><div class="form-label">Nacimiento</div><div>${formatDate(a.fechaNacimiento)}</div></div>
        ${a.currentWeight ? `<div class="form-group"><div class="form-label">Peso actual</div><div>${a.currentWeight} kg (${formatDate(a.weightDate)})</div></div>` : ''}
        ${madre ? `<div class="form-group"><div class="form-label">Madre</div><div>${escapeHtml(madre.crotal)}</div></div>` : ''}
        ${a.origin ? `<div class="form-group"><div class="form-label">Origen</div><div>${a.origin}</div></div>` : ''}
        ${explotNombre ? `<div class="form-group"><div class="form-label">Explotación</div><div>${escapeHtml(explotNombre)}</div></div>` : ''}
        ${a.notas ? `<div class="form-group" style="grid-column:1/-1"><div class="form-label">Notas</div><div>${escapeHtml(a.notas)}</div></div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="section-title">Historial de eventos</div>
      ${evAnimal.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📋</div><p>Sin eventos registrados.</p></div>`
        : `<div class="timeline">${evAnimal.map(ev => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-type">${eventoLabel(ev.tipo)}</div>
                <div class="timeline-date">${formatDate(ev.fecha)}</div>
                <div class="timeline-desc">${escapeHtml(ev.descripcion) || ''}
                  ${ev.peso ? `<br>Peso: <strong>${ev.peso} kg</strong>` : ''}
                  ${ev.importe ? `<br>Importe: <strong>${formatEur(ev.importe)}</strong>` : ''}
                </div>
              </div>
            </div>`).join('')}
          </div>`}`,
    footerHtml: `
      <button class="btn btn-secondary" data-action="evento-ficha" data-id="${id}">+ Evento</button>
      <button class="btn btn-secondary" data-action="edit-ficha" data-id="${id}">Editar</button>
      <button class="btn btn-primary" id="close-ficha">Cerrar</button>`
  });

  overlay.querySelector('#close-ficha').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-action="evento-ficha"]').addEventListener('click', () => {
    overlay.remove();
    const { overlay: o2 } = openModal({ title: 'Registrar evento', bodyHtml: '<div id="ev-slot"></div>' });
    renderEventoForm(o2.querySelector('#ev-slot'), a, () => { o2.remove(); openDetalle(id, container); });
  });
  overlay.querySelector('[data-action="edit-ficha"]').addEventListener('click', () => {
    overlay.remove();
    const { overlay: o2 } = openModal({ title: 'Editar animal', bodyHtml: '<div id="af-slot"></div>' });
    renderAnimalForm(o2.querySelector('#af-slot'), a, () => { o2.remove(); loadAnimales(container); });
  });
}

export async function renderAnimalForm(slot, animal, onSave) {
  const [allAnimales, explotaciones] = await Promise.all([getAll('animales'), getAll('explotaciones')]);
  const hembras = allAnimales.filter(a => a.sexo === 'hembra' && a.id !== animal?.id);

  slot.innerHTML = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Crotal *</label>
        <input class="form-control" id="af-crotal" value="${escapeHtml(animal?.crotal ?? '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="form-control" id="af-nombre" value="${escapeHtml(animal?.nombre ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Especie *</label>
        <select class="form-control" id="af-especie">
          ${ESPECIES.map(e => `<option ${animal?.especie === e ? 'selected' : ''}>${e}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Raza</label>
        <input class="form-control" id="af-raza" value="${escapeHtml(animal?.raza ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Sexo *</label>
        <select class="form-control" id="af-sexo">
          <option value="macho" ${animal?.sexo === 'macho' ? 'selected' : ''}>Macho</option>
          <option value="hembra" ${animal?.sexo === 'hembra' ? 'selected' : ''}>Hembra</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-control" id="af-status">
          <option value="activo" ${(!animal || animal?.status === 'activo') ? 'selected' : ''}>Activo</option>
          <option value="vendido" ${animal?.status === 'vendido' ? 'selected' : ''}>Vendido</option>
          <option value="muerto" ${animal?.status === 'muerto' ? 'selected' : ''}>Muerto</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de nacimiento</label>
        <input type="date" class="form-control" id="af-fecha" value="${animal?.fechaNacimiento?.split('T')[0] ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Madre</label>
        <select class="form-control" id="af-madre">
          <option value="">— Sin madre —</option>
          ${hembras.map(h => `<option value="${h.id}" ${animal?.madreId === h.id ? 'selected' : ''}>${escapeHtml(h.crotal)}${h.nombre ? ' — ' + h.nombre : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Origen</label>
        <select class="form-control" id="af-origin">
          <option value="" ${!animal?.origin ? 'selected' : ''}>—</option>
          <option value="nacimiento" ${animal?.origin === 'nacimiento' ? 'selected' : ''}>Nacimiento</option>
          <option value="compra" ${animal?.origin === 'compra' ? 'selected' : ''}>Compra</option>
        </select>
      </div>
      ${explotaciones.length > 0 ? `
      <div class="form-group">
        <label class="form-label">Explotación</label>
        <select class="form-control" id="af-explotacion">
          <option value="">— Sin asignar —</option>
          ${explotaciones.map(e => `<option value="${e.id}" ${animal?.explotacionId === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Notas</label>
      <textarea class="form-control" id="af-notas" rows="2">${escapeHtml(animal?.notas ?? '')}</textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
      <button class="btn btn-primary" id="af-save">Guardar</button>
    </div>`;

  slot.querySelector('#af-save').addEventListener('click', async () => {
    const crotal = slot.querySelector('#af-crotal').value.trim();
    if (!crotal) { showToast('El crotal es obligatorio', 'error'); return; }

    const all = await getAll('animales');
    const duplicate = all.find(a => a.crotal === crotal && a.id !== animal?.id);
    if (duplicate) { showToast('Ya existe un animal con ese crotal', 'error'); return; }

    const now = new Date().toISOString();
    const record = {
      id: animal?.id ?? uid(),
      crotal,
      nombre: slot.querySelector('#af-nombre').value.trim() || null,
      especie: slot.querySelector('#af-especie').value,
      raza: slot.querySelector('#af-raza').value.trim() || null,
      sexo: slot.querySelector('#af-sexo').value,
      status: slot.querySelector('#af-status').value,
      fechaNacimiento: slot.querySelector('#af-fecha').value || null,
      madreId: slot.querySelector('#af-madre').value || null,
      origin: slot.querySelector('#af-origin').value || null,
      notas: slot.querySelector('#af-notas').value.trim() || null,
      explotacionId: slot.querySelector('#af-explotacion')?.value || null,
      currentWeight: animal?.currentWeight ?? null,
      weightDate: animal?.weightDate ?? null,
      createdAt: animal?.createdAt ?? now,
      updatedAt: now,
    };
    await put('animales', record);
    showToast(animal ? 'Animal actualizado' : 'Animal añadido');
    onSave();
  });
}
