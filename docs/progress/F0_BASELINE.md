# F0 — baseline de certificación R5 (#24)

**Estado de esta entrada:** inventario inicial y procedimiento para certificar `main`. Las ejecuciones de la rama anteriores al cambio de política no sustituyen la certificación final sobre `main`. La evidencia de aceptación debe proceder del commit integrado en `main` y de su ejecución completa de CI. No modificar las entradas históricas de [R5_PROGRESS.md](R5_PROGRESS.md).

## Punto de partida (07/11/2026)

- Repositorio: `Pablo-hg/Room-Builder`.
- Rama y SHA de partida: `main` — `938e5b18edee26c1252a26ca038db0fd26a3f356`.
- Gestor de paquetes: npm, lockfile v3 (`package-lock.json`); la instalación de CI se realiza con Node 22 y `npm ci`. Registrar las versiones efectivas de Node/npm en cada ejecución.
- Playwright: `@playwright/test@1.55.1` declarada como dependencia de desarrollo, navegador Chromium instalado mediante `npx playwright install --with-deps chromium`. Registrar la versión efectiva de Playwright y el navegador en el reporte.
- Scripts disponibles: `npm test` (tests unitarios con `tsx --test`), `npm run build` (TypeScript + Vite), `npm run test:e2e` (Playwright funcional).
- `playwright.config.ts` descubre **únicamente `tests/`**. Las suites `scripts/playwright/` (capturas históricas R0), `scripts/playwright-catalog/` (catálogo) y `scripts/playwright-profile/` (rendimiento) tienen configuraciones propias. Su exclusión del comando funcional no supone que se hayan ejecutado, ni permite omitir casos funcionales de `tests/`.
- Fixtures bajo control de versiones: `tests/fixtures/persistence-v1/` y `tests/fixtures/persisted-designs/` (incluye v2–v5). Las capturas R0 históricas en `output/playwright/r0-baseline/` no son resultados de esta certificación.
- Histórico: R5 documentó 213 unitarias aprobadas y build aprobado con aviso Vite por chunk de 1.447,19 kB; en la última pasada E2E completa se registraron 84 aprobadas y 35 fallidas, con reparaciones y pruebas dirigidas posteriores. **Ninguno de estos números es resultado de la nueva certificación.**

## Reproducción desde una instalación limpia

Procedimiento de referencia para la ejecución de CI después de integrar la rama en `main`, con Node 22 y npm disponibles (no ejecutar en ramas adicionales ni en `dev`):

```bash
git rev-parse HEAD
node --version
npm --version
npm ci
npx playwright --version
npx playwright install --with-deps chromium
npx playwright test --list
npm test
npm run build
npm run test:e2e -- --workers=2
```

`test:e2e` levanta el servidor Vite automáticamente. No arrancar manualmente otro servidor en el puerto 4173 para esta prueba de certificación. Con `CI=true`, Playwright impide `test.only` y no reutiliza un servidor ajeno.

## Control automático

El workflow `.github/workflows/ci.yml` se ejecuta **exclusivamente** al recibir un `push` en `main`. No se activa en `dev`, ramas `feature/*`, `fix/*`, `refactor/*`, al abrir una PR ni mediante disparo manual. Esta política fue solicitada por el propietario el 07/11/2026. Los commits de las tareas se suben solo a ramas creadas desde `main`; **no abrir PR ni fusionar automáticamente**.

1. `npm ci`, **todas** las unitarias y `npm run build`.
2. Instalación Chromium + dependencias de sistema, listado de casos y **toda** la suite funcional `tests/` sin `--grep` ni `--ignore`. En fallo conserva `test-results/` (capturas/trazas) como artefacto durante 7 días.

Los jobs son independientes para que los E2E sigan dando información incluso si falla el build. No considerar una ejecución parcial como suite completa aprobada. Al ejecutarse después de integrar en `main`, el CI **detecta regresiones a posteriori** y no puede impedir que una integración defectuosa llegue a `main`. No declarar certificada #24 hasta analizar el resultado completo de `main`.

## Ejecuciones realizadas antes del cambio de política

El 07/11/2026 se iniciaron workflows de diagnóstico sobre la rama de trabajo antes de la restricción actual. En la ejecución `42366865632` constaron **213/213 pruebas unitarias aprobadas** y build aprobado (bundle de 1.447,19 kB, gzip 401,67 kB); la instalación de Chromium fue corregida al fijar Ubuntu 24.04. Las ejecuciones E2E finalizaron con **116/119 aprobadas y 3 fallidas** tanto en `42366865632` como en `42367039344`. Son resultados diagnósticos de ramas **anteriores al último parche**, no una certificación de `main` ni una validación de los cambios posteriores. A partir del cambio de política, **no se lanzarán nuevas ejecuciones sobre esa rama**. Resultados históricos de rama ≠ validación tras integrar en `main`.

## Corrección de los tres fallos E2E detectados (07/11/2026)

Resultados de las dos ejecuciones previas a la política exclusiva de `main`: **116/119 casos funcionales aprobados**, 3 fallidos; 213/213 unitarias y build aprobados, con aviso de bundle. Se conservaron capturas y trazas en GitHub Actions. **No se han ejecutado tests después de estas correcciones ni en la rama actual**; el resultado definitivo llegará cuando el propietario integre en `main`.

| Fallo original | Diagnóstico | Cambio realizado | Validación pendiente |
| --- | --- | --- | --- |
| `furniture-attachments.spec.ts` — anclajes Y / lámparas libres | Timeout de 30 s en un recorrido largo que mezclaba varios anclajes, cámaras y guardado; no prueba por sí solo un defecto de anclaje | Se divide en tres casos separados para alfombra, alfombra circular y lámpara de techo, más un caso específico para las dos lámparas libres. Todos mantienen verificaciones de Y y persistencia | Revisar que pasan los cuatro casos y la compatibilidad legacy |
| `room-builder.spec.ts` — responsive a 851 px | En el punto previo al layout estrecho la escena se reduce y la brújula se solapa con los controles o el zoom | El diseño de paneles apilados comienza a 1000 px (antes 850 px) y se aumenta el espacio inferior de la brújula en anchos hasta 1200 px. Se añaden tamaños alrededor del nuevo breakpoint a la prueba | Confirmar que no hay solape, desbordamiento ni regresión del editor a 1001/1000/999/951/950/851 px y móviles |
| `room-builder.spec.ts` — intercala carpetas y hermanos | Timeout en una comparación de coordenadas Y tras un reordenado; la posición visual no permite concluir si la jerarquía es correcta | Se comprueba el **orden real de los hermanos directos en el DOM**, la existencia de los elementos y que `Silla` continúa en `Carpeta 1`; no se excluye la prueba | Si la comprobación DOM falla, investigar un defecto real de reordenación y no ocultarlo |

**Revisión manual solicitada antes de dar el visto bueno:** añadir una alfombra, alfombra circular y lámpara de techo (sin edición Y) y después una lámpara y lámpara de mesa (con Y editable y guardado de 0,01 m); revisar distintas cámaras y el layout alrededor de 1000 px; crear carpetas con subcarpetas, intercalar una silla, subir carpeta y guardar/recargar para comprobar la pertenencia y el orden.

**No se da por cerrada la issue #24.** Se mantienen pendientes las pruebas definitivas sobre `main`, la validación de R5.1–R5.3 y cualquier regresión que aparezca.

## Matriz de certificación (por completar con evidencias reales)

| Área | Evidencia requerida | Estado |
| --- | --- | --- |
| Instalación limpia | SHA, Node, npm, `npm ci` | Pendiente de CI |
| Unitarias | Recuento total y fallos | Pendiente de CI |
| Build | Resultado y tamaño/advertencias de Vite | Pendiente de CI |
| E2E funcional completa | Total descubierto, aprobados, fallidos, omitidos, navegador y duración | Pendiente de CI |
| Compatibilidad v1–v5 / retirada UI A-B | Unitarias de `designMigrations` y `designFile`; E2E de importación y persistencia; comprobación manual de ausencia de variantes UI | Pendiente de certificación |
| R5.2 (dimensiones, ventanas e historial) | Unitarias y E2E de medidas/guardado/recarga; evidencia de uso visual | Pendiente de certificación |
| R5.3 (JSON, seguridad, importación/exportación) | Unitarias y E2E de errores, copia, límite y diálogos | Pendiente de certificación |

Para cada fallo E2E, registrar: nombre exacto del caso, SHA, entorno, error y traza, clasificación **regresión real / expectativa obsoleta / infraestructura o flakiness**, decisión adoptada y resultado de la repetición **global** después de corregir. Si algún bloqueo permanece, vincularlo expresamente a #24 u otra issue y **no certificar el MVP**. La inspección estática encuentra funciones de lectura legacy v5 en `src/persistence/designMigrations.ts` y pruebas de v5 en `src/persistence/designMigrations.test.ts` y `src/persistence/designFile.test.ts`; esto no equivale a validación dinámica.

**Fuera de alcance:** Workshop, nuevos motores, restauración de UI A/B, publicación y refactorización general de #34.
