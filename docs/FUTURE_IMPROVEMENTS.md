# Informe de mejoras futuras — después del MVP local completo

**Fecha:** 04/11/2026 · **Estado:** ideas de referencia **NO APROBADAS** como alcance de publicación. No crear/reabrir issues por este documento sin autorización. El único backlog vigente es [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md).

## Punto de corte
Hasta cerrar **#54** el foco es completar el MVP local de vivienda por plantas, con siete funciones confirmadas, sin registros, backend, nube ni monetización. **Después** se valorarán mejoras por uso real, coste y retorno. La versión Mini de Pablo Web 2.0 puede planificarse sin mezclar el editor web y no es bloqueo de publicación.

## Ideas útiles que se han decidido dejar fuera
| Candidata | Procedencia | Qué aportaría | Motivo del aplazamiento |
| --- | --- | --- | --- |
| Capas globales, rayos X y corte de paredes configurable | [#42 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/42), Snugtail Rooms/Diorama | Edición de escenas densas, selección por transparencia | #29 ya cubre ocultación básica; primero validar demanda |
| Objetos apilados con soporte real sobre otros muebles | [#43 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/43) | Que lámparas/libros sigan la mesa al moverla | Nuevo grafo de dependencias entre objetos y migraciones |
| Presets de grupos de muebles, no habitaciones completas | [#44 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/44) | Reutilizar un escritorio con accesorios | Ya hay grupos #28 y plantillas de habitación #41 |
| Abrir/cerrar puertas físicas animadas y arcos de barrido | [#46 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/46) | Simular hoja y giro | **No confundir** con el paso estructural requerido en #36/#52: caminar por huecos se incluye; animación detallada no |
| Importar GLB y subir imágenes propias para pósteres | [#48 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/48) | Catálogo personal de assets externos | Seguridad, almacenamiento y empaquetado/privacidad |
| Hora del día, luz ambiental, clima visual | [#49 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/49), My Dream Setup | Presentación con atmosferas | Rendimiento y complejidad de iluminación; #39 ya cubre acabados |
| Acciones en objetos: lámpara, cajones, pantallas | [#50 cerrada](https://github.com/Pablo-hg/Room-Builder/issues/50), Rooms.xyz | Habitación explorable e interactiva | Requiere modelo de estado/acciones, pero no es necesario para POV |
| Exportación vectorial SVG de plano completo | floorplan-3d / MyRoomPlanner | Planos escalables y compartibles | Primero PNG/JSON/GLB y cotas sólidas |
| Estimación de superficies, materiales y presupuesto | floorplan-3d / herramientas de interiorismo | Ayuda a compras/reforma | Implica supuestos no certificados sobre precios y obra |
| Tipos constructivos: tabiques, fachadas, barandillas y escaleras transitables | Diorama, Tiny Glade | Viviendas más complejas | El MVP incluye plantas, no circulación vertical física ni cálculo de obra |
| Simulación de paso libre y advertencias ergonómicas | floorplan-3d | Detectar distancias de circulación | No sustituye normativa ni simulación de accesibilidad real |
| Tour de cámaras animado y vídeo | modo fotografía y MakeRoom | Presentaciones profesionales | #40 ya resuelve foto y cámaras favoritas |
| Retos decorativos y gamificación | MakeRoom | Aprendizaje/juego | La herramienta debe servir sin misiones |
| Esquinas redondeadas, curvas 1–2 lados y CAD de mallas | RoomPlan Pro / RB-025 | Geometría avanzada | #35 entrega vértices rectos primero; curvas/edición de mesh requieren otro contrato |
| Generación automática de planos por IA | alternativa C no elegida para #45 | Interpretar imagen integralmente | El usuario eligió **trazado asistido B** con confirmación |
| IA que genere objetos 3D a partir de texto/imagen | [GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md) | Crear objetos sin modelarlos manualmente | #47 proveerá formato de piezas antes, IA es I+D futuro |
| Workshop, comunidad, cuentas, moderación, versiones y nube | [informe original](../ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md), #9–#18 cerradas | Compartir y descubrir diseños | Es otro producto/fase, requiere backend y costes |
| Suscripción/freemium | idea comercial no decidida | Financiación sostenible | No bloquear import/export local ni limitar proyectos retrospectivamente |

## Referencias de estudio
- **Creatividad y personalización:** [MakeRoom](https://store.steampowered.com/app/2212670/MakeRoom/), [Rooms.xyz](https://rooms.xyz), [Furnish Master](https://store.steampowered.com/app/2004080/Furnish_Master/), [My Dream Setup](https://store.steampowered.com/app/2200780/My_Dream_Setup/).
- **Planos, geometría y POV:** [MyRoomPlanner](https://www.myroomplanner.io/), [floorplan-3d](https://github.com/wy51ai/floorplan-3d), [Diorama](https://github.com/pwsh/diorama), [Blueprint3D](https://github.com/furnishup/blueprint3d), [Tiny Glade](https://store.steampowered.com/app/2198150/Tiny_Glade/), [RoomPlan Pro](https://new-old-games.itch.io/roomplan-pro).
- **Selección/espacios densos:** [Snugtail Rooms](https://reb00t.itch.io/rooms). **No copiar código, imágenes ni assets sin revisar licencia.**

## Cómo priorizar cuando esté publicado
1. Observar uso y problemas reales: dónde abandona la gente, qué funciones pide y rendimiento en hardware medio.
2. Favorecer mejoras compatibles que no obliguen a migrar formatos; ejecutar primero prototipos con pruebas y UX.
3. Valorar coste de mantenimiento/licencias/almacenamiento antes de abrir PRs o backend.
4. Seleccionar expresamente **una función futura cada vez** y solo entonces abrir o reabrir su issue.

Las issues cerradas solo actúan como **fichas de investigación**, no son parte del compromiso actual ni de la gate #54.
