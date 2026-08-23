--!strict
-- NPCs civiles del bazar. Durante la TARDE deambulan entre puestos;
-- en el CIERRE muestran el "miedo colectivo": caminan rápido hacia la salida,
-- se detienen a mirar atrás y susurran. En la HORA PROHIBIDA ya no queda nadie.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)
local RigFactory = require(script.Parent.RigFactory)

local NPCSystem = {}

local map: any
local rng = Random.new()
local npcs: { { model: Model, humanoid: Humanoid, alive: boolean } } = {}
local phase = "TARDE"

local SKINS = {
	Color3.fromRGB(224, 187, 152),
	Color3.fromRGB(198, 158, 126),
	Color3.fromRGB(168, 126, 96),
	Color3.fromRGB(126, 92, 70),
}
local SHIRTS = {
	Color3.fromRGB(112, 128, 144),
	Color3.fromRGB(140, 100, 90),
	Color3.fromRGB(96, 118, 96),
	Color3.fromRGB(150, 140, 110),
	Color3.fromRGB(88, 96, 128),
}
local PANTS = {
	Color3.fromRGB(52, 56, 68),
	Color3.fromRGB(70, 62, 54),
	Color3.fromRGB(48, 66, 84),
}

-- La "salida" hacia la que huyen: el extremo este del pasillo principal.
local EXIT_POINT = Vector3.new(86, 0, 0)

local function randomPatrolPoint(): Vector3
	return map.patrolPoints[rng:NextInteger(1, #map.patrolPoints)]
end

local function moveTo(entry: any, target: Vector3, timeout: number): boolean
	if not entry.alive then
		return false
	end
	entry.humanoid:MoveTo(target)
	local reached = false
	local done = false
	local conn = entry.humanoid.MoveToFinished:Once(function(ok)
		reached = ok
		done = true
	end)
	local t0 = os.clock()
	while not done and os.clock() - t0 < timeout do
		task.wait(0.1)
		if not entry.alive then
			conn:Disconnect()
			return false
		end
	end
	conn:Disconnect()
	return reached
end

local function npcLoop(entry: any)
	local model = entry.model
	local humanoid = entry.humanoid

	while entry.alive and model.Parent do
		if phase == "TARDE" then
			humanoid.WalkSpeed = Config.NPC.WalkSpeed * rng:NextNumber(0.75, 1.1)
			local target = randomPatrolPoint() + Vector3.new(rng:NextNumber(-3, 3), 0, rng:NextNumber(-3, 3))
			moveTo(entry, target, 14)
			if entry.alive then
				task.wait(rng:NextNumber(1, 5)) -- se detiene a ver aparadores
			end
		elseif phase == "CIERRE" then
			-- Miedo colectivo: prisa, pausas para mirar atrás, susurros.
			humanoid.WalkSpeed = Config.NPC.FearSpeed * rng:NextNumber(0.9, 1.1)
			local root = model.PrimaryPart :: BasePart
			if rng:NextNumber() < 0.35 then
				-- Mira hacia atrás un instante.
				local back = root.Position - root.CFrame.LookVector * 4
				model:PivotTo(CFrame.lookAt(root.Position, Vector3.new(back.X, root.Position.Y, back.Z)))
				SoundBank.playAt(root.Position, "Whisper", 0.4, 26)
				task.wait(rng:NextNumber(0.6, 1.4))
			end
			moveTo(entry, EXIT_POINT + Vector3.new(rng:NextNumber(-3, 3), 0, rng:NextNumber(-4, 4)), 20)
			if entry.alive and model.PrimaryPart then
				local dist = ((model.PrimaryPart :: BasePart).Position - EXIT_POINT).Magnitude
				if dist < 10 then
					-- "Sale" del bazar: desaparece.
					entry.alive = false
					model:Destroy()
					return
				end
			end
		else
			-- PROHIBIDA: nadie debería seguir aquí.
			entry.alive = false
			model:Destroy()
			return
		end
	end
end

function NPCSystem.init(builtMap: any)
	map = builtMap
end

function NPCSystem.spawnAll()
	NPCSystem.cleanup()
	phase = "TARDE"
	for i = 1, Config.NPC.Count do
		local model, humanoid = RigFactory.create({
			name = "Vecino" .. i,
			skin = SKINS[rng:NextInteger(1, #SKINS)],
			shirt = SHIRTS[rng:NextInteger(1, #SHIRTS)],
			pants = PANTS[rng:NextInteger(1, #PANTS)],
			scale = rng:NextNumber(0.9, 1.05),
			walkSpeed = Config.NPC.WalkSpeed,
		})
		local spawnPos = map.npcSpawns[rng:NextInteger(1, #map.npcSpawns)]
		RigFactory.place(model, spawnPos)
		model.Parent = workspace

		local entry = { model = model, humanoid = humanoid, alive = true }
		table.insert(npcs, entry)
		task.spawn(npcLoop, entry)
	end
end

function NPCSystem.setPhase(newPhase: string)
	phase = newPhase
	if newPhase == "CIERRE" then
		-- Murmullo colectivo al anunciarse el cierre.
		for _, entry in npcs do
			if entry.alive and entry.model.PrimaryPart then
				if rng:NextNumber() < 0.4 then
					SoundBank.playAt((entry.model.PrimaryPart :: BasePart).Position, "Whisper", 0.5, 30)
				end
			end
		end
	end
end

function NPCSystem.cleanup()
	for _, entry in npcs do
		entry.alive = false
		if entry.model.Parent then
			entry.model:Destroy()
		end
	end
	table.clear(npcs)
end

return NPCSystem
