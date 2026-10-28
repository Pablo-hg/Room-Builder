# Capturas de referencia R0

Estas capturas registran la apariencia existente antes de iniciar R1. No son pruebas visuales con tolerancia de píxeles ni autorizan cambios de diseño.

## Reproducción

```bash
npm run capture:r0-baseline
```

El proceso usa Chromium de Playwright, viewport de 1600 × 1000 px, escala 1, tema claro, movimiento reducido y el fixture `tests/fixtures/persistence-v1/valid-complete.json`.

## Archivos

- `view-isometric.png`, `view-top.png`, `view-front.png`, `view-pov.png`, `view-free.png`: las cinco vistas implementadas.
- `isometric-0-walls-a-y-d.png` a `isometric-3-walls-c-y-d.png`: las cuatro orientaciones isométricas.
