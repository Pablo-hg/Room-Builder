# Rendimiento de los acabados (#39) — medición del 18/11/2026

> Estado: **MEDIDO** sobre la build de producción del árbol de trabajo (commit `304c31e` + cambios sin commit de #39). No es validación visual humana. No se ha modificado código de la aplicación.

## Resumen

1. **Con GPU real (GTX 1060) la escena es fluida en este equipo:** 59,8 fps en órbita a 60 Hz, 0 fotogramas >50 ms en 9 de 9 repeticiones (mediana 16,7 ms por fotograma, p95 16,7 ms).
2. **Con render por CPU (SwiftShader, simula un portátil sin gráfica) NO es fluida:** ≈20 fps en órbita, mediana 50 ms por fotograma y 86 fotogramas >50 ms por órbita con acabados (46 sin ellos). Este resultado es del renderizador de software de Chromium en un Ryzen 5 3600; un portátil real sin GPU dedicada (iGPU) probablemente quede entre ambos casos, **sin medir**.
3. **Coste de los materiales con GPU:** no detectable (fps, ms por fotograma y llamadas de dibujo idénticos con y sin acabados, dentro del ruido). Sí se aprecia ≈+60–80 ms en la carga inicial (hipótesis: generación de texturas procedurales).
4. **Coste con CPU:** medible y consistente en las 3 repeticiones: ≈−10 % de fps (19,8 vs 22,2), +40 fotogramas lentos por órbita, +≈240 ms de carga, +≈55 ms en cambio de vista.
5. Las llamadas de dibujo por render son las mismas con y sin acabados (74,3): los materiales no añaden dibujos, el coste CPU viene del sombreado/texturas.

## Entorno

| Dato | Valor |
|---|---|
| Commit | `304c31e` (rama `feature/f3-01-materiales`) con cambios locales sin commit: `docs/progress/F3_PROGRESS.md`, `FurnitureObject.tsx`, `RoomShell.tsx`, `StructureSurface.tsx`, `materialTexture.ts`; sin seguimiento: `worldUv.ts`, tests y el script/config de perf |
| Node / npm | v22.21.0 / 10.9.4 |
| Playwright / Chromium | 1.55.1 / Chromium 140.0.7339.186 (el de Playwright, `chromium-1193`) |
| SO | Windows 11 Pro 10.0.26200 |
| CPU / RAM | AMD Ryzen 5 3600 (6 núcleos, 12 hilos) / 15,9 GB |
| GPU | NVIDIA GeForce GTX 1060 6 GB, controlador 32.0.15.8180 |
| Pantalla | 2 × 2560×1440, principal a 179 Hz, DPI 96 (escala 100 %). Viewport de la prueba: 1280×720 |
| Energía | Sobremesa, sin batería; plan «AMD Ryzen Balanced» |
| Build | `npm run build` correcto |

**Tamaños de la build** (el aviso de chunk >500 kB ya existe):

| Archivo | Sin comprimir | gzip |
|---|---|---|
| `index-DVN7CRQq.js` | 1.710,79 kB | 485,99 kB |
| `index-Qz0zokAJ.css` | 70,57 kB | 13,48 kB |
| `index.html` | 0,55 kB | 0,34 kB |

## Método

- Script: `scripts/playwright-profile/materials-perf.spec.ts`, configuración `playwright.perf.config.ts` (build de producción servida con `vite preview`). Diseño `tests/fixtures/materials/casa-muestrario-materiales.json` con acabados («con») y el mismo sin `material`/`floorMaterial`/`wallMaterials` («sin»), 3 repeticiones intercaladas por ejecución, 1280×720.
- Se midieron **7 ejecuciones** (21 pares con/sin). Datos crudos en `docs/progress/perf/raw/`:
  - **CPU (SwiftShader)** — runs 1, 6, 7: config por defecto del repositorio, headless. Renderizador: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)…`. Es lo que representa «portátil sin gráfica».
  - **GPU real, headless** — runs 2, 3, 4: copia local de la config con `--use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu-rasterization --enable-gpu` (`playwright.perf.gpu.local.config.ts.txt`). Renderizador: `ANGLE (NVIDIA GeForce GTX 1060 … Direct3D11)`. Verificado en el campo `renderer`.
  - **GPU real, con ventana** (`--headed`) — run 5 (una sola ejecución).
- Cada cifra de las tablas es la **mediana de todas las repeticiones del grupo** (9 por variante en CPU y GPU headless; 3 en headed) y entre corchetes el **rango mínimo–máximo**.
- No se ejecutó ninguna otra suite. No se hizo commit, push ni PR.

## Resultados

### CPU — SwiftShader (n = 9 por variante)

| Métrica | Con acabados | Sin acabados |
|---|---|---|
| Carga hasta editor usable (ms) | 1.419 [1.379–1.624] | 1.171 [1.145–1.229] |
| Heap JS (MB) | 61,7 [32,1–74,0] | 30,6 [30,3–72,2] |
| fps en reposo | 18,8 [18–19] | 21,5 [19–21,7] |
| fps en órbita | 19,8 [19–19,9] | 22,2 [20,1–22,4] |
| Mediana por fotograma en órbita (ms) | 50,0 [50–50] | 50,0 [50–50] |
| p95 por fotograma (ms) | 66,7 [66,7–66,7] | 50,1 [50,1–66,7] |
| Máximo por fotograma (ms) | 100,0 [83,3–100,1] | 83,4 [83,3–100] |
| Fotogramas >50 ms por órbita | 86 [77–107] | 46 [27–77] |
| Llamadas de dibujo por render | 74,3 [74,2–74,4] | 74,3 [74,2–74,4] |
| Cambio de vista, mediana (ms) | 661 [632–666] | 605 [584–642] |

### GPU real — GTX 1060, headless (n = 9 por variante)

| Métrica | Con acabados | Sin acabados |
|---|---|---|
| Carga hasta editor usable (ms) | 840 [804–1.820] | 769 [754–787] |
| Heap JS (MB) | 39,5 [21,7–46,1] | 44,4 [27,0–45,5] |
| fps en reposo | 60,0 [60–60] | 60,0 [60–60] |
| fps en órbita | 59,8 [59,6–59,8] | 59,8 [59,8–60,0] |
| Mediana por fotograma en órbita (ms) | 16,7 [16,7–16,7] | 16,7 [16,7–16,7] |
| p95 por fotograma (ms) | 16,7 [16,7–16,8] | 16,7 [16,7–16,8] |
| Máximo por fotograma (ms) | 33,3 [33,2–50,0] | 33,3 [16,8–33,4] |
| Fotogramas >50 ms por órbita | 0 [0–0] | 0 [0–0] |
| Llamadas de dibujo por render | 74,3 [74,3–74,4] | 74,3 [74,2–74,4] |
| Cambio de vista, mediana (ms) | 143 [125–156] | 132 [116–148] |

### GPU real — con ventana (n = 3 por variante, una sola ejecución)

| Métrica | Con | Sin |
|---|---|---|
| fps en reposo / órbita | 178,9 / 174,6 | 179,9 / 175,2 |
| Mediana / p95 por fotograma (ms) | 5,6 / 5,7 | 5,6 / 5,7 |
| Fotogramas >50 ms (máx. de las 3) | 2 | 0 |
| Carga (ms) | 1.014 [980–2.161] | 880 [868–958] |
| Cambio de vista (ms) | 139 [137–175] | 145 [133–150] |

En modo con ventana el navegador se sincroniza con la pantalla a 179 Hz, por eso los fps son ≈3 veces los de headless (60 Hz). No es una diferencia de la aplicación.

## Interpretación

**Atribuible a los materiales (dato medido, comparación dentro de la misma ejecución):**

- *CPU:* los tres ficheros muestran el mismo signo y magnitud parecida: fps en órbita 19,9/19,8/19,5 con acabados frente a 22,2/22,2/22,0 sin ellos; fotogramas >50 ms 82/88/101 frente a 46/41/54; carga +234/+248/+291 ms; cambio de vista +56/+46/+35 ms. Los rangos de «con» y «sin» apenas se solapan en fps y fotogramas lentos, así que **no es ruido**. Coste ≈ −10 % de fps con render por CPU.
- *GPU:* fps, ms por fotograma y fotogramas lentos son idénticos con y sin acabados. Carga +≈60–80 ms en la mediana, con signo constante en las 3 ejecuciones headless (905/763, 826/769, 840/778), pero con una carga atípica de 1.820 ms en «con» que infla el rango: **efecto pequeño, probablemente real; el valor atípico es ruido**.

**Ruido o no atribuible:**

- **Heap:** con CPU «con» da 47,9/61,7/73,9 MB y «sin» 30,6 en todas; con GPU «con» da 46/39,4/39,5 y «sin» 36,1/44,8/44,6 (signo contrario). Depende del momento del recolector de basura; **no se saca conclusión** salvo que con CPU el heap «con» es sistemáticamente mayor, coherente con texturas procedurales en JS (hipótesis, sin perfilar).
- **Cambio de vista con GPU:** diferencias de ±10 ms con rangos solapados (125–156 vs 116–148): ruido.
- **Máximo por fotograma y fotogramas >50 ms en headed:** 2 fotogramas lentos en una sola repetición; sin réplica no se interpreta.
- **Llamadas de dibujo por render (74,3):** idénticas con y sin acabados; no hay coste de dibujos por materiales.
- **Ventana de reposo a 60/179 fps:** la escena se redibuja de forma continua en reposo (los contadores dan ≈3 «clear» por fotograma). Es un dato medido; si es intencionado o mejorable no se ha investigado.

**Hipótesis (no medidas):** el sobrecoste con CPU vendría del muestreo de texturas y del tamaño de las texturas procedurales en el sombreador por software; con GPU queda absorbido. No se ha perfilado `materialTexture.ts` ni el coste de generación.

## Limitaciones

- SwiftShader es un rasterizador por software en un Ryzen de 6 núcleos de sobremesa: **sirve para comparar variantes, no para predecir los fps de un portátil concreto**. Una iGPU real (Intel/AMD) no se ha medido.
- La GPU usada (GTX 1060) es de gama media-baja de sobremesa, no representa móviles ni portátiles.
- Resolución única (1280×720), una sola escena (6 habitaciones, 23 muebles, 30 superficies con acabado), un solo recorrido de órbita de ≈2 s con ratón sintético.
- En headless los fps se limitan a 60 Hz y los fotogramas se cuantizan a múltiplos de 16,7 ms, lo que oculta diferencias pequeñas en GPU. La medición en modo con ventana (179 Hz) solo se hizo una vez.
- El heap depende del recolector de basura; el medido es una instantánea al final de cada repetición.
- El equipo pasó por SwiftShader en algunas ejecuciones y GPU en otras, con la máquina en uso normal; no se controlaron procesos en segundo plano.
- No hay análisis de memoria de GPU, de coste de creación/destrucción de texturas ni de escenas mayores.

## Recomendaciones (sin aplicar), por impacto/esfuerzo

1. **Medir en un portátil real sin GPU dedicada** (iGPU) con este mismo script antes de decidir nada. Esfuerzo bajo, evita optimizar a ciegas.
2. **Revisar por qué la escena se redibuja a ritmo continuo en reposo** (≈19 fps con CPU, 60 con GPU, sin interacción): pasar a renderizado bajo demanda (`frameloop="demand"`) reduciría mucho el consumo en portátiles. Impacto alto en CPU/batería; esfuerzo medio. Es un cambio de arquitectura de render: proponerlo y registrarlo antes.
3. **Perfilar `materialTexture.ts`** (resolución de textura, caché y reutilización entre superficies) para recortar el +240 ms de carga y el ≈−10 % de fps con CPU. Impacto medio; esfuerzo medio.
4. **Ofrecer un modo de calidad baja** (texturas más pequeñas o acabados planos) cuando el renderizador sea de software o fps bajos. Impacto medio en equipos débiles; esfuerzo medio-alto; es decisión de producto.
5. **Dividir el JS** (1.711 kB / 486 kB gzip en un solo chunk) con importación dinámica. Mejora la carga inicial, no los fps; esfuerzo bajo-medio.
6. **Ampliar la prueba**: más escenas, 1920×1080, varias GPU y ventana de órbita más larga. Esfuerzo bajo.

## Lo que NO se ha podido comprobar

- Fps reales en un portátil con iGPU o en móvil/tabla.
- Rendimiento en otros navegadores (Firefox, Safari) ni en Chrome instalado (se usó el Chromium de Playwright).
- Resoluciones distintas de 1280×720 o escala de pantalla distinta de 100 %.
- Coste de memoria de GPU y de texturas, y fugas tras muchos cambios de acabado.
- Causa de las ≈3 limpiezas de búfer por fotograma y del redibujado continuo en reposo.
- Si el +240 ms de carga con CPU se debe a la generación de texturas (hipótesis sin perfilado).
- Percepción visual de fluidez por una persona (no es validación visual humana).
- Escenas de mayor tamaño que el muestrario.
- Estabilidad con la batería o con el plan de energía de un portátil (equipo de sobremesa sin batería).
