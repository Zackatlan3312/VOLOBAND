--!strict
-- Utilidades de sonido con manejo tolerante: si un id de audio no está
-- disponible, el Sound simplemente no reproduce nada y el juego continúa.

local SoundUtil = {}

export type SoundProps = {
	Volume: number?,
	Looped: boolean?,
	PlaybackSpeed: number?,
	RollOffMaxDistance: number?,
	RollOffMinDistance: number?,
	Name: string?,
}

function SoundUtil.make(parent: Instance, id: string, props: SoundProps?): Sound
	local sound = Instance.new("Sound")
	sound.SoundId = id
	if props then
		sound.Volume = props.Volume or 0.5
		sound.Looped = props.Looped or false
		sound.PlaybackSpeed = props.PlaybackSpeed or 1
		sound.RollOffMaxDistance = props.RollOffMaxDistance or 60
		sound.RollOffMinDistance = props.RollOffMinDistance or 6
		sound.Name = props.Name or "Sound"
	end
	sound.Parent = parent
	return sound
end

-- Reproduce un sonido puntual en una posición del mundo y lo limpia solo.
function SoundUtil.playAt(position: Vector3, id: string, volume: number?, rollOffMax: number?)
	local holder = Instance.new("Part")
	holder.Anchored = true
	holder.CanCollide = false
	holder.CanQuery = false
	holder.CanTouch = false
	holder.Transparency = 1
	holder.Size = Vector3.new(0.5, 0.5, 0.5)
	holder.Position = position
	holder.Parent = workspace

	local sound = SoundUtil.make(holder, id, {
		Volume = volume or 0.7,
		RollOffMaxDistance = rollOffMax or 70,
	})
	sound.Ended:Once(function()
		holder:Destroy()
	end)
	sound:Play()
	task.delay(12, function()
		if holder.Parent then
			holder:Destroy()
		end
	end)
end

return SoundUtil
