(() => {
  const canvas = document.querySelector(".bg-waves");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    t: 0,
    width: 0,
    height: 0,
    dpr: Math.max(1, window.devicePixelRatio || 1),
  };

  const resize = () => {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * state.dpr;
    canvas.height = state.height * state.dpr;
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  };

  const draw = () => {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);

    const baseLines = 5;
    const lines = baseLines + 1;
    const amp = 12;
    const spacing = height / (lines + 2);
    const baseSpeed = 0.12;
    const baseX = state.t;

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(35, 92, 176, 0.32)";

    for (let i = 0; i < lines; i += 1) {
      const isSum = i === lines - 1;
      const y0 = spacing * (i + 1.5);
      const speed = baseSpeed + i * 0.18;
      const baseFreq = 0.010 + i * 0.002;
      if (isSum) {
        ctx.strokeStyle = "rgba(35, 92, 176, 0.55)";
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = "rgba(35, 92, 176, 0.32)";
        ctx.lineWidth = 2;
      }
      ctx.beginPath();
      for (let x = 0; x <= width + 40; x += 18) {
        let offset = 0;
        if (isSum) {
          for (let j = 0; j < baseLines; j += 1) {
            const localSpeed = baseSpeed + j * 0.18;
            const localFreq = 0.010 + j * 0.002;
            const phase = (x + baseX * 60 * localSpeed) * localFreq + j * 0.6;
            const localAmp = amp + j * 3;
            offset += Math.sin(phase) * localAmp;
          }
        } else {
          const phase = (x + baseX * 60 * speed) * baseFreq + i * 0.6;
          const localAmp = amp + i * 3;
          offset = Math.sin(phase) * localAmp;
        }
        const y = y0 + offset;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  const tick = () => {
    draw();
    if (!prefersReduced) {
      state.t += 0.016;
      requestAnimationFrame(tick);
    }
  };

  resize();
  draw();
  if (!prefersReduced) requestAnimationFrame(tick);
  window.addEventListener("resize", resize);
})();
