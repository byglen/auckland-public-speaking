// ─── SPIN WHEEL ───────────────────────────────────────────────────────────────
// Interactive draw: Hold Space → full speed spin. Release Space → eased slowdown
// to the predetermined winner, then bump + reveal.
//
// Props:
//   names       – array of strings (the participants in the draw)
//   winnerIdx   – index of the predetermined winner (caller picks at random)
//   onComplete  – fired once the wheel has fully settled on the winner
//   spinKey       – change this to (re)start the spin
//   onPointerNameChange – optional (name under the top triangle when it changes)
//   onSpaceBoostChange  – optional (true while Space held = full-speed boost)

/** Index under the top triangle (wheel-local angles wrapped to one turn). */
function wheelSliceIndexAtTopPointer(N, rotation) {
  if (!N || N < 1) return 0;
  const TAU = Math.PI * 2;
  const SLICE = TAU / N;
  const wrap = (a) => ((a % TAU) + TAU) % TAU;
  const thetaW = wrap(-Math.PI / 2 - rotation);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < N; i++) {
    const midW = wrap(i * SLICE - Math.PI / 2);
    let d = Math.abs(thetaW - midW);
    if (d > Math.PI) d = TAU - d;
    if (d < bestD - 1e-12) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

window.wheelSliceIndexAtTopPointer = wheelSliceIndexAtTopPointer;

const SpinWheel = ({ names, winnerIdx, onComplete, spinKey, onPointerNameChange, onSpaceBoostChange }) => {
  const { useRef, useEffect, useLayoutEffect } = React;
  const canvasRef = useRef(null);
  const liveRotRef = useRef(0);
  /** Canvas draw reads this for hotter rim pulse while Space-boost spinning */
  const isBoostDrawingRef = useRef(false);
  const onPointerRef = useRef(onPointerNameChange);
  onPointerRef.current = onPointerNameChange;
  const onBoostChangeRef = useRef(onSpaceBoostChange);
  onBoostChangeRef.current = onSpaceBoostChange;

  const N = names.length;
  const SLICE = (Math.PI * 2) / Math.max(N, 1);

  // ── render the wheel at a given rotation (radians) ────────────────────────
  const draw = (rotation, layoutRetryCount = 0) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const bbox = cv.getBoundingClientRect();
    let size = Math.floor(bbox.width) || cv.clientWidth || cv.offsetWidth || 0;
    const parentEl = cv.parentElement;
    if (!size && parentEl) size = Math.floor(parentEl.getBoundingClientRect().width || parentEl.clientWidth || 0);
    const vw = typeof window.innerWidth === 'number' ? window.innerWidth : 920;
    if (size < 32) {
      if (layoutRetryCount < 10 && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => draw(rotation, layoutRetryCount + 1));
        return;
      }
      size = Math.max(280, Math.min(920, Math.floor(vw * 0.78)));
    }
    if (cv.width !== size * dpr) {
      cv.width = size * dpr;
      cv.height = size * dpr;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const boosting = isBoostDrawingRef.current;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 14;
    const rimR = outerR + 10;
    const innerR = size * 0.13;

    // Concentric ring density (plan: soften / cap when N is large)
    let ringLayers;
    if (N <= 12) ringLayers = 14;
    else if (N <= 18) ringLayers = 12;
    else if (N <= 22) ringLayers = 10;
    else if (N <= 26) ringLayers = 9;
    else ringLayers = Math.max(6, 8 - Math.floor((N - 26) / 4));

    /** Theme C — rim hues for zebra “lit” wedges */
    const LIT_HUES = [220, 278, 199, 302, 32, 168];

    // Outer rim glow (warmer during boost read)
    const glow = ctx.createRadialGradient(cx, cy, outerR, cx, cy, rimR + 18);
    glow.addColorStop(0, boosting ? 'rgba(255,206,140,0.55)' : 'rgba(212,168,75,0.45)');
    glow.addColorStop(0.72, boosting ? 'rgba(90,185,255,0.09)' : 'rgba(212,168,75,0.08)');
    glow.addColorStop(1, 'rgba(212,168,75,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, rimR + 18, 0, Math.PI * 2);
    ctx.fill();

    // Slices — hybrid zebra + chromatic rim + clipped radial rings (Theme B)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    function traceWedge(a0, a1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, outerR, a0, a1);
      ctx.closePath();
    }

    for (let i = 0; i < N; i++) {
      const a0 = i * SLICE - Math.PI / 2 - SLICE / 2;
      const a1 = a0 + SLICE;
      const midAng = (a0 + a1) / 2;

      const goldenCap = i === N - 1 && N % 2 === 1;
      const zebraDark = (i % 2 === 0) && !goldenCap;

      traceWedge(a0, a1);

      if (zebraDark) {
        const cool = ((i >>> 1) % 2) === 0;
        const rg = ctx.createRadialGradient(0, 0, innerR * 0.35, 0, 0, outerR);
        rg.addColorStop(0, cool ? '#06060f' : '#080510');
        rg.addColorStop(0.72, cool ? '#0e1026' : '#140c18');
        rg.addColorStop(1, cool ? '#12182c' : '#1a1420');
        ctx.fillStyle = rg;
      } else if (goldenCap) {
        const rg = ctx.createRadialGradient(0, 0, innerR * 0.42, 0, 0, outerR * 1.05);
        rg.addColorStop(0, 'hsl(40,72%,26%)');
        rg.addColorStop(0.5, 'hsl(46,94%,62%)');
        rg.addColorStop(1, 'hsl(32,76%,42%)');
        ctx.fillStyle = rg;
      } else {
        const hi = Math.floor(i / 2) % LIT_HUES.length;
        const hu = LIT_HUES[hi];
        const rg = ctx.createRadialGradient(0, 0, innerR * 0.4, 0, 0, outerR * 1.06);
        rg.addColorStop(0, `hsl(${hu}, 62%, 16%)`);
        rg.addColorStop(0.45, `hsl(${(hu + 24) % 360}, 90%, 45%)`);
        rg.addColorStop(1, `hsl(${(hu + 48) % 360}, 74%, 30%)`);
        ctx.fillStyle = rg;
      }
      ctx.fill();

      traceWedge(a0, a1);
      ctx.save();
      ctx.clip();

      const spacingJitter = 1 + (i % 3) * 0.07;
      const rMinDraw = innerR + 10;
      const usable = outerR - rMinDraw - 4;
      for (let k = 1; k <= ringLayers; k++) {
        const rr = outerR - (k / ringLayers) * usable * spacingJitter - 3;
        if (rr <= rMinDraw) continue;
        ctx.beginPath();
        ctx.arc(0, 0, rr, a0 + 0.035, a1 - 0.035);
        const alt = (k + i) % 2;
        ctx.strokeStyle = alt ? 'rgba(255,255,255,0.075)' : 'rgba(0,0,0,0.22)';
        ctx.lineWidth = N > 24 ? 0.85 : 1.05;
        ctx.stroke();
      }

      if (!zebraDark && ringLayers >= 9 && !(N > 22)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        [-0.035, 0.035].forEach((delta) => {
          const ar = midAng + delta;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ar) * (innerR + 14), Math.sin(ar) * (innerR + 14));
          ctx.lineTo(Math.cos(ar) * outerR * 0.93, Math.sin(ar) * outerR * 0.93);
          ctx.stroke();
        });
      }

      const sh = ctx.createRadialGradient(0, 0, innerR * 0.92, 0, 0, outerR * 1.02);
      sh.addColorStop(0, 'rgba(255,255,255,0.2)');
      sh.addColorStop(0.4, zebraDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)');
      sh.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = sh;
      traceWedge(a0, a1);
      ctx.fill();

      ctx.restore();

      const xOut = Math.cos(a0) * outerR;
      const yOut = Math.sin(a0) * outerR;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(xOut, yOut);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(xOut, yOut);
      ctx.stroke();

      ctx.save();
      ctx.rotate(midAng);
      const arcLen = SLICE * outerR;
      const radialBand = outerR - innerR - 20;
      const maxByN =
        N <= 5 ? 46 : N <= 10 ? 40 : N <= 15 ? 32 : N <= 22 ? 25 : N <= 30 ? 20 : 17;
      const minPx = N >= 26 ? 11 : 12;
      const fontPx = Math.max(minPx, Math.min(maxByN, arcLen / 3.3, radialBand / 4.5));
      ctx.font = `800 ${fontPx}px Outfit, system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5;
      let label = names[i];
      const maxChars = Math.max(6, Math.floor((outerR - innerR - 30) / (fontPx * 0.55)));
      if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
      const absoluteMid = ((midAng + rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const upsideDown = absoluteMid > Math.PI / 2 && absoluteMid < (3 * Math.PI) / 2;
      if (upsideDown) {
        ctx.rotate(Math.PI);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, -outerR + 18, 0);
      } else {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, outerR - 18, 0);
      }
      ctx.restore();
    }

    // Rotating ticks at outer circumference (alternating gold / white)
    const tickN = Math.min(56, Math.max(28, Math.floor(N * 3.25)));
    const tickLenOuter = boosting ? 5.5 : 4.5;
    for (let t = 0; t < tickN; t++) {
      const an = (t / tickN) * Math.PI * 2;
      const xa = Math.cos(an) * (outerR - 1);
      const ya = Math.sin(an) * (outerR - 1);
      const xb = Math.cos(an) * (outerR - tickLenOuter);
      const yb = Math.sin(an) * (outerR - tickLenOuter);
      ctx.strokeStyle = t % 3 === 0 ? 'rgba(244,210,122,0.88)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = t % 3 === 0 ? 3 : 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
      ctx.stroke();
    }

    ctx.restore();

    // Outer gold rim (stationary frame)
    ctx.lineWidth = 9;
    const rimGrad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
    rimGrad.addColorStop(0, boosting ? '#5a7040' : '#7a5e22');
    rimGrad.addColorStop(0.38, boosting ? '#8ee0ff' : '#f4d27a');
    rimGrad.addColorStop(0.55, boosting ? '#f4d27a' : '#e6b94d');
    rimGrad.addColorStop(1, '#5e4519');
    ctx.strokeStyle = rimGrad;
    ctx.shadowColor = boosting ? 'rgba(100,215,255,0.42)' : 'rgba(212,168,75,0.25)';
    ctx.shadowBlur = boosting ? 26 : 12;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (boosting) {
      ctx.lineWidth = 2.75;
      ctx.strokeStyle = 'rgba(118,226,255,0.75)';
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(212,168,75,0.45)';
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = boosting ? 'rgba(200,250,255,0.5)' : 'rgba(255,230,160,0.38)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 1, 0, Math.PI * 2);
    ctx.stroke();

    const dotR = outerR + 4;
    const DOTS = Math.min(40, Math.max(26, Math.floor(N * 2.35)));
    for (let di = 0; di < DOTS; di++) {
      const a = (di / DOTS) * Math.PI * 2;
      const goldHit = boosting ? di % 2 === 0 : di % 3 === 0;
      ctx.fillStyle = goldHit ? 'rgba(244,210,138,0.85)' : 'rgba(230,236,255,0.2)';
      const dr = boosting && di % 5 === 0 ? 2.05 : 1.55;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * dotR, cy + Math.sin(a) * dotR, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    const hub = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy, innerR);
    hub.addColorStop(0, boosting ? '#fff2c4' : '#f4d27a');
    hub.addColorStop(0.5, '#d4a84b');
    hub.addColorStop(1, '#5e4519');
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0b0b14';
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 0.28, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── spin loop: hold Space = boost → release = ease to predetermined winner ─
  useEffect(() => {
    if (!N) return;
    if (winnerIdx == null || winnerIdx < 0 || winnerIdx >= N) return;

    const TAU = Math.PI * 2;
    const sliceUnderPointer = (r) => wheelSliceIndexAtTopPointer(N, r);

    const fullSpins = 7 + Math.floor(Math.random() * 3);
    const jitter = (Math.random() - 0.5) * SLICE * 0.65;
    const targetRotCanonical = fullSpins * TAU - winnerIdx * SLICE + jitter;

    const PHASE_WAIT = 0;
    const PHASE_BOOST = 1;
    const PHASE_SLOW = 2;
    const PHASE_SETTLE = 3;
    let phase = PHASE_WAIT;

    const IDLE = SLICE * 0.5;
    let rot = IDLE;
    liveRotRef.current = IDLE;
    isBoostDrawingRef.current = false;
    draw(IDLE);

    let lastSliceIndex = sliceUnderPointer(IDLE);

    const OMEGA = TAU * (2.85 + Math.random() * 0.55);

    let rafId = 0;
    let animating = false;
    let lastTs = performance.now();

    let slowStart = 0;
    let totalSlowMs = 0;
    let rotRelease = 0;
    let slowMarch = 0;
    let slowCoastSec = 0;
    let slowCoastRad = 0;
    let slowTailRad = 0;
    let slowTailSec = 1;
    let rotAfterCoast = 0;
    let slowC3 = 0;
    let slowC4 = 0;
    let slowC5 = 0;

    let settleBaseline = 0;
    let settleStart = 0;
    const settleMs = 280;
    const overshoot = SLICE * 0.052;

    let finished = false;

    function marchToLand(fromRot) {
      let d = (((targetRotCanonical - fromRot) % TAU) + TAU) % TAU;
      if (d < 1e-8) d = TAU;
      const minDeb = SLICE * 13;
      while (d < minDeb) d += TAU;
      return d;
    }

    function quinticTailCoeffs(T, R, Om) {
      const T2 = T * T;
      const T3 = T2 * T;
      const T4 = T3 * T;
      const T5 = T4 * T;
      return {
        c3: (-6 * Om) / T2 + (10 * R) / T3,
        c4: (8 * Om) / T3 - (15 * R) / T4,
        c5: (6 * R) / T5 - (3 * Om) / T4
      };
    }

    function quinticTailThetaPrimed(t, Om, c3, c4, c5) {
      const t2 = t * t;
      const t3 = t2 * t;
      const t4 = t3 * t;
      const theta = Om * t + c3 * t3 + c4 * t4 + c5 * t4 * t;
      const prime = Om + 3 * c3 * t2 + 4 * c4 * t3 + 5 * c5 * t4;
      return { theta, prime };
    }

    function tailThetaIsMonotone(T, Om, c3, c4, c5) {
      const steps = 40;
      const floor = (-1e-5) * Om;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * T;
        if (quinticTailThetaPrimed(t, Om, c3, c4, c5).prime < floor) return false;
      }
      return true;
    }

    function pulseSlice(r, announceHud) {
      const ps = sliceUnderPointer(r);
      if (ps !== lastSliceIndex) {
        lastSliceIndex = ps;
        if (announceHud) onPointerRef.current?.(names[ps]);
      }
    }

    function beginSlowdown() {
      if (phase !== PHASE_BOOST || finished) return;
      onBoostChangeRef.current?.(false);
      phase = PHASE_SLOW;
      rotRelease = rot;
      slowMarch = marchToLand(rotRelease);
      slowStart = performance.now();

      const COAST_MS = 1000;
      const TARGET_TAIL_MS = 9000;

      slowCoastSec = COAST_MS / 1000;
      slowCoastRad = OMEGA * slowCoastSec;
      slowTailSec = TARGET_TAIL_MS / 1000;
      totalSlowMs = COAST_MS + TARGET_TAIL_MS;
      rotAfterCoast = rotRelease + slowCoastRad;

      let R = slowMarch - slowCoastRad;
      if (R < SLICE * 0.5) {
        slowMarch += TAU;
        R = slowMarch - slowCoastRad;
      }
      slowTailRad = R;

      let guard = 0;
      while (guard < 80) {
        const q = quinticTailCoeffs(slowTailSec, R, OMEGA);
        if (tailThetaIsMonotone(slowTailSec, OMEGA, q.c3, q.c4, q.c5)) {
          slowC3 = q.c3;
          slowC4 = q.c4;
          slowC5 = q.c5;
          break;
        }
        slowMarch += TAU;
        R = slowMarch - slowCoastRad;
        slowTailRad = R;
        guard++;
      }
      if (guard >= 80) {
        const q = quinticTailCoeffs(slowTailSec, R, OMEGA);
        slowC3 = q.c3;
        slowC4 = q.c4;
        slowC5 = q.c5;
      }
    }

    function finalizeWheel() {
      if (finished) return;
      finished = true;
      onBoostChangeRef.current?.(false);
      isBoostDrawingRef.current = false;
      rot = settleBaseline;
      draw(rot);
      liveRotRef.current = rot;
      animating = false;
      pulseSlice(rot, false);
      if (rafId) cancelAnimationFrame(rafId);
      onComplete && onComplete();
    }

    function frame(now) {
      if (finished) return;

      isBoostDrawingRef.current = phase === PHASE_BOOST;

      const dtMs = Math.min(48, Math.max(0.001, now - lastTs));
      lastTs = now;
      const dt = dtMs / 1000;

      if (phase === PHASE_BOOST) rot += OMEGA * dt;
      else if (phase === PHASE_SLOW) {
        const elapsed = (now - slowStart) / 1000;
        if (elapsed < slowCoastSec) {
          rot = rotRelease + OMEGA * elapsed;
        } else {
          const te = elapsed - slowCoastSec;
          if (te >= slowTailSec) {
            phase = PHASE_SETTLE;
            settleBaseline = rotRelease + slowMarch;
            settleStart = now;
            rot = settleBaseline;
          } else {
            const tTail = Math.max(0, te);
            const { theta } = quinticTailThetaPrimed(tTail, OMEGA, slowC3, slowC4, slowC5);
            rot = rotAfterCoast + theta;
          }
        }
      }

      if (phase === PHASE_SETTLE) {
        const tt = (now - settleStart) / settleMs;
        const env = (1 - tt) * (1 - tt);
        const wob =
          (Math.sin(tt * Math.PI * 2.9) + 0.38 * Math.sin(tt * Math.PI * 7.8)) *
          overshoot *
          env;
        rot = settleBaseline + wob;
        if (tt >= 1) {
          finalizeWheel();
          return;
        }
      }

      draw(rot);
      liveRotRef.current = rot;

      const announceHud = phase === PHASE_BOOST || phase === PHASE_SLOW;
      pulseSlice(rot, announceHud);

      if (!finished && phase !== PHASE_WAIT) {
        rafId = requestAnimationFrame(frame);
      } else animating = false;
    }

    function startAnim() {
      if (animating || finished) return;
      animating = true;
      lastTs = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    function onKd(e) {
      if (e.code !== 'Space') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) return;
      if (finished || phase === PHASE_SLOW || phase === PHASE_SETTLE) return;
      e.preventDefault();
      if (phase === PHASE_WAIT) {
        phase = PHASE_BOOST;
        onBoostChangeRef.current?.(true);
        startAnim();
      }
    }

    function onKu(e) {
      if (e.code !== 'Space') return;
      if (finished) return;
      if (phase === PHASE_SLOW || phase === PHASE_SETTLE) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (phase === PHASE_BOOST) {
        e.preventDefault();
        beginSlowdown();
      }
    }

    function onHidden() {
      if (document.hidden && phase === PHASE_BOOST && !finished) beginSlowdown();
    }

    window.addEventListener('keydown', onKd);
    window.addEventListener('keyup', onKu);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      isBoostDrawingRef.current = false;
      onBoostChangeRef.current?.(false);
      window.removeEventListener('keydown', onKd);
      window.removeEventListener('keyup', onKu);
      document.removeEventListener('visibilitychange', onHidden);
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  useLayoutEffect(() => {
    const slice = (Math.PI * 2) / Math.max(N, 1);
    const idle = slice * 0.5;
    isBoostDrawingRef.current = false;
    draw(idle);
    liveRotRef.current = idle;
  }, [N, names.join('|')]);

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === 'undefined') return;
    const el = cv.parentElement || cv;
    const ro = new ResizeObserver(() => {
      draw(liveRotRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onR = () => draw(liveRotRef.current);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  return (
    <div style={{
      position: 'relative',
      boxSizing: 'border-box',
      width: 'min(88vw, min(76vh, 920px))',
      minWidth: 'min(280px, 88vw)',
      minHeight: 'min(280px, 76vh)',
      aspectRatio: '1 / 1',
      filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.55))'
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{
        position: 'absolute',
        top: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))'
      }}>
        <svg width="58" height="68" viewBox="0 0 58 68">
          <defs>
            <linearGradient id="ptrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4d27a" />
              <stop offset="0.5" stopColor="#d4a84b" />
              <stop offset="1" stopColor="#7a5e22" />
            </linearGradient>
          </defs>
          <path d="M 29 64 L 4 10 Q 4 4 10 4 L 48 4 Q 54 4 54 10 Z"
            fill="url(#ptrGrad)" stroke="#3a2a08" strokeWidth="1.5" />
          <circle cx="29" cy="18" r="3.5" fill="#3a2a08" />
        </svg>
      </div>
    </div>
  );
};

window.SpinWheel = SpinWheel;
