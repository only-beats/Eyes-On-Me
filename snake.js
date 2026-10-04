(() => {
    // ---------- config ----------
    const COLS = 24;
    const ROWS = 24;
    const BASE_STEP = 170;   // ms per move (lower = faster)
    const MIN_STEP = 90;
    const STEP_DECAY = 4;    // gets faster per food
    const MAX_HAZ = 9;
    const HAZ_EVERY = 4;     // add a red dot every N foods

    // ---------- elements ----------
    const wrap = document.querySelector('.sticker-wrap');
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // ---------- sprites ----------
    const greenImg = new Image();
    greenImg.src = 'svg/Mushroom.svg'; // Changed to Mushroom
    let greenReady = false;
    greenImg.onload = () => greenReady = true;

    const redImg = new Image();
    redImg.src = 'svg/Cactus.svg'; // Changed to Cactus
    let redReady = false;
    redImg.onload = () => redReady = true;

    // ---------- state ----------
    let snake, dir, nextDir, food, hazards, score, stepMs, acc, last, alive, started;

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
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
        canvas.style.width = r.width + 'px';
        canvas.style.height = r.height + 'px';
    }
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

    // ---------- keyboard ----------
    const KEYMAP = {
        ArrowUp: [0, -1], ArrowDown: [0, 1],
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
        W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    window.addEventListener('keydown', e => {
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
        if (dir.x === -x && dir.y === -y) return; // no reverse
        if (dir.x === x && dir.y === y) return; // no dup
        nextDir = { x, y };
        if (!started && alive) started = true;
    }

    // ---------- joystick (reads from script.js) ----------
    let lastJoyDir = { x: 0, y: 0 };
    function pollJoystick() {
        const j = window.__joy;
        if (!j) return;
        if (Math.hypot(j.x, j.y) < 0.3) return;    // dead zone

        // --- NEW FIX: Start the game on ANY joystick movement ---
        if (!started && alive) started = true;
        // -------------------------------------------------------

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

            // --- NEW: Relocate all existing knives randomly ---
            const currentHazCount = hazards.length;
            hazards = []; // Clear old positions
            for (let i = 0; i < currentHazCount; i++) {
                placeHazard();
            }
            // -------------------------------------------------

            // Keep adding new knives as the score increases
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
        const W = canvas.width, H = canvas.height;
        const sx = W / COLS, sy = H / ROWS;
        ctx.clearRect(0, 0, W, H);
        // --- DRAW OUTER LIMIT BORDER (WALL) ---
        const wallThickness = Math.min(sx, sy) * 0.09; // Scales with the grid size
        ctx.strokeStyle = '#143143';
        ctx.lineWidth = wallThickness;
        // Inset by half the thickness so the whole border stays on screen
        ctx.strokeRect(wallThickness / 2, wallThickness / 2, W - wallThickness, H - wallThickness);

        // snake
        // snake
        for (let i = snake.length - 1; i >= 0; i--) {
            const s = snake[i];

            // Snake fill color (Green when alive, Grey when dead)
            ctx.fillStyle = alive ? '#3ecb5a' : '#a0a0a0';

            // Snake outline color (Yellow)
            ctx.strokeStyle = '#FFD700'
            // Line width proportional to the grid size so it scales nicely
            ctx.lineWidth = Math.min(sx, sy) * 0.1;

            const pad = 0;
            roundRect(
                s.x * sx + pad, s.y * sy + pad,
                sx - pad * 2, sy - pad * 2,
                Math.min(sx, sy) * 0.25
            );

            ctx.fill();   // Fill the segment with green
            ctx.stroke(); // Draw the yellow border around it
        }

        // food (Mushroom - green dot)
        if (food) {
            const cx = (food.x + 0.5) * sx;
            const cy = (food.y + 0.5) * sy;
            // INCREASED SIZE: Changed 0.48 to 0.65
            const r = Math.min(sx, sy) * 0.65;
            if (greenReady) ctx.drawImage(greenImg, cx - r, cy - r, r * 2, r * 2);
            else { ctx.fillStyle = '#3ecb5a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        }

        // hazards (Cactus - red dot)
        for (const h of hazards) {
            const cx = (h.x + 0.5) * sx;
            const cy = (h.y + 0.5) * sy;
            // INCREASED SIZE: Changed 0.48 to 0.65
            const r = Math.min(sx, sy) * 0.65;
            if (redReady) ctx.drawImage(redImg, cx - r, cy - r, r * 2, r * 2);
            else { ctx.fillStyle = '#e23a3a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
        }

        // score pill
        const fs = Math.max(14, W * 0.035);
        ctx.font = `600 ${fs}px system-ui, -Mushroom-system, "Segoe UI", sans-serif`;
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

        // overlay
        if (!started || !alive) {
            ctx.fillStyle = 'rgba(255,247,230,0.72)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#5a3a1e';
            ctx.textAlign = 'center';
            const bigFs = Math.max(20, W * 0.055);
            ctx.font = `700 ${bigFs}px system-ui, -Mushroom-system, "Segoe UI", sans-serif`;
            ctx.fillText(alive ? 'Ready?' : 'Game Over', W / 2, H / 2 - bigFs * 0.8);
            ctx.font = `500 ${bigFs * 0.55}px system-ui, -Mushroom-system, "Segoe UI", sans-serif`;
            ctx.fillText(
                alive
                    ? 'Drag the joystick to start'
                    : `Score ${score} · Tap or press any key`,
                W / 2, H / 2 + bigFs * 0.2
            );
        }
    }

    // ---------- restart ----------
    window.addEventListener('pointerdown', e => {
        // Removed the check that blocked the joystick, so tapping anywhere restarts
        if (!alive) reset();
    }, { passive: true });

    // ---------- loop ----------
    function frame(now) {
        const dt = Math.min(now - last, 250);
        last = now;
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
        requestAnimationFrame(frame);
    }

    // ---------- boot ----------
    resize();
    reset();
    requestAnimationFrame(frame);
})();
