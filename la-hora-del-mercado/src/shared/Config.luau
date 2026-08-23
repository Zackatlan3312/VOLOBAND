--!strict
-- Configuración central de "La Hora del Mercado".
-- Todos los valores de balance, sonidos y textos viven aquí para poder
-- ajustar el juego sin tocar los sistemas.

local Config = {}

Config.Version = "0.1.0 (vertical slice)"

-- ── Jugadores ────────────────────────────────────────────────────────────────
Config.MinPlayers = 1
Config.MaxPlayers = 6

-- ── Movimiento ───────────────────────────────────────────────────────────────
Config.WalkSpeed = 10
Config.SprintSpeed = 17
-- Umbral de velocidad horizontal (studs/s) a partir del cual "Corre" mata
-- dentro de un pasillo sellado.
Config.RunDeathSpeed = 13

-- ── Fases de la partida (segundos reales) ────────────────────────────────────
Config.IntermissionTime = 20
Config.PhaseDurations = {
	TARDE = 120,
	CIERRE = 120,
	PROHIBIDA = 210,
}

-- Rango del reloj del juego por fase, en minutos desde las 00:00.
-- La fase PROHIBIDA cruza medianoche (23:59 → 01:00).
Config.ClockRanges = {
	TARDE = { 18 * 60, 21 * 60 },
	CIERRE = { 21 * 60, 23 * 60 + 59 },
	PROHIBIDA = { 23 * 60 + 59, 25 * 60 },
}

-- ── Sistema de ruido ─────────────────────────────────────────────────────────
Config.Noise = {
	RunPerSecond = 12, -- ruido por segundo mientras se corre
	Door = 8, -- abrir o cerrar una puerta
	Persiana = 18, -- mover una persiana metálica
	Decay = 6, -- ruido que se disipa por segundo
	Max = 100,
}

-- ── Entidades ────────────────────────────────────────────────────────────────
Config.Viejo = {
	WalkSpeed = 7, -- paseo durante la tarde
	HuntSpeedStart = 12.5, -- al iniciar la cacería
	HuntSpeedEnd = 17, -- al final de la hora prohibida
	HuntRampTime = 150, -- segundos para llegar a la velocidad máxima
	KillRadius = 4.2,
	ApproachIntervalMin = 18, -- cada cuánto se acerca a un jugador (tarde/cierre)
	ApproachIntervalMax = 32,
	RepathInterval = 0.65,
	LurkTime = 8, -- segundos que acecha frente a un refugio
	NoiseWeight = 0.6, -- cuánto pesa el ruido al elegir presa
}

Config.Corre = {
	SealCount = 4, -- pasillos sellados por partida
	WhisperRadius = 14, -- distancia a la que el cliente insinúa el peligro
}

Config.NPC = {
	Count = 10,
	WalkSpeed = 8,
	FearSpeed = 13,
}

-- ── Sonidos ─────────────────────────────────────────────────────────────────
-- Cada "cue" es una lista de candidatos en orden de preferencia. Al arrancar,
-- SoundBank prueba cuáles cargan de verdad y se queda con el primero que sirva.
--
-- Los `rbxasset://` vienen dentro de la instalación de Roblox: no pasan por la
-- red, no dependen de permisos y no pueden fallar por privacidad de audio. Los
-- `rbxassetid://` de respaldo son los sonidos por defecto del personaje, que
-- son de Roblox y públicos.
--
-- ¿Tienes audio propio? No toques esta tabla: pon tus ids en SoundOverrides.
Config.SoundCues = {
	-- Pasos y golpes secos
	Step = {
		"rbxasset://sounds/action_footsteps_plastic.mp3",
		"rbxasset://sounds/clickfast.wav",
		"rbxassetid://5766940624",
	},
	Click = {
		"rbxasset://sounds/switch.wav",
		"rbxasset://sounds/clickfast.wav",
		"rbxasset://sounds/button.wav",
		"rbxasset://sounds/electronicpingshort.wav",
	},
	-- Metal: persianas, rejas, puertas de servicio
	Metal = {
		"rbxasset://sounds/metal.ogg",
		"rbxasset://sounds/collide.wav",
		"rbxasset://sounds/hit.wav",
		"rbxasset://sounds/unsheath.wav",
	},
	Creak = {
		"rbxasset://sounds/unsheath.wav",
		"rbxasset://sounds/action_get_up.mp3",
		"rbxasset://sounds/swordslash.wav",
		"rbxassetid://5766940374",
	},
	-- Voz humana: susurros, gritos, respiración
	Whisper = {
		"rbxasset://sounds/uuhhh.mp3",
		"rbxassetid://5766823599",
	},
	Scream = {
		"rbxasset://sounds/uuhhh.mp3",
		"rbxassetid://5766823599",
	},
	Breathing = {
		"rbxasset://sounds/action_swim.mp3",
		"rbxassetid://5766941307",
	},
	-- Sostenidos: base de los drones y de la música
	Drone = {
		"rbxasset://sounds/action_falling.mp3",
		"rbxassetid://5766940765",
		"rbxasset://sounds/action_swim.mp3",
	},
	Heartbeat = {
		"rbxasset://sounds/bass.wav",
		"rbxasset://sounds/collide.wav",
		"rbxassetid://5766940624",
	},
	-- Eléctricos
	Buzz = {
		"rbxasset://sounds/electronicpingshort.wav",
		"rbxasset://sounds/switch.wav",
		"rbxasset://sounds/clickfast.wav",
	},
	Chime = {
		"rbxasset://sounds/electronicpingshort.wav",
		"rbxasset://sounds/victory.wav",
		"rbxasset://sounds/switch3.wav",
	},
	-- Nota afinada: es la voz que toca el tema del juego
	Note = {
		"rbxasset://sounds/electronicpingshort.wav",
		"rbxasset://sounds/bass.wav",
		"rbxasset://sounds/switch3.wav",
	},
}

-- Pon aquí tus propios ids para sustituir cualquier cue. Lo que escribas aquí
-- gana siempre, sin pasar por la lista de candidatos. Ejemplo:
--   Config.SoundOverrides = { Whisper = "rbxassetid://TU_ID" }
Config.SoundOverrides = {} :: { [string]: string }

-- ── Música ──────────────────────────────────────────────────────────────────
-- La partitura es generativa: se construye con drones afinados y un motivo de
-- notas, así que no depende de ningún archivo de música subido.
Config.Music = {
	MasterVolume = 0.5,
	-- Motivo del tema, en semitonos respecto a la tónica. Los `false` son
	-- silencios. Cámbialo y cambia el tema del juego.
	Motif = { 0, 7, 3, 5, false, 0, -2, false },
	NoteSeconds = 0.62,
	-- Acorde de fondo (semitonos) y carácter de cada fase.
	Phases = {
		LOBBY = { chord = { -24, -12, -5 }, droneVolume = 0.16, motifVolume = 0.2, tempo = 1 },
		TARDE = { chord = { -24, -12, -7 }, droneVolume = 0.13, motifVolume = 0.13, tempo = 1.05 },
		CIERRE = { chord = { -24, -13, -8 }, droneVolume = 0.24, motifVolume = 0.1, tempo = 0.8 },
		PROHIBIDA = { chord = { -25, -24, -13 }, droneVolume = 0.4, motifVolume = 0, tempo = 0.55 },
		RESULTS = { chord = { -24, -12, -5 }, droneVolume = 0.12, motifVolume = 0.14, tempo = 0.9 },
	},
}

-- ── Vestíbulo ───────────────────────────────────────────────────────────────
Config.Lobby = {
	-- El vestíbulo vive muy por encima del bazar para no cruzarse con nada.
	Origin = Vector3.new(0, 400, 0),
	ReadyCountdown = 12, -- segundos desde que hay alguien listo hasta empezar
	DeathReturnDelay = 6, -- segundos de pantalla de muerte antes de volver
}

-- ── Textos ───────────────────────────────────────────────────────────────────
Config.LocaleNames = {
	"Abarrotes Doña Mary",
	"Zapatería El Paso",
	"Papelería Lupita",
	"Farmacia San Judas",
	"Electrónica Kim",
	"Ropa y Novedades Karla",
	"Tortillería La Espiga",
	"Celulares y Accesorios GaMa",
	"Estética Unisex Rubí",
	"Regalos y Piñatas Chuy",
	"Herbolaria El Milagro",
	"Juguetería El Trompo",
}

Config.ViejoLines = {
	TARDE = {
		"¿Sabes qué hora es?",
		"¿Ya viste la hora, muchacho?",
		"Antes este bazar cerraba temprano...",
		"No te quedes hasta tarde. Hoy no.",
	},
	CIERRE = {
		"Ya van a cerrar. Vete a casa.",
		"No deberías estar afuera a esta hora.",
		"Después de las doce, no te conozco.",
		"Los que se quedan... se quedan.",
	},
}

Config.DeathMessages = {
	viejo = "A %s se lo llevó El Viejo.",
	corre = "%s corrió donde no debía.",
	noche = "%s no volvió a casa.",
	desconocido = "%s se perdió en el bazar.",
}

return Config
