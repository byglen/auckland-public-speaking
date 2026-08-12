// candles.jsx — "Last flame standing" draw concept.
// Every speaker is a lit candle. Hold Space and the wind rises; release and the
// gust sweeps through — flames go out one by one until only the winner burns.
//
// Same contract as SpinWheel: { names, winnerIdx, spinKey, onComplete }.
// The winner is predetermined by the caller; this component only performs it.
const { useState, useEffect, useRef, useCallback, useMemo } = React;

/** Small deterministic RNG so each draw's organic jitter is stable per spinKey. */
function candleRng(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Script the blow-out order. Sweep runs left→right with organic swaps; the
 * winner is never in it. Bulk goes fast, then a straggler, then a final duel.
 * Returns [{ t, type: 'out'|'wind'|'duel'|'bloom'|'complete', idx?, v? }].
 */
function buildCandleTimeline(N, winnerIdx, rnd) {
  const others = [];
  for (let i = 0; i < N; i++) if (i !== winnerIdx) others.push(i);
  for (let i = others.length - 1; i > 0; i--) {
    if (rnd() < 0.32) {
      const j = i - 1;
      const tmp = others[i]; others[i] = others[j]; others[j] = tmp;
    }
  }

  const events = [];
  let t = 380;
  events.push({ t: 0, type: 'wind', v: 0.85 });

  const rival = others.pop();
  const third = others.length ? others.pop() : null;
  const splitAt = Math.ceil(others.length * 0.6);
  const bulkA = others.slice(0, splitAt);
  const bulkB = others.slice(splitAt);

  bulkA.forEach((idx) => { events.push({ t, type: 'out', idx }); t += 115 + rnd() * 70; });
  if (bulkB.length) {
    t += 480;
    bulkB.forEach((idx) => { events.push({ t, type: 'out', idx }); t += 195 + rnd() * 95; });
  }
  events.push({ t: t + 60, type: 'wind', v: 0.3 });
  if (third != null) {
    t += 850;
    events.push({ t, type: 'out', idx: third });
  }
  t += 520;
  events.push({ t, type: 'duel' });
  events.push({ t, type: 'wind', v: 0.55 });
  t += 1500 + rnd() * 500;
  events.push({ t, type: 'out', idx: rival });
  events.push({ t: t + 40, type: 'wind', v: 0.05 });
  t += 780;
  events.push({ t, type: 'bloom' });
  t += 1500;
  events.push({ t, type: 'complete' });
  return events;
}

/** One candle: wax, flame (lean → flicker → shape), smoke on death, name tag. */
function Candle({ name, out, hard, bloom, lean, back, trait }) {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;

  const waxH = trait.hJit * (back ? 76 : 96);
  const flickerAnim = `${hard ? 'candleFlickerHard' : 'candleFlicker'} ${hard ? trait.dur * 0.4 : trait.dur}s ease-in-out ${trait.delay}s infinite`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transform: back ? 'scale(0.88)' : 'none',
      transformOrigin: 'bottom center'
    }}>
      {/* Flame zone */}
      <div style={{ position: 'relative', width: 90, height: 72, flexShrink: 0 }}>
        {/* Warm halo */}
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: -16,
          transform: `translateX(-50%) scale(${bloom ? 1.75 : 1})`,
          width: 104,
          height: 104,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,213,164,0.34) 0%, rgba(201,169,106,0.12) 48%, transparent 72%)',
          opacity: out ? 0 : 1,
          transition: 'opacity 0.5s ease, transform 1s ease',
          animation: out ? 'none' : 'candleGlowPulse 2.6s ease-in-out infinite',
          pointerEvents: 'none'
        }} />

        {/* Smoke wisp (appears once the flame dies) */}
        {out &&
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: 4,
          marginLeft: -5,
          width: 10,
          height: 26,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 60%, rgba(190,180,168,0.55) 0%, rgba(160,150,140,0.25) 55%, transparent 100%)',
          filter: 'blur(2.5px)',
          animation: 'candleSmoke 2s ease-out forwards',
          pointerEvents: 'none'
        }} />
        }

        {/* Flame — wind lean wraps the idle flicker */}
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          marginLeft: -9,
          width: 18,
          height: 44,
          transformOrigin: '50% 100%',
          transform: out
            ? 'scale(0.15) translateY(10px)'
            : `rotate(${lean * trait.leanF}deg) scale(${bloom ? 1.3 : 1})`,
          opacity: out ? 0 : 1,
          transition: out
            ? 'transform 0.16s ease-in, opacity 0.16s ease-in'
            : 'transform 0.28s ease-out'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            transformOrigin: '50% 100%',
            animation: flickerAnim
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50% 50% 44% 44% / 68% 68% 32% 32%',
              background: 'radial-gradient(ellipse at 50% 76%, rgba(255,250,235,0.98) 0%, rgba(242,208,132,0.92) 34%, rgba(224,150,66,0.75) 62%, rgba(200,96,40,0) 92%)',
              filter: 'blur(0.4px)'
            }} />
            <div style={{
              position: 'absolute',
              left: '50%',
              bottom: 5,
              marginLeft: -3.5,
              width: 7,
              height: 16,
              borderRadius: '50% 50% 42% 42% / 64% 64% 36% 36%',
              background: 'radial-gradient(ellipse at 50% 70%, rgba(255,255,250,0.98) 0%, rgba(255,244,214,0.75) 55%, transparent 100%)'
            }} />
          </div>
        </div>
      </div>

      {/* Wick */}
      <div style={{
        width: 2,
        height: 6,
        background: '#3A2E20',
        borderRadius: 1,
        marginTop: -4,
        flexShrink: 0
      }} />

      {/* Wax column */}
      <div style={{
        width: 13,
        height: waxH,
        flexShrink: 0,
        background: 'linear-gradient(180deg, #F6EFE0 0%, #E8DDC4 42%, #D6C8A8 100%)',
        borderRadius: '3px 3px 4px 4px',
        boxShadow: 'inset -3px 0 4px rgba(0,0,0,0.16), inset 2px 0 3px rgba(255,255,255,0.35)',
        filter: out ? 'brightness(0.55) saturate(0.7)' : 'none',
        transition: 'filter 0.7s ease'
      }} />

      {/* Brass holder */}
      <div style={{
        width: 27,
        height: 5,
        flexShrink: 0,
        background: 'linear-gradient(180deg, #8F7440 0%, #5C4A28 100%)',
        borderRadius: 3,
        opacity: out ? 0.5 : 0.92,
        transition: 'opacity 0.7s ease'
      }} />

      {/* Ground glow */}
      <div style={{
        width: 64,
        height: 12,
        flexShrink: 0,
        marginTop: 2,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(201,169,106,0.22) 0%, transparent 70%)',
        opacity: out ? 0 : 1,
        transition: 'opacity 0.6s ease'
      }} />

      {/* Name tag */}
      <div
        title={name}
        style={{
          marginTop: 8,
          maxWidth: 104,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          fontFamily: F.ui,
          fontSize: '0.95rem',
          fontWeight: bloom ? 500 : 400,
          letterSpacing: '0.02em',
          color: out ? C.dim : bloom ? C.goldBright : hard ? C.goldBright : C.muted,
          opacity: out ? 0.55 : 1,
          textShadow: bloom ? '0 0 22px rgba(232,213,164,0.5)' : 'none',
          transition: 'color 0.5s ease, opacity 0.5s ease'
        }}>
        {name}
      </div>
    </div>
  );
}

const CandleDraw = ({ names, winnerIdx, spinKey, onComplete }) => {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;
  const KeyboardHint = window.KeyboardHint;
  const RetroSpaceKey = window.RetroSpaceKey;

  const N = names.length;
  const [phase, setPhase] = useState('wait'); // wait | build | resolve
  const [wind, setWind] = useState(0);
  const [outSet, setOutSet] = useState(() => new Set());
  const [duel, setDuel] = useState(false);
  const [bloom, setBloom] = useState(false);

  const phaseRef = useRef('wait');
  phaseRef.current = phase;
  const windRef = useRef(0);
  const rafRef = useRef(0);
  const timersRef = useRef([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Per-candle idle character (stable per draw)
  const traits = useMemo(() => {
    const rnd = candleRng((spinKey + 1) * 7919 + N * 131);
    return names.map(() => ({
      dur: 2 + rnd() * 1.7,
      delay: -(rnd() * 3),
      leanF: 0.85 + rnd() * 0.3,
      hJit: 0.88 + rnd() * 0.26
    }));
  }, [names, spinKey, N]);

  const clearAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  // Fresh slate per draw
  useEffect(() => {
    clearAll();
    setPhase('wait');
    setWind(0);
    windRef.current = 0;
    setOutSet(new Set());
    setDuel(false);
    setBloom(false);
    return clearAll;
  }, [spinKey, names.join('|'), clearAll]);

  const beginResolve = useCallback(() => {
    if (phaseRef.current !== 'build') return;
    cancelAnimationFrame(rafRef.current);
    setPhase('resolve');
    const rnd = candleRng(spinKey * 104729 + N * 7 + winnerIdx * 13);
    const events = buildCandleTimeline(N, winnerIdx, rnd);
    events.forEach((ev) => {
      const id = setTimeout(() => {
        if (ev.type === 'out') {
          setOutSet((prev) => { const next = new Set(prev); next.add(ev.idx); return next; });
        } else if (ev.type === 'wind') {
          windRef.current = ev.v;
          setWind(ev.v);
        } else if (ev.type === 'duel') {
          setDuel(true);
        } else if (ev.type === 'bloom') {
          setBloom(true);
          setDuel(false);
          windRef.current = 0;
          setWind(0);
        } else if (ev.type === 'complete') {
          onCompleteRef.current && onCompleteRef.current();
        }
      }, ev.t);
      timersRef.current.push(id);
    });
  }, [spinKey, N, winnerIdx]);

  // Space: hold to raise the wind, release to let the gust decide
  useEffect(() => {
    const onKd = (e) => {
      if (e.code !== 'Space') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) { e.preventDefault(); return; }
      if (phaseRef.current !== 'wait') return;
      e.preventDefault();
      setPhase('build');
      const t0 = performance.now();
      const base = windRef.current;
      const tick = (now) => {
        if (phaseRef.current !== 'build') return;
        const w = Math.min(1, base + (now - t0) / 2400);
        windRef.current = w;
        setWind(w);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    const onKu = (e) => {
      if (e.code !== 'Space') return;
      if (phaseRef.current !== 'build') return;
      e.preventDefault();
      beginResolve();
    };
    const onHidden = () => {
      if (document.hidden && phaseRef.current === 'build') beginResolve();
    };
    window.addEventListener('keydown', onKd);
    window.addEventListener('keyup', onKu);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('keydown', onKd);
      window.removeEventListener('keyup', onKu);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [beginResolve]);

  const twoRows = N > 9;
  const agitated = (phase === 'build' && wind > 0.42) || (phase === 'resolve' && wind > 0.6);
  const overlayDim = Math.min(0.32, wind * 0.3) + (bloom ? 0.1 : 0);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* Floor vignette */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, transparent 52%, rgba(0,0,0,0.4) 100%)',
        pointerEvents: 'none'
      }} />

      {/* Storm dimmer */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,2,0,1)',
        opacity: overlayDim,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none'
      }} />

      {/* Rule of the game */}
      <div style={{
        position: 'absolute',
        top: 'clamp(1.75rem, 4.5vh, 3rem)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <span style={{
          fontFamily: F.ui,
          fontWeight: 500,
          fontSize: '0.85rem',
          letterSpacing: '0.34em',
          paddingLeft: '0.34em',
          textTransform: 'uppercase',
          color: C.gold,
          opacity: bloom ? 0 : 0.85,
          transition: 'opacity 0.6s ease'
        }}>
          Last flame speaks
        </span>
      </div>

      {/* Candles */}
      <div style={{ position: 'absolute', left: '4vw', right: '4vw', top: 0, bottom: 0, pointerEvents: 'none' }}>
        {names.map((name, i) => {
          const back = twoRows && i % 2 === 1;
          const out = outSet.has(i);
          const isWinner = i === winnerIdx;
          const hard = !out && ((duel && !bloom) || (agitated && !bloom));
          return (
            <div
              key={`${spinKey}-${i}`}
              style={{
                position: 'absolute',
                left: `${((i + 0.5) / N) * 100}%`,
                bottom: back ? '40%' : '22%',
                transform: 'translateX(-50%)',
                zIndex: back ? 1 : 2
              }}>
              <Candle
                name={name}
                out={out}
                hard={hard}
                bloom={bloom && isWinner}
                lean={wind * 16}
                back={back}
                trait={traits[i]}
              />
            </div>
          );
        })}
      </div>

      {/* Key hint */}
      {KeyboardHint && RetroSpaceKey &&
      <div style={{
        position: 'absolute',
        bottom: 'clamp(1.5rem, 4vh, 2.75rem)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: phase === 'resolve' ? 0 : 1,
        transition: 'opacity 0.45s ease',
        pointerEvents: 'none'
      }}>
        {phase === 'build' ?
        <KeyboardHint dark ariaLabel="Release space to let the wind decide" caption="release when ready" urgent>
          <RetroSpaceKey dark active />
        </KeyboardHint>
        :
        <KeyboardHint dark ariaLabel="Press and hold space to raise the wind" caption="hold to raise the wind">
          <RetroSpaceKey dark />
        </KeyboardHint>
        }
      </div>
      }
    </div>
  );
};

window.CandleDraw = CandleDraw;
