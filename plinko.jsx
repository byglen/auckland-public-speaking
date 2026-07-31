// plinko.jsx — the peg drop.
// Every name is a labelled slot along the floor, visible the whole time. Hold
// Space and the gold puck sways across the top; release to drop it through the
// pegs — every bounce a plot twist — until it lands in the winner's slot and
// the slot floods champagne.
//
// The path is scripted to the predetermined winner but generated as a genuine
// random walk, so it reads as physics.
//
// Contract: { names, winnerIdx, spinKey, onComplete }.
const { useState, useEffect, useRef } = React;

function plinkoRng(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const PLINKO_ROWS = 9;

/** Random walk from s0 to winner in `rows` steps of mostly ±1 (rare 0/±2). */
function buildPlinkoPath(rng, N, rows, s0, winner) {
  for (let attempt = 0; attempt < 3000; attempt++) {
    const moves = [];
    let pos = s0;
    for (let r = 0; r < rows; r++) {
      const roll = rng();
      let m = roll < 0.08 ? 0 : roll < 0.54 ? -1 : 1;
      if (pos + m < 0 || pos + m > N - 1) m = -m;
      moves.push(m);
      pos += m;
    }
    if (pos === winner) return moves;
  }
  // Deterministic fallback — stay in bounds, keep the target reachable
  const moves = [];
  let pos = s0;
  for (let r = 0; r < rows; r++) {
    const remaining = rows - r;
    const order = rng() < 0.5 ? [-1, 1, 0, -2, 2] : [1, -1, 0, 2, -2];
    let chosen = null;
    for (const m of order) {
      const np = pos + m;
      if (np < 0 || np > N - 1) continue;
      const need = Math.abs(winner - np);
      if (remaining === 1 ? need === 0 : need <= 2 * (remaining - 1)) {
        chosen = m;
        break;
      }
    }
    if (chosen == null) chosen = Math.max(-2, Math.min(2, winner - pos));
    moves.push(chosen);
    pos += chosen;
  }
  return moves;
}

const PlinkoDraw = ({ names, winnerIdx, spinKey, onComplete }) => {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;
  const KeyboardHint = window.KeyboardHint;
  const RetroSpaceKey = window.RetroSpaceKey;

  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [hudPhase, setHudPhase] = useState('wait'); // wait | boost | resolve | landed
  const [bigName, setBigName] = useState('');

  const N = names.length;

  useEffect(() => {
    setHudPhase('wait');
    setBigName('');

    const cv = canvasRef.current;
    if (!cv || !N || winnerIdx == null || winnerIdx < 0 || winnerIdx >= N) return;

    const rng = plinkoRng((spinKey + 1) * 31337 + N * 23 + winnerIdx * 5);
    const rows = PLINKO_ROWS;

    let mode = 'wait'; // wait | boost | drop | landed
    let boostStart = 0;
    let dropStart = 0;
    let landedAt = 0;
    let cancelled = false;
    let rafId = 0;
    const timers = [];

    // Filled at release
    let path = null; // slot-unit x positions per row landing, plus jitters
    let hopTimes = null; // cumulative ms per hop
    let flashes = []; // {t, row, xUnit}

    // per-hop micro jitter so the fall never looks gridded
    const jitters = Array.from({ length: rows + 1 }, () => (rng() - 0.5) * 0.16);

    function planDrop(swayUnit) {
      let s0 = Math.round(swayUnit);
      s0 = Math.max(winnerIdx - (rows - 1), Math.min(winnerIdx + (rows - 1), s0));
      s0 = Math.max(0, Math.min(N - 1, s0));
      const moves = buildPlinkoPath(rng, N, rows, s0, winnerIdx);
      const xs = [s0];
      moves.forEach((m) => xs.push(xs[xs.length - 1] + m));
      path = xs;
      hopTimes = [];
      let t = 300; // initial fall to first row
      hopTimes.push(t);
      for (let r = 0; r < rows; r++) {
        t += Math.max(165, 240 - r * 9);
        hopTimes.push(t);
      }
      flashes = xs.slice(1).map((x, r) => ({
        t: hopTimes[r],
        row: r,
        xUnit: (xs[r] + x) / 2
      }));
      // slot entry + bounces
      hopTimes.push(t + 300); // reach floor
    }

    function geo(W, H) {
      const margin = Math.max(24, W * 0.04);
      const innerW = W - margin * 2;
      const slotW = innerW / N;
      const topY = H * 0.17;
      const floorY = H * 0.78;
      const slotDepth = Math.min(72, H * 0.1);
      const dy = (floorY - slotDepth - topY) / rows;
      const puckR = Math.max(11, Math.min(20, slotW * 0.3));
      const sx = (u) => margin + (u + 0.5) * slotW;
      return { W, H, margin, innerW, slotW, topY, floorY, slotDepth, dy, puckR, sx };
    }

    function puckStateAt(g, tMs) {
      // returns {x (px), y (px), rot}
      const startY = g.topY - g.dy * 0.7;
      if (tMs <= hopTimes[0]) {
        const t = tMs / hopTimes[0];
        const e = t * t;
        return { xU: path[0], y: startY + (g.topY - startY) * e, rot: 0 };
      }
      for (let r = 0; r < rows; r++) {
        const t0 = hopTimes[r];
        const t1 = hopTimes[r + 1];
        if (tMs <= t1) {
          const t = (tMs - t0) / (t1 - t0);
          const y0 = g.topY + r * g.dy;
          const y1 = g.topY + (r + 1) * g.dy;
          const x0 = path[r] + jitters[r];
          const x1 = path[r + 1] + jitters[r + 1];
          let y;
          if (t < 0.3) {
            const p = t / 0.3;
            y = y0 - 10 * Math.sin(p * Math.PI);
          } else {
            const p = (t - 0.3) / 0.7;
            y = y0 + (y1 - y0) * p * p;
          }
          const xe = t * t * (3 - 2 * t);
          return { xU: x0 + (x1 - x0) * xe, y, rot: (path[r + 1] - path[r]) * t * 2.6 };
        }
      }
      // floor + bounces
      const tFloor = hopTimes[rows];
      const tEnd = hopTimes[rows + 1];
      const yLast = g.topY + rows * g.dy;
      const yRest = g.floorY - g.puckR - 2;
      const xU = path[rows];
      if (tMs <= tEnd) {
        const t = (tMs - tFloor) / (tEnd - tFloor);
        return { xU, y: yLast + (yRest - yLast) * (t * t), rot: 0 };
      }
      const tb = tMs - tEnd;
      let dy2 = 0;
      if (tb < 300) dy2 = -Math.abs(Math.sin((tb / 300) * Math.PI)) * g.slotDepth * 0.32 * (1 - tb / 300);
      else if (tb < 520) {
        const p = (tb - 300) / 220;
        dy2 = -Math.abs(Math.sin(p * Math.PI)) * g.slotDepth * 0.1 * (1 - p);
      }
      return { xU, y: yRest + dy2, rot: 0, done: tb >= 560 };
    }

    function draw(now) {
      const dpr = window.devicePixelRatio || 1;
      const bbox = cv.getBoundingClientRect();
      const W = Math.floor(bbox.width);
      const H = Math.floor(bbox.height);
      if (W < 40 || H < 40) return;
      if (cv.width !== W * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
      }
      const g = geo(W, H);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const TAU = Math.PI * 2;
      const boosting = mode === 'boost';
      const landed = mode === 'landed';
      const flood = landed ? Math.min(1, (now - landedAt) / 420) : 0;

      // ── Board panel ──
      ctx.beginPath();
      ctx.roundRect(g.margin - 14, g.topY - g.dy * 1.1, g.innerW + 28, g.floorY - g.topY + g.dy * 1.1 + 2, 20);
      ctx.fillStyle = 'rgba(244,239,230,0.016)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,239,230,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── Pegs ──
      for (let r = 0; r < rows; r++) {
        const y = g.topY + r * g.dy + g.dy * 0.5;
        const offset = r % 2 === 0 ? 0.5 : 0;
        for (let i = offset === 0.5 ? 0 : 0; ; i++) {
          const u = i + offset;
          if (u > N - 1 + 0.001) break;
          if (offset === 0.5 && u > N - 1.5 + 0.001) break;
          const x = g.sx(u);
          const pg = ctx.createRadialGradient(x - 1.2, y - 1.4, 0.5, x, y, 4.6);
          pg.addColorStop(0, '#E8D5A4');
          pg.addColorStop(0.55, '#A98A50');
          pg.addColorStop(1, '#5C4A28');
          ctx.beginPath();
          ctx.arc(x, y, 4.2, 0, TAU);
          ctx.fillStyle = pg;
          ctx.fill();
        }
      }

      // peg flashes
      if (mode === 'drop' && flashes.length) {
        const t = now - dropStart;
        for (const f of flashes) {
          const age = (t - f.t) / 450;
          if (age < 0 || age > 1) continue;
          const y = g.topY + f.row * g.dy + g.dy * 0.5;
          const x = g.sx(f.xUnit);
          ctx.beginPath();
          ctx.arc(x, y, 5 + age * 24, 0, TAU);
          ctx.strokeStyle = `rgba(232,213,164,${0.5 * (1 - age)})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // ── Slots ──
      const slotTop = g.floorY - g.slotDepth;
      // winner flood
      if (flood > 0) {
        const x0 = g.sx(winnerIdx) - g.slotW / 2 + 2;
        const fg = ctx.createLinearGradient(0, slotTop, 0, g.floorY);
        fg.addColorStop(0, `rgba(232,213,164,${0.92 * flood})`);
        fg.addColorStop(1, `rgba(201,169,106,${0.88 * flood})`);
        ctx.beginPath();
        ctx.roundRect(x0, slotTop + 2, g.slotW - 4, g.slotDepth - 2, 6);
        ctx.fillStyle = fg;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(244,239,230,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= N; i++) {
        const x = g.margin + i * g.slotW;
        ctx.beginPath();
        ctx.moveTo(x, slotTop);
        ctx.lineTo(x, g.floorY);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(g.margin - 14, g.floorY);
      ctx.lineTo(g.margin + g.innerW + 14, g.floorY);
      ctx.strokeStyle = 'rgba(201,169,106,0.3)';
      ctx.stroke();

      // slot names
      const diagonal = N > 16;
      const maxChars = diagonal ? 12 : Math.max(5, Math.floor(g.slotW / (Math.min(15, g.slotW * 0.16) * 0.6)));
      for (let i = 0; i < N; i++) {
        let label = names[i];
        if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
        const isWinner = i === winnerIdx;
        const fs = diagonal
          ? Math.min(14, g.slotW * 0.28)
          : Math.max(10, Math.min(16, (g.slotW - 10) / (label.length * 0.54)));
        ctx.font = `500 ${fs}px ${F.ui}`;
        ctx.textAlign = diagonal ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = landed
          ? isWinner
            ? C.goldBright
            : 'rgba(244,239,230,0.35)'
          : 'rgba(244,239,230,0.82)';
        const x = g.sx(i);
        const y = g.floorY + (diagonal ? 14 : 18);
        if (diagonal) {
          ctx.save();
          ctx.translate(x + 4, y);
          ctx.rotate(-0.6);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(label, x, y);
        }
      }
      // winner label inside flooded slot
      if (flood > 0.35) {
        let label = names[winnerIdx];
        if (label.length > 12) label = label.slice(0, 11) + '…';
        ctx.font = `500 ${Math.min(15, g.slotW * 0.2)}px ${F.ui}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#221A0E';
        ctx.fillText(label, g.sx(winnerIdx), slotTop + g.slotDepth * 0.5);
      }

      // ── Puck ──
      let px = null;
      let py = null;
      let rot = 0;
      if (mode === 'wait') {
        px = g.sx((N - 1) / 2);
        py = g.topY - g.dy * 0.7;
      } else if (mode === 'boost') {
        const t = (now - boostStart) / 1000;
        const span = (N - 1) / 2;
        const u = (N - 1) / 2 + Math.sin(t * (TAU / 1.9)) * span;
        px = g.sx(u);
        py = g.topY - g.dy * 0.7;
        lastSway = u;
      } else {
        const st = puckStateAt(g, now - dropStart);
        px = g.sx(st.xU);
        py = st.y;
        rot = st.rot;
        if (st.done && mode === 'drop') {
          mode = 'landed';
          landedAt = now;
          setHudPhase('landed');
          setBigName(names[winnerIdx]);
          timers.push(setTimeout(() => {
            if (!cancelled) onCompleteRef.current && onCompleteRef.current();
          }, 1600));
        }
      }

      if (px != null && !(landed && flood > 0.9)) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        const pk = ctx.createRadialGradient(-g.puckR * 0.3, -g.puckR * 0.35, g.puckR * 0.15, 0, 0, g.puckR);
        pk.addColorStop(0, '#F0DDA8');
        pk.addColorStop(0.6, '#CBA45F');
        pk.addColorStop(1, '#8F7440');
        ctx.beginPath();
        ctx.arc(0, 0, g.puckR, 0, TAU);
        ctx.fillStyle = pk;
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,15,8,0.55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -g.puckR * 0.45, g.puckR * 0.14, 0, TAU);
        ctx.fillStyle = 'rgba(255,250,235,0.8)';
        ctx.fill();
        ctx.restore();
      }
    }

    let lastSway = (N - 1) / 2;

    function frame(now) {
      if (cancelled) return;
      draw(now);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    function beginDrop() {
      if (mode !== 'boost') return;
      planDrop(lastSway);
      mode = 'drop';
      dropStart = performance.now();
      setHudPhase('resolve');
    }

    function onKd(e) {
      if (e.code !== 'Space') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) { e.preventDefault(); return; }
      if (mode !== 'wait') return;
      e.preventDefault();
      mode = 'boost';
      boostStart = performance.now();
      setHudPhase('boost');
    }
    function onKu(e) {
      if (e.code !== 'Space') return;
      if (mode !== 'boost') return;
      e.preventDefault();
      beginDrop();
    }
    function onHidden() {
      if (document.hidden && mode === 'boost') beginDrop();
    }

    window.addEventListener('keydown', onKd);
    window.addEventListener('keyup', onKu);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKd);
      window.removeEventListener('keyup', onKu);
      document.removeEventListener('visibilitychange', onHidden);
      cancelAnimationFrame(rafId);
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, names.join('|')]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      {/* Ember stage glow while aiming */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 85% 70% at 50% 40%, rgba(224,133,68,0.13) 0%, rgba(201,169,106,0.05) 45%, transparent 74%)',
        opacity: hudPhase === 'boost' ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none'
      }} />

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Winner announcement */}
      {bigName &&
      <div style={{
        position: 'absolute',
        top: '7%',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <div
          title={bigName}
          style={{
            maxWidth: '86vw',
            fontFamily: F.stage,
            fontWeight: 400,
            fontSize: 'clamp(2rem, 3.6vw, 3.4rem)',
            lineHeight: 1.1,
            color: C.goldBright,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 4px 24px rgba(0,0,0,0.55)',
            animation: 'spinNameSwap 0.12s cubic-bezier(0.22, 1, 0.36, 1) both'
          }}>
          {bigName}
        </div>
      </div>
      }

      {/* Key hint */}
      {KeyboardHint && RetroSpaceKey &&
      <div style={{
        position: 'absolute',
        bottom: 'clamp(1rem, 2.5vh, 2rem)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: hudPhase === 'wait' || hudPhase === 'boost' ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none'
      }}>
        {hudPhase === 'boost' ?
        <KeyboardHint ariaLabel="Release space to drop" caption="release to drop" urgent>
          <RetroSpaceKey active />
        </KeyboardHint>
        :
        <KeyboardHint ariaLabel="Press and hold space to aim" caption="hold to aim">
          <RetroSpaceKey />
        </KeyboardHint>
        }
      </div>
      }
    </div>
  );
};

window.PlinkoDraw = PlinkoDraw;
