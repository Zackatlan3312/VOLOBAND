--!strict
-- Gestiona el vestíbulo: quién está esperando, quién dijo "yo entro", y el
-- ir y venir entre la vecindad y el bazar.
--
-- Decir que entras no es un botón: es pararte frente a la reja. El conteo de
-- listos cuelga sobre la zona, así que todos ven quién se está animando.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Remotes)
local PlayerSession = require(script.Parent.PlayerSession)

local LobbySystem = {}

local lobby: any
local spawnCounter = 0
local inLobby: { [Player]: boolean } = {}

function LobbySystem.init(builtLobby: any)
	lobby = builtLobby

	Players.PlayerRemoving:Connect(function(player)
		inLobby[player] = nil
	end)
end

-- Manda (o devuelve) a un jugador al vestíbulo.
function LobbySystem.send(player: Player)
	spawnCounter += 1
	inLobby[player] = true
	PlayerSession.spawnAt(player, lobby.spawnCFrame(spawnCounter))
	Remotes.get("RoundState"):FireClient(player, "LOBBY")
	Remotes.get("Objective"):FireClient(player, "Párate frente a la reja para entrar al siguiente turno.")
end

function LobbySystem.sendAll()
	for _, player in Players:GetPlayers() do
		LobbySystem.send(player)
	end
end

function LobbySystem.isInLobby(player: Player): boolean
	return inLobby[player] == true
end

function LobbySystem.markLeft(player: Player)
	inLobby[player] = false
end

-- Jugadores parados en la zona frente a la reja.
function LobbySystem.getReady(): { Player }
	local out = {}
	for _, player in Players:GetPlayers() do
		if not inLobby[player] then
			continue
		end
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if root and hum and hum.Health > 0 and lobby.contains(root.Position) then
			table.insert(out, player)
		end
	end
	return out
end

function LobbySystem.setGateOpen(open: boolean)
	lobby.setGateOpen(open)
end

-- Texto del cartel flotante sobre la zona de espera.
function LobbySystem.setReadyText(text: string)
	lobby.readyLabel.Text = text
end

-- Tablero de "última noche".
function LobbySystem.setResults(text: string)
	lobby.resultsLabel.Text = text
end

function LobbySystem.spawnCFrame(): CFrame
	spawnCounter += 1
	return lobby.spawnCFrame(spawnCounter)
end

return LobbySystem
