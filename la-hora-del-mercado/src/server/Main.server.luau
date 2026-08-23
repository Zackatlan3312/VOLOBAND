--!strict
-- Punto de entrada del servidor de "La Hora del Mercado".

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local StarterPlayer = game:GetService("StarterPlayer")

-- Crear los remotos antes de que cualquier cliente los busque.
require(ReplicatedStorage.Shared.Remotes)
local Config = require(ReplicatedStorage.Shared.Config)

local MapBuilder = require(script.Parent.MapBuilder)
local LightingRig = require(script.Parent.LightingRig)
local PlayerSession = require(script.Parent.PlayerSession)
local NPCSystem = require(script.Parent.NPCSystem)
local Footsteps = require(script.Parent.Footsteps)
local Corre = require(script.Parent.Entities.Corre)
local GameLoop = require(script.Parent.GameLoop)

-- Los jugadores no reaparecen solos: el GameLoop decide cuándo y dónde.
Players.CharacterAutoLoads = false
Players.RespawnTime = 9999

pcall(function()
	SoundService.AmbientReverb = Enum.ReverbType.Hangar
	SoundService.DistanceFactor = 3.33
	StarterPlayer.CharacterWalkSpeed = Config.WalkSpeed
	StarterPlayer.CharacterJumpHeight = 0
	StarterPlayer.EnableMouseLockOption = false
end)

print(("[LaHoraDelMercado] v%s — construyendo el bazar..."):format(Config.Version))

local map = MapBuilder.build()
LightingRig.init(map)
PlayerSession.init(map)
Footsteps.init()
NPCSystem.init(map)
Corre.init(map)
GameLoop.start(map)

print("[LaHoraDelMercado] Listo. El bazar abre a las 18:00.")
