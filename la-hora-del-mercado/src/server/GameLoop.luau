--!strict
-- Orquestador de la partida.
--
--   Vestíbulo → (alguien se para frente a la reja) → cuenta atrás →
--   TARDE → CIERRE → HORA PROHIBIDA → resultados → Vestíbulo
--
-- Solo entran al bazar quienes se pararon frente a la reja. El resto se queda
-- en la vecindad, y quien muere vuelve ahí a los pocos segundos: el vestíbulo
-- es el sitio al que siempre se regresa.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)

local PlayerSession = require(script.Parent.PlayerSession)
local LightingRig = require(script.Parent.LightingRig)
local NPCSystem = require(script.Parent.NPCSystem)
local MusicDirector = require(script.Parent.MusicDirector)
local LobbySystem = require(script.Parent.LobbySystem)
local ElViejo = require(script.Parent.Entities.ElViejo)
local Corre = require(script.Parent.Entities.Corre)

local GameLoop = {}

local rng = Random.new()
local map: any
local viejo: any = nil
local packagesFolder: Folder? = nil
local assignments: { [Player]: number } = {}
local roundPlayers: { [Player]: boolean } = {}
local roundActive = false
local currentState = "LOBBY"
local currentPhase = "LOBBY"

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

local function inRound(player: Player): boolean
	return roundPlayers[player] == true
end

-- ── Departamentos y encargos ─────────────────────────────────────────────────

local function assignApartment(player: Player, index: number): number
	local idx = ((index - 1) % #map.apartments) + 1
	assignments[player] = idx
	PlayerSession.get(player).aptIndex = idx
	return idx
end

local function placePackages(players: { Player })
	packagesFolder = Instance.new("Folder")
	packagesFolder.Name = "Encargos"
	packagesFolder.Parent = map.model

	local pool = table.clone(map.locales)
	for i = #pool, 2, -1 do
		local j = rng:NextInteger(1, i)
		pool[i], pool[j] = pool[j], pool[i]
	end

	for i, player in players do
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
				if not inRound(player) then
					continue
				end
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

local function runPhase(name: string, onTick: ((number) -> ())?, earlyEnd: (() -> boolean)?): boolean
	local duration = Config.PhaseDurations[name]
	local range = Config.ClockRanges[name]
	currentPhase = name
	Remotes.get("Phase"):FireAllClients(name)
	MusicDirector.setPhase(name)

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

-- ¿Ya no queda nadie afuera? (muerto o en casa cuenta como resuelto)
local function everyoneResolved(): boolean
	for player in roundPlayers do
		if player.Parent then
			local st = PlayerSession.get(player)
			if not st.dead and not st.safe then
				return false
			end
		end
	end
	return true
end

-- ── Ronda ────────────────────────────────────────────────────────────────────

local function runRound(players: { Player })
	roundActive = true
	PlayerSession.resetAll()
	table.clear(assignments)
	table.clear(roundPlayers)

	for _, locale in map.locales do
		locale.persiana:open()
		LightingRig.localeOn(locale.fixture)
	end

	for i, player in players do
		roundPlayers[player] = true
		LobbySystem.markLeft(player)
		local idx = assignApartment(player, i)
		PlayerSession.spawnAt(player, map.apartments[idx].spawnCF)
	end

	LightingRig.setPhase("TARDE")
	NPCSystem.spawnAll()
	viejo = ElViejo.new(map)
	Corre.setup()
	placePackages(players)
	watchHomecoming()

	ambience.Volume = 0.35
	nightAmbience.Volume = 0

	currentState = "ROUND"
	Remotes.get("RoundState"):FireAllClients("ROUND")
	toastAll("La tarde cae sobre el Bazar El Centenario.", "info")

	-- ── TARDE ──
	runPhase("TARDE")

	-- ── CIERRE ──
	viejo:setPhase("CIERRE")
	NPCSystem.setPhase("CIERRE")
	LightingRig.setPhase("CIERRE")
	SoundBank.playAt(Vector3.new(0, 8, 0), "Chime", 0.8, 400)
	toastAll("«Estimados clientes: el bazar cerrará en unos minutos.»", "pa")

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
				table.insert(closeOrder, locale)
				table.insert(closeTimes, math.max(elapsed + 20, cierreDur - 20))
			else
				locale.persiana:close()
				LightingRig.localeOff(locale.fixture)
			end
		end
	end)

	-- ── HORA PROHIBIDA ──
	ambience.Volume = 0.05
	nightAmbience.Volume = 0.4
	LightingRig.setPhase("PROHIBIDA")
	NPCSystem.setPhase("PROHIBIDA")
	viejo:setPhase("PROHIBIDA")
	MusicDirector.sting(-24, 0.6)
	for _, locale in map.locales do
		if not locale.persiana.closed then
			locale.persiana:close()
			LightingRig.localeOff(locale.fixture)
		end
	end
	toastAll("23:59. No deberías estar afuera.", "danger")
	Remotes.get("Subtitle"):FireAllClients("Algo cambió en el aire.")

	local timedOut = runPhase("PROHIBIDA", nil, everyoneResolved)

	if timedOut then
		for player in roundPlayers do
			local st = PlayerSession.get(player)
			if player.Parent and not st.dead and not st.safe then
				PlayerSession.kill(player, "noche")
			end
		end
	end

	-- ── Resultados ──
	roundActive = false
	currentState = "RESULTS"
	Remotes.get("RoundState"):FireAllClients("RESULTS")
	MusicDirector.setPhase("RESULTS")

	local survivors, fullWins, deaths = 0, 0, 0
	local lines: { string } = {}
	for player in roundPlayers do
		local st = PlayerSession.get(player)
		if st.safe then
			survivors += 1
			if st.hasPackage then
				fullWins += 1
				table.insert(lines, "✔ " .. player.DisplayName .. " — volvió con su encargo")
			else
				table.insert(lines, "· " .. player.DisplayName .. " — volvió sin el encargo")
			end
		else
			deaths += 1
			local cause = st.deathCause or "desconocido"
			local how = ({
				viejo = "se lo llevó El Viejo",
				corre = "corrió donde no debía",
				noche = "no volvió a casa",
			})[cause] or "se perdió en el bazar"
			table.insert(lines, "✕ " .. player.DisplayName .. " — " .. how)
		end
	end

	if survivors == 0 then
		toastAll("Nadie volvió a casa esta noche.", "danger")
	elseif deaths == 0 and fullWins == survivors then
		toastAll("Todos volvieron a casa con su encargo. Esta vez.", "good")
	else
		toastAll(("Sobrevivieron %d. El bazar se quedó con %d."):format(survivors, deaths), "info")
	end

	table.sort(lines)
	LobbySystem.setResults(#lines > 0 and table.concat(lines, "\n") or "Nadie entró al bazar.")

	task.wait(6)

	-- ── Limpieza y vuelta al vestíbulo ──
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
	ambience.Volume = 0
	nightAmbience.Volume = 0

	for player in roundPlayers do
		if player.Parent then
			LobbySystem.send(player)
		end
	end
	table.clear(roundPlayers)
end

-- ── Espera en el vestíbulo ───────────────────────────────────────────────────

-- Devuelve la lista de jugadores que entran, o nil si se cortó la cuenta.
local function waitForReady(): { Player }?
	LobbySystem.setGateOpen(false)
	LobbySystem.setReadyText("Párate aquí para entrar")

	-- Espera a que alguien se plante frente a la reja.
	while #LobbySystem.getReady() == 0 do
		task.wait(0.5)
	end

	for remaining = Config.Lobby.ReadyCountdown, 1, -1 do
		local ready = LobbySystem.getReady()
		if #ready == 0 then
			LobbySystem.setReadyText("Se echaron para atrás.")
			task.wait(1.5)
			return nil
		end
		LobbySystem.setReadyText(("%d listo%s — entran en %d"):format(#ready, #ready == 1 and "" or "s", remaining))
		if remaining <= 3 then
			SoundBank.playAt(Config.Lobby.Origin, "Click", 0.5, 120)
		end
		task.wait(1)
	end

	local final = LobbySystem.getReady()
	if #final == 0 then
		return nil
	end
	LobbySystem.setReadyText("Se abrió la reja.")
	LobbySystem.setGateOpen(true)
	task.wait(2)
	return final
end

-- ── Arranque ─────────────────────────────────────────────────────────────────

function GameLoop.start(builtMap: any, builtLobby: any)
	map = builtMap

	ambience = SoundBank.make(workspace, "Drone", {
		Volume = 0,
		Looped = true,
		PlaybackSpeed = 0.45,
		Name = "AmbienteBazar",
	})
	ambience:Play()
	nightAmbience = SoundBank.make(workspace, "Drone", {
		Volume = 0,
		Looped = true,
		PlaybackSpeed = 0.22,
		Name = "AmbienteNoche",
	})
	nightAmbience:Play()

	-- Quien muere vuelve al vestíbulo tras la pantalla de muerte.
	PlayerSession.onDeath = function(player: Player)
		task.delay(Config.Lobby.DeathReturnDelay, function()
			if player.Parent and not LobbySystem.isInLobby(player) then
				LobbySystem.send(player)
			end
		end)
	end

	-- El cliente avisa cuando ya está escuchando; le contamos dónde estamos.
	Remotes.get("Hello").OnServerEvent:Connect(function(player: Player)
		Remotes.get("Phase"):FireClient(player, currentPhase)
		if LobbySystem.isInLobby(player) then
			Remotes.get("RoundState"):FireClient(player, "LOBBY")
			Remotes.get("Objective"):FireClient(player, "Párate frente a la reja para entrar al siguiente turno.")
		elseif inRound(player) then
			Remotes.get("RoundState"):FireClient(player, currentState)
		else
			Remotes.get("RoundState"):FireClient(player, "SPECTATE")
		end
	end)

	Players.PlayerAdded:Connect(function(player)
		LobbySystem.send(player)
		Remotes.get("Toast"):FireClient(player, "Bienvenido a la vecindad. Lee los tableros.", "info")
	end)

	Players.PlayerRemoving:Connect(function(player)
		assignments[player] = nil
		roundPlayers[player] = nil
	end)

	for _, player in Players:GetPlayers() do
		LobbySystem.send(player)
	end

	task.spawn(function()
		while true do
			-- Vestíbulo.
			currentState = "LOBBY"
			currentPhase = "LOBBY"
			Remotes.get("Phase"):FireAllClients("LOBBY")
			MusicDirector.setPhase("LOBBY")
			LightingRig.setPhase("TARDE")
			for _, player in Players:GetPlayers() do
				if not LobbySystem.isInLobby(player) then
					LobbySystem.send(player)
				end
			end

			local players = waitForReady()
			if players then
				local ok, err = pcall(runRound, players)
				if not ok then
					warn("[LaHoraDelMercado] Error en la ronda: " .. tostring(err))
					roundActive = false
					-- Pase lo que pase, nadie se queda atrapado en el bazar.
					for _, player in Players:GetPlayers() do
						if not LobbySystem.isInLobby(player) then
							LobbySystem.send(player)
						end
					end
				end
			end
			task.wait(1)
		end
	end)
end

return GameLoop
