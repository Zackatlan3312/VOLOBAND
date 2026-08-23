--!strict
-- Orquestador de la partida.
-- Bucle: INTERMISSION → TARDE → CIERRE → HORA PROHIBIDA → RESULTADOS → ...
-- Gestiona el reloj del juego, el cierre escalonado de persianas, los
-- encargos (objetivo), la detección de "llegó a casa" y el fin de ronda.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local SoundUtil = require(ReplicatedStorage.Shared.SoundUtil)

local PlayerSession = require(script.Parent.PlayerSession)
local LightingRig = require(script.Parent.LightingRig)
local NPCSystem = require(script.Parent.NPCSystem)
local ElViejo = require(script.Parent.Entities.ElViejo)
local Corre = require(script.Parent.Entities.Corre)

local GameLoop = {}

local rng = Random.new()
local map: any
local viejo: any = nil
local packagesFolder: Folder? = nil
local assignments: { [Player]: number } = {} -- jugador → índice de departamento
local roundActive = false

local ambience: Sound
local nightAmbience: Sound

-- ── Utilidades ───────────────────────────────────────────────────────────────

local function toastAll(msg: string, kind: string?)
	Remotes.get("Toast"):FireAllClients(msg, kind or "info")
end

local function formatClock(totalMinutes: number): (number, number)
	local m = math.floor(totalMinutes) % (24 * 60)
	return math.floor(m / 60), m % 60
end

-- ── Asignación de departamentos ──────────────────────────────────────────────

local function assignApartment(player: Player): number
	local used = {}
	for _, idx in assignments do
		used[idx] = true
	end
	for i = 1, #map.apartments do
		if not used[i] then
			assignments[player] = i
			return i
		end
	end
	-- Más jugadores que departamentos: comparte el último.
	assignments[player] = #map.apartments
	return #map.apartments
end

local function spawnInApartment(player: Player)
	local idx = assignments[player] or assignApartment(player)
	local apt = map.apartments[idx]
	PlayerSession.get(player).aptIndex = idx
	PlayerSession.spawnAt(player, apt.spawnCF)
end

-- ── Encargos (objetivo de la ronda) ──────────────────────────────────────────

local function placePackages(playersInRound: { Player })
	packagesFolder = Instance.new("Folder")
	packagesFolder.Name = "Encargos"
	packagesFolder.Parent = map.model

	-- Baraja los locales para repartir un encargo por jugador.
	local pool = table.clone(map.locales)
	for i = #pool, 2, -1 do
		local j = rng:NextInteger(1, i)
		pool[i], pool[j] = pool[j], pool[i]
	end

	for i, player in playersInRound do
		local locale = pool[((i - 1) % #pool) + 1]

		local box = Instance.new("Part")
		box.Name = "Encargo_" .. player.Name
		box.Anchored = true
		box.Size = Vector3.new(1.8, 1.4, 1.4)
		box.Position = locale.packageSpot
		box.Color = Color3.fromRGB(168, 132, 92)
		box.Material = Enum.Material.SmoothPlastic
		box.Parent = packagesFolder

		local gui = Instance.new("BillboardGui")
		gui.Size = UDim2.fromOffset(160, 34)
		gui.StudsOffset = Vector3.new(0, 1.6, 0)
		gui.MaxDistance = 30
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundTransparency = 1
		label.Font = Enum.Font.Gotham
		label.TextScaled = true
		label.TextColor3 = Color3.fromRGB(228, 214, 186)
		label.TextStrokeTransparency = 0.5
		label.Text = "Encargo de " .. player.DisplayName
		label.Parent = gui
		gui.Parent = box

		local prompt = Instance.new("ProximityPrompt")
		prompt.ActionText = "Recoger encargo"
		prompt.ObjectText = locale.name
		prompt.HoldDuration = 1
		prompt.MaxActivationDistance = 7
		prompt.RequiresLineOfSight = false
		prompt.Parent = box

		prompt.Triggered:Connect(function(who)
			if who ~= player then
				Remotes.get("Toast"):FireClient(who, "Ese encargo no es tuyo.", "info")
				return
			end
			local st = PlayerSession.get(player)
			if st.dead then
				return
			end
			st.hasPackage = true
			box:Destroy()
			Remotes.get("Toast"):FireClient(player, "Tienes tu encargo. Ahora vuelve a tu departamento.", "good")
			local apt = map.apartments[st.aptIndex or 1]
			Remotes.get("Objective"):FireClient(player, "Regresa a tu departamento (" .. apt.name .. ") antes de las 23:59.")
		end)

		local st = PlayerSession.get(player)
		st.hasPackage = false
		local apt = map.apartments[st.aptIndex or 1]
		Remotes.get("Objective"):FireClient(
			player,
			('Recoge tu encargo en "%s" y vuelve a tu departamento (%s) antes de las 23:59.'):format(locale.name, apt.name)
		)
	end
end

-- ── Detección de "llegó a casa" ──────────────────────────────────────────────

local function watchHomecoming()
	task.spawn(function()
		while roundActive do
			task.wait(0.4)
			for _, player in Players:GetPlayers() do
				local st = PlayerSession.get(player)
				if st.dead or st.safe or not st.aptIndex then
					continue
				end
				local char = player.Character
				local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
				if not root then
					continue
				end
				local apt = map.apartments[st.aptIndex]
				if map.regionContains(apt.region, root.Position) then
					st.safe = true
					if st.hasPackage then
						toastAll(player.DisplayName .. " llegó a casa con su encargo.", "good")
					else
						toastAll(player.DisplayName .. " llegó a casa... sin su encargo.", "info")
					end
					Remotes.get("Objective"):FireClient(player, "Estás en casa. No salgas.")
				end
			end
		end
	end)
end

-- ── Fases y reloj ────────────────────────────────────────────────────────────

-- Ejecuta una fase: transmite el reloj cada segundo y llama onTick(elapsed).
-- Devuelve true si la fase terminó por tiempo, false si earlyEnd() la cortó.
local function runPhase(name: string, onTick: ((number) -> ())?, earlyEnd: (() -> boolean)?): boolean
	local duration = Config.PhaseDurations[name]
	local range = Config.ClockRanges[name]
	Remotes.get("Phase"):FireAllClients(name)

	local t0 = os.clock()
	local lastWhole = -1
	while true do
		local elapsed = os.clock() - t0
		if elapsed >= duration then
			return true
		end
		if earlyEnd and earlyEnd() then
			return false
		end
		local whole = math.floor(elapsed)
		if whole > lastWhole then
			lastWhole = whole
			local minutes = range[1] + (range[2] - range[1]) * (elapsed / duration)
			local hh, mm = formatClock(minutes)
			Remotes.get("Clock"):FireAllClients(hh, mm)
			if onTick then
				onTick(elapsed)
			end
		end
		task.wait(0.2)
	end
end

local function everyoneResolved(): boolean
	local players = Players:GetPlayers()
	if #players == 0 then
		return true
	end
	for _, player in players do
		local st = PlayerSession.get(player)
		if st.aptIndex and not st.dead and not st.safe then
			return false
		end
	end
	return true
end

-- ── Ronda completa ───────────────────────────────────────────────────────────

local function runRound()
	roundActive = true
	PlayerSession.resetAll()

	-- Reabre todo y reparte jugadores.
	for _, locale in map.locales do
		locale.persiana:open()
		LightingRig.localeOn(locale.fixture)
	end

	assignments = {}
	local playersInRound = Players:GetPlayers()
	for _, player in playersInRound do
		assignApartment(player)
		spawnInApartment(player)
	end

	LightingRig.setPhase("TARDE")
	NPCSystem.spawnAll()
	viejo = ElViejo.new(map)
	Corre.setup()
	placePackages(playersInRound)
	watchHomecoming()

	ambience.Volume = 0.35
	nightAmbience.Volume = 0

	Remotes.get("RoundState"):FireAllClients("ROUND")
	toastAll("La tarde cae sobre el Bazar El Centenario.", "info")

	-- ── TARDE ──
	runPhase("TARDE")

	-- ── CIERRE ──
	viejo:setPhase("CIERRE")
	NPCSystem.setPhase("CIERRE")
	LightingRig.setPhase("CIERRE")
	SoundUtil.playAt(Vector3.new(0, 8, 0), Config.Sounds.Chime, 0.8, 400)
	toastAll("«Estimados clientes: el bazar cerrará en unos minutos.»", "pa")

	-- Cierre escalonado de persianas durante la fase.
	local closeOrder = {}
	for _, locale in map.locales do
		table.insert(closeOrder, locale)
	end
	for i = #closeOrder, 2, -1 do
		local j = rng:NextInteger(1, i)
		closeOrder[i], closeOrder[j] = closeOrder[j], closeOrder[i]
	end
	local cierreDur = Config.PhaseDurations.CIERRE
	local closeTimes = {}
	for i = 1, #closeOrder do
		closeTimes[i] = 8 + (cierreDur - 25) * (i - 1) / math.max(#closeOrder - 1, 1)
	end
	local closedCount = 0

	runPhase("CIERRE", function(elapsed)
		while closedCount < #closeOrder and elapsed >= closeTimes[closedCount + 1] do
			closedCount += 1
			local locale = closeOrder[closedCount]
			-- Los locales con encargos pendientes cierran al final de la fase.
			local hasPendingPackage = false
			if packagesFolder then
				for _, box in packagesFolder:GetChildren() do
					if map.regionContains(locale.region, (box :: Part).Position) then
						hasPendingPackage = true
						break
					end
				end
			end
			if hasPendingPackage and elapsed < cierreDur - 30 then
				table.insert(closeOrder, locale) -- reintenta al final
				table.insert(closeTimes, math.max(elapsed + 20, cierreDur - 20))
			else
				locale.persiana:close()
				LightingRig.localeOff(locale.fixture)
			end
		end
	end)

	-- ── HORA PROHIBIDA ──
	ambience.Volume = 0.05
	nightAmbience.Volume = 0.5
	LightingRig.setPhase("PROHIBIDA")
	NPCSystem.setPhase("PROHIBIDA")
	viejo:setPhase("PROHIBIDA")
	for _, locale in map.locales do
		if not locale.persiana.closed then
			locale.persiana:close()
			LightingRig.localeOff(locale.fixture)
		end
	end
	toastAll("23:59. No deberías estar afuera.", "danger")
	Remotes.get("Subtitle"):FireAllClients("Algo cambió en el aire.")

	local timedOut = runPhase("PROHIBIDA", nil, everyoneResolved)

	-- A quien siga afuera cuando termina la noche, la noche lo reclama.
	if timedOut then
		for _, player in Players:GetPlayers() do
			local st = PlayerSession.get(player)
			if st.aptIndex and not st.dead and not st.safe then
				PlayerSession.kill(player, "noche")
			end
		end
	end

	-- ── RESULTADOS ──
	roundActive = false
	Remotes.get("RoundState"):FireAllClients("RESULTS")

	local survivors, fullWins, deaths = 0, 0, 0
	for _, player in Players:GetPlayers() do
		local st = PlayerSession.get(player)
		if st.aptIndex then
			if st.safe then
				survivors += 1
				if st.hasPackage then
					fullWins += 1
				end
			else
				deaths += 1
			end
		end
	end
	if survivors == 0 then
		toastAll("Nadie volvió a casa esta noche.", "danger")
	elseif deaths == 0 and fullWins == survivors then
		toastAll("Todos volvieron a casa con su encargo. Esta vez.", "good")
	else
		toastAll(("Sobrevivieron %d. El bazar se quedó con %d."):format(survivors, deaths), "info")
	end

	task.wait(8)

	-- Limpieza.
	if viejo then
		viejo:destroy()
		viejo = nil
	end
	Corre.cleanup()
	NPCSystem.cleanup()
	if packagesFolder then
		packagesFolder:Destroy()
		packagesFolder = nil
	end
end

-- ── Bucle exterior ───────────────────────────────────────────────────────────

function GameLoop.start(builtMap: any)
	map = builtMap

	-- Ambiente global (los Sound directamente en Workspace suenan para todos).
	ambience = SoundUtil.make(workspace, Config.Sounds.MallAmbience, { Volume = 0.35, Looped = true, Name = "AmbienteBazar" })
	ambience:Play()
	nightAmbience = SoundUtil.make(workspace, Config.Sounds.NightAmbience, { Volume = 0, Looped = true, Name = "AmbienteNoche" })
	nightAmbience:Play()

	-- Quien entra a mitad de ronda espera como observador.
	Players.PlayerAdded:Connect(function(player)
		if roundActive then
			Remotes.get("Toast"):FireClient(player, "La ronda ya comenzó. Observa hasta la siguiente.", "info")
			Remotes.get("RoundState"):FireClient(player, "SPECTATE")
		else
			assignApartment(player)
			spawnInApartment(player)
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		assignments[player] = nil
	end)

	task.spawn(function()
		while true do
			-- Intermedio: espera jugadores y reparte departamentos.
			Remotes.get("RoundState"):FireAllClients("INTERMISSION")
			Remotes.get("Phase"):FireAllClients("INTERMISSION")
			Remotes.get("Clock"):FireAllClients(17, 45)

			while #Players:GetPlayers() < Config.MinPlayers do
				task.wait(1)
			end

			-- Asegura que todos tengan personaje y departamento.
			for _, player in Players:GetPlayers() do
				if not player.Character then
					assignApartment(player)
					spawnInApartment(player)
				end
			end

			for t = Config.IntermissionTime, 1, -1 do
				if t == Config.IntermissionTime or t == 10 or t <= 5 then
					toastAll(("La ronda comienza en %d..."):format(t), "info")
				end
				task.wait(1)
			end

			local ok, err = pcall(runRound)
			if not ok then
				warn("[LaHoraDelMercado] Error en la ronda: " .. tostring(err))
				roundActive = false
			end
		end
	end)
end

return GameLoop
