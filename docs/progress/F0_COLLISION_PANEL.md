# Panel de colisiones entre objetos de escena

**Rama:** `feature/34-auditar-refactorizar`. **Estado:** implementación y pruebas preparadas sin ejecución (CI exclusivamente en `main`).

## Comportamiento

- `src/domain/sceneCollisions.ts` obtiene parejas de intersección entre muebles, puertas y ventanas de la habitación raíz, puertas de packs y superficies independientes (cuando atraviesan muebles o aperturas).
- Reutiliza el detector SAT de cajas orientadas de `structureCollisions.ts`. Compara volumen real y descarta contactos tangenciales.
- Ignora superficies estructurales de apoyo (paredes de habitación, suelos y techos de packs) para evitar advertencias inevitables por montajes normales; ignora elementos/pack ocultos.
- Devuelve **cada pareja una vez**. `SceneCollisionPanel` agrupa por objeto y muestra los nombres en una caja desplazable dentro de la escena; desaparece si no hay pares.
- Los objetos afectados se bordean en rojo desde las vistas 3D y Plano (muebles, puertas y ventanas de pared raíz, puertas de packs y superficies independientes).
- Recalcula desde los cambios al estado local del editor: movimiento, giro, creación, eliminación, deshacer y carga. No modifica el formato JSON ni guarda estadísticas de colisión. Se omite en modo exportación.
- Coste O(n²) entre los objetos candidatos: comprobar con diseños grandes antes de prometer rendimiento constante. No se han medido FPS en esta rama.

## Alcance y límites

- Es una **señal visual**; por sí sola no elimina las restricciones de `validateOpenings`. En el estado actual, dos aperturas raíz no pueden guardarse superpuestas mediante las acciones normales. La nueva caja reflejará los cruces permitidos y los diseños que ya los contengan; permitir solapes entre huecos exige revisar también la generación geométrica de muros.
- Las aperturas rotadas se representan por su caja de dimensiones sin resolver exactamente la rotación 2D dentro del plano de la pared. Revisar este caso si se habilita rotación libre para aperturas.
- No se enumeran colisiones entre superficies estructurales entre sí: requieren reglas propias de medianeras, no avisos de objetos normales.
- Un objeto fuera de la habitación puede seguir mostrando su borde rojo anterior sin tener una colisión con **otro objeto**; por eso no aparecerá en la caja si no hay pareja.

## Revisión manual solicitada

1. Añadir dos muebles, hacer que se atraviesen por posición y comprobar que aparece «Objetos en colisión» con sus nombres y los dos bordes rojos. Separarlos y comprobar que desaparece la caja.
2. Solapar tres muebles: comprobar que aparecen las tres parejas, sin duplicados; que desplazar/borrar uno actualiza la lista en la misma sesión.
3. Poner un mueble atravesando una puerta, comprobar que el panel lo identifica. Moverlo de nuevo al interior y verificar el borrado del aviso.
4. Comprobar la vista Plano y las vistas Isométrica y Frontal, cambiar de habitación, ocultar/mostrar un objeto y verificar que la lista no conserva elementos ocultos.
5. Guardar, recargar y deshacer/rehacer; verificar que las advertencias se reconstruyen desde la geometría y no se guardan en los diseños.
6. Comprobar anchos de 1440, 1000, 850 y 430 px y que la caja no oculte la cabecera, la brújula o los controles. En un listado largo, la rueda debe desplazarse dentro de la caja sin cambiar el zoom.
7. Confirmar que no aparece la caja en una habitación vacía ni al tocar simplemente el suelo o paredes.

## Validación automática pendiente de main

`src/domain/sceneCollisions.test.ts` incluye pares de tres objetos, muebles tangentes o separados por altura, objetos ocultos, solapes de puerta/ventana, mueble/puerta y habitaciones en distintos niveles. **No se han ejecutado** `npm test`, `npm run build` ni E2E en la rama, por política del propietario. Cualquier fallo tras integrar en `main` debe registrarse y corregirse sin ocultar pruebas.
