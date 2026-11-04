# Nombres personalizados de objetos

Estado: CONFIRMADO por el usuario para guardar nombres de puertas y ventanas con el diseño.

Los muebles, packs y superficies conservan su campo `name` existente. Los diseños con nombres personalizados de puertas o ventanas se guardan con versión 2 y un campo `name` opcional en cada apertura. Los diseños sin dichos nombres siguen escribiéndose como v1. Se aceptan diseños v1 y v2; los v1 mantienen los nombres predeterminados, sin alterar los originales. Al cargar v2 se normalizan nombres de hasta 80 caracteres y se ignoran valores vacíos o inválidos. Los nombres participan en deshacer y rehacer y se conservan al duplicar ventanas.
