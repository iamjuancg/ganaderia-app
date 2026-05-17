import { getAll, put } from './database.js';
import { CATEGORIAS_DEFECTO } from '../utils/format.js';

export async function seedDefaults() {
  const existing = await getAll('categorias');
  const sysIds = new Set(existing.filter(c => c.sistema).map(c => c.id));
  for (const cat of CATEGORIAS_DEFECTO) {
    if (!sysIds.has(cat.id)) await put('categorias', cat);
  }
}
