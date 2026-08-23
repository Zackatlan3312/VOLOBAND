--!strict
-- Efectos sensoriales del cliente: viñeta de tensión, latido cuando El Viejo
-- caza cerca, sacudida al morir y susurro local al pisar un sello de Corre.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local SoundUtil = require(ReplicatedStorage.Shared.SoundUtil)
local Camera = require(script.Parent.Camera)

local Effects = {}

local player = Players.LocalPlayer
local vignetteParts: { Frame } = {}
local vignetteGui: ScreenGui
local heartbeat: Sound
local phase = "INTERMISSION"
local warnedSeal = false
local subtitleCallback: ((string) -> ())? = nil

-- ── Viñeta (cuatro bordes con degradado hacia negro) ─────────────────────────

local function buildVignette()
	vignetteGui = Instance.new("ScreenGui")
	vignetteGui.Name = "LHM_Vignette"
	vignetteGui.ResetOnSpawn = false
	vignetteGui.IgnoreGuiInset = true
	vignetteGui.DisplayOrder = -1
	vignetteGui.Parent = player:WaitForChild("PlayerGui")

	local defs = {
		{ pos = UDim2.new(0, 0, 0, 0), size = UDim2.new(1, 0, 0.22, 0), rot = 90 },
		{ pos = UDim2.new(0, 0, 0.78, 0), size = UDim2.new(1, 0, 0.22, 0), rot = -90 },
		{ pos = UDim2.new(0, 0, 0, 0), size = UDim2.new(0.16, 0, 1, 0), rot = 0 },
		{ pos = UDim2.new(0.84, 0, 0, 0), size = UDim2.new(0.16, 0, 1, 0), rot = 180 },
	}
	for _, def in defs do
		local f = Instance.new("Frame")
		f.BackgroundColor3 = Color3.new(0, 0, 0)
		f.BorderSizePixel = 0
		f.Position = def.pos
		f.Size = def.size
		f.BackgroundTransparency = 1
		local grad = Instance.new("UIGradient")
		grad.Rotation = def.rot
		grad.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0),
			NumberSequenceKeypoint.new(1, 1),
		})
		grad.Parent = f
		f.Parent = vignetteGui
		table.insert(vignetteParts, f)
	end
end

local function setVignette(intensity: number)
	-- intensity 0..1 → transparencia base de los bordes
	local t = 1 - math.clamp(intensity, 0, 1) * 0.85
	for _, f in vignetteParts do
		f.BackgroundTransparency = t
	end
end

-- ── Bucle de tensión ─────────────────────────────────────────────────────────

local function tensionLoop()
	RunService.Heartbeat:Connect(function()
		local base = 0
		if phase == "CIERRE" then
			base = 0.25
		elseif phase == "PROHIBIDA" then
			base = 0.5
		end

		local extra = 0
		local viejo = workspace:FindFirstChild("ElViejo")
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if viejo and root then
			local vRoot = viejo:FindFirstChild("HumanoidRootPart") :: BasePart?
			if vRoot then
				local dist = (vRoot.Position - root.Position).Magnitude
				local hunting = viejo:GetAttribute("Hunting") == true
				if hunting and dist < 60 then
					extra = (1 - dist / 60) * 0.5
					heartbeat.Volume = (1 - dist / 60) * 0.8
					heartbeat.PlaybackSpeed = 0.9 + (1 - dist / 60) * 0.5
					if not heartbeat.IsPlaying then
						heartbeat:Play()
					end
				elseif heartbeat.IsPlaying then
					heartbeat:Stop()
				end
			end
		elseif heartbeat.IsPlaying then
			heartbeat:Stop()
		end

		setVignette(base + extra)
	end)
end

-- ── Aviso local de los sellos de Corre ───────────────────────────────────────

local function sealLoop()
	task.spawn(function()
		while true do
			task.wait(0.35)
			local char = player.Character
			local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
			if not root then
				continue
			end
			local mapModel = workspace:FindFirstChild("LaHoraDelMercado")
			local seals = mapModel and mapModel:FindFirstChild("Seals")
			if not seals then
				warnedSeal = false
				continue
			end
			for _, seal in seals:GetChildren() do
				if seal:IsA("BasePart") then
					local d = (seal.Position - root.Position).Magnitude
					local reach = math.max(seal.Size.X, seal.Size.Z) / 2 + 4
					if d < math.max(reach, Config.Corre.WhisperRadius) then
						if not warnedSeal and subtitleCallback then
							warnedSeal = true
							subtitleCallback("…no corras.")
						end
						break
					end
				end
			end
		end
	end)
end

-- ── API ──────────────────────────────────────────────────────────────────────

function Effects.init(onSubtitle: (string) -> ())
	subtitleCallback = onSubtitle
	buildVignette()

	heartbeat = SoundUtil.make(player:WaitForChild("PlayerGui"), Config.Sounds.Heartbeat, {
		Volume = 0,
		Looped = true,
		Name = "Latido",
	})

	tensionLoop()
	sealLoop()
end

function Effects.setPhase(newPhase: string)
	phase = newPhase
	if newPhase ~= "PROHIBIDA" then
		warnedSeal = false
	end
end

function Effects.jumpscare()
	-- Destello rojo + sacudida de cámara.
	local flash = Instance.new("Frame")
	flash.BackgroundColor3 = Color3.fromRGB(120, 10, 8)
	flash.BackgroundTransparency = 0.2
	flash.Size = UDim2.fromScale(1, 1)
	flash.BorderSizePixel = 0
	flash.Parent = vignetteGui
	TweenService:Create(flash, TweenInfo.new(1.1), { BackgroundTransparency = 1 }):Play()
	task.delay(1.2, function()
		flash:Destroy()
	end)

	Camera.shake(0.9)
end

return Effects
