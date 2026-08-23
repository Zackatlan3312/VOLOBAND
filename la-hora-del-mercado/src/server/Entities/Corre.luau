--!strict
-- CORRE. "No corras."
-- Cada partida marca algunos pasillos con sellos invisibles. Si un jugador
-- los atraviesa corriendo, muere al instante. Las únicas pistas son un
-- brillo casi imperceptible en el piso y un susurro al acercarse.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundUtil = require(ReplicatedStorage.Shared.SoundUtil)
local PlayerSession = require(script.Parent.Parent.PlayerSession)

local Corre = {}

local rng = Random.new()
local map: any
local folder: Folder? = nil
local activeSeals: { { region: any, part: Part } } = {}
local running = false

function Corre.init(builtMap: any)
	map = builtMap
end

function Corre.setup()
	Corre.cleanup()

	folder = Instance.new("Folder")
	folder.Name = "Seals"
	folder.Parent = map.model

	-- Elige pasillos sellados al azar (distintos en cada partida).
	local pool = table.clone(map.sealCandidates)
	for i = #pool, 2, -1 do
		local j = rng:NextInteger(1, i)
		pool[i], pool[j] = pool[j], pool[i]
	end

	for i = 1, math.min(Config.Corre.SealCount, #pool) do
		local candidate = pool[i]
		local region = candidate.region
		local center = map.regionCenter(region)
		local sizeX = region.x1 - region.x0
		local sizeZ = region.z1 - region.z0

		-- Marca sutil en el piso: una veladura rojiza casi invisible.
		local mark = Instance.new("Part")
		mark.Name = "CorreSeal"
		mark.Anchored = true
		mark.CanCollide = false
		mark.CanQuery = false
		mark.CanTouch = false
		mark.Size = Vector3.new(sizeX, 0.1, sizeZ)
		mark.Position = Vector3.new(center.X, 0.06, center.Z)
		mark.Color = Color3.fromRGB(64, 10, 12)
		mark.Material = Enum.Material.Neon
		mark.Transparency = 0.92
		mark.Parent = folder

		local whisper = SoundUtil.make(mark, Config.Sounds.Whisper, {
			Volume = 0.35,
			Looped = true,
			RollOffMaxDistance = Config.Corre.WhisperRadius + 6,
			RollOffMinDistance = 2,
			Name = "Susurro",
		})
		whisper:Play()

		table.insert(activeSeals, { region = region, part = mark })
	end

	-- Vigilancia: matar a quien corra dentro de un sello.
	running = true
	task.spawn(function()
		while running do
			task.wait(0.12)
			for _, player in Players:GetPlayers() do
				local st = PlayerSession.get(player)
				if st.dead or st.safe then
					continue
				end
				local char = player.Character
				local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
				if not root then
					continue
				end
				for _, seal in activeSeals do
					if map.regionContains(seal.region, root.Position) then
						local v = root.AssemblyLinearVelocity
						local speed = Vector3.new(v.X, 0, v.Z).Magnitude
						if speed > Config.RunDeathSpeed then
							SoundUtil.playAt(root.Position, Config.Sounds.Snap, 1, 90)
							PlayerSession.kill(player, "corre")
						end
						break
					end
				end
			end
		end
	end)
end

function Corre.cleanup()
	running = false
	table.clear(activeSeals)
	if folder then
		folder:Destroy()
		folder = nil
	end
end

return Corre
