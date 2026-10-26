# Instrucciones permanentes para Codex y agentes — Room Builder

## Lectura obligatoria al empezar cualquier tarea
1. Leer [docs/README.md](docs/README.md) para conocer fuentes y estados.
2. Leer [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) y [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).
3. Para UI/cámaras: [docs/UX_AND_CAMERAS.md](docs/UX_AND_CAMERAS.md) y [VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md).
4. Para modelos/formatos: [docs/OBJECTS_AND_ASSETS.md](docs/OBJECTS_AND_ASSETS.md) y [docs/DATA_AND_FORMATS.md](docs/DATA_AND_FORMATS.md).
5. Para arquitectura o refactor: [docs/ARCHITECTURE_AND_QUALITY.md](docs/ARCHITECTURE_AND_QUALITY.md), [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md) y [docs/DECISION_LOG.md](docs/DECISION_LOG.md).
6. Si se trabaja en el creador por texto, leer [GENERADOR_OBJETOS.md](GENERADOR_OBJETOS.md). Es una propuesta, NO una función entregada.

## Reglas para cualquier cambio
- Producto independiente: crear/reorganizar habitaciones reales con facilidad de videojuego; futuro multihabitación. La versión mini del Laboratorio de Pablo Web 2.0 es otro alcance y NO modifica el portfolio.
- Priorizar usabilidad y legibilidad sobre realismo, funciones o complejidad técnica. Mantener estética 3D low-poly estilizada, diorama, no pixel art ni CAD.
- No modificar por iniciativa propia el alcance MVP, arquitectura aprobada, guías visuales, formatos persistidos o decisiones marcadas PENDIENTE: proponer primero un cambio documentado.
- Distinguir CONFIRMADO, PROPUESTO, EXPERIMENTAL, PENDIENTE y DESCARTADO. No presentar lo propuesto como implementado, ni lo implementado como validado visualmente.
- Inspeccionar siempre el código real antes de actuar. Las guías describen intención; pueden no coincidir todavía con el código. Documentar brechas, no ocultarlas.
- Separar datos del mundo, renderizado, controles, cámaras, estado/persistencia y UI. Una posición de objeto nunca debe depender de una vista concreta.
- No crear objetos visuales sin integrar catálogo, modelo 3D, icono, medidas, interacción y pruebas correspondientes; respetar la guía visual.
- No romper diseños guardados: versionar cambios, validar entradas y ofrecer migraciones con pruebas. Guardar en metros internamente; UI en español de España.
- Los elementos constructivos deben ser consistentes: puertas/ventanas pertenecen a paredes, sin solapes o huecos falsos; preparar paredes compartidas para el futuro, sin improvisar duplicados.
- No introducir IA, cuentas, backend, librerías grandes ni sistemas sociales por simple conveniencia. No copiar assets/código de Rooms.xyz, Room Studio u otros proyectos sin verificar su licencia y atribución.
- Preservar compatibilidad ratón/táctil/teclado, textos accesibles, movimiento reducido y mensajes claros. Evitar cargas pesadas iniciales.
- Ejecutar comprobaciones apropiadas: npm test, npm run test:e2e y npm run build (o documentar por qué alguna no pudo ejecutarse). Asegurar pruebas de vistas, dimensiones, selección, persistencia y migraciones cuando se toquen.
- No sobrescribir trabajo ajeno, no hacer commits de código no solicitados, no hacer merge ni publicar sin autorización expresa. Trabajar por rama y resumen verificable.
- Antes de reorganizar archivos, seguir [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md) y separar refactor de nuevas funciones.

## Jerarquía documental
[docs/DECISION_LOG.md](docs/DECISION_LOG.md) recoge estados. PRODUCT_VISION delimita el propósito; MVP_SCOPE, el alcance; VISUAL_STYLE_GUIDE, el diseño visual; DATA_AND_FORMATS, el contrato de datos propuesto. El código es la fuente del estado implementado. Ante contradicciones: no elegir silenciosamente; señalarla y pedir decisión.
