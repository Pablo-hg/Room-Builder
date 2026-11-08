# Diagnósticos locales del editor

**#34, 08/11/2026. Implementado en rama; certificación pendiente de main.** La consulta habitual es un único archivo interno de VS Code. No hay visor técnico en la web ni opción de compartir. **Exportar diagnóstico** permanece debajo de **Atajos de teclado**, sin selector Ayuda.

## Un único log de desarrollo

Al ejecutar `npm run dev`, Vite abre o crea automáticamente:

**`logs/LECTURA.log`**

Interacciones, colisiones, errores/advertencias y sistema se escriben juntos conforme llegan. No hay que generar archivos por comandos. Se deja de crear JSONL y lecturas por categoría, fecha o sesión. Los archivos anteriores se conservan como históricos, sin borrarlos ni reescribirlos. Si ya existe la lectura conjunta del sistema anterior, se conservan sus entradas; las nuevas incorporan el campo Tipo.

Cada entrada muestra:

- Hora de Madrid, nivel y categoría.
- **Tipo** de interacción: selección, deselección, multiselección, movimiento, giro, medidas, cámara/vista, creación, eliminación, guardado, importación/exportación, bloqueo, etc.
- Acción concreta y resultado real: completada, cancelada, rechazada o fallida; inicio/observación cuando corresponde.
- Vista, objetos afectados, valores antes/después y motivos de rechazo/aviso.
- Lectura sin identificadores técnicos de referencia: los IDs de sesión, operación y evento permanecen dentro de IndexedDB y de los JSON exportados.

Ejemplo ilustrativo, no evidencia de ejecución:

```text
[08/11/2026, 20:10:00,000] INFO · INTERACCIÓN
Tipo: MOVIMIENTO
Mover mueble — Completada
Vista: Isométrica
Elementos: obj-123
Cambios:
  · Objeto obj-123 / Posición X: 0 m → 0,5 m
```

Posiciones/tamaños en metros, zoom en porcentaje y giros en grados. Cancelar conservando cambios aceptados se explica explícitamente. Los avisos espaciales indican si bloquean o solo advierten; la proximidad que incumple la separación de aperturas no se presenta como intersección física.

En creaciones extensas (por ejemplo, una habitación con paredes, suelo y techo), el log legible resume los elementos y sus dimensiones en lugar de listar cada propiedad. Los detalles completos están en el diagnóstico exportado. Se reducen los avisos repetidos del mismo par de objetos durante una operación (una entrada y una salida como máximo), conservando las transiciones íntegras en IndexedDB. Los gestos sin cambios reales no figuran como completados.

Al arrancar Vite, si el destino nuevo no existe, el anterior `logs/diagnostics/LECTURA.log` se mueve a `logs/LECTURA.log` sin perder las entradas y retirando solo las líneas `Referencia:`. La carpeta anterior se elimina si queda vacía; si contiene archivos históricos se conserva.

El archivo tiene un máximo de **5 MiB**. Al alcanzarlo se retiran entradas completas antiguas, sin generar nuevos segmentos ni copias de rotación. Una sustitución usa brevemente `LECTURA.log.tmp` para escribir de forma atómica; no es otro destino de registros. El log conserva el orden de recepción, con la fecha de cada evento: no implica orden causal global entre pestañas. Si el usuario vacía o elimina el archivo, el escritor vuelve a crear su cabecera al recibir eventos.

## Motor y almacenamiento

- `src/diagnostics/contract.ts`, `engine.ts`, `instrumentActions.ts` y `stateSummary.ts`: eventos estructurados y resultados después de validación efectiva, agrupación por operación y cambios mínimos. Separado de undo/redo, sin alterar reglas de colisión ni formatos de diseños.
- `indexedDb.ts`, `queue.ts`, `runtime.ts`: IndexedDB canónico por origen/navegador; retención inicial siete días y aproximadamente 5 MiB de JSON, priorizando warn/error. Parámetros configurables en el módulo/API, sin controles técnicos en la web. Búfer y cola de 1000 eventos/1 MiB cada uno, hasta 32 grupos y 16 KiB por evento.
- `dev/fileMirror.ts`: transporte solo DEV, lotes de 48 KiB, timeout de tres segundos y tres reintentos adicionales. `tools/diagnosticsPlugin.ts`: receptor validado (64 KiB/100 eventos, 32 solicitudes simultáneas) y escritor único serializado. Recuperación de cadena tras fallos. IDs de reintentos deduplicados durante la vida del proceso de Vite (hasta 10000); tras reiniciar el servidor puede repetirse excepcionalmente un reintento cuya respuesta se perdiera. Los IDs completos se conservan en IndexedDB y en la exportación estructurada.
- `tools/diagnostics/readable.ts`: formato humano y clasificación según códigos de acciones/categorías, sin deducir duplicados por frases iguales. Los motivos desconocidos conservan su código, sin inventar una explicación.
- Al usar solo texto legible en disco, los eventos estructurados completos siguen disponibles en IndexedDB y mediante Exportar diagnóstico. Los archivos históricos JSONL permanecen legibles por las utilidades de mantenimiento existentes; no son la salida activa.

## Exportación y privacidad

**Exportar diagnóstico**, bajo Atajos de teclado, descarga por iniciativa del usuario un JSON indentado con los eventos locales disponibles, versión de formato/app, fecha UTC y familia general del navegador. No hay envío automático, selector de compartir ni visualizador web. Se indica solicitud de descarga, no escritura física confirmada por el sistema operativo.

No se guardan nombres, notas, rutas, contenido importado ni diseños completos. IDs seudónimos estables dentro de una sesión, con hash no criptográfico; no garantizan anonimato frente a quien conozca el diseño. Se conservan campos geométricos que cambian y contexto mínimo. El fallo del diagnóstico no es requisito para editar o guardar diseños.

## Compatibilidad y límites

`logs/interactions.log` y los segmentos anteriores se conservan intactos. `tools/diagnostics/read.ts` sigue siendo una utilidad opcional de mantenimiento: por defecto lee el único log activo; los filtros estructurados requieren un JSON/JSONL histórico o exportado, porque el texto humano no se reinterpreta como fuente estructurada. El script agregado histórico conserva su función auxiliar. Ninguna utilidad es necesaria para generar el log cotidiano.

IndexedDB puede ser borrado/denegado; se usa memoria temporal acotada y avisos. Funciona offline con la app ya cargada, sin añadir PWA/caché para reabrirla offline. Cierre abrupto puede perder eventos pendientes; append y sustitución atómica no prometen persistencia física ni entrega absoluta. El fichero de texto no conserva cada campo del contrato: los detalles estructurados están en el navegador/exportación.

Los avisos espaciales se muestrean a 150 ms durante gestos y fuerzan el estado final; puede omitirse un cruce fugaz entre muestras. Cajas orientadas no equivalen a mallas exactas. Validadores sin diagnóstico detallado conservan motivos genéricos; no se inventan parejas. No hay medición certificada de CPU/FPS por esta implementación.

## Validación pendiente

Preparadas pruebas de contrato, agrupación, privacidad, cola, store/cancelación, validación de aperturas y clasificación humana. El escritor prepara casos de archivo único, mezcla de categorías, resumen de creaciones, supresión de repeticiones de colisiones, migración del archivo anterior, tamaño máximo, recuperación y deduplicación durante el proceso. E2E preparados para receptor, IndexedDB, offline/exportación y ausencia de visor/compartir.

TypeScript sin emisión y diff son revisión estática. No se ejecutan unitarias, E2E, build ni CI en esta rama. Tras integración autorizada en main: suites completas y build (incluye la comprobación de herramientas internas excluidas del bundle). Pendientes también actualización en vivo y legibilidad en VS Code, exportación, cierres, fallos de almacenamiento, móvil/teclado y rendimiento. #34 permanece abierta.
