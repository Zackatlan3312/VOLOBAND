--!strict
-- Crea rigs humanoides por código (NPCs y entidades).
--
-- Las extremidades cuelgan de Motor6D reales, no de soldaduras rígidas, y un
-- animador procedural las balancea según la velocidad del Humanoid. Así los
-- personajes caminan de verdad en lugar de deslizarse, que es lo que delata
-- de inmediato a un juego de Roblox sin animaciones.

local RunService = game:GetService("RunService")

local RigFactory = {}

export type RigOptions = {
	name: string?,
	skin: Color3?,
	shirt: Color3?,
	pants: Color3?,
	scale: number?,
	hunch: number?, -- inclinación del torso en grados (para El Viejo)
	walkSpeed: number?,
}

function RigFactory.create(options: RigOptions?): (Model, Humanoid)
	local opts: RigOptions = options or {}
	local scale = opts.scale or 1
	local skin = opts.skin or Color3.fromRGB(196, 158, 126)
	local shirt = opts.shirt or Color3.fromRGB(90, 98, 112)
	local pants = opts.pants or Color3.fromRGB(60, 62, 70)
	local hunch = math.rad(opts.hunch or 0)

	local legH = 2.6 * scale
	local torsoH = 2.6 * scale
	local torsoW = 2.1 * scale
	local headS = 1.15 * scale
	local armH = 2.3 * scale
	local armOut = torsoW / 2 + 0.4 * scale

	local model = Instance.new("Model")
	model.Name = opts.name or "Persona"

	local function mk(name: string, size: Vector3, cf: CFrame, color: Color3, transparency: number?): Part
		local p = Instance.new("Part")
		p.Name = name
		p.Size = size
		p.CFrame = cf
		p.Color = color
		p.Material = Enum.Material.SmoothPlastic
		p.Transparency = transparency or 0
		p.CanCollide = false
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.Parent = model
		return p
	end

	-- El origen del modelo tiene los pies en y = 0.
	local rootY = legH + torsoH / 2
	local root = mk("HumanoidRootPart", Vector3.new(torsoW, torsoH, 1.1 * scale), CFrame.new(0, rootY, 0), shirt, 1)
	root.CanCollide = true
	model.PrimaryPart = root

	-- Torso y cabeza van soldados al root (la joroba es fija).
	local torsoCF = CFrame.new(0, rootY, 0) * CFrame.Angles(hunch, 0, 0)
	local torso = mk("Torso", Vector3.new(torsoW, torsoH, 1.05 * scale), torsoCF, shirt)
	local head = mk("Head", Vector3.new(headS, headS, headS), torsoCF * CFrame.new(0, torsoH / 2 + headS / 2, 0), skin)
	for _, p in { torso, head } do
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = p
		weld.Parent = root
	end

	-- Extremidades articuladas. C0 se mide desde el centro del root y C1 desde
	-- el centro de la extremidad, ambos hasta la articulación.
	local function limb(name: string, size: Vector3, jointOffset: Vector3, color: Color3): Motor6D
		local halfLen = size.Y / 2
		local center = jointOffset - Vector3.new(0, halfLen, 0)
		local p = mk(name, size, CFrame.new(center), color)

		local motor = Instance.new("Motor6D")
		motor.Name = name .. "Joint"
		motor.Part0 = root
		motor.Part1 = p
		motor.C0 = CFrame.new(jointOffset - Vector3.new(0, rootY, 0))
		motor.C1 = CFrame.new(0, halfLen, 0)
		motor.Parent = root
		return motor
	end

	local legSize = Vector3.new(0.85 * scale, legH, 0.85 * scale)
	local armSize = Vector3.new(0.65 * scale, armH, 0.65 * scale)
	local shoulderY = legH + torsoH - 0.3 * scale

	local legL = limb("PiernaIzq", legSize, Vector3.new(-torsoW / 4, legH, 0), pants)
	local legR = limb("PiernaDer", legSize, Vector3.new(torsoW / 4, legH, 0), pants)
	local armL = limb("BrazoIzq", armSize, Vector3.new(-armOut, shoulderY, 0), shirt)
	local armR = limb("BrazoDer", armSize, Vector3.new(armOut, shoulderY, 0), shirt)

	local humanoid = Instance.new("Humanoid")
	humanoid.RequiresNeck = false
	humanoid.HipHeight = legH
	humanoid.WalkSpeed = opts.walkSpeed or 8
	humanoid.MaxHealth = 100
	humanoid.Health = 100
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	humanoid:SetStateEnabled(Enum.HumanoidStateType.Climbing, false)
	humanoid:SetStateEnabled(Enum.HumanoidStateType.FallingDown, false)
	humanoid:SetStateEnabled(Enum.HumanoidStateType.Ragdoll, false)
	humanoid.Parent = model

	RigFactory.animate(model, humanoid, root, { legL, legR, armL, armR }, hunch)

	return model, humanoid
end

-- Animador procedural: balancea las extremidades en función de la velocidad
-- real del rig. `Motor6D.Transform` se replica solo desde el servidor.
function RigFactory.animate(model: Model, humanoid: Humanoid, root: BasePart, motors: { Motor6D }, hunch: number)
	local legL, legR, armL, armR = motors[1], motors[2], motors[3], motors[4]
	local phase = 0
	local amount = 0
	local alive = true
	model.Destroying:Once(function()
		alive = false
	end)

	local conn
	conn = RunService.Heartbeat:Connect(function(dt)
		if not alive or humanoid.Health <= 0 then
			conn:Disconnect()
			return
		end
		-- `create` aún no ha parentado el modelo: espera sin cortar el bucle.
		if not model.Parent then
			return
		end

		local v = root.AssemblyLinearVelocity
		local speed = Vector3.new(v.X, 0, v.Z).Magnitude

		-- La amplitud sube y baja suavemente para que arrancar y frenar no
		-- corten el paso de golpe.
		local target = math.clamp(speed / 11, 0, 1)
		amount += (target - amount) * math.min(dt * 6, 1)
		phase += dt * math.max(speed, 0.1) * 0.95

		local swing = math.sin(phase) * amount * 0.75
		-- Los brazos van contrapeados y con menos recorrido que las piernas.
		local armSwing = -swing * 0.65 + hunch * 0.5

		legL.Transform = CFrame.Angles(swing, 0, 0)
		legR.Transform = CFrame.Angles(-swing, 0, 0)
		armL.Transform = CFrame.Angles(armSwing, 0, 0)
		armR.Transform = CFrame.Angles(-armSwing + hunch, 0, 0)
	end)
end

-- Coloca el rig con los pies sobre la posición dada.
function RigFactory.place(model: Model, position: Vector3, lookAt: Vector3?)
	local root = model.PrimaryPart :: BasePart
	local humanoid = model:FindFirstChildOfClass("Humanoid") :: Humanoid
	local hip = root.Size.Y / 2 + humanoid.HipHeight
	local target = Vector3.new(position.X, position.Y + hip, position.Z)
	local cf
	if lookAt then
		cf = CFrame.lookAt(target, Vector3.new(lookAt.X, target.Y, lookAt.Z))
	else
		cf = CFrame.new(target)
	end
	model:PivotTo(cf)
end

return RigFactory
