// ─── SPIN WHEEL ───────────────────────────────────────────────────────────────
// Interactive draw: Hold Space → full speed spin. Release Space → eased slowdown
// to the predetermined winner, then bump + reveal.
//
// Props:
//   names       – array of strings (the participants in the draw)
//   winnerIdx   – index of the predetermined winner (caller picks at random)
//   onComplete  – fired once the wheel has fully settled on the winner
//   spinKey       – change this to (re)start the spin
//   onPointerNameChange – optional (name under the top stylus tip when it changes)
//   onSpaceBoostChange  – optional (true while Space held = full-speed boost)

/** Index under stylus: fixed world bearing −π/2 (top centre). Tonearm markup must align to this bearing. */
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

/** Concentric grooves (wheel-local coords, origin centre). */
function drawVinylGrooves(ctx, rInner, rOuter, sizePx) {
  if (rOuter - rInner < 16) return;
  const spacing = Math.max(1.85, Math.min(2.65, sizePx * 0.00305));
  const maxRings = Math.min(132, Math.max(62, Math.floor(sizePx / 5.8)));
  const n = Math.min(maxRings, Math.floor((rOuter - rInner) / spacing));
  for (let g = 0; g <= n; g++) {
    const t = g / Math.max(n, 1);
    const rr = rInner + (rOuter - rInner) * Math.pow(t, 0.97);
    if (rr >= rOuter - 0.35) continue;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    const alt = g % 2;
    ctx.strokeStyle = alt ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.26)';
    ctx.lineWidth = sizePx >= 620 ? (alt ? 0.92 : 0.82) : alt ? 0.78 : 0.72;
    ctx.stroke();
  }
}

/** Label lettering along circumference; centerAngleRad places block centre (−π/2 = toward canvas top within rotating disc). */
function drawCircularLabelText(ctx, str, cx, cy, radius, centerAngleRad, fontSpec, letterFill, letterShadow) {
  if (!str) return;
  ctx.save();
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = letterFill;
  if (letterShadow) {
    ctx.shadowColor = letterShadow;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }
  let totalW = 0;
  const spacing = radius * 0.018;
  for (let i = 0; i < str.length; i++) totalW += ctx.measureText(str[i]).width;
  totalW += str.length > 1 ? (str.length - 1) * spacing : 0;
  const thetaSpan = totalW / radius;
  let ang = centerAngleRad - thetaSpan / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const w = ctx.measureText(ch).width;
    const charCentre = ang + (w / radius) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(charCentre);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(ch, 0, -radius);
    ctx.restore();
    ang += w / radius + spacing / radius;
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.restore();
}

const SpinWheel = ({ names, winnerIdx, onComplete, spinKey, onPointerNameChange, onSpaceBoostChange }) => {
  const { useRef, useEffect, useLayoutEffect } = React;
  const canvasRef = useRef(null);
  const liveRotRef = useRef(0);
  /** Gloss strength 0..~1 keyed to platter angular speed during spin */
  const smoothShineRef = useRef(0);
  const lastFrameTsRef = useRef(null);
  const lastOmegaRotRef = useRef(null);
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
    const vw = typeof window.innerWidth === 'number' ? window.innerWidth : 1024;
    if (size < 32) {
      if (layoutRetryCount < 10 && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => draw(rotation, layoutRetryCount + 1));
        return;
      }
      size = Math.max(300, Math.min(1020, Math.floor(vw * 0.82)));
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

    /** Pressed label, deadwax, groove field (coordinates share wheel centre before translate). */
    const labelPaperR = size * 0.114;
    const deadWaxOuterR = labelPaperR + Math.max(7.2, size * 0.02);
    const grooveInnerR = deadWaxOuterR;
    const grooveOuterR = outerR - Math.max(34, Math.min(52, size * 0.05));
    /** Dark centre for wedge shading / depth (within label silhouette). */
    const wedgeToneInnerR = labelPaperR * 0.35;

    /** Theme — rim hues muted for hybrid black-vinyl zebra */
    const LIT_HUES = [218, 275, 198, 300, 30, 168];

    // Soft vignette beyond disc (vinyl platter in space — no gold roulette halo)
    const glow = ctx.createRadialGradient(cx, cy, outerR * 0.68, cx, cy, rimR + 22);
    glow.addColorStop(0, boosting ? 'rgba(90,172,248,0.05)' : 'rgba(255,255,255,0.02)');
    glow.addColorStop(0.62, boosting ? 'rgba(40,118,212,0.04)' : 'rgba(108,118,146,0.045)');
    glow.addColorStop(1, 'rgba(11,11,20,0)');
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
        const rg = ctx.createRadialGradient(0, 0, wedgeToneInnerR, 0, 0, outerR);
        rg.addColorStop(0, cool ? '#040407' : '#050508');
        rg.addColorStop(0.73, cool ? '#0c1026' : '#110d18');
        rg.addColorStop(1, cool ? '#141a2c' : '#191524');
        ctx.fillStyle = rg;
      } else if (goldenCap) {
        const rg = ctx.createRadialGradient(0, 0, wedgeToneInnerR * 1.1, 0, 0, outerR * 1.05);
        rg.addColorStop(0, 'hsl(40,62%,21%)');
        rg.addColorStop(0.5, 'hsl(46,72%,53%)');
        rg.addColorStop(1, 'hsl(32,61%,37%)');
        ctx.fillStyle = rg;
      } else {
        const hi = Math.floor(i / 2) % LIT_HUES.length;
        const hu = LIT_HUES[hi];
        const rg = ctx.createRadialGradient(0, 0, wedgeToneInnerR * 1.06, 0, 0, outerR * 1.06);
        rg.addColorStop(0, `hsl(${hu}, 46%, 11%)`);
        rg.addColorStop(0.5, `hsl(${(hu + 22) % 360}, 64%, 32%)`);
        rg.addColorStop(1, `hsl(${(hu + 46) % 360}, 52%, 20%)`);
        ctx.fillStyle = rg;
      }
      ctx.fill();

      traceWedge(a0, a1);
      ctx.save();
      ctx.clip();

      if (!zebraDark && !(N > 22)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.042)';
        ctx.lineWidth = 1;
        [-0.03, 0.03].forEach((delta) => {
          const ar = midAng + delta;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ar) * (grooveInnerR + 2), Math.sin(ar) * (grooveInnerR + 2));
          ctx.lineTo(Math.cos(ar) * outerR * 0.91, Math.sin(ar) * outerR * 0.91);
          ctx.stroke();
        });
      }

      const sh = ctx.createRadialGradient(0, 0, wedgeToneInnerR * 1.12, 0, 0, outerR * 1.02);
      sh.addColorStop(0, 'rgba(255,255,255,0.12)');
      sh.addColorStop(0.42, zebraDark ? 'rgba(255,255,255,0.022)' : 'rgba(255,255,255,0.068)');
      sh.addColorStop(1, 'rgba(0,0,0,0.34)');
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

    }

    drawVinylGrooves(ctx, grooveInnerR + 2.25, grooveOuterR, size);

    // Dead wax matte ring outside label
    const dwGrad = ctx.createRadialGradient(
      0,
      -labelPaperR * 0.12,
      labelPaperR * 0.2,
      0,
      0,
      grooveInnerR
    );
    dwGrad.addColorStop(0.68, '#19181e');
    dwGrad.addColorStop(0.86, '#24222c');
    dwGrad.addColorStop(1, '#18161d');
    ctx.beginPath();
    ctx.arc(0, 0, grooveInnerR, 0, Math.PI * 2);
    ctx.arc(0, 0, labelPaperR, 0, Math.PI * 2, true);
    ctx.fillStyle = dwGrad;
    ctx.fill();

    const paperGlow = ctx.createRadialGradient(-labelPaperR * 0.2, -labelPaperR * 0.38, 0, 0, 0, labelPaperR * 1.02);
    paperGlow.addColorStop(0, '#fffaf2');
    paperGlow.addColorStop(0.45, '#eae3d8');
    paperGlow.addColorStop(0.78, '#c9c4b8');
    paperGlow.addColorStop(1, '#8a8694');
    ctx.beginPath();
    ctx.arc(0, 0, labelPaperR, 0, Math.PI * 2);
    ctx.fillStyle = paperGlow;
    ctx.fill();

    ctx.lineWidth = 1.85;
    ctx.strokeStyle = 'rgba(42,94,248,0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, labelPaperR * 0.98, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(26,52,132,0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, labelPaperR * 0.86, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const lblArcPx = Math.max(8.5, Math.min(13.8, labelPaperR * 0.132));
    const arcTopR = labelPaperR * 0.778;
    const arcBotR = labelPaperR * 0.72;

    drawCircularLabelText(
      ctx,
      'Auckland Public'.toUpperCase(),
      0,
      0,
      arcTopR,
      -Math.PI / 2,
      `900 ${lblArcPx}px Outfit,system-ui,sans-serif`,
      '#1f243d',
      'rgba(255,255,255,0.52)'
    );
    drawCircularLabelText(
      ctx,
      'Speaking'.toUpperCase(),
      0,
      0,
      arcBotR,
      Math.PI / 2,
      `900 ${lblArcPx}px Outfit,system-ui,sans-serif`,
      '#1f243d',
      'rgba(255,255,255,0.52)'
    );

    if (size >= 420) {
      ctx.shadowBlur = 0;
      ctx.font = `${Math.max(5.5, lblArcPx * 0.82)}px Outfit,system-ui,sans-serif`;
      ctx.fillStyle = 'rgba(116,138,172,0.88)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SIDE A', 0, -labelPaperR * 0.02);
      ctx.font = `${Math.max(5, lblArcPx * 0.58)}px Outfit,system-ui,sans-serif`;
      ctx.fillStyle = 'rgba(100,126,174,0.62)';
      ctx.fillText(String.fromCharCode(8226) + ' LIVE DRAW ' + String.fromCharCode(8226), 0, labelPaperR * 0.15);
    }

    const spindleR = Math.max(labelPaperR * 0.192, Math.min(labelPaperR * 0.22, size * 0.026));
    const holeGrad = ctx.createRadialGradient(-spindleR * 0.24, -spindleR * 0.2, spindleR * 0.06, 0, 0, spindleR);
    holeGrad.addColorStop(0, '#2a3548');
    holeGrad.addColorStop(0.45, '#0b0e16');
    holeGrad.addColorStop(1, '#030306');
    ctx.beginPath();
    ctx.arc(0, 0, spindleR, 0, Math.PI * 2);
    ctx.fillStyle = holeGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,210,250,0.22)';
    ctx.lineWidth = 1.05;
    ctx.stroke();

    for (let i = 0; i < N; i++) {
      const midAng = i * SLICE - Math.PI / 2;
      ctx.save();
      ctx.rotate(midAng);
      const arcLen = SLICE * outerR;
      const radialBand = outerR - grooveInnerR - 26;
      const maxByN =
        N <= 5 ? 46 : N <= 10 ? 40 : N <= 15 ? 32 : N <= 22 ? 25 : N <= 30 ? 20 : 17;
      const minPx = N >= 26 ? 11 : 12;
      const fontPx = Math.max(minPx, Math.min(maxByN, arcLen / 3.3, radialBand / 4.5));
      ctx.font = `800 ${fontPx}px Outfit, system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      let label = names[i];
      const maxChars = Math.max(6, Math.floor((outerR - grooveInnerR - 28) / (fontPx * 0.55)));
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

    const tickN = Math.min(56, Math.max(28, Math.floor(N * 3.25)));
    const tickLenOuter = boosting ? 5.5 : 4.5;
    for (let t = 0; t < tickN; t++) {
      const an = (t / tickN) * Math.PI * 2;
      const xa = Math.cos(an) * (outerR - 1);
      const ya = Math.sin(an) * (outerR - 1);
      const xb = Math.cos(an) * (outerR - tickLenOuter);
      const yb = Math.sin(an) * (outerR - tickLenOuter);
      ctx.strokeStyle = t % 4 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.38)';
      ctx.lineWidth = t % 4 === 0 ? 1.95 : 1.15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
      ctx.stroke();
    }

    ctx.restore();

    // ── Outer edge reads as lacquer/black vinyl rim (subtle highlight + shadow — not roulette gold) ──
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#13141d';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2.1;
    ctx.strokeStyle = '#24262f';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 3.1, 0, Math.PI * 2);
    ctx.stroke();

    if (boosting) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(120,218,255,0.32)';
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,164,246,0.18)';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bevel cues: faint highlight NW arc, faint shadow opposing (pressed black edge)
    ctx.lineWidth = 1.85;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4.3, Math.PI * 1.12, Math.PI * 1.68);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,252,246,0.06)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 2.95, Math.PI * 1.06, Math.PI * 1.62);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 3.95, Math.PI * 0.06, Math.PI * 0.56);
    ctx.stroke();

    // Inner delineation groove band → edge
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = boosting ? 'rgba(176,226,255,0.1)' : 'rgba(255,255,255,0.058)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Second micro highlight on outer lip (narrow specular wedge)
    ctx.lineWidth = 1;
    ctx.strokeStyle = boosting ? 'rgba(200,240,255,0.11)' : 'rgba(226,231,238,0.075)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 5.05, Math.PI * 1.08, Math.PI * 1.42);
    ctx.stroke();

    const gloss = smoothShineRef.current;
    if (gloss > 0.014) {
      const gStr = boosting ? Math.min(1, gloss + 0.42) : Math.min(0.94, gloss);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerR - 0.85, 0, Math.PI * 2);
      ctx.clip();

      ctx.globalCompositeOperation = 'soft-light';
      const gx0 = cx + Math.cos(-rotation + 1.92) * outerR * 0.75;
      const gy0 = cy + Math.sin(-rotation + 1.92) * outerR * 0.72;
      const gx1 = cx + Math.cos(-rotation + -0.12) * outerR * 0.9;
      const gy1 = cy + Math.sin(-rotation + -0.12) * outerR * 0.92;
      const gl = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      const wv = boosting ? 1.06 : gStr + 0.28;
      gl.addColorStop(0, `rgba(255,255,255,${0.02 * wv})`);
      gl.addColorStop(0.38, `rgba(255,242,218,${0.52 * gStr})`);
      gl.addColorStop(0.62, `rgba(208,226,255,${0.38 * gStr})`);
      gl.addColorStop(1, `rgba(255,255,255,${0.04 * wv})`);
      ctx.fillStyle = gl;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(cx - outerR - 30, cy - outerR - 30, (outerR + 30) * 2, (outerR + 30) * 2);

      const gx2 = cx + Math.cos(-rotation * 0.94 + -2.46) * outerR * 0.5;
      const gy2 = cy + Math.sin(-rotation * 0.94 + -2.46) * outerR * 0.48;
      const gr = ctx.createRadialGradient(gx2, gy2, outerR * 0.06, gx2, gy2, outerR * (0.55 + gStr * 0.06));
      gr.addColorStop(0, `rgba(255,255,255,${0.55 * gStr})`);
      gr.addColorStop(0.52, `rgba(255,255,255,${0.08 * gStr})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(cx - outerR - 30, cy - outerR - 30, (outerR + 30) * 2, (outerR + 30) * 2);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.restore();
    }
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
    smoothShineRef.current = 0;
    lastFrameTsRef.current = null;
    lastOmegaRotRef.current = null;
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
      smoothShineRef.current *= 0.42;
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

      const tsGlow = typeof performance.now === 'function' ? performance.now() : Date.now();
      const prevGlowTs = lastFrameTsRef.current;
      const dtGlow =
        prevGlowTs !== null ? Math.min(96, Math.max(1, tsGlow - prevGlowTs)) / 1000 : 0;
      lastFrameTsRef.current = tsGlow;

      smoothShineRef.current *= dtGlow > 0 ? Math.pow(0.874, dtGlow * 52) : 1;
      const prevGlowRot = lastOmegaRotRef.current;
      if (dtGlow <= 0.11 && dtGlow > 0 && prevGlowRot !== null) {
        let raw = Math.abs(rot - prevGlowRot) / dtGlow / (TAU * 3.05);
        if (phase === PHASE_SETTLE) raw *= 0.22;
        smoothShineRef.current += raw * dtGlow * 24;
      }
      if (smoothShineRef.current < 1e-4) smoothShineRef.current = 0;
      else smoothShineRef.current = Math.min(1.52, smoothShineRef.current);
      lastOmegaRotRef.current = rot;

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
      lastFrameTsRef.current = null;
      lastOmegaRotRef.current = null;
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
    smoothShineRef.current = 0;
    lastFrameTsRef.current = null;
    lastOmegaRotRef.current = null;
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
      width: 'min(94vw, min(84vh, 1020px))',
      minWidth: 'min(300px, 94vw)',
      minHeight: 'min(300px, 84vh)',
      aspectRatio: '1 / 1',
      filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.55))'
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {/* Stylus tip on vertical centre (−π/2). Pivot drawn high so base reads above the platter, not on the groove */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: '50%',
          top: '-8px',
          transform: 'translateX(-50%)',
          width: 'clamp(120px, 32%, 250px)',
          height: 'clamp(142px, 30vh, 252px)',
          zIndex: 5,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          filter:
            'drop-shadow(0 12px 12px rgba(0,0,0,0.58)) drop-shadow(0 -1px 0 rgba(238,243,252,0.1))'
        }}>
        <svg
          aria-hidden="true"
          viewBox="-5 -8 212 268"
          preserveAspectRatio="xMidYMax meet"
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="apsTonearmTube" x1="10%" y1="0%" x2="92%" y2="100%">
              <stop offset="0%" stopColor="#ebedf6" />
              <stop offset="38%" stopColor="#9aaecc" />
              <stop offset="100%" stopColor="#39465e" />
            </linearGradient>
            <linearGradient id="apsHeadshellDark" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#44556e" />
              <stop offset="100%" stopColor="#171d2a" />
            </linearGradient>
          </defs>
          {/* x=154 is stylus column; −53 aligns tip to platter centre (−π/2) */}
          <g transform="translate(-53 0)">
            {/* Plinth cue — reads as deck above the record, not on the vinyl */}
            <rect
              x="148"
              y="-4"
              width="44"
              height="11"
              rx="3"
              fill="#2a3140"
              stroke="#151a24"
              strokeWidth="1"
            />
            <ellipse
              cx="176"
              cy="21"
              rx="10"
              ry="16"
              transform="rotate(18 176 21)"
              fill="#2e3648"
              stroke="#1a2230"
              strokeWidth="2"
            />
            <circle cx="172" cy="14" r="2" fill="rgba(235,239,246,0.45)" />
            {/* Neck — runs into ellipse bottom + under chrome so no seams */}
            <path
              d="M 168 36 C 170 43 173 53 173 62 L174 68 L173 71 L169 71 L166 62 C 165 54 164 46 164 39 Z"
              fill="#39465c"
              stroke="#273141"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M 174 67 C 168 146 159 206 152 226"
              fill="none"
              stroke="url(#apsTonearmTube)"
              strokeWidth="9"
              strokeLinecap="butt"
            />
            <path
              d="M 176 66 C 170 146 161 206 152 226"
              fill="none"
              stroke="rgba(255,255,255,0.36)"
              strokeWidth="2.8"
              strokeLinecap="butt"
            />
            {/* Compact headshell */}
            <path
              d="M 146 217 L154 224 L159 229 L154 231 L146 224 Z"
              fill="url(#apsHeadshellDark)"
              stroke="#5b6f8e"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Cantilever + single contact */}
            <line
              x1="154"
              y1="230"
              x2="154"
              y2="252"
              stroke="#aebfe0"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <polygon points="154,248 157,255 151,255" fill="#dce6fa" stroke="#8a9ab8" strokeWidth="0.9" />
            <circle
              cx="154"
              cy="252"
              r="3.4"
              fill="#f4f8ff"
              stroke="#7d8ca8"
              strokeWidth="1.15"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

window.SpinWheel = SpinWheel;
