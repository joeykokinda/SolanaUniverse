import { useEffect, useState } from 'react'

const MESSAGES = [
  'mapping your universe...',
  'calculating orbits...',
  'charting the cosmos...',
  'tracing every lamport...',
  'your blockchain life in 3... 2... 1...',
]

export default function LoadingScreen({ progress, message }) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [])

  const pct = Math.round((progress || 0) * 100)

  return (
    <div className="flex flex-col items-center justify-center w-full h-full" style={{ background: '#000008' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(20,5,40,0.6) 0%, transparent 70%)'
      }} />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Expanding rings */}
        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute rounded-full border border-green-500"
              style={{
                width: 80, height: 80,
                animation: `expand-ring 2.4s ease-out ${i * 0.8}s infinite`,
                opacity: 0.6 - i * 0.15,
              }}
            />
          ))}
          {/* Center sun */}
          <div className="rounded-full" style={{
            width: 40, height: 40,
            background: 'radial-gradient(circle, #fffde7 0%, #ffd54f 40%, #ff8f00 80%, transparent 100%)',
            animation: 'sun-pulse 2s ease-in-out infinite',
            boxShadow: '0 0 20px 6px rgba(255,160,0,0.4)',
          }} />
        </div>

        {/* Message */}
        <div className="text-center flex flex-col gap-3">
          <p className="text-green-400 text-sm tracking-widest" style={{ fontFamily: 'monospace', minHeight: 20 }}>
            {message || MESSAGES[0]}{dots}
          </p>

          {/* Progress bar */}
          <div className="w-64 h-px bg-gray-800 overflow-hidden rounded">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-gray-600 text-xs tracking-widest" style={{ fontFamily: 'monospace' }}>
            {pct}%
          </p>
        </div>
      </div>
    </div>
  )
}
