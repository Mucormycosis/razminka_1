import { useEffect, useRef, useState } from 'react';
import './G1.css';

/*  НАСТРОЙКИ  */

const ROWS = 15;
const COLS = 10; 
const CELL = 32;
const LINE_POINTS = [0, 100, 300, 500, 800]; // очки за 1, 2, 3, 4 линии разом

/*  ФИГУРЫ  */

const FIGURES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS = {
  I: '#4fd6e0',
  O: '#f2c94c',
  T: '#6ee7a0',
  S: '#5aa9f8',
  J: '#8b7bf7',
  L: '#f28c5f',
  Z: '#f26d6d',
};

/* Случайное целое число от a до b включительно */
function random(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export default function G1() {
  /* Ссылки на канвасы. useRef нужен, чтобы React не перерисовывал их
     и мы могли рисовать изнутри useEffect. */
  const fieldRef = useRef(null);
  const nextRef = useRef(null);

  /* Что видит пользователь: счёт, линии, уровень, конец игры, пауза */
  const [hud, setHud] = useState({ score: 0, lines: 0, level: 1, over: false, paused: false });

  /* Кнопка "Заново" увеличивает runId, и весь код ниже запускается заново */
  const [runId, setRunId] = useState(0);

  /* Вся игра живёт здесь. Этот код запускается при открытии G1
     и полностью выбрасывается, когда игру закрывают. */
  useEffect(() => {
    const canvas = fieldRef.current;
    const nextCanvas = nextRef.current;
    const ctx = canvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');

    /* Поле. Строки -2 и -1 - это невидимый запас сверху,
       чтобы фигура появлялась над полем, а не внутри него. */
    const field = [];
    for (let row = -2; row < ROWS; row += 1) {
      field[row] = [];
      for (let col = 0; col < COLS; col += 1) {
        field[row][col] = 0;
      }
    }

    /* Переменные игры */
    const game = { score: 0, lines: 0, level: 1, over: false, paused: false };
    const queue = [];
    let figure = null;
    let preview = 'I';
    let dropTimer = 0;
    let lastTime = 0;
    let softDrop = false;
    let frameId = null;

    /* Обновляем цифры на экране. Вызываем только когда что-то реально
       поменялось, а не каждый кадр. */
    function updateHud() {
      setHud({ score: game.score, lines: game.lines, level: game.level, over: game.over, paused: game.paused });
    }

    /* --- ОЧЕРЕДЬ ФИГУР --- */

    /* Мешок: перемешиваем 7 фигур и выдаём по одной */
    function fillQueue() {
      const names = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
      while (names.length) {
        queue.push(names.splice(random(0, names.length - 1), 1)[0]);
      }
    }

    /* Какая фигура следующая, не забирая её */
    function peekName() {
      if (!queue.length) fillQueue();
      return queue[queue.length - 1];
    }

    /* Забираем следующую фигуру и ставим её в центр поля */
    function takeFigure() {
      if (!queue.length) fillQueue();
      const name = queue.pop();
      const matrix = FIGURES[name];
      return {
        name,
        matrix,
        row: name === 'I' ? -1 : -2,
        col: COLS / 2 - Math.ceil(matrix[0].length / 2),
      };
    }

    /*  ПРАВИЛА  */

    /* Разворачивает фигуру на 90 градусов */
    function rotateMatrix(matrix) {
      const last = matrix.length - 1;
      return matrix.map((row, i) => row.map((cell, j) => matrix[last - j][i]));
    }

    /* Главная проверка: можно ли поставить фигуру в эти координаты?
       Нельзя, если она вылезет за поле или наткнётся на другой кубик. */
    function fits(matrix, row, col) {
      for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix[r].length; c += 1) {
          if (matrix[r][c] === 0) continue;
          if (col + c < 0 || col + c >= COLS) return false;
          if (row + r >= ROWS) return false;
          if (field[row + r][col + c] !== 0) return false;
        }
      }
      return true;
    }

    /* Ряд заполнен полностью? */
    function rowIsFull(row) {
      return field[row].every((cell) => cell !== 0);
    }

    /* Убираем заполненные ряды. Идём снизу вверх и сдвигаем всё выше вниз. */
    function clearLines() {
      let cleared = 0;

      for (let row = ROWS - 1; row >= 0; ) {
        if (rowIsFull(row)) {
          for (let r = row; r >= 0; r -= 1) {
            for (let c = 0; c < COLS; c += 1) {
              field[r][c] = field[r - 1][c];
            }
          }
          cleared += 1;
        } else {
          row -= 1;
        }
      }

      if (cleared > 0) {
        game.lines += cleared;
        game.level = Math.floor(game.lines / 10) + 1;
        game.score += LINE_POINTS[cleared] * game.level;
        updateHud();
      }
    }

    /* Фигура больше не падает - вписываем её в поле навсегда */
    function lockFigure() {
      for (let r = 0; r < figure.matrix.length; r += 1) {
        for (let c = 0; c < figure.matrix[r].length; c += 1) {
          if (figure.matrix[r][c] === 0) continue;

          /* Если фигура вылезла за верх поля - всё, проиграли */
          if (figure.row + r < 0) {
            game.over = true;
            updateHud();
            return;
          }

          field[figure.row + r][figure.col + c] = figure.name;
        }
      }

      clearLines();
      figure = takeFigure();
      preview = peekName();
    }

    /* Пробуем сдвинуть фигуру. Сдвинулись -true, упёрлись - false */
    function move(down, left) {
      if (game.over || game.paused) return false;
      const row = figure.row + down;
      const col = figure.col + left;
      if (!fits(figure.matrix, row, col)) return false;
      figure.row = row;
      figure.col = col;
      return true;
    }

    /* Пробуем повернуть. Если не влезает на месте - пробуем на клетку выше. */
    function turn() {
      if (game.over || game.paused || figure.name === 'O') return;
      const rotated = rotateMatrix(figure.matrix);
      if (fits(rotated, figure.row, figure.col)) {
        figure.matrix = rotated;
      } else if (fits(rotated, figure.row - 1, figure.col)) {
        figure.matrix = rotated;
        figure.row -= 1;
      }
    }

    /* Сброс: летит вниз, пока может, и сразу фиксируется. 2 очка за клетку. */
    function dropToBottom() {
      if (game.over || game.paused) return;
      let distance = 0;
      while (move(1, 0)) distance += 1;
      game.score += distance * 2;
      lockFigure();
      updateHud();
    }

    /* Пауза */
    function togglePause() {
      if (game.over) return;
      game.paused = !game.paused;
      softDrop = false;
      updateHud();
    }

    /* Пауза, если игрок переключился на другую вкладку */
    function pauseOnBlur() {
      softDrop = false;
      if (!game.over && !game.paused) {
        game.paused = true;
        updateHud();
      }
    }

    /* Чем больше уровень, тем быстрее падает фигура */
    function dropInterval() {
      return Math.max(80, 800 - (game.level - 1) * 70);
    }

    /* --- РИСОВАНИЕ --- */

    /* Один кубик: цветной квадрат с бликом и рамкой */
    function drawCell(target, name, x, y, size) {
      target.fillStyle = COLORS[name];
      target.fillRect(x + 1, y + 1, size - 2, size - 2);
      target.fillStyle = 'rgba(255, 255, 255, 0.35)';
      target.fillRect(x + 3, y + 3, size - 6, 5);
      target.strokeStyle = 'rgba(6, 12, 34, 0.75)';
      target.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    }

    /* Затемняем поле и пишем текст посередине: GAME OVER или ПАУЗА */
    function drawMessage(text, sub) {
      ctx.fillStyle = 'rgba(6, 10, 28, 0.78)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#dfe6ff';
      ctx.textAlign = 'center';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = 'rgba(223, 230, 255, 0.7)';
      ctx.font = '400 14px system-ui, sans-serif';
      ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 20);
    }

    /* Полностью перерисовываем оба канваса. Вызывается каждый кадр. */
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* 1. Всё, что уже упало */
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (field[row][col] !== 0) {
            drawCell(ctx, field[row][col], col * CELL, row * CELL, CELL);
          }
        }
      }

      /* 2. Падающая фигура */
      if (figure && !game.over) {
        for (let r = 0; r < figure.matrix.length; r += 1) {
          for (let c = 0; c < figure.matrix[r].length; c += 1) {
            if (figure.matrix[r][c] === 0) continue;
            const y = (figure.row + r) * CELL;
            if (y < 0) continue;
            drawCell(ctx, figure.name, (figure.col + c) * CELL, y, CELL);
          }
        }
      }

      /* 3. Превью следующей фигуры */
      const previewMatrix = FIGURES[preview];
      nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
      for (let r = 0; r < previewMatrix.length; r += 1) {
        for (let c = 0; c < previewMatrix[r].length; c += 1) {
          if (previewMatrix[r][c] === 0) continue;
          drawCell(nextCtx, preview, c * 18, r * 18, 18);
        }
      }

      /* 4. Заглушка поверх поля */
      if (game.over) drawMessage('GAME OVER', 'R или кнопка «Заново»');
      else if (game.paused) drawMessage('ПАУЗА', 'P — продолжить');
    }

    /* --- ГЛАВНЫЙ ЦИКЛ --- */

    /* Один кадр: проверяем время, двигаем фигуру, рисуем */
    function tick(delta) {
      if (game.over || game.paused) {
        draw();
        return;
      }

      dropTimer += delta;

      /* Зажата стрелка вниз - падаем быстро */
      if (softDrop) {
        if (dropTimer >= 40) {
          dropTimer = 0;
          if (!move(1, 0)) lockFigure();
        }
      } else if (dropTimer >= dropInterval()) {
        dropTimer = 0;
        if (!move(1, 0)) lockFigure();
      }

      draw();
    }

    /* requestAnimationFrame вызывает это снова на следующем кадре.
       delta - сколько миллисекунд прошло с прошлого раза. */
    function loop(now) {
      const delta = lastTime ? now - lastTime : 0;
      lastTime = now;
      tick(delta);
      frameId = window.requestAnimationFrame(loop);
    }

    /* --- КЛАВИАТУРА --- */

    function onKeyDown(event) {
      const key = event.key;

      /* R - начать заново, P - пауза */
      if (key === 'r' || key === 'R' || key === 'к' || key === 'К') {
        event.preventDefault();
        setRunId((id) => id + 1);
        return;
      }
      if (key === 'p' || key === 'P' || key === 'з' || key === 'З') {
        event.preventDefault();
        togglePause();
        return;
      }

      if (game.over) return;

      /* preventDefault нужен, иначе стрелки прокручивают страницу.
         Escape не трогаем - им закрывает игру Hub. */
      switch (key) {
        case 'ArrowLeft':
          event.preventDefault();
          move(0, -1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          move(0, 1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          softDrop = true;
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'ц':
        case 'Ц':
          event.preventDefault();
          turn();
          break;
        case ' ':
          event.preventDefault();
          dropToBottom();
          break;
        default:
      }
    }

    function onKeyUp(event) {
      if (event.key === 'ArrowDown') softDrop = false;
    }

    /* --- СТАРТ --- */

    figure = takeFigure();
    preview = peekName();

    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pauseOnBlur);

    updateHud();
    draw();
    frameId = window.requestAnimationFrame(loop);

    /* --- УБОРКА --- */
    /* Обязательно отменяем кадр и снимаем слушатели, иначе при каждом
       открытии игры их будет всё больше, а циклов - несколько. */
    return () => {
      window.cancelAnimationFrame(frameId);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pauseOnBlur);
    };
  }, [runId]);

  return (
    <div className="g1">
      <div className="g1__panel">
        <header className="g1__hud">
          <div className="g1__stat">
            <span className="g1__label">Счёт</span>
            <strong className="g1__value">{hud.score}</strong>
          </div>
          <div className="g1__stat">
            <span className="g1__label">Линии</span>
            <strong className="g1__value">{hud.lines}</strong>
          </div>
          <div className="g1__stat">
            <span className="g1__label">Уровень</span>
            <strong className="g1__value">{hud.level}</strong>
          </div>
          <div className="g1__next">
            <span className="g1__label">Дальше</span>
            <canvas ref={nextRef} className="g1__preview" width={96} height={72} />
          </div>
        </header>

        <div className="g1__board">
          <canvas
            ref={fieldRef}
            className="g1__canvas"
            width={COLS * CELL}
            height={ROWS * CELL}
            tabIndex={0}
            role="img"
            aria-label="Игровое поле тетриса"
          />
        </div>

        <footer className="g1__actions">
          <button type="button" className="g1__btn" onClick={() => setRunId((id) => id + 1)}>
            Заново
          </button>
          <span className="g1__hint">
            Стрелки — движение, пробел — сброс, P — пауза, R — заново, Esc — выход
          </span>
        </footer>

        {hud.over && <p className="g1__over">Игра окончена</p>}
      </div>
    </div>
  );
}