# F0 — baseline de certificación R5 (#24)

**Estado de esta entrada:** inventario estático del repositorio. **Las pruebas todavía NO se consideran ejecutadas ni aprobadas** por este documento. La evidencia debe proceder de ejecuciones completas con su SHA y registro en CI o en una máquina de desarrollo. No modificar las entradas históricas de [R5_PROGRESS.md](R5_PROGRESS.md).

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

Ejecutar desde una copia limpia del commit/PR bajo prueba, con Node 22 y npm disponibles:

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

El workflow `.github/workflows/ci.yml` ejecuta sobre PR, `main`, `dev` y bajo disparo manual:

1. `npm ci`, **todas** las unitarias y `npm run build`.
2. Instalación Chromium + dependencias de sistema, listado de casos y **toda** la suite funcional `tests/` sin `--grep` ni `--ignore`. En fallo conserva `test-results/` (capturas/trazas) como artefacto durante 7 días.

Los jobs son independientes para que los E2E sigan dando información incluso si falla el build. No considerar una ejecución parcial como suite completa aprobada. Esta configuración no realiza por sí misma un control obligatorio de merges; si se desea impedir merges con checks fallidos, configurar la protección de la rama en GitHub tras comprobar los jobs.

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
