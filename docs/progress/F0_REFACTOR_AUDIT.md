# F0 — Auditoría y refactorización conservadora (#34)

**Estado:** cambios de código realizados y revisados **estáticamente**, pendientes de validación manual y de `CI` cuando se integren en `main`. Ningún test ni build se ha ejecutado en esta rama por la política vigente. No confundir lectura/inspección con certificación.

- **Referencia funcional de partida:** `dev` en `33ec839650e0f9ef3aa5982da74150146de7dbdc` (incorpora la issue #24; `main` permanecía en `938e5b18edee26c1252a26ca038db0fd26a3f356`).
- **Rama revisada:** `feature/34-auditar-refactorizar`, creada previamente desde ese `dev` (no desde `main`) para conservar #24.
- **Alcance:** mantener idénticos DOM, etiquetas/roles/IDs, gestos, formato local y representación. No Workshop, funcionalidades nuevas ni segunda fuente de estado.
- **Evidencia inicial:** inventario estático de `src/` y lectura de módulos; 61 archivos de pruebas `.test.ts`/`.spec.ts` contabilizados en árbol, no ejecutados. Los tamaños son indicadores de lectura, **no métricas de rendimiento**.

## Hallazgos y decisiones

| Módulo | Observación respaldada por lectura | Decisión | Riesgo |
| --- | --- | --- | --- |
| `components/editor/ObjectsPanel.tsx` (~41 KB, 601 líneas antes) | En un componente conviven alta de objetos/categorías, árbol recursivo con drag-and-drop/menús contextuales y switches de cuadrícula; cada área tiene estado/acciones y markup propio | **Extraer dos secciones autónomas:** catálogo y cuadrícula. Conservar el árbol dentro de `ObjectsPanel` para no alterar gestos, foco y orden | Bajo-medio: montaje de componentes y suscripciones deben comprobarse |
| `App.tsx` | `hasPlacedSceneContent` evaluaba dos veces la misma condición `structurePacks.length > 0` | Retirar únicamente el término booleano duplicado, sin cambiar el resultado | Bajo |
| `styles.css` (~55,5 KB) | Reglas globales interdependientes y media queries: moverlas sin controlar cascada puede cambiar la UI | **No dividir ahora.** Requiere mapa de especificidad, comparación visual y CI estable; no se ha demostrado beneficio actual | Medio-alto |
| `scene/Openings.tsx` (~31 KB) | Gestos con puntero, gizmos y renderizado de varias formas de apertura comparten eventos e historial | **No tocar.** Extraer por tamaño no justifica arriesgar colocación/historial | Alto |
| `scene/FurnitureGizmos.tsx` (~25 KB) | Arrastre 3D, rotación y controles de ejes recientemente cambiados en #24 | **No tocar.** Priorizar certificación de los nuevos bloqueos de ejes | Alto |
| `state/actions/constructionActions.ts` (~26 KB) | Lógica de acciones mutable compartida para construcción y habitaciones | **No trasladar a componentes**. Conservar escritura en `state/actions`; auditar funcionalmente en F1/F4 si aparecen problemas concretos | Alto |
| `domain/projectV2.ts`, migraciones y fixtures v1–v5 | Contratos de prototipo R4 y retrocompatibilidad usados como preparación para vivienda | **Conservar**; que no haya UI expuesta no implica código muerto | Alto si se elimina |

Se revisaron importaciones, límites entre dominio/escena/UI/estado y los tests relacionados. **No se identificó evidencia suficiente para borrar módulos históricos ni archivos de persistencia**. No se hicieron perfiles de memoria, benchmarks ni mediciones de re-renderizados, por lo que no se atribuye ninguna mejora de rendimiento cuantificada.

## Cambios aplicados

1. `src/components/editor/ObjectCatalogSection.tsx` (nuevo). Mantiene sin alterar el JSX de alta de habitaciones, superficies, puertas, ventanas, muebles y decoración. Las tres variables de expansión/elección de ubicación y las acciones del catálogo pasan a estar encapsuladas allí.
2. `src/components/editor/GridVisibilitySection.tsx` (nuevo). Mantiene el JSX de los switches con sus IDs, roles, etiquetas y cálculo de la habitación activa. Lee los mismos datos/acciones de `useRoomStore`; no crea otro store.
3. `src/components/editor/ObjectsPanel.tsx`. Pasa de **601 a 406 líneas** mediante extracción, conserva jerarquía, drag-and-drop, menú contextual, renombrado, selección y listeners de pulsación larga. Reutiliza ambas secciones en el mismo orden DOM.
4. `src/App.tsx`. Elimina una condición booleana idéntica repetida en `hasPlacedSceneContent`.

Los archivos `ObjectCatalogSection` y `GridVisibilitySection` **no introducen dependencias npm nuevas**, y conservan la consulta al store Zustand que ya existía. No se han cambiado JSON, migraciones, objetos de dominio, clases CSS, text labels, ni IDs.

## Contratos que no deben variar

- Catálogo: id `catalog-families`, familias, botones, etiquetas accesibles, expansión global/por familia y elección de ubicación para «Nueva habitación vacía».
- Escena: orden relativo del catálogo, `elements-section` y `grid-section`; carpetas anidadas, selección Ctrl/Mayús, menú contextual con pulsación larga, arrastre y renombrado.
- Cuadrículas: mismo cálculo de paredes visibles según vista, mismo pack/habitación activa y switches `role="switch"` con `aria-checked`. La ocultación de cuadrícula no debe esconder el objeto completo.
- Persistencia: ninguna clave de `localStorage`, formato JSON ni fixture histórica se modifica. No se interviene sobre la elevación, los locks de ejes o los modelos.

## Verificación existente y pendiente

**Inspección estática realizada:** componentes exportados y referenciados desde `ObjectsPanel`, secciones JSX trasladadas manteniendo el orden, 4 etiquetas `<section>` del catálogo y 1 de cuadrícula con cierres equivalentes, imports reagrupados y condición redundante de `App` eliminada. Esto **no confirma** compilación ni funcionamiento en navegador.

**Pruebas automatizadas que deben ejecutarse únicamente en `main` tras integrar F0:**
- `npm ci`, `npm test`, `npm run build` y `npm run test:e2e` global (CI definido en #24).
- E2E relevantes ya existentes: `tests/room-builder.spec.ts` (catálogo, acciones y carpetas), `tests/room-views.spec.ts` (cuadrícula/pack), `tests/independent-surfaces.spec.ts` (cuadrículas independientes), `tests/selection.spec.ts` (multiselección/teclado/táctil). No excluirlos ni reemplazarlos por tests dirigidos.
- Comparar total de casos, fallidos, omitidos, advertencias y pruebas nuevas contra el baseline de `docs/progress/F0_BASELINE.md`. Si falla, clasificar antes de arreglar o cerrar F0.

**Comprobación manual en web de la rama** (no sirve probar la versión de producción si aún apunta a `main`):
1. Abrir y plegar el catálogo completo y cada familia; añadir un objeto de iluminación, un mueble, una puerta y una ventana. Comprobar inspector y deshacer.
2. «Nueva habitación vacía»: seleccionar Encima y una pared lateral; cambiar entre habitaciones y vistas. Verificar el selector de ubicación y no perder la selección.
3. Crear Carpeta 1 y subcarpeta, mover dos elementos mediante menú/arrastre, cambiar nombre, bloquear y ocultar, deshacer, guardar y recargar.
4. En Plano/Isométrica/Frontal cambiar switches de suelo y paredes; activar cuadrícula de superficie independiente. Confirmar etiquetas y switches correctos al elegir otra habitación.
5. Repetir la expansión del catálogo, los switches y el menú contextual en móvil/tablet, con pulsación larga y teclado si se dispone.
6. Comprobar que la escena inicial sin objetos muestra las mismas indicaciones y que al añadir una habitación/objeto se actualizan correctamente.

## Riesgos, pendientes y reversión

- **Riesgo principal:** error de compilación por un import o JSX extraído, o cambio involuntario de estado de expansión/foco en React. Detectarlo con validación manual y luego CI en `main`; no declarar verde prematuramente.
- No se recomienda extraer `renderFolder`/gestos del árbol ni dividir CSS/Openings/FurnitureGizmos en esta issue sin tests previos por la política actual.
- Si la revisión manual muestra diferencias, revertir los commits de extracción de secciones; no cambiar contratos para acomodar las pruebas.
- Si todos los flujos manuales están bien, integrar en `dev` cuando lo decida el propietario. **#34 y #24 siguen pendientes de certificación automática final en `main`**.

**Criterio de cierre de la refactorización conservadora:** inventario documentado, alcance de extracciones justificado, revisión manual completada y pruebas definitivas de `main` verificadas. No dar por completada la certificación antes de eso.

## Seguimiento de la revisión manual (08/11/2026)

El propietario ha confirmado sin anomalías las comprobaciones anteriores **3, 5, 6, 7 y 8**, además de la creación de objetos de la comprobación 2 y el uso general de carpetas/cuadrículas en la 4. Se han identificado **tres ajustes complementarios**, expresamente solicitados tras la revisión. Son correcciones de UX/funcionalidad, no refactorizaciones en sentido estricto, y se mantienen en commits independientes para poder revertirlas sin afectar a la extracción:

1. **Paneles laterales:** transición de 240 ms sobre la rejilla de escritorio; sin animación entre layouts apilados por debajo de 1000 px y respetando la regla existente `prefers-reduced-motion`.
2. **Cambio de pared en puertas/ventanas:** el desplazamiento previo podía quedar fuera del nuevo muro o chocar con otra apertura aunque existiese un hueco. Se incorpora búsqueda determinista de centímetros próximos mediante `findAvailableOpeningOffset`, validando cada candidato con las reglas preexistentes. Se aplica a puerta principal, ventanas, puertas adicionales de la raíz y puertas de packs; **no** se relajan márgenes/solapes ni se saltan bloqueos. Los offsets que el usuario introduce expresamente siguen validándose sin recolocación automática. Se han añadido pruebas de regresión, **no ejecutadas**.
3. **Carpeta raíz:** se muestra el cubo de habitación en el árbol y un contorno verde 3D no interactivo alrededor de la habitación base al seleccionarla (sin controles de traslado). Requiere verificación visual en las distintas vistas.

Las dos capturas del usuario muestran un ejemplo en el que una pared aparentemente libre rechaza una apertura con el mensaje de quedar fuera de la pared `west`. El análisis de `roomForWindowUpdate` y `roomForDoorUpdate` confirma que antes se aplicaba la pared nueva conservando el `offset` anterior. **La hipótesis de causa está respaldada por código, pero el resultado del parche todavía no está probado en navegador.** En el caso de muros físicamente coincidentes, se conserva expresamente el rechazo hasta disponer de medianera única.

## Auditoría de logs de interacción — alcance añadido por el propietario

**Fase 1, inventario estático realizado el 08/11/2026.** No existen en el repositorio muestras de `logs/interactions.log` (están ignoradas por Git) y no se ha ejecutado una sesión instrumentada. No inventar tasas de eventos, CPU, memoria o latencias ni marcar los nuevos criterios de aceptación hasta recogerlas.

| Aspecto | Evidencia de código | Evaluación actual |
| --- | --- | --- |
| Origen y activación | `src/debug/interactionLog.ts`: `recordInteraction` sale inmediatamente salvo `import.meta.env.DEV === true`; `sceneInteraction.ts` añade vista/selección | **Sin telemetría desde el bundle estándar de producción**; no se ha auditado un despliegue externo |
| Coalescencia | `coalesceKey` reemplaza el evento pendiente, espera 1200 ms; cambiar de clave obliga a vaciarlo; el grupo de medidas suprime eventos con clave | Posible ráfaga si se intercalan acciones distintas; requiere medición de un arrastre y cambios de medida |
| Envío | `delivery = delivery.then(fetch(...keepalive: true))`; error de red capturado y descartado, sin reintento ni timeout explícito | Si una solicitud se bloquea puede retrasar todas las posteriores; se ignoran respuestas HTTP no-2xx. No se altera todavía sin reproducciones |
| Cierre | `beforeunload` hace `flush` y registra fin de sesión, pero los envíos están encadenados | El final de sesión puede no terminar de enviarse antes de salir; comprobar pérdidas reales en sesiones cortas |
| Receptor | `vite.config.ts` instala middleware también en el Vite preview local, acepta POST hasta ~64 k caracteres y serializa escrituras en `logs/interactions.log` | Revisar exposición local (red/LAN) y respuesta a peticiones grandes; la ruta no es un backend de Cloudflare |
| Almacenamiento | `mkdir` + `appendFile` a un único archivo local; `.gitignore` excluye `logs/*.log` | No existe limpieza/rotación: posible crecimiento indefinido. No modificar o truncar los logs del propietario sin autorización |
| Privacidad | `describeInteraction` puede interpolar nombres de muebles, IDs y detalles en texto humano | **Datos potencialmente sensibles en logs locales**; no subir logs ni compartirlos íntegros, evitar introducirlos en informes o issues |
| Coste de cálculo | Serializa JSON al enviar y da formato textual en el plugin | No hay profiling o medición real de CPU/memoria. No inferir impacto en FPS únicamente del código |

**Medición agregada local preparada:** `scripts/audit-interaction-log.mjs` analiza el archivo sin imprimir mensajes, nombres, identificadores ni contenido. Devuelve tamaño del archivo, número de eventos/sesiones, bytes medios y máximos por línea, pico de entradas por segundo, repeticiones consecutivas de descripciones y categorías aproximadas. La clasificación por idioma es orientativa, no sustituye la estructura original.

Para completar la auditoría sin ejecutar pruebas automatizadas en ramas de trabajo:
1. Arrancar la web **local de desarrollo** (`npm run dev`; no usar la web pública) y realizar unos minutos de arrastres, selección, cambios de cámara, medidas y guardado.
2. Desde la raíz del repositorio ejecutar `node scripts/audit-interaction-log.mjs`. Si no existe el archivo, comprobar que el servidor de desarrollo recibió eventos; no crear datos ficticios.
3. Conservar los logs originales solo localmente y **compartir únicamente el JSON agregado** que imprime el script.
4. Con esa evidencia decidir si conviene limitar cola de envíos, responder a HTTP fallidos, rotar el archivo o añadir niveles `error/warn/debug`, y comparar con otra muestra. Las medidas de FPS/CPU y seguridad de acceso remoto del receptor requieren comprobación aparte y no están automatizadas aquí.

**Pendiente para cerrar #34:** obtener muestra real y evaluarla, verificar el comportamiento de las tres correcciones en la web y certificar la suite global al integrar F0 en `main`.
