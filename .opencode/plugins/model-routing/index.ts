// Integración reservada para una futura API comprobada en la versión local de OpenCode.
// IMPORTANTE: el SDK público consultado utiliza funciones que devuelven hooks; la
// interfaz experimental session.hook('prompt') / session.switchModel NO está
// documentada como hook válido de plugins y NO debe activarse por suposición.
//
// La selección recomendada está en docs/MODEL_ROUTING.md. El clasificador puro
// está en scripts/model-routing/policy.mjs y tiene pruebas propias.
//
// Evitamos activar un cambio de modelo o proveedor no verificado en la sesión.
export const ModelRoutingPlaceholder = async () => ({})
