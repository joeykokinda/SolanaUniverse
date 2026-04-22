import { fmtSOL } from '../utils/dataProcessor'

export default function StatsBar({ planetsCount, totalMoons, starsCount, totalSent, totalReceived, netFlow, walletAge }) {
  const netSign = netFlow >= 0 ? '+' : ''
  const netColor = netFlow >= 0 ? '#66ff99' : '#ff6644'

  const items = [
    { icon: '⬡', label: `Planets: ${planetsCount}` },
    { icon: '○', label: `Moons: ${totalMoons}` },
    { icon: '·', label: `Stars: ${starsCount}` },
    { icon: '↑', label: `Sent: ${fmtSOL(totalSent)} SOL`, color: '#ff8866' },
    { icon: '↓', label: `Received: ${fmtSOL(totalReceived)} SOL`, color: '#66ff99' },
    { icon: '~', label: `Net: ${netSign}${fmtSOL(netFlow)} SOL`, color: netColor },
    { icon: '◷', label: `Age: ${walletAge}d` },
  ]

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-4 overflow-x-auto"
      style={{
        height: 36,
        background: 'rgba(0,0,8,0.85)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#555',
        backdropFilter: 'blur(4px)',
        whiteSpace: 'nowrap',
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{ color: item.color || '#555' }}>
          {item.icon} {item.label}
          {i < items.length - 1 && <span style={{ color: '#222', marginLeft: 8 }}>|</span>}
        </span>
      ))}
    </div>
  )
}
