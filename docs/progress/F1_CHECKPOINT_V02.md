# F1 · 09/09 — Validación E2E y checkpoint v0.2 (#33)

Rama `feature/f1-09-validacion-ckeckpoint`, partida de `dev` (`c29c855`, PR #82 integrada). Informe del 15/11/2026.

> **Estado: NO certificado.** Las pruebas automáticas locales están en verde (unitarias 567/567, E2E completa 249/249), pero el checkpoint no puede registrarse como base estable todavía: faltan las dependencias abiertas (#30, #31, #32), la validación en Linux con `e2e-full.yml` y la prueba humana. Este documento recoge lo verificado, lo que no, y lo que decide el propietario. v0.2 es un checkpoint de una sola habitación: no es el MVP completo, no autoriza publicar y no sustituye al gate #54.

## 1. Gates del checkpoint

| Gate | Estado | Evidencia |
| --- | --- | --- |
| Dependencias #24–#32 y #34 | **Pendiente** | #24–#29 y #34 cerradas. #30, #31 y #32 siguen abiertas: su código está en `dev` (PR #78, #79, #82), pero faltan la validación del propietario y, en #32, las mediciones en equipos modestos reales y el favicon. |
| Unitarias | **Cumple en local** | 567/567 el 15/11/2026, tras los cambios de esta rama. `npm ci` no se ha repetido en esta rama. |
| Build | **Cumple en local** | `npm run build` correcta (tipos, Vite, comprobación de diagnósticos y avisos de licencias). Persiste el aviso de chunk superior a 500 kB. |
| E2E de habitación completa | **Escrito y verde** | `tests/checkpoint-v02.spec.ts`, 3/3 ejecuciones. Es nuevo: no existía un recorrido único. |
| Suite E2E completa en verde | **Cumple en local** | 249/249 con el código final (sección 3). Falta repetirla en Linux con `e2e-full.yml`. |
| Sin pérdidas de datos ni P0 conocidos | **Sin P0 conocidos en pruebas automáticas** | Sin pérdidas observadas en los tests de guardado, recarga e importación. Pendiente la prueba humana y la validación en Linux. |
| Prueba humana (escritorio, móvil, táctil, teclado) | **Pendiente** | Ver sección 5. No la ha hecho nadie todavía. |
| Registro como base estable | **Pendiente** | Depende de lo anterior y de una decisión (sección 6). |

## 2. Cambios de esta rama

- **Defecto real corregido: la etiqueta de nombre de habitación tapaba el mobiliario en Plano.** `RoomNameLabel` se colocaba en el centro de la habitación y capturaba el dedo o el ratón sobre el mueble central y sus gizmos. Eso rompía los dos E2E táctiles del eje X de `furniture-gestures`. Se confirmó la causa (con la etiqueta sin interacción pasaban las 8 pruebas) y se corrigió en `src/scene/RoomNameLabel.tsx`: en Plano se ancla centrada en el borde superior de la huella de la habitación. Una primera versión, en la esquina, pisaba el chip «Vista superior de la habitación»; se detectó en las capturas y se cambió. Prueba de regresión nueva en `tests/room-name-labels.spec.ts` (falla sin el arreglo).
- **E2E de recorrido completo** `tests/checkpoint-v02.spec.ts` (sin `@smoke`: ~1,2 min y más de 10 gestos). Cubre: navegador limpio, medidas propias (4,2 × 3,6 m), ventana redimensionada, puerta, cama, escritorio, silla, armario y planta; solape silla/escritorio con aviso no bloqueante; renombrar, duplicar, deshacer/rehacer, bloquear y carpeta; Plano, cuatro diagonales y POV sin alterar los datos; guardar, recargar, exportar JSON y GLB; reimportación en un contexto de almacenamiento nuevo y continuación de la edición.
- **Unitaria estabilizada** `renameElement.test.ts` («recupera nombres de aperturas desde un diseño guardado v2»): fallaba el 25–30 % de las veces. La colocación aleatoria de ventanas (#32) puede dejar una ventana a ~2,6 m del centro con 1,5 m de ancho, válida con anclajes v10 pero fuera del margen de 0,25 m de la validación sin anclajes que simula la prueba. Se fija el desplazamiento en el dato v2 de la prueba. **Observación para el propietario:** la app permite ya hoy ventanas con anclaje más cerca del borde que la validación antigua; solo afectaría si se retiran los anclajes.
- **Prueba actualizada** `window-visible-placement.spec.ts`: esperaba `Y = 1` exacto, obsoleto desde la colocación aleatoria en altura (petición del propietario en #32). Ahora comprueba el rango válido de la planta. 8/8 en dos repeticiones.

## 3. Resultado de la suite E2E completa

**Resultado final: 249/249 pasan** (local, Windows, Chromium, 2 workers, desde PowerShell con `C:\` en mayúscula según `AGENTS.md`; 20,0 min), con el código de esta rama. No se ha lanzado el workflow `e2e-full.yml` en GitHub: requiere subir la rama, pendiente de autorización.

Historial, para que el resultado sea auditable:

1. Una primera ejecución desde Bash (`c:/`) dio 223/249. **No se usa**: la doble instancia del store que advierte `AGENTS.md` falseó los tests que importan el store.
2. Desde PowerShell: 243/249, con 6 fallos:

| Test | Causa | Resolución |
| --- | --- | --- |
| `window-visible-placement` ×4 | Esperaba `Y = 1` exacto; la colocación de ventanas es aleatoria en altura desde #32. | La prueba comprueba ahora el rango válido de la planta. |
| `selection.spec.ts:231` «Alt+clic recorre dos muebles superpuestos» (`@smoke`) | **Fallo del test, no de la app.** El rayo del propio test contaba el suelo base (`room-floor`); el ciclo real de Alt+clic no lo recorre. Se comprobó sin ningún filtro en la app: sillón → silla → sillón funciona. (Una hipótesis previa, que el suelo entraba en el ciclo de la app, era errónea y se descartó.) | El test ignora el suelo base al contar. |
| `free-wall-objects.spec.ts:35` «una ventana creada en un pack pasa a Raíz…» | Intermitente (4/16). Mover Z y X a 0 son uno o dos pasos de historial según la posición aleatoria de partida; el test asumía un solo «Deshacer». | Deshace y rehace hasta recuperar cada estado. 20/20 en repetición. |

3. Tras esos cambios: **249/249**.

**Contexto de la CI:** la PR #82 había fallado en 3 tests de humo (`camera-views` ×2 por tiempo de espera de 30 s, y Alt+clic) y se integró en `dev` igualmente. Alt+clic queda explicado. Los dos de `camera-views` pasan en local y siguen siendo candidatos a intermitentes por carga del runner; **no se han reproducido**.

## 4. Avisos y obstáculos observados

Observados en las capturas de `docs/progress/f1-checkpoint-v02/` (Chromium automatizado, GTX 1060). **No sustituyen a una prueba humana.**

- Escritorio, Plano, habitación 5,5 × 4,5 m con cama, escritorio, silla, armario y planta: la etiqueta «Raíz» queda bajo la ventana, sin pisar chips ni mobiliario.
- Móvil (390 × 844), Plano: la escena queda en ~150 px de alto entre los chips superiores y los controles inferiores. Es un obstáculo de uso real y no se ha tratado.
- Móvil, Plano, con la habitación vacía: la etiqueta «Raíz» queda sobre el mensaje «La habitación está lista».
- La captura móvil isométrica no se ha revisado a mano.
- El aviso de bundle superior a 500 kB sigue sin resolverse, pendiente en #32.

Capturas: `escritorio-isometrica.png`, `escritorio-plano.png`, `escritorio-pov.png`, `movil-isometrica.png`, `movil-plano.png`.

## 5. Checklist de prueba humana (pendiente)

Hacer en un navegador limpio (ventana privada o perfil nuevo) con la build de `dev` o de esta rama. Anotar obstáculos reales, no solo fallos. Idealmente, repetir con una persona que no conozca la herramienta.

**Escritorio**
- [ ] Crear una habitación de 4 × 3,5 m (Anchura y Profundidad).
- [ ] Añadir puerta, ventana, cama, escritorio, silla, armario y una planta. Cambiar el ancho de la ventana.
- [ ] Poner la silla encima del escritorio: debe aparecer en rojo y en «Incidencias en la escena», sin bloquear.
- [ ] Renombrar, duplicar, bloquear, crear una carpeta, deshacer y rehacer.
- [ ] Plano, las cuatro diagonales isométricas y POV: nada se mueve y «Guardado» no vuelve a «Guardar».
- [ ] En Plano, con un mueble en el centro: la etiqueta «Raíz» no estorba para seleccionarlo ni arrastrarlo.
- [ ] Guardar, recargar la página, exportar JSON, descargar el 3D.
- [ ] En otra ventana privada, importar el JSON, seguir editando y guardar.

**Móvil y táctil**
- [ ] Repetir lo esencial en un móvil o con el emulador del navegador (390 px).
- [ ] Arrastrar un mueble por su cuerpo y por la flecha del eje X con el dedo.
- [ ] Mantener pulsada una fila de la lista: debe abrir sus acciones.
- [ ] Anotar si en Plano la escena queda demasiado pequeña.

**Teclado**
- [ ] Recorrer el editor con Tab. Probar Supr, Ctrl+Z, Ctrl+Y, Ctrl+C/V, Ctrl+D y F2.
- [ ] Comprobar que el foco siempre es visible.

## 6. Decisiones pendientes del propietario

1. **Forma de registrar v0.2:** etiqueta (`tag`) de git sobre `dev`, release o solo este documento. Recomendado: tag sobre `dev`. Integrar en `main` **publica automáticamente** en https://room-builder.phghorcajada.workers.dev/ y pasaría los diseños del formato v10 al v12 (ver `F1_PROGRESS.md`).
2. **Subir la rama** para ejecutar `e2e-full.yml` en GitHub y obtener la validación en Linux, como exige el gate. Nada de esta rama está commiteado ni subido.
3. **Licencia del proyecto (#80):** no bloquea #33, pero conviene decidirla antes de abrir la web a otras personas.
4. **Escena pequeña en móvil (Plano):** en 390 × 844 queda en ~150 px de alto. Es una decisión de diseño de interfaz que no se ha tocado.

## 7. Qué falta para cerrar #33

1. Cerrar #30, #31 y #32 tras la validación del propietario.
2. Repetir la suite completa en Linux con `e2e-full.yml` (la local ya está en 249/249).
3. Completar la prueba humana y anotar los obstáculos.
4. Decidir cómo se registra v0.2.
5. Actualizar este documento y la decisión RB-054 a «CONFIRMADO».
