import { getAll } from '../db/database.js';
import { formatEur, eventoIcon, eventoLabel } from '../utils/format.js';
import { formatDate, currentYear, getYear, getYearMonth } from '../utils/date.js';
import { openModal } from '../utils/modal.js';
import { getActiveTitularId } from '../utils/appstate.js';
import { renderAnimalForm } from './animales.js';
import { renderTransaccionForm } from './finanzas.js';

export async function renderDashboard(container) {
  container.innerHTML = `<div class="page-header">
    <h1 class="page-title">Dashboard</h1>
  </div>
  <div id="dashboard-loading" class="empty-state"><div class="empty-icon">⏳</div><p>Cargando...</p></div>`;

  const [animales, eventos, transacciones, titulares] = await Promise.all([
    getAll('animales'), getAll('eventos'), getAll('transacciones'), getAll('titulares')
  ]);

  const activeTitularId = getActiveTitularId();
  const numTitulares = titulares.length;

  const year = currentYear();
  const activosAll = animales.filter(a => a.status === 'activo');
  const activos = activeTitularId === 'all'
    ? activosAll
    : activosAll.filter(a => a.titularId === activeTitularId);
  const especiesCount = {};
  for (const a of activos) {
    especiesCount[a.especie] = (especiesCount[a.especie] || 0) + 1;
  }

  const titularMatch = (t) => {
    if (activeTitularId === 'all') return true;
    return t.titularId === activeTitularId || t.titularId === null;
  };
  const efectiveImporte = (t) => {
    if (activeTitularId === 'all' || t.titularId === activeTitularId || numTitulares === 0) return t.importe;
    return t.importe / numTitulares;
  };

  const txYear = transacciones.filter(t => getYear(t.fecha) === year && titularMatch(t));
  const ingresos = txYear.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + efectiveImporte(t), 0);
  const gastos = txYear.filter(t => t.tipo === 'gasto').reduce((s, t) => s + efectiveImporte(t), 0);
  const balance = ingresos - gastos;

  const recientes = [...eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);
  const animalMap = Object.fromEntries(animales.map(a => [a.id, a]));

  // Gráfico 6 meses
  const monthData = buildMonthData(transacciones, activeTitularId, numTitulares);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
    </div>

    <!-- Acciones rápidas -->
    <div class="quick-actions no-print">
      <button class="btn btn-primary" id="qa-nuevo-animal">+ Nuevo animal</button>
      <button class="btn btn-secondary" id="qa-registrar-venta">💶 Registrar venta</button>
      <button class="btn btn-secondary" id="qa-registrar-gasto">💸 Registrar gasto</button>
    </div>

    <!-- KPIs animales -->
    <div class="section-title">Rebaño activo</div>
    <div class="card-grid" id="kpi-especies">
      ${Object.keys(especiesCount).length === 0
        ? `<div class="stat-card"><div class="stat-icon">🐄</div><div class="stat-label">Animales activos</div><div class="stat-value">0</div></div>`
        : Object.entries(especiesCount).map(([esp, n]) => `
          <div class="stat-card">
            <div class="stat-label">${esp}</div>
            <div class="stat-value">${n}</div>
            <div class="stat-sub">cabezas activas</div>
          </div>`).join('')}
    </div>

    <!-- KPIs finanzas -->
    <div class="section-title mt-16">Balance ${year}</div>
    <div class="summary-bar">
      <div class="summary-item">
        <div class="summary-label">Ingresos</div>
        <div class="summary-value income">${formatEur(ingresos)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Gastos</div>
        <div class="summary-value expense">${formatEur(gastos)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Balance</div>
        <div class="summary-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}">${formatEur(balance)}</div>
      </div>
    </div>

    <!-- Gráfico barras -->
    <div class="section-title mt-16">Ingresos vs Gastos — últimos 6 meses</div>
    <div class="chart-container">
      <canvas id="chart-barras" height="200"></canvas>
    </div>

    <!-- Eventos recientes -->
    <div class="section-title mt-16">Últimos eventos</div>
    ${recientes.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📋</div><h3>Sin eventos recientes</h3></div>`
      : `<div class="recent-events">
          ${recientes.map(ev => {
            const animal = animalMap[ev.animalId];
            return `<div class="recent-event-item">
              <div class="recent-event-icon">${eventoIcon(ev.tipo)}</div>
              <div class="recent-event-main">
                <div><strong>${eventoLabel(ev.tipo)}</strong>${animal ? ` — ${animal.crotal}${animal.nombre ? ' ' + animal.nombre : ''}` : ''}</div>
                ${ev.descripcion ? `<div class="text-muted text-small">${ev.descripcion}</div>` : ''}
              </div>
              <div class="recent-event-date">${formatDate(ev.fecha)}</div>
            </div>`;
          }).join('')}
        </div>`}
  `;

  drawBarChart(monthData);

  container.querySelector('#qa-nuevo-animal').addEventListener('click', () => {
    const { overlay } = openModal({ title: 'Nuevo animal', bodyHtml: '<div id="animal-form-slot"></div>' });
    renderAnimalForm(overlay.querySelector('#animal-form-slot'), null, () => { overlay.remove(); renderDashboard(container); });
  });
  container.querySelector('#qa-registrar-venta').addEventListener('click', () => {
    const { overlay } = openModal({ title: 'Registrar ingreso', bodyHtml: '<div id="tx-form-slot"></div>' });
    renderTransaccionForm(overlay.querySelector('#tx-form-slot'), 'ingreso', null, () => { overlay.remove(); renderDashboard(container); });
  });
  container.querySelector('#qa-registrar-gasto').addEventListener('click', () => {
    const { overlay } = openModal({ title: 'Registrar gasto', bodyHtml: '<div id="tx-form-slot"></div>' });
    renderTransaccionForm(overlay.querySelector('#tx-form-slot'), 'gasto', null, () => { overlay.remove(); renderDashboard(container); });
  });
}

function buildMonthData(transacciones, activeTitularId, numTitulares) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(getYearMonth(d.toISOString()));
  }
  const titularMatch = (t) => {
    if (activeTitularId === 'all') return true;
    return t.titularId === activeTitularId || t.titularId === null;
  };
  const efectiveImporte = (t) => {
    if (activeTitularId === 'all' || t.titularId === activeTitularId || numTitulares === 0) return t.importe;
    return t.importe / numTitulares;
  };
  return months.map(ym => {
    const txs = transacciones.filter(t => getYearMonth(t.fecha) === ym && titularMatch(t));
    return {
      label: ym.slice(5) + '/' + ym.slice(2, 4),
      ingresos: txs.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + efectiveImporte(t), 0),
      gastos: txs.filter(t => t.tipo === 'gasto').reduce((s, t) => s + efectiveImporte(t), 0),
    };
  });
}

function drawBarChart(data) {
  const canvas = document.getElementById('chart-barras');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = 200;
  canvas.width = W; canvas.height = H;

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const max = Math.max(...data.flatMap(d => [d.ingresos, d.gastos]), 1);

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#e8f0ec'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(W - padding.right, y); ctx.stroke();
  }

  const groupW = chartW / data.length;
  const barW = Math.min(groupW * 0.35, 24);

  data.forEach((d, i) => {
    const x = padding.left + groupW * i + groupW / 2;

    // Ingreso
    const hI = (d.ingresos / max) * chartH;
    ctx.fillStyle = '#40916c';
    ctx.fillRect(x - barW - 2, padding.top + chartH - hI, barW, hI);

    // Gasto
    const hG = (d.gastos / max) * chartH;
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x + 2, padding.top + chartH - hG, barW, hG);

    // Label
    ctx.fillStyle = '#6b7c74'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.label, x, H - 10);
  });

  // Y axis labels
  ctx.fillStyle = '#6b7c74'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = max * (1 - i / 4);
    const y = padding.top + (chartH / 4) * i;
    ctx.fillText(val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0), padding.left - 6, y + 4);
  }

  // Leyenda
  ctx.fillStyle = '#40916c'; ctx.fillRect(padding.left, H - 8, 12, 8);
  ctx.fillStyle = '#6b7c74'; ctx.textAlign = 'left'; ctx.font = '10px sans-serif';
  ctx.fillText('Ingresos', padding.left + 16, H - 1);
  ctx.fillStyle = '#e63946'; ctx.fillRect(padding.left + 80, H - 8, 12, 8);
  ctx.fillText('Gastos', padding.left + 96, H - 1);
}
