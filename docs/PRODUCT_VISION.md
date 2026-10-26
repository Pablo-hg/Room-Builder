# Visión de producto — Room Builder

**Estado:** CONFIRMADO en visión general; detalles técnicos indicados como PROPUESTO.

## Problema que resuelve
Quiero representar mi habitación —sus dimensiones, puertas, ventanas y muebles— y experimentar en segundos con otras distribuciones sin mover nada en la realidad. Otros usuarios también podrán crear espacios imaginarios por diversión. El editor debe dar confianza espacial, pero sentirse como un juego.

## Promesa principal
**«Crea, decora y reinventa tus espacios.»**

Una herramienta para construir habitaciones con la sencillez de un videojuego: estética alegre y geométrica, interacción directa, medidas editables bajo demanda y transición inmediata entre distribución en plano y visualización en 3D.

## Usuarios y trabajos
1. **Quien reorganiza una habitación real:** mide aproximadamente su espacio, añade muebles de dimensiones ajustables, guarda el original y prueba alternativas A/B.
2. **Quien juega a decorar:** comienza de cero, coloca muebles visualmente y crea una habitación inventada.
3. **Futuro — quien construye una vivienda:** enlaza estancias y explora su planta o casa completa; no debe necesitar un CAD.

## Dos productos relacionados, no dos motores independientes
- **Room Builder completo (producto independiente):** primero una habitación; después viviendas con varias estancias conectadas. El código debe permitir evolucionar sin rehacerlo.
- **Room Builder Mini (idea para el Laboratorio de Pablo Web 2.0):** edición simplificada de una sola habitación, catálogo acotado y navegación contextual. Integración y fecha aún PENDIENTES. No modificar el repositorio del portfolio desde aquí.

## Referencias, no objetivos de clonación
- **Rooms.xyz:** principal referencia de tono, facilidad, espíritu juguetón, diorama, selección y personalización sencillas.
- **Room Studio:** referencia secundaria para medidas reales, aberturas, datos de planta, comparación de distribuciones y exportación.
- **Los Sims / modo construcción:** inspiración por facilidad de colocar y mover mobiliario; no se busca simulación de personas.
No copiar interfaz exacta, código ni arte de estas referencias.

## Diferenciador
La precisión debe existir **debajo** de una interacción comprensible; las medidas reales, vistas y comparación permiten tomar decisiones. No hace falta replicar la marca o modelo exacto de cada mueble: basta aproximar dimensiones y volumen, y ver cómo encaja.

## Principios de producto
- Primero crear **una habitación útil y agradable**; no construir una casa completa en el MVP inicial.
- Un resultado legible y atractivo incluso con geometría sencilla.
- Construcción directa: añadir, seleccionar, mover, girar, redimensionar, ocultar y deshacer.
- No hacer al usuario configurar un motor ni completar tutoriales obligatorios.
- Tres vistas esenciales: **Plano, Isométrica, Interior/POV desde la puerta**. Herramientas avanzadas disponibles solo cuando aporten valor.
- No engañar con precisión: el plan es orientativo, no plano constructivo certificado.
- Estado local y control del usuario. Sin servidor o cuentas en el MVP.
- Preparar la extensión futura a habitaciones conectadas sin implementarla prematuramente.

## No es
Un renderizador fotorrealista, software profesional CAD/BIM, un juego pixel art, un simulador de vida, una tienda de muebles ni una comunidad social en la primera versión.
