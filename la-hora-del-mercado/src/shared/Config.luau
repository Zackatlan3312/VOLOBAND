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

-- ── Sonidos ──────────────────────────────────────────────────────────────────
-- Ids de la biblioteca de audio de Roblox. Si alguno deja de estar disponible
-- el juego sigue funcionando (solo se pierde ese sonido); puedes sustituirlos
-- por cualquier otro id del Creator Marketplace.
Config.Sounds = {
	MallAmbience = "rbxassetid://9112854440",
	NightAmbience = "rbxassetid://9112764547",
	PersianaMove = "rbxassetid://9114221327",
	DoorCreak = "rbxassetid://9113905997",
	Whisper = "rbxassetid://9114653732",
	Heartbeat = "rbxassetid://9114519241",
	Breathing = "rbxassetid://9114362926",
	Scream = "rbxassetid://9114143633",
	Buzz = "rbxassetid://9112866662",
	Chime = "rbxassetid://9113651131",
	Snap = "rbxassetid://9114402044",
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
