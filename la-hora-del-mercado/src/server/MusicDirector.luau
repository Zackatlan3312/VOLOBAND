--!strict
-- Partitura adaptativa.
--
-- No hay archivos de música: el score se construye en vivo con lo que haya en
-- el banco de sonidos. Un sostenido cualquiera, bajado de tono y pasado por
-- reverberación y ecualizador, se convierte en un drone; una nota corta,
-- afinada por semitonos, toca el motivo del tema.
--
-- Así la música siempre suena, sin depender de subir audio a Roblox, y cambia
-- de carácter con cada fase: el motivo se va apagando conforme cae la noche
-- hasta que en la hora prohibida solo queda el drone.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)

local MusicDirector = {}

local rng = Random.new()
local voices: { Sound } = {}
local motifSound: Sound? = nil
local group: SoundGroup
local phase = "LOBBY"
local motifRunning = false

-- Semitonos → factor de velocidad de reproducción.
local function pitch(semitones: number): number
	return 2 ^ (semitones / 12)
end

local function settingsFor(name: string)
	return Config.Music.Phases[name] or Config.Music.Phases.LOBBY
end

function MusicDirector.init()
	-- Todo el score va por su propio SoundGroup: así la música tiene un
	-- volumen maestro independiente de los efectos del mundo.
	group = Instance.new("SoundGroup")
	group.Name = "LHM_Music"
	group.Volume = Config.Music.MasterVolume
	group.Parent = SoundService

	local reverb = Instance.new("ReverbSoundEffect")
	reverb.DecayTime = 9
	reverb.Density = 1
	reverb.Diffusion = 1
	reverb.DryLevel = -6
	reverb.WetLevel = 0
	reverb.Parent = group

	local eq = Instance.new("EqualizerSoundEffect")
	eq.LowGain = 6
	eq.MidGain = -9
	eq.HighGain = -22 -- quita el brillo: deja el sonido sordo y lejano
	eq.Parent = group

	-- Voces del acorde. Van en SoundService (no en el mundo), así que se oyen
	-- igual en todas partes, como una banda sonora y no como una fuente.
	local chord = settingsFor("LOBBY").chord
	for i = 1, #chord do
		local voice = SoundBank.make(SoundService, "Drone", {
			Volume = 0,
			Looped = true,
			PlaybackSpeed = pitch(chord[i]),
			Name = "Voz" .. i,
		})
		voice.SoundGroup = group
		voice:Play()
		table.insert(voices, voice)
	end

	motifSound = SoundBank.make(SoundService, "Note", { Volume = 0, Name = "Motivo" })
	;(motifSound :: Sound).SoundGroup = group

	MusicDirector.setPhase("LOBBY")
	MusicDirector.startMotif()
end

-- Toca el motivo del tema en bucle, con la afinación y el tempo de la fase.
function MusicDirector.startMotif()
	if motifRunning or not motifSound then
		return
	end
	motifRunning = true

	task.spawn(function()
		local note = motifSound :: Sound
		while motifRunning do
			local def = settingsFor(phase)
			if def.motifVolume <= 0 then
				-- En la hora prohibida el motivo calla: solo queda el drone.
				task.wait(1)
				continue
			end
			for _, step in Config.Music.Motif do
				if not motifRunning then
					break
				end
				local def2 = settingsFor(phase)
				local beat = Config.Music.NoteSeconds / math.max(def2.tempo, 0.1)
				if step ~= false and def2.motifVolume > 0 then
					note.PlaybackSpeed = pitch((step :: number) - 12)
					note.Volume = def2.motifVolume * rng:NextNumber(0.85, 1)
					note:Play()
				end
				task.wait(beat)
			end
			-- Respiro entre repeticiones para que no se vuelva machacón.
			task.wait(Config.Music.NoteSeconds * 2)
		end
	end)
end

function MusicDirector.setPhase(newPhase: string)
	phase = newPhase
	local def = settingsFor(newPhase)

	for i, voice in voices do
		local semitone = def.chord[i] or def.chord[#def.chord]
		-- El cambio de tono es lento a propósito: se siente como si el lugar
		-- entero se fuera hundiendo, no como un corte entre pistas.
		TweenService:Create(voice, TweenInfo.new(6, Enum.EasingStyle.Sine), {
			Volume = def.droneVolume * (i == 1 and 1 or 0.7),
			PlaybackSpeed = pitch(semitone),
		}):Play()
	end
end

-- Golpe puntual para los momentos fuertes (la medianoche, una muerte).
function MusicDirector.sting(semitone: number, volume: number?)
	local note = SoundBank.make(SoundService, "Drone", {
		Volume = volume or 0.5,
		PlaybackSpeed = pitch(semitone),
		Name = "Sting",
	})
	note.SoundGroup = group
	note:Play()
	note.Ended:Once(function()
		note:Destroy()
	end)
	task.delay(12, function()
		if note.Parent then
			note:Destroy()
		end
	end)
end

function MusicDirector.stop()
	motifRunning = false
	for _, voice in voices do
		voice:Stop()
		voice:Destroy()
	end
	table.clear(voices)
end

return MusicDirector
