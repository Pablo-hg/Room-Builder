# Registro de decisiones — Room Builder

> **Paredes conectadas y aperturas compartidas, petición expresa del propietario (08/11/2026, #34):** se sustituye para esta implementación la exigencia de fusionar las paredes coincidentes en una medianera única de RB-027. Cada pared física conserva ID, geometría, material, carpeta, selección y bloqueos. Las conexiones se derivan de su contacto físico; una sola puerta/ventana editable produce recortes en todas las paredes paralelas del recorrido que atraviese. El anclaje mundial `wallPosition` requiere datos v10, con lectura de v1–v9 sin alterar los archivos originales. Esto no entrega el contrato canónico de vivienda/plantas de #51–#53. Implementación local, pruebas pendientes: [informe F0](progress/F0_REFACTOR_AUDIT.md#paredes-conectadas-y-aperturas-compartidas).

> **Petición posterior del propietario, 08/11/2026 (rama #34):** ventanas y decoración mural pueden despegarse y moverse en XYZ mundial; las puertas conservan Y bloqueada y anclaje constructivo. La representación opcional `freePosition` se guarda en v9, sin migrar posiciones históricas; despegar una ventana retira el hueco y volver a abrirlo exige colocación explícita válida. El aviso de exterior se basa en la unión de cuerpos de habitaciones, no en contención en una sola. Amplía el anclaje mural de RB-035/RB-041 para esos elementos; no autoriza medianeras duplicadas ni huecos superpuestos. Implementación local y verificación pendiente en [F0](progress/F0_REFACTOR_AUDIT.md).

> **Última decisión RB-052 (04/11/2026):** el MVP final incluye **vivienda por plantas**, editor de vértices, POV WASD y las siete funciones RB-045–RB-051. v0.2 (#33) queda como checkpoint, **gate final #54**. RB-040 mantiene retirada A/B; RB-039/RB-041 permiten solapes de muebles. **Lecturas anteriores que llamen «futuro» a casas/POV son históricas**, superadas por RB-052. Plan canónico: [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md). Workshop/IA/monetización permanecen en [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md).

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
| RB-018 | Publicación pública, licencias del código/assets, modalidades de distribución | PENDIENTE | Repositorio público; distribución/licencias pendientes de formalizar |
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
| RB-043 | Evolucionar POV de cámara fija a recorrido libre con WASD y mirada de cámara; empezar desde una puerta de entrada, y al disponer de varias habitaciones permitir cruzar puertas interiores y escoger entrada cuando existan varias | CONFIRMADO como dirección futura (04/11/2026); no implementado | [#36](https://github.com/Pablo-hg/Room-Builder/issues/36): primero una habitación, después tránsito multiestancia basado en RB-027. No cambia MVP v0.2 ni reinterpreta la cámara Libre actual como paseo POV |
| RB-044 | Meta final de producto: empezar con una habitación y escalar a vivienda con varias estancias conectadas, múltiples plantas seleccionables y vista aérea global acotada, sincronizada con 3D y POV | CONFIRMADO como visión final (04/11/2026); sin implementación nueva | [HOUSE_VISION.md](HOUSE_VISION.md), referencia visual aportada por el propietario y [floorplan-3d](https://github.com/wy51ai/floorplan-3d). Se mantiene **v0.2 = MVP inicial de habitación**, no se reabren tareas de Workshop |
| RB-045 | Guías visuales y magnetismo opcional e independiente de cuadrícula, activas en Plano e Isométrica; Alt suprime magnetismo | APROBADO para MVP completo; pendiente de implementar | [#37](https://github.com/Pablo-hg/Room-Builder/issues/37) · Decisión C + B |
| RB-046 | Regla libre con ayudas, mediciones horizontales/verticales/diagonales y cotas guardables/editables | APROBADO para MVP completo; pendiente | [#38](https://github.com/Pablo-hg/Room-Builder/issues/38) · Decisión C; distinta de cotas automáticas #26 |
| RB-047 | Biblioteca de materiales estilizados, escala/rotación/tonalidades, herramienta Pintar y cuentagotas | APROBADO para MVP completo; pendiente | [#39](https://github.com/Pablo-hg/Room-Builder/issues/39) · Decisión C; los controles de color ya existen |
| RB-048 | Modo fotografía PNG avanzado con encuadres, resolución/proporción/fondo y cámaras propias recuperables | APROBADO para MVP completo; pendiente | [#40](https://github.com/Pablo-hg/Room-Builder/issues/40) · Decisión C |
| RB-049 | Plantillas vacías/amuebladas y posibilidad de guardar plantillas personales | APROBADO para MVP completo; pendiente | [#41](https://github.com/Pablo-hg/Room-Builder/issues/41) · Decisión C |
| RB-050 | Importar plano imagen con escala y trazado asistido, sin reconstrucción automática completa por IA | APROBADO para MVP completo; pendiente | [#45](https://github.com/Pablo-hg/Room-Builder/issues/45) · Decisión B |
| RB-051 | Editor modular de muebles por primitivas, agrupación, duplicación y materiales (sin edición avanzada de mallas) | APROBADO para MVP completo; pendiente | [#47](https://github.com/Pablo-hg/Room-Builder/issues/47) · Decisión B |
| RB-052 | El conjunto de todas las issues abiertas #23–#41 seleccionadas, #45/#47 y #51–#54 define el MVP local completo; v0.2 es checkpoint, gate final #54 | CONFIRMADO como alcance y planificación, 04/11/2026 | [MVP_MASTER_PLAN.md](MVP_MASTER_PLAN.md), épica #23; publicar solo con validación y autorización |

## Aclaraciones

- **08/11/2026 — CONFIRMADO, última simplificación del propietario (#34):** al ejecutar `npm run dev`, mantener un único log activo legible, `logs/diagnostics/LECTURA.log`, reuniendo todas las categorías y señalando el tipo de interacción. Sustituye la generación por fecha/sesión/categoría y sus copias. Límite de 5 MiB con retirada de entradas completas antiguas, sin nuevos archivos de rotación. Preservar los históricos existentes; IndexedDB y la exportación estructurada continúan independientes.

- **08/11/2026 — CONFIRMADO, rectificación posterior del propietario (#34):** retirar el visor de diagnósticos de toda la web, también en desarrollo. Consultar mediante archivos internos legibles y herramientas de terminal del proyecto/VS Code. Eliminar Compartir diagnóstico; conservar Exportar diagnóstico. Sustituye exclusivamente esas partes de la decisión anterior; IndexedDB, privacidad y ausencia de telemetría siguen vigentes.

- **08/11/2026 — CONFIRMADO por el propietario (#34):** diagnóstico local común para desarrollo y web publicada, IndexedDB canónico (inicialmente 7 días y aproximadamente 5 MiB), separado de undo/redo. Vite solo copia eventos a JSONL en desarrollo; visor/importador excluido de producción. Ayuda pública ofrece exportar/compartir por iniciativa del usuario, sin backend ni telemetría. No modifica política de colisiones ni formatos de diseños. Implementación y límites en [DIAGNOSTICS.md](DIAGNOSTICS.md); validación pendiente en main. Sustituye para este sistema la propuesta inicial de registrar solo en DEV.

- **07/11/2026 — Última petición del propietario:** la habitación enfocada en la
  cámara determina el contexto del catálogo de puertas y del panel de espacio;
  la selección de objetos permanece independiente. Precisa la continuación
  anterior: no hace falta seleccionar la carpeta en la lista, pero los tamaños
  siguen exigiendo componentes completos/coherentes. Una tarjeta Puerta añade
  en cualquier habitación, incluida raíz mediante `extraDoors` (v8). Zoom por
  barra además de rueda, distribución móvil por zonas. Validación visual a cargo
  del propietario; pruebas/build pendientes de main.

- **Continuación del 07/11/2026 — CONFIRMADO por el propietario:** las dimensiones
  modifican solo la habitación seleccionada y se habilitan desde una carpeta con
  sus componentes completos/coherentes. Puertas adicionales vinculadas a paredes
  de los packs, persistidas en v7; las conexiones por medianeras únicas mantienen
  la dependencia #51/#52. Implementación local y límites en
  [R5_PROGRESS.md](progress/R5_PROGRESS.md), sin certificación funcional/visual.

- **07/11/2026 — Petición explícita del propietario:** los candados XYZ por
  elemento sustituyen la fijación obligatoria de alfombras/lámparas nuevas.
  Empiezan con Y bloqueado; desbloquear permite elegir altura absoluta y volver
  a bloquear conserva la posición. Los datos con candados explícitos se guardan
  como v6; lectura v1–v5 conservada. Precisa RB-035/RB-036/RB-038 sin borrar su
  historia. Especificación e implementación local en
  [R5_PROGRESS.md](progress/R5_PROGRESS.md); pendiente de pruebas en main y
  aceptación visual. La vivienda canónica sigue pendiente de #51–#53.
- **CONFIRMADO** aquí alude a decisiones expresas de esta conversación, no a entregas realizadas o a documentación global del portfolio.
- **PROPUESTO** no autoriza ejecución automática: revisar al planificar tareas.
- El código actual es fuente de lo implementado; el registro expresa el objetivo.
- Las nuevas decisiones se añaden con fecha, impacto, alternativas y motivo. No se sobrescribe el historial sin rastro.

## Cambios pendientes más relevantes
1. Validar por prototipo la simplificación visual de los controles.
2. **Resuelto por RB-052:** v0.2 es checkpoint de una habitación, la casa multihabitación es requisito del MVP completo, con #51–#53.
3. Establecer paleta/ejemplos concretos solo tras una comparación visual en producto.
4. Validar y decidir el esquema final de proyecto/variantes a partir del prototipo R4, antes de integrarlo.
5. La planificación del 03/11 proponía A/B → redimensionado → JSON; es **histórica** y fue superada por R5 integrada y RB-040 (retirada de A/B del MVP). El siguiente trabajo vigente es certificar el producto local y completar UX/accesibilidad conforme a [LOCAL_MVP_BACKLOG.md](LOCAL_MVP_BACKLOG.md). Las formas RB-025 se incluyen ahora en el MVP completo mediante #35; **no** en checkpoint v0.2.
6. Las variantes se retiraron del MVP; D1 rechaza un espejo v5 discrepante. D7 importa IDs duplicados como copia y mantiene pendiente el reemplazo. Las aclaraciones de R5.2 están en RB-037–RB-039.

### Historial de aclaraciones de R5.2 (03/11/2026)

Primero se pidió paso mínimo absoluto de 5 cm y centro XYZ; posteriormente se aclaró precisión manual de centímetros enteros, movimiento de 5 cm y origen en el centro de la base. También se sustituyó el rechazo de solapes de mobiliario por permitir cualquier atravesamiento al redimensionar con borde rojo. Estas respuestas posteriores prevalecen; el detalle histórico se conserva en [R5_PROGRESS.md](progress/R5_PROGRESS.md). La matriz provisional del código (0,01–10 m por eje editable, diámetros vinculados y TV sin proporción fija) no se presenta como aprobación expresa de cada restricción por tipo ni como funcionalidad verificada.
