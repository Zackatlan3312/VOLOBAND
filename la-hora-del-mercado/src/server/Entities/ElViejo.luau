--!strict
-- EL VIEJO.
-- Antes de la hora prohibida deambula por el bazar, se acerca a los jugadores,
-- pregunta la hora y advierte que no deberían estar afuera. Cuando el reloj
-- marca las 23:59 comienza la cacería: persigue a la presa más ruidosa/cercana
-- usando pathfinding, acecha frente a los refugios y mata por contacto.

local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundUtil = require(ReplicatedStorage.Shared.SoundUtil)
local RigFactory = require(script.Parent.Parent.RigFactory)
local PlayerSession = require(script.Parent.Parent.PlayerSession)

local ElViejo = {}
ElViejo.__index = ElViejo

local rng = Random.new()

local function makeBillboard(head: BasePart): TextLabel
	local gui = Instance.new("BillboardGui")
	gui.Name = "Dialogo"
	gui.Size = UDim2.fromOffset(340, 60)
	gui.StudsOffset = Vector3.new(0, 2.6, 0)
	gui.MaxDistance = 45
	gui.AlwaysOnTop = false
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Merriweather
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(226, 219, 200)
	label.TextStrokeTransparency = 0.4
	label.Text = ""
	label.Visible = false
	label.Parent = gui
	gui.Parent = head
	return label
end

function ElViejo.new(map: any)
	local self = setmetatable({}, ElViejo)
	self.map = map
	self.mode = "PASSIVE" -- PASSIVE | HUNT | DEAD
	self.phase = "TARDE"
	self.alive = true
	self.huntStart = 0

	local model, humanoid = RigFactory.create({
		name = "ElViejo",
		skin = Color3.fromRGB(172, 160, 148),
		shirt = Color3.fromRGB(74, 72, 68),
		pants = Color3.fromRGB(48, 46, 44),
		scale = 1.12,
		hunch = 14,
		walkSpeed = Config.Viejo.WalkSpeed,
	})
	self.model = model
	self.humanoid = humanoid
	self.root = model.PrimaryPart :: BasePart
	model:SetAttribute("Hunting", false)

	local head = model:FindFirstChild("Head") :: BasePart
	self.dialog = makeBillboard(head)
	self.breath = SoundUtil.make(self.root, Config.Sounds.Breathing, {
		Volume = 0,
		Looped = true,
		RollOffMaxDistance = 40,
		RollOffMinDistance = 4,
		Name = "Respiracion",
	})
	self.breath:Play()
	self.steps = SoundUtil.make(self.root, Config.Sounds.Snap, {
		Volume = 0.25,
		RollOffMaxDistance = 50,
		Name = "Pasos",
	})

	RigFactory.place(model, Vector3.new(map.viejoSpawn.X, 0, map.viejoSpawn.Z))
	model.Parent = workspace

	task.spawn(function()
		self:_run()
	end)
	task.spawn(function()
		self:_killLoop()
	end)
	task.spawn(function()
		self:_stepLoop()
	end)

	return self
end

function ElViejo:setPhase(phase: string)
	self.phase = phase
	if phase == "PROHIBIDA" and self.mode == "PASSIVE" then
		self.mode = "HUNT"
		self.huntStart = os.clock()
		self.model:SetAttribute("Hunting", true)
		self.breath.Volume = 0.65
		SoundUtil.playAt(self.root.Position, Config.Sounds.Scream, 0.9, 250)
		self:_say("Ya es hora.")
	end
end

function ElViejo:_say(text: string)
	self.dialog.Text = text
	self.dialog.Visible = true
	task.delay(4, function()
		if self.dialog.Text == text then
			self.dialog.Visible = false
		end
	end)
end

-- ── Utilidades de movimiento ─────────────────────────────────────────────────

function ElViejo:_computePath(target: Vector3): { PathWaypoint }?
	local path = PathfindingService:CreatePath({
		AgentRadius = 2.2,
		AgentHeight = 7,
		AgentCanJump = false,
		WaypointSpacing = 6,
	})
	local ok = pcall(function()
		path:ComputeAsync(self.root.Position, target)
	end)
	if ok and path.Status == Enum.PathStatus.Success then
		return path:GetWaypoints()
	end
	return nil
end

function ElViejo:_walkPath(target: Vector3, timeout: number, stopIf: (() -> boolean)?): boolean
	local waypoints = self:_computePath(target)
	local t0 = os.clock()
	if not waypoints then
		-- Sin ruta: intenta ir directo (los pasillos son amplios).
		self.humanoid:MoveTo(target)
		while os.clock() - t0 < math.min(timeout, 3) do
			task.wait(0.15)
			if not self.alive or (stopIf and stopIf()) then
				return false
			end
			if (self.root.Position - target).Magnitude < 4 then
				return true
			end
		end
		return false
	end

	for i = 2, #waypoints do
		local wp = waypoints[i]
		self.humanoid:MoveTo(wp.Position)
		local reachedT0 = os.clock()
		while true do
			task.wait(0.1)
			if not self.alive or (stopIf and stopIf()) then
				return false
			end
			local flat = self.root.Position - wp.Position
			if Vector2.new(flat.X, flat.Z).Magnitude < 3 then
				break
			end
			if os.clock() - reachedT0 > 3 or os.clock() - t0 > timeout then
				return false
			end
		end
	end
	return true
end

-- ── Comportamiento pasivo (TARDE / CIERRE) ───────────────────────────────────

function ElViejo:_approachSomeone()
	local candidates = PlayerSession.alivePlayers()
	if #candidates == 0 then
		return
	end
	local target = candidates[rng:NextInteger(1, #candidates)]
	local char = target.Character
	local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then
		return
	end
	if (root.Position - self.root.Position).Magnitude > 110 then
		return
	end

	self:_walkPath(root.Position, 25, function()
		return self.mode ~= "PASSIVE"
	end)
	if self.mode ~= "PASSIVE" or not root.Parent then
		return
	end

	-- Encara al jugador y suelta una de sus frases.
	local look = CFrame.lookAt(self.root.Position, Vector3.new(root.Position.X, self.root.Position.Y, root.Position.Z))
	self.model:PivotTo(look)
	local lines = Config.ViejoLines[self.phase] or Config.ViejoLines.TARDE
	self:_say(lines[rng:NextInteger(1, #lines)])
	SoundUtil.playAt(self.root.Position, Config.Sounds.Whisper, 0.5, 30)
	task.wait(4)
end

-- ── Cacería (PROHIBIDA) ──────────────────────────────────────────────────────

function ElViejo:_pickPrey(): (Player?, BasePart?)
	local best: Player? = nil
	local bestRoot: BasePart? = nil
	local bestScore = math.huge
	for _, player in PlayerSession.alivePlayers() do
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not root then
			continue
		end
		if self.map.isInRefuge(root.Position) then
			continue -- dentro de un refugio no lo puede alcanzar... por ahora
		end
		local noise = (char :: Model):GetAttribute("Noise") or 0
		local score = (root.Position - self.root.Position).Magnitude - (noise :: number) * Config.Viejo.NoiseWeight
		if score < bestScore then
			bestScore = score
			best = player
			bestRoot = root
		end
	end
	return best, bestRoot
end

function ElViejo:_huntSpeed(): number
	local t = math.clamp((os.clock() - self.huntStart) / Config.Viejo.HuntRampTime, 0, 1)
	return Config.Viejo.HuntSpeedStart + (Config.Viejo.HuntSpeedEnd - Config.Viejo.HuntSpeedStart) * t
end

function ElViejo:_hunt()
	self.humanoid.WalkSpeed = self:_huntSpeed()
	local prey, preyRoot = self:_pickPrey()

	if not prey or not preyRoot then
		-- Todos escondidos: acecha el refugio del jugador vivo más cercano.
		local nearest: BasePart? = nil
		local nearestDist = math.huge
		for _, player in PlayerSession.alivePlayers() do
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
			if root then
				local d = (root.Position - self.root.Position).Magnitude
				if d < nearestDist then
					nearestDist = d
					nearest = root
				end
			end
		end
		if nearest then
			-- Camina hasta cerca del refugio y espera, respirando.
			local outside = nearest.Position + (self.root.Position - nearest.Position).Unit * 8
			self:_walkPath(outside, 12, function()
				return self.mode ~= "HUNT"
			end)
			self.breath.Volume = 0.9
			task.wait(Config.Viejo.LurkTime)
			self.breath.Volume = 0.65
		else
			task.wait(1)
		end
		return
	end

	-- Persecución con recálculo de ruta.
	local lastKnown = preyRoot.Position
	self:_walkPath(lastKnown, Config.Viejo.RepathInterval + 1.2, function()
		if self.mode ~= "HUNT" then
			return true
		end
		-- Si la presa se movió bastante, corta y recalcula.
		return preyRoot.Parent ~= nil and (preyRoot.Position - lastKnown).Magnitude > 7
	end)
end

-- ── Bucles principales ───────────────────────────────────────────────────────

function ElViejo:_run()
	local nextApproach = os.clock() + rng:NextNumber(6, 12)
	while self.alive do
		if self.mode == "PASSIVE" then
			self.humanoid.WalkSpeed = Config.Viejo.WalkSpeed
			if os.clock() >= nextApproach then
				self:_approachSomeone()
				nextApproach = os.clock() + rng:NextNumber(Config.Viejo.ApproachIntervalMin, Config.Viejo.ApproachIntervalMax)
			else
				local p = self.map.patrolPoints[rng:NextInteger(1, #self.map.patrolPoints)]
				self:_walkPath(p, 14, function()
					return self.mode ~= "PASSIVE" or os.clock() >= nextApproach
				end)
			end
		elseif self.mode == "HUNT" then
			self:_hunt()
		else
			break
		end
		task.wait(0.1)
	end
end

function ElViejo:_killLoop()
	while self.alive do
		task.wait(0.12)
		if self.mode ~= "HUNT" then
			continue
		end
		for _, player in PlayerSession.alivePlayers() do
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
			if not root then
				continue
			end
			if self.map.isInRefuge(root.Position) then
				continue
			end
			if (root.Position - self.root.Position).Magnitude <= Config.Viejo.KillRadius then
				PlayerSession.kill(player, "viejo")
			end
		end
	end
end

-- Pasos audibles: el peligro se anuncia por el oído.
function ElViejo:_stepLoop()
	while self.alive do
		local speed = self.humanoid.WalkSpeed
		local moving = self.root.AssemblyLinearVelocity.Magnitude > 1
		if moving then
			self.steps.PlaybackSpeed = self.mode == "HUNT" and 1.15 or 0.8
			self.steps.Volume = self.mode == "HUNT" and 0.5 or 0.25
			self.steps:Play()
		end
		task.wait(moving and math.clamp(6 / math.max(speed, 1), 0.28, 0.9) or 0.4)
	end
end

function ElViejo:destroy()
	self.alive = false
	self.mode = "DEAD"
	if self.model.Parent then
		self.model:Destroy()
	end
end

return ElViejo
