--!strict
-- Cámara en primera persona con vida propia: balanceo de pasos, respiración,
-- inclinación al girar y un ligero empuje de FOV al esprintar.
-- Es el módulo dueño de `Humanoid.CameraOffset`; cualquier sacudida se pide
-- con `Camera.shake()` para que no peleen dos sistemas por el mismo valor.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Camera = {}

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

local BASE_FOV = 70
local SPRINT_FOV = 78

local bobPhase = 0
local breathPhase = 0
local shakeAmount = 0
local sprinting = false
local lastYaw = 0
local rollCurrent = 0

function Camera.setSprinting(value: boolean)
	sprinting = value
end

-- Pide una sacudida (0..1). Se disipa sola.
function Camera.shake(amount: number)
	shakeAmount = math.max(shakeAmount, amount)
end

function Camera.init()
	camera.FieldOfView = BASE_FOV

	RunService.RenderStepped:Connect(function(dt)
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		local root = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hum or not root or hum.Health <= 0 then
			return
		end

		local v = root.AssemblyLinearVelocity
		local speed = Vector3.new(v.X, 0, v.Z).Magnitude

		-- Balanceo de pasos: más rápido y más amplio cuanto más se corre.
		local moving = speed > 1
		if moving then
			bobPhase += dt * (speed * 0.85)
		else
			-- Vuelve suavemente al centro al detenerse.
			bobPhase += dt * 2
		end
		local bobStrength = moving and math.clamp(speed / 16, 0.1, 1) or 0
		local bobY = math.sin(bobPhase * 2) * 0.14 * bobStrength
		local bobX = math.cos(bobPhase) * 0.1 * bobStrength

		-- Respiración: siempre presente, más marcada al estar quieto.
		breathPhase += dt * (sprinting and 2.6 or 1.1)
		local breathY = math.sin(breathPhase) * (moving and 0.02 or 0.05)

		-- Inclinación lateral al girar la cabeza.
		local yaw = math.atan2(camera.CFrame.LookVector.X, camera.CFrame.LookVector.Z)
		local dYaw = yaw - lastYaw
		if dYaw > math.pi then
			dYaw -= math.pi * 2
		elseif dYaw < -math.pi then
			dYaw += math.pi * 2
		end
		lastYaw = yaw
		local rollTarget = math.clamp(-dYaw * 2.2, -0.06, 0.06)
		rollCurrent += (rollTarget - rollCurrent) * math.min(dt * 8, 1)

		-- Sacudida puntual (sustos, muerte cercana).
		local shakeX, shakeY = 0, 0
		if shakeAmount > 0.001 then
			shakeX = (math.random() - 0.5) * shakeAmount * 1.2
			shakeY = (math.random() - 0.5) * shakeAmount * 1.2
			shakeAmount = math.max(0, shakeAmount - dt * 1.6)
		end

		hum.CameraOffset = Vector3.new(bobX + shakeX, bobY + breathY + shakeY, 0)

		-- FOV: el esprint "empuja" la vista hacia adelante.
		local targetFov = sprinting and moving and SPRINT_FOV or BASE_FOV
		camera.FieldOfView += (targetFov - camera.FieldOfView) * math.min(dt * 4, 1)

		-- La inclinación se aplica sobre la cámara ya resuelta por Roblox.
		if math.abs(rollCurrent) > 0.0005 then
			camera.CFrame = camera.CFrame * CFrame.Angles(0, 0, rollCurrent)
		end
	end)
end

return Camera
