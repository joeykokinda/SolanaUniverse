import { truncAddr, fmtDate, fmtSOL } from '../utils/dataProcessor'

export default function Sidebar({ planet, onClose }) {
  const sign = planet.netFlow >= 0 ? '+' : ''
  const netColor = planet.netFlow >= 0 ? '#66ff99' : '#ff6644'

  const sorted = [...planet.transactions].sort((a, b) => b.time - a.time)

  return (
    <div
      className="absolute right-0 top-0 h-full z-40 slide-in-right flex flex-col"
      style={{
        width: 320,
        background: 'rgba(0,0,12,0.96)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'monospace',
        fontSize: 11,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div>
          <div className="text-white text-xs font-bold">{truncAddr(planet.address)}</div>
          <div className="text-gray-600 text-xs mt-0.5">{planet.txCount} transactions</div>
        </div>
        <button onClick={onClose} className="text-gray-700 hover:text-gray-300 transition-colors text-xs">✕</button>
      </div>

      {/* Address (full, copyable) */}
      <div className="px-4 py-2 border-b text-gray-700 text-xs break-all" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <a
          href={`https://solscan.io/account/${planet.address}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-gray-400 transition-colors"
        >
          {planet.address} ↗
        </a>
      </div>

      {/* Stats summary */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', lineHeight: 1.9 }}>
        <div className="text-gray-500">
          sent&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style={{ color: '#ff8866' }}>{fmtSOL(planet.totalSentSOL)} SOL</span>
        </div>
        <div className="text-gray-500">
          received&nbsp; <span style={{ color: '#66ff99' }}>{fmtSOL(planet.totalReceivedSOL)} SOL</span>
        </div>
        <div className="text-gray-500">
          net&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style={{ color: netColor }}>{sign}{fmtSOL(planet.netFlow)} SOL</span>
        </div>
        <div className="text-gray-500">
          first&nbsp;&nbsp;&nbsp;&nbsp; <span className="text-gray-600">{fmtDate(planet.firstSeen)}</span>
        </div>
        <div className="text-gray-500">
          last&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span className="text-gray-600">{fmtDate(planet.lastSeen)}</span>
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
        {sorted.map((tx, i) => (
          <TxRow key={i} tx={tx} />
        ))}
      </div>
    </div>
  )
}

function TxRow({ tx }) {
  const isOut = tx.direction === 'out'
  const arrow = isOut ? '↑' : '↓'
  const color = isOut ? '#ff8866' : '#66ff99'
  const label = isOut ? 'out' : 'in'

  return (
    <div className="border-b py-1.5" style={{ borderColor: 'rgba(255,255,255,0.04)', lineHeight: 1.7 }}>
      <div className="flex items-center justify-between">
        <span style={{ color, fontSize: 11 }}>
          {arrow} {label}&nbsp;&nbsp;{fmtSOL(tx.sol)} SOL
        </span>
        <a
          href={`https://solscan.io/tx/${tx.signature}`}
          target="_blank"
          rel="noreferrer"
          className="text-gray-700 hover:text-gray-400 transition-colors text-xs"
        >
          ↗ view
        </a>
      </div>
      <div className="text-gray-700 text-xs">{fmtDate(tx.time)}</div>
      <div className="text-gray-800 text-xs truncate">{tx.signature.slice(0, 24)}...</div>
    </div>
  )
}
