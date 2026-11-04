# Room Builder — Informe maestro del Workshop y hoja de ruta

**Fecha:** 3 de noviembre de 2026  
**Estado:** especificación funcional consolidada; **no** equivale a código implementado  
**Repositorio:** `Pablo-hg/Room-Builder` (privado)  
**Prioridad acordada:** **primero el editor local estable y la integración reducida para Pablo Web 2.0; después el Workshop**  
**Finalidad:** conservar las decisiones de producto para generar nuevas etapas, tareas e issues cuando llegue el momento, sin dejar trabajo pendiente del Workshop en el tablero actual.

> **Regla principal:** Room Builder debe seguir funcionando sin cuenta ni conexión. El Workshop es una ampliación futura del producto independiente, no un requisito previo para usar la versión Mini en el portfolio.

---

## 1. Resumen ejecutivo

Room Builder será una herramienta de creación y distribución de espacios estilizados, inicialmente habitaciones, con evolución prevista a casas y proyectos que contengan varias estancias. El futuro Workshop permitirá a terceros **explorar, visualizar en 3D, editar de forma temporal, importar y descargar** proyectos publicados por sus autores. Los autores podrán publicar, gestionar versiones e inspeccionar estadísticas; habrá herramientas de moderación y una colección privada en la nube, separada de las publicaciones.

**El cambio de prioridades es explícito:** no implementar todavía comunidad, registro, base de datos, almacenamiento en nube, estadísticas ni administración. El objetivo inmediato es un **editor local sólido**, con guardado y formatos editables fiables, y una **versión Mini o demo integrada en la web 2.0**. El Workshop queda documentado, no programado.

La especificación recoge **22 decisiones de producto confirmadas** en conversación, distingue lo aprobado de las propuestas técnicas y reconoce las limitaciones del repositorio actual.

## 2. Productos y límites

| Área | Qué hace | Necesita Internet/cuenta | Prioridad |
|---|---|---|---|
| **Room Builder editor completo** | Crear, decorar, configurar vistas, organizar elementos, guardar, importar y exportar diseños | No | **Ahora** |
| **Room Builder Mini en Pablo Web 2.0** | Experiencia reducida y embebida en el portfolio, que reutiliza el mismo motor y permite una demo práctica | No para lo esencial | **Después de estabilizar el editor local** |
| **Workshop público** | Catálogo, visualizador 3D, importación/descarga, publicaciones, versiones y estadísticas | Sí para consultar/publicar catálogo | **Futuro** |
| **Colección privada en nube** | Guardar y recuperar proyectos en una cuenta, con sincronización manual | Sí y con cuenta | **Futuro** |
| **Administración comunitaria** | Denuncias, retirada, bloqueos y trazabilidad | Sí y con rol administrativo | **Antes de abrir el Workshop públicamente** |

La Mini **no** debe convertirse en otro motor de construcción ni modificar la habitación auténtica que funciona como HUB del portfolio. Reutilizará módulos del editor con el alcance reducido que se decida en su fase específica.

## 3. Estado actual verificado del repositorio (3/11/2026)

- Stack: **React 19, TypeScript, Vite, Three.js, React Three Fiber y Zustand**.
- `src/domain/designV1.ts`: `PersistedDesign` versiones 1–4; estado de habitación, mobiliario, packs, carpetas, asignaciones, orden del inspector, visibilidad y bloqueo. **Representa principalmente una habitación principal; no es un modelo de casas completo.**
- `src/persistence/localDesignRepository.ts`: guardado local en `localStorage`, **máximo cinco diseños** y migración de formato legacy.
- `src/state/actions/designActions.ts`: creación, guardado, carga, normalización y restauración de diseños actuales.
- `src/domain/elementFolders.ts` y `src/state/actions/folderActions.ts`: carpetas anidadas, agrupación, orden de escena y operaciones de visibilidad, entre otras funciones.
- Hay exportación **GLB**; **no** hay importación/exportación del archivo JSON editable abierta al usuario en el estado verificado.
- `docs/DATA_AND_FORMATS.md`, `docs/MVP_SCOPE.md`, `docs/PRODUCT_VISION.md` y `docs/DECISION_LOG.md` definen el objetivo inicial de una estancia y descartan servicios externos del MVP actual.
- **Todavía no están implementados** Workshop, autenticación, nube privada, estadísticas comunitarias, clasificación estructural completa de varias habitaciones ni extracción de habitaciones seleccionadas.

**Consecuencia:** evitar tareas que asuman un modelo multihabitación, una API o una sincronización ya disponibles. Preparar interfaces y migraciones cuando se programe esa evolución.

---

## 4. Registro de decisiones confirmadas (1–22)

| Nº | Decisión cerrada |
|---|---|
| **1** | Una publicación permite **visualizar, editar temporalmente, importar al perfil/colección y descargar**. Solo **creador o administrador** pueden eliminar la publicación. Registrar **visitas, importaciones y descargas**. |
| **2** | Se permite guardar **localmente sin cuenta** y en **nube con cuenta**. |
| **3** | «Editar» una creación ajena abre una **sesión temporal**; el visitante puede **guardar como un diseño nuevo**. Nunca modifica la publicación ajena. |
| **4** | La **sincronización local-nube es manual**. Ni iniciar sesión ni guardar localmente provoca una subida automática. |
| **5** | Los diseños subidos a la nube son **privados por defecto**. Publicar en el Workshop es una acción **separada y explícita**. |
| **6** | Se puede volver a publicar una creación derivada, con **atribución obligatoria** al original, enlace y relación con la versión inmediatamente anterior. |
| **7** | Los tres contadores son **públicos** y existe **panel de estadísticas del autor** con totales por publicación y globales. |
| **8** | Explorador con **buscador por título y autor, categorías, etiquetas, filtros y ordenación** por fechas y métricas. |
| **9** | Flujo **tarjeta (imagen + texto) → visualizador 3D interactivo → acciones Editar / Importar / Descargar en la cabecera**. Zoom, giro y cambio de vistas sin edición en visualización. |
| **10** | Se **publica siempre el proyecto completo**, tanto si contiene una habitación como varias. Se clasifica automáticamente como habitación o casa; quien lo consulta puede actuar sobre **todo el paquete o habitaciones seleccionadas**. |
| **11** | Al importar, se conserva **la estructura del inspector** (carpetas, grupos, subcarpetas, orden y propiedades), sin importar si las estancias estaban agrupadas. La selección física de habitaciones no se infiere a partir de carpetas. |
| **12** | Importar en **lienzo vacío** muestra el contenido según su visibilidad original y coordenadas. Importar en **lienzo ocupado** lo añade **inicialmente oculto**; al activarlo aparece en **posiciones originales**, aunque se superponga. No recolocar automáticamente. |
| **13** | Cada importación se introduce en **una carpeta contenedora propia con el nombre de la importación** que respeta dentro la jerarquía original. |
| **14** | Se publica **tal como está** el proyecto. Si hay elementos desagrupados, el programa **recomienda** agrupar, sin impedir publicar; ofrece además un botón de **agrupación automática**. |
| **15** | La agrupación automática afecta **solo a la copia que se publica**; no altera el proyecto del autor. |
| **16** | Agrupación automática **mixta**: por habitaciones reconocidas estructuralmente, conservando carpetas y grupos originales; elementos no identificables a **«Sin clasificar»**. |
| **17** | La extracción/importación de habitaciones seleccionadas incluye **todos los elementos estructurales necesarios** (paredes, suelos, puertas, referencias compartidas), evitando geometrías incompletas y duplicados incorrectos. |
| **18** | Descarga en **JSON editable, GLB 3D e imágenes PNG/WebP**, tanto para el proyecto entero como para una selección válida de habitaciones. |
| **19** | **Sin número fijo máximo de proyectos locales**, con **IndexedDB** sujeto a cuota real del navegador. **Cuota nube inicial de 100 MB por usuario**, configurable desde servidor; mostrar consumo. |
| **20** | **Historial público de versiones**: por defecto mostrar la más reciente, salvo que el autor elija otra principal. Visitantes pueden explorar y descargar revisiones anteriores. Autor puede consultar, restaurar y establecer cualquier revisión como principal. Las métricas se **agregan para toda la publicación, entre versiones**. |
| **21** | Inicio de sesión con **Google y GitHub**. Permitir vincular ambos a la misma cuenta con medidas de seguridad; correo no público. |
| **22** | **Moderación completa**: denuncias, panel de administración para revisar, ocultar, restaurar y eliminar publicaciones, y **bloqueo temporal o permanente** de usuarios. |

### Consistencia de estas decisiones

- **Proyecto ≠ publicación ≠ revisión ≠ copia importada ≠ colección privada**. Cada recurso tiene IDs, permisos y ciclo de vida independientes.
- **«Mostrar la última» y «seleccionar versión principal» no se contradicen**: un campo `featured_revision_id` opcional puede sobrescribir el comportamiento por defecto de «última disponible».
- **Se puede importar sin cuenta a la colección local**; para importar a la **colección privada de cuenta** sí es preciso autenticar y realizar la subida manualmente. Este detalle operativo queda sujeto a diseño UX, no autoriza automatismos.
- **Carpetas del inspector ≠ habitaciones físicas**: el sistema necesita entidades estructurales independientes.
- Una publicación retirada u oculta **no debe quedar expuesta** por acceso directo a una revisión, recurso cacheado, imagen o GLB.
- El autor puede borrar la publicación y perder su acceso público; las **copias importadas por terceros no desaparecen automáticamente**. Las obligaciones de atribución y privacidad después de la eliminación requieren política específica.

---

## 5. Experiencia prevista del Workshop (futura)

### 5.1 Exploración

1. El visitante entra en el **Explorador**, sin iniciar sesión.
2. Ve **tarjetas** con imagen, nombre, alias de autor, tipo (habitación/casa), etiquetas y estadísticas.
3. Filtra por categoría/etiqueta y ordena por **reciente, antiguo, visitas, importaciones o descargas**. La búsqueda por título/autor y paginación se hacen en el backend.
4. Al pulsar una tarjeta abre una **ficha/visualizador 3D interactivo de solo lectura**. Puede hacer zoom, orbitar y cambiar entre vistas admitidas.
5. En la cabecera dispone de **Editar**, **Importar**, **Descargar**; si hay varias habitaciones, puede elegir **proyecto completo o una selección de habitaciones** antes de ejecutar la acción.
6. Puede navegar por el **historial público de versiones**. La selección de revisión determina qué snapshot está viendo y sobre cuál actúan Editar/Importar/Descargar. El enlace compartible debería poder referenciar una revisión concreta.
7. Si no hay WebGL, conexión o versión compatible, la interfaz presenta miniatura, información y error comprensible; no daña el editor local.

### 5.2 Editar temporalmente

- Se crea una copia de trabajo aislada de la publicación, editable solo en la sesión local.
- El usuario puede probar cambios sin tener que guardarlos.
- El botón **Guardar como nueva habitación/proyecto** crea una copia propia local o, tras autenticarse y confirmar, privada en la nube.
- Al salir con cambios no guardados, se muestra advertencia. Nunca se actualiza la publicación ajena.

### 5.3 Descargar

- Opciones **JSON editable**, **GLB** e **imagen PNG/WebP**, para todo el proyecto o habitaciones seleccionadas.
- La descarga no implica añadir nada automáticamente a «Mis proyectos» ni autenticar al visitante.
- En imágenes pueden ofrecerse perspectivas de planta/isométrica/frontal según el motor y el viewport; definir tamaño/calidad más adelante.
- Los formatos exportados respetan la geometría, el estilo permitido y los derechos del contenido.

### 5.4 Importar

- Se presenta un resumen: proyecto fuente, revisión, autor, habitaciones seleccionadas, volumen/compatibilidad y destino.
- **Destino vacío**: reconstruye elementos y relaciones en sus posiciones XYZ originales, respetando visibilidad original.
- **Destino ocupado**: inserta una carpeta contenedora nueva, **inicialmente oculta**. Al activarla, muestra el contenido en **posiciones XYZ originales incluso si se superpone**.
- Se mantiene el orden, jerarquía, carpetas, bloqueo y estado visible/oculto de cada elemento; la visibilidad propia de la carpeta importada es independiente de la de sus hijos.
- Se reasignan los **IDs internos** para evitar colisiones, reescribiendo todas las referencias; no se sobrescribe ni desplaza ningún elemento preexistente.
- La operación es atómica: validar, previsualizar, confirmar, aplicar una sola transacción reversible por undo/redo. Cancelar o fallar no modifica el destino.
- Una importación parcial forma un proyecto **estructuralmente válido**, incluyendo dependencias comunes y sin copiar habitaciones excluidas innecesariamente.

**Detalle de diseño pendiente para implementar:** definir qué significa «lienzo vacío» cuando existe una habitación base por defecto y cómo tratar paredes/aberturas compartidas entre una selección y las habitaciones descartadas. No resolverlo con una comprobación superficial de `furniture.length`.

### 5.5 Publicar

1. El autor edita y guarda su proyecto por cualquier vía local/privada disponible.
2. Pulsa **Publicar** (requiere cuenta). El programa produce un **snapshot público independiente**; no expone borradores privados.
3. Comprueba la jerarquía del inspector. Si detecta objetos desagrupados, muestra aviso **no bloqueante** y ofrece **Publicar tal cual** o **Agrupar automáticamente**.
4. El agrupador **solo trabaja sobre una copia**. Conserva carpetas existentes, detecta habitaciones según estructura y envía objetos inciertos a **Sin clasificar**. Permitir previsualización y confirmación.
5. Se genera miniatura, título, descripción, categoría y etiquetas; el autor confirma derechos y permiso de reutilización/atribución. Se publica **el proyecto completo** y se detecta si es habitación o casa.
6. Más tarde puede publicar una nueva revisión; las anteriores siguen accesibles salvo ocultación/borrado justificado. El autor elige versión principal y consulta estadísticas.

### 5.6 Derivados

- Una copia derivada, al publicarse, crea **nueva publicación independiente** con dueño nuevo.
- Guarda relación con la **fuente inmediata** y el **origen** de la cadena, preservando atribuciones y enlaces cuando están disponibles.
- Las publicaciones originales no se modifican ni pueden borrarse desde la cuenta del derivador.
- Si se borra una fuente, la derivada permanece, pero hay que definir qué datos mínimos de atribución se conservan legalmente.

### 5.7 Estadísticas

- Contadores públicos: **visitas, importaciones y descargas** de cada publicación, **sumados entre todas las versiones**.
- Panel del autor: resumen global, listado de publicaciones y métricas por publicación, con posibilidad futura de desglose por revisión.
- Los incrementos deben ser **servidor-side**, con protección anti-repeticiones y antiabuso; acordar la definición de «visita», «importación exitosa» y «descarga completa/iniciada».
- Preferir métricas agregadas sin almacenar navegación nominal de usuarios; usar límites de retención y controles de privacidad.

### 5.8 Administración

- Denunciar una publicación con motivo; validación, rate limiting y revisión.
- Panel de administrador protegido por roles de servidor: **ocultar, restaurar, eliminar**, revisar historial de denuncias y **bloquear usuarios** temporal o permanentemente.
- Mantener trazabilidad de decisiones administrativas; prohibir que el frontend determine por sí solo si alguien es administrador.
- Publicación inmediata por defecto, sin moderación previa obligatoria; normas, recursos de apelación y manejo de derechos antes de abrirlo al público.

---

## 6. Arquitectura futura, no aprobada para desplegar

### 6.1 Esquema conceptual

```text
                 Room Builder (React / TypeScript / R3F)
                    |                  |
          Editor local           Workshop UI + Auth
          IndexedDB                   |
          JSON editable        API REST (Workers)
                                        |
                               +--------+--------+
                               |                 |
                         D1 (índices)     R2 privado (blobs)
                         usuarios         JSON/revisiones
                         metadatos        miniaturas
                         publicaciones    exportaciones solo si procede
                         versiones
                         denuncias
                         contadores
                         cuotas
```

**Cloudflare Workers + D1 + R2** es el candidato de bajo coste, no una decisión de contratación definitiva. Comprobar precios/cuotas vigentes, facturación de R2, limits per-DB, CPU, ancho de banda, backup y viabilidad real de OAuth en Workers antes de registrar servicios. **Supabase** sigue siendo alternativa si reduce complejidad de autenticación o administración. La elección debe depender de una prueba técnica, no de una comparación de marketing.

### 6.2 Entidades lógicas futuras

- `users`, `linked_accounts`/`sessions`, `profiles`: identidad, alias y credenciales OAuth administradas con una librería compatible.
- `projects` / `local_designs`: mundo editable, formato versionado; el cliente puede tener sus propios IDs.
- `private_cloud_designs`: recursos **solo del propietario**, cuota y metadatos independientes de publicaciones.
- `publications`: `id`, `owner_id`, `title`, `description`, `category`, `tags`, `status`, `created_at`, `updated_at`, `featured_revision_id` opcional, `latest_revision_id`, `room_count`, referencia de derivación.
- `publication_revisions`: identificador inmutable, versión de esquema, clave del JSON en almacenamiento de objetos, checksum, miniatura, fecha, tamaño, versión de catálogo.
- `publication_stats`: visitas/importaciones/descargas agregadas por **publicación**; opcionalmente eventos efímeros agregables con retención y control antiabuso.
- `reports`, `moderation_actions`, `user_suspensions`: gestión comunitaria con permisos restringidos.
- `usage_quotas`: bytes consumidos de cuenta, límite configurable, reservas de subida y prevención de carreras.

**No mezclar** `formatVersion` del fichero contenedor con la versión del mundo editable. Versionar modelos y aplicar migraciones compatibles. No permitir scripts arbitrarios, URLs remotas inseguras ni modelos ejecutables en JSON público. Mantener R2 privado y controlar acceso a través de la API.

### 6.3 Operaciones y seguridad

- Lecturas públicas paginadas por cursor e indexadas; no descargar JSON de todas las publicaciones para pintar las tarjetas.
- Publicación con comprobación de propietario, consentimiento y nueva **revisión inmutable**; reintentos idempotentes.
- Subida R2 y escritura D1 tienen fallos parciales: diseñar staging y limpieza compensatoria; evitar publicaciones incompletas u objetos huérfanos.
- Aislar dominio del proyecto de proveedor de almacenamiento con interfaces; servidor valida de nuevo todos los datos aunque el cliente ya los haya validado.
- Sesiones seguras OAuth Google + GitHub, vinculación con verificación, controles CSRF/CORS, límites de solicitudes, protección contra XSS y filtración de metadatos privados.
- Monitorizar consumo, cuotas, alarmas, recuperación desde copias de seguridad y capacidad de migrar sin perder datos. **Sin activar facturación, crear recursos reales ni desplegar producción sin autorización expresa.**

---

## 7. Hoja de ruta nueva: **primero local y web 2.0**

### ETAPA 0 — Consolidar el editor completo local (**prioridad inmediata**)

**Objetivo:** editor usable y estable como producto independiente, sin cuentas ni servidor.

- Revisar y estabilizar flujos reales: creación, selección, mover, rotar, redimensionar cuando sea aplicable, color, ocultación/bloqueo, carpetas, orden e historial undo/redo.
- Consolidar cámaras y visualización 3D (isométrica, planta, frontal, POV) sin afectar las coordenadas del mundo.
- Completar **exportación e importación JSON editable** versionada con validación estricta, previsualización y prueba de round-trip; conservar GLB existente.
- Mejorar robustez del almacenamiento local; **planificar migración a IndexedDB** para eliminar el tope de cinco diseños sin perder compatibilidad, sin mezclarlo con nube.
- Mantener guardado sin conexión; añadir backup/restauración local y mensajes para errores de cuota o ficheros inválidos.
- Verificar accesibilidad, responsive, rendimiento razonable, tests unitarios, `npm run build` y Playwright.

**Salida verificable:** un usuario puede completar, guardar, cerrar, recuperar, exportar, importar y seguir editando un diseño sin cuenta ni dependencia del Workshop. No se pierde la organización del inspector.

### ETAPA 1 — Integración Mini en **Pablo Web 2.0** (**segunda prioridad**)

**Objetivo:** incorporar una demo real del constructor al portfolio, sin forzar el futuro Workshop.

- Definir expresamente qué funciones incluye la Mini: **una estancia**, catálogo reducido y acciones esenciales; evitar editar el HUB real del portfolio por accidente.
- Reutilizar código/engine/dominio del editor; evaluar **módulo compartido** frente a **iframe aislado** según tamaño de bundle, límites de integración, rutas, sandbox y experiencia.
- Mantener la Mini como una experiencia autocontenida y de carga diferida: no cargar Three.js de golpe en el inicio del portfolio si no se utiliza.
- Guardar la demo en navegador de manera predecible, permitir restablecer escena y ofrecer un enlace al constructor completo; sin registro ni catálogo remoto.
- Compatibilidad con móvil/escritorio, teclado, foco y accesibilidad. Prueba visual real embebida en la web.

**Salida verificable:** un visitante del portfolio puede abrir la Mini, construir/interactuar con la habitación y cerrarla sin errores ni lentitud significativa del HUB. El constructor completo sigue siendo independiente.

### ETAPA 2 — Evolución **local** a casas y extracción de estancias (cuando se decida)

**Objetivo:** modelo estructural válido de varias habitaciones y reutilización interna.

- Modelar proyecto, habitaciones físicas, suelos/plantas, paredes compartidas, aperturas y relaciones de dependencia.
- Conservar compatibilidad con documentos locales actuales y estado del inspector.
- Implementar selección/extracción de estancias, contenedores importados, visibilidad jerárquica separada e importación en lienzo ocupado sin mover coordenadas.
- Validar colisiones, IDs, referencias, paredes compartidas y undo/redo con fixtures de casas.

**Salida verificable:** se pueden construir, guardar, exportar e importar proyectos con varias habitaciones localmente; aún **sin Workshop**.

### ETAPA 3 — Validación técnica del backend (futuro)

**Objetivo:** demostrar que un servicio remoto cabe en presupuesto y funciona con autenticación segura.

- Prueba aislada Workers + D1 + R2 vs Supabase, con costes y límites actualizados.
- OAuth **Google y GitHub**, cuentas vinculadas y permisos; no desplegar en abierto.
- Crear esquemas, migraciones, pruebas de seguridad y backups.

### ETAPA 4 — Colección privada en nube y sincronización manual (futuro)

- Subir/descargar diseños **explícitamente**; mantener nube privada por defecto.
- Cuota inicial de **100 MB/usuario** configurable y visible; rechazo controlado al agotarse.
- Resolución de conflictos con confirmación, nunca reemplazo automático.

### ETAPA 5 — Publicación y Workshop público (futuro)

- Publicar snapshots completos con opción agrupación automática **solo en la copia pública**.
- Revisión/historial público, versión principal, derivados y atribución.
- Explorador completo + visualizador 3D; importación, edición temporal y descargas JSON/GLB/imágenes, total o parcialmente.
- Estadísticas públicas y panel del autor.

### ETAPA 6 — Moderación y lanzamiento abierto (futuro)

- Denuncias, panel administrador, ocultación/restauración/borrado y bloqueos.
- Privacidad, licencias, aceptación de condiciones, seguridad, antiabuso, alertas de consumo, backups y plan de reversión.
- No abrir a público hasta pasar E2E (dos usuarios, anónimo, moderador, errores de red y recursos corruptos), revisión de costes y autorización humana.

**Importante:** las etapas no son nuevas issues. Son un índice de trabajo futuro para **crear issues pequeñas y autónomas** cuando corresponda. Evitar una tarea monolítica que mezcle reforma del editor, cloud y comunidad.

---

## 8. Propuesta de descomposición futura en issues (NO crear ahora)

Cuando se reactive cada etapa, convertirla en tareas según el estado del código de ese momento:

1. **Local** — codec JSON versionado y parser seguro, fixtures legacy y pruebas round-trip.
2. **Local** — IndexedDB + migración no destructiva de `localStorage`, sin límite fijo.
3. **Local** — estabilización de editor/cámaras/inspector, E2E y rendimiento de la Mini.
4. **Portfolio** — extraer una versión Mini y conectarla al Laboratorio de la web 2.0 sin duplicar motor.
5. **Local multihabitación** — contrato Project/Room/Wall y migraciones.
6. **Local multihabitación** — extracción por habitaciones + merge y carpeta importada oculta sin alterar visibilidad interna.
7. **Cloud** — spike de proveedor, Workers/D1/R2 o alternativa, autenticación Google/GitHub.
8. **Cloud privada** — subida/descarga manual, perfiles, cuotas, conflictos y permisos.
9. **Workshop** — publicar proyectos y agrupación solo de snapshot, historial público y atribución.
10. **Workshop** — explorador, vista interactiva, filtros, descarga total/parcial, edición temporal y estadísticas.
11. **Workshop** — panel del autor, denuncias y moderación.
12. **Operaciones** — copias de seguridad, costes, seguridad, RGPD, documentación, pruebas y despliegue controlado.

**Plantilla para futuras issues:** contexto/requisitos confirmados; estado real y archivos implicados; dependencias; alcance/no alcance; cambios previstos; criterios de aceptación observables; pruebas automatizadas y visuales; compatibilidad y migraciones; seguridad/privacidad/costes; condiciones para cerrar. Cada PR debe declarar qué se probó realmente; no auto-merge ni publicar sin aprobación.

## 9. Aspectos abiertos que NO deben inventarse al programar

Se conservan como decisiones futuras, pero **no bloquean las etapas locales**:

- Texto legal exacto sobre reutilización, atribución, licencias, retirada y privacidad (incluido el caso de autor que elimina su cuenta).
- Unidad exacta de cuota cloud (100 MB decimales vs MiB), tamaño máximo de cada fichero, revisiones conservadas y reglas de limpieza.
- Qué cuenta como «visita», cuándo se incrementa «importación» y cuándo se considera «descarga» completada, con protección antiabuso.
- Quién puede administrar inicialmente, gestión de identidades de administradores y proceso de apelación de bloqueos.
- Forma definitiva de etiquetar categorías, número máximo de etiquetas y tipologías multihabitación/plantas.
- Formato de enlace a revisiones históricas; miniaturas generadas en cliente o servidor; resolución de ausencia de WebGL.
- Rendimiento objetivo de editor completo y Mini, navegadores soportados y estrategia de PWA/offline completo.
- Política de conflictos entre objetos estructurales al fusionar casas con paredes compartidas o estructuras ambiguas; definir mediante fixtures y aceptación.
- Selección exacta de proveedor cloud, precios/cuotas actualizados, dominio y autorización de facturación antes de contratar.

## 10. Condiciones de aceptación globales (futuras)

**Para considerar completado el objetivo inmediato (local + Mini):**

- [ ] Editor completo funciona sin cuenta y sin conexión a backend.
- [ ] Crear, guardar, recuperar, exportar e importar un diseño editable sin pérdida de datos relevantes.
- [ ] Vistas/inspector/carpeta/orden/visibilidad/candados/undo-redo coherentes tras recarga y exportación/importación.
- [ ] Pruebas automatizadas y de uso real del editor; no errores graves visuales ni de interacción.
- [ ] Mini integrada en la web 2.0 reutilizando la base técnica, aislada del HUB y sin empeorar notablemente la carga inicial.

**Para considerar completado el Workshop (más adelante):**

- [ ] Invitado explora, ve el proyecto y sus revisiones, edita en sesión temporal, importa y descarga total o parcialmente sin alterar publicación ajena.
- [ ] Autor guarda privado en nube, publica de forma explícita, puede elegir agrupación solo del snapshot, gestionar versiones y ver estadísticas.
- [ ] Importar en lienzo vacío/ocupado conserva posiciones, jerarquía, visibilidad propia, selección estructural y referencias; sin sustituciones silenciosas.
- [ ] Derived projects mantienen atribución; métricas agregan correctamente entre revisiones.
- [ ] Google y GitHub funcionan, incluso vinculación de cuentas, y un usuario no puede acceder a recursos privados de otro.
- [ ] Administración, denuncias, bloqueos, limpieza, backup/restore y protección de costes probados antes de apertura pública.

---

## 11. Qué hacer ahora

**No iniciar el Workshop.** Volver al editor local, medir su estado real y cerrar las funcionalidades necesarias para una Mini de calidad en Pablo Web 2.0. Este informe queda como fuente de producto para el Workshop futuro; al reactivarlo, revalidar estado del repositorio, precios y seguridad antes de redactar tareas nuevas.

**Historial de planificación:** el 03/11/2026 se habían creado las issues **#9–#18** del Workshop como borrador de ejecución. La solicitud posterior fue retirarlas del backlog y conservar su contenido en este informe. Si las issues no pueden borrarse mediante la integración, cerrarlas como **«no previstas»**, documentar que se reemplazan por este informe y no confundir su cierre con desarrollo terminado.
