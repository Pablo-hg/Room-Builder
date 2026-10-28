# Política de selección de modelos para Codex y OpenCode

**Fecha:** 27/10/2026. **Estado:** reglas y clasificador preparados; **cambio automático de sesión NO activado** hasta implementar y probar una API compatible con la instalación.

Esta guía complementa [AGENT_EFFICIENCY.md](AGENT_EFFICIENCY.md) y [../AGENTS.md](../AGENTS.md), que prevalecen ante contradicciones.

## Selección habitual

La **tabla única de modelos, identificadores, perfiles de razonamiento y usos** está en [MODELS.md](MODELS.md). Esta guía se limita a determinar cuándo recomendar un cambio y a explicar las restricciones de automatización.

Seleccionar por complejidad, no únicamente por número de archivos. Un fallo difícil de resolver puede requerir Sol; un cambio sencillo en un fichero 3D puede seguir siendo Terra. El resultado correcto con pocas repeticiones importa más que los tokens de un solo intento. No se garantizan cifras de consumo.

La evaluación del modelo se realizará cuando el usuario solicite una recomendación o comparación; no se realizará como paso obligatorio antes de cada tarea. Si el usuario ya ha elegido un modelo, respetar la elección.

## Selección y cambio de modelo

1. No evaluar ni recomendar modelos automáticamente al iniciar una tarea. Ejecutar directamente con el modelo seleccionado.
2. Cuando el usuario solicite una recomendación, analizar la dificultad y consultar `docs/MODELS.md`. Indicar modelo, razonamiento recomendado y motivo breve.
3. Si el usuario ya ha elegido un modelo, respetar esa elección. No repetir avisos ni interrumpir tareas en curso.
4. El cambio automático de modelo sigue **INACTIVO** hasta disponer de una integración real, compatible y probada. No afirmar que un cambio se ha realizado sin verificarlo.
5. Cualquier futura automatización estará limitada a modelos OpenAI incluidos en la suscripción conectada, sin API facturable, recargas ni proveedores adicionales. Solo podrá activarse con autorización del usuario y pruebas de funcionamiento.
6. Respetar `#modelo:manual`, `#modelo:luna`, `#modelo:terra`, `#modelo:sol` y `#modelo:astra`. Astra nunca se elegirá automáticamente.
7. No interferir con `/gratis*`, los modelos `-free` ni `/traspaso-codex`.
8. Los mensajes «continúa», «sigue» o «retoma» conservarán el modelo seleccionado sin una nueva evaluación.

### Codex nativo (extensión VS Code o CLI)

- `AGENTS.md` establece que se recomienda modelo **solo si el usuario lo pide**; no obliga a anunciar una recomendación al iniciar tareas.
- `.codex/config.toml` fija el **valor predeterminado** a Terra y razonamiento Medium para nuevas sesiones cuando el entorno confía en el repositorio y admite configuración de proyecto.
- Para escoger otro modelo durante un chat, usar el selector de la extensión o `/model` en la CLI; el agente **no dispone de una herramienta garantizada** para pulsarlo.
- Cuando se introduzca una API/hook oficial que permita modificar una sesión Codex en curso desde el agente, integrarla, probarla y documentarla. No simular ese comportamiento con comandos que lanzan sesiones independientes.

### OpenCode

- El archivo [`.opencode/plugins/model-routing/index.ts`](../.opencode/plugins/model-routing/index.ts) es **un punto de integración seguro e inactivo**. La documentación oficial del plugin instalado no acredita un hook `prompt` ni `ctx.session.switchModel` con la interfaz prevista: por eso no realiza cambios automáticos. Debe implementarse tras validar un método público compatible.
- El clasificador de bajo coste [`scripts/model-routing/policy.mjs`](../scripts/model-routing/policy.mjs) usa reglas deterministas: no consume llamadas extra de IA.
- La futura integración deberá actuar exclusivamente en sesiones del proveedor `openai`, comprobar disponibilidad de destino y no tocar proveedores gratuitos ni comandos existentes.
- Si la tarea es ambigua, conserva Terra como recomendación habitual **cuando el usuario solicite una recomendación**. Si el usuario selecciona explícitamente un modelo, respeta su etiqueta `#modelo:`.
- Mientras no se pruebe la integración, **solo se debe recomendar un modelo cuando el usuario lo solicite**. No se garantiza una lectura automática del modelo en uso.
- No se habilita selección automática en OpenCode por defecto. La integración se estudiará con la API exacta de la versión instalada y pruebas que confirmen el cambio real y el respeto de modelos gratuitos.

## Cómo verificarlo en tu entorno

**Prueba aislada del clasificador**, sin gastar tokens ni llamar a proveedores:

```sh
node --test scripts/model-routing/policy.test.mjs
```

**Prueba de aceptación prevista para una integración futura (NO operativa hoy):**

1. Validar la versión exacta de OpenCode y diseñar una integración compatible con los hooks oficiales.
2. Preparar un test en una sesión de pruebas seleccionando **GPT-6.1 Sol**.
3. Enviar «Corrige una errata de README.md sin editar archivos». Cuando la automatización futura esté implementada y autorizada: verificar que cambia a Luna y avisa, o conserva Sol si no está disponible.
4. Enviar «Investiga un bug complejo de cámara isométrica y gizmos, sin editar archivos». La futura automatización deberá cambiar a Sol y advertir, si existe autorización y está disponible.
5. Ejecutar `/gratis` con una consulta sencilla: no debe modificar su proveedor/modelo gratuito ni iniciar llamadas de OpenAI pagadas.
6. Confirmar en el indicador de modelo de la sesión qué modelo se usó realmente; no activar el plugin hasta verificar el funcionamiento completo.

**Prueba manual en Codex VS Code:** abrir una sesión nueva desde el repositorio y verificar Terra predeterminado; seleccionar Luna y pedir un análisis complejo de cámaras. **No debe recomendar un cambio por iniciativa propia**. Si el usuario pregunta si Luna es adecuado, debe recomendar el modelo y razonamiento convenientes sin afirmar que ha cambiado de configuración.

## Mantenimiento

Las reglas de texto son orientativas; no distinguen todas las tareas correctamente. Ajustar heurísticas con casos reales en las pruebas de `policy.test.mjs`. Si una selección incorrecta provoca más gasto o errores, simplificar la política. No añadir agentes clasificadores ni servicios externos de pago.

Documentación técnica:

- [Instrucciones AGENTS.md para Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Opciones de modelos de Codex CLI](https://learn.chatgpt.com/docs/cli/reference)
- [Hooks y cambios de modelo en sesiones OpenCode v2](https://opencode.ai/v2/docs/build/plugins/server)

### Formato obligatorio de recomendación (solo cuando el usuario la solicite)

Al recomendar un modelo, indicar:

- Modelo recomendado: nombre y versión.
- Razonamiento recomendado: Low, Medium, High o Extra High.
- Modelo y razonamiento actuales, **solo si pueden verificarse**.
- Motivo breve de la recomendación.
- Si es necesario cambiar la configuración actual.

Formato:

> Recomiendo [MODELO] · [RAZONAMIENTO] para esta tarea porque [MOTIVO].
>
> Configuración actual: [MODELO] · [RAZONAMIENTO], si está disponible.
>
> [Cambiar / Mantener configuración].

No recomendar cambiar de modelo sin justificar el beneficio frente al consumo adicional. No afirmar conocer el esfuerzo actual si no puede comprobarse.
