// lottery.jsx — the lottery machine.
// Name-balls rest in a glass sphere on a brass pedestal. Hold Space and the
// blower churns them; release and the machine catches one ball, draws it up
// the tube and settles it in the cradle. Everyone is visibly in the pot.
//
// Contract: { names, winnerIdx, spinKey, onComplete }.
const { useState, useEffect, useLayoutEffect, useRef } = React;

function lotteryRng(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const LotteryDraw = ({ names, winnerIdx, spinKey, onComplete }) => {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;
  const KeyboardHint = window.KeyboardHint;
  const RetroSpaceKey = window.RetroSpaceKey;

  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [hudPhase, setHudPhase] = useState('wait'); // wait | boost | resolve | landed
  const [readout, setReadout] = useState('');

  const N = names.length;

  useEffect(() => {
    setHudPhase('wait');
    setReadout('');

    const cv = canvasRef.current;
    if (!cv || !N || winnerIdx == null || winnerIdx < 0 || winnerIdx >= N) return;

    const rnd = lotteryRng((spinKey + 1) * 48271 + N * 17 + winnerIdx * 7);

    // mode: wait | boost | churn2 | suction | rise | landed
    let mode = 'wait';
    let churnStart = 0;
    let riseStart = 0;
    let landedAt = 0;
    let finished = false;
    let cancelled = false;
    let rafId = 0;
    const timers = [];

    const G = 1500;

    // Geometry recomputed per frame from canvas box
    const geo = { W: 0, H: 0, cx: 0, cy: 0, R: 0, ballR: 0, tubeLen: 0, cradleY: 0 };
    function computeGeo(W, H) {
      geo.W = W;
      geo.H = H;
      geo.R = Math.min(H * 0.29, W * 0.21);
      geo.cx = W / 2;
      geo.cy = H * 0.465;
      geo.ballR = Math.min(geo.R * 0.19, geo.R * Math.sqrt(0.34 / Math.max(N, 5)));
      geo.tubeLen = geo.R * 0.42;
      geo.cradleY = geo.cy - geo.R - geo.tubeLen;
    }

    // Balls — seeded start positions in the lower half, pre-settled into a pile
    const balls = names.map((name, i) => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      label: (() => {
        const first = name.split(/\s+/)[0];
        return first.length > 9 ? first.slice(0, 8) + '…' : first;
      })(),
      tone: i % 2 === 0 ? 0 : 1,
      i
    }));
    let seeded = false;
    function seedBalls() {
      const R = geo.R;
      balls.forEach((b) => {
        const a = Math.PI * (0.15 + rnd() * 0.7);
        const rr = R * (0.25 + rnd() * 0.6);
        b.x = geo.cx + Math.cos(a + Math.PI) * rr * 0.9;
        b.y = geo.cy + Math.abs(Math.sin(a)) * rr * 0.8;
        b.vx = 0;
        b.vy = 0;
      });
      for (let k = 0; k < 90; k++) step(0.016, true);
      seeded = true;
    }

    function step(dt, silent) {
      const R = geo.R;
      const br = geo.ballR;
      const churnP =
        mode === 'boost'
          ? 1
          : mode === 'churn2'
          ? Math.max(0.18, 1 - (performance.now() - churnStart) / 900)
          : 0;

      for (const b of balls) {
        if (mode === 'rise' && b.i === winnerIdx) continue;
        b.vy += G * dt;

        if (churnP > 0 && !silent) {
          const dx = b.x - geo.cx;
          const dyb = b.y - (geo.cy + R * 0.55);
          const sig = R * 0.58;
          const jet = Math.exp(-(dx * dx + dyb * dyb) / (sig * sig)) * 5600 * churnP;
          b.vy -= jet * dt;
          b.vx += ((rnd() - 0.5) * 2600 + Math.sign(dx || 1) * jet * 0.2) * dt * churnP;
          b.vx += ((b.y - geo.cy) / R) * -560 * dt * churnP;
          b.vy += ((b.x - geo.cx) / R) * 240 * dt * churnP;
        }

        if (mode === 'suction' && b.i === winnerIdx) {
          const tx = geo.cx;
          const ty = geo.cy - R + br * 1.1;
          b.vx += ((tx - b.x) * 26 - b.vx * 6.5) * dt;
          b.vy += ((ty - b.y) * 26 - b.vy * 6.5) * dt - G * dt;
          if (Math.abs(b.x - tx) < 7 && Math.abs(b.y - ty) < 9) {
            mode = 'rise';
            riseStart = performance.now();
          }
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }

      // ball ↔ ball
      for (let a = 0; a < balls.length; a++) {
        const A = balls[a];
        if (mode === 'rise' && A.i === winnerIdx) continue;
        for (let c = a + 1; c < balls.length; c++) {
          const B = balls[c];
          if (mode === 'rise' && B.i === winnerIdx) continue;
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const d2 = dx * dx + dy * dy;
          const min = br * 2;
          if (d2 > 0.0001 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const overlap = (min - d) / 2;
            A.x -= nx * overlap;
            A.y -= ny * overlap;
            B.x += nx * overlap;
            B.y += ny * overlap;
            const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rel < 0) {
              const imp = -rel * 0.78;
              A.vx -= nx * imp;
              A.vy -= ny * imp;
              B.vx += nx * imp;
              B.vy += ny * imp;
            }
          }
        }
      }

      // sphere wall
      const rest = churnP > 0.4 ? 0.82 : 0.45;
      for (const b of balls) {
        if (mode === 'rise' && b.i === winnerIdx) continue;
        const dx = b.x - geo.cx;
        const dy = b.y - geo.cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const lim = R - br - 2;
        if (d > lim) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = geo.cx + nx * lim;
          b.y = geo.cy + ny * lim;
          const vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= (1 + rest) * vn * nx;
            b.vy -= (1 + rest) * vn * ny;
            b.vx *= 0.985;
            b.vy *= 0.985;
          }
        }
      }
    }

    function drawBall(ctx, x, y, r, label, tone, emphasized) {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
      if (tone === 0) {
        g.addColorStop(0, '#FBF6EA');
        g.addColorStop(0.65, '#EFE5CE');
        g.addColorStop(1, '#D8C9A8');
      } else {
        g.addColorStop(0, '#F3EAD6');
        g.addColorStop(0.65, '#E3D5B6');
        g.addColorStop(1, '#C9B892');
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = emphasized ? 'rgba(143,116,64,0.8)' : 'rgba(60,48,30,0.35)';
      ctx.lineWidth = emphasized ? 1.6 : 1;
      ctx.stroke();

      const fs = Math.max(8, Math.min(16, r * 0.42));
      ctx.font = `500 ${fs}px ${F.ui}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#33291A';
      ctx.fillText(label, x, y + 0.5);
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
      computeGeo(W, H);
      if (!seeded) seedBalls();
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const { cx, cy, R, ballR, tubeLen, cradleY } = geo;
      const TAU = Math.PI * 2;
      const boosting = mode === 'boost';
      const landed = mode === 'landed';
      const tubeW = ballR * 2.5;

      // ── Pedestal ──
      const baseW = R * 2.0;
      const baseH = R * 0.26;
      const baseY = cy + R + baseH * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.32, cy + R * 0.86);
      ctx.lineTo(cx + R * 0.32, cy + R * 0.86);
      ctx.lineTo(cx + R * 0.46, baseY);
      ctx.lineTo(cx - R * 0.46, baseY);
      ctx.closePath();
      const neck = ctx.createLinearGradient(0, cy + R * 0.8, 0, baseY);
      neck.addColorStop(0, '#221B12');
      neck.addColorStop(1, '#15100A');
      ctx.fillStyle = neck;
      ctx.fill();

      const bg = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
      bg.addColorStop(0, '#241D13');
      bg.addColorStop(0.5, '#1A140D');
      bg.addColorStop(1, '#120E08');
      ctx.beginPath();
      const brx = 10;
      ctx.roundRect(cx - baseW / 2, baseY, baseW, baseH, brx);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,239,230,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // brass inlay line
      ctx.beginPath();
      ctx.moveTo(cx - baseW / 2 + 14, baseY + baseH * 0.5);
      ctx.lineTo(cx + baseW / 2 - 14, baseY + baseH * 0.5);
      ctx.strokeStyle = 'rgba(201,169,106,0.4)';
      ctx.stroke();
      // count
      ctx.font = `500 ${Math.max(10, baseH * 0.3)}px ${F.ui}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(244,239,230,0.55)';
      ctx.fillText(`${N}  IN  THE  DRAW`, cx, baseY + baseH * 0.52);

      // ── Sphere interior backdrop ──
      const glassBg = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.2, cx, cy, R);
      glassBg.addColorStop(0, 'rgba(244,239,230,0.045)');
      glassBg.addColorStop(0.7, 'rgba(244,239,230,0.015)');
      glassBg.addColorStop(1, 'rgba(244,239,230,0.03)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fillStyle = '#100D09';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fillStyle = glassBg;
      ctx.fill();

      // swirl cues while churning
      if (boosting || mode === 'churn2') {
        const t = now / 900;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R - 6, 0, TAU);
        ctx.clip();
        for (let s = 0; s < 2; s++) {
          ctx.beginPath();
          ctx.arc(cx, cy, R * (0.45 + s * 0.24), t + s * 2.2, t + s * 2.2 + 1.9);
          ctx.strokeStyle = `rgba(232,213,164,${boosting ? 0.07 : 0.04})`;
          ctx.lineWidth = 10;
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── Balls (clipped to sphere) ──
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R - 1.5, 0, TAU);
      ctx.clip();
      for (const b of balls) {
        if ((mode === 'rise' || mode === 'landed') && b.i === winnerIdx) continue;
        drawBall(ctx, b.x, b.y, ballR, b.label, b.tone, false);
      }
      ctx.restore();

      // ── Glass shine + rim ──
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.86, Math.PI * 1.08, Math.PI * 1.5);
      ctx.strokeStyle = 'rgba(255,252,244,0.13)';
      ctx.lineWidth = R * 0.05;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.9, Math.PI * 0.22, Math.PI * 0.42);
      ctx.strokeStyle = 'rgba(255,252,244,0.05)';
      ctx.lineWidth = R * 0.03;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R + 2, 0, TAU);
      ctx.strokeStyle = '#1A1510';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.strokeStyle = 'rgba(244,239,230,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8, 0, TAU);
      ctx.strokeStyle = boosting
        ? 'rgba(232,213,164,0.5)'
        : landed
        ? 'rgba(232,213,164,0.35)'
        : 'rgba(201,169,106,0.22)';
      ctx.lineWidth = boosting ? 1.6 : 1;
      ctx.stroke();

      // ── Tube + cradle ──
      const tubeTop = cradleY + ballR * 0.4;
      ctx.strokeStyle = 'rgba(244,239,230,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - tubeW / 2, cy - R + 2);
      ctx.lineTo(cx - tubeW / 2, tubeTop);
      ctx.moveTo(cx + tubeW / 2, cy - R + 2);
      ctx.lineTo(cx + tubeW / 2, tubeTop);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(201,169,106,0.25)';
      ctx.beginPath();
      ctx.moveTo(cx - tubeW / 2 - 4, cy - R + 2);
      ctx.lineTo(cx - tubeW / 2 - 4, tubeTop);
      ctx.moveTo(cx + tubeW / 2 + 4, cy - R + 2);
      ctx.lineTo(cx + tubeW / 2 + 4, tubeTop);
      ctx.stroke();

      // rising / landed winner ball
      if (mode === 'rise' || mode === 'landed') {
        const wb = balls[winnerIdx];
        let bx = cx;
        let by;
        let scale = 1;
        if (mode === 'rise') {
          const t = Math.min(1, (now - riseStart) / 1100);
          const e = 1 - Math.pow(1 - t, 3);
          by = (cy - geo.R + ballR) + (cradleY - (cy - geo.R + ballR)) * e;
          scale = 1 + 0.5 * e;
          if (t >= 1) {
            mode = 'landed';
            landedAt = now;
            setHudPhase('landed');
            setReadout(names[winnerIdx]);
            timers.push(setTimeout(() => {
              if (!cancelled) onCompleteRef.current && onCompleteRef.current();
            }, 1500));
          }
        } else {
          by = cradleY;
          scale = 1.5 + Math.sin((now - landedAt) / 300) * 0.01;
        }
        // cradle glow
        if (mode === 'landed') {
          const glow = ctx.createRadialGradient(bx, by, ballR * 0.4, bx, by, ballR * 3.4);
          glow.addColorStop(0, 'rgba(232,213,164,0.28)');
          glow.addColorStop(1, 'rgba(232,213,164,0)');
          ctx.beginPath();
          ctx.arc(bx, by, ballR * 3.4, 0, TAU);
          ctx.fillStyle = glow;
          ctx.fill();
        }
        drawBall(ctx, bx, by, ballR * scale, wb.label, wb.tone, mode === 'landed');
      }

      // cradle ring
      ctx.beginPath();
      ctx.arc(cx, cradleY, ballR * 1.9, Math.PI * 0.12, Math.PI * 0.88);
      ctx.strokeStyle = landed ? 'rgba(232,213,164,0.75)' : 'rgba(201,169,106,0.4)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    let lastTs = performance.now();
    function frame(now) {
      if (cancelled) return;
      const dt = Math.min(0.032, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      if (geo.R > 0 && seeded && mode !== 'landed') step(dt, false);
      draw(now);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    function beginResolve() {
      if (mode !== 'boost' || finished) return;
      finished = true;
      mode = 'churn2';
      churnStart = performance.now();
      setHudPhase('resolve');
      timers.push(setTimeout(() => {
        if (!cancelled && mode === 'churn2') mode = 'suction';
      }, 900));
    }

    function onKd(e) {
      if (e.code !== 'Space') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) { e.preventDefault(); return; }
      if (mode !== 'wait') return;
      e.preventDefault();
      mode = 'boost';
      setHudPhase('boost');
    }
    function onKu(e) {
      if (e.code !== 'Space') return;
      if (mode !== 'boost') return;
      e.preventDefault();
      beginResolve();
    }
    function onHidden() {
      if (document.hidden && mode === 'boost') beginResolve();
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

      {/* Ember stage glow while churning */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 74% at 50% 46%, rgba(224,133,68,0.14) 0%, rgba(201,169,106,0.05) 45%, transparent 74%)',
        opacity: hudPhase === 'boost' ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none'
      }} />

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Landed readout — replaces the hint */}
      <div style={{
        position: 'absolute',
        bottom: 'clamp(1.25rem, 3vh, 2.25rem)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        {hudPhase === 'landed' && readout ?
        <div
          title={readout}
          style={{
            maxWidth: '86vw',
            fontFamily: F.stage,
            fontWeight: 400,
            fontSize: 'clamp(2rem, 3.4vw, 3.2rem)',
            lineHeight: 1.1,
            color: C.goldBright,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 4px 24px rgba(0,0,0,0.55)',
            animation: 'spinNameSwap 0.12s cubic-bezier(0.22, 1, 0.36, 1) both'
          }}>
          {readout}
        </div>
        : KeyboardHint && RetroSpaceKey &&
        <div style={{
          opacity: hudPhase === 'wait' || hudPhase === 'boost' ? 1 : 0,
          transition: 'opacity 0.4s ease'
        }}>
          {hudPhase === 'boost' ?
          <KeyboardHint ariaLabel="Release space to draw a ball" caption="release to draw" urgent>
            <RetroSpaceKey active />
          </KeyboardHint>
          :
          <KeyboardHint ariaLabel="Press and hold space to churn" caption="hold to churn">
            <RetroSpaceKey />
          </KeyboardHint>
          }
        </div>
        }
      </div>
    </div>
  );
};

window.LotteryDraw = LotteryDraw;
