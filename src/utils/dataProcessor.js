export function processTransfers(transfers, walletAddress) {
  const addressMap = new Map()
  let totalSent = 0
  let totalReceived = 0
  const dailyCounts = new Map()

  for (const t of transfers) {
    const isOut = t.from === walletAddress
    const isIn = t.to === walletAddress
    if (!isOut && !isIn) continue

    const counterparty = isOut ? t.to : t.from
    if (!counterparty || counterparty === walletAddress) continue

    if (isOut) totalSent += t.sol
    if (isIn) totalReceived += t.sol

    const day = new Date(t.time * 1000).toDateString()
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1)

    if (!addressMap.has(counterparty)) {
      addressMap.set(counterparty, {
        address: counterparty,
        totalSentSOL: 0,
        totalReceivedSOL: 0,
        txCount: 0,
        firstSeen: t.time,
        lastSeen: t.time,
        transactions: [],
      })
    }

    const e = addressMap.get(counterparty)
    if (isOut) e.totalSentSOL += t.sol
    else e.totalReceivedSOL += t.sol
    e.txCount++
    e.firstSeen = Math.min(e.firstSeen, t.time)
    e.lastSeen = Math.max(e.lastSeen, t.time)
    e.transactions.push({ ...t, direction: isOut ? 'out' : 'in' })
  }

  for (const e of addressMap.values()) {
    e.netFlow = e.totalReceivedSOL - e.totalSentSOL
  }

  const all = [...addressMap.values()]
  const planets = all
    .filter(a => a.totalSentSOL > 0.1)
    .sort((a, b) => b.totalSentSOL - a.totalSentSOL)
    .slice(0, 20)

  const starAddresses = all.filter(a => a.totalSentSOL <= 0.1)

  let mostActiveDay = '', maxDay = 0
  for (const [day, count] of dailyCounts) {
    if (count > maxDay) { maxDay = count; mostActiveDay = day }
  }

  const times = transfers.map(t => t.time).filter(Boolean)
  const firstTxTime = times.length ? Math.min(...times) : null
  const walletAge = firstTxTime
    ? Math.floor((Date.now() / 1000 - firstTxTime) / 86400)
    : 0

  const firstTx = transfers
    .filter(t => t.time === firstTxTime)
    .find(t => t.from === walletAddress || t.to === walletAddress) || null

  const totalMoons = planets.reduce((sum, p) =>
    sum + Math.min(p.transactions.filter(t => t.direction === 'out').length, 8), 0)

  const walletStats = {
    totalSent,
    totalReceived,
    netFlow: totalReceived - totalSent,
    mostActiveDay,
    walletAge,
    firstTxTime,
    firstTx,
    totalTxCount: transfers.length,
    planetsCount: planets.length,
    starsCount: starAddresses.length,
    totalMoons,
  }

  return { planets, stars: starAddresses, walletStats }
}

export function getPlanetColor(planet) {
  const { netFlow, totalSentSOL } = planet
  if (totalSentSOL === 0) return '#4488ff'
  const ratio = netFlow / totalSentSOL

  if (ratio > 0.1) {
    const t = Math.min(ratio, 1)
    return lerpColor('#00aa55', '#00ff88', t * 0.6 + 0.2)
  } else if (ratio < -0.1) {
    const t = Math.min(Math.abs(ratio), 1)
    return lerpColor('#ff6600', '#cc0000', t)
  }
  return '#3366dd'
}

function lerpColor(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

export function truncAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function fmtSOL(n) {
  return Number(n).toFixed(n < 0.01 ? 4 : 2)
}
