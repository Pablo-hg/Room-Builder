# Registro de decisiones — Room Builder

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
| RB-012 | Mini del Laboratorio: misma base técnica, experiencia reducida a una habitación | PROPUESTO | Integración y alcance oficial aún pendientes |
| RB-013 | Modelo de datos multiproyecto, paredes compartidas, variantes aisladas | PROPUESTO | Contrato sin implementar, requiere validación |
| RB-014 | Generador de muebles a partir de texto | EXPERIMENTAL | Existe GENERADOR_OBJETOS.md, no implementado |
| RB-015 | Soporte pleno de casas, plantas, escaleras y geometría irregular | PENDIENTE | Visión futura; límites por definir |
| RB-016 | Paleta cromática exacta, tokens, ejemplos/asset pack de referencia | PENDIENTE | La dirección visual sí está acordada |
| RB-017 | Cantidad de muebles, metas de rendimiento y dispositivos mínimos | PENDIENTE | Validar al medir |
| RB-018 | Publicación pública, licencias del código/assets, modalidades de distribución | PENDIENTE | Repositorio privado actual |
| RB-019 | Refactor por fases sin nuevas funciones ni alteración visual | PROPUESTO | Ver REFACTOR_PLAN |
| RB-020 | No simular exactitud arquitectónica/estructural ni usar datos privados externos | CONFIRMADO como principio | Visualización orientativa |

## Aclaraciones
- **CONFIRMADO** aquí alude a decisiones expresas de esta conversación, no a entregas realizadas o a documentación global del portfolio.
- **PROPUESTO** no autoriza ejecución automática: revisar al planificar tareas.
- El código actual es fuente de lo implementado; el registro expresa el objetivo.
- Las nuevas decisiones se añaden con fecha, impacto, alternativas y motivo. No se sobrescribe el historial sin rastro.

## Cambios pendientes más relevantes
1. Validar por prototipo la simplificación visual de los controles.
2. Acordar MVP de una habitación frente a alcance posterior multihabitación.
3. Establecer paleta/ejemplos concretos solo tras una comparación visual en producto.
4. Definir esquema de proyecto/variantes después de la auditoría del refactor.
