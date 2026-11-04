# Backlog operativo — terminar el MVP local antes de Workshop

**Fecha:** 04/11/2026 · **Épica:** [#23](https://github.com/Pablo-hg/Room-Builder/issues/23) · **Baseline:** `main` tras merge de R5 (#22).

## Ejecución incremental
| Gate | Issue | Prioridad | Entregable y criterio |
| --- | --- | --- | --- |
| G0 | [#24](https://github.com/Pablo-hg/Room-Builder/issues/24) | P0 | Reejecutar R5, suite E2E **global**, CI y baseline reproducible |
| G1 | [#25](https://github.com/Pablo-hg/Room-Builder/issues/25) | P0 | Guardado y JSON v1–v5 robustos sin pérdidas ni overwrite |
| G2 | [#26](https://github.com/Pablo-hg/Room-Builder/issues/26) | P0 | Medidas, redimensionado, huecos y advertencias de colisión coherentes |
| G3 | [#27](https://github.com/Pablo-hg/Room-Builder/issues/27) | P1 | Simplificación de primer uso y jerarquía de controles |
| G4 | [#28](https://github.com/Pablo-hg/Room-Builder/issues/28) | P1 | Selección múltiple, carpetas, visibilidad, gestos y undo |
| G5 | [#29](https://github.com/Pablo-hg/Room-Builder/issues/29) | P1 | Cámaras esenciales, 4 diagonales, POV y controles |
| G6 | [#30](https://github.com/Pablo-hg/Room-Builder/issues/30) | P1 | Catálogo mínimo e iconos/modelos con coherencia visual |
| G7 | [#31](https://github.com/Pablo-hg/Room-Builder/issues/31) | P0 | Accesibilidad, teclado, táctil y responsive |
| G8 | [#32](https://github.com/Pablo-hg/Room-Builder/issues/32) | P1 | Rendimiento, fiabilidad local y preparación build estático |
| G9 | [#33](https://github.com/Pablo-hg/Room-Builder/issues/33) | P0 | Recorridos integrales, usuarios y propuesta de RC v0.2 |

**Orden recomendado:** G0 antes de cualquier modificación significativa; G1–G2 antes de UX; G3–G6 pueden agruparse por interfaz sin solapar archivos en PR paralelas; G7 antes de G9; G8 puede investigarse en paralelo tras G0; G9 necesariamente la última.

## Contrato de cada PR
- Identificar base SHA y si el problema ya está resuelto; no reimplementar R5.
- Alcance acotado, tests dirigidos y un riesgo a la vez; preservar IDs, esquemas, migraciones y medidas.
- Capturas antes/después en cambios visuales; verificación de ratón/teclado/táctil según alcance.
- Actualizar docs y pruebas con el código; registrar comandos y resultados verdaderos.
- No mezclar Workshop, IA, casas, cobros ni Mini en una issue del MVP local.

## Puertas de calidad
- **G0 bloqueada hasta probar:** el informe R5 indica éxito unitario/build pero no nueva pasada E2E completa y única tras últimos arreglos. Ello no implica que la app no funcione; implica que **no hay certificación global**.
- **Sin regresión de datos:** importar nunca pisa ni borra sin confirmar; conservar legacy v1–v5 y política de anclajes.
- **Release:** no etiquetar ni desplegar como v0.2 terminada por cerrar solo pruebas unitarias; incluir experiencia del usuario y regresión E2E.

## Después del MVP
La siguiente prioridad de producto es una **versión Mini reutilizando el mismo motor** para Pablo Web 2.0. Multihabitación y Workshop quedan documentados, sin issues de implementación activas. Ver [FUTURE_ROADMAP](FUTURE_ROADMAP.md).
