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

## Ampliación solicitada tras la primera revisión manual (08/11/2026)

Se incorpora lo siguiente en la rama #34, todavía **sin pruebas automatizadas ejecutadas**:

- El panel usa el texto **«colisiona con»** y permite seleccionar por clic o teclado todos los nombres mostrados (no solo el primero de cada grupo).
- Aparte de pares de colisión, el panel muestra **«[nombre] está fuera de una habitación»** cuando un mueble o una superficie independiente sobresale de todas las habitaciones. Se utilizan los mismos límites del detector espacial existente, sin contar el apoyo normal sobre el suelo como intersección.
- Se incluyen parejas de superficies independientes entre sí, además de sus colisiones con muebles y aperturas. Los contornos rojos de estos elementos ya estaban conectados con el detector de escena.
- Los suelos y paredes independientes mantienen su `StructurePack` interno **solo para conservar la estructura y los proyectos existentes**, pero el árbol ya muestra únicamente su superficie, sin una segunda fila «Pack de construcción». Al borrar la única superficie, se retira el contenedor vacío.
- Se puede iniciar un arrastre desde la geometría del suelo o la pared independiente, no únicamente desde las flechas del gizmo. Se utilizan las acciones del store y un gesto de historial, por lo que siguen actuando los bloqueos de los ejes.
- **Mayús + arrastrar** en muebles y superficies independientes combina movimiento vertical en Y y el eje horizontal X o Z con mayor sentido según la orientación de cámara, congelando el otro. **Mayús + clic sin arrastrar** conserva la multiselección. En las aperturas se conservan las restricciones propias de paredes y alturas.

### Segunda lista de comprobación manual

1. Poner una silla fuera de la habitación sin colisionar con nada; comprobar que aparece el aviso y que desaparece al devolverla dentro. Repetir con un suelo y una pared independiente; ocultar y volver a mostrar.
2. Superponer un suelo y una pared independientes, y luego un mueble; comprobar parejas, contornos rojos y desaparición de avisos al separar los elementos. No deben aparecer pares duplicados.
3. Pulsar cada nombre destacado (tanto el primero como el segundo) desde el panel y comprobar que el objeto correspondiente se selecciona en el árbol e inspector.
4. Crear un suelo o pared independiente y comprobar que en el árbol aparece una sola entrada seleccionable; eliminarla, deshacer y recargar. No debe quedar un pack vacío o invisible.
5. Arrastrar el suelo y la pared directamente con el ratón/táctil por el escenario, sin tocar los gizmos, comprobando que el movimiento se guarda y que deshacer/rehacer funciona.
6. Mantener Mayús mientras se arrastra una silla y una superficie independiente en Isométrica y Frontal: deben poder subir/bajar y desplazarse solo por el eje horizontal elegido. Comprobar que bloquear Y impide cambiar su altura, y que Mayús + clic sigue multiseleccionando.
7. Revisar el panel y los arrastres con ventanas estrechas y móvil: el panel no debe tapar brújula/controles y debe permitir scroll sin zoom involuntario.

**Pruebas preparadas, no ejecutadas:** nuevas comprobaciones en `sceneCollisions.test.ts`, `independentSurfaces.test.ts` y `cameraAwareShiftDrag.test.ts`. La certificación de estos commits se hará exclusivamente con el CI de `main`. No dar por aprobado el build de la rama sin ejecutarlo en ese momento.
