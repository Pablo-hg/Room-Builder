# Plan maestro — MVP local completo de Room Builder

**Aprobado para planificación: 04/11/2026.** Épica: [#23](https://github.com/Pablo-hg/Room-Builder/issues/23). Este es el **único backlog canónico de todo el MVP**. Las fases se organizan por los **siete Milestones nativos de GitHub**, asignados a las 24 tareas y visibles en la barra lateral de cada issue. Las **únicas etiquetas activas son `prioridad:P0` y `prioridad:P1`**. `LOCAL_MVP_BACKLOG.md` queda como índice de la fase inicial v0.2.

## Definición de producto terminado
Desde una habitación rectangular, el usuario puede construir una **vivienda por plantas** con estancias conectadas y paredes reales, contornos editables, cotas, importación de plano calibrado, herramientas precisas, materiales, plantillas personales, editor manual de muebles, vistas 2D/3D y recorrido WASD; guardar/abrir/importar/exportar la vivienda completa sin cuenta ni backend. Solo se valorará publicar tras **#54** y aprobación humana.

**Dos hitos dentro del mismo MVP:** v0.2 = checkpoint de habitación única (#33); **MVP local completo** = todas las fases F0–F6 y gate #54. No confundir una demo funcional con un producto certificado.

## Organización del backlog en GitHub (04/11/2026)

Hay **24 tareas reales de ejecución + la épica #23**. Las siete issues contenedoras creadas anteriormente **#55–#61 se han cerrado como archivo organizativo**, porque duplicaban la clasificación por fases. **No se han cerrado tareas de desarrollo.**

- Cada tarea conserva una **única etiqueta**, `prioridad:P0` o `prioridad:P1`. La fase se expresa con el **Milestone nativo** de GitHub, y el orden 01–24 se consulta en la tabla de este documento; no existen etiquetas duplicadas de `mvp`, `tipo`, `fase`, `hito` u `orden` en las tareas abiertas.
- **Hitos nativos (*Milestones*) activos y verificados:** el propietario creó F0–F6 y se asignaron las **24 tareas** a sus hitos reales (números 1–7). La épica #23 queda sin hito. No volver a crear issues «carpeta» para sustituirlos.
- Distribución real verificada en la [pantalla de hitos](https://github.com/Pablo-hg/Room-Builder/milestones), sin duplicar las issues:

| Milestone de GitHub | Issues asignadas |
| --- | --- |
| F0 — Estabilización | 24, 34 |
| F1 — Editor base (v0.2) | 25, 26, 27, 28, 29, 30, 31, 32, 33 |
| F2 — Precisión y plantillas | 37, 38, 41 |
| F3 — Materiales y fotografía | 39, 40 |
| F4 — Vivienda completa | 51, 35, 52, 53, 45, 36 |
| F5 — Modelos de muebles | 47 |
| F6 — Validación final | 54 |

**Los siete Milestones ya están creados y las 24 tareas asignadas.** Se pueden filtrar desde la interfaz de GitHub por Milestone; no añadir una cabecera de hito dentro de la descripción de cada issue. La épica #23 mantiene el resumen global y este documento, las dependencias.

## Orden recomendado y prioridades

| Orden | Issue | Fase | Prioridad | Depende de | Resultado | Nota |
| ---: | --- | --- | --- | --- | --- | --- |
| 01 | [#24](https://github.com/Pablo-hg/Room-Builder/issues/24) | F0 | P0 | — | Baseline reproducible, CI, suite E2E | GATE inicial |
| 02 | [#34](https://github.com/Pablo-hg/Room-Builder/issues/34) | F0 | P1 | #24 | Auditoría y refactor seguro sin cambio funcional |  |
| 03 | [#25](https://github.com/Pablo-hg/Room-Builder/issues/25) | F1 | P0 | #24 | Persistencia local, JSON y migración v1–v5 |  |
| 04 | [#26](https://github.com/Pablo-hg/Room-Builder/issues/26) | F1 | P0 | #24, #25 | Medidas, perímetro acotado, huecos, colisiones |  |
| 05 | [#27](https://github.com/Pablo-hg/Room-Builder/issues/27) | F1 | P1 | #24 | Primer uso, flujo e interfaz comprensibles |  |
| 06 | [#28](https://github.com/Pablo-hg/Room-Builder/issues/28) | F1 | P1 | #24, #25 | Multiselección, jerarquía, carpetas y gestos |  |
| 07 | [#29](https://github.com/Pablo-hg/Room-Builder/issues/29) | F1 | P1 | #24, #26 | Plano/Isométrica/POV fijo y cámaras |  |
| 08 | [#30](https://github.com/Pablo-hg/Room-Builder/issues/30) | F1 | P1 | #24 | Catálogo y estilo visual |  |
| 09 | [#31](https://github.com/Pablo-hg/Room-Builder/issues/31) | F1 | P0 | #27–#30 | Accesibilidad, teclado, táctil y responsive |  |
| 10 | [#32](https://github.com/Pablo-hg/Room-Builder/issues/32) | F1 | P1 | #24; terminar tras F1 | Rendimiento/offline local y build estático |  |
| 11 | [#33](https://github.com/Pablo-hg/Room-Builder/issues/33) | F1 | P0 | #24–#32 + #34 | E2E y aceptación del **checkpoint v0.2** | Checkpoint, no release final |
| 12 | [#37](https://github.com/Pablo-hg/Room-Builder/issues/37) | F2 | P1 | #24, #26, #28 | Guías inteligentes en Plano e Isométrica; magnetismo opcional | C+B |
| 13 | [#38](https://github.com/Pablo-hg/Room-Builder/issues/38) | F2 | P1 | #24, #26 | Regla de puntos + anotaciones guardadas | C |
| 14 | [#41](https://github.com/Pablo-hg/Room-Builder/issues/41) | F2 | P1 | #25, #27, #30 | Plantillas vacías, amuebladas y personales | C |
| 15 | [#39](https://github.com/Pablo-hg/Room-Builder/issues/39) | F3 | P1 | #25, #30 | Materiales, pintura y cuentagotas | C |
| 16 | [#40](https://github.com/Pablo-hg/Room-Builder/issues/40) | F3 | P1 | #25, #29 | Foto avanzada PNG y cámaras recuperables | C |
| 17 | [#51](https://github.com/Pablo-hg/Room-Builder/issues/51) | F4 | P0 | #24–#26 | Contrato de casa/planta y migración | Nuevo requisito estructural |
| 18 | [#35](https://github.com/Pablo-hg/Room-Builder/issues/35) | F4 | P0 | #51, #26 | Vértices y edición de geometría irregular |  |
| 19 | [#52](https://github.com/Pablo-hg/Room-Builder/issues/52) | F4 | P0 | #51, #35 | Habitaciones conectadas, planta global, medianeras |  |
| 20 | [#53](https://github.com/Pablo-hg/Room-Builder/issues/53) | F4 | P0 | #52, #29 | Múltiples plantas y selector de nivel |  |
| 21 | [#45](https://github.com/Pablo-hg/Room-Builder/issues/45) | F4 | P1 | #35, #38, #52 | Plano importado calibrado y trazado asistido | B |
| 22 | [#36](https://github.com/Pablo-hg/Room-Builder/issues/36) | F4 | P0 | #29, #51, #52 | POV libre WASD y tránsito entre puertas |  |
| 23 | [#47](https://github.com/Pablo-hg/Room-Builder/issues/47) | F5 | P1 | #25, #28, #30, #39 | Editor de muebles por primitivas, grupos y materiales | B |
| 24 | [#54](https://github.com/Pablo-hg/Room-Builder/issues/54) | F6 | P0 | **Todas las anteriores** | Validación integral + decisión de publicar | **ÚNICA GATE FINAL** |

### Semántica del tablero (únicamente dos etiquetas)
- **Milestone** en la barra lateral de GitHub = fase F0–F6 y seguimiento automático de su avance.
- **`prioridad:P0`** = bloqueante por datos, arquitectura, accesibilidad o cierre; **`prioridad:P1`** = menos urgente, pero comprometida igualmente con el MVP. **P1 no es opcional.**
- **Orden 01–24** = la secuencia recomendada en la tabla anterior, **no una etiqueta** ni una cadena rígida; puede haber PR paralelas si las dependencias lo permiten.
- **Épica #23** = resumen global, también con etiqueta P0 pero sin Milestone.
- **F1/#33** es checkpoint v0.2; **F6/#54**, gate final del MVP. No volver a crear etiquetas `mvp`, `tipo:*`, `orden:*`, `fase:*` ni `hito:*` por inercia.
- [#23](https://github.com/Pablo-hg/Room-Builder/issues/23) es la épica general, **no** una tarea de ejecución adicional. Las antiguas issues contenedoras #55–#61 están archivadas/cerradas, **no son tareas pendientes**.

### Camino crítico de arquitectura
`#24 → #25/#26 → #51 → #35 → #52 → #53 → #36 (casa) → #54`. El trazado asistido #45 exige también #35/#38; el editor modular #47 depende de materiales #39. #41 ofrece plantillas de habitación individual antes; **#52** incorpora las plantillas como habitación conectada. #40 permite cámaras guardadas simples antes; **#53** las hace conscientes de la planta.

### Estrategia de ramas y entregas
- Crear `feature/<numero>-resumen` desde `origin/main` actualizado, una issue por rama y PR; evitar rama común de cambios durante semanas sin integrar.
- Antes de modificar: comprobar que la función no esté ya implementada, leer la issue y contratos afectados, fijar tests y casos de éxito.
- Tests puros en dominio, integración React/Three cuando aplique, E2E y comparación visual en vistas afectadas; `npm ci`, tests, build y CI según riesgo. Si alguna comprobación falla o no puede ejecutarse, dejar evidencia.
- No introducir comportamientos del editor multihabitación mediante duplicación de estado o segunda escena no persistida.
- La publicación, tag, dominio y despliegue definitivo **requieren consentimiento posterior**, no quedan autorizados por este plan.

## Alcances confirmados de las siete funcionalidades
1. [#37](https://github.com/Pablo-hg/Room-Builder/issues/37): **C+B**, líneas y magnetismo configurables, **Plano e Isométrica**, Alt suspende magnetismo y solapes permitidos.
2. [#38](https://github.com/Pablo-hg/Room-Builder/issues/38): **C**, medición con ayudas, distancia libre/horizontal/vertical y cotas guardables. Diferente de cotas de perímetro #26.
3. [#39](https://github.com/Pablo-hg/Room-Builder/issues/39): **C**, materiales estilizados personalizables + pintar + cuentagotas.
4. [#40](https://github.com/Pablo-hg/Room-Builder/issues/40): **C**, fotografía PNG avanzada + **cámaras guardadas**.
5. [#41](https://github.com/Pablo-hg/Room-Builder/issues/41): **C**, plantillas vacías/amuebladas + guardar plantillas propias.
6. [#45](https://github.com/Pablo-hg/Room-Builder/issues/45): **B**, imagen calibrada + asistencia a trazado, con revisión humana, **sin IA automática**.
7. [#47](https://github.com/Pablo-hg/Room-Builder/issues/47): **B**, editor modular de piezas/grupos/materiales, **no** Blender/CAD de mallas.

## Criterio de parada y gate final
- Se validan los flujos completos de habitación y casa de [#54](https://github.com/Pablo-hg/Room-Builder/issues/54), incluyendo migración JSON v1–v5, geometría, agujeros, piezas propias, fotos, controles móviles y recorrido.
- No hay fallos P0 conocidos, archivos corruptos, bloqueos serios o discrepancias de mundo entre vistas; las advertencias menores se documentan.
- `main` y documentación reflejan un único alcance estable; los tests E2E se ejecutan **juntos** tras últimos cambios.
- Se prepara un **candidato de publicación revisable**. **No publicar** hasta que el propietario dé luz verde expresa.

## Fuera del MVP
Las propuestas pendientes y referencias adicionales se conservan en [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md). Workshop (#9–#18) y las alternativas no elegidas (#42–#44, #46, #48–#50) siguen cerradas; la IA generativa y la monetización se plantearán después, no se reactivan de forma implícita.
