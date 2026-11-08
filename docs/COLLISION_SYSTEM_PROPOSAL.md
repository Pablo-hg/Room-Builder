# Propuesta técnica: aperturas solapadas y diagnóstico de colisiones

**08/11/2026 · Propuesta original, parcialmente cubierta por cambios posteriores de la rama.** Petición del propietario en `feature/34-auditar-refactorizar`. No modifica #34 ni crea issues. El progreso de F0 se conserva en `progress/F0_REFACTOR_AUDIT.md`.

> **Estado tras sincronizar con `361ab68`:** la rama ya contiene `sceneCollisions.ts`, `SceneCollisionPanel` y contornos de los elementos implicados, recibidos de los 16 commits remotos. Su alcance y límites están en [F0_COLLISION_PANEL.md](progress/F0_COLLISION_PANEL.md). La detección usa cajas orientadas y no resuelve exactamente todas las formas/rotaciones. **Permitir solapes de aperturas, unir huecos y coordinar todos los validadores sigue pendiente.** La auditoría y la condición de parada siguientes describen la propuesta anterior a esos commits; no deben interpretarse como ausencia actual del panel ni como validación de la implementación recibida. No se han ejecutado pruebas durante esta sincronización.

## Hallazgos y condición de parada

### Ampliación solicitada: volumen de vivienda y elementos murales libres

El propietario solicita que el aviso de exterior se base en el conjunto de volúmenes 3D de la vivienda y que ventanas/decoración mural puedan abandonar su pared y pasar a otras habitaciones. Aclara que las puertas conservan su bloqueo vertical. Para esta ampliación se conserva el comportamiento de puertas y se añade movimiento mundial XYZ a ventanas y decoración.

Diseño de implementación: comprobar cobertura por la unión de cuerpos de habitaciones, incluyendo sus apoyos, sin rellenar patios o huecos con una caja global. Para ventanas/decoración, añadir `freePosition?: { x, y, z, yaw }` en metros/radianes; ausencia conserva exactamente el anclaje histórico. Al mover un elemento por XYZ se despega, deja de recortar su pared y conserva su modelo/orientación. Su centro permite cambiar de habitación/carpeta con el movimiento, sin recolocación. Elegir una pared explícitamente vuelve a usar las reglas constructivas de anclaje, límites y huecos; no se abren huecos en paredes ambiguas automáticamente.

Los diseños que usen posiciones libres se guardarán como **v9**, conservando lectores v1–v8. Normalización, JSON y el round-trip ProjectV2 deben validar y conservar el campo; no se migran coordenadas de diseños históricos. El estado de implementación y verificación de esta continuación se registra en el informe F0. Se preparan pruebas sin ejecutarlas en esta rama.

**Aclaración posterior del propietario:** mientras un elemento esté fijado, sus ejes mundiales perpendiculares a la pared quedan deshabilitados/ocultos y deslizarlo mantiene el hueco. La libertad XYZ anterior se activa explícitamente con **Despegar de la pared**, conservando posición y candados. Cambiar de pared o reanclar actualiza X/Z automáticamente; los elementos ya libres conservan su estado. Véase la última continuación del informe F0.

- `geometry.validateOpenings` bloquea parejas en la misma pared usando intervalos y `openingGap` de 15 cm. Es una restricción de separación, no un detector de intersección física: también rechaza proximidad. `structureDoorError` mantiene otro rechazo para puertas adicionales/packs.
- `structureCollisions` y `geometry.furnitureItemsOverlap` reutilizan SAT sobre cajas orientadas en XZ y prueba de altura. Sirven para volúmenes de mobiliario, pero no ofrecen una lista común de parejas. Los booleanos de advertencia incluyen salida de habitación y superficies; no deben convertirse directamente en entradas de un panel de colisiones.
- La detección actual no representa ventanas/puertas de forma homogénea. Las paredes de packs se consideran macizas en ciertos avisos aunque el render tenga huecos; la raíz tampoco sigue exactamente el mismo recorrido. Decoraciones, ventanas circulares, giros de aperturas y partes huecas de muebles necesitan una fase geométrica más precisa si se promete intersección real.
- **La pared renderizada no usa `buildWallSegments` como geometría principal.** `scene/Walls.tsx:WallBody` crea un `THREE.Shape` y añade cada polígono como un agujero independiente en `shape.holes`, antes de `ExtrudeGeometry`. Permitir agujeros que se cruzan exige resolver su unión antes de triangular, incluidos contención, borde de puerta, círculos y giros. El recorte rectangular de `buildWallSegments` no resuelve este caso.
- La regla actual participa en edición, normalización/importación JSON (`designMigrations`, `designFile`), migración a ProjectV2 y su validador `opening-overlap`. Relajar solo la edición produciría diseños que otros recorridos rechazan. El formato actual del checkout llega a v8; v1–v5 siguen siendo históricos que preservar.

**Conclusión:** los puntos 2 y 2.1 requieren un cambio coordinado de geometría, validación, detección y consumidores UI. Se aplica la condición explícita del encargo: propuesta separada antes de implementar, sin habilitar solapes ni ofrecer un panel parcial en F0. No se añade motor físico ni dependencia. Las restricciones actuales siguen vigentes hasta entregar y certificar la funcionalidad completa.

## Separación de alcance

| F0 / #34 (correcciones conservadoras) | Tarea funcional independiente propuesta |
| --- | --- |
| Letras A–D en mensajes y nombres automáticos nuevos | Permitir solapes de aperturas; sustituir RB-026 y la excepción constructiva de RB-041 para estos elementos |
| Reparar foco transitorio al desaparecer habitaciones | Unión de huecos y triangulación estable compartida por render/exportación |
| Corregir colocación vertical nueva con espesores reales | Diagnóstico de parejas con identidad estable y contorno en todos los implicados |
| Auditar validadores y preparar regresiones sin ejecutar | Panel flotante accesible y responsive; contrato de precisión y rendimiento |
| Conservar coordenadas y datos históricos | Coordinar importación/exportación, migraciones y ProjectV2 con la nueva política |

El propietario ya ha solicitado el nuevo comportamiento; esta separación no inventa una autorización pendiente para investigarlo. Está pendiente concretar e implementar la tarea fuera del saneamiento conservador, sin crearla ni publicar cambios de GitHub automáticamente. Paredes compartidas físicas únicas y contrato de vivienda continúan en #51/#52.

## Diseño propuesto

1. **Modelo derivado puro:** adaptadores de raíz, packs, mobiliario, aperturas y decoración a coordenadas mundiales. ID original, tipo, transformación, soporte y primitivas de colisión; sin duplicar estado persistido. Resolver los nombres mediante `elementName` al mostrar, para respetar renombrados.
2. **Geometría común:** separar el área del hueco de la materia del marco/hoja. Un hueco vacío no es un sólido que choque con cualquier objeto que lo atraviese. Para el aviso apertura/apertura se compara su área en la pared; para apertura/mueble se comparan las partes materiales. Conservar círculo y rotación. Extraer/reutilizar los polígonos existentes y unir cortes antes de extruir; comparar área/volumen y ausencia de triángulos degenerados en tests. No sustituir círculos por huecos rectangulares.
3. **Dos fases de detección:** AABB como descarte barato; SAT existente para prismas rectangulares y prueba específica para formas no rectangulares/compuestas. Contacto tangente y soporte normal quedan excluidos con tolerancia explícita en metros, distinta del antiguo `openingGap`. No tratar proximidad o estar fuera de una habitación como pareja de colisión.
4. **Resultado único:** `{ pairs, collidingIds }`, parejas ordenadas por ID y deduplicadas. Un grupo de tres produce las parejas que realmente se intersectan, sin inferir A–C a partir de A–B/B–C. Añadir categoría `allowed-overlap` para diagnóstico local y conservar restricciones estructurales por separado. Los logs consumirán cambios de estado, nunca cada frame.
5. **Edición e importación atómicas:** separar integridad (finitud, tamaños positivos, márgenes, altura, soporte e IDs) de advertencias. Actualizar todos los validadores/round-trips en el mismo cambio; revisar `roomForDoorUpdate`, `roomForWindowUpdate`, búsqueda de hueco, selección múltiple y pegado. Movimiento manual conserva posición solicitada y candados XYZ. La búsqueda libre solo puede ser comodidad de creación, nunca respuesta automática a un solape durante arrastre.
6. **Consumidores:** calcular una vez por cambio espacial, compartir parejas entre contornos y panel, sin N cálculos completos por objeto. Cachear por referencias de room/furniture/packs; renombrar actualiza etiquetas sin recalcular geometría. Empezar con descarte por límites y medir durante arrastre antes de añadir índices espaciales.
7. **Panel:** solo con parejas, `Colisiones detectadas (N)`, lista con scroll y altura acotada, nombres actuales y texto `A intersecta con B`. Posición coordinada con `.scene-stage`, brújula, selección y controles; en móvil reservar espacio si no cabe flotante. Probar 320/375/430/640 px y escritorio, teclado, táctil, zoom y movimiento reducido. No anunciar todas las posiciones intermedias por lector de pantalla.

## Criterios y pruebas que debe preparar esa tarea

- Aperturas rectangulares, circulares y giradas: cruce, contacto, 1 mm de separación, contención completa y huecos múltiples; área de unión y geometría GLB sin caras defectuosas.
- Puerta principal/adicional/de pack, ventana y decoración; mismos nombres e IDs en cinco vistas; avisos en todos los elementos implicados y ninguna entrada duplicada.
- Muebles rotados y a niveles diferentes; caja envolvente coincidente sin intersección real; soporte suelo/techo/pared excluido; muebles que atraviesan el hueco vacío frente a muebles que atraviesan marco/hoja.
- Mover/girar/redimensionar/crear/borrar/renombrar, grupos de tres o más, undo/redo y selección múltiple; sin recolocación manual ni saltos de candados.
- Fixtures v1–v5 y actuales v6–v8, importación/exportación, ProjectV2, recarga y persistencia; conservar integridad de datos numéricos y estructurales.
- E2E del panel a resoluciones citadas y métricas de arrastre con escenas representativas. Ejecución únicamente tras integración autorizada en `main`.

Estas pruebas del sistema propuesto son especificaciones pendientes, **no tests automatizados ya implementados**. Los tests preparados en esta entrega cubren únicamente las correcciones conservadoras descritas en el informe F0.
