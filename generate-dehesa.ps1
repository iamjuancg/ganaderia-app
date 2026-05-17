# Generador de datos dummy — Dehesa La Encina
# Produce dehesa-la-encina-backup.json importable desde Ajustes → Restaurar backup JSON

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────
$script:uidCounter = 0
function New-Uid {
    $script:uidCounter++
    $base = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + $script:uidCounter
    $rand = Get-Random -Minimum 100000 -Maximum 999999
    return $base.ToString('x') + $rand.ToString('x')
}

function IsoUtc([int]$y, [int]$m, [int]$d, [int]$h = 9, [int]$mi = 0) {
    [datetime]::new($y, $m, $d, $h, $mi, 0, [System.DateTimeKind]::Utc).ToString('yyyy-MM-ddTHH:mm:ss.000Z')
}

function RandDate([datetime]$start, [datetime]$end) {
    $days = [int]($end - $start).TotalDays
    if ($days -le 0) { $days = 1 }
    $start.AddDays((Get-Random -Minimum 0 -Maximum $days)).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
}

function RandInt([int]$min, [int]$max) { Get-Random -Minimum $min -Maximum ($max + 1) }
function RandFloat([double]$min, [double]$max, [int]$dec = 1) {
    $v = $min + (Get-Random) / [int]::MaxValue * ($max - $min)
    [math]::Round($v, $dec)
}

# ──────────────────────────────────────────────
# CATEGORÍAS
# ──────────────────────────────────────────────
$categorias = @(
    @{ id='sys-pac';             nombre='PAC / Subvenciones';         tipo='ingreso'; sistema=$true  }
    @{ id='sys-venta-animales';  nombre='Venta de animales';          tipo='ingreso'; sistema=$true  }
    @{ id='sys-venta-leche';     nombre='Venta de leche / productos'; tipo='ingreso'; sistema=$true  }
    @{ id='sys-otros-ingresos';  nombre='Otros ingresos';             tipo='ingreso'; sistema=$true  }
    @{ id='sys-pienso';          nombre='Pienso y alimentación';      tipo='gasto';   sistema=$true  }
    @{ id='sys-vet';             nombre='Veterinario y medicamentos';  tipo='gasto';   sistema=$true  }
    @{ id='sys-compra-animales'; nombre='Compra de animales';         tipo='gasto';   sistema=$true  }
    @{ id='sys-maquinaria';      nombre='Maquinaria y mantenimiento'; tipo='gasto';   sistema=$true  }
    @{ id='sys-instalaciones';   nombre='Instalaciones y terrenos';   tipo='gasto';   sistema=$true  }
    @{ id='sys-seguros';         nombre='Seguros';                    tipo='gasto';   sistema=$true  }
    @{ id='sys-combustible';     nombre='Combustible y transporte';   tipo='gasto';   sistema=$true  }
    @{ id='sys-otros-gastos';    nombre='Otros gastos';               tipo='gasto';   sistema=$true  }
    @{ id='cat-salarios';        nombre='Salarios y SS';              tipo='gasto';   sistema=$false }
)

# ──────────────────────────────────────────────
# ANIMALES
# ──────────────────────────────────────────────
$animales  = [System.Collections.Generic.List[hashtable]]::new()
$eventos   = [System.Collections.Generic.List[hashtable]]::new()
$transacciones = [System.Collections.Generic.List[hashtable]]::new()

# Track IDs for cross-references
$reproductora_ids = @()   # IDs de las 140 reproductoras (índice 0-139)

$sementalesNombres = @('Trueno','Furia','Bravo','Rayo','Noble','Fuego','Ibérico','Encinar','Coloso','Javier')

function NewAnimal($crotal, $especie, $sexo, $raza, $status, $fechaNac, $origin, $madreId, $nombre, $notas) {
    $now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    return @{
        id              = New-Uid
        crotal          = $crotal
        especie         = $especie
        sexo            = $sexo
        raza            = $raza
        status          = $status
        nombre          = $nombre
        fechaNacimiento = $fechaNac
        origin          = $origin
        madreId         = $madreId
        notas           = $notas
        currentWeight   = $null
        weightDate      = $null
        createdAt       = $now
        updatedAt       = $now
    }
}

# ── Reproductoras (1-140) ──
$razasR = @{ 1=100; 101=140 }   # Retinta 1-100, Avileña 101-140
for ($i = 1; $i -le 140; $i++) {
    $raza = if ($i -le 100) { 'Retinta' } else { 'Avileña' }
    # Fechas nacimiento repartidas 2019-2023
    $yearNac = 2019 + [int](($i - 1) / 28)   # ~28 por año → 5 años
    if ($yearNac -gt 2023) { $yearNac = 2023 }
    $fechaNac = IsoUtc $yearNac (RandInt 1 12) (RandInt 1 28)
    $orig = if ((RandInt 0 1) -eq 0) { 'nacimiento' } else { 'compra' }
    $crotal = "ES1400123{0:D5}" -f $i
    $a = NewAnimal $crotal 'Bovino' 'hembra' $raza 'activo' $fechaNac $orig $null $null $null
    $animales.Add($a)
    $reproductora_ids += $a.id
}

# ── Novillas nacidas (141-160) — hijas de reproductoras 1-20 ──
for ($i = 141; $i -le 160; $i++) {
    $idx = $i - 141   # 0-19
    $madreId = $reproductora_ids[$idx]
    $yearNac = if ($idx -lt 10) { 2024 } else { 2025 }
    $fechaNac = IsoUtc $yearNac (RandInt 1 12) (RandInt 1 28)
    $crotal = "ES1400123{0:D5}" -f $i
    $a = NewAnimal $crotal 'Bovino' 'hembra' 'Retinta' 'activo' $fechaNac 'nacimiento' $madreId $null $null
    $animales.Add($a)
}

# ── Novillas compradas (161-180) ──
for ($i = 161; $i -le 180; $i++) {
    $fechaNac = IsoUtc 2023 (RandInt 1 12) (RandInt 1 28)
    $crotal = "ES1400123{0:D5}" -f $i
    $a = NewAnimal $crotal 'Bovino' 'hembra' 'Avileña' 'activo' $fechaNac 'compra' $null $null $null
    $animales.Add($a)
}

# ── Sementales (181-190) ──
for ($i = 181; $i -le 190; $i++) {
    $idx = $i - 181
    $raza = if ($idx -lt 6) { 'Retinta' } else { 'Avileña' }
    $yearNac = 2019 + [int]($idx / 3)
    if ($yearNac -gt 2022) { $yearNac = 2022 }
    $fechaNac = IsoUtc $yearNac (RandInt 1 12) (RandInt 1 28)
    $crotal = "ES1400123{0:D5}" -f $i
    $nombre = $sementalesNombres[$idx]
    $a = NewAnimal $crotal 'Bovino' 'macho' $raza 'activo' $fechaNac 'compra' $null $nombre $null
    $animales.Add($a)
}

# ── Terneros activos (191-200) — hijos de reproductoras 21-30 ──
$sexosTerneros = @('hembra','hembra','hembra','hembra','hembra','hembra','macho','macho','macho','macho')
for ($i = 191; $i -le 200; $i++) {
    $idx = $i - 191
    $madreId = $reproductora_ids[20 + $idx]
    $yearNac = if ($idx -lt 5) { 2025 } else { 2026 }
    $month = if ($yearNac -eq 2026) { RandInt 1 4 } else { RandInt 9 12 }
    $day = RandInt 1 28
    # Asegurar que no sea fecha futura (2026 > may)
    if ($yearNac -eq 2026 -and $month -gt 4) { $month = 4 }
    $fechaNac = IsoUtc $yearNac $month $day
    $crotal = "ES1400123{0:D5}" -f $i
    $sexo = $sexosTerneros[$idx]
    $a = NewAnimal $crotal 'Bovino' $sexo 'Retinta' 'activo' $fechaNac 'nacimiento' $madreId $null $null
    $animales.Add($a)
}

# ── Vendidos (201-205) ──
$sexosVendidos = @('macho','macho','macho','hembra','macho')
for ($i = 201; $i -le 205; $i++) {
    $idx = $i - 201
    $madreId = $reproductora_ids[30 + $idx]
    $fechaNac = IsoUtc 2024 (RandInt 1 6) (RandInt 1 28)
    $crotal = "ES1400123{0:D5}" -f $i
    $a = NewAnimal $crotal 'Bovino' $sexosVendidos[$idx] 'Retinta' 'vendido' $fechaNac 'nacimiento' $madreId $null $null
    $animales.Add($a)
}

# ── Muertos (206-208) ──
$muertosData = @(
    @{ sexo='hembra'; raza='Retinta'; yearNac=2024; monNac=10; orig='nacimiento'; madreIdx=35 }
    @{ sexo='hembra'; raza='Avileña'; yearNac=2020; monNac=5;  orig='compra';     madreIdx=$null }
    @{ sexo='macho';  raza='Retinta'; yearNac=2021; monNac=3;  orig='compra';     madreIdx=$null }
)
for ($i = 206; $i -le 208; $i++) {
    $d = $muertosData[$i - 206]
    $madreId = if ($null -ne $d.madreIdx) { $reproductora_ids[$d.madreIdx] } else { $null }
    $fechaNac = IsoUtc $d.yearNac $d.monNac (RandInt 1 28)
    $crotal = "ES1400123{0:D5}" -f $i
    $a = NewAnimal $crotal 'Bovino' $d.sexo $d.raza 'muerto' $fechaNac $d.orig $madreId $null $null
    $animales.Add($a)
}

Write-Host "Animales generados: $($animales.Count)"

# ──────────────────────────────────────────────
# EVENTOS
# ──────────────────────────────────────────────

function NewEvento($animalId, $tipo, $fechaIso, $descripcion, $peso, $importe, $contraparte) {
    $now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    return @{
        id          = New-Uid
        animalId    = $animalId
        tipo        = $tipo
        fecha       = $fechaIso
        descripcion = $descripcion
        peso        = $peso
        importe     = $importe
        contraparte = $contraparte
        createdAt   = $now
    }
}

# ── Eventos de origen (1 por animal) ──
foreach ($a in $animales) {
    $fechaOrigen = $a.fechaNacimiento
    if ($a.origin -eq 'nacimiento') {
        $ev = NewEvento $a.id 'nacimiento' $fechaOrigen 'Nacimiento registrado' $null $null $null
    } else {
        $contrapartes = @('Feria Ganadera de Trujillo','Subasta Badajoz','Ganadería Hermanos Díaz, Cáceres','Subasta Nacional Ganado Selecto')
        $cp = $contrapartes[(RandInt 0 3)]
        # Importe según grupo
        $imp = switch ($a.sexo) {
            'macho'  { RandFloat 1800 2800 2 }
            default  {
                if ($a.raza -eq 'Avileña' -and $a.status -eq 'activo') { RandFloat 1200 1600 2 }
                else { RandFloat 900 1400 2 }
            }
        }
        $ev = NewEvento $a.id 'compra' $fechaOrigen $null $null $imp $cp
    }
    $eventos.Add($ev)
}

# ── Eventos de peso ──
# Función que añade pesajes a un animal y actualiza currentWeight/weightDate
function Add-PesoEvents($animal, $pesoInicial, $pesoFinal, $fechaInicioStr, $numPesajes) {
    $fechaInicio = [datetime]::Parse($fechaInicioStr).ToUniversalTime()
    $fechaLimite = [datetime]::new(2026, 4, 30, 0, 0, 0, [System.DateTimeKind]::Utc)
    if ($fechaInicio -gt $fechaLimite) { $fechaInicio = $fechaLimite.AddDays(-30) }

    $pesoActual = $pesoInicial
    $incremento = if ($numPesajes -gt 1) { ($pesoFinal - $pesoInicial) / ($numPesajes - 1) } else { 0 }
    $intervalo  = [int](($fechaLimite - $fechaInicio).TotalDays / [math]::Max($numPesajes, 1))
    if ($intervalo -lt 1) { $intervalo = 30 }

    $ultimaFecha = $null
    for ($p = 0; $p -lt $numPesajes; $p++) {
        $diasOffset = $intervalo * $p + (RandInt 0 15)
        $fechaPeso  = $fechaInicio.AddDays($diasOffset)
        if ($fechaPeso -gt $fechaLimite) { $fechaPeso = $fechaLimite }
        $pesoEv = [math]::Round($pesoActual + (RandFloat -8 8 1), 1)
        if ($pesoEv -lt 1) { $pesoEv = 1 }
        $fechaIso = $fechaPeso.ToString('yyyy-MM-ddTHH:mm:ss.000Z')
        $ev = NewEvento $animal.id 'peso' $fechaIso $null $pesoEv $null $null
        $eventos.Add($ev)
        $pesoActual += $incremento
        $ultimaFecha = $fechaIso
    }
    if ($ultimaFecha) {
        $animal.currentWeight = [math]::Round($pesoActual - $incremento + (RandFloat -5 5 1), 1)
        $animal.weightDate    = $ultimaFecha
        $animal.updatedAt     = $ultimaFecha
    }
}

# Reproductoras (0-139): estables 400-550, 2-3 pesajes desde 2024
for ($i = 0; $i -lt 140; $i++) {
    $a = $animales[$i]
    $pi = RandFloat 400 490 1
    $pf = RandFloat 480 550 1
    $n  = if ((RandInt 0 2) -lt 2) { 3 } else { 2 }
    Add-PesoEvents $a $pi $pf (IsoUtc 2024 (RandInt 1 3) (RandInt 1 28)) $n
}

# Novillas nacidas (140-159): crecen 250→370
for ($i = 140; $i -lt 160; $i++) {
    $a = $animales[$i]
    $n = if ((RandInt 0 1)) { 3 } else { 2 }
    Add-PesoEvents $a (RandFloat 250 280 1) (RandFloat 340 380 1) $a.fechaNacimiento $n
}

# Novillas compradas (160-179): llegan con 280-310 en 2024
for ($i = 160; $i -lt 180; $i++) {
    $a = $animales[$i]
    Add-PesoEvents $a (RandFloat 280 310 1) (RandFloat 340 360 1) (IsoUtc 2024 (RandInt 2 4) (RandInt 1 28)) 3
}

# Sementales (180-189): estables 560-700
for ($i = 180; $i -lt 190; $i++) {
    $a = $animales[$i]
    $pi = RandFloat 560 650 1
    Add-PesoEvents $a $pi ($pi + (RandFloat 10 50 1)) (IsoUtc 2024 (RandInt 1 6) (RandInt 1 28)) 2
}

# Terneros activos (190-199): 80→200
for ($i = 190; $i -lt 200; $i++) {
    $a = $animales[$i]
    $pi = RandFloat 75 95 1
    $n  = if ((RandInt 0 1)) { 3 } else { 2 }
    Add-PesoEvents $a $pi (RandFloat 140 200 1) $a.fechaNacimiento $n
}

# Vendidos (200-204): peso previo a venta
for ($i = 200; $i -lt 205; $i++) {
    $a = $animales[$i]
    Add-PesoEvents $a (RandFloat 180 220 1) (RandFloat 230 270 1) $a.fechaNacimiento 2
}

# Muertos (205-207): un pesaje antes de morir
for ($i = 205; $i -lt 208; $i++) {
    $a = $animales[$i]
    $pi = if ($a.sexo -eq 'macho') { RandFloat 400 500 1 } else { RandFloat 350 450 1 }
    Add-PesoEvents $a $pi $pi (IsoUtc 2024 (RandInt 1 6) (RandInt 1 28)) 1
}

Write-Host "Eventos peso/origen: $($eventos.Count)"

# ── Campañas de vacunación ──
$campanas = @(
    @{ year=2024; month=3;  dayStart=18; desc='Vacunación IBR/BVD - campaña primavera 2024' }
    @{ year=2024; month=10; dayStart=7;  desc='Vacunación clostridiosis - campaña otoño 2024' }
    @{ year=2025; month=3;  dayStart=24; desc='Vacunación IBR/BVD - campaña primavera 2025' }
    @{ year=2025; month=10; dayStart=6;  desc='Vacunación clostridiosis - campaña otoño 2025' }
)

foreach ($camp in $campanas) {
    $campFecha = [datetime]::new($camp.year, $camp.month, $camp.dayStart, 0, 0, 0, [System.DateTimeKind]::Utc)
    $dayOffset = 0
    # Elegibles: activos en esa fecha (excluye vendidos/muertos con fecha anterior, y terneros < 2 meses)
    for ($i = 0; $i -lt $animales.Count; $i++) {
        $a = $animales[$i]
        # Saltar vendidos y muertos
        if ($a.status -eq 'vendido' -or $a.status -eq 'muerto') { continue }
        # Saltar terneros muy jóvenes
        $nacDate = [datetime]::Parse($a.fechaNacimiento).ToUniversalTime()
        if (($campFecha - $nacDate).TotalDays -lt 60) { continue }

        $dia = $camp.dayStart + ($dayOffset % 5)
        $dayOffset++
        $fechaVac = IsoUtc $camp.year $camp.month $dia
        $ev = NewEvento $a.id 'vacunacion' $fechaVac $camp.desc $null $null $null
        $eventos.Add($ev)
    }
}

Write-Host "Eventos tras vacunación: $($eventos.Count)"

# ── Tratamientos (~35) ──
$tratamientosData = @(
    # Respiratorio nov-dic 2024 (5 reproductoras)
    @{ idx=5;   tipo='tratamiento'; year=2024; mon=11; day=12; desc='Tratamiento antibiótico - complejo respiratorio - Enrofloxacina 5 días' }
    @{ idx=12;  tipo='tratamiento'; year=2024; mon=11; day=13; desc='Tratamiento antibiótico - complejo respiratorio - Enrofloxacina 5 días' }
    @{ idx=23;  tipo='tratamiento'; year=2024; mon=11; day=14; desc='Tratamiento antibiótico - complejo respiratorio - Enrofloxacina 5 días' }
    @{ idx=47;  tipo='tratamiento'; year=2024; mon=12; day=3;  desc='Tratamiento antibiótico - complejo respiratorio - Enrofloxacina 5 días' }
    @{ idx=88;  tipo='tratamiento'; year=2024; mon=12; day=4;  desc='Tratamiento antibiótico - complejo respiratorio - Enrofloxacina 5 días' }
    # Antiparasitario primavera 2024 (novillas y terneros)
    @{ idx=140; tipo='tratamiento'; year=2024; mon=3; day=20; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=141; tipo='tratamiento'; year=2024; mon=3; day=20; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=142; tipo='tratamiento'; year=2024; mon=3; day=20; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=143; tipo='tratamiento'; year=2024; mon=3; day=21; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=144; tipo='tratamiento'; year=2024; mon=3; day=21; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=160; tipo='tratamiento'; year=2024; mon=3; day=21; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=161; tipo='tratamiento'; year=2024; mon=3; day=22; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=162; tipo='tratamiento'; year=2024; mon=3; day=22; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=163; tipo='tratamiento'; year=2024; mon=3; day=22; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=164; tipo='tratamiento'; year=2024; mon=3; day=23; desc='Desparasitación - Doramectina 1% inyectable' }
    # Antiparasitario otoño 2024
    @{ idx=145; tipo='tratamiento'; year=2024; mon=10; day=10; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=146; tipo='tratamiento'; year=2024; mon=10; day=10; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=165; tipo='tratamiento'; year=2024; mon=10; day=11; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=166; tipo='tratamiento'; year=2024; mon=10; day=11; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=167; tipo='tratamiento'; year=2024; mon=10; day=12; desc='Desparasitación - Doramectina 1% inyectable' }
    # Postparto / endometritis 2024
    @{ idx=10;  tipo='tratamiento'; year=2024; mon=4; day=15; desc='Tratamiento intrauterino postparto - endometritis - Oxitetraciclina' }
    @{ idx=31;  tipo='tratamiento'; year=2024; mon=5; day=8;  desc='Tratamiento intrauterino postparto - endometritis - Oxitetraciclina' }
    @{ idx=62;  tipo='tratamiento'; year=2025; mon=3; day=22; desc='Tratamiento intrauterino postparto - endometritis - Oxitetraciclina' }
    # Cojeras
    @{ idx=18;  tipo='tratamiento'; year=2024; mon=7; day=20; desc='Tratamiento cojera - Meloxicam + vendaje podal' }
    @{ idx=55;  tipo='tratamiento'; year=2024; mon=9; day=5;  desc='Tratamiento cojera - Meloxicam + vendaje podal' }
    @{ idx=99;  tipo='tratamiento'; year=2025; mon=6; day=14; desc='Tratamiento cojera - Meloxicam + vendaje podal' }
    # Antiparasitario primavera 2025
    @{ idx=148; tipo='tratamiento'; year=2025; mon=3; day=26; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=149; tipo='tratamiento'; year=2025; mon=3; day=26; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=168; tipo='tratamiento'; year=2025; mon=3; day=27; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=169; tipo='tratamiento'; year=2025; mon=3; day=27; desc='Desparasitación - Doramectina 1% inyectable' }
    @{ idx=170; tipo='tratamiento'; year=2025; mon=3; day=28; desc='Desparasitación - Doramectina 1% inyectable' }
    # Respiratorio 2025
    @{ idx=7;   tipo='tratamiento'; year=2025; mon=11; day=18; desc='Tratamiento antibiótico - complejo respiratorio - Gamithromicina' }
    @{ idx=34;  tipo='tratamiento'; year=2025; mon=11; day=19; desc='Tratamiento antibiótico - complejo respiratorio - Gamithromicina' }
    @{ idx=76;  tipo='tratamiento'; year=2025; mon=12; day=2;  desc='Tratamiento antibiótico - complejo respiratorio - Gamithromicina' }
    # Ternero 2026
    @{ idx=191; tipo='tratamiento'; year=2026; mon=2; day=10; desc='Tratamiento diarrea neonatal - suero electrolítico + antibiótico' }
)

foreach ($t in $tratamientosData) {
    $idx = $t.idx
    # Mapeo de crotal a índice en array (crotal ES1400123xxxxx → i-1)
    # Los índices en $tratamientosData son números de crotal (1-based)
    $animalIdx = $idx - 1
    if ($animalIdx -lt 0 -or $animalIdx -ge $animales.Count) { continue }
    $a = $animales[$animalIdx]
    $fechaEv = IsoUtc $t.year $t.mon $t.day
    $ev = NewEvento $a.id $t.tipo $fechaEv $t.desc $null $null $null
    $eventos.Add($ev)
}

# ── Venta events (animales 201-205, índices 200-204) ──
$ventaFechas   = @('2025-04-15','2025-06-20','2025-07-08','2025-09-03','2025-11-18')
$ventaImportes = @(750, 820, 900, 680, 720)
$ventaContrapartes = @(
    'Matadero Frigorífico Extremadura, Mérida'
    'Matadero Frigorífico Extremadura, Mérida'
    'Tratante ganado Ángel Sánchez'
    'Matadero Frigorífico Extremadura, Mérida'
    'Tratante ganado Ángel Sánchez'
)
for ($i = 0; $i -lt 5; $i++) {
    $a = $animales[200 + $i]
    $fechaIso = [datetime]::Parse($ventaFechas[$i]).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $ev = NewEvento $a.id 'venta' $fechaIso $null $null $ventaImportes[$i] $ventaContrapartes[$i]
    $eventos.Add($ev)
}

# ── Muerte events (animales 206-208, índices 205-207) ──
$muerteData = @(
    @{ fecha='2024-11-15'; desc='Muerte neonatal - asfixia en parto' }
    @{ fecha='2025-02-28'; desc='Muerte por timpanismo agudo' }
    @{ fecha='2025-07-10'; desc='Muerte accidental - traumatismo' }
)
for ($i = 0; $i -lt 3; $i++) {
    $a = $animales[205 + $i]
    $fechaIso = [datetime]::Parse($muerteData[$i].fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $ev = NewEvento $a.id 'muerte' $fechaIso $muerteData[$i].desc $null $null $null
    $eventos.Add($ev)
}

Write-Host "Total eventos: $($eventos.Count)"

# ──────────────────────────────────────────────
# TRANSACCIONES
# ──────────────────────────────────────────────

function NewTx($tipo, $importe, $fechaIso, $categoriaId, $descripcion, $referencia) {
    $now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    return @{
        id          = New-Uid
        tipo        = $tipo
        importe     = $importe
        fecha       = $fechaIso
        categoriaId = $categoriaId
        descripcion = $descripcion
        referencia  = $referencia
        createdAt   = $now
        updatedAt   = $now
    }
}

# ── Recurrentes mensuales: 2024-01 → 2026-04 (28 meses) ──
$mesesNombres = @('enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre')
$combustibleMes = @(310,290,250,220,195,195,190,185,210,240,300,320)  # enero=índice 0

$year = 2024; $month = 1
for ($mes = 0; $mes -lt 28; $mes++) {
    $mesNombre = $mesesNombres[$month - 1]
    $label = "$mesNombre $year"

    # Renta dehesa (día 5)
    $transacciones.Add((NewTx 'gasto' 2800 (IsoUtc $year $month 5) 'sys-instalaciones' "Arrendamiento dehesa La Encina - mensualidad $label" ("RENTA-$year-{0:D2}" -f $month)))

    # Nómina empleado 1 (día 28)
    $transacciones.Add((NewTx 'gasto' 1400 (IsoUtc $year $month 28) 'cat-salarios' "Nómina $label - Pedro Gómez Mateos" ("NOM1-$year-{0:D2}" -f $month)))

    # Nómina empleado 2 (día 28)
    $transacciones.Add((NewTx 'gasto' 1400 (IsoUtc $year $month 28) 'cat-salarios' "Nómina $label - Antonio Ramos Bernal" ("NOM2-$year-{0:D2}" -f $month)))

    # Seguridad Social (día 30 o último del mes)
    $diaUltimo = [datetime]::DaysInMonth($year, $month)
    $diaSS = [math]::Min(30, $diaUltimo)
    $transacciones.Add((NewTx 'gasto' 900 (IsoUtc $year $month $diaSS) 'cat-salarios' "Seguridad Social empleados - $label" ("TC1-$year-{0:D2}" -f $month)))

    # Combustible (día 10)
    $combImporte = $combustibleMes[$month - 1]
    $transacciones.Add((NewTx 'gasto' $combImporte (IsoUtc $year $month 10) 'sys-combustible' "Combustible tractor y vehículo - $label" $null))

    # Avanzar mes
    $month++
    if ($month -gt 12) { $month = 1; $year++ }
}

# ── PAC base ──
$pacBase = @(
    @{ fecha='2024-06-15'; imp=22000; ref='PAC-2024-BASE-01'; desc='PAC 2024 - Pago base único' }
    @{ fecha='2024-12-05'; imp=22000; ref='PAC-2024-BASE-02'; desc='PAC 2024 - Complemento redistributivo' }
    @{ fecha='2025-06-12'; imp=22000; ref='PAC-2025-BASE-01'; desc='PAC 2025 - Pago base único' }
    @{ fecha='2025-12-03'; imp=22000; ref='PAC-2025-BASE-02'; desc='PAC 2025 - Complemento redistributivo' }
)
foreach ($p in $pacBase) {
    $f = [datetime]::Parse($p.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'ingreso' $p.imp $f 'sys-pac' $p.desc $p.ref))
}

# ── PAC eco-régimen ──
$transacciones.Add((NewTx 'ingreso' 8000 (IsoUtc 2024 9 20) 'sys-pac' 'PAC 2024 - Eco-Régimen - Pastoreo extensivo' 'PAC-2024-ECO'))
$transacciones.Add((NewTx 'ingreso' 8000 (IsoUtc 2025 9 18) 'sys-pac' 'PAC 2025 - Eco-Régimen - Pastoreo extensivo' 'PAC-2025-ECO'))

# ── Venta terneros ──
$ventaTerneros = @(
    @{ fecha='2024-06-10'; imp=720; ref='FAC-MFE-240610'; desc='Venta ternero ES140012300203 - Matadero Frigorifico Extremadura' }
    @{ fecha='2024-08-22'; imp=810; ref='FAC-MFE-240822'; desc='Venta ternero ES140012300204 - Matadero Frigorifico Extremadura' }
    @{ fecha='2024-10-30'; imp=680; ref='FAC-MFE-241030'; desc='Venta ternero ES140012300205 - Tratante Ángel Sánchez' }
    @{ fecha='2025-04-15'; imp=750; ref='FAC-MFE-250415'; desc='Venta ternero ES140012300201 - Matadero Frigorifico Extremadura' }
    @{ fecha='2025-06-20'; imp=820; ref='FAC-MFE-250620'; desc='Venta ternero ES140012300202 - Matadero Frigorifico Extremadura' }
    @{ fecha='2025-07-08'; imp=900; ref='FAC-TAS-250708'; desc='Venta ternero - Tratante Ángel Sánchez' }
    @{ fecha='2025-09-03'; imp=680; ref='FAC-MFE-250903'; desc='Venta ternero - Matadero Frigorifico Extremadura' }
    @{ fecha='2025-11-18'; imp=720; ref='FAC-TAS-251118'; desc='Venta ternero - Tratante Ángel Sánchez' }
)
foreach ($v in $ventaTerneros) {
    $f = [datetime]::Parse($v.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'ingreso' $v.imp $f 'sys-venta-animales' $v.desc $v.ref))
}

# ── Venta vacas desvieje ──
$ventaDesvieje = @(
    @{ fecha='2024-03-12'; imp=950;  ref='FAC-TAS-240312'; desc='Venta vaca desvieje ES140012300045 - Tratante Ángel Sánchez' }
    @{ fecha='2024-11-07'; imp=1100; ref='FAC-TAS-241107'; desc='Venta vaca desvieje ES140012300078 - Tratante Ángel Sánchez' }
    @{ fecha='2025-03-18'; imp=880;  ref='FAC-TAS-250318'; desc='Venta vaca desvieje ES140012300102 - Tratante Ángel Sánchez' }
    @{ fecha='2025-10-22'; imp=1050; ref='FAC-TAS-251022'; desc='Venta vaca desvieje ES140012300133 - Tratante Ángel Sánchez' }
)
foreach ($v in $ventaDesvieje) {
    $f = [datetime]::Parse($v.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'ingreso' $v.imp $f 'sys-venta-animales' $v.desc $v.ref))
}

# ── Pienso ──
$piensoData = @(
    @{ fecha='2024-11-04'; imp=2800; desc='Pienso cebada y maíz - 4.000 kg - Agrosuministros Badajoz'; ref='AGR-2411-001' }
    @{ fecha='2024-12-10'; imp=1900; desc='Heno de pradera - 3 pacas grandes - Forrajes Extremadura'; ref='FOR-2412-001' }
    @{ fecha='2025-01-15'; imp=3200; desc='Pienso compuesto reproductoras - 5.000 kg - Agrosuministros Badajoz'; ref='AGR-2501-001' }
    @{ fecha='2025-02-18'; imp=2400; desc='Heno de alfalfa y cebada - Forrajes Extremadura'; ref='FOR-2502-001' }
    @{ fecha='2025-11-06'; imp=2900; desc='Pienso cebada y maíz - 4.500 kg - Agrosuministros Badajoz'; ref='AGR-2511-001' }
    @{ fecha='2025-12-09'; imp=1700; desc='Heno de pradera - 2 pacas grandes - Forrajes Extremadura'; ref='FOR-2512-001' }
    @{ fecha='2026-01-20'; imp=3100; desc='Pienso compuesto reproductoras - 5.000 kg - Agrosuministros Badajoz'; ref='AGR-2601-001' }
    @{ fecha='2026-02-14'; imp=2200; desc='Heno de alfalfa - Forrajes Extremadura'; ref='FOR-2602-001' }
)
foreach ($p in $piensoData) {
    $f = [datetime]::Parse($p.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'gasto' $p.imp $f 'sys-pienso' $p.desc $p.ref))
}

# ── Veterinario visitas ──
$vetData = @(
    @{ fecha='2024-01-22'; imp=320; desc='Visita veterinaria rebaño - revisión reproductoras - Dr. Carlos Fernández'; ref='VET-2401-001' }
    @{ fecha='2024-02-14'; imp=480; desc='Asistencia parto distócico - Dr. Carlos Fernández'; ref='VET-2402-001' }
    @{ fecha='2024-04-08'; imp=560; desc='Revisión ginecológica reproductoras - diagnóstico gestación ecografía'; ref='VET-2404-001' }
    @{ fecha='2024-05-20'; imp=280; desc='Visita veterinaria rebaño - control sanitario'; ref='VET-2405-001' }
    @{ fecha='2024-07-15'; imp=200; desc='Visita veterinaria rebaño - control verano'; ref='VET-2407-001' }
    @{ fecha='2024-09-10'; imp=410; desc='Revisión ginecológica reproductoras - diagnóstico gestación'; ref='VET-2409-001' }
    @{ fecha='2024-11-12'; imp=680; desc='Visita veterinaria - tratamiento complejo respiratorio 5 animales'; ref='VET-2411-001' }
    @{ fecha='2024-12-03'; imp=350; desc='Visita veterinaria rebaño - control final año'; ref='VET-2412-001' }
    @{ fecha='2025-01-20'; imp=290; desc='Visita veterinaria rebaño - revisión reproductoras gestantes'; ref='VET-2501-001' }
    @{ fecha='2025-02-28'; imp=520; desc='Asistencia parto distócico y necropsia animal 207'; ref='VET-2502-001' }
    @{ fecha='2025-04-14'; imp=450; desc='Revisión ginecológica reproductoras - diagnóstico gestación ecografía'; ref='VET-2504-001' }
    @{ fecha='2025-06-16'; imp=230; desc='Visita veterinaria rebaño - control sanitario primavera'; ref='VET-2506-001' }
    @{ fecha='2025-08-05'; imp=200; desc='Visita veterinaria rebaño - control verano'; ref='VET-2508-001' }
    @{ fecha='2025-09-22'; imp=380; desc='Revisión reproductoras - saneamiento oficial TB y brucelosis'; ref='VET-2509-001' }
    @{ fecha='2025-11-18'; imp=750; desc='Visita veterinaria - tratamiento complejo respiratorio 3 animales'; ref='VET-2511-001' }
    @{ fecha='2025-12-10'; imp=310; desc='Visita veterinaria rebaño - control fin de año'; ref='VET-2512-001' }
    @{ fecha='2026-01-28'; imp=340; desc='Revisión reproductoras gestantes - control partos'; ref='VET-2601-001' }
    @{ fecha='2026-02-10'; imp=420; desc='Asistencia partos y tratamiento ternero diarrea'; ref='VET-2602-001' }
    @{ fecha='2026-03-18'; imp=260; desc='Revisión ginecológica reproductoras'; ref='VET-2603-001' }
    @{ fecha='2026-04-08'; imp=310; desc='Saneamiento oficial TB y brucelosis'; ref='VET-2604-001' }
)
foreach ($v in $vetData) {
    $f = [datetime]::Parse($v.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'gasto' $v.imp $f 'sys-vet' $v.desc $v.ref))
}

# ── Vacunas colectivas (transacción económica) ──
$vacunasCol = @(
    @{ fecha='2024-03-18'; imp=1200; desc='Vacunación colectiva IBR/BVD - campaña primavera 2024 - 185 dosis'; ref='VAC-2024-PRI' }
    @{ fecha='2024-10-07'; imp=850;  desc='Vacunación colectiva clostridiosis - campaña otoño 2024 - 185 dosis'; ref='VAC-2024-OTO' }
    @{ fecha='2025-03-24'; imp=1350; desc='Vacunación colectiva IBR/BVD - campaña primavera 2025 - 190 dosis'; ref='VAC-2025-PRI' }
    @{ fecha='2025-10-06'; imp=900;  desc='Vacunación colectiva clostridiosis - campaña otoño 2025 - 190 dosis'; ref='VAC-2025-OTO' }
    @{ fecha='2026-02-20'; imp=600;  desc='Vacunación BVD reproductoras gestantes - 40 dosis'; ref='VAC-2026-FEB' }
)
foreach ($v in $vacunasCol) {
    $f = [datetime]::Parse($v.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'gasto' $v.imp $f 'sys-vet' $v.desc $v.ref))
}

# ── Seguros explotación ──
$segurosExp = @(
    @{ fecha='2024-01-15'; ref='POL-AGR-2024-S1'; desc='Seguro RC explotación - 1er semestre 2024' }
    @{ fecha='2024-07-15'; ref='POL-AGR-2024-S2'; desc='Seguro RC explotación - 2o semestre 2024' }
    @{ fecha='2025-01-15'; ref='POL-AGR-2025-S1'; desc='Seguro RC explotación - 1er semestre 2025' }
    @{ fecha='2025-07-15'; ref='POL-AGR-2025-S2'; desc='Seguro RC explotación - 2o semestre 2025' }
    @{ fecha='2026-01-15'; ref='POL-AGR-2026-S1'; desc='Seguro RC explotación - 1er semestre 2026' }
)
foreach ($s in $segurosExp) {
    $f = [datetime]::Parse($s.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'gasto' 900 $f 'sys-seguros' $s.desc $s.ref))
}

# ── Seguro vehículo ──
$transacciones.Add((NewTx 'gasto' 420 (IsoUtc 2024 2 1) 'sys-seguros' 'Seguro furgoneta Renault Kangoo - anual 2024' 'POL-VEH-2024'))
$transacciones.Add((NewTx 'gasto' 420 (IsoUtc 2025 2 1) 'sys-seguros' 'Seguro furgoneta Renault Kangoo - anual 2025' 'POL-VEH-2025'))
$transacciones.Add((NewTx 'gasto' 420 (IsoUtc 2026 2 1) 'sys-seguros' 'Seguro furgoneta Renault Kangoo - anual 2026' 'POL-VEH-2026'))

# ── ITV vehículo ──
$transacciones.Add((NewTx 'gasto' 80 (IsoUtc 2024 7 3) 'sys-combustible' 'ITV furgoneta Renault Kangoo' 'ITV-2024'))
$transacciones.Add((NewTx 'gasto' 80 (IsoUtc 2025 7 2) 'sys-combustible' 'ITV furgoneta Renault Kangoo' 'ITV-2025'))

# ── Mantenimiento tractor ──
$tractorData = @(
    @{ fecha='2024-04-08'; imp=480; desc='Revisión tractor John Deere 5090R - cambio aceite y filtros'; ref='TRAC-2404-001' }
    @{ fecha='2024-09-22'; imp=750; desc='Reparación sistema hidráulico tractor John Deere'; ref='TRAC-2409-001' }
    @{ fecha='2025-03-10'; imp=320; desc='Cambio neumático tractor trasero'; ref='TRAC-2503-001' }
    @{ fecha='2025-07-14'; imp=900; desc='Reparación caja de cambios tractor John Deere 5090R'; ref='TRAC-2507-001' }
    @{ fecha='2025-11-25'; imp=410; desc='Revisión anual tractor - filtros, aceites y correas'; ref='TRAC-2511-001' }
    @{ fecha='2026-03-05'; imp=560; desc='Revisión tractor - cambio aceite y filtros'; ref='TRAC-2603-001' }
)
foreach ($t in $tractorData) {
    $f = [datetime]::Parse($t.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'gasto' $t.imp $f 'sys-maquinaria' $t.desc $t.ref))
}

# ── Compra novillas 2024 ──
$transacciones.Add((NewTx 'gasto' 13800 (IsoUtc 2024 2 20) 'sys-compra-animales' 'Compra 10 novillas Retinta - Feria Ganadera Trujillo' 'COMP-NOV-240220'))
$transacciones.Add((NewTx 'gasto' 14200 (IsoUtc 2024 4 15) 'sys-compra-animales' 'Compra 10 novillas Avileña - Subasta Badajoz' 'COMP-NOV-240415'))

# ── Reparaciones instalaciones ──
$repData = @(
    @{ fecha='2024-05-12'; imp=350; desc='Reparación valla perimetral - 200m alambre de espino'; ref='REP-2405-001' }
    @{ fecha='2024-08-30'; imp=280; desc='Reparación manga de manejo - bisagras y puertas'; ref='REP-2408-001' }
    @{ fecha='2025-04-07'; imp=520; desc='Reparación cubierta nave ganadera - chapas'; ref='REP-2504-001' }
    @{ fecha='2025-09-18'; imp=200; desc='Fontanería bebederos automáticos - reparación fugas'; ref='REP-2509-001' }
    @{ fecha='2026-02-25'; imp=430; desc='Reparación corrales - postes y tablones'; ref='REP-2602-001' }
    @{ fecha='2026-04-10'; imp=310; desc='Pintura y mantenimiento general nave ganadera'; ref='REP-2604-001' }
)
foreach ($r in $repData) {
    $f = [datetime]::Parse($r.fecha).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    $transacciones.Add((NewTx 'gasto' $r.imp $f 'sys-instalaciones' $r.desc $r.ref))
}

Write-Host "Total transacciones: $($transacciones.Count)"

# ──────────────────────────────────────────────
# ENSAMBLAR Y EXPORTAR
# ──────────────────────────────────────────────
$backup = [ordered]@{
    animales      = $animales.ToArray()
    eventos       = $eventos.ToArray()
    transacciones = $transacciones.ToArray()
    categorias    = $categorias
    exportedAt    = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')
}

$outPath = Join-Path $PSScriptRoot 'dehesa-la-encina-backup.json'
$json = $backup | ConvertTo-Json -Depth 5
# Asegurar UTF-8 sin BOM
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "========================================="
Write-Host "  Backup generado: dehesa-la-encina-backup.json"
Write-Host "  Animales:      $($animales.Count)"
Write-Host "  Eventos:       $($eventos.Count)"
Write-Host "  Transacciones: $($transacciones.Count)"
Write-Host "  Categorias:    $($categorias.Count)"
Write-Host "========================================="
Write-Host ""
Write-Host "IMPORTANTE: Tras importar en la app, ve a"
Write-Host "Ajustes → Mi explotación y escribe: Dehesa La Encina"
