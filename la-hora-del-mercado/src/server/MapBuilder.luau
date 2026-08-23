--!strict
-- Construye proceduralmente el complejo: un piso del bazar con 12 locales,
-- el bloque de departamentos, la escuela de idiomas, pasillos de servicio,
-- cuartos de mantenimiento (refugios) y toda la iluminación y señalización.
--
-- Sistema de coordenadas (vista superior, Y hacia arriba):
--   · Pasillo principal del bazar: a lo largo de X, z ∈ [-8, 8], x ∈ [-92, 92]
--   · Departamentos: al norte (z negativo)
--   · Escuela de idiomas: al sur (z positivo)
--   · Pasillo de servicio: detrás de los locales sur, z ∈ [30, 38]
-- El techo interior está a Y = 12.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)

local H = 12 -- altura interior
local WALL_T = 1 -- grosor de muros

-- ── Paleta ───────────────────────────────────────────────────────────────────
local STYLE = {
	corridorFloor = { Color3.fromRGB(186, 183, 175), Enum.Material.Concrete },
	wall = { Color3.fromRGB(219, 215, 204), Enum.Material.Concrete },
	ceiling = { Color3.fromRGB(148, 148, 151), Enum.Material.Concrete },
	localeFloor = { Color3.fromRGB(158, 149, 137), Enum.Material.Concrete },
	aptFloor = { Color3.fromRGB(143, 112, 82), Enum.Material.WoodPlanks },
	aptWall = { Color3.fromRGB(210, 199, 178), Enum.Material.Concrete },
	schoolFloor = { Color3.fromRGB(168, 173, 168), Enum.Material.Concrete },
	serviceFloor = { Color3.fromRGB(108, 108, 110), Enum.Material.Concrete },
	serviceWall = { Color3.fromRGB(128, 130, 126), Enum.Material.Concrete },
	persiana = { Color3.fromRGB(138, 138, 143), Enum.Material.DiamondPlate },
	metalDoor = { Color3.fromRGB(96, 102, 108), Enum.Material.Metal },
	woodDoor = { Color3.fromRGB(105, 78, 54), Enum.Material.Wood },
	counter = { Color3.fromRGB(122, 94, 68), Enum.Material.Wood },
	column = { Color3.fromRGB(196, 192, 182), Enum.Material.Concrete },
}

export type Region = { x0: number, x1: number, z0: number, z1: number }

local MapBuilder = {}

-- ── Helpers básicos ──────────────────────────────────────────────────────────

local function part(parent: Instance, name: string, size: Vector3, cf: CFrame, style: { any }, extra: { [string]: any }?): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = style[1]
	p.Material = style[2]
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if extra then
		for k, v in extra do
			(p :: any)[k] = v
		end
	end
	p.Parent = parent
	return p
end

local function floorSlab(parent: Instance, name: string, x0: number, x1: number, z0: number, z1: number, style: { any })
	part(parent, name, Vector3.new(x1 - x0, 1, z1 - z0), CFrame.new((x0 + x1) / 2, -0.5, (z0 + z1) / 2), style)
end

local function ceilSlab(parent: Instance, name: string, x0: number, x1: number, z0: number, z1: number)
	part(parent, name, Vector3.new(x1 - x0, 1, z1 - z0), CFrame.new((x0 + x1) / 2, H + 0.5, (z0 + z1) / 2), STYLE.ceiling)
end

type Gap = { center: number, width: number, height: number }

-- Muro a lo largo de un eje con huecos (puertas / accesos) y dinteles.
-- axis = "x": el muro corre a lo largo de X en z = fixed.
-- axis = "z": el muro corre a lo largo de Z en x = fixed.
local function wallRun(parent: Instance, name: string, axis: string, a0: number, a1: number, fixed: number, gaps: { Gap }?, style: { any }?)
	local st = style or STYLE.wall
	local list: { Gap } = gaps or {}
	table.sort(list, function(a: Gap, b: Gap)
		return a.center < b.center
	end)

	local function segment(s0: number, s1: number, y0: number, y1: number)
		local len = s1 - s0
		if len < 0.05 or (y1 - y0) < 0.05 then
			return
		end
		local mid = (s0 + s1) / 2
		local yMid = (y0 + y1) / 2
		if axis == "x" then
			part(parent, name, Vector3.new(len, y1 - y0, WALL_T), CFrame.new(mid, yMid, fixed), st)
		else
			part(parent, name, Vector3.new(WALL_T, y1 - y0, len), CFrame.new(fixed, yMid, mid), st)
		end
	end

	local cursor = a0
	for _, gap in list do
		local g0 = gap.center - gap.width / 2
		local g1 = gap.center + gap.width / 2
		segment(cursor, g0, 0, H)
		segment(g0, g1, gap.height, H) -- dintel
		cursor = g1
	end
	segment(cursor, a1, 0, H)
end

local function makeRegion(x0: number, x1: number, z0: number, z1: number): Region
	return { x0 = x0, x1 = x1, z0 = z0, z1 = z1 }
end

local function regionContains(region: Region, pos: Vector3): boolean
	return pos.X >= region.x0 and pos.X <= region.x1 and pos.Z >= region.z0 and pos.Z <= region.z1
end

local function regionCenter(region: Region): Vector3
	return Vector3.new((region.x0 + region.x1) / 2, 0, (region.z0 + region.z1) / 2)
end

-- ── Señalización ─────────────────────────────────────────────────────────────

local function makeSign(parent: Instance, text: string, cf: CFrame, width: number, height: number, textColor: Color3?, bgColor: Color3?, neon: boolean?)
	local sign = part(parent, "Letrero", Vector3.new(width, height, 0.3), cf, {
		bgColor or Color3.fromRGB(38, 36, 34),
		neon and Enum.Material.Neon or Enum.Material.SmoothPlastic,
	}, { CanCollide = false, CanQuery = false })
	for _, face in { Enum.NormalId.Front, Enum.NormalId.Back } do
		local gui = Instance.new("SurfaceGui")
		gui.Face = face
		gui.CanvasSize = Vector2.new(width * 50, height * 50)
		gui.LightInfluence = neon and 0 or 0.6
		gui.Brightness = neon and 2 or 1
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundTransparency = 1
		label.Font = Enum.Font.Oswald
		label.TextScaled = true
		label.Text = text
		label.TextColor3 = textColor or Color3.fromRGB(235, 228, 210)
		label.Parent = gui
		gui.Parent = sign
	end
	return sign
end

-- ── Luminarias ───────────────────────────────────────────────────────────────

export type Fixture = {
	tube: Part,
	light: PointLight,
	zone: string,
	baseColor: Color3,
	baseBrightness: number,
}

local function fixture(parent: Instance, fixtures: { Fixture }, x: number, z: number, zone: string, color: Color3?)
	local c = color or Color3.fromRGB(255, 244, 219)
	local noBlock = { CanCollide = false, CanQuery = false }
	part(parent, "Luminaria", Vector3.new(4.4, 0.25, 1.6), CFrame.new(x, 11.86, z), { Color3.fromRGB(222, 222, 227), Enum.Material.Metal }, noBlock)
	local tube = part(parent, "Tubo", Vector3.new(4, 0.16, 1.1), CFrame.new(x, 11.72, z), { c, Enum.Material.Neon }, noBlock)
	local light = Instance.new("PointLight")
	light.Color = c
	light.Brightness = 1.1
	light.Range = 15
	light.Shadows = zone == "spine" or zone == "hall"
	light.Parent = tube
	table.insert(fixtures, { tube = tube, light = light, zone = zone, baseColor = c, baseBrightness = 1.1 })
end

-- ── Puertas con bisagra ──────────────────────────────────────────────────────

-- Puerta en un muro que corre a lo largo de X (z fija). La bisagra queda en
-- hingeX; la hoja abre girando 105° alrededor de la bisagra.
local function makeDoor(map: any, parent: Instance, hingeX: number, z: number, width: number, height: number, style: { any })
	local base = CFrame.new(hingeX, height / 2, z)
	local closedCF = base * CFrame.new(width / 2, 0, 0)
	local openCF = base * CFrame.Angles(0, math.rad(105), 0) * CFrame.new(width / 2, 0, 0)

	local panel = part(parent, "Puerta", Vector3.new(width - 0.15, height - 0.1, 0.3), closedCF, style)
	local creak = SoundBank.make(panel, "Creak", { Volume = 0.55, RollOffMaxDistance = 55, Name = "Creak" })

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Abrir"
	prompt.ObjectText = "Puerta"
	prompt.HoldDuration = 0.25
	prompt.MaxActivationDistance = 7
	prompt.RequiresLineOfSight = false
	prompt.Parent = panel

	local open = false
	local busy = false
	prompt.Triggered:Connect(function(player)
		if busy then
			return
		end
		busy = true
		open = not open
		prompt.ActionText = open and "Cerrar" or "Abrir"
		creak:Play()
		local tween = TweenService:Create(panel, TweenInfo.new(0.7, Enum.EasingStyle.Sine), {
			CFrame = open and openCF or closedCF,
		})
		tween:Play()
		tween.Completed:Once(function()
			busy = false
		end)
		if map.onDoorUsed then
			map.onDoorUsed(player, panel.Position)
		end
	end)
	return panel
end

-- ── Persianas metálicas ──────────────────────────────────────────────────────

export type Persiana = {
	part: Part,
	closed: boolean,
	close: (self: Persiana, silent: boolean?) -> (),
	open: (self: Persiana) -> (),
}

-- Persiana sobre un hueco en un muro que corre a lo largo de X (z fija).
local function makePersiana(map: any, parent: Instance, centerX: number, z: number, width: number, height: number): Persiana
	local closedCF = CFrame.new(centerX, height / 2, z)
	local openCF = CFrame.new(centerX, height / 2 + (height - 0.6), z)

	local sheet = part(parent, "Persiana", Vector3.new(width, height, 0.5), openCF, STYLE.persiana)
	local sound = SoundBank.make(sheet, "Metal", { Volume = 0.7, RollOffMaxDistance = 80, Name = "Move" })

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Bajar persiana"
	prompt.ObjectText = "Persiana metálica"
	prompt.HoldDuration = 1.2
	prompt.MaxActivationDistance = 9
	prompt.RequiresLineOfSight = false
	prompt.Parent = sheet

	local persiana = {} :: any
	persiana.part = sheet
	persiana.closed = false
	local busy = false

	local function slide(toClosed: boolean, silent: boolean?)
		if busy or persiana.closed == toClosed then
			return
		end
		busy = true
		persiana.closed = toClosed
		prompt.ActionText = toClosed and "Levantar persiana (ruidoso)" or "Bajar persiana"
		if not silent then
			sound:Play()
		end
		local tween = TweenService:Create(sheet, TweenInfo.new(2.1, Enum.EasingStyle.Sine), {
			CFrame = toClosed and closedCF or openCF,
		})
		tween:Play()
		tween.Completed:Once(function()
			busy = false
		end)
	end

	function persiana.close(_self, silent: boolean?)
		slide(true, silent)
	end
	function persiana.open(_self)
		slide(false)
	end

	prompt.Triggered:Connect(function(player)
		local target = not persiana.closed
		slide(target)
		if map.onPersianaUsed then
			map.onPersianaUsed(player, sheet.Position)
		end
	end)

	return persiana :: Persiana
end

-- ── Mobiliario ───────────────────────────────────────────────────────────────

local rng = Random.new()

local BOX_COLORS = {
	Color3.fromRGB(148, 116, 84),
	Color3.fromRGB(120, 96, 72),
	Color3.fromRGB(96, 104, 118),
	Color3.fromRGB(134, 128, 96),
}

local function clutterBox(parent: Instance, x: number, z: number)
	local s = rng:NextNumber(1.4, 2.6)
	part(parent, "Caja", Vector3.new(s, s, s), CFrame.new(x, s / 2, z) * CFrame.Angles(0, rng:NextNumber(0, math.pi), 0), {
		BOX_COLORS[rng:NextInteger(1, #BOX_COLORS)],
		Enum.Material.SmoothPlastic,
	})
end

local function furnishLocale(parent: Instance, cx: number, z0: number, z1: number)
	-- Mostrador cerca de la entrada y estantería al fondo, con productos.
	local depth = z1 - z0
	-- La entrada del local es el borde más cercano al pasillo principal (z = 0);
	-- `sign` apunta hacia el fondo del local.
	local frontZ, sign
	if math.abs(z0) > math.abs(z1) then
		frontZ, sign = z1, -1 -- local del lado norte
	else
		frontZ, sign = z0, 1 -- local del lado sur
	end
	local counterZ = frontZ + sign * 5
	part(parent, "Mostrador", Vector3.new(10, 3.2, 2.4), CFrame.new(cx, 1.6, counterZ), STYLE.counter)
	local backZ = frontZ + sign * (depth - 2.5)
	part(parent, "Estante", Vector3.new(14, 6.5, 1.4), CFrame.new(cx, 3.25, backZ), { Color3.fromRGB(88, 74, 60), Enum.Material.Wood })
	for i = 1, 4 do
		local bx = cx - 6 + i * 2.6
		part(parent, "Producto", Vector3.new(1.6, 1.6, 1.1), CFrame.new(bx, 6.9, backZ), {
			BOX_COLORS[rng:NextInteger(1, #BOX_COLORS)],
			Enum.Material.SmoothPlastic,
		})
	end
end

local function furnishApartment(parent: Instance, cx: number, z0: number, z1: number)
	local midZ = (z0 + z1) / 2
	-- Cama, mesa y una lámpara cálida.
	part(parent, "Cama", Vector3.new(5.5, 1.6, 8), CFrame.new(cx - 4.4, 0.8, z0 + 5), { Color3.fromRGB(90, 62, 48), Enum.Material.Wood })
	part(parent, "Colchon", Vector3.new(5.1, 0.8, 7.4), CFrame.new(cx - 4.4, 2, z0 + 5), { Color3.fromRGB(205, 198, 182), Enum.Material.Fabric })
	part(parent, "Mesa", Vector3.new(4, 0.4, 2.6), CFrame.new(cx + 4.6, 2.6, midZ), STYLE.counter)
	for _, off in { Vector3.new(-1.6, 0, -1), Vector3.new(1.6, 0, -1), Vector3.new(-1.6, 0, 1), Vector3.new(1.6, 0, 1) } do
		part(parent, "PataMesa", Vector3.new(0.4, 2.4, 0.4), CFrame.new(cx + 4.6 + off.X, 1.2, midZ + off.Z), STYLE.counter)
	end
	local lampBase = part(parent, "Lampara", Vector3.new(0.8, 1.4, 0.8), CFrame.new(cx + 4.6, 3.5, midZ), { Color3.fromRGB(232, 210, 160), Enum.Material.Neon })
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 214, 150)
	light.Brightness = 0.9
	light.Range = 13
	light.Shadows = true
	light.Parent = lampBase
end

local function furnishClassroom(parent: Instance, x0: number, x1: number, z0: number, z1: number, posterText: string)
	local cx = (x0 + x1) / 2
	-- Pizarrón al fondo (muro sur del salón, z1) y pupitres.
	part(parent, "Pizarron", Vector3.new(10, 4, 0.3), CFrame.new(cx, 5.2, z1 - 0.8), { Color3.fromRGB(235, 235, 232), Enum.Material.SmoothPlastic })
	for row = 0, 1 do
		for col = 0, 2 do
			local dx = x0 + 4.5 + col * 5.5
			local dz = z0 + 5 + row * 5
			part(parent, "Pupitre", Vector3.new(2.6, 0.3, 1.8), CFrame.new(dx, 2.4, dz), STYLE.counter)
			part(parent, "PataPupitre", Vector3.new(0.35, 2.25, 0.35), CFrame.new(dx, 1.15, dz), { Color3.fromRGB(70, 70, 74), Enum.Material.Metal })
			part(parent, "Silla", Vector3.new(1.8, 1.6, 1.6), CFrame.new(dx, 0.8, dz + 1.9), { Color3.fromRGB(140, 60, 50), Enum.Material.SmoothPlastic })
		end
	end
	makeSign(parent, posterText, CFrame.new(cx - 6, 7.5, z1 - 0.85), 4, 2.4, Color3.fromRGB(240, 236, 220), Color3.fromRGB(70, 92, 120), false)
end

local function furnishMaintenance(parent: Instance, x0: number, x1: number, z0: number, z1: number)
	local cx = (x0 + x1) / 2
	part(parent, "EstanteMetal", Vector3.new(1.2, 7, (z1 - z0) - 3), CFrame.new(x0 + 1.2, 3.5, (z0 + z1) / 2), { Color3.fromRGB(92, 96, 100), Enum.Material.Metal })
	part(parent, "Tuberia", Vector3.new(0.6, 0.6, (z1 - z0) - 1), CFrame.new(x1 - 1, 10.6, (z0 + z1) / 2), { Color3.fromRGB(120, 110, 96), Enum.Material.Metal })
	for i = 1, 3 do
		clutterBox(parent, cx + rng:NextNumber(-2, 2), z0 + 3 + i * 2.2)
	end
	-- Lámpara roja tenue de emergencia (independiente del sistema de fases).
	local lamp = part(parent, "LamparaEmergencia", Vector3.new(0.9, 0.5, 0.9), CFrame.new(cx, 11.5, (z0 + z1) / 2), { Color3.fromRGB(180, 40, 36), Enum.Material.Neon })
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 70, 60)
	light.Brightness = 0.7
	light.Range = 12
	light.Parent = lamp
end

-- ── Construcción principal ───────────────────────────────────────────────────

function MapBuilder.build()
	local root = Instance.new("Model")
	root.Name = "LaHoraDelMercado"

	local geo = Instance.new("Folder")
	geo.Name = "Geometria"
	geo.Parent = root

	local map = {} :: any
	map.model = root
	map.fixtures = {} :: { Fixture }
	map.locales = {}
	map.apartments = {}
	map.refugeRegions = {} :: { Region }
	map.sealCandidates = {}
	map.patrolPoints = {} :: { Vector3 }
	map.npcSpawns = {} :: { Vector3 }
	map.regionContains = regionContains
	map.onDoorUsed = nil
	map.onPersianaUsed = nil

	local fixtures = map.fixtures

	-- ════ Pasillo principal del bazar (la "espina") ════
	local spine = Instance.new("Folder")
	spine.Name = "PasilloPrincipal"
	spine.Parent = geo

	floorSlab(spine, "Piso", -92, 92, -8, 8, STYLE.corridorFloor)
	ceilSlab(spine, "Techo", -92, 92, -8, 8)

	local localeXs = { -72, -48, -24, 24, 48, 72 }

	-- Muro norte: huecos de 6 locales + acceso al corredor de departamentos.
	local northGaps: { Gap } = { { center = 0, width = 12, height = 9 } }
	for _, cx in localeXs do
		table.insert(northGaps, { center = cx, width = 12, height = 8 })
	end
	wallRun(spine, "MuroNorte", "x", -92, 92, -8, northGaps)

	-- Muro sur: 6 locales + acceso a la escuela + pasajes de servicio en los extremos.
	local southGaps: { Gap } = {
		{ center = 0, width = 12, height = 9 },
		{ center = -88, width = 7, height = 9 },
		{ center = 88, width = 7, height = 9 },
	}
	for _, cx in localeXs do
		table.insert(southGaps, { center = cx, width = 12, height = 8 })
	end
	wallRun(spine, "MuroSur", "x", -92, 92, 8, southGaps)

	-- Extremos.
	wallRun(spine, "MuroOeste", "z", -8, 8, -92)
	wallRun(spine, "MuroEste", "z", -8, 8, 92)

	-- Columnas y bancas para romper la monotonía del pasillo.
	for _, cx in { -60, -36, -12, 12, 36, 60 } do
		part(spine, "Columna", Vector3.new(2, H, 2), CFrame.new(cx, H / 2, -6.2), STYLE.column)
		part(spine, "Columna", Vector3.new(2, H, 2), CFrame.new(cx, H / 2, 6.2), STYLE.column)
	end
	for _, cx in { -36, 36 } do
		part(spine, "Banca", Vector3.new(6, 1.6, 2), CFrame.new(cx, 0.8, 0), { Color3.fromRGB(110, 86, 62), Enum.Material.Wood })
		part(spine, "Macetero", Vector3.new(2.2, 2, 2.2), CFrame.new(cx + 5, 1, 0), { Color3.fromRGB(140, 82, 60), Enum.Material.Concrete })
		part(spine, "Planta", Vector3.new(2.6, 3, 2.6), CFrame.new(cx + 5, 3.4, 0), { Color3.fromRGB(52, 96, 54), Enum.Material.Grass })
	end

	-- Reja de "salida" (siempre cerrada: ambienta, no es funcional).
	part(spine, "RejaSalida", Vector3.new(0.5, 10, 15), CFrame.new(91.3, 5, 0), STYLE.persiana)
	local exitSign = makeSign(spine, "SALIDA", CFrame.new(89.5, 10.8, 0) * CFrame.Angles(0, math.rad(90), 0), 6, 1.6, Color3.fromRGB(120, 255, 140), Color3.fromRGB(12, 40, 16), true)
	map.exitSign = exitSign

	-- Señalización colgante del cruce central.
	makeSign(spine, "← DEPARTAMENTOS", CFrame.new(0, 10, -6.8), 12, 1.4)
	makeSign(spine, "ESCUELA DE IDIOMAS →", CFrame.new(0, 10, 6.8), 12, 1.4)
	makeSign(spine, "BAZAR EL CENTENARIO", CFrame.new(0, 10.8, 0), 18, 1.8, Color3.fromRGB(240, 210, 140), Color3.fromRGB(50, 32, 24), false)

	for x = -84, 84, 12 do
		fixture(spine, fixtures, x, 0, "spine")
		table.insert(map.patrolPoints, Vector3.new(x, 0, 0))
		if x % 24 == 0 then
			table.insert(map.npcSpawns, Vector3.new(x, 0, rng:NextNumber(-4, 4)))
		end
	end

	map.viejoSpawn = CFrame.new(-86, 0, 0)

	-- ════ Locales del bazar ════
	local localesFolder = Instance.new("Folder")
	localesFolder.Name = "Locales"
	localesFolder.Parent = geo

	local nameIndex = 0
	local function buildLocale(cx: number, north: boolean)
		nameIndex += 1
		local name = Config.LocaleNames[nameIndex] or ("Local " .. nameIndex)
		local lf = Instance.new("Model")
		lf.Name = name
		lf.Parent = localesFolder

		local z0, z1
		if north then
			z0, z1 = -30, -8
		else
			z0, z1 = 8, 30
		end
		local x0, x1 = cx - 10, cx + 10

		floorSlab(lf, "Piso", x0, x1, z0, z1, STYLE.localeFloor)
		ceilSlab(lf, "Techo", x0, x1, z0, z1)
		wallRun(lf, "MuroLateral", "z", z0, z1, x0)
		wallRun(lf, "MuroLateral", "z", z0, z1, x1)
		-- Muro trasero (el frontal con su hueco ya lo puso la espina).
		wallRun(lf, "MuroFondo", "x", x0, x1, north and z0 or z1)

		furnishLocale(lf, cx, z0, z1)

		local frontZ = north and -8 or 8
		local persiana = makePersiana(map, lf, cx, frontZ, 12, 8)
		local signZ = north and (frontZ - 0.4) or (frontZ + 0.4)
		makeSign(lf, name, CFrame.new(cx, 9.6, signZ), 13, 2, Color3.fromRGB(238, 226, 198), Color3.fromRGB(52, 40, 32), false)

		fixture(lf, fixtures, cx, (z0 + z1) / 2, "locale")
		local localeFixture = fixtures[#fixtures]

		local interiorZ = north and (z0 + 8) or (z1 - 8)
		table.insert(map.locales, {
			name = name,
			model = lf,
			persiana = persiana,
			fixture = localeFixture,
			region = makeRegion(x0 + 1, x1 - 1, math.min(z0, z1) + 1, math.max(z0, z1) - 1),
			packageSpot = Vector3.new(cx + 3, 3.4, north and (frontZ - 6.2) or (frontZ + 6.2)),
			interiorPoint = Vector3.new(cx, 0, interiorZ),
		})
	end

	for _, cx in localeXs do
		buildLocale(cx, true)
	end
	for _, cx in localeXs do
		buildLocale(cx, false)
	end

	-- ════ Corredor norte hacia los departamentos ════
	local north = Instance.new("Folder")
	north.Name = "CorredorNorte"
	north.Parent = geo

	floorSlab(north, "Piso", -6, 6, -70, -8, STYLE.corridorFloor)
	ceilSlab(north, "Techo", -6, 6, -70, -8)
	wallRun(north, "MuroOeste", "z", -70, -8, -6)
	wallRun(north, "MuroEste", "z", -70, -8, 6)

	for z = -18, -62, -12 do
		fixture(north, fixtures, 0, z, "corr")
		table.insert(map.patrolPoints, Vector3.new(0, 0, z))
	end
	makeSign(north, "DEPARTAMENTOS ↑", CFrame.new(0, 10, -38), 10, 1.3)

	-- ════ Corredor de departamentos ════
	local hall = Instance.new("Folder")
	hall.Name = "PasilloDepartamentos"
	hall.Parent = geo

	floorSlab(hall, "Piso", -56, 56, -82, -70, STYLE.corridorFloor)
	ceilSlab(hall, "Techo", -56, 56, -82, -70)

	local aptXs = { -45, -27, -9, 9, 27, 45 }
	local aptGaps: { Gap } = {}
	for _, cx in aptXs do
		table.insert(aptGaps, { center = cx, width = 4, height = 7 })
	end
	wallRun(hall, "MuroNorte", "x", -56, 56, -82, aptGaps)
	wallRun(hall, "MuroSur", "x", -56, 56, -70, { { center = 0, width = 12, height = 9 } })
	wallRun(hall, "MuroOeste", "z", -82, -70, -56)
	wallRun(hall, "MuroEste", "z", -82, -70, 56)

	for x = -48, 48, 16 do
		fixture(hall, fixtures, x, -76, "hall")
		table.insert(map.patrolPoints, Vector3.new(x, 0, -76))
	end

	-- ════ Departamentos ════
	local aptsFolder = Instance.new("Folder")
	aptsFolder.Name = "Departamentos"
	aptsFolder.Parent = geo

	for i, cx in aptXs do
		local m = Instance.new("Model")
		m.Name = "Departamento" .. (100 + i)
		m.Parent = aptsFolder

		local x0, x1 = cx - 8, cx + 8
		local z0, z1 = -100, -82
		floorSlab(m, "Piso", x0, x1, z0, z1, STYLE.aptFloor)
		ceilSlab(m, "Techo", x0, x1, z0, z1)
		wallRun(m, "MuroLateral", "z", z0, z1, x0, nil, STYLE.aptWall)
		wallRun(m, "MuroLateral", "z", z0, z1, x1, nil, STYLE.aptWall)
		wallRun(m, "MuroFondo", "x", x0, x1, z0, nil, STYLE.aptWall)

		furnishApartment(m, cx, z0, z1)
		makeDoor(map, m, cx - 2, -82, 4, 7, STYLE.woodDoor)
		makeSign(m, tostring(100 + i), CFrame.new(cx + 3.4, 8, -81.6), 1.6, 1.2, Color3.fromRGB(220, 210, 190), Color3.fromRGB(60, 48, 38), false)

		fixture(m, fixtures, cx, -91, "apt", Color3.fromRGB(255, 226, 178))

		local region = makeRegion(x0 + 1, x1 - 1, z0 + 1, z1 - 1)
		table.insert(map.refugeRegions, region)
		table.insert(map.apartments, {
			index = i,
			name = "Departamento " .. (100 + i),
			spawnCF = CFrame.new(cx, 3.5, -91) * CFrame.Angles(0, math.rad(180), 0),
			region = region,
			doorPos = Vector3.new(cx, 0, -82),
		})
	end

	-- ════ Corredor sur hacia la escuela ════
	local south = Instance.new("Folder")
	south.Name = "CorredorSur"
	south.Parent = geo

	floorSlab(south, "Piso", -6, 6, 8, 48, STYLE.corridorFloor)
	ceilSlab(south, "Techo", -6, 6, 8, 48)
	-- Huecos donde cruza el pasillo de servicio (z ∈ [30, 38]).
	wallRun(south, "MuroOeste", "z", 8, 48, -6, { { center = 34, width = 8, height = 9 } })
	wallRun(south, "MuroEste", "z", 8, 48, 6, { { center = 34, width = 8, height = 9 } })

	for z = 14, 44, 10 do
		fixture(south, fixtures, 0, z, "corr")
		table.insert(map.patrolPoints, Vector3.new(0, 0, z))
	end

	-- ════ Escuela de idiomas ════
	local school = Instance.new("Folder")
	school.Name = "EscuelaDeIdiomas"
	school.Parent = geo

	-- Recepción / lobby.
	floorSlab(school, "PisoLobby", -30, 30, 48, 60, STYLE.schoolFloor)
	ceilSlab(school, "TechoLobby", -30, 30, 48, 60)
	wallRun(school, "MuroNorte", "x", -30, 30, 48, { { center = 0, width = 12, height = 9 } })
	local classGaps: { Gap } = {
		{ center = -20, width = 5, height = 8 },
		{ center = 0, width = 5, height = 8 },
		{ center = 20, width = 5, height = 8 },
	}
	wallRun(school, "MuroSur", "x", -30, 30, 60, classGaps)
	wallRun(school, "MuroOeste", "z", 48, 60, -30)
	wallRun(school, "MuroEste", "z", 48, 60, 30)
	part(school, "Recepcion", Vector3.new(9, 3.4, 2.4), CFrame.new(12, 1.7, 52), STYLE.counter)
	makeSign(school, "ESCUELA DE IDIOMAS «BABEL»", CFrame.new(0, 10, 48.6), 20, 1.8, Color3.fromRGB(210, 228, 250), Color3.fromRGB(34, 48, 70), false)

	fixture(school, fixtures, -15, 54, "school")
	fixture(school, fixtures, 15, 54, "school")
	table.insert(map.patrolPoints, Vector3.new(0, 0, 54))

	-- Salones.
	local classDefs = {
		{ x0 = -30, x1 = -10, poster = "HELLO!" },
		{ x0 = -10, x1 = 10, poster = "BONJOUR" },
		{ x0 = 10, x1 = 30, poster = "こんにちは" },
	}
	for i, def in classDefs do
		local m = Instance.new("Model")
		m.Name = "Salon" .. i
		m.Parent = school
		floorSlab(m, "Piso", def.x0, def.x1, 60, 78, STYLE.schoolFloor)
		ceilSlab(m, "Techo", def.x0, def.x1, 60, 78)
		wallRun(m, "MuroLateral", "z", 60, 78, def.x0)
		wallRun(m, "MuroLateral", "z", 60, 78, def.x1)
		wallRun(m, "MuroFondo", "x", def.x0, def.x1, 78)
		furnishClassroom(m, def.x0, def.x1, 60, 78, def.poster)
		makeDoor(map, m, (def.x0 + def.x1) / 2 - 2.5, 60, 5, 8, STYLE.woodDoor)
		fixture(m, fixtures, (def.x0 + def.x1) / 2, 69, "school")
	end

	-- ════ Pasillo de servicio ════
	local service = Instance.new("Folder")
	service.Name = "PasilloServicio"
	service.Parent = geo

	floorSlab(service, "Piso", -92, 92, 30, 38, STYLE.serviceFloor)
	ceilSlab(service, "Techo", -92, 92, 30, 38)
	-- Muro norte: huecos hacia los pasajes de los extremos y el corredor sur.
	wallRun(service, "MuroNorte", "x", -92, 92, 30, {
		{ center = -88, width = 7, height = 9 },
		{ center = 88, width = 7, height = 9 },
		{ center = 0, width = 12, height = 9 },
	}, STYLE.serviceWall)
	-- Muro sur: cruce del corredor sur + puertas de mantenimiento.
	wallRun(service, "MuroSur", "x", -92, 92, 38, {
		{ center = 0, width = 12, height = 9 },
		{ center = -60, width = 4, height = 7 },
		{ center = 60, width = 4, height = 7 },
	}, STYLE.serviceWall)
	wallRun(service, "MuroOeste", "z", 30, 38, -92, nil, STYLE.serviceWall)
	wallRun(service, "MuroEste", "z", 30, 38, 92, nil, STYLE.serviceWall)

	for x = -84, 84, 24 do
		fixture(service, fixtures, x, 34, "service", Color3.fromRGB(214, 244, 214))
		table.insert(map.patrolPoints, Vector3.new(x, 0, 34))
	end
	for i = 1, 8 do
		clutterBox(service, rng:NextNumber(-80, 80), rng:NextNumber(32, 36))
	end
	makeSign(service, "SOLO PERSONAL AUTORIZADO", CFrame.new(0, 10, 30.6), 14, 1.2, Color3.fromRGB(230, 190, 120), Color3.fromRGB(50, 40, 26), false)

	-- Pasajes de los extremos (conectan espina ↔ servicio).
	for _, px in { -88, 88 } do
		local pass = Instance.new("Folder")
		pass.Name = "Pasaje" .. (px < 0 and "Oeste" or "Este")
		pass.Parent = geo
		local x0, x1 = px - 3.5, px + 3.5
		floorSlab(pass, "Piso", x0, x1, 8, 30, STYLE.serviceFloor)
		ceilSlab(pass, "Techo", x0, x1, 8, 30)
		wallRun(pass, "MuroLateral", "z", 8, 30, x0, nil, STYLE.serviceWall)
		wallRun(pass, "MuroLateral", "z", 8, 30, x1, nil, STYLE.serviceWall)
		fixture(pass, fixtures, px, 19, "corr", Color3.fromRGB(214, 244, 214))
	end

	-- ════ Cuartos de mantenimiento (refugios) ════
	local maint = Instance.new("Folder")
	maint.Name = "Mantenimiento"
	maint.Parent = geo

	for _, cx in { -60, 60 } do
		local m = Instance.new("Model")
		m.Name = "Mantenimiento" .. (cx < 0 and "Oeste" or "Este")
		m.Parent = maint
		local x0, x1 = cx - 6, cx + 6
		local z0, z1 = 38, 50
		floorSlab(m, "Piso", x0, x1, z0, z1, STYLE.serviceFloor)
		ceilSlab(m, "Techo", x0, x1, z0, z1)
		wallRun(m, "MuroLateral", "z", z0, z1, x0, nil, STYLE.serviceWall)
		wallRun(m, "MuroLateral", "z", z0, z1, x1, nil, STYLE.serviceWall)
		wallRun(m, "MuroFondo", "x", x0, x1, z1, nil, STYLE.serviceWall)
		furnishMaintenance(m, x0, x1, z0, z1)
		makeDoor(map, m, cx - 2, 38, 4, 7, STYLE.metalDoor)
		makeSign(m, "MANTENIMIENTO", CFrame.new(cx, 8.2, 38.4), 6, 1, Color3.fromRGB(220, 210, 190), Color3.fromRGB(60, 56, 50), false)
		table.insert(map.refugeRegions, makeRegion(x0 + 1, x1 - 1, z0 + 1, z1 - 1))
	end

	-- ════ Candidatos a sellos de "Corre" ════
	-- Tramos de pasillo donde la entidad puede colocar sus marcas invisibles.
	local function candidate(x0: number, x1: number, z0: number, z1: number, label: string)
		table.insert(map.sealCandidates, { region = makeRegion(x0, x1, z0, z1), label = label })
	end
	for _, cx in { -60, -36, -12, 12, 36, 60 } do
		candidate(cx - 8, cx + 8, -7.5, 7.5, "bazar")
	end
	candidate(-5.5, 5.5, -46, -30, "corredor norte")
	candidate(-5.5, 5.5, -66, -50, "corredor norte")
	candidate(-5.5, 5.5, 12, 26, "corredor sur")
	candidate(-91.5, -84.5, 9, 29, "pasaje oeste")
	candidate(84.5, 91.5, 9, 29, "pasaje este")
	candidate(-40, -14, 30.5, 37.5, "servicio")
	candidate(14, 40, 30.5, 37.5, "servicio")

	-- Helpers expuestos.
	function map.isInRefuge(pos: Vector3): boolean
		for _, region in map.refugeRegions do
			if regionContains(region, pos) then
				return true
			end
		end
		return false
	end

	map.regionCenter = regionCenter

	-- Parpadeo perpetuo del letrero de salida (puro ambiente).
	task.spawn(function()
		while exitSign.Parent do
			task.wait(rng:NextNumber(2, 7))
			for _ = 1, rng:NextInteger(2, 5) do
				exitSign.Transparency = 0.7
				task.wait(0.06)
				exitSign.Transparency = 0
				task.wait(0.09)
			end
		end
	end)

	root.Parent = workspace
	return map
end

return MapBuilder
