export async function getAllTransfers(address, apiKey, onProgress) {
  let results = []
  let before = undefined
  let pageCount = 0

  while (true) {
    const params = new URLSearchParams({ 'api-key': apiKey, limit: 100 })
    if (before) params.set('before', before)
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?${params}`

    let res
    try {
      res = await fetch(url)
    } catch {
      if (results.length > 0) return { transfers: results, partial: true }
      throw new Error('Network error')
    }

    if (!res.ok) {
      if (res.status === 400) throw new Error('invalid_address')
      if (results.length > 0) return { transfers: results, partial: true }
      throw new Error(`api_error_${res.status}`)
    }

    const txs = await res.json()
    if (!Array.isArray(txs) || txs.length === 0) break

    for (const tx of txs) {
      for (const t of tx.nativeTransfers || []) {
        if (t.amount > 0 && t.fromUserAccount && t.toUserAccount) {
          results.push({
            from: t.fromUserAccount,
            to: t.toUserAccount,
            sol: t.amount / 1e9,
            time: tx.timestamp,
            signature: tx.signature,
          })
        }
      }
    }

    pageCount++
    onProgress?.(results.length, pageCount * 100)

    before = txs[txs.length - 1].signature
    if (txs.length < 100) break
    if (pageCount >= 50) return { transfers: results, partial: true, capped: true }
  }

  return { transfers: results, partial: false }
}

export async function getSOLBalance(address, apiKey) {
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [address],
      }),
    })
    const data = await res.json()
    return (data.result?.value ?? 0) / 1e9
  } catch {
    return 0
  }
}
