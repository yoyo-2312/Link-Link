import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  applyGravity,
  createLevelBoard,
  findAvailablePair,
  findPath,
  LEVELS,
  remainingTiles,
  reshuffleBoard,
  samePoint,
  type Board,
  type Point,
} from "./game";

type Phase = "playing" | "paused" | "won" | "lost";
type Progress = { unlocked: number; stars: number[]; best: number[] };
type MatchLine = { path: Point[]; first: Point; second: Point };

const SHAPES = [
  <circle cx="24" cy="24" r="12" />,
  <rect x="12" y="12" width="24" height="24" rx="3" />,
  <path d="M24 9 39 37H9Z" />,
  <path d="M24 8 40 24 24 40 8 24Z" />,
  <path d="M24 7 40 20 34 39H14L8 20Z" />,
  <path d="M24 7 29 18 41 19 32 28 35 40 24 34 13 40 16 28 7 19 19 18Z" />,
  <path d="M11 11h26v8H19v18h-8Z" />,
  <path d="M24 9a15 15 0 1 1-15 15h8a7 7 0 1 0 7-7Z" />,
  <path d="M20 8h8v12h12v8H28v12h-8V28H8v-8h12Z" />,
  <path d="m16 10 16 0 9 14-9 14H16L7 24Z" />,
  <path d="M10 12h28M10 24h28M10 36h28" />,
  <path d="M10 10h28L27 24l11 14H10l11-14Z" />,
];

function readProgress(): Progress {
  try {
    const current = localStorage.getItem("link-link-progress-v3");
    const legacy = current === null;
    const saved = JSON.parse(
      current ?? localStorage.getItem("link-link-progress-v2") ?? "{}",
    );
    const previousUnlocked = Math.max(1, Number(saved.unlocked) || 1);
    const savedIndex = (index: number) =>
      legacy ? LEVELS[index].sourceNumber - 1 : index;
    return {
      unlocked: legacy
        ? Math.min(
            LEVELS.length,
            1 + LEVELS.filter((level) => level.sourceNumber < previousUnlocked)
              .length,
          )
        : Math.min(LEVELS.length, previousUnlocked),
      stars: Array.from({ length: LEVELS.length }, (_, i) =>
        Math.max(0, Math.min(3, Number(saved.stars?.[savedIndex(i)]) || 0)),
      ),
      best: Array.from({ length: LEVELS.length }, (_, i) =>
        Math.max(0, Number(saved.best?.[savedIndex(i)]) || 0),
      ),
    };
  } catch {
    return {
      unlocked: 1,
      stars: Array(LEVELS.length).fill(0),
      best: Array(LEVELS.length).fill(0),
    };
  }
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function Shape({ value }: { value: number }) {
  return (
    <svg className="shape" viewBox="0 0 48 48" aria-hidden="true">
      {SHAPES[value]}
    </svg>
  );
}

export default function App() {
  const [progress, setProgress] = useState(readProgress);
  const [levelIndex, setLevelIndex] = useState(
    () => readProgress().unlocked - 1,
  );
  const level = LEVELS[levelIndex];
  const [board, setBoard] = useState<Board>(() =>
    createLevelBoard(LEVELS[readProgress().unlocked - 1]),
  );
  const [phase, setPhase] = useState<Phase>("playing");
  const [seconds, setSeconds] = useState(
    () => LEVELS[readProgress().unlocked - 1].seconds,
  );
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [selected, setSelected] = useState<Point | null>(null);
  const [matchLine, setMatchLine] = useState<MatchLine | null>(null);
  const [hint, setHint] = useState<Point[] | null>(null);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [shufflesLeft, setShufflesLeft] = useState(1);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem("link-link-sound") !== "off";
    } catch {
      return true;
    }
  });
  const [message, setMessage] = useState("连接相同图形，路线最多转弯两次。");
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const [tileSize, setTileSize] = useState(48);
  const boardSpaceRef = useRef<HTMLDivElement>(null);
  const finishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatch = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const tilesLeft = remainingTiles(board);
  const totalTiles = level.rows * level.cols - level.blockers;
  const completion = Math.round((1 - tilesLeft / totalTiles) * 100);
  const starsEarned =
    seconds >= level.seconds * 0.5 ? 3 : seconds >= level.seconds * 0.2 ? 2 : 1;
  const completedLevels = progress.stars.filter((stars) => stars > 0).length;

  useEffect(() => {
    if (phase !== "playing" || levelPickerOpen) return;
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [phase, levelPickerOpen]);

  useEffect(() => {
    if (phase === "playing" && seconds === 0) {
      setPhase("lost");
      setMessage("时间到！再挑战一次。");
    }
  }, [phase, seconds]);

  useEffect(() => {
    const element = boardSpaceRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth - 40;
      const height = element.clientHeight - 40;
      setTileSize(
        Math.max(
          16,
          Math.min(
            80,
            Math.floor((width - (level.cols - 1) * 5) / level.cols),
            Math.floor((height - (level.rows - 1) * 5) / level.rows),
          ),
        ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [levelIndex]);

  useEffect(
    () => () => {
      if (finishTimeout.current) clearTimeout(finishTimeout.current);
      if (hintTimeout.current) clearTimeout(hintTimeout.current);
    },
    [],
  );

  function beep(frequency: number, duration = 0.08) {
    if (!sound) return;
    try {
      audioContext.current ??= new AudioContext();
      const audio = audioContext.current;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + duration,
      );
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      /* Sound is optional. */
    }
  }

  function loadLevel(index: number) {
    if (index < 0 || index >= LEVELS.length) return;
    if (finishTimeout.current) clearTimeout(finishTimeout.current);
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    const next = LEVELS[index];
    setLevelIndex(index);
    setBoard(createLevelBoard(next));
    setPhase("playing");
    setSeconds(next.seconds);
    setScore(0);
    setCombo(0);
    setSelected(null);
    setMatchLine(null);
    setHint(null);
    setHintsLeft(2);
    setShufflesLeft(1);
    setMessage(
      next.gravity
        ? "重力关卡：消除后图形会向下落。"
        : "连接相同图形，路线最多转弯两次。",
    );
    setLevelPickerOpen(false);
    lastMatch.current = 0;
  }

  function finishLevel(finalScore: number) {
    const updated: Progress = {
      unlocked: Math.min(
        LEVELS.length,
        Math.max(progress.unlocked, level.number + 1),
      ),
      stars: [...progress.stars],
      best: [...progress.best],
    };
    updated.stars[levelIndex] = Math.max(
      updated.stars[levelIndex],
      starsEarned,
    );
    updated.best[levelIndex] = Math.max(updated.best[levelIndex], finalScore);
    setProgress(updated);
    try {
      localStorage.setItem("link-link-progress-v3", JSON.stringify(updated));
    } catch {
      /* Progress remains in memory. */
    }
    setPhase("won");
    setMessage(`第 ${level.number} 关通关！`);
    beep(880, 0.23);
  }

  function selectTile(point: Point) {
    const value = board[point.row][point.col];
    if (
      phase !== "playing" ||
      levelPickerOpen ||
      matchLine ||
      value === null ||
      value < 0
    )
      return;
    setHint(null);
    if (!selected) {
      setSelected(point);
      beep(440, 0.05);
      return;
    }
    if (samePoint(selected, point)) {
      setSelected(null);
      return;
    }
    const path = findPath(board, selected, point);
    if (!path) {
      setSelected(point);
      setCombo(0);
      setMessage(
        board[selected.row][selected.col] === value
          ? "这条路线超过两次转弯。"
          : "请选择两个相同图形。",
      );
      beep(220, 0.07);
      return;
    }

    const nextCombo =
      Date.now() - lastMatch.current < 4500 ? Math.min(combo + 1, 5) : 1;
    lastMatch.current = Date.now();
    setCombo(nextCombo);
    setMatchLine({ path, first: selected, second: point });
    setSelected(null);
    setMessage(nextCombo > 1 ? `漂亮！连击 ×${nextCombo}` : "连接成功！");
    beep(660, 0.1);
    finishTimeout.current = setTimeout(() => {
      let next = board.map((line) => [...line]);
      next[selected.row][selected.col] = null;
      next[point.row][point.col] = null;
      if (level.gravity) next = applyGravity(next);
      const finalScore = score + 100 * nextCombo;
      setScore(finalScore);
      setMatchLine(null);
      if (remainingTiles(next) === 0) {
        setBoard(next);
        finishLevel(finalScore);
      } else if (!findAvailablePair(next)) {
        setBoard(reshuffleBoard(next));
        setMessage("无可连接的图形，棋盘已自动重排。");
      } else setBoard(next);
    }, 230);
  }

  function showHint() {
    if (phase !== "playing" || matchLine || hintsLeft === 0) return;
    const pair = findAvailablePair(board);
    if (!pair) return;
    setHintsLeft((value) => value - 1);
    setHint([pair.first, pair.second]);
    setMessage("已标出一组可连接的图形。");
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    hintTimeout.current = setTimeout(() => setHint(null), 2200);
  }

  function doShuffle() {
    if (phase !== "playing" || matchLine || shufflesLeft === 0) return;
    setShufflesLeft((value) => value - 1);
    setBoard(reshuffleBoard(board));
    setSelected(null);
    setHint(null);
    setCombo(0);
    setMessage("棋盘已重排。");
  }

  function toggleSound() {
    setSound((value) => {
      try {
        localStorage.setItem("link-link-sound", value ? "off" : "on");
      } catch {
        /* Sound remains in memory. */
      }
      return !value;
    });
  }

  function openLevelPicker() {
    setLevelPickerOpen(true);
  }

  const boardWidth = level.cols * tileSize + (level.cols - 1) * 5;
  const boardHeight = level.rows * tileSize + (level.rows - 1) * 5;
  const linePoints = matchLine?.path
    .map(({ row, col }) => {
      const x =
        col === 0
          ? 7
          : col === level.cols + 1
            ? boardWidth + 17
            : 12 + (col - 1) * (tileSize + 5) + tileSize / 2;
      const y =
        row === 0
          ? 7
          : row === level.rows + 1
            ? boardHeight + 17
            : 12 + (row - 1) * (tileSize + 5) + tileSize / 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            link<span className="brand-dot">.</span>link
          </span>
        </div>
        <span className="topbar-center">
          几何连连看 <span>·</span> {LEVELS.length} 关闯关挑战
        </span>
        <div className="topbar-actions">
          <button
            className="icon-button"
            onClick={toggleSound}
            title={sound ? "关闭音效" : "开启音效"}
            aria-label={sound ? "关闭音效" : "开启音效"}
          >
            {sound ? "♫" : "♪̸"}
          </button>
          <button className="level-menu-button" onClick={openLevelPicker}>
            关卡列表 <span>▦</span>
          </button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="side-label">LEVEL SELECT</div>
          <h2>选择关卡</h2>
          <p>
            已通关 {completedLevels} / {LEVELS.length} 关<br />
            点击任意关卡开始
          </p>
          <div className="sidebar-progress">
            <div
              style={{ width: `${(completedLevels / LEVELS.length) * 100}%` }}
            />
          </div>
          <div className="side-divider" />
          <div className="sidebar-levels">
            {LEVELS.map((item) => (
              <button
                key={item.number}
                className={`mini-level ${item.number === level.number ? "active" : ""}`}
                onClick={() => loadLevel(item.number - 1)}
                aria-label={`第 ${item.number} 关`}
              >
                {String(item.number).padStart(2, "0")}
                {progress.stars[item.number - 1] > 0 && <small>★</small>}
              </button>
            ))}
          </div>
          <div className="side-tip">
            <span>✳</span>
            <p>相同图形之间的连线最多转弯两次。随时选择想玩的关卡。</p>
          </div>
        </aside>

        <section className="game-panel" aria-label="连连看游戏">
          <div className="game-head">
            <div className="game-heading">
              <span className="level-chip">
                LEVEL {String(level.number).padStart(2, "0")}
              </span>
              <div>
                <h1>
                  第 {level.number} 关
                </h1>
                <p>
                  {level.cols} × {level.rows} 棋盘{" "}
                  {level.blockers > 0 && <span>· 固定障碍</span>}{" "}
                  {level.gravity && <span>· 重力下落</span>}
                </p>
              </div>
            </div>
            <div className="head-stats">
              <div>
                <small>本关得分</small>
                <strong>{score.toLocaleString()}</strong>
              </div>
              <div className={`time-stat ${seconds <= 20 ? "urgent" : ""}`}>
                <small>剩余时间</small>
                <strong>{formatTime(seconds)}</strong>
              </div>
            </div>
          </div>
          <div className="progress-row">
            <span>
              完成进度 <b>{completion}%</b>
            </span>
            <span>
              剩余 <b>{tilesLeft}</b> 块
            </span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${completion}%` }} />
          </div>

          <div className="board-space" ref={boardSpaceRef}>
            <div
              className="board-inner"
              style={
                {
                  "--cols": level.cols,
                  "--tile": `${tileSize}px`,
                } as CSSProperties
              }
            >
              <div
                className="board-grid"
                role="grid"
                aria-label={`第 ${level.number} 关棋盘`}
              >
                {board.map((line, row) =>
                  line.map((value, col) => {
                    const point = { row, col };
                    const chosen = selected && samePoint(selected, point);
                    const highlighted = hint?.some((item) =>
                      samePoint(item, point),
                    );
                    const matching =
                      matchLine &&
                      (samePoint(matchLine.first, point) ||
                        samePoint(matchLine.second, point));
                    return (
                      <button
                        key={`${row}-${col}`}
                        type="button"
                        role="gridcell"
                        className={`tile ${value === null ? "empty" : value < 0 ? "blocker" : `shape-${value}`} ${chosen ? "selected" : ""} ${highlighted ? "hinted" : ""} ${matching ? "matching" : ""}`}
                        disabled={
                          value === null ||
                          value < 0 ||
                          phase !== "playing" ||
                          !!matchLine ||
                          levelPickerOpen
                        }
                        onClick={() => selectTile(point)}
                        aria-label={`第 ${row + 1} 行第 ${col + 1} 列，${value === null ? "空位" : value < 0 ? "障碍" : `图形 ${value + 1}`}`}
                        aria-selected={!!chosen}
                      >
                        {value !== null && value >= 0 && (
                          <Shape value={value} />
                        )}
                        {value === -1 && (
                          <span className="blocker-mark">×</span>
                        )}
                      </button>
                    );
                  }),
                )}
              </div>
              {linePoints && (
                <svg
                  className="match-overlay"
                  width={boardWidth + 24}
                  height={boardHeight + 24}
                  viewBox={`0 0 ${boardWidth + 24} ${boardHeight + 24}`}
                  aria-hidden="true"
                >
                  <polyline points={linePoints} />
                </svg>
              )}
            </div>
            {phase !== "playing" && !levelPickerOpen && (
              <div className="result-overlay">
                <div className="result-card">
                  <div className="result-icon">
                    {phase === "won" ? "✳" : phase === "lost" ? "⌛" : "Ⅱ"}
                  </div>
                  <h2>
                    {phase === "won"
                      ? "连接完成！"
                      : phase === "lost"
                        ? "时间到了"
                        : "已暂停"}
                  </h2>
                  <p>
                    {phase === "won"
                      ? `第 ${level.number} 关通关 · ${"★".repeat(starsEarned)}${"☆".repeat(3 - starsEarned)}`
                      : phase === "lost"
                        ? "再试一次，你会找到更好的路线。"
                        : "准备好了就继续。"}
                  </p>
                  <div className="result-actions">
                    {phase === "won" && levelIndex < LEVELS.length - 1 && (
                      <button
                        className="primary-button"
                        onClick={() => loadLevel(levelIndex + 1)}
                      >
                        下一关 →
                      </button>
                    )}
                    {phase === "paused" && (
                      <button
                        className="primary-button"
                        onClick={() => setPhase("playing")}
                      >
                        继续游戏 →
                      </button>
                    )}
                    {phase !== "paused" && (
                      <button
                        className={
                          phase === "won" && levelIndex < LEVELS.length - 1
                            ? "secondary-button"
                            : "primary-button"
                        }
                        onClick={() => loadLevel(levelIndex)}
                      >
                        再玩一次
                      </button>
                    )}
                  </div>
                  {phase === "won" && (
                    <button className="text-button" onClick={openLevelPicker}>
                      选择其他关卡
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="game-footer">
            <p className="game-message" aria-live="polite">
              <span>✳</span> {message}
            </p>
            <div className="game-controls">
              <button
                onClick={() =>
                  setPhase(phase === "playing" ? "paused" : "playing")
                }
                disabled={phase === "won" || phase === "lost"}
              >
                {phase === "paused" ? "▶ 继续" : "Ⅱ 暂停"}
              </button>
              <button
                onClick={showHint}
                disabled={phase !== "playing" || hintsLeft === 0}
              >
                ◇ 提示 <small>{hintsLeft}</small>
              </button>
              <button
                onClick={doShuffle}
                disabled={phase !== "playing" || shufflesLeft === 0}
              >
                ⤨ 重排 <small>{shufflesLeft}</small>
              </button>
              <button onClick={() => loadLevel(levelIndex)}>↺ 重玩</button>
            </div>
          </div>
        </section>
      </main>

      {levelPickerOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLevelPickerOpen(false);
          }}
        >
          <div
            className="level-modal"
            role="dialog"
            aria-modal="true"
            aria-label="选择关卡"
          >
            <div className="modal-head">
              <div>
                <span>LEVEL SELECT</span>
                <h2>选择关卡</h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setLevelPickerOpen(false)}
                aria-label="关闭关卡列表"
              >
                ×
              </button>
            </div>
            <p className="modal-help">所有关卡均可直接挑战，已通关的关卡可随时重玩。</p>
            <div className="level-grid">
              {LEVELS.map((item) => (
                <button
                  key={item.number}
                  className={`level-card ${item.number === level.number ? "current" : ""}`}
                  onClick={() => loadLevel(item.number - 1)}
                >
                  <strong>{String(item.number).padStart(2, "0")}</strong>
                  <span>
                    {progress.stars[item.number - 1]
                      ? `${"★".repeat(progress.stars[item.number - 1])}${"☆".repeat(3 - progress.stars[item.number - 1])}`
                      : "待挑战"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
