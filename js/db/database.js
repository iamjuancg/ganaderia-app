const DB_NAME = 'GanaderiaDB';
const DB_VERSION = 5;

let db = null;

export function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const d = e.target.result;

      if (!d.objectStoreNames.contains('animales')) {
        const animals = d.createObjectStore('animales', { keyPath: 'id' });
        animals.createIndex('crotal', 'crotal', { unique: true });
        animals.createIndex('especie', 'especie', { unique: false });
        animals.createIndex('status', 'status', { unique: false });
      }

      if (!d.objectStoreNames.contains('eventos')) {
        const events = d.createObjectStore('eventos', { keyPath: 'id' });
        events.createIndex('animalId', 'animalId', { unique: false });
        events.createIndex('tipo', 'tipo', { unique: false });
        events.createIndex('fecha', 'fecha', { unique: false });
      }

      if (!d.objectStoreNames.contains('transacciones')) {
        const tx = d.createObjectStore('transacciones', { keyPath: 'id' });
        tx.createIndex('tipo', 'tipo', { unique: false });
        tx.createIndex('fecha', 'fecha', { unique: false });
        tx.createIndex('categoriaId', 'categoriaId', { unique: false });
      }

      if (!d.objectStoreNames.contains('categorias')) {
        const cats = d.createObjectStore('categorias', { keyPath: 'id' });
        cats.createIndex('tipo', 'tipo', { unique: false });
      }

      if (!d.objectStoreNames.contains('ajustes')) {
        d.createObjectStore('ajustes', { keyPath: 'key' });
      }

      if (!d.objectStoreNames.contains('explotaciones')) {
        d.createObjectStore('explotaciones', { keyPath: 'id' });
      }

      if (!d.objectStoreNames.contains('empleados')) {
        d.createObjectStore('empleados', { keyPath: 'id' });
      }

      if (!d.objectStoreNames.contains('titulares')) {
        d.createObjectStore('titulares', { keyPath: 'id' });
      }
    };

    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export function getAll(store) {
  return new Promise((res, rej) => {
    const req = tx(store).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

export function getById(store, id) {
  return new Promise((res, rej) => {
    const req = tx(store).get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

export function getByIndex(store, indexName, value) {
  return new Promise((res, rej) => {
    const req = tx(store).index(indexName).getAll(value);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

export function put(store, record) {
  return new Promise((res, rej) => {
    const req = tx(store, 'readwrite').put(record);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

export function remove(store, id) {
  return new Promise((res, rej) => {
    const req = tx(store, 'readwrite').delete(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

export function getSetting(key) {
  return new Promise((res, rej) => {
    const req = tx('ajustes').get(key);
    req.onsuccess = e => res(e.target.result?.value ?? null);
    req.onerror = e => rej(e.target.error);
  });
}

export function setSetting(key, value) {
  return put('ajustes', { key, value });
}

export async function clearAllStores() {
  const stores = ['animales', 'eventos', 'transacciones', 'categorias', 'ajustes', 'explotaciones', 'empleados', 'titulares'];
  for (const store of stores) {
    await new Promise((res, rej) => {
      const req = tx(store, 'readwrite').clear();
      req.onsuccess = () => res();
      req.onerror = e => rej(e.target.error);
    });
  }
}

export async function exportAll() {
  const [animales, eventos, transacciones, categorias, explotaciones, empleados, titulares] = await Promise.all([
    getAll('animales'), getAll('eventos'), getAll('transacciones'), getAll('categorias'), getAll('explotaciones'), getAll('empleados'), getAll('titulares')
  ]);
  return { animales, eventos, transacciones, categorias, explotaciones, empleados, titulares, exportedAt: new Date().toISOString() };
}

export async function importAll(data) {
  const stores = ['animales', 'eventos', 'transacciones', 'categorias', 'explotaciones', 'empleados', 'titulares'];
  for (const store of stores) {
    if (!data[store]) continue;
    for (const record of data[store]) await put(store, record);
  }
}

export async function replaceAll(data) {
  const stores = ['animales', 'eventos', 'transacciones', 'categorias', 'explotaciones', 'empleados', 'titulares'];
  for (const store of stores) {
    await new Promise((res, rej) => {
      const req = tx(store, 'readwrite').clear();
      req.onsuccess = () => res();
      req.onerror = e => rej(e.target.error);
    });
    if (!data[store]) continue;
    for (const record of data[store]) await put(store, record);
  }
}
