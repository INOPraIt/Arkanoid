(function () {
  class ArkanoidGame {
    constructor(canvas, options = {}) {
      this.canvas =
        typeof canvas === "string" ? document.querySelector(canvas) : canvas;
      if (!this.canvas) throw new Error("Arkanoid: canvas not found");
      this.ctx = this.canvas.getContext("2d");

      this.c = {
        ballRadius: 10,

        paddleWidth: 110,
        paddleHeight: 12,

        brickRowCount: 9,
        brickColumnCount: 5,
        brickWidth: 72,
        brickHeight: 22,
        brickPadding: 10,
        brickOffsetX: 46,
        brickOffsetY: 56,

        initialDx: 3.2,
        initialDy: -3.2,

        paddleEase: 0.18,

        ...options,
      };

      this.theme = {
        bgTop: "rgba(110,170,255,.18)",
        bgBottom: "rgba(6,8,18,.98)",

        ballGlow: "rgba(120,200,255,.85)",
        paddleGlow: "rgba(120,160,255,.55)",
        hudText: "rgba(225,240,255,.95)",
      };

      this.score = 0;
      this.lives = 3;

      this.ballX = this.canvas.width / 2;
      this.ballY = this.canvas.height - 80;
      this.dx = this.c.initialDx;
      this.dy = this.c.initialDy;

      this.paddleX = (this.canvas.width - this.c.paddleWidth) / 2;
      this.paddleTargetX = this.paddleX;

      this.bricks = this._createBricks();
      this.particles = [];

      this._raf = 0;
      this._running = false;

      this._onMouseMove = this._onMouseMove.bind(this);
      this._loop = this._loop.bind(this);
    }

    // Public
    start() {
      if (this._running) return;
      this._running = true;
      document.addEventListener("mousemove", this._onMouseMove);
      this._raf = requestAnimationFrame(this._loop);
    }

    stop() {
      this._running = false;
      document.removeEventListener("mousemove", this._onMouseMove);
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    reset() {
      this.score = 0;
      this.lives = 3;

      this.ballX = this.canvas.width / 2;
      this.ballY = this.canvas.height - 80;
      this.dx = this.c.initialDx;
      this.dy = this.c.initialDy;

      this.paddleX = (this.canvas.width - this.c.paddleWidth) / 2;
      this.paddleTargetX = this.paddleX;

      this.bricks = this._createBricks();
      this.particles = [];
    }

    destroy() {
      this.stop();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Core loop
    _loop() {
      if (!this._running) return;

      this._update();
      this._render();

      this._raf = requestAnimationFrame(this._loop);
    }

    _update() {
      this.paddleX += (this.paddleTargetX - this.paddleX) * this.c.paddleEase;
      this.paddleX = Math.max(
        0,
        Math.min(this.paddleX, this.canvas.width - this.c.paddleWidth),
      );

      let nextX = this.ballX + this.dx;
      let nextY = this.ballY + this.dy;

      if (nextX < this.c.ballRadius || nextX > this.canvas.width - this.c.ballRadius) {
        this.dx *= -1;
        nextX = this.ballX + this.dx;
      }
      if (nextY < this.c.ballRadius) {
        this.dy *= -1;
        nextY = this.ballY + this.dy;
      }

      const paddleTop = this.canvas.height - this.c.paddleHeight - 10;
      const paddleBottom = paddleTop + this.c.paddleHeight + 10;

      if (
        nextY + this.c.ballRadius >= paddleTop &&
        nextY + this.c.ballRadius <= paddleBottom &&
        nextX >= this.paddleX &&
        nextX <= this.paddleX + this.c.paddleWidth &&
        this.dy > 0
      ) {
        const hit = (nextX - (this.paddleX + this.c.paddleWidth / 2)) / (this.c.paddleWidth / 2);
        const maxAngle = 1.15;
        const angle = hit * maxAngle;

        const speed = Math.hypot(this.dx, this.dy);
        this.dx = speed * Math.sin(angle);
        this.dy = -Math.abs(speed * Math.cos(angle));

        this._spawnHitParticles(nextX, paddleTop);
      }

      if (nextY > this.canvas.height + 40) {
        this.lives--;
        if (this.lives <= 0) {
          alert("Вы проиграли");
          this.reset();
          return;
        }
        this.ballX = this.canvas.width / 2;
        this.ballY = this.canvas.height - 80;
        this.dx = this.c.initialDx;
        this.dy = this.c.initialDy;
        return;
      }

      this.ballX = nextX;
      this.ballY = nextY;
      this._brickCollisions();

      this._updateParticles();
    }

    // Input
    _onMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.paddleTargetX = x - this.c.paddleWidth / 2;
    }

    // Bricks
    _createBricks() {
      const bricks = [];
      for (let row = 0; row < this.c.brickColumnCount; row++) {
        bricks[row] = [];
        for (let col = 0; col < this.c.brickRowCount; col++) {
          bricks[row][col] = { x: 0, y: 0, alive: true };
        }
      }
      return bricks;
    }

    _brickCollisions() {
      const c = this.c;

      for (let row = 0; row < c.brickColumnCount; row++) {
        for (let col = 0; col < c.brickRowCount; col++) {
          const b = this.bricks[row][col];
          if (!b.alive) continue;

          const bx = col * (c.brickWidth + c.brickPadding) + c.brickOffsetX;
          const by = row * (c.brickHeight + c.brickPadding) + c.brickOffsetY;
          b.x = bx; b.y = by;

          const hit =
            this.ballX + c.ballRadius > bx &&
            this.ballX - c.ballRadius < bx + c.brickWidth &&
            this.ballY + c.ballRadius > by &&
            this.ballY - c.ballRadius < by + c.brickHeight;

          if (hit) {
            b.alive = false;
            this.score++;
            this.dy *= -1;

            this._spawnHitParticles(this.ballX, this.ballY);

            if (this.score === c.brickRowCount * c.brickColumnCount) {
              alert("Вы победили");
              this.reset();
            }
            return;
          }
        }
      }
    }

    _spawnHitParticles(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1.2 + Math.random() * 3.2;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 18 + Math.random() * 14,
          r: 1.2 + Math.random() * 2.2,
        });
      }
    }

    _updateParticles() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 1;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    }

    _render() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);
      this._drawBackground();

      this._drawBricks();
      this._drawPaddle();
      this._drawBall();
      this._drawParticles();
      this._drawHUD();
    }

    _drawBackground() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(18,28,70,.95)");
      bg.addColorStop(0.45, "rgba(10,14,34,.98)");
      bg.addColorStop(1, "rgba(6,8,18,.99)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.15, 40, w * 0.5, h * 0.15, w * 0.65);
      glow.addColorStop(0, this.theme.bgTop);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    _drawBricks() {
      const ctx = this.ctx;
      const c = this.c;

      for (let row = 0; row < c.brickColumnCount; row++) {
        for (let col = 0; col < c.brickRowCount; col++) {
          const b = this.bricks[row][col];
          if (!b.alive) continue;

          const x = b.x;
          const y = b.y;

          const hue = 200 + row * 22 + col * 6;
          const grad = ctx.createLinearGradient(x, y, x, y + c.brickHeight);
          grad.addColorStop(0, `hsla(${hue}, 95%, 70%, .95)`);
          grad.addColorStop(1, `hsla(${hue}, 95%, 45%, .95)`);

          ctx.save();
          ctx.shadowBlur = 14;
          ctx.shadowColor = `hsla(${hue}, 100%, 70%, .28)`;
          this._roundRect(x, y, c.brickWidth, c.brickHeight, 8, grad);

          const gloss = ctx.createLinearGradient(x, y, x, y + c.brickHeight);
          gloss.addColorStop(0, "rgba(255,255,255,.35)");
          gloss.addColorStop(0.35, "rgba(255,255,255,.10)");
          gloss.addColorStop(1, "rgba(255,255,255,0)");
          this._roundRect(x + 2, y + 2, c.brickWidth - 4, c.brickHeight * 0.45, 7, gloss);

          ctx.restore();
        }
      }
    }

    _drawBall() {
      const ctx = this.ctx;
      const r = this.c.ballRadius;

      ctx.save();
      ctx.shadowBlur = 22;
      ctx.shadowColor = this.theme.ballGlow;

      const g = ctx.createRadialGradient(
        this.ballX - r * 0.35,
        this.ballY - r * 0.35,
        r * 0.2,
        this.ballX,
        this.ballY,
        r,
      );
      g.addColorStop(0, "rgba(255,255,255,.98)");
      g.addColorStop(0.4, "rgba(160,220,255,.96)");
      g.addColorStop(1, "rgba(40,120,255,.92)");

      ctx.beginPath();
      ctx.arc(this.ballX, this.ballY, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    _drawPaddle() {
      const ctx = this.ctx;
      const c = this.c;

      const x = this.paddleX;
      const y = this.canvas.height - c.paddleHeight - 10;
      const w = c.paddleWidth;
      const h = c.paddleHeight;

      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, "rgba(210,235,255,.95)");
      grad.addColorStop(1, "rgba(70,140,255,.95)");

      ctx.save();
      ctx.shadowBlur = 24;
      ctx.shadowColor = this.theme.paddleGlow;
      this._roundRect(x, y, w, h, 12, grad);

      this._roundRect(x + 4, y + 2, w - 8, 4, 4, "rgba(255,255,255,.28)");
      ctx.restore();
    }

    _drawParticles() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const p of this.particles) {
        const a = Math.max(0, Math.min(1, p.life / 30));
        ctx.fillStyle = `rgba(140,210,255,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    _drawHUD() {
      const ctx = this.ctx;
      const w = this.canvas.width;

      ctx.save();
      ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = this.theme.hudText;

      this._roundRect(12, 10, 160, 28, 10, "rgba(21, 40, 10, 0.55)");
      this._roundRect(w - 172, 10, 160, 28, 10, "rgba(10,16,40,.55)");

      ctx.fillStyle = "#00b7ff";
      ctx.fillText(`Счет: ${this.score}`, 24, 30);
      ctx.fillText(`Жизни: ${this.lives}`, w - 154, 30);

      ctx.restore();
    }

    _roundRect(x, y, w, h, r, fillStyle) {
      const ctx = this.ctx;
      const rr = Math.min(r, w / 2, h / 2);

      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();

      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  window.ArkanoidGame = ArkanoidGame;
})();


const game = new ArkanoidGame("#arkanoid");
game.start();
