import { Plugin } from '@opencode/plugin'
import { classifyTask } from '../../../scripts/model-routing/policy.mjs'

const eligible = new Set(['gpt-6-luna','gpt-6.1-terra','gpt-6.1-sol','gpt-6-astra'])
// Plugin OpenCode v2, sin llamadas de clasificación ni subagentes.
// No afecta al chat nativo de Codex VS Code.
export default Plugin.define({
  id: 'room-builder.model-router',
  async setup(ctx) {
    if (typeof ctx.session?.hook !== 'function' || typeof ctx.session?.switchModel !== 'function') return
    await ctx.session.hook('prompt', async (event) => {
      const route = classifyTask(event.prompt?.text)
      if (!route.model || !eligible.has(route.model)) return
      let session
      try {
        session = await ctx.session.get({ sessionID: event.sessionID })
      } catch {
        return // Si no se puede confirmar el modelo, no cambiar nada.
      }
      const current = session?.model
      // Jamás cambiar de proveedor; especialmente no interceptar los comandos -free.
      if (!current || current.providerID !== 'openai' || !/^gpt-/.test(current.id)) return
      if (current.id === route.model) return
      try {
        const models = await ctx.model.list()
        const target = models.find(model => model.providerID === 'openai' && model.id === route.model && model.enabled !== false)
        if (!target) return // Modelo no disponible: preservar la selección.
        await ctx.session.switchModel({
          sessionID: event.sessionID,
          model: { providerID: 'openai', id: route.model },
        })
        // Advertir una sola vez en la tarea que motiva el cambio.
        event.prompt.text = '[Selección automática Room Builder: se ha cambiado el modelo de ' +
          current.id + ' a ' + route.model + ' (' + route.reason +
          '). Infórmame brevemente del cambio al empezar; después ejecuta mi petición normalmente.]\n\n' +
          event.prompt.text
      } catch {
        // Si OpenCode no admite el cambio o falla, no impedir la petición.
        event.prompt.text = '[Aviso Room Builder: esta tarea recomienda ' +
          route.model + ', pero no se ha podido confirmar el cambio automático. ' +
          'Indícame al comenzar que debo revisar el selector de modelo; no afirmes que ha cambiado.]\n\n' +
          event.prompt.text
      }
    })
  },
})
