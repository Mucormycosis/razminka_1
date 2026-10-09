import { useEffect, useRef, useState } from "react";
import "./G2.css";

const COLS = 20;
const ROWS = 20;
const CELL = 24;
const START_SPEED = 220;

const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function G2() {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, over: false, paused: false });
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;

    const game = { score: 0, over: false, paused: false };
    let snake = [{ x: 10, y: 10 }];
    let dir = { x: 1, y: 0 };
    let food = { x: random(0, COLS - 1), y: random(0, ROWS - 1) };
    let timer = 0;
    let last = 0;
    let frameId = null;
    let nextDir = { x: 1, y: 0 };

    function updateHud() {
      setHud({ score: game.score, over: game.over, paused: game.paused });
    }

    function placeFood() {
      let pos;
      do {
        pos = { x: random(0, COLS - 1), y: random(0, ROWS - 1) };
      } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
      food = pos;
    }

    function draw() {
      ctx.fillStyle = "#0a1026";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#2a3a7a";
      ctx.fillRect(food.x * CELL, food.y * CELL, CELL, CELL);

      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? "#6ee7a0" : "#3a8a6a";
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });

      ctx.fillStyle = "#dfe6ff";
      ctx.font = "16px system-ui";
      ctx.fillText("Счёт: " + game.score, 8, 18);
    }

    function step() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        game.over = true;
        updateHud();
        return;
      }
      if (snake.some((s) => s.x === head.x && s.y === head.y)) {
        game.over = true;
        updateHud();
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        game.score += 10;
        placeFood();
      } else {
        snake.pop();
      }
      updateHud();
    }

    function tick(delta) {
      if (game.over || game.paused) {
        draw();
        return;
      }
      timer += delta;
      const interval = Math.max(60, START_SPEED - game.score * 3);
      if (timer >= interval) {
        timer = 0;
        step();
      }
      draw();
    }

    function loop(now) {
      const delta = last ? now - last : 0;
      last = now;
      tick(delta);
      frameId = requestAnimationFrame(loop);
    }

    function onKeyDown(e) {
      const d = DIRS[e.key];
      if (!d) return;
      if (e.key === "ArrowUp" && dir.y === 1) return;
      if (e.key === "ArrowDown" && dir.y === -1) return;
      if (e.key === "ArrowLeft" && dir.x === 1) return;
      if (e.key === "ArrowRight" && dir.x === -1) return;
      nextDir = d;
    }

    function onKeyUp(e) {
      if (e.key === " ") togglePause();
    }

    function togglePause() {
      if (game.over) return;
      game.paused = !game.paused;
      updateHud();
    }

    function pauseOnBlur() {
      if (!game.over && !game.paused) {
        game.paused = true;
        updateHud();
      }
    }

canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("click", () => canvas.focus());
    window.addEventListener("blur", pauseOnBlur);

    draw();
    updateHud();
    canvas.focus();
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", pauseOnBlur);
    };
  }, [runId]);

  return (
    <div className="g2">
      <div className="g2__panel">
        <div className="g2__hud">
          <span className="g2__label">Счёт</span>
          <strong className="g2__value">{hud.score}</strong>
          {hud.over && <span className="g2__over">Конец</span>}
          {hud.paused && !hud.over && <span className="g2__paused">Пауза</span>}
        </div>
        <div className="g2__board">
          <canvas ref={canvasRef} tabIndex={0} role="img" aria-label="Игра змейка" />
        </div>
        <p className="g2__hint">
          Стрелки — движение, пробел — пауза, R — заново, Esc — выход
        </p>
      </div>
    </div>
  );
}

