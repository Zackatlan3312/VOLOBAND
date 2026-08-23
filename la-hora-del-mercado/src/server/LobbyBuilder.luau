--!strict
-- El vestíbulo: "La Vecindad".
--
-- Un patio techado de edificio de departamentos, cálido y siempre iluminado,
-- muy por encima del bazar para que la iluminación de la noche no lo alcance.
-- Es el lugar seguro donde se espera turno, se leen los controles y se ve
-- cómo le fue al equipo la ronda pasada.
--
-- Al fondo hay una reja metálica con el letrero "AL BAZAR": pararse frente a
-- ella es la forma de decir "yo entro".

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)

local LobbyBuilder = {}

local O = Config.Lobby.Origin
local W, D, H = 76, 56, 22 -- ancho (X), fondo (Z), alto

local STYLE = {
	floor = { Color3.fromRGB(158, 148, 134), Enum.Material.Concrete },
	tile = { Color3.fromRGB(138, 106, 84), Enum.Material.Concrete },
	wall = { Color3.fromRGB(206, 178, 140), Enum.Material.Concrete },
	wallAlt = { Color3.fromRGB(176, 148, 118), Enum.Material.Concrete },
	roof = { Color3.fromRGB(92, 88, 84), Enum.Material.Slate },
	metal = { Color3.fromRGB(96, 102, 108), Enum.Material.DiamondPlate },
	wood = { Color3.fromRGB(112, 84, 58), Enum.Material.Wood },
	plant = { Color3.fromRGB(56, 100, 58), Enum.Material.Grass },
	pot = { Color3.fromRGB(150, 88, 62), Enum.Material.Concrete },
}

local rng = Random.new()

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

-- Panel de texto colgado en la pared.
local function board(parent: Instance, title: string, body: string, cf: CFrame, width: number, height: number): TextLabel
	local frame = part(parent, "Tablero", Vector3.new(width, height, 0.4), cf, STYLE.wood, { CanCollide = false })

	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.CanvasSize = Vector2.new(width * 42, height * 42)
	gui.LightInfluence = 0.25
	gui.Brightness = 1.4

	local bg = Instance.new("Frame")
	bg.Size = UDim2.fromScale(1, 1)
	bg.BackgroundColor3 = Color3.fromRGB(28, 26, 24)
	bg.BorderSizePixel = 0
	bg.Parent = gui

	local pad = Instance.new("UIPadding")
	for _, side in { "PaddingTop", "PaddingBottom", "PaddingLeft", "PaddingRight" } do
		(pad :: any)[side] = UDim.new(0.05, 0)
	end
	pad.Parent = bg

	local layout = Instance.new("UIListLayout")
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0.03, 0)
	layout.Parent = bg

	local head = Instance.new("TextLabel")
	head.Size = UDim2.fromScale(1, 0.2)
	head.BackgroundTransparency = 1
	head.Font = Enum.Font.Oswald
	head.TextScaled = true
	head.TextColor3 = Color3.fromRGB(232, 196, 128)
	head.TextXAlignment = Enum.TextXAlignment.Left
	head.Text = title
	head.LayoutOrder = 1
	head.Parent = bg

	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(1, 0.76)
	text.BackgroundTransparency = 1
	text.Font = Enum.Font.Gotham
	text.TextScaled = true
	text.TextColor3 = Color3.fromRGB(214, 208, 196)
	text.TextXAlignment = Enum.TextXAlignment.Left
	text.TextYAlignment = Enum.TextYAlignment.Top
	text.TextWrapped = true
	text.Text = body
	text.LayoutOrder = 2
	text.Parent = bg

	gui.Parent = frame
	return text
end

local function warmLight(parent: Instance, offset: Vector3, brightness: number, range: number, color: Color3?)
	local bulb = part(parent, "Foco", Vector3.new(0.6, 0.6, 0.6), CFrame.new(O + offset), {
		color or Color3.fromRGB(255, 226, 170),
		Enum.Material.Neon,
	}, { CanCollide = false, CanQuery = false })
	local light = Instance.new("PointLight")
	light.Color = color or Color3.fromRGB(255, 214, 156)
	light.Brightness = brightness
	light.Range = range
	light.Shadows = true
	light.Parent = bulb
	return bulb
end

function LobbyBuilder.build()
	local root = Instance.new("Model")
	root.Name = "Vestibulo"

	local lobby = {} :: any
	lobby.model = root
	lobby.origin = O

	-- ── Suelo, techo y muros ──
	part(root, "Piso", Vector3.new(W, 1, D), CFrame.new(O + Vector3.new(0, -0.5, 0)), STYLE.floor)
	part(root, "Techo", Vector3.new(W, 1, D), CFrame.new(O + Vector3.new(0, H + 0.5, 0)), STYLE.roof)

	-- Un damero de losetas para que el piso no sea una plancha lisa.
	for x = -W / 2 + 4, W / 2 - 4, 8 do
		for z = -D / 2 + 4, D / 2 - 4, 8 do
			if (math.floor(x / 8) + math.floor(z / 8)) % 2 == 0 then
				part(root, "Loseta", Vector3.new(7.6, 0.08, 7.6), CFrame.new(O + Vector3.new(x, 0.04, z)), STYLE.tile, {
					CanCollide = false,
					CanQuery = false,
				})
			end
		end
	end

	part(root, "MuroNorte", Vector3.new(W, H, 1), CFrame.new(O + Vector3.new(0, H / 2, -D / 2)), STYLE.wall)
	part(root, "MuroOeste", Vector3.new(1, H, D), CFrame.new(O + Vector3.new(-W / 2, H / 2, 0)), STYLE.wall)
	part(root, "MuroEste", Vector3.new(1, H, D), CFrame.new(O + Vector3.new(W / 2, H / 2, 0)), STYLE.wall)

	-- Muro sur partido en dos para dejar el hueco de la reja.
	local gateW = 14
	for _, side in { -1, 1 } do
		local segW = (W - gateW) / 2
		part(
			root,
			"MuroSur",
			Vector3.new(segW, H, 1),
			CFrame.new(O + Vector3.new(side * (gateW / 2 + segW / 2), H / 2, D / 2)),
			STYLE.wall
		)
	end
	part(root, "DintelSur", Vector3.new(gateW, H - 12, 1), CFrame.new(O + Vector3.new(0, 12 + (H - 12) / 2, D / 2)), STYLE.wall)

	-- ── Fachadas de departamentos: dos niveles con puertas y ventanas ──
	for level = 0, 1 do
		local y = 1 + level * 10
		-- Balcón del segundo nivel.
		if level == 1 then
			part(root, "Balcon", Vector3.new(W - 4, 0.6, 4), CFrame.new(O + Vector3.new(0, y - 0.3, -D / 2 + 3)), STYLE.wall)
			part(root, "Barandal", Vector3.new(W - 4, 2.4, 0.3), CFrame.new(O + Vector3.new(0, y + 1.2, -D / 2 + 5)), STYLE.metal, {
				Transparency = 0.35,
			})
		end
		for i = -2, 2 do
			local x = i * 13
			part(root, "PuertaDepto", Vector3.new(4.4, 7.5, 0.4), CFrame.new(O + Vector3.new(x, y + 3.75, -D / 2 + 0.7)), STYLE.wood, {
				CanCollide = false,
			})
			part(root, "Ventana", Vector3.new(3.4, 3.4, 0.3), CFrame.new(O + Vector3.new(x + 6.5, y + 5, -D / 2 + 0.7)), {
				Color3.fromRGB(150, 178, 190),
				Enum.Material.Glass,
			}, { Transparency = 0.45, CanCollide = false })
			-- Número de puerta.
			local plate = part(root, "Numero", Vector3.new(1.1, 0.9, 0.2), CFrame.new(O + Vector3.new(x + 2.6, y + 6.6, -D / 2 + 0.85)), STYLE.metal, {
				CanCollide = false,
			})
			local sg = Instance.new("SurfaceGui")
			sg.Face = Enum.NormalId.Front
			sg.CanvasSize = Vector2.new(60, 50)
			sg.LightInfluence = 0.5
			local lb = Instance.new("TextLabel")
			lb.Size = UDim2.fromScale(1, 1)
			lb.BackgroundTransparency = 1
			lb.Font = Enum.Font.Oswald
			lb.TextScaled = true
			lb.TextColor3 = Color3.fromRGB(228, 220, 200)
			lb.Text = tostring((level + 1) * 100 + (i + 3))
			lb.Parent = sg
			sg.Parent = plate
		end
	end

	-- Escalera al segundo nivel.
	for stepIndex = 0, 11 do
		part(
			root,
			"Escalon",
			Vector3.new(6, 0.9, 1.6),
			CFrame.new(O + Vector3.new(-W / 2 + 5, 0.45 + stepIndex * 0.9, -D / 2 + 8 + stepIndex * 1.6)),
			STYLE.wall
		)
	end

	-- ── Reja al bazar ──
	local gateY = 6
	local gate = part(root, "Reja", Vector3.new(gateW - 0.6, 12, 0.7), CFrame.new(O + Vector3.new(0, gateY, D / 2)), STYLE.metal, {
		Transparency = 0.15,
	})
	lobby.gate = gate
	lobby.gateClosedCF = gate.CFrame
	lobby.gateOpenCF = gate.CFrame * CFrame.new(0, 11.4, 0)

	local gateSound = SoundBank.make(gate, "Metal", { Volume = 0.8, RollOffMaxDistance = 90, Name = "Reja" })

	function lobby.setGateOpen(open: boolean)
		if gateSound then
			gateSound:Play()
		end
		TweenService:Create(gate, TweenInfo.new(2.2, Enum.EasingStyle.Sine), {
			CFrame = open and lobby.gateOpenCF or lobby.gateClosedCF,
		}):Play()
	end

	-- Letrero de la reja.
	local signPart = part(root, "LetreroBazar", Vector3.new(gateW, 2.6, 0.4), CFrame.new(O + Vector3.new(0, 13.6, D / 2 - 0.5)), {
		Color3.fromRGB(46, 32, 24),
		Enum.Material.SmoothPlastic,
	}, { CanCollide = false })
	local signGui = Instance.new("SurfaceGui")
	signGui.Face = Enum.NormalId.Back
	signGui.CanvasSize = Vector2.new(gateW * 44, 2.6 * 44)
	signGui.LightInfluence = 0
	signGui.Brightness = 2
	local signLabel = Instance.new("TextLabel")
	signLabel.Size = UDim2.fromScale(1, 1)
	signLabel.BackgroundTransparency = 1
	signLabel.Font = Enum.Font.Oswald
	signLabel.TextScaled = true
	signLabel.TextColor3 = Color3.fromRGB(255, 196, 120)
	signLabel.Text = "AL BAZAR"
	signLabel.Parent = signGui
	signGui.Parent = signPart

	-- ── Zona de "estoy listo" frente a la reja ──
	local zoneCenter = O + Vector3.new(0, 0, D / 2 - 9)
	local zoneSize = Vector3.new(gateW + 4, 0.12, 12)
	part(root, "ZonaListo", zoneSize, CFrame.new(zoneCenter + Vector3.new(0, 0.06, 0)), {
		Color3.fromRGB(226, 176, 92),
		Enum.Material.Neon,
	}, { CanCollide = false, CanQuery = false, Transparency = 0.72 })

	lobby.readyZone = {
		x0 = zoneCenter.X - zoneSize.X / 2,
		x1 = zoneCenter.X + zoneSize.X / 2,
		z0 = zoneCenter.Z - zoneSize.Z / 2,
		z1 = zoneCenter.Z + zoneSize.Z / 2,
		y0 = O.Y - 4,
		y1 = O.Y + 12,
	}

	-- Cartel flotante con el conteo de listos.
	local anchor = part(root, "AnclaConteo", Vector3.new(0.4, 0.4, 0.4), CFrame.new(zoneCenter + Vector3.new(0, 9, 0)), STYLE.metal, {
		CanCollide = false,
		CanQuery = false,
		Transparency = 1,
	})
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(420, 90)
	bb.AlwaysOnTop = false
	bb.MaxDistance = 90
	local readyLabel = Instance.new("TextLabel")
	readyLabel.Size = UDim2.fromScale(1, 1)
	readyLabel.BackgroundTransparency = 1
	readyLabel.Font = Enum.Font.Oswald
	readyLabel.TextScaled = true
	readyLabel.TextColor3 = Color3.fromRGB(238, 204, 140)
	readyLabel.TextStrokeTransparency = 0.5
	readyLabel.Text = "Párate aquí para entrar"
	readyLabel.Parent = bb
	bb.Parent = anchor
	lobby.readyLabel = readyLabel

	-- ── Tableros ──
	board(
		root,
		"CÓMO SE JUEGA",
		"Recoge tu encargo en el local que te toque y vuelve a tu departamento antes de las 23:59.\n\n"
			.. "Después de esa hora, el bazar deja de ser un bazar.\n\n"
			.. "Nadie está a salvo en los pasillos: los departamentos y los cuartos de mantenimiento sí.",
		CFrame.new(O + Vector3.new(-W / 2 + 1.4, 11, -6)) * CFrame.Angles(0, math.rad(90), 0),
		18,
		11
	)

	board(
		root,
		"CONTROLES",
		"W A S D — caminar\n"
			.. "SHIFT — correr (hace ruido, y hay pasillos donde correr mata)\n"
			.. "F — linterna\n"
			.. "E — abrir puertas, mover persianas, recoger el encargo\n"
			.. "CLIC — al morir, cambiar de compañero al que ves",
		CFrame.new(O + Vector3.new(W / 2 - 1.4, 11, -6)) * CFrame.Angles(0, math.rad(-90), 0),
		18,
		11
	)

	lobby.resultsLabel = board(
		root,
		"ÚLTIMA NOCHE",
		"Todavía no ha pasado nada.\n\nEl bazar abre a las 18:00.",
		CFrame.new(O + Vector3.new(0, 11, -D / 2 + 1.4)),
		20,
		11
	)

	-- ── Ambiente: luces, plantas, tendedero, tinaco ──
	for _, x in { -22, 0, 22 } do
		warmLight(root, Vector3.new(x, H - 3, -8), 1.5, 34)
	end
	warmLight(root, Vector3.new(0, H - 5, D / 2 - 12), 1.2, 30, Color3.fromRGB(255, 198, 132))

	-- Serie de foquitos cruzando el patio.
	for i = 0, 10 do
		local t = i / 10
		local x = -W / 2 + 6 + t * (W - 12)
		local sag = math.sin(t * math.pi) * 2.2
		part(root, "Cable", Vector3.new(3.4, 0.12, 0.12), CFrame.new(O + Vector3.new(x, H - 6 + 2.2 - sag, 4)), {
			Color3.fromRGB(40, 38, 36),
			Enum.Material.SmoothPlastic,
		}, { CanCollide = false, CanQuery = false })
		if i % 2 == 0 then
			local bulb = part(root, "Foquito", Vector3.new(0.5, 0.7, 0.5), CFrame.new(O + Vector3.new(x, H - 6.6 + 2.2 - sag, 4)), {
				Color3.fromRGB(255, 208, 140),
				Enum.Material.Neon,
			}, { CanCollide = false, CanQuery = false })
			local pl = Instance.new("PointLight")
			pl.Color = Color3.fromRGB(255, 190, 120)
			pl.Brightness = 0.65
			pl.Range = 15
			pl.Parent = bulb
		end
	end

	-- Macetas.
	for _, pos in { Vector3.new(-26, 0, 10), Vector3.new(26, 0, 10), Vector3.new(-30, 0, -14), Vector3.new(30, 0, -14) } do
		part(root, "Maceta", Vector3.new(3.4, 3, 3.4), CFrame.new(O + pos + Vector3.new(0, 1.5, 0)), STYLE.pot)
		part(root, "Planta", Vector3.new(4.2, 5, 4.2), CFrame.new(O + pos + Vector3.new(0, 5.4, 0)), STYLE.plant, {
			CanCollide = false,
		})
	end

	-- Bancas.
	for _, x in { -14, 14 } do
		part(root, "Banca", Vector3.new(9, 1.4, 3), CFrame.new(O + Vector3.new(x, 2.4, -16)), STYLE.wood)
		for _, dx in { -3.5, 3.5 } do
			part(root, "PataBanca", Vector3.new(0.8, 2.4, 2.6), CFrame.new(O + Vector3.new(x + dx, 1.2, -16)), STYLE.metal)
		end
	end

	-- Tendedero con ropa colgada.
	for i = 0, 5 do
		local x = -18 + i * 7
		part(root, "Ropa", Vector3.new(3.2, 4.4, 0.2), CFrame.new(O + Vector3.new(x, 13.5, -20)) * CFrame.Angles(0, 0, rng:NextNumber(-0.06, 0.06)), {
			Color3.fromHSV(rng:NextNumber(), 0.32, 0.82),
			Enum.Material.Fabric,
		}, { CanCollide = false, CanQuery = false })
	end
	part(root, "Cuerda", Vector3.new(46, 0.1, 0.1), CFrame.new(O + Vector3.new(0, 15.8, -20)), {
		Color3.fromRGB(190, 182, 160),
		Enum.Material.SmoothPlastic,
	}, { CanCollide = false, CanQuery = false })

	-- Tinaco en el techo del segundo nivel.
	part(root, "Tinaco", Vector3.new(6, 5, 6), CFrame.new(O + Vector3.new(-W / 2 + 12, 13.5, -D / 2 + 6)), {
		Color3.fromRGB(30, 30, 34),
		Enum.Material.Plastic,
	})

	-- ── Puntos de aparición ──
	lobby.spawnPoints = {}
	for i = 1, 8 do
		local angle = (i / 8) * math.pi * 2
		local pos = O + Vector3.new(math.cos(angle) * 13, 3.5, math.sin(angle) * 9 - 6)
		-- Todos miran hacia la reja.
		table.insert(lobby.spawnPoints, CFrame.lookAt(pos, Vector3.new(O.X, pos.Y, O.Z + D / 2)))
	end

	function lobby.spawnCFrame(index: number): CFrame
		local list = lobby.spawnPoints
		return list[((index - 1) % #list) + 1]
	end

	function lobby.contains(position: Vector3): boolean
		local zone = lobby.readyZone
		return position.X >= zone.x0
			and position.X <= zone.x1
			and position.Z >= zone.z0
			and position.Z <= zone.z1
			and position.Y >= zone.y0
			and position.Y <= zone.y1
	end

	root.Parent = workspace
	lobby.setGateOpen(false)
	return lobby
end

return LobbyBuilder
