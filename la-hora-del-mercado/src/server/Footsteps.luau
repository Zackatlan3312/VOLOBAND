--!strict
-- Pasos de los jugadores. El Sound vive en el personaje y lo reproduce el
-- servidor, así que todos los demás oyen por dónde anda cada quien: correr
-- se escucha desde mucho más lejos que caminar.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local SoundBank = require(ReplicatedStorage.Shared.SoundBank)

local Footsteps = {}

local function attach(char: Model)
	local root = char:WaitForChild("HumanoidRootPart", 10) :: BasePart?
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not root or not hum then
		return
	end

	local step = SoundBank.make(root, "Step", {
		Volume = 0.3,
		RollOffMaxDistance = 45,
		RollOffMinDistance = 4,
		Name = "Paso",
	})

	task.spawn(function()
		while char.Parent and hum.Health > 0 do
			local v = root.AssemblyLinearVelocity
			local speed = Vector3.new(v.X, 0, v.Z).Magnitude
			if speed > 1.5 then
				local running = speed > Config.WalkSpeed + 1
				step.Volume = running and 0.6 or 0.28
				step.PlaybackSpeed = running and 1.15 or 0.9
				step.RollOffMaxDistance = running and 90 or 45
				step:Play()
				-- Un paso cada ~4 studs recorridos.
				task.wait(math.clamp(4 / speed, 0.22, 0.7))
			else
				task.wait(0.2)
			end
		end
	end)
end

function Footsteps.init()
	local function hook(player: Player)
		player.CharacterAdded:Connect(attach)
		if player.Character then
			attach(player.Character)
		end
	end
	for _, player in Players:GetPlayers() do
		hook(player)
	end
	Players.PlayerAdded:Connect(hook)
end

return Footsteps
