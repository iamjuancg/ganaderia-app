import { getAll, put, remove } from './database.js';
import { CATEGORIAS_DEFECTO } from '../utils/format.js';

const DEPRECATED_IDS = ['sys-venta-leche'];

export async function seedDefaults() {
  const existing = await getAll('categorias');
  for (const id of DEPRECATED_IDS) {
    if (existing.find(c => c.id === id)) await remove('categorias', id);
  }
  const after = await getAll('categorias');
  const sysIds = new Set(after.filter(c => c.sistema).map(c => c.id));
  for (const cat of CATEGORIAS_DEFECTO) {
    if (!sysIds.has(cat.id)) await put('categorias', cat);
  }
}
