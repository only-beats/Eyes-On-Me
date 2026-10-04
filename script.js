(() => {
  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

  // eyes: horizontal range (data-mx) is bigger than vertical (data-my), like a human
  const eyes = [...document.querySelectorAll('.eye')].map(g => ({
    pupil: g.querySelector('.pupil'),
    white: g.querySelector('.white'),
    cx: +g.dataset.cx, cy: +g.dataset.cy,
    mx: +g.dataset.mx, my: +g.dataset.my,
    fixed: g.dataset.look ? g.dataset.look.split(',').map(Number) : null,
    x: 0, y: 0
  }));

  let mode = 'mouse';
  const mouse = { x: null, y: null };
  const joy = { x: 0, y: 0 };
  window.__joy = joy;

  /* ---------- mouse (laptop) ---------- */
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mode = 'mouse';
    mouse.x = e.clientX; mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => { mouse.x = null; });

  /* ---------- joystick (mobile) ---------- */
  const base = document.getElementById('joyBase');
  const knob = document.getElementById('joyKnob');
  let dragging = false;

  function moveKnob(e) {
    const r = base.getBoundingClientRect();
    const max = (r.width - knob.offsetWidth) / 2;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = dx / max; joy.y = dy / max;
    mode = 'joy';
  }
  base.addEventListener('pointerdown', e => {
    dragging = true; base.setPointerCapture(e.pointerId);
    knob.classList.add('drag'); moveKnob(e);
  });
  base.addEventListener('pointermove', e => { if (dragging) moveKnob(e); });
  const release = () => {
    if (!dragging) return;
    dragging = false; knob.classList.remove('drag');
    knob.style.transform = 'translate(0,0)'; joy.x = 0; joy.y = 0;
  };
  base.addEventListener('pointerup', release);
  base.addEventListener('pointercancel', release);

  /* ---------- animation loop ---------- */
  function frame() {
    for (const eye of eyes) {
      let tx = 0, ty = 0;
      if (eye.fixed) {
        tx = eye.fixed[0]; ty = eye.fixed[1];
      } else if (mode === 'joy') {
        tx = joy.x; ty = joy.y;
      } else if (mouse.x !== null) {
        const r = eye.white.getBoundingClientRect();
        const dx = mouse.x - (r.left + r.width / 2);
        const dy = mouse.y - (r.top + r.height / 2);
        tx = clamp(dx / (innerWidth * 0.3));
        ty = clamp(dy / (innerHeight * 0.3));
      }
      // keep the pupil a perfect circle inside the eye: limit the move to an oval
      const len = Math.hypot(tx, ty);
      if (len > 1) { tx /= len; ty /= len; }
      eye.x += (tx - eye.x) * 0.16;   // smooth, natural easing
      eye.y += (ty - eye.y) * 0.16;
      const px = eye.cx + eye.x * eye.mx;
      const py = eye.cy + eye.y * eye.my;
      eye.pupil.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
    }
    requestAnimationFrame(frame);
  }
  frame();
})();
