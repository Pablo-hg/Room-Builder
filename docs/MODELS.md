# Modelos de IA — Room Builder

**Actualizado:** 27/10/2026 · **Rama de referencia:** `fix/r0-baseline`

Este documento es la **referencia única de qué modelos usamos y para qué**. Es una política de uso recomendada y basada en la configuración del repositorio, **no un ranking validado mediante pruebas comparativas**.

- [`../AGENTS.md`](../AGENTS.md): reglas superiores del proyecto, protección de código y autorización de gasto.
- [`MODEL_ROUTING.md`](MODEL_ROUTING.md): clasificación de tareas, avisos y condiciones para cambiar de modelo.
- [`AGENT_EFFICIENCY.md`](AGENT_EFFICIENCY.md): ahorro de tokens, contexto, pruebas y traspasos.
- [`../.codex/config.toml`](../.codex/config.toml) y [`../opencode.jsonc`](../opencode.jsonc): configuración **efectiva** de cada cliente. Si esta guía difiere del código de configuración, comprobar ambos y corregir la discrepancia; no afirmar que la guía aplica cambios por sí sola.

## 1. Regla general

**Predeterminado: Codex con la suscripción ChatGPT ya conectada.** En OpenCode el modelo inicial es `openai/gpt-6.1-terra`. En Codex nativo, `.codex/config.toml` fija `gpt-6.1-terra` con razonamiento `medium` para sesiones compatibles.

**Modo gratuito: solamente cuando lo solicite el usuario**, mediante `/gratis*` o seleccionando manualmente un modelo con sufijo `-free` en `/models`. No cambiar de proveedor silenciosamente y no utilizar APIs facturables o recargas automáticas. Cambiar entre Luna, Terra y Sol dentro de la suscripción puede recomendarse; su automatización sigue pendiente de validación.

## 2. Modelos OpenAI / Codex

| Modelo | Identificador en OpenCode | Razonamiento orientativo | Cuándo elegirlo | Estado |
|---|---|---|---|---|
| **GPT-6 Luna** | `openai/gpt-6-luna` | Low | Erratas, Markdown, textos, tareas muy acotadas | Recomendado; selección real manual |
| **GPT-6.1 Terra** | `openai/gpt-6.1-terra` | **Medium** | Desarrollo habitual con React/TypeScript, hooks, UI, tests y R0/R1 por partes | **Predeterminado** |
| **GPT-6.1 Sol** | `openai/gpt-6.1-sol` | Medium | Arquitectura, cámaras y escena 3D, R2/R3/R4, Zustand/persistencia, migraciones y bugs difíciles | Recomendado; selección real manual |
| **GPT-6 Astra** | `openai/gpt-6-astra` | Según tarea, con control de consumo | Revisión excepcional de gran complejidad | **Solo por solicitud expresa** |

Los niveles Low y Medium son **orientaciones**. El razonamiento Medium de Terra sí está reflejado en `.codex/config.toml`; esta tabla no reconfigura el razonamiento de los demás modelos. Un cambio 3D sencillo puede resolverse con Terra y un bug pequeño pero difícil puede justificar Sol. No elegir por el número de archivos exclusivamente.

## 3. Modelos gratuitos de OpenCode

Todos los siguientes identificadores están contemplados en `opencode.jsonc`. La disponibilidad y gratuidad reales deben comprobarse en el momento de usarlos.

| Modelo gratuito | Identificador exacto | Comando | Para qué lo usamos |
|---|---|---|---|
| **DeepSeek V4.1 Flash Free** | `opencode/deepseek-v4.1-flash-free` | `/gratis` | Programación habitual y continuación de tareas |
| **MiMo V2.6 Flash Free** | `opencode/mimo-v2.6-flash-free` | `/gratis-alternativa` | Segunda opción para desarrollo o corrección de errores |
| **GLM-5.3 Flash Free** | `opencode/glm-5.3-flash-free` | `/gratis-rapido` | Erratas, documentación y cambios pequeños |
| **Nemotron 3 Ultra Free** | `opencode/nemotron-3-ultra-free` | `/gratis-profundo` | Investigar refactors complejos, arquitectura, 3D o persistencia |
| **Nemotron 3.5 Super VL Free** | `opencode/nemotron-3.5-super-vl-free` | `/gratis-visual` | Interpretar capturas, interfaces y escenas 3D |

**Traspaso:** `/traspaso-codex` utiliza `opencode/deepseek-v4.1-flash-free` para preparar `.ai/TASK_HANDOFF.md` antes de regresar a Codex. No debe modificar el código.

Estos son **usos candidatos**, no resultados de un benchmark. La etiqueta `-free` distingue las rutas elegidas de otras versiones del catálogo sin esa etiqueta; no presupone disponibilidad permanente ni ausencia de límites por cuenta.

## 4. Decidir qué modelo usar

| Trabajo | Codex preferido | Bajo petición de modo gratuito |
|---|---|---|
| Textos y retoques mínimos | Luna · Low | `/gratis-rapido` (GLM) |
| React, TypeScript, componentes, tests | **Terra · Medium** | `/gratis` (DeepSeek); alternativa MiMo |
| Refactor complejo, cámaras, R2/R3/R4 | Sol · Medium | `/gratis-profundo` (Nemotron Ultra) |
| Comprobar capturas y resultados visuales | Terra o Sol según complejidad | `/gratis-visual` (Nemotron VL) |
| Revisión de cambios de alto riesgo | Codex según riesgo; Astra solo si se pide | Revisión independiente gratuita cuando sea suficiente |

Cuando Codex recupera cuota tras continuar con un modelo gratuito, **revisar el diff, las pruebas y el traspaso antes de rehacer trabajo**. Para modificaciones triviales no imponer una revisión profunda.

## 5. Comportamiento real de las herramientas

- **Codex nativo (VS Code/CLI):** sigue su propio chat. Leer `AGENTS.md` no permite cambiar el selector; el archivo `.codex/config.toml` fija un valor inicial en los entornos compatibles.
- **OpenCode:** el predeterminado está en `opencode.jsonc`; el modelo seleccionado manualmente para una sesión puede prevalecer sobre él.
- **Comandos `/gratis*`:** ejecutan **esa petición** con el modelo gratuito indicado; **no garantizan** que los siguientes mensajes sigan usando ese modelo. Para varias peticiones, seleccionarlo en `/models`.
- **Fallback al agotarse la cuota:** **NO está automatizado**. Si se acaba Codex, cambiar manualmente al gratuito solicitado; si se agota un gratuito, no asumir que otro modelo del mismo proveedor tiene una cuota independiente.
- **Cambio automático Luna/Terra/Sol:** la política y un clasificador existen, pero la integración operativa de cambio de sesión sigue **inactiva**. No afirmar que se seleccionó otro modelo sin comprobarlo.
- **Seguridad y gasto:** no introducir como fallback versiones de pago de `opencode/*`, APIs facturables, recargas automáticas, subagentes de pago ni Astra por iniciativa del agente.

## 6. Mantenimiento

Si cambian los modelos disponibles o la política: comprobar primero `opencode models` y las configuraciones de cada cliente; actualizar después **este catálogo**, luego las reglas de enrutamiento solo si cambia el criterio. Evitar copiar tablas de modelos a otras guías. Verificar la ejecución real de comandos por separado, sin confundir su mera presencia en JSONC con una prueba funcional.
