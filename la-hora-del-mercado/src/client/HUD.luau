--!strict
-- Interfaz mínima y diegética: reloj, fase, objetivo, avisos, subtítulos
-- y pantalla de muerte. Sin barras ni botones que rompan la inmersión.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local HUD = {}

local player = Players.LocalPlayer
local gui: ScreenGui
local clockLabel: TextLabel
local phaseLabel: TextLabel
local objectiveLabel: TextLabel
local subtitleLabel: TextLabel
local toastFrame: Frame
local deathOverlay: Frame
local deathTitle: TextLabel
local introLabel: TextLabel

local PHASE_NAMES = {
	LOBBY = "la vecindad",
	INTERMISSION = "esperando la tarde",
	TARDE = "tarde",
	CIERRE = "cierre",
	PROHIBIDA = "hora prohibida",
	RESULTS = "amanecer",
}

local KIND_COLORS = {
	info = Color3.fromRGB(214, 210, 198),
	good = Color3.fromRGB(168, 220, 168),
	danger = Color3.fromRGB(226, 120, 110),
	death = Color3.fromRGB(200, 96, 96),
	pa = Color3.fromRGB(226, 208, 150),
}

local function label(parent: Instance, props: { [string]: any }): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.Gotham
	l.TextColor3 = Color3.fromRGB(220, 216, 205)
	l.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
	l.TextStrokeTransparency = 0.6
	for k, v in props do
		(l :: any)[k] = v
	end
	l.Parent = parent
	return l
end

function HUD.init()
	gui = Instance.new("ScreenGui")
	gui.Name = "LHM_HUD"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.Parent = player:WaitForChild("PlayerGui")

	clockLabel = label(gui, {
		Name = "Reloj",
		Size = UDim2.fromOffset(220, 46),
		Position = UDim2.new(0.5, -110, 0, 14),
		Font = Enum.Font.Code,
		TextSize = 38,
		Text = "17:45",
	})
	phaseLabel = label(gui, {
		Name = "Fase",
		Size = UDim2.fromOffset(300, 20),
		Position = UDim2.new(0.5, -150, 0, 58),
		TextSize = 14,
		TextColor3 = Color3.fromRGB(170, 166, 156),
		Text = "",
	})
	objectiveLabel = label(gui, {
		Name = "Objetivo",
		Size = UDim2.new(0, 460, 0, 60),
		Position = UDim2.new(0, 18, 1, -84),
		TextSize = 16,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Bottom,
		TextWrapped = true,
		Text = "",
	})
	subtitleLabel = label(gui, {
		Name = "Subtitulo",
		Size = UDim2.new(0.6, 0, 0, 30),
		Position = UDim2.new(0.2, 0, 0.78, 0),
		Font = Enum.Font.Merriweather,
		TextSize = 20,
		TextColor3 = Color3.fromRGB(200, 192, 176),
		TextTransparency = 1,
		Text = "",
	})

	toastFrame = Instance.new("Frame")
	toastFrame.Name = "Avisos"
	toastFrame.BackgroundTransparency = 1
	toastFrame.Size = UDim2.new(0, 420, 0, 220)
	toastFrame.Position = UDim2.new(1, -438, 0, 90)
	local layout = Instance.new("UIListLayout")
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Padding = UDim.new(0, 6)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Right
	layout.Parent = toastFrame
	toastFrame.Parent = gui

	deathOverlay = Instance.new("Frame")
	deathOverlay.Name = "Muerte"
	deathOverlay.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
	deathOverlay.BackgroundTransparency = 1
	deathOverlay.Size = UDim2.fromScale(1, 1)
	deathOverlay.Visible = false
	deathOverlay.Parent = gui
	deathTitle = label(deathOverlay, {
		Size = UDim2.new(1, 0, 0, 70),
		Position = UDim2.new(0, 0, 0.38, 0),
		Font = Enum.Font.Creepster,
		TextSize = 58,
		TextColor3 = Color3.fromRGB(170, 40, 36),
		Text = "",
	})
	label(deathOverlay, {
		Size = UDim2.new(1, 0, 0, 30),
		Position = UDim2.new(0, 0, 0.52, 0),
		TextSize = 16,
		TextColor3 = Color3.fromRGB(160, 156, 148),
		Text = "Observa a los que quedan. Clic para cambiar de vista.",
	})

	introLabel = label(gui, {
		Name = "Titulo",
		Size = UDim2.new(1, 0, 0, 110),
		Position = UDim2.new(0, 0, 0.3, 0),
		Font = Enum.Font.Creepster,
		TextSize = 84,
		TextColor3 = Color3.fromRGB(196, 180, 150),
		TextTransparency = 1,
		Text = "LA HORA DEL MERCADO",
	})
end

-- En el vestíbulo el reloj no significa nada todavía, así que se esconde.
function HUD.setLobby(inLobby: boolean)
	clockLabel.Visible = not inLobby
	if inLobby then
		phaseLabel.Text = PHASE_NAMES.LOBBY
		phaseLabel.TextColor3 = Color3.fromRGB(214, 178, 120)
		subtitleLabel.Text = ""
	end
end

function HUD.setClock(hh: number, mm: number)
	local isLate = (hh >= 23 and mm >= 59) or hh < 6
	clockLabel.Text = string.format("%02d:%02d", hh, mm)
	clockLabel.TextColor3 = isLate and Color3.fromRGB(190, 70, 62) or Color3.fromRGB(220, 216, 205)
end

function HUD.setPhase(phase: string)
	phaseLabel.Text = PHASE_NAMES[phase] or phase
	if phase == "PROHIBIDA" then
		phaseLabel.TextColor3 = Color3.fromRGB(190, 70, 62)
	else
		phaseLabel.TextColor3 = Color3.fromRGB(170, 166, 156)
	end
end

function HUD.setObjective(text: string)
	objectiveLabel.Text = text
end

function HUD.toast(msg: string, kind: string?)
	local item = label(toastFrame, {
		Size = UDim2.new(1, 0, 0, 24),
		TextSize = 15,
		TextXAlignment = Enum.TextXAlignment.Right,
		TextWrapped = true,
		TextColor3 = KIND_COLORS[kind or "info"] or KIND_COLORS.info,
		Text = msg,
		AutomaticSize = Enum.AutomaticSize.Y,
	})
	task.delay(7, function()
		local t = TweenService:Create(item, TweenInfo.new(1.2), { TextTransparency = 1, TextStrokeTransparency = 1 })
		t:Play()
		t.Completed:Once(function()
			item:Destroy()
		end)
	end)
end

function HUD.subtitle(text: string)
	subtitleLabel.Text = text
	subtitleLabel.TextTransparency = 1
	TweenService:Create(subtitleLabel, TweenInfo.new(0.6), { TextTransparency = 0.1 }):Play()
	task.delay(4, function()
		if subtitleLabel.Text == text then
			TweenService:Create(subtitleLabel, TweenInfo.new(1.5), { TextTransparency = 1 }):Play()
		end
	end)
end

local DEATH_TITLES = {
	viejo = "TE ENCONTRÓ",
	corre = "NO DEBISTE CORRER",
	noche = "LA NOCHE TE RECLAMÓ",
	desconocido = "TE PERDISTE",
}

function HUD.showDeath(cause: string)
	deathOverlay.Visible = true
	deathOverlay.BackgroundTransparency = 1
	deathTitle.Text = DEATH_TITLES[cause] or DEATH_TITLES.desconocido
	TweenService:Create(deathOverlay, TweenInfo.new(0.6), { BackgroundTransparency = 0.35 }):Play()
end

function HUD.hideDeath()
	deathOverlay.Visible = false
end

function HUD.showIntro()
	introLabel.TextTransparency = 1
	TweenService:Create(introLabel, TweenInfo.new(1.6), { TextTransparency = 0.05 }):Play()
	task.delay(4, function()
		TweenService:Create(introLabel, TweenInfo.new(2), { TextTransparency = 1 }):Play()
	end)
end

return HUD
