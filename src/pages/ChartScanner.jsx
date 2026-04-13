import { useState, useRef } from 'react'
import styles from './ChartScanner.module.css'

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']

export default function ChartScanner({ plan }) {
  const [image, setImage]         = useState(null)
  const [imageB64, setImageB64]   = useState(null)
  const [symbol, setSymbol]       = useState('')
  const [timeframe, setTimeframe] = useState('H1')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [step, setStep]           = useState(0)
  const fileRef = useRef()

  const STEPS = [
    'Reading chart structure...',
    'Detecting SMC patterns...',
    'Mapping liquidity zones...',
    'Identifying FVG zones...',
    'Calculating confluence...',
    'Generating signal...',
  ]

  if (plan !== 'premium') {
    return (
      <div className={styles.locked}>
        <div className={styles.lockedIcon}>🔒</div>
        <div className={styles.lockedTitle}>Premium Feature</div>
        <div className={styles.lockedText}>Chart Screenshot Scanner is available on Premium plan only. Upload any chart and AI reads it directly.</div>
      </div>
    )
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setImage(url)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      const base64 = e.target.result.split(',')[1]
      setImageB64(base64)
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  async function handleScan() {
    if (!imageB64) return
    setLoading(true)
    setResult(null)
    setError('')
    setStep(0)

    const interval = setInterval(() => {
      setStep(s => s < STEPS.length - 1 ? s + 1 : s)
    }, 700)

    try {
      const res = await fetch('/api/analyze-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageB64, symbol: symbol.trim().toUpperCase(), timeframe })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setResult(data.result)
    } catch (err) {
      setError('Scan failed: ' + err.message)
    } finally {
      clearInterval(interval)
      setStep(STEPS.length - 1)
      setLoading(false)
    }
  }

  function getDir(d) {
    if (d === 'BUY') return { color: '#00e676', icon: '▲' }
    if (d === 'SELL') return { color: '#ff4444', icon: '▼' }
    return { color: '#888', icon: '◆' }
  }

  function getScoreColor(s) {
    if (s >= 75) return '#00e676'
    if (s >= 50) return '#ffd600'
    return '#ff4444'
  }

  return (
    <div className={styles.wrap}>

      {/* Symbol + TF row */}
      <div className={styles.topRow}>
        <input
          className={styles.symbolInput}
          placeholder="Symbol e.g. XAU/USD"
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
        />
        <div className={styles.tfRow}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              className={`${styles.tfBtn} ${timeframe === tf ? styles.tfBtnActive : ''}`}
              onClick={() => setTimeframe(tf)}
            >{tf}</button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        className={styles.dropZone}
        onClick={() => fileRef.current.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {image ? (
          <div className={styles.previewWrap}>
            <img src={image} alt="chart" className={styles.preview} />
            <button className={styles.removeImg} onClick={e => { e.stopPropagation(); setImage(null); setImageB64(null); setResult(null) }}>✕</button>
          </div>
        ) : (
          <div className={styles.dropInner}>
            <div className={styles.dropIcon}>📸</div>
            <div className={styles.dropTitle}>Upload Chart Screenshot</div>
            <div className={styles.dropSub}>Tap to select or drag & drop your chart image</div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* Scan button */}
      {imageB64 && !loading && (
        <button className={styles.scanBtn} onClick={handleScan}>
          ◎ Scan with AI
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingCard}>
          <div className={styles.loadingOrb}>
            <div className={styles.loadingRing} />
            <div className={styles.loadingCore}>◎</div>
          </div>
          <div className={styles.loadingTitle}>Reading Your Chart</div>
          <div className={styles.loadingBar}>
            <div className={styles.loadingBarFill} style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className={styles.loadingStep}>{STEPS[step]}</div>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {/* Results */}
      {result && !loading && (
        <div className={styles.results}>

          {/* Direction banner */}
          <div className={styles.dirBanner} style={{ borderColor: getDir(result.direction).color, background: `${getDir(result.direction).color}12` }}>
            <div className={styles.dirIcon} style={{ color: getDir(result.direction).color }}>{getDir(result.direction).icon}</div>
            <div>
              <div className={styles.dirLabel} style={{ color: getDir(result.direction).color }}>{result.direction}</div>
              <div className={styles.dirPair}>{symbol || 'Chart'} · {timeframe}</div>
            </div>
            <div className={styles.scoreCircle} style={{ borderColor: getScoreColor(result.confluenceScore) }}>
              <div className={styles.scoreNum} style={{ color: getScoreColor(result.confluenceScore) }}>{result.confluenceScore}</div>
              <div className={styles.scoreLabel}>CONF</div>
            </div>
          </div>

          {/* Levels */}
          <div className={styles.card}>
            <div className={styles.cardLabel}>TRADE LEVELS</div>
            <div className={styles.levelsList}>
              {[
                { t: 'SL', label: 'Stop Loss',  val: result.stopLoss,    color: '#ff4444' },
                { t: 'E',  label: 'Entry',       val: result.entryPrice,  color: '#00bcd4' },
                { t: 'T1', label: 'Target 1',    val: result.takeProfit1, color: 'rgba(0,230,118,0.7)' },
                { t: 'T2', label: 'Target 2',    val: result.takeProfit2, color: 'rgba(0,230,118,0.85)' },
                { t: 'T3', label: 'Target 3',    val: result.takeProfit3, color: '#00e676' },
              ].map(({ t, label, val, color }) => val && (
                <div key={t} className={styles.levelItem} style={{ borderColor: color }}>
                  <div className={styles.levelType} style={{ color }}>{t}</div>
                  <div className={styles.levelName}>{label}</div>
                  <div className={styles.levelPrice} style={{ color }}>{val}</div>
                </div>
              ))}
            </div>
            <div className={styles.rrRow}>
              <span>Risk/Reward:</span>
              <span style={{ color: '#00e676', fontWeight: 700 }}>{result.riskReward}</span>
            </div>
          </div>

          {/* Market Structure */}
          {result.marketStructure && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>MARKET STRUCTURE</div>
              <div className={styles.structureRow}>
                <div className={styles.structureItem}>
                  <div className={styles.structureKey}>Trend</div>
                  <div className={styles.structureVal} style={{ color: result.marketStructure.trend === 'BULLISH' ? '#00e676' : result.marketStructure.trend === 'BEARISH' ? '#ff4444' : '#ffd600' }}>
                    {result.marketStructure.trend}
                  </div>
                </div>
                <div className={styles.structureItem}>
                  <div className={styles.structureKey}>Phase</div>
                  <div className={styles.structureVal}>{result.marketStructure.phase}</div>
                </div>
              </div>
              {result.marketStructure.lastBOS && (
                <div className={styles.structureLine}>
                  <span className={styles.structureKey}>Last BOS:</span>
                  <span style={{ color: '#00bcd4' }}> {result.marketStructure.lastBOS}</span>
                </div>
              )}
              {result.marketStructure.lastChoch && (
                <div className={styles.structureLine}>
                  <span className={styles.structureKey}>CHoCH:</span>
                  <span style={{ color: '#9b5de5' }}> {result.marketStructure.lastChoch}</span>
                </div>
              )}
            </div>
          )}

          {/* SMC Patterns */}
          {result.smcPatterns?.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>SMC PATTERNS DETECTED</div>
              <div className={styles.patternsList}>
                {result.smcPatterns.map((p, i) => (
                  <div key={i} className={styles.patternItem}>
                    <div className={styles.patternName}>{p.pattern}</div>
                    {p.price && <div className={styles.patternPrice}>{p.price}</div>}
                    {p.description && <div className={styles.patternDesc}>{p.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liquidity Zones */}
          {result.liquidityZones?.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>LIQUIDITY ZONES</div>
              {result.liquidityZones.map((z, i) => (
                <div key={i} className={styles.liquidityItem}>
                  <span className={styles.liquidityType} style={{ color: z.type?.includes('Buy') ? '#00e676' : '#ff4444' }}>{z.type}</span>
                  <span className={styles.liquidityPrice}>{z.price}</span>
                  <div className={styles.liquidityDesc}>{z.description}</div>
                </div>
              ))}
            </div>
          )}

          {/* FVG Zones */}
          {result.fvgZones?.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>FAIR VALUE GAPS</div>
              {result.fvgZones.map((z, i) => (
                <div key={i} className={styles.fvgItem}>
                  <span className={styles.fvgType} style={{ color: z.type?.includes('Bullish') ? '#00e676' : '#ff4444' }}>{z.type}</span>
                  <span className={styles.fvgRange}>{z.from} — {z.to}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rationale */}
          {result.tradeRationale && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>AI TRADE RATIONALE</div>
              <div className={styles.rationaleText}>{result.tradeRationale}</div>
              {result.invalidationLevel && (
                <div className={styles.invalidation}>
                  ⚠ Invalidation: <span style={{ color: '#ff4444' }}>{result.invalidationLevel}</span>
                </div>
              )}
            </div>
          )}

          {/* Session */}
          {result.sessionContext && (
            <div className={styles.sessionRow}>
              🌐 {result.sessionContext}
            </div>
          )}

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className={styles.warningsBox}>
              {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          <div className={styles.footer}>CHART ANALYSIS BY NAVIGATOR AI · NOT FINANCIAL ADVICE</div>
        </div>
      )}
    </div>
  )
}
