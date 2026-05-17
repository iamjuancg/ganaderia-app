# GanaderíaApp

PWA de gestión ganadera offline-first. Sin frameworks, sin dependencias externas, sin paso de build.

## Características

- **Animales** — CRUD completo con crotal, especie, raza, sexo, peso y estado (activo / vendido / muerto)
- **Eventos** — registro de nacimientos, compras, ventas, muertes, pesajes, vacunaciones y tratamientos
- **Finanzas** — ingresos y gastos con categorías, filtros por año/categoría y resumen anual
- **Informes** — P&L anual, gráfica de pastel por categoría de gasto, inventario del rebaño
- **Dashboard** — KPIs por especie, balance del año, gráfica de barras (últimos 6 meses) y eventos recientes
- **Ajustes** — nombre de explotación, categorías personalizadas, backup y restauración
- **PWA** — Service Worker cache-first, instalable, funciona sin conexión

## Stack

| Capa | Tecnología |
|---|---|
| Interfaz | HTML + CSS vanilla, ES Modules |
| Datos | IndexedDB (sin ORM) |
| Offline | Service Worker (cache-first) |
| Runtime | Navegador — sin Node.js, sin bundler |

## Arrancar en local

```powershell
# Desde la raíz del proyecto
Start-Process powershell -ArgumentList "-NoProfile -NonInteractive -File `"$env:TEMP\ganaderia_server.ps1`"" -WindowStyle Hidden
```

Si es la primera vez o el script no existe, lanza un servidor HttpListener en el puerto 8080:

```powershell
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()
# ... ver generate-dehesa.ps1 para el script completo de servidor
```

Abre `http://localhost:8080` en el navegador.

> La app requiere ser servida por HTTP (no `file://`) para que funcionen ES Modules y el Service Worker.

## Estructura

```
ganaderia-app/
├── index.html
├── manifest.json
├── sw.js                        # Service Worker
├── offline.html
├── css/
│   └── main.css
├── js/
│   ├── app.js                   # Router hash + init
│   ├── db/
│   │   ├── database.js          # Wrapper IndexedDB
│   │   └── seed.js              # Categorías de sistema por defecto
│   ├── utils/
│   │   ├── format.js            # formatEur, escapeHtml, TIPOS_EVENTO…
│   │   ├── date.js              # formatDate, todayISO, currentYear…
│   │   ├── modal.js             # openModal()
│   │   ├── toast.js             # showToast()
│   │   └── appstate.js          # Nombre de explotación en sidebar
│   └── views/
│       ├── dashboard.js
│       ├── animales.js
│       ├── eventos.js
│       ├── finanzas.js
│       ├── informes.js
│       └── ajustes.js
└── icons/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```

## Datos de demo

El fichero `generate-dehesa.ps1` genera `dehesa-la-encina-backup.json` con datos realistas de una explotación bovina extensiva en Extremadura (~200 cabezas, 1.500 eventos, 215 transacciones).

```powershell
cd ganaderia-app
powershell -File generate-dehesa.ps1
```

Importar desde **Ajustes → Restaurar backup JSON** y seleccionar `dehesa-la-encina-backup.json`.  
Después, ir a **Ajustes → Mi explotación** y escribir "Dehesa La Encina".

## Añadir nuevas vistas

1. Crear `js/views/mi-vista.js` que exporte `renderMiVista(container)`
2. Importarla en `js/app.js` y añadirla al objeto `VIEWS`
3. Añadir el enlace en `index.html` (sidebar + bottom nav)
4. Los datos se leen/escriben mediante `getAll`, `get`, `put`, `remove` de `js/db/database.js`

## Backup y restauración

- **Exportar** — Ajustes → Exportar JSON / CSV animales / CSV transacciones
- **Importar** — Ajustes → Restaurar backup JSON (reemplaza todos los datos)
- El store `ajustes` (nombre de explotación, categorías) no se incluye en el backup JSON; configurarlo manualmente tras restaurar
