# Room Builder — alcance del MVP local de una habitación

**Estado a 04/11/2026:** R5 fusionada en `main` por PR #21/#22. El código contiene muchas funciones del MVP, pero **la versión v0.2 no se ha validado como producto completo**. La lista ejecutable está en [LOCAL_MVP_BACKLOG.md](LOCAL_MVP_BACKLOG.md) e [issues #23–#33](https://github.com/Pablo-hg/Room-Builder/issues/23).

## Objetivo y definición de terminado
Un usuario no técnico puede recrear y reorganizar un dormitorio o salón **en una sola habitación rectangular**, con medidas orientativas, controles comprensibles y estética diorama agradable, guardarlo localmente y continuar editándolo en otro navegador tras exportar/importar JSON; sin cuenta ni servicio de pago.

**Para darlo por terminado deben pasar todas las gates G0–G9**, especialmente una ejecución E2E completa en verde después de los ajustes R5 y el flujo manual con usuarios. No basta con que exista el componente.

## Contrato funcional P0
1. Crear habitación rectangular vacía; editar ancho, profundidad, altura y elementos constructivos en unidades claras; controles en cm enteros donde corresponda y movimientos de 5 cm según RB-037.
2. Crear y ajustar puertas y ventanas (incluidas circulares); límites/huecos y restricciones estructurales sin solapes inválidos.
3. Catálogo útil: cama, escritorio o mesa, silla, armario, sofá/sillón, luz y decoración básica; iconos y modelos coherentes.
4. Seleccionar, arrastrar, girar, redimensionar elementos compatibles, duplicar, borrar, cambiar color, ocultar/bloquear y deshacer/rehacer; snap opcional.
5. Permitir intersecciones entre muebles con aviso visual rojo **sin impedir su edición** (RB-039/RB-041). Mantener validación de aberturas estructurales.
6. Vista **Plano**, **Isométrica** giratoria (dos paredes próximas ocultas) e **Interior/POV** desde puerta, sin modificar coordenadas del diseño. Frontal/Libre pueden seguir como vistas secundarias.
7. Guardar hasta cinco diseños localmente con aviso de no guardado; abrir, renombrar, duplicar y eliminar de forma segura. Exportación **GLB adicional**.
8. Importar/exportar **un diseño editable JSON** v1–v5 de manera segura, con previsualización, confirmación, límites, avisos y copia con ID nuevo ante duplicados. Un error nunca debe pisar un diseño.
9. Interfaz legible, sencilla, responsive, accesible por teclado y con alternativa táctil a los gestos esenciales; errores entendibles.
10. Suite unitaria, build de producción, E2E completa y aceptación manual reproducibles y aprobados.

## Implementado frente a verificado
| Área | Lo que hay en `main` | Qué queda para certificar |
| --- | --- | --- |
| Editor, cámaras y catálogo | Tres vistas esenciales y dos extra, mobiliario, estructura | Usabilidad/cámaras/gestos en casos reales; issues #26–#30 |
| Redimensionado y aperturas | R5.2 y medidas de ventana integradas; aceptación manual comunicada | Regresión completa, límites y consistencia de huecos; #24, #26 |
| Estado local / JSON | v1–v5, cinco guardados, importación/exportación JSON de diseño, GLB | Round-trip, casos adversarios y E2E global; #24, #25 |
| Selección/jerarquía | Carpetas, orden, selección múltiple y atajos disponibles | Comportamiento táctil, accesibilidad y pulido; #28, #31 |
| Calidad | Informe R5: 213 unitarias y build OK; E2E dirigidas OK | Repetir suite E2E completa tras correcciones, CI y release; #24, #32, #33 |

## Deliberadamente fuera
- **Variantes A/B**: se retiraron de la interfaz del MVP el 04/11 (RB-040), aunque se respeta compatibilidad de archivos históricos.
- Multihabitación, casas, paredes interiores, polígonos/plantas irregulares y caminar libremente.
- Workshop, cuentas, nube, publicación social, moderación, sincronización o importación de publicaciones.
- Generador de objetos con IA, render fotorealista, subida de planos, servicios externos y monetización.
- La modalidad Mini de Pablo Web 2.0 es el **siguiente producto derivado**, no un bloqueo del editor independiente.

## Prueba manual mínima de aceptación
Crear dormitorio de 4×3 m, colocar puerta, ventana, cama, escritorio, silla y armario, cambiar medidas y orientación, provocar intersección de muebles y ver aviso, probar historial y cuadrícula, guardar/recargar, visitar Plano/isométrica 4 diagonales/POV, exportar JSON, importarlo en navegador limpio y continuar editando. Probar teclado y táctil; sin datos personales ni navegador de producción al limpiar almacenamiento.

## Reglas
- No pasar a Workshop porque haya un prototipo de `ProjectV2`: R4 es contrato de dominio, **no casa funcionando**.
- No duplicar funciones ya presentes en R5; primero auditar, escribir prueba y corregir solo errores observados.
- `localStorage` y máximo cinco diseños siguen vigentes; cambiar a IndexedDB o cuotas requiere decisión propia.
- Asegurar funcionamiento **local-first** sin backend; «offline desde primera visita» requeriría una PWA/caché adicional y no se promete.
