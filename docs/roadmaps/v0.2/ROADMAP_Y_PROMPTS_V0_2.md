> **ARCHIVO HISTÓRICO DE PROMPTS (03/11/2026):** contiene instrucciones superadas sobre R5 pendiente, A/B y v0.2 como cierre final. NO ejecutar automáticamente ni crear issues desde él. La última decisión del 04/11 establece un **MVP completo** de vivienda por plantas más siete funciones y POV; el checkpoint de una habitación es v0.2 (#33), y la gate final es #54. **Fuente única actual:** [MVP_MASTER_PLAN.md](../../MVP_MASTER_PLAN.md) y [MVP_SCOPE.md](../../MVP_SCOPE.md). Se preserva el texto histórico para trazabilidad.

# Room Builder — Hoja de ruta v0.2 y guía de ejecución con Codex

**Publicación documental:** 03/11/2026. **Base auditada:** `main` en `e56973f`.
**Estado:** propuesta de planificación; NO implica que R5 o v0.2 estén entregadas.
**Ámbito:** aplicación local/editor; Workshop y red social aplazados.

Este documento reúne en un solo fichero la revisión de `main`, el plan maestro y los prompts independientes para Codex. Se conserva íntegramente el detalle de las tres piezas del paquete de documentación del 03/11/2026 para que el historial sea autosuficiente.

**Orden de uso:** hasta terminar R5, utilizar únicamente `PRE-E0` de la parte 3. Una vez R5 esté integrada y verificada, iniciar `E0`. Las etapas posteriores solo se ejecutarán de una en una y con autorización. No reimplementar R4 ni crear tareas del Workshop.

**Contenido**
- Parte 1 — Estado actual de `main`, evidencias y discrepancias documentales.
- Parte 2 — Plan maestro de v0.2 y etapas E0–E12.
- Parte 3 — Prompts independientes para Codex (PRE-E0, E0–E12).

---

# Parte 1 — Estado de main y hallazgos documentales

# Room Builder — Estado de `main` y sincronización documental

**Fecha de comprobación:** 03/11/2026  
**Repositorio:** `Pablo-hg/Room-Builder` (privado)  
**SHA de `main` consultado:** `e56973fd8cb898b6d74dc5b07b66fd27bd09e135`  
**Naturaleza:** informe documental; **no prueba funcional ni solicitud de despliegue**.

## 1. Evidencias de GitHub

- [PR #19](https://github.com/Pablo-hg/Room-Builder/pull/19): `refactor/r4-preparar-evolucion` → `dev`, merge `c374b7b5529230aa391476dab921a1d570cb8f46`.
- [PR #20](https://github.com/Pablo-hg/Room-Builder/pull/20): `dev` → `main`, merge `e56973fd8cb898b6d74dc5b07b66fd27bd09e135`.
- En la comparación consultada, `main` está dos commits por delante de `dev`, con cero commits exclusivos de `dev`.
- La PR #20 integra R4 en `main`; su código y pruebas están presentes. **R5 no figura como completada** en `docs/REFACTOR_PLAN.md`.
- El informe de Workshop `ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md` existe en `main`, pero la funcionalidad social **no** forma parte del MVP local.

## 2. Tabla de estado

| Bloque | Estado comprobado | Matiz importante |
|---|---|---|
| R0–R3 | Integrado/documentado | Las pruebas históricas no sustituyen una ejecución nueva. |
| R4.1–R4.4 | **Integrado en `main`** | Contrato y funciones puras, no interfaz multihabitación ni persistencia V2. |
| R5 | **Pendiente** | Prioridad: variantes Original/Alternativa A → redimensionado → JSON editable → UX. |
| v0.2 | **Todavía no iniciada** | Plan propuesto posterior a R5, no release ni compromiso de implementación. |

### Qué aporta R4 realmente

- `src/domain/projectV2.ts`: `ProjectV2` con plantas, habitaciones rectangulares, paredes, aberturas, definiciones/instancias y layouts.
- `src/domain/projectVariants.ts`: funciones puras para duplicar y modificar variantes, con revisión de estructura.
- `src/domain/productCapabilities.ts`: catálogo de capacidades de versión completa y Mini.
- `src/persistence/projectMigration.ts`: migración pura desde datos anteriores y proyección de prueba al formato previo.
- Cuatro archivos de test nuevos; el informe R4 recoge **189/189 unitarias y build correctos** en su última revisión de desarrollo, pero **no son pruebas reejecutadas sobre `main`**.

**No se ha demostrado mediante ejecución que** variantes, JSON o multihabitación sean funciones disponibles en la interfaz actual. `localStorage` continúa basándose en diseños v1–v4.

## 3. Decisiones del producto que deben permanecer visibles

- **RB-025:** dirección futura de habitaciones de 1 a 6 lados y paredes interiores. El contrato R4 es todavía rectangular y no puede representar esa propuesta de forma general.
- **RB-026:** los elementos de pared no deben solaparse cuando coinciden tanto en tramo horizontal como en franja vertical; la validación pura de R4 contempla esta restricción.
- **RB-027:** una medianera estructural única para habitaciones conectadas, compartida mediante `roomIds`; no duplicar muros ni huecos.
- **R5:** empezar por la comparación Original/Alternativa A, incluido su modelo de selección, preferencias, historial, estructura y guardado; después considerar redimensionado y JSON editable.

No convertir las formas no rectangulares ni el Workshop en tareas implícitas de R5 o v0.2.

## 4. Discrepancias documentales encontradas en `main`

| Ruta | Qué no refleja el presente | Cómo corregirlo sin borrar historia |
|---|---|---|
| `docs/REFACTOR_PLAN.md` | Encabezado afirma que R4 está en una rama con cambios locales sin integrar. | Añadir actualización actual: **integrado en `main` mediante PR #19/#20**, R5 pendiente; conservar la sección histórica que explica cómo se trabajó en R4. |
| `docs/progress/R4_PROGRESS.md` | Cierra con «no commits/no integración» (era verdad durante ese trabajo). | Añadir epílogo posterior con los merges y aclarar que no se han reejecutado sus pruebas en esta revisión. |
| `README.md` | Dice «no hay selección múltiple». | Matizar: hay estado y acciones de selección múltiple, pero falta certificar en la UI y E2E las operaciones conjuntas; no prometer comportamientos no comprobados. |
| `docs/MVP_SCOPE.md` | Estado de implementación anclado a un commit de octubre. | Añadir nota de fotografía `e56973f` con R4 integrado solo a nivel de dominio; mantener alcance previo hasta decisión humana. |
| `docs/DECISION_LOG.md` | Sí recoge RB-025/026/027, pero aún no hay enlace a la hoja de ruta v0.2. | Añadir enlace únicamente cuando se introduzcan estos documentos al repositorio y se apruebe su ubicación. |

## 5. Documentos revisados en este paquete

- `PLAN_POST_REFACTOR_ROOM_BUILDER_V0_2.md`, **revisión 1.1**:  estado verificado, referencias a PR y SHA, clasificación R0–R5, decisiones RB-025–027, gates E0–E12 y reconciliación con R5.
- `PROMPTS_CODEX_POST_REFACTOR_V0_2.md`, **revisión 1.1**: preflight `PRE-E0` para cerrar R5 sin duplicar R4 y prompts E0–E12 ajustados a la situación real.

## 6. Siguiente ejecución recomendada

**Mientras R5 no esté integrada**, entregar a Codex **solo `PRE-E0`** del documento de prompts. Una vez cerrada e integrada R5, enviar **E0** para volver a auditar la realidad y decidir si el salto a v0.2 está preparado. La investigación/UX puede planificarse, pero no declararse implementación de v0.2 hasta pasar ese control.

**Límites de esta revisión:** lectura de metadatos, documentación y código desde el conector GitHub; no se ha hecho checkout ejecutable, ni probado navegador, ni lanzado `npm test`, `npm run build` o Playwright. Ningún archivo del repositorio remoto ha sido escrito o modificado como parte de este paquete.

---

# Parte 2 — Plan maestro

# Room Builder — Plan maestro posterior al refactor para llegar a v0.2

**Documento de trabajo para Codex · 03/11/2026 · revisión 1.1, contrastada con `main` en `e56973f`**  
**Repositorio:** `Pablo-hg/Room-Builder` · **Idioma de producto:** español de España.  
**Tipo:** planificación, auditoría, diseño y propuesta de ejecución incremental.  
**Estado:** **PROPUESTA**. Este archivo **no autoriza** cambios de código, commits, merges, publicaciones, ampliación del MVP ni creación masiva de issues.  
**Momento de uso:** después del cierre e integración de **R5**. **R4 ya está integrada en `main`** mediante las PR #19 (`refactor/r4-preparar-evolucion` → `dev`) y #20 (`dev` → `main`); no repetir R4. Este documento es una fotografía de `main` en `e56973f`, no una afirmación sobre futuros commits.

> **Objetivo en una frase:** pasar de un prototipo de constructor de habitaciones a un **editor local de espacios 3D fácil de aprender, agradable de usar y útil para planificar redistribuciones**, conservando una arquitectura apta para conectar habitaciones en el futuro. El editor importa más que la red social.

---

## Índice

1. Decisiones de partida y fronteras del proyecto.
2. Evidencias del repositorio y límites de esta revisión.
3. Benchmark razonado: Rooms.xyz, MakeRoom y Figma.
4. Posicionamiento, identidad y principios de UX.
5. Qué constituye exactamente la v0.2.
6. Dependencias, gates y reglas de trabajo con Codex.
7. Etapas E0–E12 con objetivos, entregables y criterios de cierre.
8. Matriz de auditoría transversal.
9. Casos de uso obligatorios y plan de pruebas.
10. Riesgos técnicos, mitigaciones y decisiones que **no** puede cerrar Codex.
11. Backlog después de v0.2.
12. Guía para entregar los prompts por turnos.
13. Fuentes y referencias.
14. Anexo de reconciliación documental de `main`.

---

## 1. Decisiones de partida y fronteras

### 1.1 Confirmado por el propietario del proyecto (03/11/2026)

- El producto es **un editor**: construir, decorar, medir aproximadamente y reorganizar habitaciones. El juego o estética lúdica es un lenguaje de interacción, **no** el objetivo primario.
- Una habitación constituye la unidad inicial útil; el diseño debe **poder escalar** a varias habitaciones, interiores completos, plantas y edificios sin improvisar un segundo motor.
- La aplicación es **independiente** de la web/portfolio y puede ofrecer una demo reducida en ella más adelante.
- La UX debe ser **fácil de entender y usar**, incluso por alguien sin conocimientos de software 3D ni Figma.
- Interfaz de edición inspirada en **Figma**: jerarquía de elementos, inspector, carpetas, agrupación, selección, orden, ocultación y bloqueo, con complejidad progresiva.
- Identidad artística: **3D geométrico cartoon/cozy**, formas reconocibles, colores expresivos controlados, sombras suaves. **No pixel art, no CAD, no hiperrealismo**.
- Modos/vistas esenciales: **plano, isométrica y POV interior**. Mantener las vistas Frontal y Libre existentes salvo aprobación explícita.
- Persistencia **local** y control del usuario. Cuentas, backend, publicación, explorador comunitario, seguidores y Workshop quedan **después del MVP local**, en un informe separado.
- El usuario ha cerrado las tareas del Workshop y ha reservado su información para desarrollo futuro. **No reabrirlas ni introducirlas en el backlog de v0.2.** En `main` existe el informe histórico `ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md`; no constituye tarea activa del editor.
- El orden ya documentado en `docs/REFACTOR_PLAN.md` y `docs/DECISION_LOG.md` para **R5** es **Original/Alternativa A en una habitación → redimensionado → JSON editable → demás pulido**. Esta hoja de ruta posrefactor no lo modifica.
- Se ha confirmado como **dirección futura** admitir habitaciones de 1–6 lados y paredes interiores (RB-025), con conexión mediante medianera única y abertura compartida (RB-027). El prototipo R4 sigue siendo rectangular: **no añadir geometría irregular a R5 ni a v0.2 por inferencia**.
- RB-026 fija la regla de no solapamiento de elementos de pared mediante solape de tramo horizontal y franja vertical, ya comprobada en el validador puro R4. No confundir esta regla con una validación visual del editor actual.
- Es válida la edición libre sin medidas al inicio y la precisión opcional al necesitarla. No crear dos editores o modos de usuario incompatibles.

### 1.2 Propuesto aquí (no aprobado todavía)

- Priorizar la **corrección de interacción y datos** por encima de ampliar modelos decorativos.
- Considerar la v0.2 como una versión del **editor local de una habitación sólida**, no un constructor de edificios completo.
- Dejar listo un contrato evolutivo para proyectos/estancias/variantes, sin prometer multihabitación operativa en v0.2.
- Agrupar la revisión en *auditoría → especificación → implementación en lotes → validación completa*.
- Usar investigación y pruebas de usuarios como puertas de entrada a cambios grandes de UI.

### 1.3 Fuera de v0.2 salvo nueva decisión expresa

- Workshop, perfiles sociales, autenticación, rankings, comentarios, feeds, moderación, publicación, backend y sincronización cloud.
- Construcción de casas completas, plantas conectadas, escaleras, paredes curvas, geometrías arbitrarias, importación BIM/CAD.
- IA generativa o interpretación por modelo, objetos 3D descargados de terceros sin revisión de licencia, simulaciones físicas y personas.
- Colaboración en tiempo real, avatares, logros/recompensas o monetización.
- Reescritura del stack por moda; adopción de un motor diferente sin evidencia técnica.

---

## 2. Evidencias y limitaciones: auditoría documental inicial

**La comprobación de este documento se basa en lectura del repositorio privado mediante GitHub y fuentes públicas de los productos de referencia; no se ha ejecutado aquí la app ni instalado MakeRoom.** No equiparar «el código contiene una acción» con «su UX está validada». Codex deberá contrastarlo en su rama y navegador.

### 2.1 Stack y estructura observados en `main` (03/11/2026; `e56973f`)

- React 19, TypeScript 5, Vite 6, Three.js, React Three Fiber y Zustand.
- Dominios/acciones separados (`src/domain`, `src/scene`, `src/state/actions`, `src/persistence`) y módulos de interfaz en `src/components/editor`.
- Escena 3D con **isométrica, plano, frontal, libre e interior**. La vista Libre puede ser orbital y en el código se aprecian controles adicionales de desplazamiento de cámara; comprobar comportamiento real antes de describirla.
- Inspector contextual, catálogo tipado, carpetas anidadas, orden en la lista de escena, selección múltiple en el estado, agrupación y visibilidad/bloqueo; estos elementos requieren pruebas integradas.
- Copiar, pegar, duplicar, deshacer/rehacer y exportar GLB de escena.
- Guardado de hasta **cinco diseños** mediante `localStorage`; versiones históricas persistidas hasta `PersistedDesign` v4. Los nuevos tipos `ProjectV2` **no reemplazan aún ese guardado**.
- El README aún declara ausencia de redimensionado general de muebles/aperturas, exportación/importación JSON editable y herramientas de medición/alineación.
- **Inconsistencia a corregir en auditoría:** el README enumera «no hay selección múltiple», pero `useRoomStore`, `ObjectsPanel` y `selectionActions` sí la contemplan. Determinar su alcance funcional real, no darla ni por terminada ni por ausente automáticamente.
- `main` contiene los **módulos puros de R4**: `src/domain/projectV2.ts`, `src/domain/projectVariants.ts`, `src/domain/productCapabilities.ts`, `src/persistence/projectMigration.ts` y cuatro archivos de test. Se integraron en `main` por la PR #20; ello **no** acredita existencia de UI de variantes, editor de edificios ni persistencia V2.

### 2.2 Refactor real en `main`: R0–R4 integradas; R5 pendiente

| Fase | Estado en `main` `e56973f` | Evidencia y advertencia |
|---|---|---|
| R0, R1, R2, R3 | Integradas/documentadas | `src/components/editor`, `src/scene`, `src/domain`, `src/state/actions`; leer informes históricos para límites de pruebas |
| R4.1–R4.4 | **Integradas como contrato puro** | PR #19 a `dev` y PR #20 a `main`; tipos, validadores, migrador, variantes y capacidades; **no** UI/persistencia pública V2 |
| R5 | **Pendiente** | `docs/REFACTOR_PLAN.md` y `docs/DECISION_LOG.md`; prioridad confirmada: **A/B → resize → JSON** |
| v0.2 | **No iniciada** | Este plan sigue siendo propuesta posterior a R5; ninguna etiqueta, función o prueba de R4 equivale a una release 0.2 |

- SHA de referencia: [`e56973f`](https://github.com/Pablo-hg/Room-Builder/commit/e56973fd8cb898b6d74dc5b07b66fd27bd09e135), merge de PR #20. El merge previo de R4 en `dev` es [`c374b7b`](https://github.com/Pablo-hg/Room-Builder/commit/c374b7b5529230aa391476dab921a1d570cb8f46). En la consulta realizada, `main` estaba **dos commits por delante de `dev`** y `dev` no tenía commits exclusivos respecto a `main`.
- `docs/REFACTOR_PLAN.md` aún comienza describiendo el **estado histórico de la rama R4 con cambios locales y sin commit**; `docs/progress/R4_PROGRESS.md` termina con esa misma narración histórica. **Ese encabezado es incorrecto como estado presente de `main`**, aunque correcto como testimonio de cuándo se escribió. Debe actualizarse o anotarse sin borrar el histórico.
- `docs/progress/R4_PROGRESS.md` registra en su última continuación **189/189 unitarias, build aprobado y 13/13 pruebas específicas**. Son resultados **anteriores a la integración**, recogidos en el informe; **no hemos reejecutado los tests sobre el SHA actual** ni comprobado UX en navegador en esta revisión.
- R4 define `ProjectV2` solo para habitaciones **rectangulares** y paredes en su perímetro; RB-025 (1–6 lados, paredes interiores) requiere cambiar el contrato. RB-027 ha elegido **medianera única** para habitaciones conectadas; RB-026 prohíbe solapamientos de aberturas/decoración coincidentes en tramo y altura. Revisar el impacto antes de ampliar geometría.
- **Riesgo de doble trabajo:** R5 y varias tareas propuestas para v0.2 se solapan. Cuando R5 quede integrado, E0 debe generar una **matriz de trazabilidad**: implementado y validado, implementado sin validar, parcial, pendiente o descartado. Lo que R5 entregue se verifica; **no se reimplementa**.
- Rama estable real y estado de `dev`/`main` deben contrastarse antes de empezar; jamás fiarse de un `origin/main` local sin `fetch`.

### 2.3 Documentación que debe consultarse selectivamente

- `AGENTS.md`, `docs/README.md`, `docs/DECISION_LOG.md` y `docs/REFACTOR_PLAN.md`.
- `docs/PRODUCT_VISION.md`, `docs/MVP_SCOPE.md`, `docs/UX_AND_CAMERAS.md`, `VISUAL_STYLE_GUIDE.md`.
- `docs/OBJECTS_AND_ASSETS.md`, `docs/DATA_AND_FORMATS.md`, `docs/ARCHITECTURE_AND_QUALITY.md`.
- `docs/progress/R3_PROGRESS.md` y `docs/progress/R4_PROGRESS.md` (ya existe en `main`); informe R5 cuando se cree, **solo** para identificar entregas reales.
- `ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md` solo como límite de alcance; no pedir implementación de Workshop.
- `GENERADOR_OBJETOS.md` describe experimentación: **no usarlo como requisito de v0.2**.

---

## 3. Benchmark: aprender sin copiar

### 3.1 Rooms.xyz — referencia de entrada y creatividad

Según la información oficial de Things Inc., Rooms permite crear y remezclar habitaciones interactivas desde web/iOS, partir de objetos existentes o crear otros y personalizar color, iluminación y movimiento. La presentación de **Rooms 4.0 (05/08/2026)** reorganiza la entrada entre descubrimiento y creación y añade plantillas y actividades de construcción acotadas.

**Qué estudiar y, en su caso, adaptar:**

- Primer minuto: dónde empezar, cómo insertar el primer objeto y cómo corregir un error.
- Vocabulario visual accesible y acciones contextualizadas.
- Templates/escenas de ejemplo **offline y locales**, no un feed.
- Microejercicios opcionales de 30–90 segundos («coloca una cama», «cambia el color»), siempre prescindibles.
- Animaciones visuales útiles: indicar selección, movimiento válido, error y guardado sin distracciones.

**Qué no adoptar en v0.2:** explorador social, perfiles, publicación, scripting de objetos, física compleja ni gamificación de la edición.

### 3.2 MakeRoom — referencia de personalización y progresión amable

La ficha oficial de Steam de MakeRoom (Kenney; publicado el 07/08/2025) describe **más de 1.100 objetos**, edición de posición, rotación, tamaño y color, muebles personalizados y encargos opcionales para aprender; también comparte creaciones por Workshop.

**Qué estudiar/adaptar:**

- Manipulación inmediata de objetos, previsualización y colocación sin fricción.
- Controles coherentes de tamaño/posición/color y acabados agradables incluso con geometría simple.
- Catálogo fácil de explorar; categorías y favoritos locales solo si la investigación los justifica.
- Prompts/ejemplos para enseñar herramientas sin tutorial largo obligatorio.
- Presets visuales ligeros (colores, iluminación) si no ocultan utilidad de medidas y colisiones.

**Qué no adoptar:** volumen masivo del catálogo como objetivo, mascotas, limpieza, ambientes o desafíos como sistema de juego, Steam Workshop o dependencia de assets propietarios.

### 3.3 Figma — referencia del modelo mental, no de la fachada

Investigar específicamente: panel de capas, jerarquía, selección anidada, grupos, bloqueo, ocultación, multi-selección, inspector contextual, duplicación, copia/pegado y orden de capas. **No replicar Figma literalmente**: manejar objetos con volumen y superficies de anclaje requiere controles espaciales adicionales.

| Flujo | Inspiración | Diferencia propia de Room Builder |
|---|---|---|
| Seleccionar | Árbol de capas, Shift/Ctrl, selección visible | El objeto ocupa volumen y puede estar tapado por paredes/muebles |
| Agrupar | Jerarquía clara, acciones en contexto | El grupo debe moverse coherentemente en mundo XYZ, con límites/colisiones |
| Inspector | Propiedades contextuales | Cambios de geometría y anclaje afectan a cinco vistas |
| Ocultar/bloquear | Estado heredado/visible | Ocultar una pared para visualizar no equivale a eliminar estructura |
| Importar | Contenedor y estructura | Mantener posiciones originales e IDs únicos, con aviso de solapes |
| Guardar | Archivo editable | Versiones, copia de seguridad y control de datos locales |

### 3.4 Matriz de aprendizaje y diferenciación

| Criterio | Rooms.xyz | MakeRoom | Room Builder propuesto |
|---|---|---|---|
| Objetivo | Creatividad 3D interactiva | Dioramas/decoración | **Diseñar y redistribuir espacios útiles y creativos** |
| Aprendizaje | Creación, plantillas, actividades | Encargos opcionales | **Edición directa + ayuda contextual opcional** |
| Estética | Vóxel/geométrica | Cartoon/cozy | **Geométrica cartoon propia, legible y ligera** |
| Precisión espacial | No es su principal posicionamiento | Edición creativa | **Medidas y límites interpretables para espacios reales** |
| Organización | Objetos de una escena | Herramientas de diseño | **Inspector, grupos y árbol tipo Figma simplificado** |
| Escalabilidad espacial | Sala/experiencias | Dioramas | **Modelo preparado para múltiples habitaciones** |
| Comunidad | Publicación y remix | Workshop | **Fuera de v0.2** |

**Método exigido a Codex:** contrastar cada afirmación con fuentes verificables, vídeos/capturas autorizados si disponibles y pruebas de primera mano cuando sea posible. Anotar «no verificado» en vez de inventar un flujo. No descargar ni copiar materiales de terceros sin licencia.

---

## 4. Posicionamiento e identidad para v0.2

### 4.1 Promesa de producto propuesta

> **«Crea, decora y reorganiza tus espacios en 3D con la facilidad de un juego y la utilidad de un editor.»**

Tres usos que deben convivir con el **mismo motor y formato**:

1. **Exploración creativa:** arrastrar muebles, decorar, imaginar sin introducir medidas desde el principio.
2. **Planificación doméstica:** reproducir habitación real de forma orientativa, ajustar tamaños y comparar alternativas.
3. **Composición técnica ligera:** organizar muchos elementos por capas/carpetas, bloquear, alinear y recuperar versiones.

### 4.2 Principios de experiencia (ordenados)

1. **Comprensibilidad antes que potencia visible.** Una persona no técnica debe saber qué hacer sin aprender términos 3D.
2. **Manipulación directa.** Seleccionar, colocar, arrastrar, girar y redimensionar en el lienzo, con alternativa en inspector.
3. **Precisión opcional y reversible.** No pedir milímetros para empezar; permitir cifras exactas, snap y pasos cuando se necesiten.
4. **Progresión gradual.** Mostrar acciones frecuentes primero y detalles técnicos bajo «Más opciones» o panel secundario.
5. **Nunca perder el trabajo.** Señal de cambios pendientes, recuperación, exportación editable, errores entendibles.
6. **Modelo mental estable.** No cambiar posiciones porque el usuario cambie de cámara; la jerarquía no debe alterar geometría por sorpresa.
7. **Una sola lógica de objetos.** Catálogo, viewport, inspector, guardado, grupos y exportación deben referirse a las mismas entidades.
8. **Esfuerzo visible.** Si una acción está prohibida, explicar si es por colisión, pared, bloqueo, límites o tipo de elemento.
9. **Local-first.** El editor funciona sin Internet, cuenta, permisos extraordinarios ni servicios remotos.

### 4.3 Dirección visual propuesta

- **Formas:** low-poly suavizado, bordes ligeramente redondeados solo cuando favorezcan reconocimiento, sin contornos negros pesados.
- **Iluminación:** materiales mates y sombra de contacto suave; no depender de posprocesado costoso para que se vea bien.
- **Color:** interfaz de bajo ruido con base cálida; objetos con colores alegres moderados y contraste accesible.
- **Iconos:** silueta de objeto coherente entre catálogo y modelo 3D; variantes de color consistentes.
- **Escala:** muebles proporcionados con medidas plausibles; evitar sensación de juguetes desproporcionados cuando se utilizan medidas reales.
- **Cámaras:** el mismo objeto identificable en planta/isométrica/frontal/POV.
- **Marca:** nombre futuro pendiente; separar tokens visuales, nombres de archivo, formatos públicos y rutas de una marca rígida. No emprender renombrado global durante la v0.2.

**No aplicar un restyling masivo directamente:** primero una hoja de estilos/tokens propuesta, tres ejemplos comparativos y aprobación explícita.

---

## 5. Definición de alcance v0.2

### 5.1 Criterio principal de éxito

Una persona que no conozca Room Builder puede abrirlo, recrear un dormitorio rectangular sencillo, añadir tres o más muebles, cambiar su tamaño y distribución, guardar una variante y recuperar/exportar su trabajo **sin explicación técnica ni pérdida de datos**.

### 5.2 Entregas candidatas que deben reconciliarse con R5

**P0 — Bloqueantes para declarar el editor local «útil» (certificar lo entregado por R5, no volver a desarrollarlo):**

- Primer uso e interfaz principal comprensibles.
- Colocación, selección, giro, movimiento y redimensionado general de elementos compatibles con reglas claras.
- Guardado, carga y exportación/importación **JSON editable versionado** con prueba de ida y vuelta.
- Al menos dos variantes A/B y recuperación del original sin mutaciones accidentales. **R5 lo aborda primero; la v0.2 verifica comportamiento real, preferencias, historial y persistencia.**
- Colisiones y restricciones coherentes; deshacer/rehacer fiable.
- Árbol/inspector y acciones de grupo sin pérdidas de jerarquía, orden o posiciones.
- Vistas principales fiables y compatibles con el mismo mundo.
- Experiencia mínima usable en escritorio y táctil, con mensajes de error y alternativas accesibles.

**P1 — Deseables si no desplazan P0:**

- Simplificación del catálogo, búsqueda y mejor feedback de colocación.
- Guías de alineación/distancias; elegir su alcance tras el benchmark.
- Onboarding corto y **saltable** con ejemplos locales.
- Pulido de materiales e iluminación con evidencia de rendimiento.
- Mejoras de exportación visual y presentación de proyectos locales.

**P2 / después de v0.2:**

- Generador por texto, objetos personalizados con piezas, catálogo enorme, iluminación avanzada, efectos, cámara libre tipo FPS, multihabitación operativa y Workshop.

**Regla de corte:** si P0 exige demasiados cambios, negociar explícitamente un alcance v0.2 menor; no ocultar deuda dentro de un supuesto «done».

---

## 6. Puertas de entrada, evidencias y modo de trabajo

### Gate G0 — Refactor terminado o replanificado (a 03/11/2026, pendiente de R5)

Antes de E0, comprobar **en el repositorio real**:

- Rama objetivo y SHA actual de `main`, `dev` y ramas de refactor.
- Estado de R0–R5 (integrado / solo en rama / parcial / pendiente) con PR/commit y pruebas; partir de **R0–R4 ya integradas en `main`** salvo que el remoto haya cambiado y verificar que R5 ha concluido.
- Ausencia de cambios locales que se puedan pisar; crear worktree o rama nueva solo con autorización.
- Suite unitaria, E2E, build y capturas baseline. Si falla algo **antes** de v0.2, documentarlo para no atribuirlo al cambio posterior.
- Compatibilidad de guardados antiguos y fixtures relevantes.
- Diferencias entre README, documentos y código: lista priorizada.

**Si G0 falla:** hoy falla por **R5 pendiente**. No iniciar refactor paralelo, no inventar progreso; devolver diagnóstico y orden para cerrar R5. Se puede preparar investigación visual sin llamar a eso «v0.2 iniciada».

### Gates G1–G4

- **G1 — Diagnóstico aprobado:** benchmark + auditoría UX/técnica + matriz de oportunidades, sin cambios de producto no autorizados.
- **G2 — Contrato de v0.2 aprobado:** objetivos, alcance, decisiones visuales, prioridades y pruebas.
- **G3 — Lotes integrables:** cada cambio tiene criterio de aceptación, tests pertinentes, capturas y compatibilidad documentada.
- **G4 — Release candidata validada:** recorrido de usuario real completo, regresiones, migraciones, rendimiento y criterios de no-lanzamiento.

### Contrato de trabajo con Codex

- **Una sola etapa por petición.** No anticipar las siguientes ni crear 15 issues automáticamente.
- **Antes de trabajar:** rama/SHA, `git status`, dependencias, documentación selectiva y estado de tests; no asumir que los archivos no han cambiado.
- **Auditoría y diseño:** no tocar código. Entregar tablas, evidencias, pruebas de hipótesis, riesgos y decisiones a aprobar.
- **Implementación:** solo cuando el usuario apruebe alcance y rama. Diff pequeño y revisable, sin nuevos frameworks ni backend.
- **Pruebas:** unitarias y E2E afectadas primero; build y suite global cuando proceda. Señalar tests no ejecutados.
- **Salida de cada etapa:** resumen, entregables, evidencia verificable, dudas/decisiones, deuda y **prompt siguiente sugerido** (sin ejecutarlo).
- **No hacer commit, merge, publicar, elevar versión ni modificar issues** sin petición explícita. Ni tocar archivos de progreso de otras fases sin permiso.
- Respetar `AGENTS.md`, seguridad, rendimiento y presupuesto de contexto. Evitar leer todo el repo sin criterio.

---

## 7. Etapas incrementales (E0–E12)

Cada etapa comienza con la **revisión del estado real**. Estas fases son una secuencia de trabajo propuesta, no requisitos aprobados por el hecho de estar escritas aquí. Los prompts operativos completos están en el archivo complementario `PROMPTS_CODEX_POST_REFACTOR_V0_2.md`.

### E0 — Gate de entrada y fotografía exacta del editor

**Tipo:** diagnóstico, sin desarrollo. **Depende:** G0 o documentación del bloqueo.

**Objetivo:** determinar qué ha quedado después del refactor y evitar duplicar R5. En la foto inicial `e56973f` R4 está integrada y R5 pendiente: ejecutar E0 como auditoría de entrada **después** de terminar R5 o usarlo solo como diagnóstico de bloqueo. Consultar `docs/REFACTOR_PLAN.md`, informes R0–R5 y código de la rama integrada.

**Trabajo:** inventario de rutas, funciones, contratos y comportamientos; comprobar historial, objetos, aperturas, cámaras, grupos, persistencia y responsive; recopilar capturas de referencia y resultados de tests. Identificar diferencias `main`/`dev`/ramas. Separar *comportamiento demostrado* de *presencia en código*.

**Entregables:** `AUDITORIA_BASELINE_V02.md`, tabla de trazabilidad R0–R5 y inventario de inconsistencias con evidencia, SHA/fecha/rama, checklist de estabilidad, capturas con rutas exactas.

**Cierre:** existe una verdad base reproducible; se sabe qué queda por hacer. Si no se puede probar, queda explicitado.

### E1 — Benchmark profundo de Rooms.xyz, MakeRoom y Figma

**Tipo:** investigación, sin desarrollo. **Depende:** E0.

**Objetivo:** observar cómo guían a principiantes sin sacrificar herramientas potentes. No limitarse a comparar capturas.

**Recorridos a investigar:** abrir/editor nuevo, primer objeto, mover/girar/escala/color, organizar, buscar otro objeto, volver atrás, crear muebles, cambiar vista, guardar, retomar y resolver error.

**Método:** materiales oficiales y capturas/vídeos lícitos, juego real solo si está disponible; registrar fuente, fecha, versión, recorrido, evidencia y grado de confianza. Anotar carencias de acceso. Separar **copiar patrón de interacción** de **copiar estética o assets**.

**Entregables:** matriz 15–25 criterios (referencia, proceso, patrón, fricción, posibilidad de adaptación, beneficio, coste, recomendación), 5–10 aprendizajes priorizados y 5 antipatrones a evitar.

**Cierre:** podemos explicar nuestra identidad propia y por qué ciertas funciones se proponen o descartan. Nada de WorkShop para esta versión.

### E2 — Auditoría UX integral y arquitectura de información

**Tipo:** revisión funcional/UX, sin desarrollo. **Depende:** E0/E1.

**Objetivo:** medir si el editor es entendible para personas no técnicas.

**Flujos:** primer inicio, construir habitación, añadir muebles, seleccionar, arrastrar, giro, tamaño, borrar/undo, ocultar, agrupar, cambiar cámara, comparar/guardar, error de colisión, volver a abrir.

**Puntos críticos:** relación entre panel izquierdo, lienzo y panel derecho; acciones primarias vs avanzadas; vocabulario; estados vacíos; microcopy; paneles colapsables; tamaño de controles; orden natural de acciones; orientación espacial. Examinar ratón, táctil y teclado.

**Entregables:** mapa de tareas/flujo, auditoría por pantalla, matriz fricción-severidad/frecuencia, wireframes **solo como propuesta** (sin sustituir el diseño real), criterios de accesibilidad y top 10 problemas de comprensión.

**Cierre:** un plan de UX basado en fricciones demostradas, sin rediseño cosmético de golpe.

### E3 — Identidad visual y design system v0.2

**Tipo:** diseño y especificación; implementación pequeña posterior a aprobación. **Depende:** E1/E2.

**Objetivo:** definir una marca visual coherente sin replicar Rooms.xyz o MakeRoom.

**Auditar:** paleta real y tokens, superficies, tipografía, sombras, iconos de 38 × 33 y viewBox existente, relación icono/modelo, bordes, cuadrícula, selección, fondos y feedback. Crear 2–3 variantes comparables usando **la misma habitación y objetos**; evaluar contraste y rendimiento.

**Entregables:** propuesta de 1 página de principios + tokens propuestos, ejemplos antes/después, reglas para iconos y materiales, listado de incompatibilidades con `VISUAL_STYLE_GUIDE.md`, plan de adopción incremental y presupuesto visual/performance.

**Cierre:** aprobación expresa de dirección y ejemplos antes de cambiar estilos globales. Si no se aprueba, mantener la guía actual.

### E4 — Simplificación del flujo inicial y del espacio de trabajo

**Tipo:** implementación UX incremental. **Depende:** E2 y aprobación del recorte.

**Objetivo:** que alguien sin experiencia empiece a crear en segundos.

**Candidatas:** una acción principal «Crear habitación»; presets locales/sencillos opcionales; catálogo legible; lienzo protagonista; inspector vacío con instrucción; ayudas contextuales; alternancia de ajustes básicos/avanzados; avisos claros en lugar de errores técnicos; recuperar última sesión según contrato acordado.

**Reglas:** no obligar a medidas en el primer paso; no introducir login; no retirar controles expertos; conservar acciones actuales con accesos secundarios; simplificación gradual, no rediseño total en un solo PR.

**Entregables:** flujo funcional + pruebas E2E, capturas y estudio de primer uso; documentación de controles nuevos.

**Cierre:** recorrido «abrir → añadir 3 muebles → cambiar color → guardar» completado sin un tutorial obligatorio, con controles accesibles.

### E5 — Interacción espacial fiable y agrupación estilo Figma

**Tipo:** funcional/estabilidad. **Depende:** E0/E2.

**Objetivo:** hacer predecibles selección, arrastre, agrupación, carpetas y deshacer.

**Comprobar/ajustar:** selección individual y múltiple; Shift/Ctrl y táctil; contexto; orden de capas; grupos anidados; arrastrar grupo vs elemento hijo; bloqueo/ocultación heredada; renombrado; duplicar/cortar/copiar/pegar; IDs estables; posiciones mundo; drop en carpetas; cambio de vista y cancelación de gesto; un único undo por acción.

**Reglas duras:** organizar carpetas **no cambia coordenadas de muebles**; agrupación no rompe relaciones de anclaje; los elementos bloqueados no se mueven accidentalmente; eliminar carpeta no borra su contenido sin confirmación y semántica explícita.

**Entregables:** pruebas de contratos de carpetas, selección y transformaciones; correcciones independientes; documentación de atajos.

**Cierre:** manipular grupos y undo funciona en vista y persistencia, incluida carga posterior.

### E6 — Muebles útiles: dimensiones, colisiones, anclajes y catálogo

**Tipo:** funcional P0. **Depende:** revisión de R5 y E5.

**Objetivo:** disponer de un conjunto pequeño de muebles suficientemente útiles para recrear una habitación real.

**Candidatas:** redimensionar ancho/fondo/alto de tipos compatibles; mínimos/máximos específicos; ajuste opcional; vista previa de inserción; guías de alineación; búsqueda y categorías; proxies de colisión proporcionados; muebles apilables vs alfombras; anclajes pared/techo; relación entre geometría y medidas.

**Advertencia:** nunca escalar ciegamente todo el mesh si deforma patas, marcos, puerta u otros detalles; revisar cada familia. Escalado debe tener significado físico. Medidas en metros, unidades claras, coma decimal en UI cuando proceda.

**Entregables:** catálogo de capacidades por tipo, pruebas parametrizadas de bordes y límites, interacciones, capturas en tres vistas, migración si cambia formato, notas de excepciones.

**Cierre:** cama, mesa/escritorio, armario, asiento y al menos un objeto de pared responden coherentemente a manipulación y guardado; objeto inválido se rechaza con motivo entendible.

### E7 — Cámaras, visibilidad de paredes y navegación

**Tipo:** funcional/UX. **Depende:** E2/E5.

**Objetivo:** elegir una vista sin perder contexto ni mover objetos.

**Trabajo:** probar Plano/Isométrica/POV como principales; Frontal/Libre como herramientas avanzadas; orbitar, zoom, arrastre; orientación de paredes A–D y gizmos; dos paredes ocultas en isométrica; POV ligado a puerta; coherencia de gizmos según vista; controles alternativos en táctil/teclado.

**Entregables:** matriz de cámaras, capturas 4 orientaciones y 5 vistas, tests de visibilidad y controles, reglas de transición, guía breve.

**Cierre:** alternar diez veces entre vistas preserva posición/rotación/visibilidad persistida; una pared oculta por cámara no se confunde con objeto borrado.

### E8 — Guardado local robusto, JSON editable y variantes A/B

**Tipo:** funcional P0 y contratos de datos. **Depende:** R5 integrada, E5/E6 y decisión sobre alcance. **No altera el orden de R5, que debe abordar A/B antes que resize/JSON.**

**Objetivo:** que el usuario conserve, compare y traslade diseños sin depender de servidores.

**Trabajo:** **primero certificar el resultado A/B de R5** (cambio de variante, selección, preferencias, historial, guardado, estructura compartida y muebles aislados); después certificar el redimensionado y JSON que R5 entregue; auditar `PersistedDesign` y migraciones legacy; diseñar/exportar/validar un archivo JSON con *envelope* y versión cuando aún falte; importar sin sobreescrituras implícitas; límite/capacidad de guardados y alternativas; conservar orden de elementos, carpetas anidadas, ocultación, bloqueo, IDs y coordenadas. **Nunca presentar el `projectToPersistedDesignV1` puro de R4 como importación JSON pública.**

**Seguridad:** validar esquema **estricto**, tamaño, números finitos, límites, IDs duplicados, estructura, relaciones padre/hijo, rutas/valores inseguros; no ejecutar código ni fiarse de JSON externo. El GLB exportado sigue siendo **visual, no editable**.

**Entregables:** especificación de formato y compatibilidad, migraciones con fixtures históricos, tests round-trip, importación inválida, 5/5 guardados, fallo de quota y recuperación, pruebas A/B, avisos de cambios.

**Cierre:** `guardar A → duplicar B → mover → recuperar A → exportar JSON → borrar copia de prueba → importar` produce el resultado esperado sin pérdida, sobrescritura ni sorpresas. Si R5 ya lo da, certificar en vez de recrearlo.

### E9 — Estructura constructiva y preparación multihabitación sin construir casas

**Tipo:** revisión de diseño y contratos; implementación solo si bloquea v0.2. **Depende:** R4/E8.

**Objetivo:** evitar que la habitación actual impida casas futuras, sin adelantar el editor multihabitación.

**Auditar:** diferencia habitación base/`StructurePack`, suelos/paredes/techo, ID de habitación, coordenadas de mundo, superficies compartibles futuras, puertas asociadas a pared, duplicación de muros, nombres y jerarquías; referencias de carpetas vs entidad arquitectónica. Aislar modelo de proyecto de presentación. Partir de `ProjectV2` ya integrado; **no proponer otro modelo desde cero**. Documentar el desfase entre el contrato rectangular actual y RB-025 (habitaciones con 1–6 lados y paredes interiores), así como RB-026 (colisión 2D de aberturas/decoración) y RB-027 (medianera única compartida).

**Entregables:** ADR de invariantes y **diferencias respecto al contrato R4 existente**, diagrama de entidades `Project → Floor → Room/Wall/Opening → Layout → Furniture` anotando qué ya existe, lista de riesgos de migración, caso futuro de dos habitaciones con medianera única y criterio de cuándo iniciar un spike aislado sobre geometrías no rectangulares.

**Cierre:** ninguna decisión de v0.2 bloquea explícitamente la futura pared compartida; no existe compromiso de «casas listas».

### E10 — Accesibilidad, táctil, responsive, rendimiento y robustez

**Tipo:** QA técnico y correcciones acotadas. **Depende:** E4–E9.

**Objetivo:** hacer viable la experiencia fuera del ordenador ideal del desarrollador.

**Comprobar:** teclado y foco, etiquetas, contraste, mensajes live, reducir movimiento, targets táctiles, drag/cancel, paneles en pantallas estrechas, scroll sin arrastre accidental, zoom y control de cámara; tiempos con escenas crecientes; fugas de memoria/dispose, renderizados de React/R3F, gasto de GPU, fallos de almacenamiento.

**Métricas:** medir sobre hardware/navegadores reales disponibles; construir baseline reproducible con escenas de 1, 20 y 100 objetos (cargas de prueba, **no promesas de capacidad**). Proponer umbrales tras registrar el rendimiento real. No fingir pruebas de móvil sin dispositivo.

**Entregables:** matriz de dispositivos y navegadores, informe de accesibilidad, tabla de rendimiento *antes/después*, principales regresiones corregidas, límites conocidos.

**Cierre:** casos esenciales operativos en escritorio y en al menos un entorno táctil probado; degradación documentada y no bloqueante, sin pérdida de datos.

### E11 — Prueba de usuarios, evaluación heurística y pulido final

**Tipo:** validación UX, correcciones acotadas. **Depende:** E4–E10.

**Objetivo:** comprobar la promesa de «fácil de entender», no solo que los tests pasan.

**Participantes propuestos:** 3–5 personas que no hayan utilizado Room Builder y, si se puede, al menos una con poca experiencia en herramientas de diseño. Sin guiarlas verbalmente salvo bloqueo por bug.

**Tareas:** crear habitación, insertar cama y mesa, ajustar medidas, probar dos distribuciones, alternar vista, guardar, cerrar/abrir, exportar/importar; pedir «¿qué esperabas que hiciese?» cuando se desvíen.

**Señales a observar:** completitud, tiempo por tarea, pasos de recuperación, clics equivocados, confusión de selección/cámara, conceptos de unidades, intentos de volver atrás, errores inesperados y comentarios espontáneos. No publicar capturas de espacios privados de usuarios sin consentimiento.

**Entregables:** protocolo, resultados agregados anónimos, clasificación de fricciones, decisiones de UX, tres correcciones de mayor impacto y reevaluación breve.

**Cierre:** los principales bloqueos se han mitigado o se documenta un no-go razonado.

### E12 — Release candidate, auditoría integral y v0.2

**Tipo:** integración, QA final y propuesta de publicación. **Depende:** G3/E0–E11 pertinentes.

**Objetivo:** demostrar con evidencias que el editor es más útil, intuitivo y estable que la base de partida.

**Comprobar:** alcance P0, pruebas unitarias/e2e/build, comparación visual, migraciones y archivos históricos, escenas antiguas, JSON/GLB, variantes A/B, grupos, cámaras, dispositivos, importación malformada, rendimiento, licencias, documentación, errores conocidos y reversibilidad.

**Entregables:** `V0_2_RELEASE_AUDIT.md`, changelog **propuesto**, matriz requisitos/evidencia, riesgos residual, instrucciones de rollback, instrucciones de actualización y decisión `GO / NO-GO`.

**Cierre:** solo el propietario autoriza cambiar versión, crear tag/release, merge o despliegue. Ninguna etiqueta «v0.2» se da por publicada si no hay autorización y ejecución verificadas.

---

## 8. Matriz transversal de auditoría (aplicable en E0 y E12)

| Dimensión | Preguntas y evidencia requeridas |
|---|---|
| Arranque | ¿La primera acción es obvia? ¿Existe ejemplo local? ¿La sesión se recupera correctamente? |
| Modelo espacial | ¿Coordenadas invariantes entre vistas? ¿Los ejes XYZ/unidades se documentan y respetan? |
| Estructura | ¿Suelos, paredes y huecos tienen IDs/relaciones válidos? ¿No hay paredes falsas? |
| Objetos | ¿Todos tienen medidas/capacidades/miniaturas coherentes? ¿Hay escalado semántico? |
| Selección | ¿Seleccionar sobre modelos, en árbol y en grupos produce el mismo resultado? |
| Manipulación | ¿Movimiento/giro/tamaño/altura/colisiones y undo funcionan al cancelar? |
| Jerarquía | ¿Orden, carpetas, visibilidad y bloqueo sobreviven al guardar, duplicar e importar? |
| Cámaras | ¿Plan/iso/POV responden y no modifican el mundo? ¿Frontal/Libre siguen operativas? |
| Persistencia | ¿Los formatos antiguos se abren? ¿JSON editable round-trip? ¿Se detectan archivos peligrosos? |
| Variantes | ¿A y B no se sobrescriben? ¿Se explican cambios compartidos en estructura? |
| UX | ¿Nombres, botones, mensajes y ayuda se entienden sin tutorial largo? |
| Accesibilidad | ¿Teclado, foco, contraste, `aria` y reduce-motion funcionan? |
| Táctil | ¿Gestos no disparan acciones dobles, scroll involuntario o arrastres perdidos? |
| Rendimiento | ¿Perfil estable para escenas pequeñas/medianas/grandes? ¿Se liberan recursos? |
| Privacidad | ¿No se envían planos ni diseños a servidores? ¿Se comunica almacenamiento local? |
| Documentación | ¿README, guías, decision log y comportamiento coinciden? |

**Escala para resultados:** `OK con evidencia`, `Parcial`, `Fallo`, `No implementado`, `No probado`. No usar «OK» por ausencia de errores en consola.

---

## 9. Pruebas de aceptación: escenarios de referencia

**Caso A — Habitación real.** Crear habitación de medidas explícitas, situar puerta/ventana, añadir cama/escritorio/armario, ajustar anchura de un mueble, comprobar restricciones en planta/iso/POV y guardar. Resultado: proporciones coherentes y ningún elemento fuera de límites.

**Caso B — Experimento A/B.** Duplicar distribución Original como Propuesta B, mover dos muebles y cambiar color. Alternar: Original permanece idéntica. Si se cambia una pared, el sistema debe dejar claro si modifica la estructura compartida o una variante independiente según contrato aprobado.

**Caso C — Inspector y grupos.** Crear carpeta «Dormitorio», meter cama, mesa y decoración, anidar «Iluminación», bloquear uno, ocultar la carpeta, renombrar, restaurar y recargar. Resultado: orden, IDs, visibilidad, bloqueo y posiciones idénticos donde corresponde.

**Caso D — Cámaras.** En secuencia: iso → planta → POV → frontal → libre → iso; orbitar 4 diagonales, zoom y volver. Resultado: objetos inmóviles en el mundo; las paredes ocultas por perspectiva no pasan a estado «oculto por el usuario».

**Caso E — JSON editable.** Exportar diseño completo, importarlo en otra sesión/navegador de prueba, comparar datos semánticos y apariencia. Incluir proyectos antiguos y entradas rechazadas. Ningún sobrescrito implícito de proyectos ajenos.

**Caso F — Persistencia adversa.** Cargar proyecto con carpetas anidadas/orden modificado, cerrar pestaña, reabrir, provocar storage full en entorno de test y comprobar aviso sin pérdida silenciosa. Verificar compatibilidad legacy.

**Caso G — Uso táctil.** Añadir, seleccionar, mover, cambiar vista, abrir/cerrar panel, modificar número y guardar. No exigir hover ni ratón central para acciones imprescindibles.

**Caso H — Primer usuario.** Sin instrucciones previas, crear y guardar una variante. Recoger bloqueos y vocabulario confuso sin orientar al participante.

**Caso I — Grandes escenas de prueba.** Importar escenarios sintéticos con 1/20/100 objetos, medir input responsiveness, fps, memoria y tiempos según hardware registrado. No convertir esas cifras en requisitos universales sin evaluación.

**Caso J — Exportación GLB.** Comprobar que exporta solo la geometría prevista y que un archivo GLB no se presenta como formato editable del proyecto.

---

## 10. Riesgos, mitigaciones y decisiones reservadas

### Riesgos de producto

1. **El editor se convierte en Figma 3D complejo:** mitigación = mostrar solo controles contextuales y probar con principiantes.
2. **Se imitan otros juegos sin valor propio:** mitigación = guía visual propia y criterios de uso real.
3. **La comunidad consume tiempo antes del editor:** mitigación = backlog congelado y separación física de informes.
4. **R5 duplicado por v0.2:** mitigación = gate E0 + trazabilidad por commit/PR/test. La v0.2 consume y mejora lo entregado, no crea una R5 paralela.
5. **Se buscan cientos de assets en vez de usabilidad:** mitigación = familias de muebles útiles, redimensionado y límites coherentes.

### Riesgos técnicos

1. **JSON externo rompe diseños:** validador fuerte, límites y migraciones probadas.
2. **Grupos pierden IDs/posiciones:** contratos de transformaciones en mundo, fixtures de carpetas anidadas y pruebas de undo.
3. **El escalado deforma modelos o anclajes:** capacidades por tipo/familia, no escalado global indiscriminado.
4. **Una casa futura duplica muros:** R4 ya representa una sola `WallV2` con dos `roomIds`; auditar la elección RB-027 al ampliar geometría sin introducir muros duplicados.
5. **Geometría 1–6 lados vs R4 rectangular:** RB-025 es dirección confirmada para el futuro, pero exige revisar validadores, cámaras, paredes, anclajes, guardado y migraciones; **no implementarla en la v0.2 por inercia**.
6. **Rendimiento degradado por estilo/objetos:** medir, perf baseline y no cargar recursos pesados de inicio.
7. **Discrepancias `main`/`dev`/rama:** trazabilidad exacta por SHA y comparación antes de cada lote.
8. **Tests E2E verdes pero UX mala:** incluir pruebas de tareas reales no técnicas.
9. **Privacidad:** sin cargas de planos ni telemetría de producción por defecto.

### Decisiones que requieren aprobación humana

- Definición final P0/P1/P2, tamaño de v0.2 y funcionalidades que salen si hay conflicto.
- Cambio de identidad visual/tokens, wireframe principal, modo básico/avanzado y cambios de comportamiento.
- Modelo definitivo Project/Room/Layout y regla de edición de estructura compartida vs variantes.
- Política de colisiones intencionales, catálogo mínimo y límites de medidas.
- Formato JSON público, migraciones destructivas y cambios de almacenamiento.
- Esquema de pruebas, tolerancias y umbrales de rendimiento sobre dispositivos objetivo.
- Ramas, PR, commits, versionado, release, despliegue o publicación.
- Renombrado futuro de la marca y cualquier roadmap social/multihabitación ejecutable.

---

## 11. Backlog congelado / posterior a v0.2

### Después del editor local estable

- **Futura v0.3 (orientativo, NO aprobado):** experimento de dos habitaciones contiguas, medianera única compartida, puerta de conexión y plano general; estudiar previamente la decisión RB-025 sobre habitaciones de 1–6 lados y paredes interiores. Requiere ADR, migración y pruebas previas.
- **Expansión posterior:** múltiples plantas, recorridos interiores, estructura de edificio, catálogo de objetos personalizados y formatos más ricos.
- **Workshop/red social:** informe de futuro ya preparado por el propietario; importar/publicar copias, autoría, permisos, seguridad, licencias, moderación, cuentas y buscador comunitario se tratarán solo en planificación separada.
- **Mini del portfolio:** otro alcance y fecha; nunca mezclar cambios del editor completo con la demo sin aprobación.

No hay fechas prometidas ni nuevos issue IDs asignados.

---

## 12. Instrucciones de uso del plan con Codex

1. Copiar este archivo y el complementario de prompts a una carpeta documental del repositorio **solo cuando se decida**; ubicaciones sugeridas: `docs/roadmaps/v0.2/`.
2. **No enviar todo el informe como tarea ejecutable en cada chat.** Codex lo consulta como contexto y recibe **un prompt de etapa** del archivo complementario.
3. Empezar por **E0** únicamente cuando el refactor haya terminado o se quiera auditar su cierre. E0 puede detectar que todavía no se puede iniciar v0.2.
4. Después de una etapa, revisar sus entregables y aprobar o descartar las propuestas. No dar el prompt siguiente hasta que el gate anterior esté satisfecho.
5. Para tareas de implementación, dividir internamente en PR/commits pequeños **solo con autorización** y sin mezclar cambios incompatibles.
6. Tras un cambio de rama, refactor o entrega, actualizar en el **mismo informe de progreso por fase** la evidencia y el estado de tareas (no generar reportes contradictorios por cada subpaso).
7. Antes de «v0.2» no basta con cambiar `package.json`: hace falta la revisión E12, un `GO` humano y la publicación autorizada.

**Formato de revisión humana al cerrar una etapa:**

```text
Etapa: E# · SHA/rama comprobados:
Estado: COMPLETADA / PARCIAL / BLOQUEADA / NO INICIADA
Qué se ha inspeccionado/cambiado:
Evidencia: tests, capturas, rutas, comparación y casos
Regresiones/bloqueos:
Decisiones nuevas a aprobar (sin resolver por suposición):
Recomendación: seguir / corregir / recortar alcance
Siguiente prompt sugerido (NO ejecutado):
```

---

## 13. Fuentes y trazabilidad

### Repositorio (comprobar su contenido al ejecutar cada fase)

- [Room Builder, repositorio privado](https://github.com/Pablo-hg/Room-Builder)
- `AGENTS.md`, `README.md`, `docs/README.md`.
- `docs/REFACTOR_PLAN.md`, `docs/progress/R3_PROGRESS.md`, `docs/progress/R4_PROGRESS.md` (integrado, pero conserva contexto premerge).
- `src/domain/projectV2.ts`, `src/domain/projectVariants.ts`, `src/domain/productCapabilities.ts`, `src/persistence/projectMigration.ts` y sus pruebas (R4 puro).
- [PR #19: R4 a `dev`](https://github.com/Pablo-hg/Room-Builder/pull/19) y [PR #20: `dev` a `main`](https://github.com/Pablo-hg/Room-Builder/pull/20), merge en `e56973f`.
- `docs/PRODUCT_VISION.md`, `docs/MVP_SCOPE.md`, `docs/UX_AND_CAMERAS.md`.
- `docs/DATA_AND_FORMATS.md`, `docs/DECISION_LOG.md`, `VISUAL_STYLE_GUIDE.md`.
- `src/App.tsx`, `src/components/editor/*`, `src/state/useRoomStore.ts`, `src/state/actions/*`, `src/domain/*`.

### Referencias oficiales externas (consulta 03/11/2026)

- [Rooms.xyz, página oficial](https://rooms.xyz/).
- [Rooms por Things Inc., presentación oficial](https://things.inc/rooms).
- [Rooms 4.0, anuncio de 05/08/2026](https://news.rooms.xyz/rooms4.html).
- [MakeRoom, ficha oficial de Steam](https://store.steampowered.com/app/2212670/MakeRoom/).
- [Figma, producto](https://www.figma.com/).

### Nota metodológica

Las referencias públicas acreditan prestaciones **promocionadas o documentadas**, no necesariamente cada microinteracción real. Una auditoría comparativa UX completa necesita observación del producto funcionando, capturas/filmaciones autorizadas y trazabilidad. Este plan no implica que se haya jugado a MakeRoom ni que se hayan ejecutado tests de Room Builder en esta conversación.

---

## 14. Anexo — reconciliación documental de `main` (03/11/2026)

Este anexo **no altera el repositorio remoto**. Enumera qué habría que corregir en la documentación canónica al cerrar/arrancar R5:

| Archivo de `main` | Problema detectado | Corrección documental recomendada |
|---|---|---|
| `docs/REFACTOR_PLAN.md` | El encabezado presenta R4 como cambios locales no integrados; ya hay merge a `main`. | Encabezado de estado **R4 integrado en `e56973f` mediante PR #19/#20; R5 pendiente**. Dejar el texto histórico de la rama R4 como registro de ejecución, no como estado actual. |
| `docs/progress/R4_PROGRESS.md` | Últimas líneas indican «sin commits ni integración», correcto solo cuando se produjo el informe. | Añadir epílogo posterior a la integración (fecha, commits y **sin nuevas pruebas ejecutadas en esta comprobación**) preservando las 189 pruebas históricas. |
| `README.md` | Dice «no hay selección múltiple» aunque hay `selectedIds` y acciones de selección en `ObjectsPanel`/`selectionActions`. | Diferenciar «hay implementación de selección múltiple en código» de «UX/E2E completos sin validar»; no prometer transformaciones conjuntas si no se han probado. |
| `docs/MVP_SCOPE.md` | El diagnóstico final sigue fechado el 26/10 y no menciona el contrato R4 integrado. | Añadir nota de estado **sin** cambiar el alcance: `ProjectV2` es solo dominio puro y las variantes aún no operan en la UI. |
| `docs/DECISION_LOG.md` | Ya contiene RB-025, RB-026 y RB-027, pero falta vincularlos a la hoja de ruta posrefactor. | Conservar el registro y enlazar la revisión cuando se apruebe; mantener separadas las decisiones confirmadas de su implementación. |

**Límites de verificación:** se leyó documentación y código vía GitHub; **no** se hizo checkout ejecutable, `npm install`, pruebas, Playwright ni inspección visual. Los resultados `189/189` proceden del informe R4 y no deben presentarse como revalidación en `main`.

---

**Fin del plan maestro actualizado. El archivo `PROMPTS_CODEX_POST_REFACTOR_V0_2.md` contiene las órdenes operativas separadas por etapa.**

---

# Parte 3 — Prompts para Codex

# Room Builder v0.2 — Prompts independientes para Codex, uno por etapa

**Revisión 1.1 · 03/11/2026 · `main` comprobado en `e56973f`.**

**Uso:** copiar **SOLO el bloque correspondiente** al momento real del desarrollo. No enviar todos los bloques a la vez ni interpretar los siguientes como trabajo autorizado. Estos prompts presuponen que el archivo hermano `el apartado «Plan maestro» de este mismo documento` está disponible para consulta en la misma carpeta. El plan maestro está incluido en este mismo documento; consulta su apartado correspondiente.

**Estado de partida verificado:** `main` = `e56973f` (PR #20); **R0–R4 integradas**, **R5 pendiente**. R4 aporta dominio puro `ProjectV2`, migración, variantes, capacidades y pruebas, **sin UI ni nuevo guardado**. `docs/REFACTOR_PLAN.md` contiene un encabezado histórico de R4 desactualizado respecto a la integración. **No reimplementar R4.** La etiqueta v0.2 es objetivo, no orden de publicación. Este estado deberá revalidarse en cada nueva sesión; no se da por vigente indefinidamente.

---

## PRE-E0 — Comprobación de R5 (usar mientras continúe pendiente; no es una etapa v0.2)

```text
CONTEXTO
Repositorio: Pablo-hg/Room-Builder. Fotografía documental del 03/11/2026: main e56973f, R0–R4 integradas mediante PR #19 y #20; R5 pendiente. El contrato ProjectV2 de R4 es puro; no hay UI de variantes ni persistencia V2 pública.

TAREA ACTUAL: SOLO DIAGNOSTICAR Y DESGLOSAR R5. NO IMPLEMENTAR SIN UN LOTE Y RAMA AUTORIZADOS.

1. Comprueba rama, git status, origin/main y origin/dev; no des por vigente el SHA histórico.
2. Lee docs/REFACTOR_PLAN.md (R4 y R5), docs/DECISION_LOG.md (RB-021–027), docs/progress/R4_PROGRESS.md, docs/DATA_AND_FORMATS.md y SOLO los archivos de código necesarios.
3. Reconoce R4 como YA INTEGRADA; comprueba ProjectV2, projectVariants, productCapabilities y projectMigration como contratos puros. No escribir una segunda arquitectura.
4. Desglosa R5 en este orden acordado: R5.1 comparar Original/Alternativa A en una habitación (selección, preferencias, historial, guardado, cambios estructurales y recuperación); R5.2 redimensionado del mobiliario compatible; R5.3 JSON editable seguro/versionado; R5.4 simplificación UX SOLO según decisiones aprobadas. Ajusta nombres/subfases si el plan vigente ya los detalla.
5. Define para cada lote: prerequisitos, archivos, riesgos de formato/compatibilidad, criterios de aceptación, pruebas unitarias/E2E/build y estado real de implementación.
6. RB-025 define futuras formas de 1–6 lados y paredes interiores; NO implementarlas como parte implícita de R5. RB-026/027 son invariantes futuras documentadas, no una UI ya entregada.
7. Resume el cierre necesario para poder ejecutar E0 posteriormente. Identifica el desfase documental de encabezados R4 sin borrar historia.

ENTREGA: tabla R5 por subfase y propuesta del PR/lote siguiente. Sin código, commit, versión, merge, issues ni Workshop. Si R5 ya está integrada cuando ejecutes esto, no desglosarla de nuevo: indicar pasar a E0.
```

---

## E0 — Gate inicial: cerrar el refactor y construir baseline

```text
CONTEXTO
Proyecto: Pablo-hg/Room-Builder. Queremos preparar una hoja de ruta posterior al refactor hacia v0.2, con editor local primero, facilidad de uso máxima, estética 3D geométrica cartoon/cozy y organización tipo Figma. Workshop/red social fuera del MVP.

TAREA ACTUAL: SOLO E0. AUDITORÍA; NO IMPLEMENTAR.

Lee selectivamente AGENTS.md, docs/README.md, docs/REFACTOR_PLAN.md, docs/DECISION_LOG.md, los informes de progreso relevantes y el apartado «Plan maestro» de este mismo documento (etapas, gates). No leas indiscriminadamente todo el repositorio.

1. Comprueba el repositorio y el estado real: rama activa, SHA, git status, remotos actualizados y diferencias main/dev/ramas de refactor. Nunca sobrescribas cambios locales. Si el remoto no está disponible, indícalo claramente.
2. Comprueba para R0, R1, R2, R3, R4 y R5: integrado en rama estable, solo en rama, parcialmente hecho, pendiente o no verificable; cita archivos y evidencias de PR/commit/tests. Como punto de partida histórico, R4 llegó a `main` por PR #19/#20, mientras R5 estaba pendiente; corrige el diagnóstico si hay commits posteriores.
3. Revisa los flujos existentes de habitación, objetos, inspección, selección múltiple, carpetas/grupos, movimiento, giro, cámaras, exportación, guardado y restauración; identifica contradicciones entre docs y código. Ejemplo concreto a verificar: README habla de ausencia de selección múltiple mientras el store contiene selectedIds.
4. Ejecuta únicamente verificaciones de lectura y tests seguros: npm test, npm run test:e2e, npm run build, según disponibilidad; registra versión de entorno, resultados, fallos históricos y tests que no se pudieron correr. Haz capturas de baseline si la aplicación puede arrancar. NO confundas tests con inspección visual.
5. Prepara una matriz de trazabilidad: Función | R4/R5 prevista | Implementación real | Evidencia | Estado | ¿Trabajo pendiente para v0.2? Incluye explícitamente `ProjectV2` (puro), variantes (puras vs UI), persistencia v1–v4, JSON editable, resize, grupos/selección múltiple, RB-025 y RB-026/027.
6. Devuelve si está cumplido Gate G0, qué bloquea la v0.2 y el orden mínimo para cerrar el refactor si sigue incompleto.

ENTREGA
- Diagnóstico ordenado con SHA/rama verificables.
- Matriz completa R0–R5 y baseline funcional/visual.
- Lista P0 de inconsistencias con reproducción.
- Recomendación CONTINUAR / NO CONTINUAR con v0.2 y justificación.
- Siguiente prompt recomendado: E1, **solo si R5 está integrada y G0 superado**; de lo contrario el siguiente trabajo es cerrar R5, no iniciar v0.2.

RESTRICCIONES: NO cambiar código, package.json, versión, documentación, issues, ramas, commits, PR, merges o releases. NO ejecutar etapas E1–E12. Si la información no existe, marcar NO VERIFICADO, nunca inventarla.
```

---

## E1 — Benchmark de Rooms.xyz, MakeRoom y Figma

```text
CONTEXTO
Room Builder v0.2: editor local fácil de usar, con estética geométrica cartoon/cozy, soporte de medidas y organización tipo Figma. El Workshop, la comunidad, la IA y la construcción de edificios completos quedan fuera. G0 ya debe estar satisfecho.

TAREA ACTUAL: SOLO E1. INVESTIGAR; NO IMPLEMENTAR.

Consulta AGENTS.md y el apartado «Plan maestro» de este mismo documento. Toma como referencias Rooms.xyz (incluida versión 4.0), MakeRoom (Kenney) y Figma. Recurre a documentación oficial y, si es posible y tienes acceso, a sesiones/capturas reales del producto; indica exactamente qué observaste y qué solo conoces por fuentes publicadas. No afirmes haber jugado a MakeRoom si no se ha instalado/ejecutado.

Investiga de manera sistemática:
- Primer uso, crear proyecto/escena, elegir plantilla y colocar el primer objeto.
- Selección, arrastre, rotación, tamaño, color, inspector y manipulación de cámara.
- Catálogo, búsqueda, categorías, objetos personalizados y feedback de error.
- Jerarquía/agrupación, atajos, deshacer/rehacer y guía de aprendizaje opcional.
- Guardar, recuperar, exportar y separación entre edición y contenido social.
- Qué simplifica cada producto y qué complejidad oculta al principiante.

Prepara una matriz de 15–25 criterios: producto, evidencia con URL/versión/fecha, interacción, ventaja, inconveniente, aplicabilidad y prioridad en Room Builder. Distingue explícitamente ADOPTAR EL PATRÓN, ADAPTAR y DESCARTAR. No copiar assets, código, pantallas ni marca.

Contrasta cada aprendizaje con las funciones ya implementadas en Room Builder según E0; evita recomendar como nueva una capacidad ya existente.

ENTREGA: informe benchmark, 5–10 oportunidades priorizadas, 5 antipatrones, riesgos y propuestas pendientes de aprobación. Indica limitaciones de investigación. Sugiere E2 como siguiente etapa pero NO la ejecutes.

RESTRICCIONES: No tocar código, documentación existente, issues, versionado, git o funcionalidades. No abrir una tarea de Workshop.
```

---

## E2 — Auditoría UX e información del editor actual

```text
CONTEXTO
Esta etapa ocurre DESPUÉS de E0/E1. Estamos valorando Room Builder como editor local para gente sin experiencia en 3D. La identidad buscada es propia, no copiar Rooms.xyz/MakeRoom/Figma. No implementar aún.

TAREA ACTUAL: SOLO E2. INSPECCIÓN UX/ACCESIBILIDAD PREVIA.

Lee el apartado «Plan maestro» de este mismo documento (E2 y matriz transversal), AGENTS.md, docs/UX_AND_CAMERAS.md, docs/MVP_SCOPE.md y los componentes afectados. Usa aplicación en navegador y capturas si está disponible; no digas que validaste visualmente algo que solo has leído.

Realiza recorridos completos de:
A) Nuevo usuario: crear habitación, añadir cama/escritorio/silla, mover, cambiar color, guardar.
B) Persona que mide un espacio: tamaños, puerta, ventanas, límites, snap y cámaras.
C) Usuario avanzado: árbol, carpetas, multi-selección, ocultar/bloquear, copiar/pegar, deshacer.
D) Recuperación: recargar, abrir guardado, resolver error y comparar distribuciones si ya existen.
E) Táctil/teclado: alternativas a hover, rueda y botón central.

Examina arquitectura de información: panel izquierdo, lienzo, inspector derecho, selector de vistas, menús y propiedades. Detecta exceso de controles, nombres poco claros, microcopy, estados vacíos, consistencia visual y feedback de acciones. Clasifica problemas por gravedad e impacto; aporta pasos reproducibles y captura cuando sea viable.

ENTREGA: mapa de flujos, matriz de fricciones, top 10 UX, propuesta de simplificación por revelación progresiva, wireframes textuales o bocetos conceptuales SOLO si aportan algo, criterios de éxito medibles y lista de decisiones a aprobar. Distingue errores funcionales de opiniones estéticas.

RESTRICCIONES: NO cambiar código, estilos, documentos, ramas, issues o versión. NO comenzar E3/E4. Pregunta por aprobación solo si es imprescindible para avanzar en la etapa siguiente, no para concluir el informe.
```

---

## E3 — Identidad y sistema visual propios

```text
CONTEXTO
Room Builder es un editor local 3D de estética cartoon geométrica/cozy; no pixel art, CAD ni hiperrealismo. Tenemos benchmark E1 y auditoría UX E2. La versión v0.2 debe conservar buen rendimiento y ser accesible.

TAREA ACTUAL: SOLO E3. PROPONER ESTILO Y TOKENS, SIN RESTYLING AUTOMÁTICO.

Lee VISUAL_STYLE_GUIDE.md, docs/PRODUCT_VISION.md, docs/DECISION_LOG.md, el catálogo tipado, registro de iconos y estilos actuales; usa las capturas baseline de E0. El diseño visual confirmado en la guía vigente es la referencia hasta aprobación de otra.

1. Audita paleta, fondos, tipografía, bordes, sombras, estados, iconos, materiales y relación icono/objeto 3D.
2. Propón 2–3 direcciones visuales realmente comparables para la MISMA habitación, con pros/contras. Mantén siluetas legibles y medidas plausibles.
3. Propón la dirección preferida como tokens y reglas: materiales mates, color, contraste, efectos, hover/focus, selección, iconos, miniaturas y cámara. Evita CSS/Three shaders costosos por estética.
4. Indica exactamente qué difiere de VISUAL_STYLE_GUIDE.md y por qué; no sobreescribas una decisión CONFIRMADA.
5. Propón plan de implantación por componentes con tests de regresión visual y perfiles de FPS, NO un diff gigantesco.

ENTREGA: guía propuesta, comparación antes/después si realmente puedes generar capturas, mapa de tokens/cambios y decisiones humanas pendientes. Al terminar, recomendar E4 sin ejecutarlo.

RESTRICCIONES: No aplicar cambios visuales masivos ni crear assets copiados. No modificar documentación canónica, generar código o hacer commits sin aprobación de la variante elegida.
```

---

## E4 — Simplificar el primer uso y el editor sin perder potencia

```text
CONTEXTO
Room Builder v0.2 editor local. E0–E3 están revisadas. Trabaja sobre el estado real de la rama acordada, no sobre supuestos históricos. El usuario final debe poder empezar sin conocimientos 3D. Workshop/social fuera.

TAREA ACTUAL: E4. IMPLEMENTAR SOLO UN LOTE UX ACORDADO.
LOTE APROBADO POR EL PROPIETARIO: [DESCRIBIR AQUÍ 1–2 MEJORAS CONCRETAS DE E2/E3]
RAMA AUTORIZADA: [RAMA]

Si faltan lote o rama aprobados, no modifiques nada: entrega propuesta mínima para su aprobación.

Antes de editar: git status, rama y SHA; AGENTS.md, archivos del flujo relevante y tests; evita pisar otros trabajos.
Implementa el lote mínimo con estos principios:
- El lienzo es protagonista, el inspector muestra propiedades contextuales y el primer inicio ofrece acción clara.
- Medidas avanzadas son opcionales; no eliminar capacidades existentes.
- Ayudas de primer uso opcionales y saltables, sin servidor.
- Estados vacíos/errores en español claro; todo control esencial accesible mediante teclado y táctil.
- No cambiar arquitectura/contratos de datos ni diseño global salvo autorización expresa.

Prueba recorrido «crear → añadir tres objetos → mover → guardar», todos los tests afectados, e2e pertinente y build según alcance. Toma capturas antes/después si existe entorno visual. Compara accesibilidad y regresiones.

ENTREGA: archivos y cambios, evidencia, tests ejecutados/fallados, limitaciones y propuestas del siguiente lote; NO empieces E5.

RESTRICCIONES: No crear PR/commit/tag, no publicar, no versionar, no crear issues ni implementar Workshop.
```

---

## E5 — Selección, jerarquía, carpetas y transformaciones estilo Figma

```text
CONTEXTO
Etapa E5 posterior al diagnóstico E0 y UX E2. Room Builder combina edición espacial 3D con árbol/inspector tipo Figma. Ya existe base de multi-selección y carpetas: NO rehacer lo implementado.

TAREA ACTUAL: E5. AUDITAR COMPLETAMENTE Y CORREGIR SOLO EL LOTE APROBADO.
LOTE: [FALLO O SUBCONJUNTO CONCRETO APROBADO]
RAMA: [RAMA AUTORIZADA]

Si faltan lote/rama, no tocar código: devolver incidencias priorizadas y propuesta de tareas aisladas.

Inspecciona src/components/editor/ObjectsPanel.tsx, src/domain/elementFolders.ts, src/state/actions/{folderActions,selectionActions}.ts, tienda/contrato persistido y escena. Consulta documentos de dominio pertinentes y pruebas.

Cubrir: selección individual y múltiple por lista/lienzo, Shift/Ctrl, toque; selección de grupo vs hijo; mover carpeta/ítem, orden, anidamiento, ocultar/bloquear, renombrar, copiar/pegar, duplicar, eliminar/desagrupar; gestos y un undo por operación; reload.

INVARIANTES:
- Reorganizar árbol no altera coordenadas mundo.
- No perder IDs, posiciones, carpetas, estado visible/bloqueado ni orden de lista tras guardar.
- No permitir ciclos de carpetas ni borrar contenido sin semántica clara.
- Mantener compatibilidad con diseños históricos y con vistas/cámaras.
- Probar límites y errores sin ocultar fallos.

Aplica solo correcciones autorizadas, en cambios pequeños, con tests de dominio/estado/E2E afectados, y documenta exactamente qué no se ha validado.

ENTREGA: tabla de hallazgos, cambios, pruebas, riesgos, siguiente lote. NO continuar E6.
RESTRICCIONES: sin commit/merge/versionado/publicación/issues ni introducción de sistemas online.
```

---

## E6 — Redimensionado útil, reglas de mobiliario y catálogo

```text
CONTEXTO
Room Builder v0.2 busca planificar habitaciones reales sin perder estética cartoon. El catálogo ya existe. La fase R5 debe intentar entregar redimensionado DESPUÉS de la primera comparación A/B; comprobar su estado real antes de escribir, sin duplicar lo integrado.

TAREA ACTUAL: E6. IMPLEMENTAR SOLO LAS FAMILIAS/CORRECCIONES APROBADAS.
FAMILIAS/OBJETOS APROBADOS: [INDICAR: p. ej. cama, mesa y armario]
RAMA AUTORIZADA: [RAMA]

Si falta autorización de familia/alcance/rama, entregar evaluación técnica y propuesta, sin código.

Consulta AGENTS.md, docs/MVP_SCOPE.md, docs/OBJECTS_AND_ASSETS.md, docs/DATA_AND_FORMATS.md, VISUAL_STYLE_GUIDE.md, catálogo y módulos de geometría/colisiones/modelos del estado actual.

1. Inventaria resize por tipo y cuáles lo soportan realmente. Define por objeto capacidades, límites y unidad.
2. Evita escalar mallas indiscriminadamente: conserva proporciones, detalles y anclajes; prueba tamaños mínimo/máximo.
3. Comprueba límites de habitación, colisiones, apilado, objetos de pared, techo y alfombras. Mensajes específicos y undo coherente.
4. Valida inserción, selección, inspector, miniatura, persistencia, copiar/pegar, GLB y tres vistas principales.
5. Ajusta solo el catálogo o feedback aprobado (categorías/búsqueda/preview); no inflarlo con decenas de modelos nuevos.

ENTREGA: contrato de capacidades por objeto, diff acotado, tests unitarios/estado/E2E y capturas por vista, incompatibilidades y próximos objetos. NO pasar a E7.
RESTRICCIONES: sin nueva IA, backend, Workshop, reescritura, commits, release o migraciones sin pruebas y autorización.
```

---

## E7 — Coherencia de cámaras, paredes y controles

```text
CONTEXTO
Room Builder dispone de vistas plano, isométrica, interior (POV), frontal y libre. El estado de diseño pertenece al mundo, no a la cámara. Necesitamos UX coherente para usuarios no técnicos.

TAREA ACTUAL: E7. REVISAR CINCO VISTAS; CORREGIR SOLO EL LOTE APROBADO.
LOTE APROBADO: [PROBLEMAS DE CÁMARA / CONTROL CONCRETOS]
RAMA: [RAMA]

Si no hay lote aprobado, hacer solo matriz de diagnóstico y proponer correcciones, sin código.

Lee docs/UX_AND_CAMERAS.md, módulos de cámara/visibilidad, controles de vista y E0. Comprueba isométrica y sus cuatro orientaciones, plano, POV desde puerta, frontal y libre; mide zoom/orbit, etiquetas de pared, gizmos, ocultación temporal de dos paredes en iso, selección y controles alternativos en táctil/teclado.

Crea tests/capturas antes de modificar si faltan. Mantén Frontal y Libre hasta decisión expresa. Nunca traslades un objeto al cambiar de vista. Distingue paredes invisibles para cámara de elementos ocultos por usuario.

Corrige únicamente los errores autorizados sin introducir otra librería o navegación FPS.

ENTREGA: matriz por vista, capturas y recorridos, evidencia de posiciones inmutables, pruebas, regresiones y siguientes propuestas. NO pasar a E8.
RESTRICCIONES: no commits ni publicaciones ni cambio de versión.
```

---

## E8 — Proyectos locales, JSON editable y comparación A/B

```text
CONTEXTO
Editor local primero. E8 solo después de comprobar qué han entregado R4/R5. El usuario debe preservar su trabajo y compararlo. GLB es modelo visual, no formato de edición; `src/persistence/projectMigration.ts` de R4 es migración pura, NO importación/exportación JSON pública.

TAREA ACTUAL: E8. AUDITORÍA DE CONTRATO + SOLO SUBLOTE APROBADO. La prioridad A/B → resize → JSON corresponde a R5; en v0.2 se certifica o mejora lo que falte, no se cambia ese orden.
SUBLOTE: [FORMATO/MIGRACIONES O VARIANTES O UX DE GUARDADO]
RAMA: [RAMA]

Si el contrato no está aprobado, no desarrollar: proponer esquema y casos límite para una decisión humana.

Consulta docs/DATA_AND_FORMATS.md, docs/MVP_SCOPE.md, persistencia, migraciones, estado, fixtures y acciones de diseño. Comprueba primero lo que ya existe en el código actual.

Contrato esperado para JSON editable: envelope versionado que no dependa de la marca comercial; schema de diseño interno migrable; validación de tipo, números finitos, tamaños máximos, IDs, carpetas, geometría y atributos; importación como copia sin sobreescritura silenciosa; mensajes de errores recuperables; pruebas con legacy y payloads malformados.

Variantes A/B: comprobar primero la UI y persistencia real de R5; `src/domain/projectVariants.ts` de R4 por sí solo NO constituye funcionalidad pública. Proteger Original, duplicar y alterar solo el estado correcto; especificar expresamente qué datos estructurales se comparten y cuáles no, cómo se aíslan selección, preferencias e historial y qué pasa al cambiar estructura. Cambiar cámara no debe guardarse como movimiento de objetos. Conservar orden, nombres, ocultación, bloqueo y asignaciones.

CASO DE ACEPTACIÓN: guardar A → duplicar B → mover → volver A → exportar editable → importar como copia → comparar equivalencia; test adverso con slots completos, storage full y JSON inválido.

ENTREGA: ADR de formato, matriz de compatibilidad, implementación SOLO si fue aprobada, pruebas y riesgos, plan de recuperación. NO hacer versión/release ni pasar a E9.
RESTRICCIONES: no backend ni nube ni Workshop; no borrar formatos viejos sin migración y respaldo.
```

---

## E9 — Preparación de modelo multi-habitación sin construir casas

```text
CONTEXTO
La visión futura es conectar habitaciones en un interior/edificio. La versión v0.2 NO promete construir casas completas. E9 se basa en el contrato `ProjectV2` de R4 ya integrado y en las decisiones de R5/E8. No volver a diseñar desde cero.

TAREA ACTUAL: E9. SOLO AUDITORÍA/ADR. NO IMPLEMENTAR MULTIHABITACIÓN.

Lee docs/REFACTOR_PLAN.md, docs/DATA_AND_FORMATS.md, docs/DECISION_LOG.md y el modelo real de Room/StructurePack/Project/variantes. Inspecciona asociaciones puerta-pared y coordenadas.

1. Identifica invariantes y límites arquitectónicos actuales.
2. Toma como punto de partida los tipos existentes `ProjectV2`, `FloorV2`, `RoomV2`, `WallV2`, `OpeningV2`, `LayoutV2` y `FurnitureInstanceV2`. Propón solo los cambios necesarios. RB-025 ha fijado como DIRECCIÓN FUTURA habitaciones de 1–6 lados y paredes interiores, pero R4 es rectangular: identifica incompatibilidades sin implementarlas en v0.2.
3. Explica cómo funcionaría la medianera única con dos `roomIds` (RB-027) y puerta de conexión compartida, según R4, SIN duplicar pared estructural ni romper v0.2. Audita RB-026: solapes 2D en aperturas/decoración, y no confundir contrato puro con escena operativa.
4. Propón migraciones y pruebas antes de cualquier implementación futura, marcando claramente los bloqueos reales.
5. Revisa compatibilidad con carpetas anidadas: carpeta visual NO es lo mismo que una habitación estructural.

ENTREGA: ADR de diferencias sobre R4 (no esquema nuevo desde cero), diagrama lógico, matriz de riesgos (incluida transición rectangular → 1–6 lados), plan de spike FUTURO y decisiones del propietario; no crear tareas de multihabitación ni modificar formato actual.
RESTRICCIONES: nada de código/commits/issues/versión. No asumir autorización para v0.3.
```

---

## E10 — Auditoría técnica y accesibilidad integral

```text
CONTEXTO
Antes de declarar Room Builder v0.2, necesitamos calidad en escritorio y táctil, accesibilidad y rendimiento medido. No prometer cifras sin medición.

TAREA ACTUAL: E10. AUDITAR Y CORREGIR SOLO FALLOS BLOQUEANTES APROBADOS.
LOTE DE FALLOS AUTORIZADOS: [SI PROCEDE]
RAMA: [RAMA]

Si faltan autorizaciones, hacer solo diagnóstico y recomendación.

Comprueba teclado, foco, lector de pantalla en la medida disponible, labels/aria, contraste, reduce-motion, targets táctiles, controles alternativos al ratón central/hover, scroll en paneles, arrastres cancelados y tamaños estrechos. Verifica manejo de errores en localStorage, avisos y recuperación.

Prepara escenarios deterministas de 1, 20 y 100 objetos sin datos privados; mide FPS, input responsiveness, memoria, tiempos y renderizados sobre entornos realmente disponibles. Registra dispositivo, navegador, resolución, método y baseline anterior; ninguna cifra sin contexto. Inspecciona recursos Three.js/R3F y listeners/dispose. Compara después de correcciones autorizadas.

ENTREGA: matriz de compatibilidad y accesibilidad, tabla de métricas antes/después, errores reproducibles, fixes pequeños si están autorizados, tests y límites conocidos. NO declarar v0.2 publicada.
RESTRICCIONES: no nuevas dependencias pesadas sin necesidad/consentimiento; sin commits/merges/release ni cambio de alcance.
```

---

## E11 — Validación real con usuarios no técnicos

```text
CONTEXTO
La promesa es «editor fácil de entender y usar». Los tests automatizados no demuestran facilidad. No introducir sistema de analítica ni cuentas.

TAREA ACTUAL: E11. DISEÑAR/EVALUAR PRUEBA CON USUARIOS, SIN INVENTAR PARTICIPANTES.

Prepara protocolo para 3–5 personas sin experiencia previa en Room Builder: inicio, crear habitación, añadir tres muebles, cambiar medida, mover, guardar A, duplicar B, cambiar cámara, cerrar/abrir y exportar/importar si está implementado.

Para cada tarea incluye objetivo, condición de éxito, errores observables, oportunidades de recuperación y tiempo aproximado SOLO como métrica a medir, no como estimación de realización. No guiar al participante mientras hace la tarea. Si no hay participantes disponibles, no simules resultados: entrega el protocolo y una evaluación heurística provisional separada.

Cuando haya evidencia de pruebas, consolida resultados anónimos, fricciones, confusiones y su gravedad; identifica hasta tres correcciones de mayor impacto. Solicita aprobación antes de ejecutar cambios.

ENTREGA: protocolo, plantilla de observación, resultados si existen y decisión de preparación para E12. No publicar grabaciones/diseños privados sin consentimiento.
RESTRICCIONES: sin cambios de código por sorpresa, sin asumir éxito de pruebas no realizadas, sin Workshop ni release.
```

---

## E12 — Auditoría final y propuesta de release v0.2

```text
CONTEXTO
Room Builder: editor local útil, fácil y de estilo propio. El Workshop y la construcción completa de casas no pertenecen a este hito. No publicar sin autorización.

TAREA ACTUAL: E12. RELEASE READINESS. NO PUBLICAR.

Lee AGENTS.md, el apartado «Plan maestro» de este mismo documento, docs/REFACTOR_PLAN.md, registros de decisiones, evidencias E0–E11 y rama candidata actual. Repite verificaciones desde un estado limpio y registra SHA/base.

1. Traza P0/P1/P2: implementado y verificado vs no incluido. No afirmar más de lo probado.
2. Ejecuta test unitarios pertinentes, suite E2E, build, pruebas de formato histórico/migraciones/importación, GLB, carpetas, selección, variantes, cámaras y errores; anota lo que no puedas probar.
3. Compara capturas baseline/v0.2 con entornos equivalentes; busca regresiones visuales y de accesibilidad.
4. Confirma que no hay peticiones al backend para editar, ni cuentas, ni fuga de datos privados.
5. Resume métricas reales de estabilidad, rendimiento y pruebas de usuarios; riesgos y deuda aceptable.
6. Propón changelog, documentación necesaria y procedimiento de rollback; confirma el estado de rama y diffs.
7. Emite recomendación explícita GO / NO-GO con argumentos, y qué falta para resolver NO-GO.

ENTREGA: informe final de release readiness, matriz requisito→evidencia, changelog PROPUESTO, lista de bloqueantes, cuestiones humanas pendientes. Si todo está bien, PIDE AUTORIZACIÓN EXPRESA para subir versión, integrar, etiquetar o publicar; NO lo hagas aún.

RESTRICCIONES: no crear release/tag, no desplegar, no merge, no tocar Workshop, no asumir que v0.2 ya existe por haber pasado el build.
```

---

## Reglas de continuidad cuando se agota el contexto de Codex

Copia este pequeño bloque al final de cualquier etapa abierta si cambias de chat/agente:

```text
CONTINUACIÓN ROOM BUILDER v0.2
Etapa en curso: [E#]
Rama y último SHA comprobados: [xxx]
Objetivo autorizado EXACTO: [xxx]
Archivos modificados/no modificados: [xxx]
Tests que han pasado: [xxx]
Tests pendientes/fallidos: [xxx]
Decisiones aprobadas y pendientes: [xxx]
Qué queda por hacer ahora: [xxx]

Antes de continuar, comprueba git status y el código real; no vuelvas a ejecutar toda la investigación ni sobreescribas cambios. Sigue AGENTS.md y el plan maestro. No empieces la siguiente etapa, no hagas commit/merge/release ni cambies de modelo por iniciativa propia.
```

---

**Fin de prompts. Mientras R5 siga pendiente, usa PRE-E0 para planificar su cierre. Una vez R5 esté integrada, usa E0 y continúa etapa a etapa.**
