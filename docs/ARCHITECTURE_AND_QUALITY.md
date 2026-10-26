# Arquitectura y calidad técnica

**Estado:** diagnóstico del código actual CONFIRMADO por lectura; organización objetivo PROPUESTA.

## Stack actual (package.json, 26/10/2026)
React 19, TypeScript, Vite 6, Three.js, React Three Fiber, Zustand, pruebas de Node/tsx y Playwright. Mantener salvo necesidad real medida; no hay que introducir otro motor de juego.

## Problema técnico real
La lógica principal está concentrada en src/App.tsx (~74 KB), src/components/RoomScene.tsx (~141 KB) y src/state/useRoomStore.ts (~62 KB). El tamaño no demuestra errores por sí solo, pero dificulta comprensión, pruebas y cambios seguros.

## Límites de responsabilidad objetivo
- **domain/**: modelos, objetos, restricciones y geometría puros, sin React o Three donde sea viable.
- **scene/**: renderizado 3D, cámaras, meshes, selección espacial y exportación.
- **features/**: creación de habitaciones, aberturas, catálogo, editor, variantes, guardado.
- **state/**: stores divididos por necesidad y persistencia, sin duplicar fuentes de verdad.
- **ui/**: controles, paneles y componentes comunes.
- **assets/**: iconos, modelos y recursos con origen trazable.
- **tests/**: unitarias de geometría/estado y Playwright de flujos.
No forzar exactamente estos directorios antes de una auditoría; la [reorganización](REFACTOR_PLAN.md) define los pasos.

## Principios
- Datos del diseño serializables y ajenos a cámaras/render; geometría común para plano/isométrica/POV.
- Separar instancias de muebles de sus definiciones; controlar acoplamientos entre catálogo y render.
- Un único responsable de las acciones mutables, undo/redo y validación por dominio; no duplicar estados.
- Escena y paneles no deben depender de archivos gigantes.
- Evitar generar modelos 3D nuevos que requieran reescribir interfaces de persistencia; cambios compatibles.
- Carga diferida del editor en la futura modalidad Mini; no aumentar el peso inicial del HUB.
- Transiciones de cámara discretas si se solicita movimiento reducido; establecer degradación razonable si WebGL no está disponible.
- No optimizar a ciegas: medir antes; geometría sencilla, iluminación limitada, reutilización de materiales y recursos.

## Pruebas/gates
- Geometría de aberturas, colisiones, límites de tamaño, rotación, validaciones numéricas.
- Cuatro orientaciones isométricas y paredes ocultas; cambio de vistas conserva posiciones.
- Operaciones sobre elementos: añadir, seleccionar, mover, redimensionar, eliminar, ocultar, duplicar, copiar/pegar, undo/redo.
- Persistencia/migración y pérdida de estado entre variantes; importación malformada.
- E2E de flujo de usuario real, responsive y accesibilidad básica.
- Ejecutar npm test, npm run test:e2e y npm run build cuando correspondan. Si no pueden ejecutarse, reportar el bloqueo de forma explícita.
- En un refactor de estructura, no cambiar comportamientos ni el aspecto visual sin consentimiento y pruebas comparativas.

## Seguridad y privacidad
- Archivos JSON importados y cadenas de usuario son no fiables; validar tamaño, tipos y límites; no eval, ni código activo derivado de datos.
- Logs de interacción: en el proyecto actual son diagnósticos locales de desarrollo; documentar y evitar habilitarlos accidentalmente en producción.
- Las futuras fotos/planos importados requieren aclarar conservación y privacidad; no forman parte del MVP.

## Entregas
Para cada PR: qué cambió, qué no, pruebas ejecutadas, capturas si hay cambios visuales, compatibilidad de formatos, archivos afectos, riesgos y pendientes. No hacer merges automáticos.
