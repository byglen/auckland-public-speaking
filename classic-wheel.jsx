// classic-wheel.jsx — a big, warm, elegant wheel of names.
// Hold Space for full speed (the stage glows ember, the rim ignites, a gloss
// sweeps the disc); release and it falls toward the predetermined winner. The
// winning wedge floods champagne. Material warmth without the record player.
//
// Contract: { names, winnerIdx, spinKey, onComplete }.
const { useState, useEffect, useLayoutEffect, useRef } = React;

const ClassicWheel = ({ names, winnerIdx, spinKey, onComplete }) => {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;
  const KeyboardHint = window.KeyboardHint;
  const RetroSpaceKey = window.RetroSpaceKey;

  const canvasRef = useRef(null);
  const liveRotRef = useRef(0);
  const boostDrawRef = useRef(false);
  const floodRef = useRef(0);
  const landedRef = useRef(false);
  /** Speed-reactive sheen 0..~1.5 — ported from the vinyl deck */
  const smoothShineRef = useRef(0);
  const lastGlossTsRef = useRef(null);
  const lastGlossRotRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [hudPhase, setHudPhase] = useState('wait'); // wait | boost | slow | landed
  const [focusName, setFocusName] = useState('');
  const [focusKey, setFocusKey] = useState(0);

  const N = names.length;
  const SLICE = (Math.PI * 2) / Math.max(N, 1);

  // ── render the wheel at a given rotation ──────────────────────────────────
  const draw = (rotation, retryCount = 0) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const bbox = cv.getBoundingClientRect();
    let size = Math.floor(bbox.width) || cv.clientWidth || 0;
    if (size < 32) {
      if (retryCount < 10) {
        requestAnimationFrame(() => draw(rotation, retryCount + 1));
        return;
      }
      size = 560;
    }
    if (cv.width !== size * dpr) {
      cv.width = size * dpr;
      cv.height = size * dpr;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const TAU = Math.PI * 2;
    const boosting = boostDrawRef.current;
    const flood = floodRef.current;
    const landed = landedRef.current;
    const gl = Math.min(1, smoothShineRef.current);
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 16;
    const bandR = outerR * 0.4;

    // ── Base plate — warm near-black with a soft key light ──
    const plate = ctx.createRadialGradient(cx - outerR * 0.45, cy - outerR * 0.55, outerR * 0.1, cx, cy, outerR * 1.15);
    plate.addColorStop(0, '#181209');
    plate.addColorStop(0.55, '#120E0A');
    plate.addColorStop(1, '#0D0A07');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.fillStyle = plate;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // ── Wedge band — alternating warm charcoal-bronze, lifting toward the rim ──
    const evenGrad = ctx.createRadialGradient(0, 0, bandR, 0, 0, outerR);
    evenGrad.addColorStop(0, '#1D1710');
    evenGrad.addColorStop(1, '#282017');
    const oddGrad = ctx.createRadialGradient(0, 0, bandR, 0, 0, outerR);
    oddGrad.addColorStop(0, '#131009');
    oddGrad.addColorStop(1, '#1A1510');
    for (let i = 0; i < N; i++) {
      const a0 = i * SLICE - Math.PI / 2 - SLICE / 2;
      const a1 = a0 + SLICE;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, a0, a1);
      ctx.arc(0, 0, bandR, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? evenGrad : oddGrad;
      ctx.fill();
    }

    // Champagne flood on the winning wedge once landed
    if (landed && flood > 0) {
      const a0 = winnerIdx * SLICE - Math.PI / 2 - SLICE / 2;
      const a1 = a0 + SLICE;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, a0, a1);
      ctx.arc(0, 0, bandR, a1, a0, true);
      ctx.closePath();
      const fg = ctx.createRadialGradient(0, 0, bandR, 0, 0, outerR);
      fg.addColorStop(0, `rgba(232,213,164,${0.95 * flood})`);
      fg.addColorStop(1, `rgba(201,169,106,${0.9 * flood})`);
      ctx.fillStyle = fg;
      ctx.fill();
    }

    // Hairline separators — wake with speed
    ctx.strokeStyle = `rgba(201,169,106,${0.16 + gl * 0.22})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      const ang = i * SLICE - Math.PI / 2 - SLICE / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * bandR, Math.sin(ang) * bandR);
      ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR);
      ctx.stroke();
    }

    // ── Names — radial, flipped on the lower half so they always read outward ──
    const maxByN = N <= 5 ? 44 : N <= 10 ? 36 : N <= 15 ? 30 : N <= 22 ? 24 : 18;
    const fontPx = Math.max(12, Math.min(maxByN, (SLICE * outerR) / 3.05, (outerR - bandR - 26) / 4.1));
    ctx.font = `500 ${fontPx}px ${F.ui}`;
    ctx.textBaseline = 'middle';
    const maxChars = Math.max(6, Math.floor((outerR - bandR - 30) / (fontPx * 0.52)));

    for (let i = 0; i < N; i++) {
      const midAng = i * SLICE - Math.PI / 2;
      let label = names[i];
      if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
      const isFloodedWinner = landed && flood > 0.35 && i === winnerIdx;
      const absoluteMid = ((midAng + rotation) % TAU + TAU) % TAU;
      const upsideDown = absoluteMid > Math.PI / 2 && absoluteMid < (3 * Math.PI) / 2;

      ctx.save();
      ctx.rotate(midAng);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = isFloodedWinner
        ? '#221A0E'
        : `rgba(244,239,230,${boosting ? 0.72 : 0.92})`;
      if (upsideDown) {
        ctx.rotate(Math.PI);
        ctx.textAlign = 'left';
        ctx.fillText(label, -(outerR - 20), 0);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(label, outerR - 20, 0);
      }
      ctx.restore();
    }

    // Rim ticks — machined texture that reads as motion at speed
    const tickN = Math.min(72, Math.max(36, N * 4));
    for (let t = 0; t < tickN; t++) {
      const an = (t / tickN) * TAU;
      const xa = Math.cos(an) * (outerR - 2);
      const ya = Math.sin(an) * (outerR - 2);
      const xb = Math.cos(an) * (outerR - (t % 4 === 0 ? 9 : 6));
      const yb = Math.sin(an) * (outerR - (t % 4 === 0 ? 9 : 6));
      ctx.strokeStyle = t % 4 === 0 ? 'rgba(244,239,230,0.14)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = t % 4 === 0 ? 1.4 : 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
      ctx.stroke();
    }

    ctx.restore();

    // ── Hub plate — a quiet watch-dial centre ──
    const hubGrad = ctx.createRadialGradient(cx - bandR * 0.3, cy - bandR * 0.4, bandR * 0.1, cx, cy, bandR);
    hubGrad.addColorStop(0, '#1B1610');
    hubGrad.addColorStop(0.7, '#14100B');
    hubGrad.addColorStop(1, '#0F0C09');
    ctx.beginPath();
    ctx.arc(cx, cy, bandR - 3, 0, TAU);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, bandR - 3, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, bandR - 5.5, 0, TAU);
    ctx.strokeStyle = 'rgba(244,239,230,0.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // band inner edge
    ctx.beginPath();
    ctx.arc(cx, cy, bandR, 0, TAU);
    ctx.strokeStyle = 'rgba(244,239,230,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Rim — machined edge: dark base, paper hairline, bevel light, gold halo ──
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 2.5, 0, TAU);
    ctx.strokeStyle = '#1A1510';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.strokeStyle = 'rgba(244,239,230,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // bevel cues — light NW, shade SE
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 3.2, Math.PI * 1.08, Math.PI * 1.66);
    ctx.strokeStyle = 'rgba(255,252,246,0.12)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 3.4, Math.PI * 0.06, Math.PI * 0.58);
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // gold halo ring — ignites while spinning, glows on the landing
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 9, 0, TAU);
    ctx.strokeStyle = boosting
      ? `rgba(232,213,164,${0.45 + gl * 0.3})`
      : landed
      ? `rgba(232,213,164,${0.3 + flood * 0.3})`
      : `rgba(201,169,106,${0.24 + gl * 0.3})`;
    ctx.lineWidth = boosting ? 1.6 : 1;
    ctx.stroke();

    // ── Speed gloss — warm light sweeping the disc while it turns ──
    const gloss = smoothShineRef.current;
    if (gloss > 0.014) {
      const gStr = boosting ? Math.min(1, gloss + 0.42) : Math.min(0.94, gloss);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerR - 0.85, 0, TAU);
      ctx.clip();

      ctx.globalCompositeOperation = 'soft-light';
      const gx0 = cx + Math.cos(-rotation + 1.92) * outerR * 0.75;
      const gy0 = cy + Math.sin(-rotation + 1.92) * outerR * 0.72;
      const gx1 = cx + Math.cos(-rotation - 0.12) * outerR * 0.9;
      const gy1 = cy + Math.sin(-rotation - 0.12) * outerR * 0.92;
      const glGrad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      const wv = boosting ? 1.06 : gStr + 0.28;
      glGrad.addColorStop(0, `rgba(255,255,255,${0.02 * wv})`);
      glGrad.addColorStop(0.38, `rgba(255,242,218,${0.55 * gStr})`);
      glGrad.addColorStop(0.62, `rgba(240,232,214,${0.38 * gStr})`);
      glGrad.addColorStop(1, `rgba(255,255,255,${0.04 * wv})`);
      ctx.fillStyle = glGrad;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(cx - outerR - 30, cy - outerR - 30, (outerR + 30) * 2, (outerR + 30) * 2);

      const gx2 = cx + Math.cos(-rotation * 0.94 - 2.46) * outerR * 0.5;
      const gy2 = cy + Math.sin(-rotation * 0.94 - 2.46) * outerR * 0.48;
      const gr = ctx.createRadialGradient(gx2, gy2, outerR * 0.06, gx2, gy2, outerR * (0.55 + gStr * 0.06));
      gr.addColorStop(0, `rgba(255,255,255,${0.5 * gStr})`);
      gr.addColorStop(0.52, `rgba(255,255,255,${0.08 * gStr})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(cx - outerR - 30, cy - outerR - 30, (outerR + 30) * 2, (outerR + 30) * 2);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  };

  // ── spin machinery: hold = full speed, release = quintic fall to winner ───
  useEffect(() => {
    if (!N) return;
    if (winnerIdx == null || winnerIdx < 0 || winnerIdx >= N) return;

    landedRef.current = false;
    floodRef.current = 0;
    boostDrawRef.current = false;
    smoothShineRef.current = 0;
    lastGlossTsRef.current = null;
    lastGlossRotRef.current = null;
    setHudPhase('wait');
    setFocusName('');
    setFocusKey(0);

    const TAU = Math.PI * 2;
    const sliceUnderPointer = (r) => window.wheelSliceIndexAtTopPointer(N, r);

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
    draw(IDLE);

    let lastSliceIndex = sliceUnderPointer(IDLE);
    const OMEGA = TAU * (2.85 + Math.random() * 0.55);

    let rafId = 0;
    let animating = false;
    let lastTs = performance.now();

    let slowStart = 0;
    let rotRelease = 0;
    let slowMarch = 0;
    let slowCoastSec = 0;
    let slowCoastRad = 0;
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
    let holdTimer = 0;
    let cancelled = false;

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
      const floor = -1e-5 * Om;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * T;
        if (quinticTailThetaPrimed(t, Om, c3, c4, c5).prime < floor) return false;
      }
      return true;
    }

    function pulseSlice(r) {
      const ps = sliceUnderPointer(r);
      if (ps !== lastSliceIndex) {
        lastSliceIndex = ps;
        if (phase === PHASE_SLOW) {
          setFocusName(names[ps]);
          setFocusKey((k) => k + 1);
        }
      }
    }

    function beginSlowdown() {
      if (phase !== PHASE_BOOST || finished) return;
      phase = PHASE_SLOW;
      boostDrawRef.current = false;
      setHudPhase('slow');
      rotRelease = rot;
      slowMarch = marchToLand(rotRelease);
      slowStart = performance.now();

      const COAST_MS = 1000;
      const TARGET_TAIL_MS = 9000;

      slowCoastSec = COAST_MS / 1000;
      slowCoastRad = OMEGA * slowCoastSec;
      slowTailSec = TARGET_TAIL_MS / 1000;
      rotAfterCoast = rotRelease + slowCoastRad;

      let R = slowMarch - slowCoastRad;
      if (R < SLICE * 0.5) {
        slowMarch += TAU;
        R = slowMarch - slowCoastRad;
      }

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
      landedRef.current = true;
      rot = settleBaseline;
      liveRotRef.current = rot;
      animating = false;
      if (rafId) cancelAnimationFrame(rafId);
      setHudPhase('landed');
      setFocusName(names[winnerIdx]);
      setFocusKey((k) => k + 1);

      // Champagne flood, a beat of glory, then hand over to the reveal
      const t0 = performance.now();
      const step = (now) => {
        floodRef.current = Math.min(1, (now - t0) / 420);
        smoothShineRef.current *= 0.92;
        draw(rot);
        if (floodRef.current < 1 && !cancelled) {
          rafId = requestAnimationFrame(step);
        } else if (!cancelled) {
          holdTimer = setTimeout(() => {
            if (!cancelled) onCompleteRef.current && onCompleteRef.current();
          }, 1000);
        }
      };
      rafId = requestAnimationFrame(step);
    }

    function frame(now) {
      if (finished) return;
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
            const { theta } = quinticTailThetaPrimed(Math.max(0, te), OMEGA, slowC3, slowC4, slowC5);
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

      // Speed-reactive gloss (decays with real angular velocity)
      const tsGlow = performance.now();
      const prevTs = lastGlossTsRef.current;
      const dtGlow = prevTs !== null ? Math.min(96, Math.max(1, tsGlow - prevTs)) / 1000 : 0;
      lastGlossTsRef.current = tsGlow;
      smoothShineRef.current *= dtGlow > 0 ? Math.pow(0.874, dtGlow * 52) : 1;
      const prevRot = lastGlossRotRef.current;
      if (dtGlow <= 0.11 && dtGlow > 0 && prevRot !== null) {
        let raw = Math.abs(rot - prevRot) / dtGlow / (TAU * 3.05);
        if (phase === PHASE_SETTLE) raw *= 0.22;
        smoothShineRef.current += raw * dtGlow * 24;
      }
      if (smoothShineRef.current < 1e-4) smoothShineRef.current = 0;
      else smoothShineRef.current = Math.min(1.52, smoothShineRef.current);
      lastGlossRotRef.current = rot;

      draw(rot);
      liveRotRef.current = rot;
      pulseSlice(rot);

      if (!finished && phase !== PHASE_WAIT) {
        rafId = requestAnimationFrame(frame);
      } else animating = false;
    }

    function startAnim() {
      if (animating || finished) return;
      animating = true;
      lastTs = performance.now();
      lastGlossTsRef.current = null;
      lastGlossRotRef.current = null;
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
        boostDrawRef.current = true;
        setHudPhase('boost');
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
      cancelled = true;
      boostDrawRef.current = false;
      window.removeEventListener('keydown', onKd);
      window.removeEventListener('keyup', onKu);
      document.removeEventListener('visibilitychange', onHidden);
      cancelAnimationFrame(rafId);
      clearTimeout(holdTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  useLayoutEffect(() => {
    const idle = ((Math.PI * 2) / Math.max(N, 1)) * 0.5;
    draw(idle);
    liveRotRef.current = idle;
  }, [N, names.join('|')]);

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === 'undefined') return;
    const el = cv.parentElement || cv;
    const ro = new ResizeObserver(() => draw(liveRotRef.current));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onR = () => draw(liveRotRef.current);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // Repaint once webfonts land so canvas lettering uses Theinhardt
  useEffect(() => {
    let cancelled = false;
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) draw(liveRotRef.current);
      });
    }
    return () => { cancelled = true; };
  }, []);

  const inFlight = hudPhase === 'slow' || hudPhase === 'landed';

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      {/* Ember stage glow while the wheel is held at full speed */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 85% 78% at 50% 44%, rgba(224,133,68,0.15) 0%, rgba(201,169,106,0.05) 45%, transparent 74%)',
        opacity: hudPhase === 'boost' ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '6vh'
      }}>
        <div style={{
          position: 'relative',
          width: 'min(82vh, 62vw, 940px)',
          aspectRatio: '1 / 1',
          transform: hudPhase === 'boost' ? 'scale(1.025)' : 'scale(1)',
          transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), filter 0.5s ease',
          filter: hudPhase === 'boost'
            ? 'drop-shadow(0 30px 64px rgba(0,0,0,0.55)) drop-shadow(0 0 52px rgba(201,169,106,0.24))'
            : 'drop-shadow(0 30px 64px rgba(0,0,0,0.55))'
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Needle — ticks as each name passes */}
          <div
            key={focusKey}
            style={{
              position: 'absolute',
              top: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3,
              animation: focusKey > 0 ? 'wheelPointerDip 0.14s ease-out' : 'none',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))'
            }}>
            <svg width="30" height="37" viewBox="0 0 30 37" aria-hidden>
              <defs>
                <linearGradient id="apsNeedleFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#E8D5A4" />
                  <stop offset="1" stopColor="#8F7440" />
                </linearGradient>
              </defs>
              <path
                d="M15 36 L4.4 9 Q15 1 25.6 9 Z"
                fill="url(#apsNeedleFill)"
                stroke="rgba(12,10,8,0.55)"
                strokeWidth="1"
              />
            </svg>
          </div>

          {/* Hub — count at rest, the live name once the wheel is falling */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            pointerEvents: 'none'
          }}>
            {inFlight && focusName ?
            <div
              key={`n-${focusKey}`}
              title={focusName}
              style={{
                maxWidth: '34%',
                fontFamily: F.stage,
                fontWeight: 400,
                fontSize: 'clamp(1.7rem, 3vw, 2.9rem)',
                lineHeight: 1.1,
                color: hudPhase === 'landed' ? C.goldBright : C.gold,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'center',
                textShadow: '0 4px 22px rgba(0,0,0,0.6)',
                animation: 'spinNameSwap 0.1s cubic-bezier(0.22, 1, 0.36, 1) both'
              }}>
              {focusName}
            </div>
            :
            <>
              <div style={{
                fontFamily: F.ui,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 'clamp(2.1rem, 4vw, 3.2rem)',
                lineHeight: 1,
                color: 'rgba(244,239,230,0.92)'
              }}>
                {N}
              </div>
              <div style={{
                fontFamily: F.ui,
                fontWeight: 500,
                fontSize: '0.64rem',
                letterSpacing: '0.32em',
                paddingLeft: '0.32em',
                textTransform: 'uppercase',
                color: C.dim
              }}>
                In the draw
              </div>
            </>
            }
          </div>
        </div>
      </div>

      {/* Key hint */}
      {KeyboardHint && RetroSpaceKey &&
      <div style={{
        position: 'absolute',
        bottom: 'clamp(1.25rem, 3vh, 2.25rem)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: hudPhase === 'wait' || hudPhase === 'boost' ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none'
      }}>
        {hudPhase === 'boost' ?
        <KeyboardHint ariaLabel="Release space to draw" caption="release to draw" urgent>
          <RetroSpaceKey active />
        </KeyboardHint>
        :
        <KeyboardHint ariaLabel="Press and hold space to spin" caption="hold to spin">
          <RetroSpaceKey />
        </KeyboardHint>
        }
      </div>
      }
    </div>
  );
};

window.ClassicWheel = ClassicWheel;
