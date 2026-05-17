export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDatetime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function toISO(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toISOString();
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function getYear(iso) {
  return iso ? new Date(iso).getFullYear() : null;
}

export function getYearMonth(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentYear() {
  return new Date().getFullYear();
}
