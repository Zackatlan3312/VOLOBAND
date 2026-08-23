--!strict
-- Controla la atmósfera global y las luminarias del complejo según la fase:
-- TARDE (todo encendido, cálido) → CIERRE (parcial, parpadeos) →
-- PROHIBIDA (mínimo, frío, oscuridad).

local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundUtil = require(ReplicatedStorage.Shared.SoundUtil)

local LightingRig = {}

local map: any
local cc: ColorCorrectionEffect
local rng = Random.new()
local flickerSet: { any } = {}
local flickerRunning = false
local currentPhase = "TARDE"

local PHASE_LIGHTING = {
	TARDE = {
		Ambient = Color3.fromRGB(34, 34, 38),
		Brightness = 1.4,
		cc = { Saturation = -0.05, Contrast = 0.02, Brightness = 0, TintColor = Color3.fromRGB(255, 252, 245) },
	},
	CIERRE = {
		Ambient = Color3.fromRGB(22, 22, 27),
		Brightness = 1.1,
		cc = { Saturation = -0.16, Contrast = 0.05, Brightness = -0.02, TintColor = Color3.fromRGB(244, 244, 248) },
	},
	PROHIBIDA = {
		Ambient = Color3.fromRGB(8, 8, 12),
		Brightness = 0.7,
		cc = { Saturation = -0.38, Contrast = 0.1, Brightness = -0.05, TintColor = Color3.fromRGB(210, 220, 248) },
	},
}

local COLD = Color3.fromRGB(198, 214, 255)

local function setFixture(f: any, on: boolean, color: Color3?, brightness: number?)
	local c = color or f.baseColor
	if on then
		f.tube.Material = Enum.Material.Neon
		f.tube.Color = c
		f.light.Enabled = true
		f.light.Color = c
		f.light.Brightness = brightness or f.baseBrightness
	else
		f.tube.Material = Enum.Material.SmoothPlastic
		f.tube.Color = Color3.fromRGB(70, 70, 74)
		f.light.Enabled = false
	end
end

local function startFlickerLoop()
	if flickerRunning then
		return
	end
	flickerRunning = true
	task.spawn(function()
		while true do
			task.wait(rng:NextNumber(1.5, 5))
			if #flickerSet == 0 then
				continue
			end
			local f = flickerSet[rng:NextInteger(1, #flickerSet)]
			if not f.tube.Parent then
				continue
			end
			SoundUtil.playAt(f.tube.Position, Config.Sounds.Buzz, 0.35, 30)
			local wasOn = f.light.Enabled
			for _ = 1, rng:NextInteger(2, 6) do
				setFixture(f, false)
				task.wait(rng:NextNumber(0.04, 0.12))
				setFixture(f, true, currentPhase == "PROHIBIDA" and COLD or nil, currentPhase == "PROHIBIDA" and 0.6 or nil)
				task.wait(rng:NextNumber(0.05, 0.15))
			end
			if not wasOn then
				setFixture(f, false)
			end
		end
	end)
end

function LightingRig.init(builtMap: any)
	map = builtMap

	-- Base de la atmósfera. Se define aquí (y no solo en el archivo de lugar)
	-- para que el juego se vea igual sin importar cómo se haya instalado.
	-- `Lighting.Technology` es la única propiedad que debe fijarse en Studio.
	Lighting.ClockTime = 0
	Lighting.GlobalShadows = true
	Lighting.EnvironmentDiffuseScale = 0.2
	Lighting.EnvironmentSpecularScale = 0.35
	Lighting.ExposureCompensation = 0
	Lighting.OutdoorAmbient = Color3.fromRGB(8, 8, 13)
	Lighting.FogColor = Color3.fromRGB(6, 6, 8)
	Lighting.FogStart = 60
	Lighting.FogEnd = 420
	Lighting.ShadowSoftness = 0.25

	local atmosphere = Instance.new("Atmosphere")
	atmosphere.Density = 0.3
	atmosphere.Offset = 0
	atmosphere.Color = Color3.fromRGB(180, 180, 190)
	atmosphere.Decay = Color3.fromRGB(60, 60, 70)
	atmosphere.Haze = 1
	atmosphere.Parent = Lighting

	cc = Instance.new("ColorCorrectionEffect")
	cc.Name = "LHM_CC"
	cc.Parent = Lighting

	startFlickerLoop()
	LightingRig.setPhase("TARDE")
end

function LightingRig.setPhase(phase: string)
	currentPhase = phase
	local def = PHASE_LIGHTING[phase]
	if not def then
		return
	end

	TweenService:Create(Lighting, TweenInfo.new(3), {
		Ambient = def.Ambient,
		Brightness = def.Brightness,
	}):Play()
	TweenService:Create(cc, TweenInfo.new(3), def.cc):Play()

	table.clear(flickerSet)

	if phase == "TARDE" then
		for _, f in map.fixtures do
			setFixture(f, true)
		end
	elseif phase == "CIERRE" then
		for i, f in map.fixtures do
			if f.zone == "apt" or f.zone == "service" then
				setFixture(f, true)
			elseif f.zone == "locale" then
				-- Las apaga el cierre de cada persiana (GameLoop).
			else
				if rng:NextNumber() < 0.3 then
					setFixture(f, false)
				else
					setFixture(f, true)
					if rng:NextNumber() < 0.25 then
						table.insert(flickerSet, f)
					end
				end
			end
		end
	elseif phase == "PROHIBIDA" then
		local count = 0
		for _, f in map.fixtures do
			if f.zone == "apt" then
				setFixture(f, true) -- los departamentos siguen siendo hogar
			elseif f.zone == "locale" then
				setFixture(f, false)
			elseif f.zone == "service" then
				setFixture(f, true, Color3.fromRGB(190, 240, 190), 0.5)
			else
				count += 1
				if count % 3 == 0 then
					setFixture(f, true, COLD, 0.6)
					if rng:NextNumber() < 0.5 then
						table.insert(flickerSet, f)
					end
				else
					setFixture(f, false)
				end
			end
		end
	end
end

-- Apaga la luminaria de un local (cuando baja su persiana).
function LightingRig.localeOff(fixture: any)
	setFixture(fixture, false)
end

function LightingRig.localeOn(fixture: any)
	setFixture(fixture, true)
end

return LightingRig
