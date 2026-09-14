const PLACE_CONFIG = [
  { place: 2, height: 'h-36', color: '#8B949E', label: '2ND PLACE', textColor: 'text-[#8B949E]' },
  { place: 1, height: 'h-48', color: '#F1C40F', label: '1ST PLACE', textColor: 'text-[#F1C40F]' },
  { place: 3, height: 'h-28', color: '#CD7F32', label: '3RD PLACE', textColor: 'text-[#CD7F32]' },
]

function Initials({ username, color }) {
  const letters = username?.slice(0, 2).toUpperCase() || '??'
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center
                 text-sm font-semibold mb-2 border-2"
      style={{ borderColor: color, backgroundColor: color + '20', color }}
    >
      {letters}
    </div>
  )
}

export function Podium({ entries }) {
  const byPlace = {
    1: entries.find(e => e.rank === 1),
    2: entries.find(e => e.rank === 2),
    3: entries.find(e => e.rank === 3),
  }

  return (
    <div className="flex items-end justify-center gap-4">
      {PLACE_CONFIG.map(({ place, height, color, label, textColor }) => {
        const entry = byPlace[place]
        if (!entry) return null

        return (
          <div key={place} className="flex flex-col items-center">
            <Initials username={entry.username} color={color} />
            <p className={`text-sm font-medium mb-0.5 ${textColor}`}>
              {entry.username}
            </p>
            <p className="text-text-3 text-xs mb-1">
              {entry.roleLabel || 'Participant'}
            </p>
            <p className={`text-lg font-bold mb-0.5 ${textColor}`}>
              {entry.score?.toLocaleString()} pts
            </p>
            <p className="text-text-3 text-xs mb-2">
              🚩 {entry.solvedCount || 0} flags
            </p>

            <div
              className={`w-28 ${height} rounded-t-lg flex items-center
                          justify-center border-t border-x`}
              style={{ borderColor: color + '40', backgroundColor: color + '10' }}
            >
              <div className="text-center">
                <p className={`text-3xl font-bold ${textColor}`}>{place}</p>
                <p className={`text-[10px] font-mono ${textColor} opacity-60`}>
                  {label}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
