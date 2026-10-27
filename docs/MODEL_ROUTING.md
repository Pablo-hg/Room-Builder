# Política de selección de modelos para Codex y OpenCode

**Fecha:** 27/10/2026. **Estado:** reglas y clasificador preparados; **cambio automático de sesión NO activado** hasta implementar y probar una API compatible con la instalación.

Esta guía complementa [AGENT_EFFICIENCY.md](AGENT_EFFICIENCY.md) y [../AGENTS.md](../AGENTS.md), que prevalecen ante contradicciones.

## Selección habitual

La **tabla única de modelos, identificadores, perfiles de razonamiento y usos** está en [MODELS.md](MODELS.md). Esta guía se limita a determinar cuándo recomendar un cambio y a explicar las restricciones de automatización.

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
- El archivo [`.opencode/plugins/model-routing/index.ts`](../.opencode/plugins/model-routing/index.ts) es **un punto de integración seguro e inactivo**. La documentación oficial del plugin instalado no acredita un hook `prompt` ni `ctx.session.switchModel` con la interfaz prevista: por eso no realiza cambios automáticos. Debe implementarse tras validar un método público compatible.
- El clasificador de bajo coste [`scripts/model-routing/policy.mjs`](../scripts/model-routing/policy.mjs) usa reglas deterministas: no consume llamadas extra de IA.
- La futura integración deberá actuar exclusivamente en sesiones del proveedor `openai`, comprobar disponibilidad de destino y no tocar proveedores gratuitos ni comandos existentes.
- Si la tarea es ambigua, conserva Terra como recomendación habitual. Si el usuario selecciona explícitamente un modelo, respeta su etiqueta `#modelo:`.
- Mientras no se pruebe la integración, el aviso se solicita a Codex y OpenCode mediante `AGENTS.md`; no se garantiza una lectura automática del modelo en uso.
- No se habilita selección automática en OpenCode por defecto. La integración se estudiará con la API exacta de la versión instalada y pruebas que confirmen el cambio real y el respeto de modelos gratuitos.

## Cómo verificarlo en tu entorno

**Prueba aislada del clasificador**, sin gastar tokens ni llamar a proveedores:
```sh
node --test scripts/model-routing/policy.test.mjs
```

**Prueba de aceptación prevista para una integración futura (NO operativa hoy):**
1. Validar la versión exacta de OpenCode y diseñar una integración compatible con los hooks oficiales.
2. Preparar un test en una sesión de pruebas seleccionando **GPT-6.1 Sol**.
3. Enviar «Corrige una errata de README.md sin editar archivos». Cuando la automatización futura esté implementada: verificar que cambia a Luna y avisa, o conserva Sol si no está disponible.
4. Enviar «Investiga un bug complejo de cámara isométrica y gizmos, sin editar archivos». La futura automatización deberá cambiar a Sol y advertir, si existe autorización y está disponible.
5. Ejecutar `/gratis` con una consulta sencilla: no debe modificar su proveedor/modelo gratuito ni iniciar llamadas de OpenAI pagadas.
6. Confirmar en el indicador de modelo de la sesión qué modelo se usó realmente; no activar el plugin hasta verificar el funcionamiento completo.

**Prueba manual en Codex VS Code:** abrir una sesión nueva desde el repositorio y verificar Terra predeterminado; seleccionar Luna y pedir un análisis complejo de cámaras. Debe **avisar** si detecta el modelo inadecuado, sin afirmar que ha podido cambiarlo cuando la extensión no ofrece la operación.

## Mantenimiento

Las reglas de texto son orientativas; no distinguen todas las tareas correctamente. Ajustar heurísticas con casos reales en las pruebas de `policy.test.mjs`. Si una selección incorrecta provoca más gasto o errores, simplificar la política. No añadir agentes clasificadores ni servicios externos de pago.

Documentación técnica:
- [Instrucciones AGENTS.md para Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Opciones de modelos de Codex CLI](https://learn.chatgpt.com/docs/cli/reference)
- [Hooks y cambios de modelo en sesiones OpenCode v2](https://opencode.ai/v2/docs/build/plugins/server)

### Formato obligatorio de recomendación

Al recomendar un modelo, indicar SIEMPRE:

- Modelo recomendado: nombre y versión.
- Razonamiento recomendado: Low, Medium, High o Extra High.
- Modelo y razonamiento actuales, si pueden verificarse.
- Motivo breve de la recomendación.
- Si es necesario cambiar la configuración actual.

Formato:
"Recomiendo [MODELO] · [RAZONAMIENTO]
para esta tarea porque [MOTIVO].
Configuración actual: [MODELO] · [RAZONAMIENTO].
[Cambiar / Mantener configuración]."

No recomendar cambiar de modelo sin justificar
el beneficio frente al consumo adicional.
No afirmar conocer el esfuerzo actual si no
puede comprobarse.

