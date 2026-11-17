/**
 * Calidad de dibujo de la escena principal.
 *
 * Un navegador automatizado (Playwright/Selenium: `navigator.webdriver`) no tiene GPU y dibuja por software: las
 * sombras (un pase de render extra) y el antialiasing multimuestra son lo que más pesa y dejan la página a ~25 fps,
 * de modo que cada gesto de una prueba E2E espera a un hilo principal saturado (clics de ~0,7 s). Ahí se dibuja
 * sin ellos. Para el usuario real no cambia nada: `navigator.webdriver` es `false`.
 */
export const automatedBrowser = typeof navigator !== 'undefined' && navigator.webdriver === true
