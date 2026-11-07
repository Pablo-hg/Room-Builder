# Orden visual de elementos

Estado: CONFIRMADO por la petición de ordenar e intercalar objetos y carpetas hermanas del menú de escena. El orden es independiente del mundo 3D.

Los diseños con orden personalizado utilizan versión 4 y una lista opcional de identificadores de elementos y carpetas. Los diseños anteriores mantienen su orden original. La carga descarta valores inválidos y repetidos; los identificadores que ya no corresponden a elementos se ignoran al mostrar la lista; los elementos nuevos o sin posición explícita aparecen después de los ordenados. El orden se conserva al guardar y participa en deshacer y rehacer.
