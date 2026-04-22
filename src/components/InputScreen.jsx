import { useState } from 'react'

export default function InputScreen({ defaultWallet, defaultApiKey, onSubmit, error }) {
  const [wallet, setWallet] = useState(defaultWallet || '')
  const [apiKey, setApiKey] = useState(defaultApiKey || '')

  const errorMsg = {
    empty: 'empty space. nothing has happened here yet.',
    invalid_address: 'these coordinates do not exist.',
    api_error: 'signal lost. check your api key and try again.',
  }[error] || (error ? 'partial data loaded — something went wrong.' : null)

  function handleSubmit(e) {
    e.preventDefault()
    const w = wallet.trim()
    const k = apiKey.trim()
    if (!w || !k) return
    onSubmit(w, k)
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full" style={{ background: '#000008' }}>
      {/* nebula bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 30% 60%, rgba(26,0,48,0.5) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(0,10,40,0.4) 0%, transparent 55%)'
      }} />

      {/* stars */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {Array.from({ length: 120 }, (_, i) => (
          <circle
            key={i}
            cx={`${Math.sin(i * 7.3) * 50 + 50}%`}
            cy={`${Math.cos(i * 5.1) * 50 + 50}%`}
            r={i % 7 === 0 ? 1.5 : i % 3 === 0 ? 1 : 0.5}
            fill={`rgba(255,255,255,${0.2 + (i % 5) * 0.12})`}
          />
        ))}
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-md">
        {/* Title */}
        <div className="text-center">
          <div className="text-green-400 text-xs tracking-[0.3em] mb-2 opacity-70">EXPLORE YOUR</div>
          <h1 className="text-3xl font-bold tracking-[0.15em] text-white" style={{ fontFamily: 'monospace' }}>
            SOLANA UNIVERSE
          </h1>
          <p className="text-xs text-gray-500 mt-2 tracking-widest">your on-chain life. visualized.</p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="text-orange-400 text-xs text-center animate-fade-in-up border border-orange-900 px-4 py-2 rounded" style={{ fontFamily: 'monospace' }}>
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 tracking-widest uppercase">Solana Wallet Address</label>
            <input
              type="text"
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter your wallet address..."
              className="bg-transparent border border-gray-700 text-white text-sm px-3 py-2 rounded outline-none focus:border-green-500 transition-colors"
              style={{ fontFamily: 'monospace' }}
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 tracking-widest uppercase">
              Helius API Key{' '}
              <a
                href="https://www.helius.dev"
                target="_blank"
                rel="noreferrer"
                className="text-green-500 hover:text-green-300 transition-colors"
              >
                (get one free at helius.dev)
              </a>
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="bg-transparent border border-gray-700 text-white text-sm px-3 py-2 rounded outline-none focus:border-green-500 transition-colors"
              style={{ fontFamily: 'monospace' }}
              spellCheck={false}
            />
          </div>

          <button
            type="submit"
            disabled={!wallet.trim() || !apiKey.trim()}
            className="mt-2 border border-green-500 text-green-400 text-sm py-2 px-6 rounded tracking-widest uppercase hover:bg-green-500 hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontFamily: 'monospace' }}
          >
            LAUNCH →
          </button>
        </form>

        <p className="text-xs text-gray-700 text-center">
          credentials stored locally in your browser. never sent anywhere else.
        </p>
      </div>
    </div>
  )
}
