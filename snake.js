(() => {
    // ---------- config ----------
    const COLS = 24;
    const ROWS = 24;
    const BASE_STEP = 170;
    const MIN_STEP = 90;
    const STEP_DECAY = 4;
    const MAX_HAZ = 9;
    const HAZ_EVERY = 4;

    // ---------- elements ----------
    const wrap = document.querySelector('.sticker-wrap');
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const toggleBtn = document.getElementById('modeToggle');
    const hintEl = document.getElementById('hint');
    const joyLabel = document.getElementById('joyLabel');

    // ---------- sprites ----------
    const greenImg = new Image();
    greenImg.src = 'svg/Mushroom.svg';
    let greenReady = false;
    greenImg.onload = () => greenReady = true;

    const redImg = new Image();
    redImg.src = 'svg/Cactus.svg';
    let redReady = false;
    redImg.onload = () => redReady = true;

    // ---------- state ----------
    let snake, dir, nextDir, food, hazards, score, stepMs, acc, last, alive, started;
    let active = false; // false = sticker mode, true = game mode

    function reset() {
        const midX = Math.floor(COLS / 2);
        const midY = Math.floor(ROWS / 2);
        snake = [
            { x: midX, y: midY },
            { x: midX - 1, y: midY },
            { x: midX - 2, y: midY },
        ];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        score = 0;
        stepMs = BASE_STEP;
        acc = 0;
        last = performance.now();
        alive = true;
        started = false;
        hazards = [];
        food = null;
        placeFood();
        for (let i = 0; i < 3; i++) placeHazard();
    }

    function emptyCells() {
        const occ = new Set();
        for (const s of snake) occ.add(s.x + ',' + s.y);
        if (food) occ.add(food.x + ',' + food.y);
        for (const h of hazards) occ.add(h.x + ',' + h.y);
        const list = [];
        for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++)
                if (!occ.has(x + ',' + y)) list.push({ x, y });
        return list;
    }

    function placeFood() {
        const free = emptyCells();
        if (!free.length) return;
        food = free[(Math.random() * free.length) | 0];
    }

    function placeHazard() {
        const free = emptyCells();
        if (!free.length) return;
        hazards.push(free[(Math.random() * free.length) | 0]);
    }

    // ---------- canvas sizing ----------
    function resize() {
        const r = wrap.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
        canvas.style.width = r.width + 'px';
        canvas.style.height = r.height + 'px';
    }
    window.addEventListener('resize', resize);
    window.addEventListener('load', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    setTimeout(resize, 100);

    // ---------- keyboard ----------
    const KEYMAP = {
        ArrowUp: [0, -1], ArrowDown: [0, 1],
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
        W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    window.addEventListener('keydown', e => {
        if (!active) return;
        if (KEYMAP[e.key]) {
            const [x, y] = KEYMAP[e.key];
            queueDir(x, y);
            e.preventDefault();
        } else if (e.key === ' ' || e.key === 'Enter') {
            if (!alive) reset();
            e.preventDefault();
        }
    });

    function queueDir(x, y) {
        if (dir.x === -x && dir.y === -y) return;
        if (dir.x === x && dir.y === y) return;
        nextDir = { x, y };
        if (!started && alive) started = true;
    }

    // ---------- joystick (reads from script.js) ----------
    let lastJoyDir = { x: 0, y: 0 };
    function pollJoystick() {
        if (!active) return; // Don't steer snake in sticker mode
        const j = window.__joy;
        if (!j) return;
        if (Math.hypot(j.x, j.y) < 0.2) return;

        if (!started && alive) started = true;

        let x = 0, y = 0;
        if (Math.abs(j.x) > Math.abs(j.y)) x = j.x > 0 ? 1 : -1;
        else y = j.y > 0 ? 1 : -1;

        if (x !== lastJoyDir.x || y !== lastJoyDir.y) {
            queueDir(x, y);
            lastJoyDir = { x, y };
        }
    }

    // ---------- step ----------
    function step() {
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
        for (const s of snake) if (s.x === head.x && s.y === head.y) return gameOver();
        for (const h of hazards) if (h.x === head.x && h.y === head.y) return gameOver();

        snake.unshift(head);

        if (food && head.x === food.x && head.y === food.y) {
            score++;
            stepMs = Math.max(MIN_STEP, stepMs - STEP_DECAY);
            placeFood();

            const currentHazCount = hazards.length;
            hazards = [];
            for (let i = 0; i < currentHazCount; i++) {
                placeHazard();
            }

            if (score % HAZ_EVERY === 0 && hazards.length < MAX_HAZ) placeHazard();
        } else {
            snake.pop();
        }
    }

    function gameOver() { alive = false; started = false; }

    // ---------- draw ----------
    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function draw() {
        if (!active) return; // Nothing to draw in sticker mode
        const W = canvas.width, H = canvas.height;
        const sx = W / COLS, sy = H / ROWS;
        ctx.clearRect(0, 0, W, H);

        const wallThickness = Math.max(3, Math.min(sx, sy) * 0.09);
        ctx.strokeStyle = '#143143';
        ctx.lineWidth = wallThickness;
        ctx.strokeRect(wallThickness / 2, wallThickness / 2, W - wallThickness, H - wallThickness);

        for (let i = snake.length - 1; i >= 0; i--) {
            const s = snake[i];
            ctx.fillStyle = alive ? '#3ecb5a' : '#a0a0a0';
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = Math.max(1.5, Math.min(sx, sy) * 0.1);
            const pad = 0;
            roundRect(s.x * sx + pad, s.y * sy + pad, sx - pad * 2, sy - pad * 2, Math.min(sx, sy) * 0.25);
            ctx.fill();
            ctx.stroke();
        }

        if (food) {
            const cx = (food.x + 0.5) * sx;
            const cy = (food.y + 0.5) * sy;
            const r = Math.min(sx, sy) * 0.65;
            if (greenReady) ctx.drawImage(greenImg, cx - r, cy - r, r * 2, r * 2);
            else { ctx.fillStyle = '#3ecb5a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        }

        for (const h of hazards) {
            const cx = (h.x + 0.5) * sx;
            const cy = (h.y + 0.5) * sy;
            const r = Math.min(sx, sy) * 0.65;
            if (redReady) ctx.drawImage(redImg, cx - r, cy - r, r * 2, r * 2);
            else { ctx.fillStyle = '#e23a3a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        }

        const fs = Math.max(14, W * 0.035);
        ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const text = String(score);
        const tw = ctx.measureText(text).width;
        const px = fs * 1.1, py = fs * 0.75, m = fs * 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(m, m, tw + px * 2, fs + py * 2, (fs + py * 2) / 2);
        ctx.fill();
        ctx.fillStyle = '#5a3a1e';
        ctx.fillText(text, m + px, m + py + fs / 2);

        if (!started || !alive) {
            ctx.fillStyle = 'rgba(255,247,230,0.72)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#5a3a1e';
            ctx.textAlign = 'center';
            const bigFs = Math.max(20, W * 0.055);
            ctx.font = `700 ${bigFs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
            ctx.fillText(alive ? 'Ready?' : 'Game Over', W / 2, H / 2 - bigFs * 0.8);
            ctx.font = `500 ${bigFs * 0.55}px system-ui, -apple-system, "Segoe UI", sans-serif`;
            ctx.fillText(
                alive ? 'Drag the joystick to start' : `Score ${score} · Tap or press any key`,
                W / 2, H / 2 + bigFs * 0.2
            );
        }
    }

    // ---------- restart ----------
    window.addEventListener('pointerdown', e => {
        if (!active) return;
        if (!alive) reset();
    }, { passive: true });

    // ---------- loop ----------
    function frame(now) {
        const dt = Math.min(now - last, 250);
        last = now;

        if (active) {
            pollJoystick();
            if (alive && started) {
                acc += dt;
                while (acc >= stepMs) {
                    acc -= stepMs;
                    step();
                    if (!alive) break;
                }
            }
            draw();
        } else {
            // Sticker mode: keep canvas transparent
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        requestAnimationFrame(frame);
    }

    // ---------- toggle mode ----------
    function setMode(isGame) {
        active = isGame;
        if (active) {
            reset();
            toggleBtn.textContent = 'Sticker Mode';
            toggleBtn.classList.add('game-on');
            hintEl.textContent = 'Arrow keys / WASD or joystick to steer the snake';
            if (joyLabel) joyLabel.textContent = 'Drag to steer the snake';
        } else {
            toggleBtn.textContent = 'Play Game';
            toggleBtn.classList.remove('game-on');
            hintEl.textContent = 'Move your mouse · Drag joystick to look around';
            if (joyLabel) joyLabel.textContent = 'Drag to move eyes';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    toggleBtn.addEventListener('click', () => {
        setMode(!active);
    });

    // ---------- boot ----------
    resize();
    reset();
    setMode(false); // start in sticker mode
    requestAnimationFrame(frame);
})();(() => {
    // ---------- config ----------
    const COLS = 24;
    const ROWS = 24;
    const BASE_STEP = 170;
    const MIN_STEP = 90;
    const STEP_DECAY = 4;
    const MAX_HAZ = 9;
    const HAZ_EVERY = 4;

    // ---------- elements ----------
    const wrap = document.querySelector('.sticker-wrap');
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const toggleBtn = document.getElementById('modeToggle');
    const hintEl = document.getElementById('hint');
    const joyLabel = document.getElementById('joyLabel');

    // ---------- sprites ----------
    const greenImg = new Image();
    greenImg.src = 'svg/Mushroom.svg';
    let greenReady = false;
    greenImg.onload = () => greenReady = true;

    const redImg = new Image();
    redImg.src = 'svg/Cactus.svg';
    let redReady = false;
    redImg.onload = () => redReady = true;

    // ---------- state ----------
    let snake, dir, nextDir, food, hazards, score, stepMs, acc, last, alive, started;
    let active = false; // false = sticker mode, true = game mode

    function reset() {
        const midX = Math.floor(COLS / 2);
        const midY = Math.floor(ROWS / 2);
        snake = [
            { x: midX, y: midY },
            { x: midX - 1, y: midY },
            { x: midX - 2, y: midY },
        ];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        score = 0;
        stepMs = BASE_STEP;
        acc = 0;
        last = performance.now();
        alive = true;
        started = false;
        hazards = [];
        food = null;
        placeFood();
        for (let i = 0; i < 3; i++) placeHazard();
    }

    function emptyCells() {
        const occ = new Set();
        for (const s of snake) occ.add(s.x + ',' + s.y);
        if (food) occ.add(food.x + ',' + food.y);
        for (const h of hazards) occ.add(h.x + ',' + h.y);
        const list = [];
        for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++)
                if (!occ.has(x + ',' + y)) list.push({ x, y });
        return list;
    }

    function placeFood() {
        const free = emptyCells();
        if (!free.length) return;
        food = free[(Math.random() * free.length) | 0];
    }

    function placeHazard() {
        const free = emptyCells();
        if (!free.length) return;
        hazards.push(free[(Math.random() * free.length) | 0]);
    }

    // ---------- canvas sizing ----------
    function resize() {
        const r = wrap.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
        canvas.style.width = r.width + 'px';
        canvas.style.height = r.height + 'px';
    }
    window.addEventListener('resize', resize);
    window.addEventListener('load', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    setTimeout(resize, 100);

    // ---------- keyboard ----------
    const KEYMAP = {
        ArrowUp: [0, -1], ArrowDown: [0, 1],
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
        W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    window.addEventListener('keydown', e => {
        if (!active) return;
        if (KEYMAP[e.key]) {
            const [x, y] = KEYMAP[e.key];
            queueDir(x, y);
            e.preventDefault();
        } else if (e.key === ' ' || e.key === 'Enter') {
            if (!alive) reset();
            e.preventDefault();
        }
    });

    function queueDir(x, y) {
        if (dir.x === -x && dir.y === -y) return;
        if (dir.x === x && dir.y === y) return;
        nextDir = { x, y };
        if (!started && alive) started = true;
    }

    // ---------- joystick (reads from script.js) ----------
    let lastJoyDir = { x: 0, y: 0 };
    function pollJoystick() {
        if (!active) return; // Don't steer snake in sticker mode
        const j = window.__joy;
        if (!j) return;
        if (Math.hypot(j.x, j.y) < 0.2) return;

        if (!started && alive) started = true;

        let x = 0, y = 0;
        if (Math.abs(j.x) > Math.abs(j.y)) x = j.x > 0 ? 1 : -1;
        else y = j.y > 0 ? 1 : -1;

        if (x !== lastJoyDir.x || y !== lastJoyDir.y) {
            queueDir(x, y);
            lastJoyDir = { x, y };
        }
    }

    // ---------- step ----------
    function step() {
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
        for (const s of snake) if (s.x === head.x && s.y === head.y) return gameOver();
        for (const h of hazards) if (h.x === head.x && h.y === head.y) return gameOver();

        snake.unshift(head);

        if (food && head.x === food.x && head.y === food.y) {
            score++;
            stepMs = Math.max(MIN_STEP, stepMs - STEP_DECAY);
            placeFood();

            const currentHazCount = hazards.length;
            hazards = [];
            for (let i = 0; i < currentHazCount; i++) {
                placeHazard();
            }

            if (score % HAZ_EVERY === 0 && hazards.length < MAX_HAZ) placeHazard();
        } else {
            snake.pop();
        }
    }

    function gameOver() { alive = false; started = false; }

    // ---------- draw ----------
    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function draw() {
        if (!active) return; // Nothing to draw in sticker mode
        const W = canvas.width, H = canvas.height;
        const sx = W / COLS, sy = H / ROWS;
        ctx.clearRect(0, 0, W, H);

        const wallThickness = Math.max(3, Math.min(sx, sy) * 0.09);
        ctx.strokeStyle = '#143143';
        ctx.lineWidth = wallThickness;
        ctx.strokeRect(wallThickness / 2, wallThickness / 2, W - wallThickness, H - wallThickness);

        for (let i = snake.length - 1; i >= 0; i--) {
            const s = snake[i];
            ctx.fillStyle = alive ? '#3ecb5a' : '#a0a0a0';
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = Math.max(1.5, Math.min(sx, sy) * 0.1);
            const pad = 0;
            roundRect(s.x * sx + pad, s.y * sy + pad, sx - pad * 2, sy - pad * 2, Math.min(sx, sy) * 0.25);
            ctx.fill();
            ctx.stroke();
        }

        if (food) {
            const cx = (food.x + 0.5) * sx;
            const cy = (food.y + 0.5) * sy;
            const r = Math.min(sx, sy) * 0.65;
            if (greenReady) ctx.drawImage(greenImg, cx - r, cy - r, r * 2, r * 2);
            else { ctx.fillStyle = '#3ecb5a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        }

        for (const h of hazards) {
            const cx = (h.x + 0.5) * sx;
            const cy = (h.y + 0.5) * sy;
            const r = Math.min(sx, sy) * 0.65;
            if (redReady) ctx.drawImage(redImg, cx - r, cy - r, r * 2, r * 2);
            else { ctx.fillStyle = '#e23a3a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        }

        const fs = Math.max(14, W * 0.035);
        ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const text = String(score);
        const tw = ctx.measureText(text).width;
        const px = fs * 1.1, py = fs * 0.75, m = fs * 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(m, m, tw + px * 2, fs + py * 2, (fs + py * 2) / 2);
        ctx.fill();
        ctx.fillStyle = '#5a3a1e';
        ctx.fillText(text, m + px, m + py + fs / 2);

        if (!started || !alive) {
            ctx.fillStyle = 'rgba(255,247,230,0.72)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#5a3a1e';
            ctx.textAlign = 'center';
            const bigFs = Math.max(20, W * 0.055);
            ctx.font = `700 ${bigFs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
            ctx.fillText(alive ? 'Ready?' : 'Game Over', W / 2, H / 2 - bigFs * 0.8);
            ctx.font = `500 ${bigFs * 0.55}px system-ui, -apple-system, "Segoe UI", sans-serif`;
            ctx.fillText(
                alive ? 'Drag the joystick to start' : `Score ${score} · Tap or press any key`,
                W / 2, H / 2 + bigFs * 0.2
            );
        }
    }

    // ---------- restart ----------
    window.addEventListener('pointerdown', e => {
        if (!active) return;
        if (!alive) reset();
    }, { passive: true });

    // ---------- loop ----------
    function frame(now) {
        const dt = Math.min(now - last, 250);
        last = now;

        if (active) {
            pollJoystick();
            if (alive && started) {
                acc += dt;
                while (acc >= stepMs) {
                    acc -= stepMs;
                    step();
                    if (!alive) break;
                }
            }
            draw();
        } else {
            // Sticker mode: keep canvas transparent
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        requestAnimationFrame(frame);
    }

    // ---------- toggle mode ----------
    function setMode(isGame) {
        active = isGame;
        if (active) {
            reset();
            toggleBtn.textContent = 'Sticker Mode';
            toggleBtn.classList.add('game-on');
            hintEl.textContent = 'Arrow keys / WASD or joystick to steer the snake';
            if (joyLabel) joyLabel.textContent = 'Drag to steer the snake';
        } else {
            toggleBtn.textContent = 'Play Game';
            toggleBtn.classList.remove('game-on');
            hintEl.textContent = 'Move your mouse · Drag joystick to look around';
            if (joyLabel) joyLabel.textContent = 'Drag to move eyes';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    toggleBtn.addEventListener('click', () => {
        setMode(!active);
    });

    // ---------- boot ----------
    resize();
    reset();
    setMode(false); // start in sticker mode
    requestAnimationFrame(frame);
})();
