import { useCallback, useEffect, useRef, useState } from 'react';
import './G4.css';

/*  НАСТРОЙКИ  */

const ROUND_MS = 30000; // сколько длится раунд
const START_LIVES = 3; // сколько промахов игрок может себе позволить
const FIRST_DELAY = 700; // пауза перед первой стрелкой
const HUD_STEP = 80; // как часто обновляем таймер на экране

const ARROWS = [
  { key: 'ArrowUp', glyph: '↑', dir: 'up' },
  { key: 'ArrowDown', glyph: '↓', dir: 'down' },
  { key: 'ArrowLeft', glyph: '←', dir: 'left' },
  { key: 'ArrowRight', glyph: '→', dir: 'right' },
];

/* Сложность. pace — стартовый темп, min — до куда он падает,
   speed — во сколько раз ускоряется после каждой стрелки,
   penalty — сколько очков снимаем за ошибку. */
const DIFFICULTIES = {
  easy: { label: 'Легко', pace: 1500, min: 780, speed: 0.87, penalty: 2 },
  normal: { label: 'Норма', pace: 1100, min: 500, speed: 0.9, penalty: 5 },
  hard: { label: 'Сложно', pace: 820, min: 340, speed: 0.93, penalty: 9 },
};

function randomArrow() {
  return ARROWS[Math.floor(Math.random() * ARROWS.length)];
}

export default function G4() {
  /* Экран: start — меню, play — раунд, over — результаты */
  const [phase, setPhase] = useState('start');
  const [difficulty, setDifficulty] = useState('normal');

  /* Кнопка «Играть снова» увеличивает runId, и весь useEffect ниже
     перезапускается с чистым состоянием. */
  const [runId, setRunId] = useState(0);

  const [hud, setHud] = useState({ score: 0, combo: 0, maxCombo: 0, lives: START_LIVES, hits: 0, misses: 0 });
  const [msLeft, setMsLeft] = useState(ROUND_MS);
  const [current, setCurrent] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [paused, setPaused] = useState(false);

  /* Вся игра живёт в ref: её читают и обработчики клавиш, и цикл,
     и при этом React не перерисовывает дерево 60 раз в секунду. */
  const gameRef = useRef(null);
  const pausedRef = useRef(false);
  const pressedRef = useRef(new Set());
  const timersRef = useRef([]);

  const setPausedBoth = useCallback((value) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

  /* Короткая вспышка «ТОЧНО» / «НЕ ТА» над полем */
  const flash = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setFeedback({ type, text, id });
    const timer = window.setTimeout(() => {
      setFeedback((f) => (f && f.id === id ? null : f));
    }, 420);
    timersRef.current.push(timer);
  }, []);

  /* Старт раунда — общий для кнопок и клавиатуры */
  const start = useCallback(() => {
    setRunId((id) => id + 1);
    setPhase('play');
  }, []);

  useEffect(() => {
    if (phase !== 'play') return undefined;

    const cfg = DIFFICULTIES[difficulty];
    const game = {
      cfg,
      score: 0,
      combo: 0,
      maxCombo: 0,
      lives: START_LIVES,
      hits: 0,
      misses: 0,
      over: false,
      started: false,
      startAt: 0,
      endAt: 0,
      pausedAt: 0,
      lastHud: -999,
      pace: cfg.pace,
      current: null,
      nextAt: 0,
    };
    gameRef.current = game;

    setHud({ score: 0, combo: 0, maxCombo: 0, lives: START_LIVES, hits: 0, misses: 0 });
    setMsLeft(ROUND_MS);
    setCurrent(null);
    setFeedback(null);
    setPausedBoth(false);
    pressedRef.current.clear();

    function syncHud() {
      setHud({
        score: game.score,
        combo: game.combo,
        maxCombo: game.maxCombo,
        lives: game.lives,
        hits: game.hits,
        misses: game.misses,
      });
    }

    /* Темп растёт: следующая стрелка живёт меньше и приходит быстрее */
    function speedUp() {
      game.pace = Math.max(game.cfg.min, Math.round(game.pace * game.cfg.speed));
    }

    function spawn(now) {
      const lifeMs = Math.round(game.pace * 1.7);
      const arrow = randomArrow();
      game.current = {
        dir: arrow.dir,
        glyph: arrow.glyph,
        lifeMs,
        expiresAt: now + lifeMs,
        id: now,
      };
      setCurrent({ dir: arrow.dir, glyph: arrow.glyph, lifeMs, id: now });
    }

    function scheduleNext(now) {
      game.nextAt = now + Math.round(game.pace * 0.45);
    }

    function hit(now) {
      const left = Math.max(0, game.current.expiresAt - now);
      const ratio = left / game.current.lifeMs;
      game.combo += 1;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.hits += 1;
      game.score += 100 + Math.round(ratio * 100) + game.combo * 10;
      game.current = null;
      setCurrent(null);
      speedUp();
      scheduleNext(now);
      flash('hit', ratio > 0.66 ? 'ИДЕАЛЬНО' : 'ТОЧНО');
      syncHud();
    }

    function miss(now, reason) {
      game.combo = 0;
      game.misses += 1;
      game.lives -= 1;
      game.score = Math.max(0, game.score - game.cfg.penalty);
      game.current = null;
      setCurrent(null);
      speedUp();
      scheduleNext(now);
      flash('miss', reason === 'wrong' ? 'НЕ ТА' : 'МИМО');
      syncHud();
      if (game.lives <= 0) finish();
    }

    function finish() {
      game.over = true;
      setPhase('over');
    }

    /* Пауза. Все дедлайны сдвигаем на время простоя, иначе после
       возвращения стрелка тут же считалась бы просроченной. */
    function togglePause() {
      if (game.over) return;
      const now = performance.now();
      if (pausedRef.current) {
        const shift = now - game.pausedAt;
        game.endAt += shift;
        if (game.current) game.current.expiresAt += shift;
        game.nextAt += shift;
        setPausedBoth(false);
      } else {
        game.pausedAt = now;
        setPausedBoth(true);
        pressedRef.current.clear();
      }
    }

    /* Один кадр: запускаем таймер, решаем судьбу стрелки, обновляем часы */
    function loop(now) {
      if (game.over) return;

      if (!pausedRef.current) {
        if (!game.started) {
          game.started = true;
          game.startAt = now;
          game.endAt = now + ROUND_MS;
          game.nextAt = now + FIRST_DELAY;
        }

        if (now >= game.endAt) {
          finish();
          return;
        }

        if (!game.current && now >= game.nextAt) {
          spawn(now);
        } else if (game.current && now >= game.current.expiresAt) {
          miss(now, 'timeout');
        }

        if (now - game.lastHud >= HUD_STEP) {
          game.lastHud = now;
          setMsLeft(Math.max(0, game.endAt - now));
        }
      }

      frameId = window.requestAnimationFrame(loop);
    }

    /* Нажали стрелку — правильная она или нет */
    function press(dir) {
      const g = gameRef.current;
      if (!g || g.over || pausedRef.current || !g.current) return;
      if (g.current.dir === dir) hit(performance.now());
      else miss(performance.now(), 'wrong');
    }

    function onKeyDown(event) {
      const key = event.key;
      const arrow = ARROWS.find((a) => a.key === key);

      /* Стрелки всегда гасим, иначе они прокручивают страницу.
         Escape не трогаем — им закрывает игру Hub. */
      if (arrow) {
        event.preventDefault();
        /* event.repeat и Set вместе не дают удержанию клавиши
           отработать несколько раз подряд. */
        if (event.repeat || pressedRef.current.has(key)) return;
        pressedRef.current.add(key);
        press(arrow.dir);
        return;
      }

      if (key === 'r' || key === 'R' || key === 'к' || key === 'К') {
        event.preventDefault();
        start();
        return;
      }

      if (key === 'p' || key === 'P' || key === 'з' || key === 'З') {
        event.preventDefault();
        togglePause();
        return;
      }

      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        if (pausedRef.current) togglePause();
        else start();
      }
    }

    function onKeyUp(event) {
      pressedRef.current.delete(event.key);
    }

    /* Ушли со вкладки — снимаем зажатия и встаём на паузу */
    function onBlur() {
      pressedRef.current.clear();
      if (!game.over && !pausedRef.current) togglePause();
    }

    let frameId = window.requestAnimationFrame(loop);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    /* --- УБОРКА --- */
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      pressedRef.current.clear();
      gameRef.current = null;
    };
  }, [phase, difficulty, runId, start, flash, setPausedBoth]);

  const accuracy = hud.hits + hud.misses
    ? Math.round((hud.hits / (hud.hits + hud.misses)) * 100)
    : 0;
  const seconds = Math.ceil(msLeft / 1000);

  return (
    <div className="g4">
      <div className="g4__stars" aria-hidden="true" />

      <div className="g4__panel">
        <header className="g4__hud">
          <div className="g4__stat">
            <span className="g4__label">Счёт</span>
            <strong className="g4__value">{hud.score}</strong>
          </div>
          <div className="g4__stat">
            <span className="g4__label">Комбо</span>
            <strong className={`g4__value g4__value--combo${hud.combo >= 3 ? ' is-hot' : ''}`}>
              {hud.combo}
            </strong>
          </div>
          <div className="g4__stat">
            <span className="g4__label">Время</span>
            <strong className={`g4__value${seconds <= 5 ? ' is-urgent' : ''}`}>{seconds}</strong>
          </div>
          <div className="g4__stat g4__stat--lives">
            <span className="g4__label">Жизни</span>
            <strong className="g4__value g4__hearts">{'\u25C6'.repeat(Math.max(0, hud.lives))}</strong>
          </div>
        </header>

        <div className="g4__timer" aria-hidden="true">
          <span className="g4__timer-fill" style={{ width: `${(msLeft / ROUND_MS) * 100}%` }} />
        </div>

        <div className="g4__board">
          <div className="g4__board-grid" aria-hidden="true" />

          <div className="g4__arena">
            {current ? (
              <div className="g4__target" key={current.id} data-dir={current.dir}>
                <span className="g4__glyph">{current.glyph}</span>
                <span
                  className="g4__life"
                  style={{ animationDuration: `${current.lifeMs}ms` }}
                  aria-hidden="true"
                />
              </div>
            ) : (
              <p className="g4__idle">Готовься…</p>
            )}

            {feedback && (
              <span className={`g4__flash g4__flash--${feedback.type}`} key={feedback.id}>
                {feedback.text}
              </span>
            )}

            {paused && phase === 'play' && (
              <div className="g4__pause">
                <strong>ПАУЗА</strong>
                <span>Пробел или P — продолжить</span>
              </div>
            )}
          </div>

          <div className="g4__keys" aria-hidden="true">
            {ARROWS.map((a) => (
              <span
                key={a.dir}
                className={`g4__key${current && current.dir === a.dir ? ' is-active' : ''}`}
                data-dir={a.dir}
              >
                {a.glyph}
              </span>
            ))}
          </div>
        </div>

        <footer className="g4__actions">
          <button type="button" className="g4__btn g4__btn--primary" onClick={start}>
            {phase === 'over' ? 'Играть снова' : 'Начать заново'}
          </button>
          <span className="g4__hint">
            Стрелки — нажать, пробел / P — пауза, R — сброс, Esc — выход
          </span>
        </footer>

        {phase === 'start' && (
          <div className="g4__overlay">
            <div className="g4__card">
              <p className="g4__kicker">G4 · мини-игра на реакцию</p>
              <h2 className="g4__title">Reaction Arrows</h2>
              <p className="g4__lead">
                На экране появляются стрелки ↑ ↓ ← →. Нажми такую же на клавиатуре,
                пока не истекла полоска под ней. 30 секунд, {START_LIVES} жизни,
                комбо за серию точных попаданий.
              </p>

              <div className="g4__diffs" role="group" aria-label="Сложность">
                {Object.entries(DIFFICULTIES).map(([key, d]) => (
                  <button
                    key={key}
                    type="button"
                    className={`g4__diff${difficulty === key ? ' is-active' : ''}`}
                    aria-pressed={difficulty === key}
                    onClick={() => setDifficulty(key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <button type="button" className="g4__btn g4__btn--primary" onClick={start}>
                Играть
              </button>
              <p className="g4__hint">
                Стрелки — действие, пробел / P — пауза, R — сброс, Esc — выход
              </p>
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="g4__overlay">
            <div className="g4__card">
              <p className="g4__kicker">{hud.lives > 0 ? 'Время вышло' : 'Жизни закончились'}</p>
              <h2 className="g4__title">{hud.score} очков</h2>

              <dl className="g4__results">
                <div className="g4__result">
                  <dt>Точных попаданий</dt>
                  <dd>{hud.hits}</dd>
                </div>
                <div className="g4__result">
                  <dt>Промахов</dt>
                  <dd>{hud.misses}</dd>
                </div>
                <div className="g4__result">
                  <dt>Максимум комбо</dt>
                  <dd>{hud.maxCombo}</dd>
                </div>
                <div className="g4__result">
                  <dt>Точность</dt>
                  <dd>{accuracy}%</dd>
                </div>
              </dl>

              <button type="button" className="g4__btn g4__btn--primary" onClick={start}>
                Играть снова
              </button>
              <button type="button" className="g4__btn" onClick={() => setPhase('start')}>
                Сменить сложность
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
