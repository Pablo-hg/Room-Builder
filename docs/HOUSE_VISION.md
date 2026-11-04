# Visión objetivo — Room Builder como constructor de viviendas completas

**Registrada:** 04/11/2026 · **Estado:** objetivo de producto acordado; NO implementado ni parte del alcance ya congelado de v0.2. Referencia visual proporcionada por el propietario: planta residencial con habitaciones, baños, pasillo, cocina, salón, balcones, espesores de muro, cotas y superficies. Referencia técnica funcional: [floorplan-3d](https://github.com/wy51ai/floorplan-3d) (no reutilizar arquitectura o gráficos a ciegas).

## Resultado final buscado
El usuario **comienza creando una habitación**, como hoy, y puede ampliarla de forma gradual hasta construir una **vivienda con múltiples habitaciones y varias plantas**, editando tanto cada estancia como su conjunto. Mantener una única fuente de verdad: la vista aérea 2D, la isométrica 3D y el recorrido POV reflejan la misma geometría, mobiliario, huecos y conexiones.

Una casa de ejemplo debería poder representar salón, cocina, dormitorios, baños, pasillos y espacios exteriores (p. ej., balcones) como áreas reconocibles y contiguas, pero **no se exige copiar la distribución ni estética** de la imagen de referencia.

## Flujo del usuario
1. **Crear proyecto**: comenzar con una única habitación por defecto; sin obligar a escoger inicialmente “casa” ni número de plantas.
2. **Ampliar**: añadir habitaciones a una misma planta, conectarlas con paredes/aberturas compartidas, modificar tamaños, contornos y posición sin duplicar paredes físicas.
3. **Editar una estancia**: seleccionarla desde el plano global para trabajar sus muebles, acabados, puertas y ventanas; volver a la planta completa sin abandonar el proyecto.
4. **Seleccionar planta**: mostrar una sola planta activa y permitir cambiar entre pisos. Opcionalmente, vista global de casa/volumen 3D; el cambio no modifica datos.
5. **Vista en planta general**: todas las estancias de ese nivel visibles, con **nombres, superficie orientativa y cotas arquitectónicas** (perímetro, segmentos, espesores o dimensiones de paso según controles); elegir qué capas mostrar. Los valores se derivan del mismo modelo que usa la escena.
6. **Vista 3D**: alternar entre planta e isométrica sin inconsistencias, ocultando o recortando paredes/plantas según la cámara y dejando clara la planta seleccionada.
7. **Recorrido interior**: POV con WASD y control de mirada, spawn desde puerta de entrada seleccionada si existe más de una, y continuidad entre habitaciones al cruzar puertas comunicantes (ver [#36](https://github.com/Pablo-hg/Room-Builder/issues/36)).
8. **Persistencia local**: guardar/exportar/importar el **proyecto completo**, incluyendo plantas, estancias, paredes, huecos, acabados y muebles sin pérdida; el archivo de un solo diseño v1–v5 debe seguir importándose mediante migración segura.

## Arquitectura mínima necesaria
- Jerarquía propuesta: `Project → Floors → Rooms / Walls → Openings → Furniture`. No añadir entidades duplicadas para la misma pared compartida.
- IDs persistentes de habitaciones, plantas, paredes, conexiones y aberturas. La estructura de conexiones y el contorno son datos, no la proyección de cámara.
- El prototipo `ProjectV2` de R4 permite razonar sobre entidades, pero **todavía no representa ni guarda públicamente el alcance final**. Revisar contratos, migradores y renderizadores antes de activar varias plantas.
- El editor de vértices/paredes [#35](https://github.com/Pablo-hg/Room-Builder/issues/35) es un componente de evolución geométrica. Las cotas del plano empezarán con la ampliación de [#26](https://github.com/Pablo-hg/Room-Builder/issues/26).
- Necesarias reglas consistentes para alturas/niveles, suelos, techos, huecos, paredes medianeras y entradas; cómo conectar plantas (escaleras, desniveles) requiere diseño adicional, **no está aprobado** como primera implementación.
- Usabilidad: alternar entre editar una habitación y la planta completa sin cambiar de motor ni romper jerarquía, selección, historial o controles táctiles.

## Secuencia recomendada y definición de MVP
**A. MVP inicial v0.2, una sola habitación (vigente):** cerrar [#23–#34](https://github.com/Pablo-hg/Room-Builder/issues/23) con validación de editor y sin Workshop. **No se modifica retroactivamente**.

**B. Evolución local a proyecto habitable (meta funcional completa):**
- **B1**: proyecto/planta y **dos habitaciones** contiguas, medianera única y paso entre ambas; vista global 2D con selección de estancia.
- **B2**: varias habitaciones en una misma planta; habitaciones con nombre/superficie, paredes compartidas, contornos editables, distancias y cotas.
- **B3**: varias plantas y selector de planta; cada nivel conserva sus habitaciones y se representa correctamente en 3D.
- **B4**: recorrido POV WASD, puertas enlazadas, vistas de planta/casa coherentes y round-trip completo; pulido UX y pruebas con viviendas de ejemplo.

**C. Workshop, colaboración, cuentas, nube, IA y monetización:** posteriores e independientes. No se necesitan para que el constructor de viviendas funcione localmente.

El propietario ha descrito la vivienda de referencia como **«objetivo final del MVP»**. Para no confundirlo con la milestone ya abierta `MVP local v0.2`, la denominamos aquí **meta de producto / MVP completo de vivienda**, por fases. Decidir la versión/release exacta cuando se planifique B1.

## Criterios de aceptación de la meta de vivienda
- [ ] Desde un proyecto vacío se crea habitación y se amplía a una planta con varias estancias conectadas por aberturas y paredes reales, sin solapes estructurales silenciosos.
- [ ] Plano general legible y acotado, cada estancia seleccionable, con nombre y superficie que corresponden a la geometría.
- [ ] Añadir otra planta, cambiar nivel desde selector y conservar habitaciones/objetos por planta.
- [ ] Plano, 3D y POV recorren una sola escena consistente; la cámara cruza puertas entre estancias válidas.
- [ ] Guardar/recargar/exportar/importar proyecto local completo sin perder referencias; datos v1–v5 importables.
- [ ] Interfaz usable por ratón y teclado, alternativas táctiles y pruebas de geometría, migraciones, rendimiento y E2E del proyecto completo.
