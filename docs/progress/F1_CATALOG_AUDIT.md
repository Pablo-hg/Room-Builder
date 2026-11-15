# Auditoría del catálogo (F1 · #30)

Estado: **implementación completa; validación visual del propietario superada el 15/11/2026.** Inventario en [F1_CATALOG_INVENTORY.md](F1_CATALOG_INVENTORY.md) (`npx tsx scripts/catalog-inventory.ts`): los 33 objetos figuran como validados. Pendiente antes de integrar: E2E (humo en la CI de la PR hacia `main`; suite completa antes de la release, #54) y el commit, a la espera de autorización del propietario.

## 1. Defectos e inconsistencias del código actual

| # | Hallazgo | Estado |
|---|---|---|
| 1 | Aplique, espejos y estante de pared se añadían con botones escritos a mano en `ObjectCatalogSection.tsx`, en bloques distintos según la familia. | **Corregido**: `STANDALONE_OPENING_MENU` en `objectCatalog.ts` es la única fuente; el menú, el inventario y los tests la leen. Orden y nombres sin cambios. **Pendiente de validación manual.** |
| 2 | Los cuadros son a la vez `FurnitureKind` y `OpeningKind`. | **No es un defecto de datos**: nombre, ancho y alto de la apertura se derivan del mueble. Solo `defaultBottom` (1,25 / 1,25 / 1) vive en el lado de aperturas. Un test lo vigila. |
| 3 | `lamp` se muestra como «Lámpara» y es de pie; `bed` como «Cama doble»; `cabinet` como «Aparador». | PENDIENTE de decisión. Las claves no se tocan; solo cambiaría la etiqueta visible. Los diseños guardados conservan su `name`. |
| 4 | `television` está en Accesorios aunque se apoya en el suelo y tiene 1,25 × 0,25 × 0,75 m. | PENDIENTE de decisión (¿Almacenaje, o una familia de electrónica en #75?). |
| 5 | Sin firmas visuales para puerta, ventana, estante, espejos y aplique: `OpeningDetail` usa hooks de R3F y no se puede renderizar fuera de un `Canvas` en un test unitario. | Abierto. Opciones: captura Playwright de aperturas (ampliar `r2-catalog.spec.ts`, que hoy solo cubre muebles) o extraer la geometría pura a un componente sin hooks. La segunda es una refactorización: requiere decisión. |
| 6 | El catálogo no guarda origen, licencia ni estado de validación por ítem. | Documentado: todos los modelos son primitivas Three.js del repositorio, sin assets de terceros. No se añade campo de datos. |
| 7 | Correspondencia icono ↔ modelo: los tests solo comprueban que el icono existe, cabe en 48×42 y usa el color base. | Abierto: requiere revisión visual humana, ítem por ítem. |

### Decisiones tomadas en esta fase (14/11/2026, a petición del propietario: «hazlo tú»)

Son decisiones de mínimo riesgo del agente, revisables.

- **Hallazgo 3:** solo se renombra la etiqueta visible `lamp` → «Lámpara de pie» (evita confundirla con «Lámpara de mesa» y «Lámpara de techo»). «Cama doble» y «Aparador» se mantienen. Las claves no cambian; los diseños guardados con `name: 'Lámpara'` conservan su nombre. Actualizado el E2E `room-builder.spec.ts` que buscaba la etiqueta antigua (**sin ejecutar**).
- **Hallazgo 4:** el televisor se queda en Accesorios. Reubicarlo es contenido de #75, no un defecto que impida el flujo v0.2.
- **Hallazgo 5:** no se refactoriza la geometría de aperturas en F1. La comprobación visual de puerta, ventana, estante, espejos y aplique se hace en la validación manual y, si se quiere automatizar, ampliando la captura Playwright en una tarea aparte.
- **Sección 3:** las prioridades de cobertura se pasan a #75 como propuesta, sin añadir ítems en F1.

### Revisión icono ↔ modelo 3D (14/11/2026, capturas isométricas reales de los 32 ítems con ventana; la puerta no se capturó)

Hecha comparando la hoja de iconos con capturas del modelo en isométrica. Es una revisión visual del agente, no la validación humana de la sección 6.

| Veredicto | Ítems |
|---|---|
| **No corresponde** | `bed` y `singleBed` (el icono parece una ventana o armario, no una cama); `circularRug` (la mira central parece una diana); `lamp` y `tableLamp` (iconos casi idénticos; la lámpara de pie 3D es alta y fina); `sofa` (icono frontal con brazos redondeados; el modelo es isométrico con brazos finos); `armchair` (icono de cubos abstractos; el modelo tiene respaldo alto y asiento claro); `ceilingLamp` (icono con forma de T colgante ilegible); `wallSconce` (icono de perfil; el modelo es una pantalla pequeña pegada a la pared) |
| **Parcial** | `chair`, `table`, `desk`, `tvStand`, `television`, `wardrobe`, `cabinet`: reconocibles, pero el icono es frontal y el modelo isométrico, con proporciones distintas |
| **Correcto** | `bedsideTable`, `bookshelf`, `wastebasket`, `vase`, `plant`, `coffeeTable`, `deskChair`, `rug`, cuadros, `window`, `circularWindow`, espejos, `wallShelf` |

Causa: los iconos son SVG dibujados a mano con perspectivas mezcladas (unos frontales, otros isométricos) y no derivan de los modelos, así que se desincronizan.

Otros hallazgos 3D a revisar: `ceilingLamp` aparece con el recuadro rojo de colisión al cargarse a su altura por defecto; el televisor se ve casi negro frente a su icono claro; el cristal de las ventanas es beige en 3D y azul en el icono.

### Iconos generados desde el modelo 3D — paso 1 (14/11/2026, decisión del propietario)

Requisitos del propietario: el icono debe corresponder visualmente al render 3D, y cualquier objeto futuro debe seguir la misma estética minimalista y encuadrada, con tests que lo verifiquen.

- `src/components/modelIcon.ts`: recorre el árbol de primitivas del modelo (`FurnitureModels.tsx`), lo construye con three.js y lo proyecta a polígonos SVG con la cámara isométrica de la escena (azimut 45°, elevación ≈26°) y sombreado plano calibrado con capturas (superior ×1,12, frontal ×0,97, lateral ×0,85). Curvas simplificadas; margen de 4 sobre el lienzo 48×42; fondo tintado con el color del objeto, como antes.
- `iconCatalog.tsx`: los **23 muebles de suelo y techo** usan el icono generado, con caché por tipo y color (el icono del inspector y de la lista sigue el color del objeto). Se retiraron sus SVG dibujados a mano.
- Quedan dibujados a mano, pendientes del paso 2: los 3 cuadros, puerta, ventanas, espejos, aplique y estante de pared (su geometría vive en `Openings.tsx`, mezclada con la interacción). El modelo de cuadro de `FurnitureModels.tsx` no es el que dibuja la escena.
- Tests: `modelIcon.test.ts` (icono generado para cada mueble, encuadrado y llenando el marco, sigue el color) e `iconCatalog.test.ts` actualizado.
- Comprobado en la app (servidor local, Chromium): 36 tarjetas en el Catálogo, 23 con icono generado, sin errores de consola. **Sin validación visual humana.**

### Correcciones de modelos 3D pedidas por el propietario (14/11/2026)

| Objeto | Defecto | Corrección |
|---|---|---|
| Espejo rectangular | El reflejo diagonal sobresalía del marco | `mirrorGlint` (`wallObjectDetails.ts`) calcula su largo para que quepa en el cristal en cualquier tamaño; test con 5 tamaños |
| Lámpara de pie, de mesa y de techo | Pantallas abiertas dibujadas por una sola cara: faltaba la parte de atrás | Pantallas a dos caras |
| Lámparas y aplique | Luz puntual y brillo propio | Retirados (decisión del propietario) |
| Jarrón | Flotaba 0,225 m sobre el suelo; diseño no gustaba (aro colgante) | Nuevo perfil apoyado en el suelo, base cerrada, franja decorativa e interior de la boca |
| Estantería | Rayas al mover la cámara (caras coplanares de fondo, laterales y baldas) | Fondo y baldas encajados entre laterales y baldas delante del fondo; se añaden libros por balda |
| Estantería de pared | Libros atravesando la balda superior | `shelfBooks` coloca libros de pie sobre cada balda; test de que no atraviesan baldas, laterales, fondo ni borde |

Firmas de modelo actualizadas a propósito para `bookshelf`, `lamp`, `vase`, `tableLamp` y `ceilingLamp`; el resto no cambia. Los iconos de esos muebles se regeneran solos. Comprobado en la app con captura isométrica; **pendiente de validación humana**.

Segunda ronda (14/11/2026):

- **Estantería de pared:** su geometría pasa a `src/scene/WallObjectModels.tsx` (`wallShelfModel`, sin hooks), que usan a la vez la escena (`Openings.tsx`) y el generador de iconos. Su icono pasa a generarse desde ese modelo; color por defecto del icono alineado con la escena (`#c88f58`). Es el primer objeto de pared con modelo puro: el patrón para mover el resto.
- **Cuadros:** se mantienen en 2D por decisión del propietario; el paisaje del icono se dibuja con coordenadas dentro del lienzo interior del marco (antes se salía). Test que lo comprueba.
- **Aplique:** retirado el círculo claro bajo la pantalla, que representaba la luz.

Tercera ronda (15/11/2026):

- **Todos los objetos de pared con modelo puro** en `WallObjectModels.tsx` (puerta, ventana, ventana circular, espejos, aplique, estantería de pared y cuadro); `Openings.tsx` solo coloca e interactúa. Sus iconos se generan desde ese modelo, con los colores por defecto de la escena. Solo los tres cuadros mantienen icono 2D. El modelo de cuadro de `FurnitureModels.tsx` usa ahora `pictureModel` (una sola fuente; firmas actualizadas a propósito).
- **Estándares comprobados por tests** (`src/scene/modelStandards.test.ts`) para todo el catálogo, presente o futuro: solo primitivas y sin luces; colores derivados del color del objeto (salvo cristal, reflejo y tierra); volumen dentro de ±15 % de las medidas (mínimos 60 % de huella y 85 % de altura); apoyo en suelo o techo y pivote centrado; máximo 450 caras visibles. Comprobado que detectan un jarrón flotando. `modelIcon.test.ts` exige icono generado y encuadrado también para los objetos de pared.
- **Orden de pintado de los iconos** corregido (ver F1_PROGRESS): el mueble de TV ya coincide con su 3D.
- **Reglas y alta de objetos nuevos** en `VISUAL_STYLE_GUIDE.md`; decisiones en `DECISION_LOG.md`; formato v12 en `DATA_AND_FORMATS.md`.
- **Lámpara de techo «fuera de la vivienda»: corregido.** Los muebles antiguos sin anclaje por tipo reciben un realce visual heredado de 2 cm; una lámpara a ras de techo asomaba 2 cm por encima. Las lámparas de techo ya no lo reciben (test en `objectCatalog.test.ts`).
- **Capturas comparativas:** `scripts/playwright-catalog/r2-catalog.spec.ts` reescrito (buscaba un checkbox retirado) y ampliado a los objetos de pared: 32 objetos × 3 vistas, sin errores (4,1 min, local).

Hallazgo cerrado (antes abierto): una lámpara de techo colocada a ras de techo con un diseño antiguo (sin `attachmentPolicy`) aparece en «Incidencias» como «fuera de la vivienda, en el vacío», con el recuadro rojo. Sin investigar todavía.

## 2. Compatibilidad de guardados

- La issue habla de JSON v1–v5. El código real: el **archivo exportado** usa `schemaVersion = 5` (`designFile.ts`) y el **diseño interno** admite versiones 1 a 11 (`designV1.ts`). Son dos numeraciones distintas y la redacción de la issue está desfasada.
- Las claves de `FurnitureKind` y `WindowShape` son las que persisten. Ninguna de las correcciones hechas cambia claves, versiones ni formato.
- Nuevo `src/state/catalogItems.test.ts` (3 pruebas): cada mueble del catálogo y cada apertura del menú se añaden con la acción real del botón, se deshacen y rehacen, y un diseño con todo el catálogo sobrevive a exportar e importar. Los tests de persistencia existentes (fixtures v2–v5 y `persistence-v1`) pasan; no se modificaron.

## 3. Cobertura por estancia (entrada para #75)

Basada solo en los 33 ítems actuales. Las prioridades son una PROPUESTA, no una decisión.

| Estancia | Qué hay | Vacío real | Prioridad propuesta |
|---|---|---|---|
| Dormitorio | Cama doble e individual, mesita, armario, aparador (cómoda), escritorio, lámparas, alfombras, espejos, cuadros, planta | Cortinas; cómoda dedicada si el aparador no basta | Cubierto para el flujo v0.2 |
| Salón | Sofá, sillón, mesa de centro, mueble de TV, televisor, estantería, alfombras, lámparas, planta, cuadros | Mesa auxiliar; sofá de 3 plazas (hoy se obtiene redimensionando) | Cubierto para el flujo v0.2 |
| Comedor | Mesa, silla, aparador | Silla de comedor diferenciada, mesa redonda | Media |
| Despacho | Escritorio, silla de escritorio, estantería | Archivador | Baja |
| Cocina | Nada específico (solo mesa y sillas) | Encimera, nevera, fregadero, fogones | Alta para viviendas completas |
| Baño | Solo espejos | Inodoro, lavabo, ducha o bañera | Alta para viviendas completas |
| Iluminación / decoración | Lámpara de pie, de mesa, de techo, aplique, jarrón, planta, cuadros, espejos, papelera | Cortinas, pequeños accesorios | Baja |
| Escaleras | — | Fuera de #30: se desarrollan en #64 (F4) | — |

Conclusión provisional: **el flujo básico v0.2 se puede completar sin añadir ítems**. No se ha incorporado ninguno en F1.

## 4. Cambios hechos en #30 hasta ahora

- `src/domain/objectCatalog.ts`: `STANDALONE_OPENING_MENU`, `StandaloneOpeningKind`, `openingShapeForKind`.
- `src/components/editor/ObjectCatalogSection.tsx`: botones de aperturas generados desde esa lista.
- `src/domain/objectCatalog.test.ts` (7 pruebas): claves, familias, nombres únicos, medidas dentro de rango, cuadros coherentes, menú completo, anclajes.
- `scripts/catalog-inventory.ts` y `F1_CATALOG_INVENTORY.md`.

## 5. Pruebas ejecutadas

- `tsc --noEmit`: sin errores.
- `objectCatalog.test.ts` 7/7, `iconCatalog.test.ts` 3/3, `catalogItems.test.ts` 3/3 y `src/persistence/*.test.ts` (34 pruebas en total, 0 fallos). No se ha ejecutado `npm test` completo ni ningún E2E.

## 6. Lista de validación visual humana (superada, 15/11/2026)

Escenas: **dormitorio** (cama doble, mesita, armario, aparador, escritorio, silla de escritorio, lámpara de pie, lámpara de mesa, lámpara de techo, alfombra, espejo, cuadros, planta, papelera) y **salón** (sofá, sillón, mesa de centro, mueble de TV, televisor, estantería, alfombra circular, jarrón, aplique, estante de pared, ventana circular).

Para cada objeto, en **Plano, Isométrica y POV**:

- [x] El icono del Catálogo se reconoce y se parece al modelo.
- [x] Nombre y familia tienen sentido; la escala frente a los demás objetos es creíble.
- [x] Apoya bien (suelo, techo o pared) y no flota ni se hunde.
- [x] Hover y selección se ven con claridad; los gizmos de mover, girar y redimensionar funcionan.
- [x] Duplicar, redimensionar y deshacer/rehacer funcionan; no hay errores en consola.
- [x] Los colores tienen contraste suficiente sobre el suelo y las paredes por defecto.

Compatibilidad: abrir un diseño guardado antes de este cambio y comprobar que no cambia.

Resultado: el propietario valida visualmente todo el catálogo («visualmente todo ok», 15/11/2026), tras las rondas de corrección anteriores (iconos, modelos, paredes). Sin defectos abiertos. La columna «Revisión» del inventario sale de la lista `VALIDATED` de `scripts/catalog-inventory.ts`; un objeto nuevo queda «Pendiente» hasta revisarlo.

## 7. Pendiente

- **E2E relacionados con los cambios: correctos (local, 15/11/2026).** 16 specs (catálogo, paredes y habitaciones, guardado v12, selección): 141 correctos y 6 fallos esperados por cambios intencionados (versión 10 → 12, «Lámpara» → «Lámpara de pie», grosor de pared 0,13 → 0,12). Expectativas actualizadas en `connected-openings`, `furniture-attachments`, `independent-surfaces` y `rename-element`; al repetirlos, todos correctos (con un worker: con dos, Windows agota tiempos por el render WebGL por software). Pendiente: suite E2E completa antes de la release (#54) y humo en la CI de la PR hacia `main`.
- **Sin commit:** todo el trabajo sigue en el árbol de trabajo de `feature/F1-06-auditar-catalogo`, a la espera de autorización.
- **Entrada para #75:** matriz de cobertura por estancia de la sección 3 (propuesta, sin decidir).
- **Decisiones cerradas:** puntos 3, 4 y 5 de la sección 1 (ver «Decisiones tomadas en esta fase»).
