# Room Builder — funcionalidades futuras (NO integrarlas en el MVP local)

**Fecha:** 04/11/2026 · **Regla de prioridad:** primero terminar [MVP de una habitación](MVP_SCOPE.md) e issues [#23–#34](https://github.com/Pablo-hg/Room-Builder/issues/23). Esta hoja es un inventario de intención, no autoriza implementación ni reapertura de Workshop.

## 1. Mini para Pablo Web 2.0 — primera evolución propuesta
Reutilizar el renderer, catálogo, estado y geometría de Room Builder en la zona Laboratorio del portfolio. Experiencia guiada y limitada a una habitación con objetos elegidos; ocultar editor avanzado, sistema de variantes, exportaciones JSON/GLB y construcción multihabitación. Definir integración de navegación/aislamiento al empezar esta etapa; evitar duplicar motor o contaminar el HUB real. Solo tras estabilizar el editor principal.

## 2. Editor local multihabitación — proyecto propio, posterior
Evolución en fases: dos habitaciones contiguas primero, paredes medianeras únicas y aberturas coherentes, plano global, luego formas de 1–6 lados y paredes interiores (direcciones RB-025/RB-027). R4 propone `ProjectV2` mediante contratos y pruebas **no persistidos como formato público**; decidir migración y arquitectura tras pruebas de usuario, sin convertir el prototipo en promesa. Se prevé importar habitaciones seleccionadas y sus dependencias estructurales.

## 3. Workshop y nube — proyecto futuro separado
Se conserva el [informe maestro de Workshop del 03/11](../ROOM_BUILDER_WORKSHOP_INFORME_MAESTRO_2026-11-03.md): 22 decisiones sobre explorador, publicación, revisiones, versiones, derivados, estadísticas, permisos, moderación, cuentas Google/GitHub, sincronización y formatos JSON/GLB/imágenes. Las issues antiguas **#9–#18** se cerraron como *no planificadas* para no distraer al MVP. No reabrirlas por el mero hecho de que exista este documento.

Fases candidatas cuando llegue el momento: consolidar modelo local multihabitación → almacenamiento privado y cuentas → importación parcial/versiones → publicación explícita → explorador → moderación/costes/privacidad. Tecnologías Cloudflare Workers/D1/R2 o alternativas serán evaluadas entonces, no contratadas ahora. La cuota inicial de 100 MB por usuario, por ejemplo, es una hipótesis futura, no una restricción local.

## 4. Creación de objetos desde texto e IA — I+D
El usuario podrá describir un objeto, obtener una **definición paramétrica compatible con nuestra guía de estilo**, inspeccionarla, editarla y guardarla como asset reutilizable. Posteriormente se evaluará subida de imagen. El diseño por etapas está en [GENERADOR_OBJETOS.md](../GENERADOR_OBJETOS.md) y en [PRODUCT_VISION.md](PRODUCT_VISION.md). Seguridad: validar tamaño, geometría y permisos; **nunca** ejecutar código arbitrario recibido de un modelo. Fuera de R5 y del MVP/v0.2 imprescindible.

## 5. Monetización — hipótesis, no decisión
Posible freemium por mensualidad: editor gratis hasta ciertos límites y funciones premium para varias habitaciones y quizás importar/descargar proyectos. **No está aprobado** cobrar ni bloquear el JSON local. Valorar costes, retención, demanda, almacenamiento y sentido de la suscripción después de demostrar utilidad del editor y sin quitar derechos a diseños existentes.

## 6. Referencias y diferenciación
Inspiración: [Rooms](https://rooms.xyz) por creatividad/remix, [MakeRoom](https://store.steampowered.com/app/2212670/MakeRoom/) por estética amena y objetos, [MyRoomPlanner](https://www.myroomplanner.io/) por flujo de medidas→muebles→visualización, y Figma por organización de objetos. **No clonar** diseños, modelos, catálogos ni condiciones comerciales. Ver [REFERENCE_BENCHMARK.md](REFERENCE_BENCHMARK.md).

## Reglas para retomar el futuro
Crear issues nuevas únicamente cuando se abra formalmente una fase. Definir contrato, coste, riesgos, migraciones, controles de privacidad y pruebas antes de implementar. Mantener el proyecto offline/local útil sin cuentas.
