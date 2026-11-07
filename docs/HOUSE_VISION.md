# Visión de vivienda completa — incluida en el MVP local comprometido

**Actualizado 04/11/2026:** la referencia visual de una planta de vivienda con varias habitaciones conectadas, cotas y superficies se ha convertido en un **requisito del MVP local completo**. No es parte del **checkpoint v0.2** inicial, pero sí de la gate final [#54](https://github.com/Pablo-hg/Room-Builder/issues/54). Véase [MVP_MASTER_PLAN](MVP_MASTER_PLAN.md).

## Experiencia objetivo
1. El usuario comienza con **una habitación** sin tener que configurar una «casa».
2. Desde el mismo proyecto añade salas, dormitorios, baño, cocina, pasillo y otras estancias contiguas; las habitaciones comparten **paredes físicas únicas** con puertas/huecos coherentes.
3. En **vista aérea/planta**, ve simultáneamente las estancias del nivel activo, con nombre y superficie orientativa, líneas de cota, herramientas para seleccionar una habitación o volver al conjunto.
4. Puede **seleccionar la planta** que desea editar, incluso con una casa de dos o más niveles; vistas Plano/Isométrica/POV se basan en una sola escena.
5. Puede modificar el contorno de una habitación **moviendo vértices**, añadiendo o eliminando vértices desde el menú de pared (#35), con geometría y datos consistentes.
6. Puede **importar imagen de plano**, calibrar dos puntos con distancia real y trazar asistido mediante bordes/esquinas sugeridos, revisando cada segmento (#45); no se reconstruyen viviendas automáticamente por IA.
7. Puede caminar por la vivienda con **WASD**, mover la mirada, comenzar desde la **puerta de entrada elegida** y atravesar aberturas conectadas sin reiniciar cámara (#36).
8. Las habitaciones pueden tener materiales, mobiliario, modelos modulares, anotaciones, plantillas y cámaras guardadas (#37–#41, #47), conservados al guardar/recargar el proyecto completo.

## Fuente de verdad y contratos
- Jerarquía propuesta `Project → Floors → Rooms/SharedWalls → Openings → Furniture`; habitaciones, paredes, plantas y aperturas tienen IDs estables.
- Contrato inicial real: habitación rectangular guardada con formatos v1–v5. El prototipo puro R4 `ProjectV2` **no** equivale todavía a casa funcional ni archivo público; la migración se ejecuta en #51.
- **Pared medianera única** (RB-027) para dos habitaciones; no duplicar muros ni puertas físicas en mundos distintos.
- Habitaciones irregulares: primera entrega sólida con contornos poligonales de lados rectos (RB-025/#35). Curvas de círculo/semicírculo y editor de mallas profesional quedan para investigación posterior.
- Las superficies son orientativas. Las cotas proceden de geometría, nunca de píxeles de pantalla. Sin certificados CAD/BIM.
- Soporte multipiso: se selecciona la planta y se representa su escena coherentemente. **Escaleras transitables entre plantas, ascensores y físicas realistas no son requisito inicial**; desplazarse entre plantas puede hacerse desde el selector.

## Plan de desarrollo verificable
1. [#51](https://github.com/Pablo-hg/Room-Builder/issues/51): contrato y migraciones, suelos, paredes compartidas, IDs.
2. [#35](https://github.com/Pablo-hg/Room-Builder/issues/35): polígonos y edición por vértices.
3. [#52](https://github.com/Pablo-hg/Room-Builder/issues/52): conectar habitaciones, ver toda una planta, importar plantillas como estancias.
4. [#53](https://github.com/Pablo-hg/Room-Builder/issues/53): varias plantas y selector con cámaras/visibilidad.
5. [#45](https://github.com/Pablo-hg/Room-Builder/issues/45): imagen calibrada y trazado asistido; puede prototiparse antes sobre una habitación.
6. [#36](https://github.com/Pablo-hg/Room-Builder/issues/36): paseo POV con WASD, entrada/puertas e interacción con conexiones.
7. [#54](https://github.com/Pablo-hg/Room-Builder/issues/54): escenario completo, round-trip, E2E y aceptación.

## Demostración mínima antes de llamar «MVP completo»
Construir una casa de **al menos cuatro estancias conectadas y dos plantas**; elegir una planta, inspeccionar habitaciones y cotas, modificar una pared, colocar muebles, elegir puerta de entrada, recorrer con WASD y atravesar puertas interiores. Guardar, exportar JSON, importar en un navegador limpio y recuperar **todas** las plantas, habitaciones, aperturas, anotaciones, modelos y materiales, sin datos perdidos.

## Referencias
- Referencia visual aportada por el propietario el 04/11 (no asset copiable).
- [floorplan-3d](https://github.com/wy51ai/floorplan-3d): vista cenital, muros/medición, 2D/3D y WASD; arquitectura propia no clonada.
- [Diorama](https://github.com/pwsh/diorama), [MyRoomPlanner](https://www.myroomplanner.io/), [Rooms.xyz](https://rooms.xyz) y [MakeRoom](https://store.steampowered.com/app/2212670/MakeRoom/): funciones y facilidad de uso, sin copiar código o arte.
