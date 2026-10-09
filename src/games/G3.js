import { useEffect, useRef, useState } from "react";
import "./G3.css";

const COLS = 24;
const ROWS = 20;
const CELL = 28;
const PLAYER_SPEED = 0.06;
const BULLET_SPEED = 0.18;
const ENEMY_BULLET_SPEED = 0.12;
const ENEMY_ROWS = 5;
const ENEMY_COLS = 10;
const ENEMY_H_GAP = 1.2;
const ENEMY_V_GAP = 1.2;

const ENEMY_TYPES = [
  { name: "squid", color: "#f26d6d", points: 30 },
  { name: "crab", color: "#f28c5f", points: 20 },
  { name: "octopus", color: "#5aa9f8", points: 10 },
];

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function G3() {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, level: 1, lives: 3, over: false, paused: false, win: false });
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;

    const game = { score: 0, level: 1, lives: 3, over: false, paused: false, win: false };
    let player = { x: COLS / 2, y: ROWS - 2, width: 2, cooldown: 0 };
    let bullets = [];
    let enemyBullets = [];
    let enemies = [];
    let enemyDir = 1;
    let enemyMoveTimer = 0;
    let enemyMoveInterval = 0;
    let enemyShootTimer = 0;
    let last = 0;
    let frameId = null;
    let nextDir = 0;
    let particles = [];

    function updateHud() {
      setHud({ score: game.score, level: game.level, lives: game.lives, over: game.over, paused: game.paused, win: game.win });
    }

    function initEnemies() {
      enemies = [];
      for (let row = 0; row < ENEMY_ROWS; row++) {
        const type = ENEMY_TYPES[Math.min(row, ENEMY_TYPES.length - 1)];
        for (let col = 0; col < ENEMY_COLS; col++) {
          enemies.push({
            x: 3 + col * ENEMY_H_GAP,
            y: 1.5 + row * ENEMY_V_GAP,
            type,
            alive: true,
          });
        }
      }
      enemyDir = 1;
      enemyMoveInterval = Math.max(300, 1000 - (game.level - 1) * 80);
      enemyMoveTimer = 0;
      enemyShootTimer = 0;
    }

    function drawCell(name, x, y, size, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x + 2, y + 2, size - 4, 4);
      ctx.strokeStyle = "rgba(6,12,34,0.7)";
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }

    function drawPlayer() {
      const px = player.x * CELL;
      const py = player.y * CELL;
      ctx.fillStyle = "#6ee7a0";
      ctx.beginPath();
      ctx.moveTo(px + CELL, py + CELL);
      ctx.lineTo(px + CELL / 2, py);
      ctx.lineTo(px, py + CELL);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(6,12,34,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function drawEnemy(enemy) {
      const ex = enemy.x * CELL;
      const ey = enemy.y * CELL;
      const s = CELL * 0.9;
      drawCell(enemy.type.name, ex, ey, s, enemy.type.color);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(ex + 4, ey + 4, 4, 4);
      ctx.fillRect(ex + s - 8, ey + 4, 4, 4);
    }

    function drawBullets() {
      ctx.fillStyle = "#f2c94c";
      bullets.forEach((b) => {
        ctx.fillRect(b.x * CELL + CELL / 2 - 2, b.y * CELL, 4, 12);
      });
      ctx.fillStyle = "#f26d6d";
      enemyBullets.forEach((b) => {
        ctx.fillRect(b.x * CELL + CELL / 2 - 2, b.y * CELL, 4, 12);
      });
    }

    function drawParticles() {
      particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      });
    }

    function drawMessage(text, sub) {
      ctx.fillStyle = "rgba(6, 10, 28, 0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#dfe6ff";
      ctx.textAlign = "center";
      ctx.font = "700 32px system-ui, sans-serif";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 16);
      ctx.fillStyle = "rgba(223, 230, 255, 0.7)";
      ctx.font = "400 16px system-ui, sans-serif";
      ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 20);
    }

    function draw() {
      ctx.fillStyle = "#050814";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawBullets();
      enemies.forEach((e) => e.alive && drawEnemy(e));
      if (!game.over && !game.win) drawPlayer();
      drawParticles();

      ctx.fillStyle = "#dfe6ff";
      ctx.font = "16px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("Счёт: " + game.score, 12, 22);
      ctx.fillText("Уровень: " + game.level, 12, 42);
      ctx.textAlign = "right";
      ctx.fillText("Жизни: " + "♥".repeat(game.lives), canvas.width - 12, 22);

      if (game.win) drawMessage("ПОБЕДА!", "R — следующий уровень");
      else if (game.over) drawMessage("GAME OVER", "R — заново");
      else if (game.paused) drawMessage("ПАУЗА", "Пробел — продолжить");
    }

    function createExplosion(x, y, color) {
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const speed = random(2, 5);
        particles.push({
          x: x * CELL + CELL / 2,
          y: y * CELL + CELL / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: random(3, 6),
          color,
          life: 30,
        });
      }
    }

    function tick(delta) {
      if (game.over || game.win || game.paused) {
        draw();
        particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life--; });
        particles = particles.filter((p) => p.life > 0);
        return;
      }

      player.x = Math.max(0.5, Math.min(COLS - 1.5, player.x + nextDir * PLAYER_SPEED * (delta / 16)));
      if (player.cooldown > 0) player.cooldown -= delta;

      bullets.forEach((b) => { b.y -= BULLET_SPEED * (delta / 16); });
      bullets = bullets.filter((b) => b.y >= -1);

      enemyBullets.forEach((b) => { b.y += ENEMY_BULLET_SPEED * (delta / 16); });
      enemyBullets = enemyBullets.filter((b) => b.y <= ROWS + 1);

      particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life--; });
      particles = particles.filter((p) => p.life > 0);

      enemyMoveTimer += delta;
      if (enemyMoveTimer >= enemyMoveInterval) {
        enemyMoveTimer = 0;
        let hitEdge = false;
        enemies.forEach((e) => {
          if (!e.alive) return;
          if ((enemyDir === 1 && e.x >= COLS - 2.5) || (enemyDir === -1 && e.x <= 1.5)) hitEdge = true;
        });
        if (hitEdge) {
          enemyDir *= -1;
          enemies.forEach((e) => { if (e.alive) e.y += 1; });
        } else {
          enemies.forEach((e) => { if (e.alive) e.x += enemyDir * 0.5; });
        }

        enemies.forEach((e) => {
          if (e.alive && e.y >= player.y - 1) {
            game.over = true;
            updateHud();
          }
        });
      }

      enemyShootTimer += delta;
      if (enemyShootTimer >= 1200) {
        enemyShootTimer = 0;
        const shooters = enemies.filter((e) => e.alive);
        if (shooters.length) {
          const shooter = shooters[random(0, shooters.length - 1)];
          enemyBullets.push({ x: shooter.x, y: shooter.y });
        }
      }

      bullets.forEach((b, bi) => {
        const bulletLeft = b.x * CELL + CELL / 2 - 2;
        const bulletRight = bulletLeft + 4;
        const bulletTop = b.y * CELL;
        const bulletBottom = bulletTop + 12;

        enemies.forEach((e, ei) => {
          if (!e.alive) return;
          const enemyLeft = e.x * CELL;
          const enemyRight = enemyLeft + CELL * 0.9;
          const enemyTop = e.y * CELL;
          const enemyBottom = enemyTop + CELL * 0.9;

          if (bulletRight > enemyLeft && bulletLeft < enemyRight &&
              bulletBottom > enemyTop && bulletTop < enemyBottom) {
            e.alive = false;
            game.score += e.type.points * game.level;
            createExplosion(e.x, e.y, e.type.color);
            bullets.splice(bi, 1);
            updateHud();
          }
        });
      });

      enemyBullets.forEach((b, bi) => {
        const bulletLeft = b.x * CELL + CELL / 2 - 2;
        const bulletRight = bulletLeft + 4;
        const bulletTop = b.y * CELL;
        const bulletBottom = bulletTop + 12;

        const playerLeft = player.x * CELL;
        const playerRight = playerLeft + CELL;
        const playerTop = player.y * CELL;
        const playerBottom = playerTop + CELL;

        if (bulletRight > playerLeft && bulletLeft < playerRight &&
            bulletBottom > playerTop && bulletTop < playerBottom) {
          enemyBullets.splice(bi, 1);
          game.lives--;
          createExplosion(player.x, player.y, "#6ee7a0");
          if (game.lives <= 0) {
            game.over = true;
          } else {
            player.x = COLS / 2;
          }
          updateHud();
        }
      });

      const aliveEnemies = enemies.filter((e) => e.alive);
      if (aliveEnemies.length === 0) {
        game.win = true;
        updateHud();
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
      const key = e.key;
      if (key === "r" || key === "R" || key === "к" || key === "К") {
        e.preventDefault();
        setRunId((id) => id + 1);
        return;
      }
      if (key === " " || key === "p" || key === "P" || key === "з" || key === "З") {
        e.preventDefault();
        if (game.win) {
          game.level++;
          game.win = false;
          player.x = COLS / 2;
          initEnemies();
          updateHud();
        } else if (!game.over) {
          game.paused = !game.paused;
          updateHud();
        }
        return;
      }
      if (game.over || game.win || game.paused) return;

      switch (key) {
        case "ArrowLeft":
          e.preventDefault();
          nextDir = -1;
          break;
        case "ArrowRight":
          e.preventDefault();
          nextDir = 1;
          break;
        case "ArrowUp":
        case "w":
        case "W":
        case "ц":
        case "Ц":
          e.preventDefault();
          if (player.cooldown <= 0) {
            bullets.push({ x: player.x, y: player.y - 0.5 });
            player.cooldown = 400;
          }
          break;
        default:
      }
    }

    function onKeyUp(e) {
      if (e.key === "ArrowLeft" && nextDir === -1) nextDir = 0;
      if (e.key === "ArrowRight" && nextDir === 1) nextDir = 0;
    }

    initEnemies();
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("click", () => canvas.focus());
    window.addEventListener("blur", () => {
      if (!game.over && !game.win && !game.paused) {
        game.paused = true;
        updateHud();
      }
    });

    updateHud();
    draw();
    canvas.focus();
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", () => {});
    };
  }, [runId]);

  return (
    <div className="g3">
      <div className="g3__panel">
        <div className="g3__hud">
          <div className="g3__stat">
            <span className="g3__label">Счёт</span>
            <strong className="g3__value">{hud.score}</strong>
          </div>
          <div className="g3__stat">
            <span className="g3__label">Уровень</span>
            <strong className="g3__value">{hud.level}</strong>
          </div>
          <div className="g3__stat g3__lives">
            <span className="g3__label">Жизни</span>
            <span className="g3__hearts">{"♥".repeat(hud.lives)}</span>
          </div>
        </div>
        <div className="g3__board">
          <canvas ref={canvasRef} tabIndex={0} role="img" aria-label="Space Invaders" />
        </div>
        <p className="g3__hint">
          ← → — движение, ↑ / Пробел — стрельба, Пробел / P — пауза, R — заново, Esc — выход
        </p>
      </div>
    </div>
  );
}