--!strict
-- Cliente de "La Hora del Mercado": controles, HUD, efectos y modo espectador.
--
-- Controles:
--   Shift  — correr (ruidoso; mortal dentro de un sello de Corre)
--   F      — linterna
--   Clic   — al estar muerto, cambia entre los compañeros que siguen vivos

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared:WaitForChild("Remotes"))
local SoundBank = require(Shared:WaitForChild("SoundBank"))

local HUD = require(script.Parent.HUD)
local Camera = require(script.Parent.Camera)
local Effects = require(script.Parent.Effects)

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

local isDead = false
local spectateIndex = 0

-- El banco replica del servidor qué audio resolvió de verdad.
SoundBank.init()

HUD.init()
Camera.init()
Effects.init(HUD.subtitle)
HUD.showIntro()
HUD.setObjective("Cargando…")

-- Avisa al servidor de que ya escuchamos, para que nos ponga al día. Sin esto,
-- un jugador que entra justo antes de que arranque su LocalScript se perdería
-- el estado inicial y se quedaría con el HUD vacío.
task.defer(function()
	Remotes.get("Hello"):FireServer()
end)

-- ── Entrada ──────────────────────────────────────────────────────────────────

local function setSprinting(value: boolean)
	if isDead then
		return
	end
	Camera.setSprinting(value)
	Remotes.get("SprintRequest"):FireServer(value)
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift then
		setSprinting(true)
	elseif input.KeyCode == Enum.KeyCode.F then
		if not isDead then
			Remotes.get("FlashlightRequest"):FireServer()
		end
	elseif input.UserInputType == Enum.UserInputType.MouseButton1 and isDead then
		-- Cambia de compañero al que observar.
		local alive = {}
		for _, other in Players:GetPlayers() do
			local char = other.Character
			local hum = char and char:FindFirstChildOfClass("Humanoid")
			if other ~= player and hum and hum.Health > 0 then
				table.insert(alive, other)
			end
		end
		if #alive > 0 then
			spectateIndex = (spectateIndex % #alive) + 1
			local target = alive[spectateIndex]
			local hum = target.Character and target.Character:FindFirstChildOfClass("Humanoid")
			if hum then
				camera.CameraSubject = hum
			end
		end
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift or input.KeyCode == Enum.KeyCode.RightShift then
		setSprinting(false)
	end
end)

-- El móvil no tiene Shift: correr se activa manteniendo el toque en marcha.
if UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled then
	UserInputService.TouchLongPress:Connect(function(_positions, state)
		if state == Enum.UserInputState.Begin then
			setSprinting(true)
		elseif state == Enum.UserInputState.End or state == Enum.UserInputState.Cancel then
			setSprinting(false)
		end
	end)
end

-- ── Remotos ──────────────────────────────────────────────────────────────────

Remotes.get("Clock").OnClientEvent:Connect(HUD.setClock)
Remotes.get("Toast").OnClientEvent:Connect(HUD.toast)
Remotes.get("Objective").OnClientEvent:Connect(HUD.setObjective)
Remotes.get("Subtitle").OnClientEvent:Connect(HUD.subtitle)

Remotes.get("Phase").OnClientEvent:Connect(function(phase: string)
	HUD.setPhase(phase)
	Effects.setPhase(phase)
	if phase == "PROHIBIDA" then
		Camera.shake(0.5)
	end
end)

Remotes.get("Death").OnClientEvent:Connect(function(cause: string)
	isDead = true
	spectateIndex = 0
	Camera.setSprinting(false)
	Effects.jumpscare()
	HUD.showDeath(cause)
	HUD.setObjective("")
end)

Remotes.get("RoundState").OnClientEvent:Connect(function(state: string)
	if state == "LOBBY" then
		-- De vuelta en la vecindad: sin reloj, sin muerte en pantalla.
		isDead = false
		spectateIndex = 0
		HUD.hideDeath()
		HUD.setLobby(true)
		return
	end
	if state == "SPECTATE" then
		-- Entró a mitad de ronda: sin personaje, pero puede seguir a los demás.
		isDead = true
		spectateIndex = 0
		HUD.hideDeath()
		HUD.setObjective("Estás observando. Entrarás en la siguiente ronda. Clic para cambiar de vista.")
		return
	end
	if state == "INTERMISSION" or state == "ROUND" then
		isDead = false
		HUD.hideDeath()
		HUD.setLobby(false)
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if hum then
			camera.CameraSubject = hum
		end
	end
	if state == "ROUND" then
		HUD.showIntro()
	end
end)

-- Al reaparecer, la cámara vuelve al propio personaje.
player.CharacterAdded:Connect(function(char)
	local hum = char:WaitForChild("Humanoid", 10)
	if hum then
		camera.CameraSubject = hum
		isDead = false
		HUD.hideDeath()
	end
end)
