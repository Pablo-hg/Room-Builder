# Registro de decisiones — Room Builder

> **Nota vigente 04/11/2026:** RB-040 desplaza RB-010 y RB-028–RB-031 como **requisitos del MVP** (la comparación A/B ya no aparece en UI); RB-039/RB-041 permiten atravesamientos de mobiliario con aviso. R5 se fusionó en main y su certificación integral sigue pendiente (#24–#33). Workshop y monetización permanecen en [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md).

**Fecha base:** 26/10/2026. Este registro pertenece exclusivamente a Room Builder. NO modifica el registro global de Pablo Web 2.0.

| ID | Decisión o hipótesis | Estado | Nota |
| --- | --- | --- | --- |
| RB-001 | Producto independiente para recrear habitaciones reales, probar redistribuciones y jugar a construir | CONFIRMADO | Identidad del producto |
| RB-002 | Empezar por una sola habitación; evolucionar a casas uniendo habitaciones | CONFIRMADO | La casa es futuro del producto, no requisito inmediato |
| RB-003 | Referencia principal de experiencia: Rooms.xyz; Room Studio como secundaria técnica | CONFIRMADO | No copiar assets ni UI exacta |
| RB-004 | Estética diorama 3D geométrica, cartoon/cozy, simple, no realista ni pixel art | CONFIRMADO | Preferencia de las imágenes de etapas 1 y 2, más sencilla que detallada |
| RB-005 | Tres vistas esenciales: Plano, Isométrica con 2 paredes ocultas, POV desde puerta | CONFIRMADO | Giro 90°; control suave ya existente |
| RB-006 | Colocación libre de muebles y ajuste opcional a cuadrícula | CONFIRMADO | Ya hay base técnica |
| RB-007 | Medidas editables, puertas y ventanas | CONFIRMADO | Para representar habitaciones reales |
| RB-008 | POV desde puerta con mirada lateral | CONFIRMADO | Caminar libremente es futuro |
| RB-009 | Reutilizar React/TypeScript/Three.js/R3F/Zustand mientras encajen | PROPUESTO | No cambiar stack por moda |
| RB-010 | MVP inicial: recreación y comparación A/B de una habitación, JSON editable | PROPUESTO | Recomendada como definición de «producto útil» |
| RB-011 | Primera fase multihabitación: dos rectángulos adyacentes con pared compartida | PROPUESTO | Después de validar habitación individual |
| RB-012 | Mini del Laboratorio: misma base técnica, experiencia reducida a una habitación | PROPUESTO | Integración y alcance oficial aún pendientes; capacidades Mini definidas en R4 |
| RB-013 | Modelo de datos multiproyecto, paredes compartidas, variantes aisladas | PROPUESTO | Prototipo R4 en pruebas puras; contrato aún no estable ni persistido |
| RB-014 | Generador de muebles a partir de texto | EXPERIMENTAL | Existe GENERADOR_OBJETOS.md, no implementado |
| RB-015 | Soporte pleno de casas, plantas, escaleras y geometría irregular | PENDIENTE | Visión futura; límites por definir |
| RB-016 | Paleta cromática exacta, tokens, ejemplos/asset pack de referencia | PENDIENTE | La dirección visual sí está acordada |
| RB-017 | Cantidad de muebles, metas de rendimiento y dispositivos mínimos | PENDIENTE | Validar al medir |
| RB-018 | Publicación pública, licencias del código/assets, modalidades de distribución | PENDIENTE | Repositorio privado actual |
| RB-019 | Refactor por fases sin nuevas funciones ni alteración visual | PROPUESTO | Ver REFACTOR_PLAN |
| RB-020 | No simular exactitud arquitectónica/estructural ni usar datos privados externos | CONFIRMADO como principio | Visualización orientativa |
| RB-021 | R4 se entrega como contrato y pruebas puras, sin UI multihabitación ni persistencia nueva | CONFIRMADO | Decisión del 03/11/2026; no cambia el formato guardado |
| RB-022 | Los packs constructivos v1 se conservan como legado explícito en la migración | CONFIRMADO | Evita pérdida; no se convierten aún en paredes canónicas |
| RB-023 | Las variantes comparten ID de mueble lógico; los muebles nuevos usan ID único | CONFIRMADO | Conserva selección, candados, carpetas y orden |
| RB-024 | Mini: una habitación, sin variantes, JSON ni GLB; catálogo reducido y navegación contextual | CONFIRMADO | Recorte de capacidades, no un segundo modelo de datos |
| RB-025 | Formas de habitación: 1 pared (circular), 2 (semicírculo y recta), 3 (triángulo con ángulos ajustables), 4 (rectangular por defecto), 5 y 6 lados; además paredes simples interiores que no cubren el lado completo | CONFIRMADO como dirección (decisión del 03/11/2026) | Requiere rediseñar `RoomV2`/`WallV2` y el render actual de rectángulos; afecta al esquema RB-013 y alimenta RB-015; se necesita plan de fases, no cambio inmediato del prototipo R4 |
| RB-026 | Los objetos de tipo pared (decoración y aberturas) no pueden solaparse en la misma pared; el solape se mide en 2D (tramo a lo largo de la pared × franja de altura) | CONFIRMADO (03/11/2026) | Implementado en `validateProject` como `opening-overlap`: permite decoración sobre la puerta, rechaza aberturas/decoración que se pisen en tramo y altura |
| RB-027 | Cada habitación mantiene sus propias paredes y techo/suelo; una puerta o ventana entre habitaciones debe existir en ambas | CONFIRMADO como dirección (03/11/2026) | Mecanismo elegido: **medianera única** (`WallV2` con dos `roomIds`), que ya hace existir la abertura en ambas habitaciones sin duplicar paredes con huecos independientes. Queda por definir el mapa de conexiones (qué lado local de cada habitación corresponde a la medianera y en qué eje) para la fase multihabitación |
| RB-028 | R5.1 persiste Original/Alternativa A en `PersistedDesign` **v5** con `layouts` y `activeLayoutId`; discrepancias del espejo se rechazan con error explícito | CONFIRMADO; implementado en R5.1 | Mantiene lectura v1–v4, claves y límite de cinco; decisión D1 |
| RB-029 | En R5.1 la estructura y las preferencias son del diseño; solo el mobiliario es por variante | CONFIRMADO; implementado en R5.1 | Evita divergencias de puertas/medidas; decisión D3/D4 |
| RB-030 | Cambiar de variante se registra como un paso de historial | CONFIRMADO; implementado en R5.1 | Deshacer devuelve también a la variante anterior; decisión D2 |
| RB-031 | La UI de R5.1 admite como máximo una Alternativa A; eliminarla pide confirmación | CONFIRMADO; implementado en R5.1 | El dominio de R4 sigue admitiendo más variantes; decisión D5/D6 |
| RB-032 | R5.2 redimensiona por capacidades de tipo, con reglas puras y sin cambio de formato | CONFIRMADO; implementado y validado manualmente | Alfombras, decoración mural y lámparas tienen límites propios; ver pruebas en el informe de progreso |
| RB-033 | R5.3 exporta/importa **un diseño por archivo** con validación estricta, previsualización y límite de tamaño; biblioteca llena bloquea la importación | CONFIRMADO; implementado, en verificación | Un ID duplicado crea copia (RB-042); la opción de reemplazar un diseño existente queda PENDIENTE |
| RB-034 | R5.4 (simplificación de experiencia) se aplaza a E2/E4 de v0.2 salvo orden expresa | CONFIRMADO | R5 puede cerrarse con R5.4 aplazada; decisión D8 |
| RB-035 | Anclaje por tipo: alfombras nuevas al suelo, lámparas de techo nuevas al techo; ventanas y estantes murales a su pared; lámparas de pie y mesa libres | CONFIRMADO; implementado y verificado en R5.1 | D9: el propietario aclaró suelo/techo y eligió conservar posiciones y comportamiento de los objetos antiguos. Solo los objetos nuevos aplican el anclaje. La distinción persistida se propone en D10/RB-036 |
| RB-036 | Marca opcional `attachmentPolicy: 'by-type'` en muebles nuevos de v5; su ausencia conserva el comportamiento antiguo | CONFIRMADO; implementado y verificado en R5.1 | D10 aprobada expresamente. No cambia versión ni claves; comprobada compatibilidad v1–v5, diseños mixtos y convergencia R4. Copiar una variante conserva la marca; pegar un objeto nuevo aplica la política actual |
| RB-037 | Medidas y posiciones editables en centímetros enteros (0,01 m); movimiento incremental de 0,05 m; cuadrícula visible de 0,25 m | CONFIRMADO; implementado y validado manualmente | Acepta 0,13 m / 13 cm y posición 0,24 m; rechaza 15,5 cm. Conserva datos antiguos al cargar. Rangos amplios delegados al agente |
| RB-038 | El origen del objeto es el centro de su base local (0,0,0); redimensionar conserva ese apoyo | CONFIRMADO; implementado y validado manualmente | Muebles libres mantienen X/Z y base Y; objetos fijados conservan su suelo, pared o techo según D9/D10 |
| RB-039 | Permitir cualquier atravesamiento al redimensionar mobiliario, también entre muebles, con borde rojo | CONFIRMADO; implementado y validado manualmente | Entradas inválidas y fuera de límites se rechazan. No modifica las restricciones constructivas de puertas/ventanas |
| RB-040 | Retirar la comparación de variantes del MVP | CONFIRMADO (04/11/2026); implementado | Sustituye RB-028–RB-031 como requisitos del MVP. Al leer v5 conserva el mobiliario activo para guardar sin variantes; ver compatibilidad en el informe de progreso |
| RB-041 | Los solapes entre muebles ya no bloquean mover, elevar, girar, mover/girar la selección ni reducir la habitación; el borde rojo avisa | CONFIRMADO (04/11/2026); implementado | Se mantienen los límites de posición y las restricciones constructivas de puertas, ventanas y decoración mural. Añadir o pegar sigue buscando una posición libre como comodidad |
| RB-042 | Al importar un diseño cuyo ID ya existe, crear una copia con un ID local nuevo | CONFIRMADO (04/11/2026); implementado, en verificación | Precisión de D7. No sustituye un diseño existente; el reemplazo sigue pendiente y la biblioteca llena se bloquea |

## Aclaraciones
- **CONFIRMADO** aquí alude a decisiones expresas de esta conversación, no a entregas realizadas o a documentación global del portfolio.
- **PROPUESTO** no autoriza ejecución automática: revisar al planificar tareas.
- El código actual es fuente de lo implementado; el registro expresa el objetivo.
- Las nuevas decisiones se añaden con fecha, impacto, alternativas y motivo. No se sobrescribe el historial sin rastro.

## Cambios pendientes más relevantes
1. Validar por prototipo la simplificación visual de los controles.
2. Acordar MVP de una habitación frente a alcance posterior multihabitación.
3. Establecer paleta/ejemplos concretos solo tras una comparación visual en producto.
4. Validar y decidir el esquema final de proyecto/variantes a partir del prototipo R4, antes de integrarlo.
5. Siguiente fase validada en la planificación (03/11/2026): comparación Original/Alternativa A en una sola habitación, antes que redimensionar o JSON editable; las formas de habitación RB-025 quedan después de eso. El plan detallado de R5 está en [R5_PLAN.md](R5_PLAN.md) y no inicia la implementación.
6. Las variantes se retiraron del MVP; D1 rechaza un espejo v5 discrepante. D7 importa IDs duplicados como copia y mantiene pendiente el reemplazo. Las aclaraciones de R5.2 están en RB-037–RB-039.

### Historial de aclaraciones de R5.2 (03/11/2026)

Primero se pidió paso mínimo absoluto de 5 cm y centro XYZ; posteriormente se aclaró precisión manual de centímetros enteros, movimiento de 5 cm y origen en el centro de la base. También se sustituyó el rechazo de solapes de mobiliario por permitir cualquier atravesamiento al redimensionar con borde rojo. Estas respuestas posteriores prevalecen; el detalle histórico se conserva en [R5_PROGRESS.md](progress/R5_PROGRESS.md). La matriz provisional del código (0,01–10 m por eje editable, diámetros vinculados y TV sin proporción fija) no se presenta como aprobación expresa de cada restricción por tipo ni como funcionalidad verificada.
