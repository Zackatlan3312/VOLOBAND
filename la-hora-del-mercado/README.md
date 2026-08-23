# La Hora del Mercado

Juego cooperativo de terror y supervivencia para Roblox (1–6 jugadores), basado
en el documento de concepto *La Última Hora*.

Quedas atrapado en un bazar de barrio cuando ya es demasiado tarde. Tienes que
recoger tu encargo en un local, y volver a tu departamento antes de las **23:59**.
Después de esa hora, el bazar deja de ser un bazar.

---

## Qué está construido

Esto es el **vertical slice** que el propio documento pide como primer paso:
un piso del bazar, 12 locales, la escuela de idiomas, dos entidades y un
objetivo simple. Todo funciona de punta a punta — no hay marcadores de posición
en la lógica.

### Bucle de partida

`Vestíbulo → TARDE → CIERRE → HORA PROHIBIDA → Resultados → Vestíbulo`

Los jugadores viven en el vestíbulo. Solo entran al bazar los que se paran
frente a la reja; el resto se queda esperando. Quien muere vuelve al vestíbulo
a los pocos segundos, y al terminar la ronda vuelven todos.

| Fase | Duración | Reloj | Qué pasa |
|---|---|---|---|
| Tarde | 2 min | 18:00 → 21:00 | Bazar abierto, gente comprando, El Viejo pasea |
| Cierre | 2 min | 21:00 → 23:59 | Persianas bajan una por una, los NPC huyen, luces fallan |
| Hora prohibida | 3.5 min | 23:59 → 01:00 | Empieza la cacería |

La ronda termina antes si todos los jugadores ya murieron o llegaron a casa.

### Vestíbulo — "La Vecindad"

Un patio techado de edificio de departamentos: fachadas de dos niveles con
puertas numeradas, escalera, tendedero, macetas, tinaco y una serie de foquitos
cruzando el patio. Está siempre cálido e iluminado, para que el contraste con
el bazar de noche se note.

Contiene:

- **Tablero de cómo se juega** y **tablero de controles**
- **Tablero "Última noche"**, que se actualiza al terminar cada ronda con quién
  volvió, quién volvió con su encargo y de qué murió cada quien
- **La reja "AL BAZAR"**: pararte en la zona iluminada frente a ella es tu forma
  de decir que entras. Un cartel flotante lleva el conteo de listos y la cuenta
  atrás, así que todos ven quién se está animando

### Mapa

Se genera por código en cada arranque del servidor — no hay que modelar nada a mano.

- **Pasillo principal** de 184 studs con 12 locales con nombre, persianas metálicas
  funcionales, columnas, bancas y señalización colgante
- **Bloque de departamentos**: 6 departamentos privados con puerta de bisagra,
  cama, mesa y lámpara cálida — uno por jugador, y son zona segura
- **Escuela de idiomas**: recepción y 3 salones con pupitres, pizarrón y pósters
- **Pasillo de servicio** trasero con dos cuartos de mantenimiento (refugios) y
  dos pasajes laterales que conectan con el bazar — la ruta alternativa
- Iluminación fluorescente que cambia de temperatura y muere por zonas
  conforme avanza la noche

### Entidades

**El Viejo** — Durante la tarde y el cierre deambula, se acerca a los jugadores
y les pregunta la hora ("¿Ya viste la hora, muchacho?", "Después de las doce, no
te conozco"). A las 23:59 empieza a cazar: elige presa combinando distancia y
**ruido**, persigue con pathfinding real, acelera progresivamente de 12.5 a 17
studs/s a lo largo de la noche, y si todos se esconden se planta afuera del
refugio a respirar hasta que alguien se harte y salga.

**Corre** — *"No corras."* Marca 4 pasillos al azar con sellos invisibles. Si
cruzas uno a velocidad de carrera, mueres al instante. Las únicas pistas son una
veladura rojiza casi imperceptible en el piso y un susurro cuando te acercas.
Obliga a caminar justo cuando más ganas tienes de huir.

### Sistemas

- **Ruido** — correr, abrir puertas y mover persianas generan ruido que se
  disipa con el tiempo; El Viejo lo usa para elegir a quién perseguir
- **Miedo colectivo** — los NPC miran hacia atrás, susurran, aprietan el paso y
  corren a la salida durante el cierre. Son tu sistema de alerta temprana
- **Pasos audibles** — los pasos de cada jugador se replican al servidor y se
  oyen a 45 studs caminando, 90 corriendo. Oyes a tus compañeros y ellos a ti
- **Refugios** — departamentos y cuartos de mantenimiento; El Viejo no puede
  alcanzarte dentro, pero sí esperarte afuera
- **Cámara realista** — balanceo de pasos, respiración, inclinación al girar,
  empuje de FOV al esprintar, viñeta que se cierra con la tensión y latido que
  se acelera según la distancia a El Viejo

### Controles

| Tecla | Acción |
|---|---|
| `Shift` | Correr (ruidoso, y mortal dentro de un sello de Corre) |
| `F` | Linterna |
| `E` | Interactuar (puertas, persianas, recoger encargo) |
| Clic | Estando muerto: cambiar de compañero al que observar |

En móvil, mantener presionado activa la carrera.

---

## Cómo instalarlo

### Opción A — Abrir el archivo de lugar (sin instalar nada)

1. Descarga [`dist/LaHoraDelMercado.rbxlx`](dist/LaHoraDelMercado.rbxlx)
2. En Roblox Studio: **File → Open from File** y elige ese archivo
3. Dale a **Play**

Ya está. Después publícalo con **File → Publish to Roblox As...**

> Comprueba que `Lighting.Technology` esté en **Future** (viene puesto en el
> archivo, pero si tu versión de Studio lo ignora, cámbialo a mano — es lo que
> da las sombras y el ambiente correctos).

### Opción B — Rojo (recomendado si vas a seguir desarrollando)

```bash
# Una sola vez
rojo serve
```

Luego, en Studio, conecta el plugin de Rojo. El proyecto está en
`default.project.json` y sincroniza `src/` en vivo.

### Regenerar el archivo de lugar

Si editas algo en `src/` y quieres actualizar el `.rbxlx`:

```bash
python3 build/build_place.py
```

---

## Estructura

```
src/
  shared/
    Config.luau        ← todo el balance, textos, audio y música viven aquí
    Remotes.luau
    SoundBank.luau     Resuelve y verifica el audio disponible
  server/
    Main.server.luau   Punto de entrada
    MapBuilder.luau    Construye el complejo entero por código
    LobbyBuilder.luau  Construye la vecindad
    LobbySystem.luau   Espera, listos, ir y volver del bazar
    MusicDirector.luau Partitura generativa por fase
    GameLoop.luau      Fases, reloj, encargos, victoria/derrota
    PlayerSession.luau Estado por jugador, ruido, sprint, linterna, muerte
    LightingRig.luau   Atmósfera y luminarias por fase
    NPCSystem.luau     Civiles y miedo colectivo
    Footsteps.luau     Pasos audibles replicados
    RigFactory.luau    Genera los cuerpos de NPC y entidades
    Entities/
      ElViejo.luau
      Corre.luau
  client/
    Main.client.luau   Controles, remotos, espectador
    HUD.luau           Reloj, fase, objetivo, avisos, muerte
    Camera.luau        Primera persona con balanceo y respiración
    Effects.luau       Viñeta, latido, sustos, susurros de Corre
```

Todo el balance está en `src/shared/Config.luau`: duraciones de fase,
velocidades, radio de muerte, cantidad de sellos, nombres de locales, frases
de El Viejo, el motivo musical y la espera del vestíbulo. No hace falta tocar los sistemas para ajustar el juego.

---

## Sobre el audio

Todo el audio sale de sonidos que vienen **dentro de la instalación de Roblox**
(`rbxasset://`). No pasan por la red, no dependen de permisos y no pueden
romperse por los cambios de privacidad de audio — que es exactamente lo que
tumbó la primera versión.

Aun así, ningún id se da por bueno a ciegas. Al arrancar, `SoundBank` precarga
todos los candidatos **una sola vez**, comprueba cuáles cargaron de verdad y se
queda con el primero que sirva de cada sonido. Lo reporta en el Output:

```
[LaHoraDelMercado] Audio: 12/12 sonidos resueltos.
```

Si alguno no resuelve, lo dice por su nombre y ese efecto queda en silencio —
sin volver a intentarlo ni llenar la consola. El juego sigue funcionando igual.

### Poner tu propio audio

Sube tus archivos al Creator Marketplace y ponlos en `Config.SoundOverrides`:

```lua
Config.SoundOverrides = {
	Whisper = "rbxassetid://TU_ID",
	Metal = "rbxassetid://TU_ID",
}
```

Lo que pongas ahí gana sobre todo lo demás. No hace falta tocar ningún sistema.

### La música

No hay archivos de música: la partitura se genera en vivo. Un sonido sostenido
cualquiera, bajado de tono y pasado por reverberación y ecualizador, se
convierte en el drone de fondo; una nota corta, afinada por semitonos, toca el
motivo del tema.

Cada fase tiene su acorde y su carácter, y el motivo se va apagando conforme
cae la noche hasta que en la hora prohibida solo queda el drone. El tema está
en `Config.Music.Motif` como una lista de semitonos: cámbiala y cambia el tema
del juego.

---

## Lo que falta del documento

Esto es deliberado: el documento pide validar el vertical slice antes de
expandir. Cuando la tensión funcione, lo siguiente es:

- **Zonas**: cine, tiendas ancla, plaza de comida, oficinas, estacionamiento
- **Entidades**: El Último Cliente, La Cortina, La Voz, El Vigilante
- **Objetivos alternativos**: restablecer la energía, recuperar llaves, salida
  alternativa, ayudar a NPC atrapados
- **Progresión**: dificultad creciente y zonas desbloqueables entre partidas

La arquitectura ya está preparada para esto. Añadir una entidad es un módulo
nuevo en `src/server/Entities/` con `setPhase()` y `destroy()`, instanciado
desde `GameLoop.runRound()`. Añadir una zona es una función más en
`MapBuilder.build()` que registre sus puntos de patrulla, refugios y candidatos
a sello en las listas que ya existen.
