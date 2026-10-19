import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createBoard, findAvailablePair, findPath, LEVELS, remainingTiles, reshuffleBoard, samePoint, type Board, type Difficulty, type Point } from './game'

type Phase = 'ready' | 'playing' | 'paused' | 'won' | 'lost'
type MatchLine = { path: Point[]; first: Point; second: Point }

const SHAPES = [
  <circle cx="24" cy="24" r="12" />,
  <rect x="13" y="13" width="22" height="22" rx="3" />,
  <path d="M24 10 38 36H10Z" />,
  <path d="M24 9 38 24 24 39 10 24Z" />,
  <path d="M24 8 39 19 33 37H15L9 19Z" />,
  <path d="M24 9 28.5 19.5 40 20.5 31 28.5 34 40 24 33.5 14 40 17 28.5 8 20.5 19.5 19.5Z" />,
  <path d="M12 12h24v8H20v16h-8Z" />,
  <path d="M24 9a15 15 0 1 1-15 15h8a7 7 0 1 0 7-7Z" />,
]

const ICONS = {
  play: <path d="m8 5 12 7-12 7V5Z" />,
  pause: <><path d="M8 5h3v14H8zM15 5h3v14h-3z" /></>,
  hint: <><path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0c-1.3 1-1.5 2-1.5 4h-5C9.5 16 9.3 15 8 14Z" /></>,
  shuffle: <><path d="M4 7h3c5 0 5 10 10 10h3m-3-3 3 3-3 3M4 17h3c2 0 3-1.5 4-3m2-4c1-1.8 2-3 4-3h3m-3-3 3 3-3 3" /></>,
  sound: <><path d="M4 9v6h4l5 4V5L8 9H4Zm12-1a6 6 0 0 1 0 8m2-11a10 10 0 0 1 0 14" /></>,
  mute: <><path d="M4 9v6h4l5 4V5L8 9H4Zm12 0 5 6m0-6-5 6" /></>,
  restart: <><path d="M20 11a8 8 0 1 1-2-5.5M20 4v7h-7" /></>,
} as const

function Icon({ name }: { name: keyof typeof ICONS }) {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
}

function Shape({ value }: { value: number }) {
  return <svg className="shape" viewBox="0 0 48 48" aria-hidden="true">{SHAPES[value]}</svg>
}

function readBest(): Record<Difficulty, number> {
  try { return { easy: 0, normal: 0, hard: 0, ...JSON.parse(localStorage.getItem('link-link-best') ?? '{}') } }
  catch { return { easy: 0, normal: 0, hard: 0 } }
}

function readSound(): boolean {
  try { return localStorage.getItem('link-link-sound') !== 'off' }
  catch { return true }
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [board, setBoard] = useState<Board>(() => createBoard(LEVELS.normal.rows, LEVELS.normal.cols))
  const [phase, setPhase] = useState<Phase>('ready')
  const [selected, setSelected] = useState<Point | null>(null)
  const [matchLine, setMatchLine] = useState<MatchLine | null>(null)
  const [hint, setHint] = useState<Point[] | null>(null)
  const [seconds, setSeconds] = useState(LEVELS.normal.seconds)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [best, setBest] = useState(readBest)
  const [sound, setSound] = useState(readSound)
  const [message, setMessage] = useState('准备好了吗？选择相同的几何图形开始连接。')
  const [tileSize, setTileSize] = useState(54)
  const boardRef = useRef<HTMLDivElement>(null)
  const finishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const lastMatch = useRef(0)
  const level = LEVELS[difficulty]
  const tilesLeft = remainingTiles(board)
  const progress = (1 - tilesLeft / (level.rows * level.cols)) * 100

  useEffect(() => {
    if (phase !== 'playing') return
    const timer = window.setInterval(() => setSeconds(current => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase === 'playing' && seconds === 0) {
      setPhase('lost')
      setMessage('时间到了，再试一次吧。')
    }
  }, [phase, seconds])

  useEffect(() => {
    const measure = () => {
      if (!boardRef.current) return
      const width = boardRef.current.clientWidth - 24
      setTileSize(Math.min(62, Math.floor((width - (level.cols - 1) * 7) / level.cols)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [difficulty])

  useEffect(() => () => {
    if (finishTimeout.current) clearTimeout(finishTimeout.current)
    if (hintTimeout.current) clearTimeout(hintTimeout.current)
  }, [])

  function beep(frequency: number, duration = 0.09) {
    if (!sound) return
    try {
      audioContext.current ??= new AudioContext()
      const context = audioContext.current
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.045, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + duration)
    } catch { /* Audio is optional. */ }
  }

  function reset(nextDifficulty = difficulty) {
    if (finishTimeout.current) clearTimeout(finishTimeout.current)
    if (hintTimeout.current) clearTimeout(hintTimeout.current)
    const nextLevel = LEVELS[nextDifficulty]
    setDifficulty(nextDifficulty)
    setBoard(createBoard(nextLevel.rows, nextLevel.cols))
    setSeconds(nextLevel.seconds)
    setScore(0)
    setCombo(0)
    setSelected(null)
    setMatchLine(null)
    setHint(null)
    setPhase('ready')
    setMessage('准备好了吗？选择相同的几何图形开始连接。')
    lastMatch.current = 0
  }

  function start() {
    setPhase('playing')
    setMessage('找出两个相同图形，连线最多转弯两次。')
  }

  function selectTile(point: Point) {
    if (phase !== 'playing' || matchLine || board[point.row][point.col] === null) return
    setHint(null)
    if (!selected) { setSelected(point); beep(440, 0.055); return }
    if (samePoint(selected, point)) { setSelected(null); return }
    const path = findPath(board, selected, point)
    if (!path) {
      setSelected(point)
      setCombo(0)
      setMessage(board[selected.row][selected.col] === board[point.row][point.col] ? '这两个图形的路径超过两次转弯。' : '请选两个相同的图形。')
      beep(220, 0.07)
      return
    }

    const nextCombo = Date.now() - lastMatch.current < 4500 ? Math.min(combo + 1, 5) : 1
    lastMatch.current = Date.now()
    setCombo(nextCombo)
    setMatchLine({ path, first: selected, second: point })
    setSelected(null)
    setMessage(nextCombo > 1 ? `连击 ×${nextCombo}，继续保持！` : '连接成功！')
    beep(660, 0.11)
    finishTimeout.current = setTimeout(() => {
      const next = board.map(line => [...line])
      next[selected.row][selected.col] = null
      next[point.row][point.col] = null
      const newScore = score + 100 * nextCombo
      setScore(newScore)
      setMatchLine(null)
      if (remainingTiles(next) === 0) {
        setBoard(next)
        setPhase('won')
        setMessage('全部连接完成，漂亮！')
        if (newScore > best[difficulty]) {
          const updated = { ...best, [difficulty]: newScore }
          setBest(updated)
          try { localStorage.setItem('link-link-best', JSON.stringify(updated)) } catch { /* Storage is optional. */ }
        }
        beep(880, 0.22)
      } else if (!findAvailablePair(next)) {
        setBoard(reshuffleBoard(next))
        setMessage('棋盘已自动重排，继续寻找配对。')
      } else setBoard(next)
    }, 260)
  }

  function showHint() {
    if (phase !== 'playing' || matchLine || seconds <= 10) return
    const pair = findAvailablePair(board)
    if (!pair) return
    setHint([pair.first, pair.second])
    setSeconds(current => Math.max(0, current - 10))
    setMessage('已标出一组可连接的图形，消耗 10 秒。')
    if (hintTimeout.current) clearTimeout(hintTimeout.current)
    hintTimeout.current = setTimeout(() => setHint(null), 2200)
  }

  function doShuffle() {
    if (phase !== 'playing' || matchLine || seconds <= 5) return
    setBoard(reshuffleBoard(board))
    setSelected(null)
    setHint(null)
    setSeconds(current => Math.max(0, current - 5))
    setCombo(0)
    setMessage('图形已重排，消耗 5 秒。')
  }

  function toggleSound() {
    setSound(current => {
      try { localStorage.setItem('link-link-sound', current ? 'off' : 'on') } catch { /* Storage is optional. */ }
      return !current
    })
  }

  const boardWidth = level.cols * tileSize + (level.cols - 1) * 7
  const boardHeight = level.rows * tileSize + (level.rows - 1) * 7
  const linePoints = matchLine?.path.map(({ row, col }) => {
    const x = col === 0 ? 7 : col === level.cols + 1 ? boardWidth + 17 : 12 + (col - 1) * (tileSize + 7) + tileSize / 2
    const y = row === 0 ? 7 : row === level.rows + 1 ? boardHeight + 17 : 12 + (row - 1) * (tileSize + 7) + tileSize / 2
    return `${x},${y}`
  }).join(' ')

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Link Link 首页"><span className="brand-mark"><span /><span /><span /><span /></span><span>link<span className="brand-dot">.</span>link</span></a>
      <span className="header-tag">A GEOMETRIC MATCHING GAME <span className="tag-star">✳</span> NO. 001</span>
      <button className="sound-button" onClick={toggleSound} aria-label={sound ? '关闭音效' : '开启音效'} title={sound ? '关闭音效' : '开启音效'}><Icon name={sound ? 'sound' : 'mute'} /></button>
    </header>

    <main id="top">
      <section className="intro">
        <div className="intro-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> 轻松一点，连成一线 <span className="eyebrow-line" /></div>
          <h1>让每一次<br /><em>相遇</em>都有迹可循<span className="heading-period">.</span></h1>
          <p>找到相同的几何图形，用不超过两次转弯的路径连接它们。放慢节奏，享受恰到好处的专注。</p>
          <div className="intro-meta"><span><b>01</b> 观察</span><i /> <span><b>02</b> 连接</span><i /> <span><b>03</b> 清空</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit art-orbit-one" /><div className="art-orbit art-orbit-two" />
          <div className="art-tile art-tile-a"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="12" /></svg></div>
          <div className="art-tile art-tile-b"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="12" /></svg></div>
          <div className="art-tile art-tile-c"><svg viewBox="0 0 48 48"><path d="M24 10 38 36H10Z" /></svg></div>
          <div className="art-line" /><span className="art-caption">FIND YOUR CONNECTION</span>
        </div>
      </section>

      <section className="game-section" aria-label="连连看游戏">
        <div className="section-heading"><div><span className="section-index">01 / THE GAME</span><h2>开始连接<span>.</span></h2></div><p>选择难度，准备好进入几何世界。</p></div>
        <div className="game-layout">
          <aside className="control-panel">
            <div className="panel-top"><span className="panel-label">LEVEL SELECT</span><span className="tiny-shape">✳</span></div>
            <h3>选择你的<br />节奏</h3>
            <div className="level-list" role="group" aria-label="游戏难度">
              {(Object.keys(LEVELS) as Difficulty[]).map((key, index) => <button key={key} className={`level-option ${difficulty === key ? 'active' : ''}`} onClick={() => reset(key)} aria-pressed={difficulty === key}><span className="level-number">0{index + 1}</span><span className="level-name">{LEVELS[key].label}</span><span className="level-size">{LEVELS[key].cols} × {LEVELS[key].rows}</span><span className="level-arrow">↗</span></button>)}
            </div>
            <div className="control-divider" />
            <div className="stat-grid"><div><span>本局得分</span><strong>{score.toLocaleString()}</strong></div><div><span>最佳记录</span><strong>{best[difficulty].toLocaleString()}</strong></div></div>
            <div className="howto"><span className="howto-icon">i</span><p>相同图形之间的连线最多转弯两次，也可以绕过棋盘边缘。</p></div>
          </aside>

          <div className="play-panel">
            <div className="play-toolbar"><div className="play-title"><span className="live-dot" /> {phase === 'playing' ? '正在进行' : phase === 'paused' ? '已暂停' : phase === 'won' ? '挑战成功' : phase === 'lost' ? '时间结束' : '等待开始'} <span className="play-divider">/</span> {level.label}模式</div><div className={`timer ${seconds <= 30 ? 'timer-urgent' : ''}`} aria-label={`剩余时间 ${formatTime(seconds)}`}>{formatTime(seconds)}</div></div>
            <div className="progress-area"><div className="progress-label"><span>完成进度</span><span>{Math.round(progress)}%</span></div><div className="progress-track"><div style={{ width: `${progress}%` }} /></div></div>
            <div className="board-wrap" ref={boardRef}>
              <div className="board-inner" style={{ '--cols': level.cols, '--tile': `${tileSize}px` } as CSSProperties}>
                <div className="board-grid" role="grid" aria-label={`${level.rows} 行 ${level.cols} 列游戏棋盘`}>
                  {board.map((line, row) => line.map((value, col) => {
                    const point = { row, col }
                    const chosen = selected && samePoint(selected, point)
                    const highlighted = hint?.some(p => samePoint(p, point))
                    const matching = matchLine && (samePoint(matchLine.first, point) || samePoint(matchLine.second, point))
                    return <button type="button" role="gridcell" key={`${row}-${col}`} className={`tile ${value === null ? 'empty' : `shape-${value}`} ${chosen ? 'selected' : ''} ${highlighted ? 'hinted' : ''} ${matching ? 'matching' : ''}`} disabled={value === null || phase !== 'playing' || !!matchLine} onClick={() => selectTile(point)} aria-label={value === null ? `第 ${row + 1} 行第 ${col + 1} 列，空位` : `第 ${row + 1} 行第 ${col + 1} 列，图形 ${value + 1}`} aria-selected={!!chosen}>{value !== null && <Shape value={value} />}</button>
                  }))}
                </div>
                {linePoints && <svg className="match-overlay" width={boardWidth + 24} height={boardHeight + 24} viewBox={`0 0 ${boardWidth + 24} ${boardHeight + 24}`} aria-hidden="true"><polyline points={linePoints} /></svg>}
              </div>
              {phase !== 'playing' && <div className="board-cover"><div className="cover-symbol">{phase === 'won' ? '✳' : phase === 'lost' ? '⌛' : phase === 'paused' ? 'Ⅱ' : '↗'}</div><h3>{phase === 'won' ? '挑战完成！' : phase === 'lost' ? '时间到了' : phase === 'paused' ? '稍作休息' : '准备开始？'}</h3><p>{phase === 'won' ? `得分 ${score.toLocaleString()} · 用时 ${formatTime(level.seconds - seconds)}` : phase === 'lost' ? '换个节奏，再试一次。' : phase === 'paused' ? '你的棋盘在这里等你。' : '点击下方按钮，开启这一局。'}</p><button className="cover-button" onClick={phase === 'paused' ? start : phase === 'ready' ? start : () => { reset(); setPhase('playing'); setMessage('找出两个相同图形，连线最多转弯两次。') }}>{phase === 'paused' ? '继续游戏' : phase === 'ready' ? '开始游戏' : '再玩一次'} <span>→</span></button></div>}
            </div>
            <div className="play-actions"><div className="action-buttons"><button onClick={() => phase === 'playing' ? setPhase('paused') : phase === 'paused' ? start() : phase === 'ready' ? start() : reset()}><Icon name={phase === 'playing' ? 'pause' : phase === 'paused' || phase === 'ready' ? 'play' : 'restart'} /> {phase === 'playing' ? '暂停' : phase === 'paused' ? '继续' : phase === 'ready' ? '开始' : '重玩'}</button><button onClick={showHint} disabled={phase !== 'playing' || seconds <= 10}><Icon name="hint" /> 提示 <small>−10s</small></button><button onClick={doShuffle} disabled={phase !== 'playing' || seconds <= 5}><Icon name="shuffle" /> 重排 <small>−5s</small></button></div><span className="remaining">剩余 <b>{tilesLeft}</b> 块</span></div>
            <p className="game-message" aria-live="polite"><span>↗</span> {message}</p>
          </div>
        </div>
      </section>
      <footer><span>LINK LINK © 2026</span><span>一个关于观察与连接的小小练习 <span className="footer-star">✳</span></span></footer>
    </main>
  </div>
}
