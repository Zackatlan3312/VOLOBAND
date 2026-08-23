--!strict
-- Estado por jugador: departamento asignado, encargo, ruido, vida y muerte.
-- También gestiona sprint, linterna y la preparación de cada personaje.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)

local PlayerSession = {}

export type State = {
	aptIndex: number?,
	hasPackage: boolean,
	safe: boolean,
	dead: boolean,
	deathCause: string?,
	noise: number,
	sprinting: boolean,
	flashlight: SpotLight?,
}

local states: { [Player]: State } = {}
local map: any

-- Lo asigna GameLoop: se llama cuando alguien muere, con (jugador, causa).
PlayerSession.onDeath = nil :: ((Player, string) -> ())?

local function newState(): State
	return {
		aptIndex = nil,
		hasPackage = false,
		safe = false,
		dead = false,
		deathCause = nil,
		noise = 0,
		sprinting = false,
		flashlight = nil,
	}
end

function PlayerSession.get(player: Player): State
	local st = states[player]
	if not st then
		st = newState()
		states[player] = st
	end
	return st
end

function PlayerSession.alivePlayers(): { Player }
	local out = {}
	for _, player in Players:GetPlayers() do
		local st = states[player]
		local char = player.Character
		if st and not st.dead and not st.safe and char and char.Parent then
			local hum = char:FindFirstChildOfClass("Humanoid")
			if hum and hum.Health > 0 then
				table.insert(out, player)
			end
		end
	end
	return out
end

function PlayerSession.addNoise(player: Player, amount: number)
	local st = PlayerSession.get(player)
	st.noise = math.min(Config.Noise.Max, st.noise + amount)
end

-- ── Muerte ───────────────────────────────────────────────────────────────────

function PlayerSession.kill(player: Player, cause: string)
	local st = PlayerSession.get(player)
	if st.dead then
		return
	end
	st.dead = true
	st.deathCause = cause

	local char = player.Character
	if char then
		local hum = char:FindFirstChildOfClass("Humanoid")
		if hum and hum.Health > 0 then
			hum.Health = 0
		end
		local root = char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root then
			SoundBank.playAt(root.Position, "Scream", 0.8, 120)
		end
	end

	player.CameraMode = Enum.CameraMode.Classic
	Remotes.get("Death"):FireClient(player, cause)

	local template = Config.DeathMessages[cause] or Config.DeathMessages.desconocido
	Remotes.get("Toast"):FireAllClients(string.format(template, player.DisplayName), "death")

	-- El GameLoop se engancha aquí para devolver al jugador al vestíbulo.
	if PlayerSession.onDeath then
		task.spawn(PlayerSession.onDeath, player, cause)
	end
end

-- ── Preparación del personaje ────────────────────────────────────────────────

local function setupCharacter(player: Player, char: Model)
	local hum = char:WaitForChild("Humanoid", 10) :: Humanoid?
	if not hum then
		return
	end
	hum.WalkSpeed = Config.WalkSpeed
	hum.UseJumpPower = false
	hum.JumpHeight = 0 -- sin saltos: caminamos como personas
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	player.CameraMode = Enum.CameraMode.LockFirstPerson

	hum.Died:Connect(function()
		-- Al empezar una ronda nueva se destruye el personaje anterior; ignora
		-- ese Died tardío para no marcar muerto a quien acaba de reaparecer.
		if player.Character ~= char then
			return
		end
		local st = PlayerSession.get(player)
		if not st.dead then
			-- Muerte por causas ajenas a las entidades (caídas, etc.).
			PlayerSession.kill(player, "desconocido")
		end
	end)
end

-- Reaparece al jugador en su departamento asignado.
function PlayerSession.spawnAt(player: Player, cframe: CFrame)
	player:LoadCharacter()
	local char = player.Character or player.CharacterAdded:Wait()
	setupCharacter(player, char)
	local root = char:WaitForChild("HumanoidRootPart", 10) :: BasePart?
	if root then
		char:PivotTo(cframe)
	end
end

-- ── Reset de ronda ───────────────────────────────────────────────────────────

function PlayerSession.resetAll()
	for _, st in states do
		st.hasPackage = false
		st.safe = false
		st.dead = false
		st.deathCause = nil
		st.noise = 0
		st.sprinting = false
		st.flashlight = nil
	end
end

function PlayerSession.remove(player: Player)
	states[player] = nil
end

-- ── Inicio ───────────────────────────────────────────────────────────────────

function PlayerSession.init(builtMap: any)
	map = builtMap

	-- El mapa avisa cuando alguien usa puertas o persianas: eso es ruido.
	map.onDoorUsed = function(player: Player, _pos: Vector3)
		PlayerSession.addNoise(player, Config.Noise.Door)
	end
	map.onPersianaUsed = function(player: Player, _pos: Vector3)
		PlayerSession.addNoise(player, Config.Noise.Persiana)
	end

	-- Sprint: el servidor es quien fija la velocidad (evita exploits simples).
	Remotes.get("SprintRequest").OnServerEvent:Connect(function(player: Player, wants: any)
		local st = PlayerSession.get(player)
		st.sprinting = wants == true
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if hum and hum.Health > 0 then
			hum.WalkSpeed = st.sprinting and Config.SprintSpeed or Config.WalkSpeed
		end
	end)

	-- Linterna en la cabeza, visible para todos.
	Remotes.get("FlashlightRequest").OnServerEvent:Connect(function(player: Player)
		local st = PlayerSession.get(player)
		local char = player.Character
		local head = char and char:FindFirstChild("Head")
		if not head then
			return
		end
		if st.flashlight and st.flashlight.Parent then
			st.flashlight:Destroy()
			st.flashlight = nil
		else
			local spot = Instance.new("SpotLight")
			spot.Name = "Linterna"
			spot.Angle = 55
			spot.Brightness = 1.6
			spot.Range = 34
			spot.Color = Color3.fromRGB(255, 246, 220)
			spot.Face = Enum.NormalId.Front
			spot.Shadows = true
			spot.Parent = head
			st.flashlight = spot
		end
		SoundBank.playAt((head :: BasePart).Position, "Step", 0.3, 25)
	end)

	-- Bucle de ruido: correr genera ruido; todo ruido se disipa con el tiempo.
	task.spawn(function()
		while true do
			task.wait(0.25)
			for _, player in Players:GetPlayers() do
				local st = states[player]
				if not st then
					continue
				end
				local char = player.Character
				local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
				if root and not st.dead then
					local v = root.AssemblyLinearVelocity
					local speed = Vector3.new(v.X, 0, v.Z).Magnitude
					if speed > Config.WalkSpeed + 1 then
						st.noise += Config.Noise.RunPerSecond * 0.25
					end
					st.noise = math.max(0, math.min(Config.Noise.Max, st.noise - Config.Noise.Decay * 0.25))
					char:SetAttribute("Noise", st.noise)
				end
			end
		end
	end)

	Players.PlayerRemoving:Connect(PlayerSession.remove)
end

return PlayerSession
