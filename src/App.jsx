import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { getAllTransfers, getSOLBalance } from './utils/api'
import { processTransfers, truncAddr, fmtDate, fmtSOL } from './utils/dataProcessor'
import InputScreen from './components/InputScreen'
import LoadingScreen from './components/LoadingScreen'
import Sidebar from './components/Sidebar'
import StatsBar from './components/StatsBar'

const BASE_SPEED = 90
const MAX_PLANETS = 25

const LOAD_MSGS = [
  'mapping your universe...',
  'calculating trajectories...',
  'charting the cosmos...',
  'tracing every lamport...',
  'your blockchain life in 3... 2... 1...',
]

function seededRng(seed) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0
  }
  return () => {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5
    return (h >>> 0) / 4294967296
  }
}

function computePositions(planets) {
  if (!planets.length) return []
  const times = planets.map(p => p.lastSeen).filter(Boolean)
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const tRange = maxT - minT || 1

  return planets.map(p => {
    const rng = seededRng(p.address)
    const r1 = rng(), r2 = rng(), r3 = rng()
    const tNorm = p.lastSeen ? (p.lastSeen - minT) / tRange : 0.5
    const z = 100 + (1 - tNorm) * 1900
    const angle = r3 * Math.PI * 2
    const lossRatio = p.netFlow < 0 ? Math.min(Math.abs(p.netFlow) / (p.totalSentSOL || 1), 1) : 0
    const radius = p.netFlow < 0 ? 80 + lossRatio * 680 : 40 + r3 * 220
    const x = Math.cos(angle) * radius * (0.4 + r1 * 0.6)
    const y = Math.sin(angle) * radius * (0.3 + r2 * 0.5) * 0.55
    return { x, y, z }
  })
}

function getPlanetColorInfo(planet) {
  const r = planet.netFlow / (planet.totalSentSOL || 1)
  if (r > 0.05) return { hex: 0x00ff88, intensity: 1.0 }
  if (r >= 0)   return { hex: 0x4499ff, intensity: 0.8 }
  if (r > -0.10) return { hex: 0xffaa00, intensity: 0.8 }
  if (r > -0.30) return { hex: 0xff6600, intensity: 0.8 }
  return { hex: 0xff1100, intensity: 1.2 }
}

const S = { INPUT: 'input', LOADING: 'loading', UNIVERSE: 'universe' }

export default function App() {
  const [screen, setScreen] = useState(S.INPUT)
  const [wallet, setWallet] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadMsg, setLoadMsg] = useState(LOAD_MSGS[0])
  const [error, setError] = useState(null)
  const [partial, setPartial] = useState(false)
  const [planets, setPlanets] = useState([])
  const [stars, setStars] = useState([])
  const [balance, setBalance] = useState(0)
  const [walletStats, setWalletStats] = useState(null)

  useEffect(() => {
    const w = localStorage.getItem('solana_wallet')
    const k = localStorage.getItem('helius_api_key')
    if (w) setWallet(w)
    if (k) setApiKey(k)
  }, [])

  async function handleStart(walletAddress, key) {
    setWallet(walletAddress)
    setApiKey(key)
    localStorage.setItem('solana_wallet', walletAddress)
    localStorage.setItem('helius_api_key', key)
    setError(null); setPartial(false); setLoadProgress(0)
    setScreen(S.LOADING)

    let msgIdx = 0
    setLoadMsg(LOAD_MSGS[0])
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOAD_MSGS.length
      setLoadMsg(LOAD_MSGS[msgIdx])
    }, 2200)

    try {
      const [bal, txResult] = await Promise.all([
        getSOLBalance(walletAddress, key),
        getAllTransfers(walletAddress, key, (count) => {
          setLoadProgress(Math.min(count / 600, 0.9))
        }),
      ])
      clearInterval(msgTimer)

      if (!txResult.transfers.length) {
        setError('empty'); setScreen(S.INPUT); return
      }

      setBalance(bal)
      setPartial(!!txResult.partial)
      const { planets: p, stars: s, walletStats: ws } = processTransfers(txResult.transfers, walletAddress)
      setPlanets(p); setStars(s); setWalletStats(ws)
      setLoadProgress(1)
      setTimeout(() => setScreen(S.UNIVERSE), 400)
    } catch (err) {
      clearInterval(msgTimer)
      setError((err.message || '').includes('invalid_address') ? 'invalid_address' : 'api_error')
      setScreen(S.INPUT)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000008' }}>
      {screen === S.INPUT && (
        <InputScreen defaultWallet={wallet} defaultApiKey={apiKey} onSubmit={handleStart} error={error} />
      )}
      {screen === S.LOADING && (
        <LoadingScreen progress={loadProgress} message={loadMsg} />
      )}
      {screen === S.UNIVERSE && walletStats && (
        <UniverseScene
          planets={planets} stars={stars}
          walletAddress={wallet} balance={balance}
          walletStats={walletStats} partial={partial}
          onBack={() => setScreen(S.INPUT)}
        />
      )}
    </div>
  )
}

// ─── Universe Scene ───────────────────────────────────────────────────────────
function UniverseScene({ planets, stars, walletAddress, balance, walletStats, partial, onBack }) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [selectedPlanet, setSelectedPlanet] = useState(null)
  const [showSunStats, setShowSunStats] = useState(false)
  const [mode, setMode] = useState('overview')
  const [paused, setPaused] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)

  const R = useRef({})
  useEffect(() => {
    R.current = { setTooltip, setSelectedPlanet, setShowSunStats, setMode, setPaused }
  })

  useEffect(() => {
    if (!containerRef.current || !planets.length) return
    const container = containerRef.current
    let W = window.innerWidth, H = window.innerHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000008)
    container.appendChild(renderer.domElement)

    // Scene
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000008, 0.00010)

    // Camera — starts at overview position
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.5, 8000)
    const OV_POS = new THREE.Vector3(0, 900, -1600)
    const OV_TARGET = new THREE.Vector3(0, 0, 600)
    camera.position.copy(OV_POS)
    camera.lookAt(OV_TARGET)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const sunLight = new THREE.PointLight(0xffaa00, 3, 3000)
    scene.add(sunLight)
    const fillLight = new THREE.DirectionalLight(0x4444ff, 0.5)
    fillLight.position.set(-500, 500, -500)
    scene.add(fillLight)

    // World group — rotates in overview mode
    const worldGroup = new THREE.Group()
    scene.add(worldGroup)

    // Sun core + glow layers
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffdd44, emissive: 0xffdd44, emissiveIntensity: 2.0, roughness: 0.2, metalness: 0.0 })
    )
    sunCore.userData = { type: 'sun' }
    worldGroup.add(sunCore)

    const sunLayers = [
      [58, 0xffaa00, 0.30],
      [70, 0xff6600, 0.10],
      [90, 0xff4400, 0.05],
    ].map(([r, col, op]) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.BackSide })
      )
      worldGroup.add(m)
      return m
    })

    // Star field (in scene, not worldGroup — stays fixed)
    const starRng = seededRng('cosmos_42')
    const starPos = new Float32Array(2000 * 3)
    for (let i = 0; i < 2000; i++) {
      const th = starRng() * Math.PI * 2
      const ph = Math.acos(2 * starRng() - 1)
      const r = 3500 + starRng() * 2500
      starPos[i * 3]     = r * Math.sin(ph) * Math.cos(th)
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
      starPos[i * 3 + 2] = r * Math.cos(ph)
    }
    const sfGeo = new THREE.BufferGeometry()
    sfGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(sfGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: true })))

    // Planets
    const displayPlanets = planets.slice(0, MAX_PLANETS)
    const positions = computePositions(displayPlanets)
    const maxSent = Math.max(...displayPlanets.map(p => p.totalSentSOL), 1)
    const planetMeshes = []
    const streams = []
    const disposables = []

    displayPlanets.forEach((planet, i) => {
      const pos = positions[i]
      const radius = 3 + (planet.totalSentSOL / maxSent) * 37
      const { hex: pCol, intensity: pInt } = getPlanetColorInfo(planet)

      const geo = new THREE.SphereGeometry(radius, 16, 16)
      const mat = new THREE.MeshStandardMaterial({
        color: pCol, emissive: pCol, emissiveIntensity: pInt, roughness: 0.3, metalness: 0.1,
      })
      disposables.push(geo, mat)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pos.x, pos.y, pos.z)
      mesh.userData = { type: 'planet', planet }
      worldGroup.add(mesh)
      planetMeshes.push(mesh)

      // Glow halo
      const glowGeo = new THREE.SphereGeometry(radius * 1.4, 16, 16)
      const glowMat = new THREE.MeshBasicMaterial({ color: pCol, transparent: true, opacity: 0.08, side: THREE.BackSide })
      disposables.push(glowGeo, glowMat)
      const glowMesh = new THREE.Mesh(glowGeo, glowMat)
      glowMesh.position.set(pos.x, pos.y, pos.z)
      worldGroup.add(glowMesh)

      // Tx trail cluster
      const txRng = seededRng(planet.address + '_tx')
      planet.transactions.slice(0, 10).forEach(tx => {
        const tSize = Math.max(0.5, Math.min(2.5, tx.sol * 0.45 + 0.5))
        const tGeo = new THREE.SphereGeometry(tSize, 8, 8)
        const tMat = new THREE.MeshBasicMaterial({ color: tx.direction === 'in' ? 0x00ff88 : 0xff4422, transparent: true, opacity: 0.8 })
        disposables.push(tGeo, tMat)
        const tMesh = new THREE.Mesh(tGeo, tMat)
        tMesh.position.set(
          pos.x + (txRng() - 0.5) * radius * 4.5,
          pos.y + (txRng() - 0.5) * radius * 4.5,
          pos.z + (txRng() - 0.5) * radius * 4.5,
        )
        tMesh.userData = { type: 'trail', planet }
        worldGroup.add(tMesh)
      })

      // Particle stream: received SOL flows toward sun
      if (planet.totalReceivedSOL > 0.1) {
        const count = Math.min(Math.ceil(Math.log1p(planet.totalReceivedSOL) * 9), 30)
        const sArr = new Float32Array(count * 3)
        const prog = Float32Array.from({ length: count }, () => Math.random())
        const sGeo = new THREE.BufferGeometry()
        sGeo.setAttribute('position', new THREE.BufferAttribute(sArr, 3))
        const sMat = new THREE.PointsMaterial({ color: 0x00ff88, size: 2.5, transparent: true, opacity: 0.6, sizeAttenuation: true })
        disposables.push(sGeo, sMat)
        const sPoints = new THREE.Points(sGeo, sMat)
        worldGroup.add(sPoints)
        streams.push({ geo: sGeo, prog, count, origin: new THREE.Vector3(pos.x, pos.y, pos.z) })
      }
    })

    // PointerLockControls (fly mode)
    const controls = new PointerLockControls(camera, renderer.domElement)
    controls.addEventListener('unlock', () => {
      if (modeRef.current === 'fly') {
        modeRef.current = 'overview'
        R.current.setMode('overview')
        camera.position.copy(OV_POS)
        camera.lookAt(OV_TARGET)
      }
    })

    // Raycaster
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const centerVec = new THREE.Vector2(0, 0)

    // Mutable state
    const modeRef = { current: 'overview' }
    const pausedRef = { current: false }
    const keys = {}
    const speedRef = { v: 1 }
    let sunPulse = 0
    let lastT = performance.now()

    // 1-second fade in
    setTimeout(() => setFadeIn(true), 80)

    // ── Event handlers ────────────────────────────────────────────────
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return
      keys[e.code] = true

      if (e.code === 'Space') {
        e.preventDefault()
        pausedRef.current = !pausedRef.current
        R.current.setPaused(pausedRef.current)
        return
      }

      if (e.key === 'o' || e.key === 'O') {
        if (modeRef.current === 'overview') {
          modeRef.current = 'fly'
          R.current.setMode('fly')
          controls.lock()
        } else {
          controls.unlock()
        }
        return
      }

      if (e.key === 'f' || e.key === 'F') {
        if (modeRef.current === 'overview') {
          modeRef.current = 'fly'
          R.current.setMode('fly')
          controls.lock()
        }
        return
      }
    }

    const onKeyUp = (e) => { keys[e.code] = false }

    const onWheel = (e) => {
      speedRef.v = Math.max(0.2, Math.min(15, speedRef.v - e.deltaY * 0.002))
    }

    const onMouseMove = (e) => {
      if (modeRef.current === 'fly') return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(planetMeshes)
      if (hits.length) {
        const pm = hits[0].object
        const wp = new THREE.Vector3()
        pm.getWorldPosition(wp)
        wp.project(camera)
        const sx = (wp.x + 1) / 2 * W
        const sy = -(wp.y - 1) / 2 * H
        R.current.setTooltip({ visible: true, x: sx, y: sy, planet: pm.userData.planet })
        renderer.domElement.style.cursor = 'pointer'
      } else {
        R.current.setTooltip(null)
        renderer.domElement.style.cursor = 'crosshair'
      }
    }

    const onClick = () => {
      if (modeRef.current === 'fly') return
      raycaster.setFromCamera(mouse, camera)
      const pHits = raycaster.intersectObjects(planetMeshes)
      if (pHits.length) {
        R.current.setSelectedPlanet(pHits[0].object.userData.planet)
        return
      }
      const sHit = raycaster.intersectObject(sunCore)
      if (sHit.length) R.current.setShowSunStats(v => !v)
    }

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true })
    renderer.domElement.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)

    // ── Animation loop ────────────────────────────────────────────────
    let rafId

    const animate = (now) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now

      if (pausedRef.current) {
        renderer.render(scene, camera)
        return
      }

      sunPulse += dt

      // Sun pulse
      sunCore.scale.setScalar(1 + Math.sin(sunPulse * 1.7) * 0.05)
      sunLayers.forEach((g, i) => g.scale.setScalar(1 + Math.sin(sunPulse * 1.4 + i * 0.6) * 0.04))
      sunLight.intensity = 3.0 + Math.sin(sunPulse * 2.1) * 0.5

      // Overview: slow turntable
      if (modeRef.current === 'overview') {
        worldGroup.rotation.y += dt * 0.08
      }

      // Fly: WASD
      if (modeRef.current === 'fly' && controls.isLocked) {
        const spd = BASE_SPEED * speedRef.v * dt
        if (keys['KeyW']) controls.moveForward(spd)
        if (keys['KeyS']) controls.moveForward(-spd)
        if (keys['KeyA']) controls.moveRight(-spd)
        if (keys['KeyD']) controls.moveRight(spd)
        if (keys['ShiftLeft'] || keys['ShiftRight']) camera.position.y -= spd * 0.7
      }

      // Fly-mode center raycast for tooltip
      if (modeRef.current === 'fly' && controls.isLocked) {
        raycaster.setFromCamera(centerVec, camera)
        const hits = raycaster.intersectObjects(planetMeshes)
        if (hits.length && hits[0].distance < 500) {
          R.current.setTooltip({ visible: true, x: W / 2, y: H / 2 - 80, planet: hits[0].object.userData.planet })
        } else {
          R.current.setTooltip(null)
        }
      }

      // Planet self-rotation
      planetMeshes.forEach((m, i) => {
        m.rotation.y += dt * (0.08 + i * 0.015)
        m.rotation.x += dt * 0.025
      })

      // Particle streams
      streams.forEach(s => {
        const pa = s.geo.attributes.position
        for (let j = 0; j < s.count; j++) {
          s.prog[j] += dt * 0.13
          if (s.prog[j] > 1) s.prog[j] = 0
          const t = s.prog[j]
          pa.array[j * 3]     = s.origin.x * (1 - t)
          pa.array[j * 3 + 1] = s.origin.y * (1 - t)
          pa.array[j * 3 + 2] = s.origin.z * (1 - t)
        }
        pa.needsUpdate = true
      })

      renderer.render(scene, camera)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      disposables.forEach(d => d.dispose())
      sfGeo.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [planets, walletAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleShare() {
    const { totalSent, totalReceived, netFlow, planetsCount } = walletStats
    const top = planets[0]
    const sign = netFlow >= 0 ? '+' : ''
    const text = [
      'my solana universe 🌌', '',
      `📤 sent: ${fmtSOL(totalSent)} SOL across ${planetsCount} addresses`,
      `📥 received: ${fmtSOL(totalReceived)} SOL back`,
      `🕳️ net: ${sign}${fmtSOL(netFlow)} SOL`, '',
      top ? `biggest planet: ${truncAddr(top.address)}` : '',
      '', 'explore yours → https://solana-universe.xyz',
      '#solanauniverse',
    ].join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
    document.title = 'copied!'
    setTimeout(() => { document.title = 'SOLANA UNIVERSE' }, 1500)
  }

  const { totalSent, totalReceived, netFlow, walletAge, planetsCount, starsCount, totalMoons } = walletStats

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* Fade-in black overlay */}
      <div style={{
        position: 'absolute', inset: 0, background: '#000008', zIndex: 50,
        opacity: fadeIn ? 0 : 1,
        transition: fadeIn ? 'opacity 1s ease' : 'none',
        pointerEvents: 'none',
      }} />

      {/* Top-left: title + wallet */}
      <div style={{ ...HUD, position: 'absolute', top: 12, left: 16, zIndex: 10, color: '#00ff88', letterSpacing: '0.15em' }}>
        SOLANA UNIVERSE · {truncAddr(walletAddress)}
        {partial && <span style={{ color: '#ff8800', marginLeft: 10, fontSize: 9 }}>partial data</span>}
      </div>

      {/* Top-right: mode indicator + back */}
      <div style={{ ...HUD, position: 'absolute', top: 12, right: 16, zIndex: 10, textAlign: 'right' }}>
        <div style={{ color: mode === 'fly' ? '#ff8800' : '#00ff88', letterSpacing: '0.15em' }}>
          [{mode === 'fly' ? 'FLY MODE' : 'OVERVIEW'}]
        </div>
        <button
          onClick={onBack}
          style={{ color: '#444', fontSize: 9, marginTop: 3, display: 'block', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          className="hover:text-gray-400 transition-colors"
        >
          ← back
        </button>
      </div>

      {/* Bottom-left: controls hint */}
      <div style={{ ...HUD, position: 'absolute', bottom: 46, left: 16, zIndex: 10, color: 'rgba(0,255,136,0.3)', lineHeight: 2 }}>
        <div>O — overview / fly</div>
        {mode === 'fly' && <div>WASD — fly · SCROLL speed</div>}
        <div>SPACE — pause</div>
        <div>click — inspect</div>
      </div>

      {/* Fly mode crosshair */}
      {mode === 'fly' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <line x1="10" y1="0"  x2="10" y2="7"  stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <line x1="10" y1="13" x2="10" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <line x1="0"  y1="10" x2="7"  y2="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <line x1="13" y1="10" x2="20" y2="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {/* Paused overlay */}
      {paused && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ ...HUD, color: 'rgba(0,255,136,0.22)', fontSize: 30, letterSpacing: '0.45em' }}>PAUSED</div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip?.visible && <PlanetTooltip tooltip={tooltip} />}

      {/* Sun stats */}
      {showSunStats && (
        <SunStatsPanel balance={balance} walletAddress={walletAddress} stats={walletStats} onClose={() => setShowSunStats(false)} />
      )}

      {/* Sidebar */}
      {selectedPlanet && (
        <Sidebar planet={selectedPlanet} onClose={() => setSelectedPlanet(null)} />
      )}

      {/* Stats bar */}
      <StatsBar
        planetsCount={planetsCount} totalMoons={totalMoons} starsCount={starsCount}
        totalSent={totalSent} totalReceived={totalReceived}
        netFlow={netFlow} walletAge={walletAge}
      />

      {/* Share */}
      <button
        onClick={handleShare}
        className="absolute z-10 hover:border-gray-400 hover:text-gray-300 transition-all"
        style={{ ...HUD, bottom: 10, right: 16, border: '1px solid #333', color: '#555', fontSize: 10, padding: '3px 10px', borderRadius: 3 }}
      >
        SHARE
      </button>
    </div>
  )
}

const HUD = { fontFamily: "'Courier New', monospace", fontSize: 11 }

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function PlanetTooltip({ tooltip }) {
  const { x, y, planet: p } = tooltip
  const netSign = p.netFlow >= 0 ? '+' : ''
  const left = x > window.innerWidth - 240 ? x - 230 : x + 18
  const top  = y > window.innerHeight - 230 ? y - 220 : y + 12

  return (
    <div style={{
      position: 'absolute', left, top, zIndex: 30,
      background: '#000',
      border: '1px solid #00ff88',
      padding: '10px 14px',
      fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.9,
      color: '#00ff88', minWidth: 215, pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 3 }}>{truncAddr(p.address)}</div>
      <div>↑ sent:     {fmtSOL(p.totalSentSOL)} SOL</div>
      <div>↓ received: {fmtSOL(p.totalReceivedSOL)} SOL</div>
      <div>~ net:      {netSign}{fmtSOL(p.netFlow)} SOL</div>
      <div># txs:      {p.txCount}</div>
      <div>first: {fmtDate(p.firstSeen)}</div>
      <div>last:  {fmtDate(p.lastSeen)}</div>
    </div>
  )
}

// ─── Sun Stats Panel ──────────────────────────────────────────────────────────
function SunStatsPanel({ balance, walletAddress, stats, onClose }) {
  const { totalSent, totalReceived, netFlow, mostActiveDay, walletAge, firstTxTime } = stats
  const netSign = netFlow >= 0 ? '+' : ''
  const netColor = netFlow >= 0 ? '#00ff88' : '#ff4422'

  return (
    <div style={{
      position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, background: 'rgba(0,0,10,0.95)',
      border: '1px solid rgba(255,200,60,0.25)', borderRadius: 5,
      padding: '16px 20px', fontFamily: "'Courier New', monospace",
      fontSize: 11, lineHeight: 1.9, color: '#888', minWidth: 250,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ color: '#ffd54f', marginBottom: 8, fontSize: 12 }}>☀ {truncAddr(walletAddress)}</div>
      <div>balance&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#fff' }}>{fmtSOL(balance)} SOL</span></div>
      <div>age&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#aac8ff' }}>{walletAge} days</span></div>
      <div>born&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#666' }}>{fmtDate(firstTxTime)}</span></div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />
      <div>total sent&nbsp;&nbsp;&nbsp;<span style={{ color: '#ff8866' }}>{fmtSOL(totalSent)} SOL</span></div>
      <div>total recv&nbsp;&nbsp;&nbsp;<span style={{ color: '#00ff88' }}>{fmtSOL(totalReceived)} SOL</span></div>
      <div>net flow&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: netColor }}>{netSign}{fmtSOL(netFlow)} SOL</span></div>
      <div>peak day&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#666' }}>{mostActiveDay || '—'}</span></div>
      <button onClick={onClose} style={{ marginTop: 10, color: '#444', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer' }} className="hover:text-gray-400">
        ✕ close
      </button>
    </div>
  )
}
