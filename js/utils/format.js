const eurFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatEur(amount) {
  return eurFormatter.format(amount ?? 0);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const ESPECIES = ['Bovino', 'Ovino', 'Caprino', 'Porcino', 'Equino', 'Otro'];

export const TIPOS_EVENTO = [
  { value: 'nacimiento', label: 'Nacimiento', icon: '🐣' },
  { value: 'compra', label: 'Compra', icon: '🛒' },
  { value: 'venta', label: 'Venta', icon: '💶' },
  { value: 'muerte', label: 'Muerte', icon: '💀' },
  { value: 'peso', label: 'Pesaje', icon: '⚖️' },
  { value: 'vacunacion', label: 'Vacunación', icon: '💉' },
  { value: 'tratamiento', label: 'Tratamiento', icon: '💊' },
  { value: 'celo', label: 'Celo', icon: '❤️' },
  { value: 'otro', label: 'Otro', icon: '📝' },
];

export function eventoIcon(tipo) {
  return TIPOS_EVENTO.find(t => t.value === tipo)?.icon ?? '📝';
}

export function eventoLabel(tipo) {
  return TIPOS_EVENTO.find(t => t.value === tipo)?.label ?? tipo;
}

export const CATEGORIAS_DEFECTO = [
  { id: 'sys-pac', nombre: 'PAC / Subvenciones', tipo: 'ingreso', sistema: true },
  { id: 'sys-venta-animales', nombre: 'Venta de animales', tipo: 'ingreso', sistema: true },
  { id: 'sys-otros-ingresos', nombre: 'Otros ingresos', tipo: 'ingreso', sistema: true },
  { id: 'sys-combustible', nombre: 'Combustible y transporte', tipo: 'gasto', sistema: true },
  { id: 'sys-compra-animales', nombre: 'Compra de animales', tipo: 'gasto', sistema: true },
  { id: 'sys-instalaciones', nombre: 'Instalaciones y terrenos', tipo: 'gasto', sistema: true },
  { id: 'sys-maquinaria', nombre: 'Maquinaria y mantenimiento', tipo: 'gasto', sistema: true },
  { id: 'sys-nominas', nombre: 'Nóminas', tipo: 'gasto', sistema: true },
  { id: 'sys-otros-gastos', nombre: 'Otros gastos', tipo: 'gasto', sistema: true },
  { id: 'sys-pienso', nombre: 'Pienso y alimentación', tipo: 'gasto', sistema: true },
  { id: 'sys-renta-terreno', nombre: 'Renta Terreno', tipo: 'gasto', sistema: true },
  { id: 'sys-seguros', nombre: 'Seguros', tipo: 'gasto', sistema: true },
  { id: 'sys-vet', nombre: 'Veterinario y medicamentos', tipo: 'gasto', sistema: true },
];

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export function csvRow(fields) {
  return fields.map(f => `"${String(f ?? '').replace(/"/g, '""')}"`).join(',');
}

// Debounce: agrupa llamadas seguidas dentro de `wait` ms; solo dispara la última.
export function debounce(fn, wait = 150) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn.apply(this, args); }, wait);
  };
}
