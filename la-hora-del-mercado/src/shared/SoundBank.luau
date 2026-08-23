--!strict
-- Banco de sonidos con resolución verificada.
--
-- El problema que resuelve: un id de audio puede fallar por privacidad, por
-- tipo equivocado o porque ya no existe, y Roblox lo reporta en cada intento
-- de reproducción — llenando la consola y dejando el juego mudo sin avisar.
--
-- Aquí cada sonido lógico ("cue") tiene varios candidatos. Al arrancar, el
-- servidor los precarga UNA vez, se queda con el primero que cargó de verdad
-- y publica el resultado en ReplicatedStorage para que el cliente use el mismo.
-- Si un cue no resuelve, se reporta una sola vez y ese sonido queda en
-- silencio, sin repetir el error nunca más.

local ContentProvider = game:GetService("ContentProvider")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(script.Parent.Config)

local SoundBank = {}

local resolved: { [string]: string } = {}
local ready = false

local FOLDER_NAME = "LHMSoundBank"

-- ── Resolución (servidor) ────────────────────────────────────────────────────

local function candidatesFor(cue: string): { string }
	local override = Config.SoundOverrides[cue]
	if override then
		return { override }
	end
	return Config.SoundCues[cue] or {}
end

function SoundBank.initServer()
	local holder = Instance.new("Folder")
	holder.Name = "SoundProbe"
	holder.Parent = ReplicatedStorage

	-- Una instancia por id único, para precargarlos todos de una sola vez.
	local probes: { [string]: Sound } = {}
	local batch: { Instance } = {}
	for cue in Config.SoundCues do
		for _, id in candidatesFor(cue) do
			if not probes[id] then
				local probe = Instance.new("Sound")
				probe.SoundId = id
				probe.Parent = holder
				probes[id] = probe
				table.insert(batch, probe)
			end
		end
	end

	-- PreloadAsync avisa de cada asset inválido; el pcall lo absorbe y luego
	-- preguntamos a cada Sound si realmente cargó. Esto ocurre UNA vez al
	-- arrancar, en vez de fallar en cada reproducción como pasaría si
	-- confiáramos a ciegas en los ids.
	local preloadOk = pcall(function()
		ContentProvider:PreloadAsync(batch)
	end)
	task.wait() -- deja asentar el estado de carga antes de preguntar

	local missing: { string } = {}
	for cue in Config.SoundCues do
		local candidates = candidatesFor(cue)
		for _, id in candidates do
			local probe = probes[id]
			if probe and probe.IsLoaded then
				resolved[cue] = id
				break
			end
		end
		if not resolved[cue] then
			if not preloadOk and candidates[1] then
				-- La precarga no llegó a correr, así que no sabemos nada de
				-- estos ids. Mejor intentar el primero que quedarnos mudos.
				resolved[cue] = candidates[1]
			else
				table.insert(missing, cue)
			end
		end
	end

	holder:Destroy()

	-- Publica el resultado para el cliente.
	local folder = Instance.new("Folder")
	folder.Name = FOLDER_NAME
	for cue, id in resolved do
		local value = Instance.new("StringValue")
		value.Name = cue
		value.Value = id
		value.Parent = folder
	end
	folder.Parent = ReplicatedStorage

	ready = true

	local total = 0
	for _ in Config.SoundCues do
		total += 1
	end
	print(("[LaHoraDelMercado] Audio: %d/%d sonidos resueltos."):format(total - #missing, total))
	if #missing > 0 then
		table.sort(missing)
		warn(
			"[LaHoraDelMercado] Sin audio disponible para: "
				.. table.concat(missing, ", ")
				.. ". Esos efectos quedan en silencio. Para arreglarlo, pon tus propios ids en Config.SoundOverrides."
		)
	end
end

-- ── Resolución (cliente) ─────────────────────────────────────────────────────

function SoundBank.initClient()
	local folder = ReplicatedStorage:WaitForChild(FOLDER_NAME, 30)
	if not folder then
		return
	end
	for _, value in folder:GetChildren() do
		if value:IsA("StringValue") then
			resolved[value.Name] = value.Value
		end
	end
	ready = true
end

function SoundBank.init()
	if RunService:IsServer() then
		SoundBank.initServer()
	else
		SoundBank.initClient()
	end
end

-- ── API ──────────────────────────────────────────────────────────────────────

-- Id resuelto de un cue, o nil si ninguno de sus candidatos cargó.
function SoundBank.get(cue: string): string?
	return resolved[cue]
end

export type SoundProps = {
	Volume: number?,
	Looped: boolean?,
	PlaybackSpeed: number?,
	RollOffMaxDistance: number?,
	RollOffMinDistance: number?,
	Name: string?,
}

-- Crea un Sound para un cue.
--
-- Si el cue no resolvió, devuelve un Sound mudo (sin SoundId) en vez de nil:
-- `:Play()` sobre él no hace nada ni escribe en la consola. Así ningún sitio
-- de llamada necesita comprobar nil, y que falte un audio nunca puede tumbar
-- una entidad ni una puerta.
function SoundBank.make(parent: Instance, cue: string, props: SoundProps?): Sound
	local sound = Instance.new("Sound")
	sound.SoundId = resolved[cue] or ""
	sound.Volume = props and props.Volume or 0.5
	sound.Looped = props and props.Looped or false
	sound.PlaybackSpeed = props and props.PlaybackSpeed or 1
	sound.RollOffMaxDistance = props and props.RollOffMaxDistance or 60
	sound.RollOffMinDistance = props and props.RollOffMinDistance or 6
	sound.RollOffMode = Enum.RollOffMode.InverseTapered
	sound.Name = props and props.Name or cue
	sound.Parent = parent
	return sound
end

-- Reproduce un cue en una posición del mundo y limpia solo.
function SoundBank.playAt(position: Vector3, cue: string, volume: number?, rollOffMax: number?, playbackSpeed: number?)
	if not resolved[cue] then
		return
	end
	local holder = Instance.new("Part")
	holder.Anchored = true
	holder.CanCollide = false
	holder.CanQuery = false
	holder.CanTouch = false
	holder.Transparency = 1
	holder.Size = Vector3.new(0.5, 0.5, 0.5)
	holder.Position = position
	holder.Parent = workspace

	local sound = SoundBank.make(holder, cue, {
		Volume = volume or 0.7,
		RollOffMaxDistance = rollOffMax or 70,
		PlaybackSpeed = playbackSpeed or 1,
	})
	sound.Ended:Once(function()
		holder:Destroy()
	end)
	sound:Play()
	-- Red de seguridad por si Ended nunca llega (sonido en bucle o cortado).
	task.delay(15, function()
		if holder.Parent then
			holder:Destroy()
		end
	end)
end

function SoundBank.isReady(): boolean
	return ready
end

return SoundBank
