import { getAll } from '../db/database.js';
import { formatEur, escapeHtml } from '../utils/format.js';
import { currentYear, getYear } from '../utils/date.js';

let selectedYear = currentYear();
let filterExplotaciones = new Set();
let filterCatsIng = new Set();
let filterCatsGast = new Set();

function chip(label, active, attr, val) {
  const cls = active ? 'btn-primary' : 'btn-secondary';
  return `<button class="btn btn-sm ${cls}" style="border-radius:20px;" ${attr}="${escapeHtml(val)}">${escapeHtml(label)}</button>`;
}

export async function renderInformes(container) {
  const txs = await getAll('transacciones');
  const years = [...new Set(txs.map(t => getYear(t.fecha)).filter(Boolean))];
  if (!years.includes(currentYear())) years.push(currentYear());
  years.sort((a, b) => b - a);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Informes</h1>
      <div style="display:flex;gap:10px;align-items:center;">
        <select class="form-control" id="inf-year" style="width:120px;">
          ${years.map(y => `<option value="${y}" ${selectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
        <button class="btn btn-secondary no-print" onclick="window.print()">🖨 Imprimir</button>
      </div>
    </div>
    <div id="inf-chips" style="margin-bottom:8px;"></div>
    <div id="inf-content"></div>`;

  container.querySelector('#inf-year').addEventListener('change', e => {
    selectedYear = Number(e.target.value);
    loadInformes(container);
  });
  await loadInformes(container);
}

async function loadInformes(container) {
  const [animales, transacciones, categorias, explotaciones] = await Promise.all([
    getAll('animales'), getAll('transacciones'), getAll('categorias'), getAll('explotaciones')
  ]);
  const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
  const catIngresos = categorias.filter(c => c.tipo === 'ingreso');
  const catGastos = categorias.filter(c => c.tipo === 'gasto');

  // --- Chips ---
  const chipsEl = container.querySelector('#inf-chips');
  if (chipsEl) {
    const explotRow = explotaciones.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;">
        <span class="text-muted text-small" style="min-width:90px;">Explotación:</span>
        ${chip('Todas', filterExplotaciones.size === 0, 'data-explot', '')}
        ${explotaciones.map(e => chip(e.nombre, filterExplotaciones.has(e.id), 'data-explot', e.id)).join('')}
      </div>` : '';

    const ingRow = catIngresos.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;">
        <span class="text-muted text-small" style="min-width:90px;">Cat. ingreso:</span>
        ${chip('Todas', filterCatsIng.size === 0, 'data-ing', '')}
        ${catIngresos.map(c => chip(c.nombre, filterCatsIng.has(c.id), 'data-ing', c.id)).join('')}
      </div>` : '';

    const gastRow = catGastos.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        <span class="text-muted text-small" style="min-width:90px;">Cat. gasto:</span>
        ${chip('Todas', filterCatsGast.size === 0, 'data-gast', '')}
        ${catGastos.map(c => chip(c.nombre, filterCatsGast.has(c.id), 'data-gast', c.id)).join('')}
      </div>` : '';

    chipsEl.innerHTML = explotRow + ingRow + gastRow;

    chipsEl.querySelectorAll('[data-explot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.explot;
        if (id === '') filterExplotaciones.clear();
        else { if (filterExplotaciones.has(id)) filterExplotaciones.delete(id); else filterExplotaciones.add(id); }
        loadInformes(container);
      });
    });
    chipsEl.querySelectorAll('[data-ing]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.ing;
        if (id === '') filterCatsIng.clear();
        else { if (filterCatsIng.has(id)) filterCatsIng.delete(id); else filterCatsIng.add(id); }
        loadInformes(container);
      });
    });
    chipsEl.querySelectorAll('[data-gast]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.gast;
        if (id === '') filterCatsGast.clear();
        else { if (filterCatsGast.has(id)) filterCatsGast.delete(id); else filterCatsGast.add(id); }
        loadInformes(container);
      });
    });
  }

  // --- Aplicar filtros ---
  let txYear = transacciones.filter(t => getYear(t.fecha) === selectedYear);
  if (filterExplotaciones.size > 0) txYear = txYear.filter(t => filterExplotaciones.has(t.explotacionId));

  let ingresos = txYear.filter(t => t.tipo === 'ingreso');
  let gastos = txYear.filter(t => t.tipo === 'gasto');
  if (filterCatsIng.size > 0) ingresos = ingresos.filter(t => filterCatsIng.has(t.categoriaId));
  if (filterCatsGast.size > 0) gastos = gastos.filter(t => filterCatsGast.has(t.categoriaId));

  const totalIngresos = ingresos.reduce((s, t) => s + t.importe, 0);
  const totalGastos = gastos.reduce((s, t) => s + t.importe, 0);
  const balance = totalIngresos - totalGastos;

  // --- Agrupar por categoría ---
  const byCat = (txs) => {
    const map = {};
    for (const t of txs) {
      const cat = catMap[t.categoriaId]?.nombre || 'Sin categoría';
      map[cat] = (map[cat] || 0) + t.importe;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const ingCat = byCat(ingresos);
  const gastCat = byCat(gastos);

  // --- Rebaño ---
  const ESTADOS = ['activo', 'vendido', 'muerto'];
  const especiesSet = [...new Set(animales.map(a => a.especie))].sort();
  const rebanoData = {};
  for (const a of animales) {
    if (!rebanoData[a.especie]) rebanoData[a.especie] = { activo: 0, vendido: 0, muerto: 0 };
    rebanoData[a.especie][a.status] = (rebanoData[a.especie][a.status] || 0) + 1;
  }

  const activeFilters = filterExplotaciones.size > 0 || filterCatsIng.size > 0 || filterCatsGast.size > 0;
  const filterNote = activeFilters ? `<span class="badge" style="background:var(--color-primary);color:#fff;margin-left:8px;font-size:0.75rem;">Filtrado</span>` : '';

  const content = container.querySelector('#inf-content');
  content.innerHTML = `
    <!-- P&L -->
    <div class="section-title">Cuenta de resultados — ${selectedYear} ${filterNote}</div>
    <div class="summary-bar" style="margin-bottom:24px;">
      <div class="summary-item"><div class="summary-label">Total ingresos</div><div class="summary-value income">${formatEur(totalIngresos)}</div></div>
      <div class="summary-item"><div class="summary-label">Total gastos</div><div class="summary-value expense">${formatEur(totalGastos)}</div></div>
      <div class="summary-item"><div class="summary-label">Balance neto</div><div class="summary-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}">${formatEur(balance)}</div></div>
    </div>

    <div class="grid-2" style="gap:24px;">
      <div>
        <div class="section-title">Ingresos por categoría</div>
        <div class="table-container"><table>
          <thead><tr><th>Categoría</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>
            ${ingCat.map(([cat, imp]) => `<tr><td>${escapeHtml(cat)}</td><td style="text-align:right;color:var(--color-primary);font-weight:600">${formatEur(imp)}</td></tr>`).join('')}
            ${ingCat.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--color-text-muted)">Sin datos</td></tr>' : ''}
            <tr style="border-top:2px solid var(--color-border)"><td><strong>Total</strong></td><td style="text-align:right;font-weight:700;color:var(--color-primary)">${formatEur(totalIngresos)}</td></tr>
          </tbody>
        </table></div>
      </div>

      <div>
        <div class="section-title">Gastos por categoría</div>
        <div class="table-container"><table>
          <thead><tr><th>Categoría</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>
            ${gastCat.map(([cat, imp]) => `<tr><td>${escapeHtml(cat)}</td><td style="text-align:right;color:var(--color-danger);font-weight:600">${formatEur(imp)}</td></tr>`).join('')}
            ${gastCat.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--color-text-muted)">Sin datos</td></tr>' : ''}
            <tr style="border-top:2px solid var(--color-border)"><td><strong>Total</strong></td><td style="text-align:right;font-weight:700;color:var(--color-danger)">${formatEur(totalGastos)}</td></tr>
          </tbody>
        </table></div>
      </div>
    </div>

    <!-- Pie chart gastos -->
    ${gastCat.length > 0 ? `
    <div class="section-title mt-16">Desglose de gastos</div>
    <div class="chart-container" style="max-width:420px;">
      <canvas id="chart-pie" width="380" height="260"></canvas>
    </div>` : ''}

    <!-- Inventario rebaño -->
    <div class="section-title mt-16">Inventario del rebaño</div>
    <div class="table-container"><table>
      <thead><tr><th>Especie</th>${ESTADOS.map(e => `<th style="text-align:center">${e.charAt(0).toUpperCase()+e.slice(1)}</th>`).join('')}<th style="text-align:center">Total</th></tr></thead>
      <tbody>
        ${especiesSet.map(esp => {
          const d = rebanoData[esp] || {};
          const total = ESTADOS.reduce((s, e) => s + (d[e] || 0), 0);
          return `<tr><td>${escapeHtml(esp)}</td>${ESTADOS.map(e => `<td style="text-align:center">${d[e] || 0}</td>`).join('')}<td style="text-align:center;font-weight:700">${total}</td></tr>`;
        }).join('')}
        ${especiesSet.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted)">Sin animales registrados</td></tr>' : ''}
      </tbody>
    </table></div>`;

  if (gastCat.length > 0) drawPieChart(gastCat, totalGastos);
}

function drawPieChart(data, total) {
  const canvas = document.getElementById('chart-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2 - 40, cy = H / 2, r = Math.min(cx, cy) - 20;
  const colors = ['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2','#e63946','#e9c46a','#f4a261','#264653','#2a9d8f'];

  ctx.clearRect(0, 0, W, H);

  let startAngle = -Math.PI / 2;
  data.forEach(([cat, val], i) => {
    const slice = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    startAngle += slice;
  });

  const lx = cx + r + 20, ly = 20;
  data.slice(0, 8).forEach(([cat, val], i) => {
    const y = ly + i * 22;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, y, 14, 14);
    ctx.fillStyle = '#333'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    const pct = ((val / total) * 100).toFixed(0) + '%';
    const label = cat.length > 16 ? cat.slice(0, 14) + '…' : cat;
    ctx.fillText(`${label} ${pct}`, lx + 18, y + 11);
  });
}
