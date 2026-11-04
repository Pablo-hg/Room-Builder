# Alcance del MVP local completo — Room Builder

**Decisión actual 04/11/2026:** la release que el propietario considerará «MVP completo» incluye el editor individual **y** el constructor de casas con varias habitaciones/plantas, las siete funcionalidades aprobadas y POV libre WASD. El plan secuenciado está en [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md), épica [#23](https://github.com/Pablo-hg/Room-Builder/issues/23).

## Dos hitos, una sola definición de publicación
- **Checkpoint v0.2 (#33):** certificar el editor de **una habitación rectangular** ya implementado en parte en R5. No implica que el producto esté terminado ni concede permiso para publicar el MVP final. Conserva los gates originales #24–#34.
- **MVP local completo (#54):** después de F2–F5, un usuario crea una habitación, la amplía a una **casa por plantas**, edita sus contornos/estancias/conexiones, la decora con materiales/objetos propios, recorre con WASD, toma fotos y puede guardar/exportar/importar el proyecto íntegro. **Única gate final**.
- **Publicación:** incluso con #54 cerrada, el propietario debe **aprobar expresamente** release/despliegue.

## Alcance funcional comprometido
1. **Base editor (F0–F1):** dimensiones en metros/cm, cotas automáticas en Plano, ventanas/puerta, catálogo, redimensionado, selección/carpetas/gestos, color y bloqueo, advertencia roja ante solapes de muebles permitidos, vistas Plano/Isométrica/POV fijo (+ Frontal/Libre), undo/redo, persistencia local, JSON v1–v5 y GLB; UX, accesibilidad y CI en verde.
2. **Precisión (F2):** guías visuales y ajuste magnético opcional en **Plano e Isométrica** (#37); medición libre con ayudas y **anotaciones guardables** (#38); plantillas vacías, amuebladas y propias (#41).
3. **Aspecto/presentación (F3):** biblioteca de materiales estilizados con escala/rotación/tonalidades, herramienta Pintar y cuentagotas (#39); fotografía PNG avanzada y posiciones de cámara guardadas (#40).
4. **Casa completa (F4):** modelo de proyecto versionado y migrador (#51), editor de vértices (#35), varias habitaciones conectadas con medianeras únicas y planta global (#52), varias plantas con selector (#53), plano de referencia con calibración y **trazado asistido bajo control del usuario** (#45), POV WASD desde puerta y recorrido continuo entre habitaciones (#36).
5. **Creación manual (F5):** editor modular de muebles basado en primitivas, agrupación, duplicación y aplicación de materiales; catálogo propio reutilizable (#47).
6. **Cierre (F6):** pruebas integrales con usuarios, seguridad de importaciones, rendimiento, migraciones, licencias, build y gate de publicación #54.

## Qué existe realmente y qué NO se ha certificado
| Componente | Estado leído de código/documentación en main | Pendiente |
| --- | --- | --- |
| Editor de habitación rectangular, cámaras y catálogo | R5 fusionada; base funcional documentada | #24–#34, E2E integral y regresiones |
| Guardado de 5 diseños, JSON editable v1–v5 y GLB | Implementados en la rama consultada; lectura legacy | #25, migración al nuevo modelo de **casa** #51 |
| Color de paredes/suelo y muebles | Disponible | **Materiales reales** y herramienta Pintar #39 |
| Cámara Libre y POV fijo desde puerta | Existen | **Recorrido POV WASD real** #36 |
| Prototipo ProjectV2 R4 | Tipos y pruebas puras | **No es una vivienda funcional**; #51–#53 |
| Siete nuevas funciones acordadas | Sus issues están abiertas y especificadas | **No implementadas** por este cambio documental |
| Tests R5 | Informe histórico reporta 213 unitarias + build | **No se ha vuelto a certificar** toda la suite E2E final |

## Condiciones que no se negocian
- Una sola fuente espacial: los cambios de cámara no alteran posiciones; paredes y aberturas compartidas no se duplican; valores/IDs coherentes.
- No se corrompen diseños antiguos al cambiar formatos; round-trip local/JSON, pruebas adversarias y alternativas de recuperación de recursos.
- Editor **local-first sin backend/cuentas**, sin llamadas obligatorias a servicios externos; «offline desde primer acceso» solo se promete si se implementa caché/PWA correspondiente.
- UX comprensible para persona no técnica, teclado/táctil y reducción de movimiento. **Orientativo**, no CAD/BIM o certificación técnica.
- Mantener retirada de variantes A/B en UI (RB-040) y solapes de muebles permitidos con aviso (RB-041).
- La v0.2 y el MVP final se **validan con pruebas reales**, no por cerrar issues documentalmente.

## Fuera del MVP
Workshop, comunidad/cuentas, nube, sincronización multiusuario, monetización, IA que genere objetos o reconstruya planos automáticamente, importación de GLB externos, clima/luces diurnas dinámicas, objetos interactivos, rayos X, simulación de obra y recorridos de vídeo. Ver [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md).

**Referencias:** [HOUSE_VISION.md](HOUSE_VISION.md), [UX_AND_CAMERAS.md](UX_AND_CAMERAS.md), [OBJECTS_AND_ASSETS.md](OBJECTS_AND_ASSETS.md), [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md).
