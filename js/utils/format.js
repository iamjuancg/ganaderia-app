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

// IDs de categorías sistema. Usar siempre la constante, nunca el literal.
export const SYS_CAT = {
  PAC: 'sys-pac',
  VENTA_ANIMALES: 'sys-venta-animales',
  OTROS_INGRESOS: 'sys-otros-ingresos',
  COMBUSTIBLE: 'sys-combustible',
  COMPRA_ANIMALES: 'sys-compra-animales',
  INSTALACIONES: 'sys-instalaciones',
  MAQUINARIA: 'sys-maquinaria',
  NOMINAS: 'sys-nominas',
  OTROS_GASTOS: 'sys-otros-gastos',
  PIENSO: 'sys-pienso',
  RENTA_TERRENO: 'sys-renta-terreno',
  SEGUROS: 'sys-seguros',
  VET: 'sys-vet',
};

export const CATEGORIAS_DEFECTO = [
  { id: SYS_CAT.PAC, nombre: 'PAC / Subvenciones', tipo: 'ingreso', sistema: true },
  { id: SYS_CAT.VENTA_ANIMALES, nombre: 'Venta de animales', tipo: 'ingreso', sistema: true },
  { id: SYS_CAT.OTROS_INGRESOS, nombre: 'Otros ingresos', tipo: 'ingreso', sistema: true },
  { id: SYS_CAT.COMBUSTIBLE, nombre: 'Combustible y transporte', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.COMPRA_ANIMALES, nombre: 'Compra de animales', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.INSTALACIONES, nombre: 'Instalaciones y terrenos', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.MAQUINARIA, nombre: 'Maquinaria y mantenimiento', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.NOMINAS, nombre: 'Nóminas', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.OTROS_GASTOS, nombre: 'Otros gastos', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.PIENSO, nombre: 'Pienso y alimentación', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.RENTA_TERRENO, nombre: 'Renta Terreno', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.SEGUROS, nombre: 'Seguros', tipo: 'gasto', sistema: true },
  { id: SYS_CAT.VET, nombre: 'Veterinario y medicamentos', tipo: 'gasto', sistema: true },
];

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  // Click directo sin tocar document.body — la mayoría de navegadores lo permiten.
  // Liberar URL en el next tick para no perder la descarga en Safari.
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Genera una fila CSV con escapado de comillas dobles + protección contra
// CSV formula injection: Excel evalúa celdas que empiezan por =, +, -, @, TAB
// o CR como fórmulas. Se prefija con apóstrofo para que Excel las trate como
// texto literal.
export function csvRow(fields) {
  return fields.map(f => {
    const s = String(f ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',');
}

// Debounce: agrupa llamadas seguidas dentro de `wait` ms; solo dispara la última.
export function debounce(fn, wait = 150) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn.apply(this, args); }, wait);
  };
}
