# Diagnósticos locales del editor

**#34, 08/11/2026. Implementado en rama; certificación pendiente de main.** La consulta para desarrolladores está en archivos del proyecto y terminal de VS Code. No hay visor técnico en la web ni opción de compartir. Ayuda conserva únicamente **Exportar diagnóstico**.

## Leer en VS Code

Al ejecutar `npm run dev`, `logs/diagnostics/` contiene dos representaciones de los mismos eventos:

- `<fecha>-<sesion>-<categoria>-00001.jsonl`: datos estructurados originales.
- `<fecha>-<sesion>-<categoria>-00001.lectura.log`: lectura en español actualizada durante el uso del editor.

Categorías: `interactions` (interacciones), `collisions` (conflictos espaciales), `errors` (errores y advertencias), `system` (sistema). Los archivos legibles muestran hora de Madrid, acción y resultado, vista, objetos, cambios antes/después, motivos y referencias de operación/sesión. Las posiciones se expresan en metros, el zoom en porcentaje y los giros en grados. Cancelación con cambios aceptados se explica explícitamente.

Ejemplo ilustrativo de formato; no es una evidencia de prueba:

```text
[08/11/2026, 19:09:06,959] INFO · INTERACCIÓN
Mover mueble — Completada
Vista: Isométrica
Elementos: obj-123
Cambios:
  · Objeto obj-123 / Posición X: 0 m → 0,5 m
Referencia: #12 · operación op7 · sesión s-ejemplo
```

El JSONL conserva códigos/detalles que la representación humana resume. Los legibles son copias derivadas y regenerables, no un segundo origen de eventos. Si falla su escritura, el JSONL se conserva y el escritor intenta reconstruir la lectura; ese fallo no provoca reenvíos del evento canónico.

## Lector interno: terminal integrada

Usa `tsx`, ya instalado en el proyecto; no abre servidor ni interfaz web:

```powershell
npm run diagnostics
npm run diagnostics -- --categoria collisions --nivel warn
npm run diagnostics -- --fecha 2026-11-08 --objeto obj-123
npm run diagnostics -- --sesion s-codigo --operacion op7
npm run diagnostics -- --seguir
npm run diagnostics -- --salida logs/diagnostics/LECTURA.log --seguir
npm run diagnostics -- --regenerar --salida logs/diagnostics/LECTURA.log
npm run diagnostics -- "C:\ruta\room-builder-diagnostico.json"
npm run diagnostics -- logs/interactions.log
```

Sin argumentos consulta los últimos 200 eventos, ordenados cronológicamente y deduplicados por ID, en `logs/diagnostics/`. `--limite` admite hasta 10000. `--fecha` filtra UTC; las horas se muestran en Madrid. `--seguir` refresca archivos modificados cada segundo; Ctrl+C termina. `--salida` crea una lectura conjunta para abrir en VS Code. `--regenerar` crea lecturas por segmento existente sin modificar los JSONL. Se pueden consultar JSON portátil exportado, JSONL o texto histórico. Los filtros estructurados no se aplican al texto histórico, que conserva sus frases/fecha originales, sin inventar resultados. Los archivos incompletos por un append activo se releen en la siguiente actualización.

El lector y el formateador están en `tools/diagnostics/`; no se importan desde la aplicación. No se insertan registros leídos en IndexedDB ni se modifican diseños. `scripts/audit-interaction-log.mjs` conserva su función agregada auxiliar para histórico/JSONL; no es el lector principal.

## Exportar desde la web

Ayuda → **Exportar diagnóstico** descarga un JSON indentado que el lector interno puede abrir. Incluye formato/versiones, fecha UTC, familia general del navegador y registros disponibles. El contenido se obtiene al pulsar exportar. No abre selectores de compartir ni envía información automáticamente. La confirmación indica solicitud de descarga, no escritura física confirmada por el sistema operativo.

## Arquitectura y límites

- `src/diagnostics/contract.ts`, `engine.ts`: contrato v1, sesión/eventos/operaciones, categorías, resultados y agrupación. `instrumentActions.ts` y `stateSummary.ts`: resultados después de validación efectiva y cambios mínimos. `actionScope.ts` y callbacks de validación aportan rechazos sin cambiar reglas. La fachada `debug/interactionLog.ts` evita duplicados de estado/escena.
- `indexedDb.ts`, `queue.ts`, `runtime.ts`: almacenamiento canónico por origen/navegador en `room-builder-diagnostics`, stores `events` y `meta`. Retención inicial **7 días y 5 MiB de JSON** (el uso físico puede ser mayor); conservación prioritaria warn/error. Parámetros configurables en el módulo/API de retención, sin controles técnicos en la web. No utiliza ni modifica el historial undo/redo.
- Búfer temporal y cola: 1000 eventos/1 MiB cada uno; hasta 32 grupos continuos y 16 KiB por evento. Los detalles recortados se señalan. IndexedDB puede ser denegado o borrado: copia temporal limitada, reintentos y aviso en consola/Ayuda.
- `dev/fileMirror.ts`: copia opcional, activada en Vite dev, por lotes de 48 KiB, timeout de tres segundos y hasta tres reintentos adicionales. Ausente de producción y preview. `tools/diagnosticsPlugin.ts`: receptor validado (64 KiB/100 eventos, 32 solicitudes simultáneas) y escritor recuperable; deduplicación de últimos 10000 IDs del proceso.
- Segmentos JSONL de 1 MiB con lectura asociada; esta puede ocupar más espacio que el JSONL, pero tiene el mismo conjunto acotado de eventos. Retención de archivos **7 días o 50 MiB entre originales y copias**; comprobación al escribir, como máximo una vez por minuto. Limpieza por parejas solo de los segmentos generados. `LECTURA.log` de terminal es una salida manual no rotada: limitar la consulta o regenerarla según necesidad. `logs/interactions.log` histórico permanece intacto. Los logs están ignorados por Git.
- `spatial.ts`: avisos de los detectores actuales, agrupados a 150 ms durante gestos y con estado final forzado; puede omitir cruces fugaces. Bloqueos de aperturas incluyen pareja y regla real (p. ej. separación de 15 cm), sin confundir proximidad con colisión física. Precisión de cajas orientadas, no de mallas. Reglas sin detalle conservan un motivo genérico; no se inventan parejas.
- No se guardan nombres, notas, rutas, contenido importado ni diseños completos. IDs seudónimos estables dentro de una sesión; hash no criptográfico, sin garantía de anonimato frente a alguien que conozca el diseño. Se conservan campos geométricos que cambian y contexto mínimo.
- Funciona sin conexión con la app ya cargada; no añade PWA/caché para reabrirla offline. Cierre abrupto puede perder eventos pendientes. `pagehide` y visibilidad intentan vaciar, sin garantizar entrega. Un reinicio de Vite puede repetir IDs previamente escritos sin confirmación; el lector los deduplica. Los archivos no prometen `fsync`.

## Validación

Preparadas pruebas de contrato, privacidad, agrupación, store/cancelación, colas, recuperación de disco y lectura, histórico, conflictos, filtros de terminal y representación humana. E2E preparados para receptor, IndexedDB real, retención/recuperación, offline, exportación y ausencia de controles de desarrollo/compartir.

TypeScript sin emisión, sintaxis y diff son revisión estática. **No se ejecutan unitarias, E2E, build ni CI en esta rama.** Tras integración autorizada en main: `npm ci`, `npm test`, `npm run build`, `npm run test:e2e`. El build incluye `scripts/verify-diagnostics-bundle.mjs` para detectar herramientas internas o compartir en artefactos públicos; esa comprobación sigue pendiente. Comprobar también legibilidad y actualización en VS Code, móvil/teclado, exportación, fallos de almacenamiento y CPU/memoria. #34 permanece abierta.
