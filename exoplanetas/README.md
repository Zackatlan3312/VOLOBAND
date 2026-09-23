# Otras Tierras

Atlas visual e interactivo de los exoplanetas potencialmente habitables, renderizado en tiempo real con WebGL2.

## Qué incluye

- **Hero cinematográfico**: el horizonte de un planeta templado amaneciendo bajo su estrella.
- **Zona habitable interactiva**: mueve la temperatura de una estrella y mira cómo cambia la franja habitable. Usa los límites de Kopparapu et al. (2014).
- **Catálogo de 22 mundos** con filtros, orden animado y un expediente por planeta. En el expediente puedes girar el planeta, compararlo con la Tierra y calcular tu peso allí.
- **Comparativa a escala** con desplazamiento horizontal fijado al scroll.
- **TRAPPIST-1 en 3D**: siete planetas con fases reales. La vista pasa de canto (como la vemos desde la Tierra) a cenital.
- **Distancias y tiempos de viaje** a la velocidad de la luz, de Breakthrough Starshot, de la sonda Parker y de la Voyager 1.
- **Métodos de detección** (tránsito y velocidad radial), **biofirmas**, **resultados del James Webb**, **historia de los descubrimientos** y **misiones futuras**.

## Calidad visual y rendimiento

- Los planetas son **esferas analíticas** dibujadas en un fragment shader: no son mallas ni texturas. Por eso los bordes y el terreno se mantienen nítidos en 1080p, 4K, 8K o pantallas Retina.
- El detalle procedural se ajusta **por píxel**: cada píxel calcula solo las octavas de ruido que puede mostrar. Así no hay parpadeo ni se gasta GPU de más.
- Toda la escena usa **un solo lienzo WebGL**. Cada planeta se pinta en la posición exacta de su elemento HTML, con precisión subpíxel.
- La **resolución se adapta** midiendo el tiempo real de GPU (`EXT_disjoint_timer_query_webgl2`). Solo baja si la GPU no mantiene la fluidez. El botón `AUTO` / `NATIVA` de la esquina inferior izquierda permite forzar la resolución nativa.
- Medido en una RTX 4060 en 3840×2160: unos 4 ms de GPU por cuadro, a 144 FPS.
- Respeta `prefers-reduced-motion`. Si el navegador no tiene WebGL2, la página muestra planetas en CSS y todo el contenido sigue disponible.

## Enlaces directos

- `?planeta=trappist-1-e` abre el expediente de ese planeta (el id está en `js/data.js`).
- `?at=trappist&p=0.9` lleva a una sección y a un punto de su animación de scroll.

## Ver en local

No necesita compilación. Basta con abrir `index.html` o servir la carpeta:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000/exoplanetas/`.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura y textos |
| `css/style.css` | Diseño, tipografía y diseño responsivo |
| `js/data.js` | Datos de los planetas, TRAPPIST-1 y descubrimientos por año |
| `js/shaders.js` | Shaders GLSL: nebulosa, estrellas, planetas, estrella y órbitas |
| `js/engine.js` | Motor WebGL2, vistas de planeta, sistema TRAPPIST-1 y resolución adaptativa |
| `js/diagrams.js` | Zona habitable, animaciones de detección, espectro y gráfica |
| `js/main.js` | Construcción del DOM, scroll suave, interacciones y bucle principal |

## Fuentes

- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), tabla *Planetary Systems Composite Parameters*, consultada el 22 de septiembre de 2026 (6,366 planetas confirmados).
- [PHL · Habitable Worlds Catalog](https://phl.upr.edu/hwc).
- Agol et al. (2021) para TRAPPIST-1; Kopparapu et al. (2014) para la zona habitable.
- NASA, ESA y ESO para el estado de las misiones.

El Índice de Similitud con la Tierra (IST) se calcula con el radio y el flujo estelar: `1 − √(½[((S−1)/(S+1))² + ((R−1)/(R+1))²])`.

Las imágenes de los planetas son **recreaciones artísticas** generadas por código. Ningún telescopio ha visto todavía la superficie de estos mundos.

Librerías externas: [Lenis](https://github.com/darkroomengineering/lenis) para el scroll suave (CDN) y fuentes de Google Fonts. El motor 3D está escrito a mano, sin librerías.
