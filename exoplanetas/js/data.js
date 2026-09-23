/* Datos de exoplanetas potencialmente habitables.
   Fuente principal: NASA Exoplanet Archive, tabla Planetary Systems Composite
   Parameters (consultada el 22 de septiembre de 2026). */
(function () {
  'use strict';
  const EXO = (window.EXO = window.EXO || {});

  const PC_TO_LY = 3.26156;

  EXO.meta = {
    confirmed: 6366,
    queried: '22 de septiembre de 2026',
    phlCandidates: 70
  };

  /* Apariencias base (colores sRGB). Cada planeta las ajusta con su semilla. */
  const LOOKS = {
    terran: { deep: '#07224d', shallow: '#1b6aa3', low: '#3d6a2c', high: '#8b7650', snow: '#f1f5f9', atmo: '#63a8ff', sea: 0.08, ice: 0.1, eye: -2, cloud: 0.5, bands: 0, atmoK: 1, haze: 0, relief: 0.5 },
    eyeball: { deep: '#062049', shallow: '#17639a', low: '#4b4638', high: '#7a6d5c', snow: '#e8f0f7', atmo: '#86b6ff', sea: 0.02, ice: 0, eye: 0.35, cloud: 0.55, bands: 0, atmoK: 0.85, haze: 0, relief: 0.45 },
    ocean: { deep: '#041a42', shallow: '#177bb0', low: '#c8b487', high: '#5f7447', snow: '#f4f8fb', atmo: '#76c1ff', sea: 0.26, ice: 0.08, eye: -2, cloud: 0.62, bands: 0, atmoK: 1.05, haze: 0.08, relief: 0.35 },
    arid: { deep: '#18324f', shallow: '#3c7e8c', low: '#ad7443', high: '#dcb27a', snow: '#f4ebdd', atmo: '#ffc58c', sea: -0.16, ice: 0.02, eye: -2, cloud: 0.28, bands: 0, atmoK: 0.9, haze: 0.12, relief: 0.6 },
    cold: { deep: '#0b2240', shallow: '#2a6386', low: '#5b3a36', high: '#8a7d74', snow: '#edf4fb', atmo: '#9ac6ff', sea: 0.06, ice: 0.42, eye: -2, cloud: 0.4, bands: 0, atmoK: 0.9, haze: 0, relief: 0.45 },
    hycean: { deep: '#0c3462', shallow: '#3796c0', low: '#8fd4dc', high: '#e6f4f7', snow: '#f4fbff', atmo: '#7ad6ff', sea: 1, ice: 0, eye: -2, cloud: 0.35, bands: 1, atmoK: 1.35, haze: 0.28, relief: 0 },
    barren: { deep: '#2b2622', shallow: '#3b342e', low: '#5a4f45', high: '#8c7d6e', snow: '#b9ada0', atmo: '#000000', sea: -1, ice: 0, eye: -2, cloud: 0, bands: 0, atmoK: 0, haze: 0, relief: 0.9 },
    icy: { deep: '#0e2a4a', shallow: '#3b7ea6', low: '#667080', high: '#a9b4c2', snow: '#eef5fc', atmo: '#a9d2ff', sea: 0.0, ice: 0.75, eye: -2, cloud: 0.25, bands: 0, atmoK: 0.6, haze: 0, relief: 0.5 }
  };
  EXO.LOOKS = LOOKS;

  /* massKind: 'medida' | 'minima' (velocidad radial, M·sen i) | 'estimada' (relacion masa-radio)
     radKind: 'medido' (transito) | 'estimado' (a partir de la masa) */
  const P = [
    {
      id: 'teegarden-b', name: 'Teegarden b', full: 'Estrella de Teegarden b',
      host: 'Estrella de Teegarden', spec: 'M7.0 V', teff: 3034, pc: 3.83078,
      rad: 1.05, radKind: 'estimado', mass: 1.16, massKind: 'minima',
      per: 4.90634, a: 0.0259, insol: 1.08, teq: 277, year: 2019,
      method: 'Velocidad radial', facility: 'Calar Alto · CARMENES',
      look: { base: 'eyeball', seed: 11.3, eye: -0.05, sea: 0.0, cloud: 0.62, atmo: '#8fbfff' },
      blurb: 'Recibe casi exactamente la misma energía que la Tierra recibe del Sol, por eso encabeza los índices de similitud. Orbita una enana roja diminuta y bastante tranquila, completa su año en menos de cinco días y seguramente muestra siempre la misma cara a su estrella.',
      facts: ['Año de 4.9 días', 'A solo 12.5 años luz', 'Encontrado por el espectrógrafo CARMENES en España']
    },
    {
      id: 'teegarden-c', name: 'Teegarden c', full: 'Estrella de Teegarden c',
      host: 'Estrella de Teegarden', spec: 'M7.0 V', teff: 3034, pc: 3.83078,
      rad: 1.02, radKind: 'estimado', mass: 1.05, massKind: 'minima',
      per: 11.416, a: 0.0455, insol: 0.35, teq: 209, year: 2019,
      method: 'Velocidad radial', facility: 'Calar Alto · CARMENES',
      look: { base: 'eyeball', seed: 27.9, eye: 0.55, cloud: 0.4 },
      blurb: 'Hermano exterior de Teegarden b. Recibe apenas un tercio de la luz que llega a la Tierra, así que probablemente es un mundo helado. Con una atmósfera densa podría conservar un mar líquido justo bajo su estrella, como una pupila azul en un ojo de hielo.',
      facts: ['Año de 11.4 días', 'Borde exterior de la zona habitable', 'Masa parecida a la terrestre']
    },
    {
      id: 'toi-700-d', name: 'TOI-700 d', full: 'TOI-700 d',
      host: 'TOI-700', spec: 'M2.5 V', teff: 3459, pc: 31.1265,
      rad: 1.073, radKind: 'medido', mass: 1.25, massKind: 'estimada',
      per: 37.42396, a: 0.1633, insol: 0.85, teq: 268.8, year: 2020,
      method: 'Tránsito', facility: 'TESS (NASA)',
      look: { base: 'terran', seed: 4.7, sea: 0.12, cloud: 0.55, ice: 0.14, locked: true },
      blurb: 'El primer planeta del tamaño de la Tierra que el telescopio TESS encontró en la zona habitable de su estrella. Recibe el 86 % de la energía que recibe nuestro planeta. Simulaciones climáticas muestran que, con una atmósfera como la terrestre, podría mantener agua líquida.',
      facts: ['Primer hallazgo de este tipo de TESS', 'Año de 37 días', 'Su estrella es una enana roja poco activa']
    },
    {
      id: 'toi-700-e', name: 'TOI-700 e', full: 'TOI-700 e',
      host: 'TOI-700', spec: 'M2.5 V', teff: 3459, pc: 31.1265,
      rad: 0.953, radKind: 'medido', mass: 0.818, massKind: 'estimada',
      per: 27.80978, a: 0.134, insol: 1.27, teq: 272.9, year: 2023,
      method: 'Tránsito', facility: 'TESS (NASA)',
      look: { base: 'terran', seed: 19.2, sea: 0.02, cloud: 0.48, ice: 0.05, low: '#6b7a34', high: '#a88a5a', locked: true },
      blurb: 'Descubierto en 2023 en el mismo sistema que TOI-700 d. Es un 5 % más pequeño que la Tierra y orbita en la zona habitable optimista. Así, TOI-700 es uno de los pocos sistemas conocidos con dos mundos del tamaño de la Tierra en esa franja.',
      facts: ['95 % del tamaño de la Tierra', 'Año de 28 días', 'Vecino interior de TOI-700 d']
    },
    {
      id: 'kepler-1649-c', name: 'Kepler-1649 c', full: 'Kepler-1649 c',
      host: 'Kepler-1649', spec: 'Enana roja (M)', teff: 3240, pc: 92.1913,
      rad: 1.06, radKind: 'medido', mass: 1.2, massKind: 'estimada',
      per: 19.53527, a: 0.0649, insol: 0.75, teq: 234, year: 2020,
      method: 'Tránsito', facility: 'Kepler (NASA)',
      look: { base: 'terran', seed: 33.1, sea: 0.16, cloud: 0.58, ice: 0.18, locked: true },
      blurb: 'Estuvo escondido en los datos de Kepler: un algoritmo lo había descartado como falsa alarma y un equipo lo rescató al revisarlos a mano en 2020. Tiene un tamaño y una energía recibida muy parecidos a los de la Tierra.',
      facts: ['Rescatado de datos de archivo', '1.06 veces el radio terrestre', 'Año de 19.5 días']
    },
    {
      id: 'k2-72-e', name: 'K2-72 e', full: 'K2-72 e',
      host: 'K2-72', spec: 'Enana roja (M)', teff: 3360, pc: 66.4321,
      rad: 1.29, radKind: 'medido', mass: 2.21, massKind: 'estimada',
      per: 24.158868, a: 0.106, insol: 1.2, teq: 286.3, year: 2016,
      method: 'Tránsito', facility: 'K2 (Kepler, NASA)',
      look: { base: 'terran', seed: 51.8, sea: 0.0, cloud: 0.45, ice: 0.04, low: '#57702f', high: '#b08a58', locked: true },
      blurb: 'Una súper-Tierra templada, un 29 % más grande que nuestro planeta, que recibe un poco más de luz que nosotros. Es el más externo de los cuatro planetas conocidos de su sistema y el único dentro de la zona habitable.',
      facts: ['Descubierto por la misión K2', 'Año de 24 días', '4 planetas conocidos en el sistema']
    },
    {
      id: 'lp-890-9-c', name: 'LP 890-9 c', full: 'LP 890-9 c (SPECULOOS-2 c)',
      host: 'LP 890-9', spec: 'M6 V', teff: 2850, pc: 32.4298,
      rad: 1.367, radKind: 'medido', mass: null, massKind: null,
      per: 8.457463, a: 0.03984, insol: 0.906, teq: 272, year: 2022,
      method: 'Tránsito', facility: 'TESS + SPECULOOS',
      look: { base: 'eyeball', seed: 8.8, eye: -0.25, sea: 0.06, cloud: 0.6 },
      blurb: 'Orbita una de las estrellas más frías con planetas conocidos. Tras los mundos de TRAPPIST-1, es de los planetas templados mejor situados para que el telescopio James Webb estudie su atmósfera.',
      facts: ['También llamado SPECULOOS-2 c', 'Año de 8.5 días', 'Estrella de solo 2,850 K']
    },
    {
      id: 'ross-128-b', name: 'Ross 128 b', full: 'Ross 128 b',
      host: 'Ross 128', spec: 'M4 V', teff: 3192, pc: 3.37454,
      rad: 1.11, radKind: 'estimado', mass: 1.4, massKind: 'minima',
      per: 9.8658, a: 0.0496, insol: 1.38, teq: 301, year: 2017,
      method: 'Velocidad radial', facility: 'La Silla · HARPS (ESO)',
      look: { base: 'arid', seed: 14.4, sea: -0.08, cloud: 0.36, locked: true },
      blurb: 'Su estrella es una de las enanas rojas más tranquilas que se conocen, con pocas llamaradas que pudieran arrancarle la atmósfera. Recibe un 38 % más de luz que la Tierra. Además, Ross 128 se acerca a nosotros: dentro de unos 79,000 años será la estrella más cercana al Sol.',
      facts: ['A 11 años luz', 'Estrella muy tranquila', 'Año de 9.9 días']
    },
    {
      id: 'wolf-1069-b', name: 'Wolf 1069 b', full: 'Wolf 1069 b',
      host: 'Wolf 1069', spec: 'M5.0 V', teff: 3158, pc: 9.58341,
      rad: 1.08, radKind: 'estimado', mass: 1.26, massKind: 'minima',
      per: 15.564, a: 0.0672, insol: 0.652, teq: 250.1, year: 2023,
      method: 'Velocidad radial', facility: 'Calar Alto · CARMENES',
      look: { base: 'eyeball', seed: 61.2, eye: 0.12, cloud: 0.5 },
      blurb: 'Uno de los planetas de masa terrestre más cercanos en zona habitable. Probablemente tiene rotación sincronizada: un hemisferio en día perpetuo y otro en noche eterna. Los modelos indican que con atmósfera su lado diurno podría ser templado.',
      facts: ['A 31 años luz', 'Año de 15.6 días', 'Descubierto en 2023']
    },
    {
      id: 'proxima-b', name: 'Proxima b', full: 'Proxima Centauri b',
      host: 'Proxima Centauri', spec: 'M5.5 V', teff: 2900, pc: 1.30119,
      rad: 1.02, radKind: 'estimado', mass: 1.055, massKind: 'minima',
      per: 11.18465, a: 0.04848, insol: 0.641, teq: 218, year: 2016,
      method: 'Velocidad radial', facility: 'ESO · campaña Pale Red Dot',
      look: { base: 'eyeball', seed: 2.2, eye: 0.18, cloud: 0.55, low: '#5a4a3a' },
      blurb: 'El exoplaneta más cercano a nosotros: su luz tarda poco más de cuatro años en llegar. Orbita la estrella más próxima al Sol, una enana roja que lanza llamaradas violentas capaces de erosionar atmósferas. Si conserva una, podría tener un océano frente a su estrella.',
      facts: ['A 4.24 años luz', 'Año de 11.2 días', 'Estrella con fuertes llamaradas']
    },
    {
      id: 'trappist-1-e', name: 'TRAPPIST-1 e', full: 'TRAPPIST-1 e',
      host: 'TRAPPIST-1', spec: 'M8.0 V', teff: 2566, pc: 12.42989,
      rad: 0.92, radKind: 'medido', mass: 0.692, massKind: 'medida',
      per: 6.101013, a: 0.02925, insol: 0.646, teq: 249.7, year: 2017,
      method: 'Tránsito', facility: 'TRAPPIST · Spitzer',
      look: { base: 'eyeball', seed: 5.5, eye: 0.02, cloud: 0.6 },
      blurb: 'La joya de TRAPPIST-1: rocoso, con una densidad parecida a la terrestre y una temperatura adecuada. El James Webb lo está observando. Por ahora descarta una atmósfera rica en hidrógeno, pero no una secundaria de nitrógeno como la nuestra. Hacen falta más tránsitos para decidir.',
      facts: ['Masa y radio medidos', 'Año de 6.1 días', 'Objetivo prioritario del James Webb']
    },
    {
      id: 'trappist-1-f', name: 'TRAPPIST-1 f', full: 'TRAPPIST-1 f',
      host: 'TRAPPIST-1', spec: 'M8.0 V', teff: 2566, pc: 12.42989,
      rad: 1.045, radKind: 'medido', mass: 1.039, massKind: 'medida',
      per: 9.20754, a: 0.03849, insol: 0.373, teq: 217.7, year: 2017,
      method: 'Tránsito', facility: 'TRAPPIST · Spitzer',
      look: { base: 'eyeball', seed: 7.1, eye: 0.6, cloud: 0.35 },
      blurb: 'Casi idéntico a la Tierra en masa y tamaño, pero recibe algo más de un tercio de la luz. Podría ser un mundo cubierto de hielo con un océano bajo la superficie, o tener un mar abierto solo en el punto donde la estrella está siempre en el cenit.',
      facts: ['1.04 masas terrestres', 'Año de 9.2 días', 'Mundo probablemente helado']
    },
    {
      id: 'gliese-12-b', name: 'Gliese 12 b', full: 'Gliese 12 b',
      host: 'Gliese 12', spec: 'M4 V', teff: 3328, pc: 12.21,
      rad: 0.93, radKind: 'medido', mass: 0.95, massKind: 'estimada',
      per: 12.761418, a: 0.067, insol: 1.62, teq: 314.6, year: 2024,
      method: 'Tránsito', facility: 'TESS (NASA)',
      look: { base: 'arid', seed: 42.2, sea: -0.02, cloud: 0.4, haze: 0.2, atmo: '#ffd3a0', locked: true },
      blurb: 'Templado pero más cálido que la Tierra: recibe 1.6 veces nuestra luz, entre lo que reciben la Tierra y Venus. Es un laboratorio ideal para entender por qué la Tierra conservó su agua y Venus la perdió, y el James Webb puede estudiarlo gracias a su cercanía.',
      facts: ['Descubierto en 2024', 'A 40 años luz', 'Entre la Tierra y Venus']
    },
    {
      id: 'kepler-452-b', name: 'Kepler-452 b', full: 'Kepler-452 b',
      host: 'Kepler-452', spec: 'G2 V', teff: 5757, pc: 551.727,
      rad: 1.63, radKind: 'medido', mass: 3.29, massKind: 'estimada',
      per: 384.843, a: 1.046, insol: 1.1, teq: 265, year: 2015,
      method: 'Tránsito', facility: 'Kepler (NASA)',
      look: { base: 'terran', seed: 23.9, sea: 0.02, cloud: 0.45, low: '#6a6a2e', high: '#b38a55', atmo: '#7fb6ff', haze: 0.05 },
      blurb: 'El "primo mayor" de la Tierra. Orbita una estrella casi gemela del Sol y su año dura 385 días. Su estrella es unos 1,500 millones de años más vieja que el Sol, así que el planeta podría estar viviendo el futuro que le espera a la Tierra cuando nuestro Sol brille más.',
      facts: ['Año de 385 días', 'Estrella tipo Sol', 'A 1,800 años luz']
    },
    {
      id: 'kepler-442-b', name: 'Kepler-442 b', full: 'Kepler-442 b',
      host: 'Kepler-442', spec: 'Enana naranja (K)', teff: 4402, pc: 365.965,
      rad: 1.34, radKind: 'medido', mass: 2.36, massKind: 'estimada',
      per: 112.3053, a: 0.409, insol: 0.66, teq: 241, year: 2015,
      method: 'Tránsito', facility: 'Kepler (NASA)',
      look: { base: 'terran', seed: 3.3, sea: 0.1, cloud: 0.52, ice: 0.18, low: '#2f6a34', high: '#8d7a52' },
      blurb: 'Orbita una enana naranja, un tipo de estrella longeva y estable que muchos consideran ideal para la vida. Un estudio de 2021 calculó que recibe suficiente luz para sostener una biosfera con fotosíntesis parecida a la terrestre.',
      facts: ['Estrella tipo K', 'Año de 112 días', 'Luz suficiente para la fotosíntesis']
    },
    {
      id: 'gj-667-cc', name: 'GJ 667 C c', full: 'Gliese 667 C c',
      host: 'Gliese 667 C', spec: 'M1.5 V', teff: 3350, pc: 7.24396,
      rad: 1.77, radKind: 'estimado', mass: 3.8, massKind: 'minima',
      per: 28.14, a: 0.125, insol: 0.877, teq: null, year: 2013,
      method: 'Velocidad radial', facility: 'La Silla · HARPS (ESO)',
      look: { base: 'ocean', seed: 17.7, sea: 0.12, cloud: 0.55, low: '#9c8a5d', high: '#6a6a45', locked: true },
      blurb: 'Vive en un sistema triple. Además de su enana roja, desde su superficie se verían en el cielo otras dos estrellas naranjas muy brillantes, las componentes A y B del sistema. Es una súper-Tierra de al menos 3.8 masas terrestres.',
      facts: ['Sistema de tres estrellas', 'A 23.6 años luz', 'Año de 28 días']
    },
    {
      id: 'toi-715-b', name: 'TOI-715 b', full: 'TOI-715 b',
      host: 'TOI-715', spec: 'M4 V', teff: 3075, pc: 42.4048,
      rad: 1.55, radKind: 'medido', mass: 3.02, massKind: 'estimada',
      per: 19.288004, a: 0.083, insol: 0.67, teq: 234, year: 2023,
      method: 'Tránsito', facility: 'TESS (NASA)',
      look: { base: 'ocean', seed: 38.4, sea: 0.2, cloud: 0.6, locked: true },
      blurb: 'Una súper-Tierra dentro de la zona habitable conservadora, la franja más estricta y fiable. Es un 55 % más grande que la Tierra y da una vuelta a su estrella cada 19 días.',
      facts: ['Zona habitable conservadora', 'Año de 19 días', 'Anunciado en 2024']
    },
    {
      id: 'kepler-22-b', name: 'Kepler-22 b', full: 'Kepler-22 b',
      host: 'Kepler-22', spec: 'G5 V', teff: 5596, pc: 194.642,
      rad: 2.1, radKind: 'medido', mass: 9.1, massKind: 'medida',
      per: 289.863876, a: 0.812, insol: 1.013, teq: 279, year: 2011,
      method: 'Tránsito', facility: 'Kepler (NASA)',
      look: { base: 'ocean', seed: 9.9, sea: 0.34, cloud: 0.66, haze: 0.14 },
      blurb: 'El primer planeta que Kepler confirmó en la zona habitable de una estrella parecida al Sol. Con 2.1 veces el radio terrestre podría ser un mundo cubierto por un océano global, o un mini-Neptuno sin superficie sólida.',
      facts: ['Primer hallazgo de Kepler en zona habitable', 'Año de 290 días', 'Estrella parecida al Sol']
    },
    {
      id: 'kepler-62-f', name: 'Kepler-62 f', full: 'Kepler-62 f',
      host: 'Kepler-62', spec: 'K2 V', teff: 4925, pc: 300.874,
      rad: 1.41, radKind: 'medido', mass: null, massKind: null,
      per: 267.291, a: 0.718, insol: 0.5, teq: 208, year: 2013,
      method: 'Tránsito', facility: 'Kepler (NASA)',
      look: { base: 'cold', seed: 45.1, sea: 0.12, ice: 0.5, cloud: 0.42, low: '#3d4f3a' },
      blurb: 'Probablemente rocoso. Recibe la mitad de la luz que la Tierra, pero con suficiente dióxido de carbono en su atmósfera podría mantener océanos líquidos. Su sistema tiene otro candidato en la zona habitable: Kepler-62 e.',
      facts: ['Año de 267 días', 'Posibles casquetes polares', 'Dos mundos en zona habitable']
    },
    {
      id: 'k2-18-b', name: 'K2-18 b', full: 'K2-18 b',
      host: 'K2-18', spec: 'M2.5 V', teff: 3457, pc: 38.0266,
      rad: 2.37, radKind: 'medido', mass: 8.92, massKind: 'medida',
      per: 32.939623, a: 0.1429, insol: 1.005, teq: 284, year: 2015,
      method: 'Tránsito', facility: 'K2 (Kepler, NASA)',
      look: { base: 'hycean', seed: 13.6, cloud: 0.3 },
      blurb: 'En 2023 el James Webb detectó metano y dióxido de carbono en su atmósfera. La posible señal de sulfuro de dimetilo (DMS), que en la Tierra producen sobre todo organismos marinos, sigue en disputa. Podría ser un mundo "hiceánico", con un océano bajo una atmósfera de hidrógeno, o un mini-Neptuno sin superficie habitable.',
      facts: ['Metano y CO₂ detectados', 'DMS: señal en disputa', 'Casi 9 masas terrestres']
    },
    {
      id: 'lhs-1140-b', name: 'LHS 1140 b', full: 'LHS 1140 b',
      host: 'LHS 1140', spec: 'M4.5 V', teff: 3096, pc: 14.9861,
      rad: 1.73, radKind: 'medido', mass: 5.6, massKind: 'medida',
      per: 24.73723, a: 0.0946, insol: 0.43, teq: 226, year: 2017,
      method: 'Tránsito', facility: 'MEarth',
      look: { base: 'eyeball', seed: 29.4, eye: 0.42, cloud: 0.45, deep: '#05265a', shallow: '#1b7fc0' },
      blurb: 'Su baja densidad sugiere que tiene mucha agua. El James Webb descartó una atmósfera de hidrógeno y encontró indicios tentativos de nitrógeno. Una hipótesis es un planeta helado con un océano líquido de unos 4,000 km de ancho frente a su estrella.',
      facts: ['Posible mundo de agua', 'Indicios de nitrógeno (JWST)', 'A 49 años luz']
    },
    {
      id: 'kepler-186-f', name: 'Kepler-186 f', full: 'Kepler-186 f',
      host: 'Kepler-186', spec: 'M1 V', teff: 3755, pc: 177.594,
      rad: 1.17, radKind: 'medido', mass: 1.71, massKind: 'estimada',
      per: 129.9441, a: 0.432, insol: 0.3, teq: 177, year: 2014,
      method: 'Tránsito', facility: 'Kepler (NASA)',
      look: { base: 'cold', seed: 21.5, sea: 0.08, ice: 0.38, cloud: 0.4, low: '#6b3a33', high: '#8d7568' },
      blurb: 'El primer planeta del tamaño de la Tierra descubierto en la zona habitable de otra estrella. Recibe un tercio de la energía que recibe la Tierra: al mediodía, su cielo tendría el brillo de nuestra hora dorada, poco antes del atardecer.',
      facts: ['Primero del tamaño de la Tierra en zona habitable', 'Año de 130 días', 'Mediodía como un atardecer']
    }
  ];

  /* Referencias del Sistema Solar */
  EXO.earth = {
    id: 'tierra', name: 'Tierra', full: 'Tierra', host: 'Sol', spec: 'G2 V', teff: 5772, pc: 0,
    rad: 1, mass: 1, per: 365.25, a: 1, insol: 1, teq: 255,
    look: { base: 'terran', seed: 1.0, sea: 0.13, ice: 0.14, cloud: 0.52, low: '#3b6b2a', high: '#9a8055' }
  };
  EXO.solar = [
    { id: 'marte', name: 'Marte', rad: 0.532, teff: 5772, look: { base: 'arid', seed: 66.6, sea: -1, cloud: 0, ice: 0.08, low: '#9a4b2b', high: '#c8764a', snow: '#f3ece6', atmo: '#e8a888', atmoK: 0.25, haze: 0 } },
    { id: 'neptuno', name: 'Neptuno', rad: 3.88, teff: 5772, look: { base: 'hycean', seed: 88.1, deep: '#1b3f9a', shallow: '#3563c9', low: '#6f9ae8', high: '#dbe8ff', atmo: '#6c9dff', cloud: 0.18 } }
  ];

  /* Sistema TRAPPIST-1 (Agol et al. 2021) */
  EXO.trappist = {
    star: { teff: 2566, radSun: 0.1192, massSun: 0.0898, pc: 12.42989 },
    planets: [
      { k: 'b', rad: 1.116, mass: 1.374, per: 1.51088, a: 0.01154, insol: 4.15, look: { base: 'barren', seed: 3.1 } },
      { k: 'c', rad: 1.097, mass: 1.308, per: 2.42180, a: 0.01580, insol: 2.21, look: { base: 'barren', seed: 9.4, low: '#6a5a4c', high: '#a08f7e' } },
      { k: 'd', rad: 0.788, mass: 0.388, per: 4.04922, a: 0.02227, insol: 1.115, look: { base: 'arid', seed: 12.2, sea: -0.12, cloud: 0.3, locked: true } },
      { k: 'e', rad: 0.920, mass: 0.692, per: 6.10101, a: 0.02925, insol: 0.646, look: { base: 'eyeball', seed: 5.5, eye: 0.02, cloud: 0.6 } },
      { k: 'f', rad: 1.045, mass: 1.039, per: 9.20754, a: 0.03849, insol: 0.373, look: { base: 'eyeball', seed: 7.1, eye: 0.6, cloud: 0.35 } },
      { k: 'g', rad: 1.129, mass: 1.321, per: 12.35245, a: 0.04683, insol: 0.252, look: { base: 'eyeball', seed: 31.7, eye: 0.78, cloud: 0.25 } },
      { k: 'h', rad: 0.755, mass: 0.326, per: 18.77287, a: 0.06189, insol: 0.144, look: { base: 'icy', seed: 44.4, ice: 0.95, cloud: 0.1 } }
    ]
  };

  /* Descubrimientos confirmados por año (NASA Exoplanet Archive, 22 sep 2026; 2026 parcial) */
  EXO.discoveries = [
    [1992, 2], [1993, 0], [1994, 1], [1995, 1], [1996, 6], [1997, 1], [1998, 6], [1999, 13], [2000, 16],
    [2001, 12], [2002, 29], [2003, 22], [2004, 27], [2005, 36], [2006, 32], [2007, 52], [2008, 62],
    [2009, 87], [2010, 93], [2011, 141], [2012, 144], [2013, 128], [2014, 872], [2015, 155], [2016, 1504],
    [2017, 152], [2018, 308], [2019, 194], [2020, 234], [2021, 564], [2022, 367], [2023, 323], [2024, 260],
    [2025, 245], [2026, 277]
  ];

  /* ---- Derivados ---- */
  function esi(S, R) {
    const a = (S - 1) / (S + 1);
    const b = (R - 1) / (R + 1);
    return 1 - Math.sqrt(0.5 * (a * a + b * b));
  }
  EXO.esi = esi;

  function starClass(teff) {
    if (teff < 3900) return 'M';
    if (teff < 5300) return 'K';
    if (teff < 6000) return 'G';
    return 'F';
  }

  P.forEach(function (p) {
    p.ly = p.pc * PC_TO_LY;
    p.esi = esi(p.insol, p.rad);
    p.cls = starClass(p.teff);
    if (p.mass && p.rad) p.g = p.mass / (p.rad * p.rad);
  });
  P.sort(function (a, b) { return b.esi - a.esi; });
  P.forEach(function (p, i) { p.rank = i + 1; });

  EXO.planets = P;
  EXO.byId = {};
  P.forEach(function (p) { EXO.byId[p.id] = p; });
})();
