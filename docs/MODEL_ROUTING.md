# Política de selección de modelos para Codex y OpenCode

**Fecha:** 27/10/2026. **Estado:** configuración propuesta e implementada en el repositorio; **activación real pendiente de probar en tu OpenCode y Codex de VS Code.**

Esta guía complementa [AGENT_EFFICIENCY.md](AGENT_EFFICIENCY.md) y [../AGENTS.md](../AGENTS.md), que prevalecen ante contradicciones.

## Selección habitual

| Tarea | Modelo | Razonamiento sugerido |
|---|---|---|
| Textos, erratas, Markdown y cambios triviales | GPT-6 Luna | Low |
| React, TypeScript, tests, UI, R0 y R1 por piezas | **GPT-6.1 Terra (predeterminado)** | Medium |
| Escena 3D/cámaras (R2), Zustand/persistencia (R3), arquitectura de habitaciones (R4) | GPT-6.1 Sol | Medium |
| Revisión excepcional que justifique alto consumo | GPT-6 Astra | Solo por petición explícita |

Seleccionar por complejidad, no únicamente por número de archivos. Un fallo difícil de resolver puede requerir Sol; un cambio sencillo en un fichero 3D puede seguir siendo Terra. El resultado correcto con pocas repeticiones importa más que los tokens de un solo intento. No se garantizan cifras de consumo.

## Resultado deseado al iniciar un chat con el modelo incorrecto

1. Determinar la tarea al leer el mensaje; por defecto elegir Terra si no se identifica claramente como sencilla o compleja.
2. Si el modelo actual no coincide con el recomendado, **avisar una sola vez** indicando «modelo actual → recomendado» y el motivo.
3. **Cambiar automáticamente** solo cuando el entorno exponga una operación real y el destino sea **uno de los modelos OpenAI de la suscripción ya conectada**. El usuario autoriza ese cambio **dentro del cupo existente**; no autoriza API facturable, recargas, otros proveedores ni ejecución paralela.
4. Si no existe operación de cambio o no puede verificarse, **no afirmar que cambió**: recomendar usar el selector `/model` o el del IDE. No cambiar configuraciones globales de forma oculta.
5. Respetar `#modelo:manual` (sin selección automática) y las selecciones explícitas `#modelo:luna`, `#modelo:terra`, `#modelo:sol` o `#modelo:astra`. Astra jamás se selecciona por heurística.
6. No sustituir ni interceptar rutas gratuitas `/gratis*`, modelos `-free` o `/traspaso-codex`; se mantienen las restricciones de [AGENT_EFFICIENCY.md](AGENT_EFFICIENCY.md).
7. Los mensajes aislados «continúa», «sigue», «retoma» deben conservar el modelo actual, pues no identifican la dificultad del trabajo en curso.

### Codex nativo (extensión VS Code o CLI)
- `AGENTS.md` define la obligación de **advertir y recomendar el cambio**, pero no cambia el selector por sí mismo.
- `.codex/config.toml` fija el **valor predeterminado** a Terra y razonamiento Medium para nuevas sesiones cuando el entorno confía en el repositorio y admite configuración de proyecto.
- Para escoger otro modelo durante un chat, usar el selector de la extensión o `/model` en la CLI; el agente **no dispone de una herramienta garantizada** para pulsarlo.
- Cuando se introduzca una API/hook oficial que permita modificar una sesión Codex en curso desde el agente, integrarla, probarla y documentarla. No simular ese comportamiento con comandos que lanzan sesiones independientes.

### OpenCode
- El plugin local [`.opencode/plugins/model-routing/index.ts`](../.opencode/plugins/model-routing/index.ts) utiliza el hook `prompt` y `ctx.session.switchModel` de **OpenCode v2** para intentar cambiar entre Luna, Terra y Sol **antes** de ejecutar la tarea.
- El clasificador de bajo coste [`scripts/model-routing/policy.mjs`](../scripts/model-routing/policy.mjs) usa reglas deterministas: no consume llamadas extra de IA.
- Solo actúa si la sesión actual utiliza el proveedor `openai` y el modelo destino existe en la cuenta. **Nunca pasa a otro proveedor ni modifica los comandos gratuitos existentes.**
- Si la tarea es ambigua, conserva Terra como recomendación habitual. Si el usuario selecciona explícitamente un modelo, respeta su etiqueta `#modelo:`.
- La notificación de cambio se añade como aviso al mensaje del usuario que lo desencadenó para que el agente la comunique al comenzar.
- No garantizamos que el plugin funcione en tu instalación **hasta comprobar versión y ejecutar una prueba en OpenCode**. Puede que versiones antiguas carezcan del hook o del método. Si eso sucede, conservar las reglas y desactivar el plugin o actualizar OpenCode antes de darlo por activo.

## Cómo verificarlo en tu entorno

**Prueba aislada del clasificador**, sin gastar tokens ni llamar a proveedores:
```sh
node --test scripts/model-routing/policy.test.mjs
```

**Prueba manual en OpenCode v2** (requerida para confirmar automatización):
1. Recargar OpenCode en la carpeta del repositorio y comprobar que el plugin local aparece cargado sin errores.
2. Seleccionar manualmente **GPT-6.1 Sol** en la sesión.
3. Enviar «Corrige una errata de README.md sin editar archivos». Debe cambiar a **Luna**, si está disponible, y mostrar aviso real; si no, debe conservar Sol.
4. Enviar «Investiga un bug complejo de cámara isométrica y gizmos, sin editar archivos». Debe cambiar a **Sol** y advertir, siempre que esté disponible.
5. Ejecutar `/gratis` con una consulta sencilla: no debe modificar su proveedor/modelo gratuito ni iniciar llamadas de OpenAI pagadas.
6. Confirmar en el indicador de modelo de la sesión qué modelo se usó realmente; si no coincide, registrar fallo y dejar el plugin inactivo.

**Prueba manual en Codex VS Code:** abrir una sesión nueva desde el repositorio y verificar Terra predeterminado; seleccionar Luna y pedir un análisis complejo de cámaras. Debe **avisar** si detecta el modelo inadecuado, sin afirmar que ha podido cambiarlo cuando la extensión no ofrece la operación.

## Mantenimiento

Las reglas de texto son orientativas; no distinguen todas las tareas correctamente. Ajustar heurísticas con casos reales en las pruebas de `policy.test.mjs`. Si una selección incorrecta provoca más gasto o errores, simplificar la política. No añadir agentes clasificadores ni servicios externos de pago.

Documentación técnica:
- [Instrucciones AGENTS.md para Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Opciones de modelos de Codex CLI](https://learn.chatgpt.com/docs/cli/reference)
- [Hooks y cambios de modelo en sesiones OpenCode v2](https://opencode.ai/v2/docs/build/plugins/server)
