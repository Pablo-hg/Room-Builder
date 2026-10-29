# Carpetas anidadas

Estado: CONFIRMADO por la petición de crear carpetas dentro de carpetas.

Propuesta técnica: los diseños con carpetas anidadas usan versión 3 y un identificador opcional de carpeta padre. Los diseños v1 y v2 se cargan con sus carpetas existentes en el nivel principal. La carga valida referencias y evita ciclos; al eliminar una carpeta sus elementos y subcarpetas pasan a su carpeta padre, o al nivel principal. Ocultar y bloquear una carpeta afecta también a sus descendientes. Se mantienen los controles por teclado para mover elementos y crear subcarpetas.
