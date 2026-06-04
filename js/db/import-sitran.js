// Importador del XML oficial del SITRAN (Sistema Integral de Trazabilidad
// Animal) — el "Libro de Registro de Animales" que el ganadero descarga de la
// web de su comunidad autónoma.
//
// Política de duplicados: animales cuyo crotal ya esté en la base se SALTAN.
// La importación nunca actualiza filas existentes; los cambios de estado
// (bajas, ventas, pesos) se registran por el UI normal de eventos. Esto
// permite reimportar un XML actualizado sin pisar nada.
//
// Notas del formato SITRAN:
//  · Crotales vienen con casing y espacios inconsistentes (ES/Es/es, espacio
//    final). Se normalizan con trim() + toUpperCase().
//  · Fechas en DD/MM/YYYY, se reformatean a ISO.
//  · `crotalMadre` puede apuntar a otro animal del propio XML o a uno que ya
//    estaba en la base. Ambos casos se resuelven.
//  · El XML usa namespace `http://tempuri.org/DSLibroRegistroAnimalesTemporales.xsd`,
//    hay que parsear con `getElementsByTagNameNS`.

import { getAll, batch } from './database.js';
import { uid } from '../utils/format.js';

const NS = 'http://tempuri.org/DSLibroRegistroAnimalesTemporales.xsd';

const SEXO_MAP = { macho: 'macho', hembra: 'hembra' };
const ORIGIN_MAP = { nacimiento: 'nacimiento', movimiento: 'compra' };

// Causa-de-baja SITRAN → estado del animal y tipo de evento. Las causas que no
// reconocemos quedan como "vendido" + evento "venta" (lo más conservador: el
// animal sale del rebaño pero no asumimos muerte).
const BAJA_MAP = {
  movimiento: { status: 'vendido', tipo: 'venta' },
  muerte: { status: 'muerto', tipo: 'muerte' },
  sacrificio: { status: 'muerto', tipo: 'muerte' },
};

const norm = (s) => (s ? String(s).trim().toUpperCase() : '');
const texto = (el, tag) => el.getElementsByTagNameNS(NS, tag)[0]?.textContent?.trim() ?? '';

function fechaIso(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function parseSitranXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('El XML no es válido.');

  const elementos = doc.getElementsByTagNameNS(NS, 'Animal');
  if (elementos.length === 0) {
    throw new Error('El fichero no contiene animales del SITRAN.');
  }

  const animales = [];
  const regaSet = new Set();

  for (const el of elementos) {
    const crotal = norm(texto(el, 'crotal'));
    if (!crotal) continue;

    const sexo = SEXO_MAP[texto(el, 'sexo').toLowerCase()] ?? null;
    const causaAlta = texto(el, 'causaAlta').toLowerCase();
    const causaBaja = texto(el, 'causaBaja').toLowerCase();
    const regaPertenencia = norm(texto(el, 'explotacionPertenencia'));
    if (regaPertenencia) regaSet.add(regaPertenencia);

    const baja = causaBaja ? BAJA_MAP[causaBaja] ?? BAJA_MAP.movimiento : null;

    const eventos = [];
    const fechaAlta = fechaIso(texto(el, 'fechaAlta'));
    if (fechaAlta) {
      eventos.push({ tipo: causaAlta === 'movimiento' ? 'compra' : 'nacimiento', fecha: fechaAlta });
    }
    if (baja) {
      const fechaBaja = fechaIso(texto(el, 'fechaBaja'));
      if (fechaBaja) eventos.push({ tipo: baja.tipo, fecha: fechaBaja });
    }

    animales.push({
      crotal,
      especie: 'bovino',
      sexo,
      raza: texto(el, 'raza') || null,
      fechaNacimiento: fechaIso(texto(el, 'fechaNacimiento')),
      crotalMadre: norm(texto(el, 'crotalMadre')) || null,
      origin: ORIGIN_MAP[causaAlta] ?? null,
      status: baja?.status ?? 'activo',
      regaPertenencia: regaPertenencia || null,
      eventos,
    });
  }

  return { animales, regas: [...regaSet] };
}

export async function resumirSitran(data) {
  const all = await getAll('animales');
  const existentes = new Set(all.map(a => norm(a.crotal)));
  let nuevos = 0;
  let duplicados = 0;
  for (const a of data.animales) {
    if (existentes.has(a.crotal)) duplicados++; else nuevos++;
  }
  return { total: data.animales.length, nuevos, duplicados, regas: data.regas.length };
}

export async function importarSitran(data) {
  const resumen = {
    animales: 0, eventos: 0, explotacionesCreadas: 0, duplicadosOmitidos: 0,
  };
  const now = new Date().toISOString();

  // Map REGA → id de explotación (existentes y nuevas-a-crear).
  const existExp = await getAll('explotaciones');
  const regaToId = new Map();
  for (const e of existExp) {
    if (e.codigoRega) regaToId.set(norm(e.codigoRega), e.id);
  }
  const explotsACrear = [];
  for (const rega of data.regas) {
    if (!regaToId.has(rega)) {
      const id = uid();
      regaToId.set(rega, id);
      explotsACrear.push({ id, nombre: rega, codigoRega: rega });
    }
  }

  // Map crotal → id de animal (en BD y los que vamos creando). Sirve para
  // saltar duplicados y para resolver `madreId`.
  const todosAnimales = await getAll('animales');
  const crotalToId = new Map();
  for (const a of todosAnimales) crotalToId.set(norm(a.crotal), a.id);

  const nuevos = [];
  for (const a of data.animales) {
    if (crotalToId.has(a.crotal)) {
      resumen.duplicadosOmitidos++;
      continue;
    }
    const id = uid();
    crotalToId.set(a.crotal, id);
    nuevos.push({ ...a, _id: id });
  }

  if (nuevos.length === 0 && explotsACrear.length === 0) return resumen;

  const animalesRecords = nuevos.map(a => ({
    id: a._id,
    crotal: a.crotal,
    nombre: null,
    especie: a.especie,
    raza: a.raza,
    sexo: a.sexo,
    status: a.status,
    fechaNacimiento: a.fechaNacimiento,
    madreId: a.crotalMadre ? crotalToId.get(a.crotalMadre) ?? null : null,
    origin: a.origin,
    notas: null,
    explotacionId: a.regaPertenencia ? regaToId.get(a.regaPertenencia) ?? null : null,
    titularId: null,
    currentWeight: null,
    weightDate: null,
    createdAt: now,
    updatedAt: now,
  }));

  const eventosRecords = [];
  for (const a of nuevos) {
    for (const ev of a.eventos) {
      eventosRecords.push({
        id: uid(),
        animalId: a._id,
        tipo: ev.tipo,
        fecha: ev.fecha,
        descripcion: null,
        peso: null,
        importe: null,
        contraparte: null,
        transaccionId: null,
        batchId: null,
        createdAt: now,
      });
    }
  }

  // Todo en una sola transacción IndexedDB: si algo falla, nada queda escrito.
  await batch(['animales', 'eventos', 'explotaciones'], t => {
    for (const e of explotsACrear) t.objectStore('explotaciones').put(e);
    for (const a of animalesRecords) t.objectStore('animales').put(a);
    for (const ev of eventosRecords) t.objectStore('eventos').put(ev);
  });

  resumen.explotacionesCreadas = explotsACrear.length;
  resumen.animales = animalesRecords.length;
  resumen.eventos = eventosRecords.length;
  return resumen;
}
