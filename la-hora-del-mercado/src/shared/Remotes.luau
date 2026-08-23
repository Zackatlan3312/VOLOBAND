--!strict
-- Crea (en el servidor) o localiza (en el cliente) los RemoteEvents del juego.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local NAMES = {
	"Toast", -- (mensaje, tipo) avisos en pantalla
	"Phase", -- (nombreFase)
	"Clock", -- (hh, mm)
	"Objective", -- (texto) objetivo personal
	"Death", -- (causa) al jugador que murió
	"RoundState", -- ("LOBBY" | "ROUND" | "RESULTS" | "SPECTATE")
	"Subtitle", -- (texto) susurros / narrativa ambiental
	"SprintRequest", -- cliente → servidor (bool)
	"FlashlightRequest", -- cliente → servidor
	"Hello", -- cliente → servidor: "ya estoy escuchando, dime en qué punto vamos"
}

local folder: Folder

if RunService:IsServer() then
	folder = Instance.new("Folder")
	folder.Name = "LHMRemotes"
	for _, name in NAMES do
		local remote = Instance.new("RemoteEvent")
		remote.Name = name
		remote.Parent = folder
	end
	folder.Parent = ReplicatedStorage
else
	folder = ReplicatedStorage:WaitForChild("LHMRemotes") :: Folder
end

local Remotes = {}

function Remotes.get(name: string): RemoteEvent
	return folder:WaitForChild(name) :: RemoteEvent
end

return Remotes
