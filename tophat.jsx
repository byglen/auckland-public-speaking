// tophat.jsx — the hat.
// The oldest draw ritual there is. Every name is written on a slip and dropped
// in (a roll-call the room can watch). Hold Space to shake the hat — slips leap
// and flash names — release, and one slip is tossed high, freezes, and unfolds
// into a cream card carrying the winner's name in ink.
//
// Contract: { names, winnerIdx, spinKey, onComplete }.
const { useState, useEffect, useRef, useMemo } = React;

function hatRng(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small folded paper slip with a name on it. */
function HatSlip({ name, style }) {
  return (
    <div style={{
      width: 96,
      height: 30,
      background: 'linear-gradient(175deg, #F6EFE0 0%, #EBE0C8 100%)',
      borderRadius: 3,
      boxShadow: '0 3px 10px rgba(0,0,0,0.4), inset 0 -5px 8px rgba(120,100,60,0.14)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...style
    }}>
      <span style={{
        fontFamily: "'Theinhardt', 'Helvetica Neue', sans-serif",
        fontWeight: 500,
        fontSize: 12,
        letterSpacing: '0.02em',
        color: '#2A2114',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 86
      }}>
        {name}
      </span>
    </div>
  );
}

const HatDraw = ({ names, winnerIdx, spinKey, onComplete }) => {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;
  const KeyboardHint = window.KeyboardHint;
  const RetroSpaceKey = window.RetroSpaceKey;

  const N = names.length;

  const [hudPhase, setHudPhase] = useState('wait'); // wait | boost | resolve | landed
  const [pops, setPops] = useState([]); // shaken slips leaping from the hat
  const [tossed, setTossed] = useState(false); // winner slip in flight
  const [cardStage, setCardStage] = useState('none'); // none | fold | open1 | open2

  const hudRef = useRef('wait');
  hudRef.current = hudPhase;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Deterministic roll-call + shake randomness per draw
  const rng = useMemo(() => hatRng((spinKey + 1) * 15485863 + N * 31 + winnerIdx * 11), [spinKey, N, winnerIdx]);
  const rollcall = useMemo(() => {
    const delayStep = Math.min(0.11, 2.2 / Math.max(N, 1));
    return names.map((name, i) => ({
      name,
      sx: (rng() - 0.5) * 340,
      r0: (rng() - 0.5) * 50,
      r1: (rng() - 0.5) * 24,
      delay: 0.35 + i * delayStep
    }));
  }, [names, rng, N]);
  const shakeOrder = useMemo(() => {
    const arr = names.map((n) => n);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }, [names, rng]);

  useEffect(() => {
    setHudPhase('wait');
    setPops([]);
    setTossed(false);
    setCardStage('none');

    let mode = 'wait';
    let cancelled = false;
    let popTimer = null;
    let popCount = 0;
    const timers = [];

    function spawnPop() {
      if (cancelled || mode !== 'boost') return;
      const name = shakeOrder[popCount % shakeOrder.length];
      popCount += 1;
      const id = popCount;
      const pop = {
        id,
        name,
        dx: (rng() - 0.5) * 300,
        peak: -(110 + rng() * 110),
        rot: (rng() - 0.5) * 80,
        dur: 0.6 + rng() * 0.2
      };
      setPops((prev) => [...prev.slice(-14), pop]);
      timers.push(setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, pop.dur * 1000 + 120));
    }

    function beginResolve() {
      if (mode !== 'boost') return;
      mode = 'resolve';
      setHudPhase('resolve');
      if (popTimer) clearInterval(popTimer);
      // one decisive toss
      timers.push(setTimeout(() => { if (!cancelled) setTossed(true); }, 140));
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('fold'); }, 1000));
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('open1'); }, 1120));
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('open2'); }, 1500));
      timers.push(setTimeout(() => {
        if (!cancelled) {
          mode = 'landed';
          setHudPhase('landed');
        }
      }, 1900));
      timers.push(setTimeout(() => {
        if (!cancelled) onCompleteRef.current && onCompleteRef.current();
      }, 3600));
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
      spawnPop();
      popTimer = setInterval(spawnPop, 155);
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
      if (popTimer) clearInterval(popTimer);
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, names.join('|')]);

  const shaking = hudPhase === 'boost';
  const resolveOrLater = hudPhase === 'resolve' || hudPhase === 'landed';
  const cardOpen = cardStage === 'open1' || cardStage === 'open2';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* Ember stage glow while shaking */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 74% at 50% 58%, rgba(224,133,68,0.14) 0%, rgba(201,169,106,0.05) 45%, transparent 74%)',
        opacity: shaking ? 1 : 0,
        transition: 'opacity 0.6s ease',
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
          opacity: hudPhase === 'landed' ? 0 : 0.85,
          transition: 'opacity 0.6s ease'
        }}>
          Names in the hat
        </span>
      </div>

      {/* The hat */}
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: '16vh',
        transform: 'translateX(-50%)',
        width: 'min(38vh, 400px)',
        pointerEvents: 'none'
      }}>
        {/* ground glow */}
        <div aria-hidden style={{
          position: 'absolute',
          left: '50%',
          bottom: -18,
          transform: 'translateX(-50%)',
          width: '130%',
          height: 44,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(201,169,106,0.14) 0%, transparent 70%)'
        }} />

        {/* slips layer — behind the hat so they vanish into the mouth */}
        <div style={{ position: 'absolute', left: '50%', top: '6%', zIndex: 1 }}>
          {/* roll-call: every name visibly enters the hat */}
          {rollcall.map((s, i) =>
          <div
            key={`${spinKey}-rc-${i}`}
            style={{
              position: 'absolute',
              left: -48,
              top: -15,
              '--sx': `${s.sx}px`,
              '--r0': `${s.r0}deg`,
              '--r1': `${s.r1}deg`,
              animation: `hatDropIn 0.95s cubic-bezier(0.45, 0.02, 0.65, 1) ${s.delay}s both`
            }}>
            <HatSlip name={s.name} />
          </div>
          )}
          {/* shaken glimpses */}
          {pops.map((p) =>
          <div
            key={`pop-${p.id}`}
            style={{
              position: 'absolute',
              left: -48,
              top: -15,
              '--dx': `${p.dx}px`,
              '--peak': `${p.peak}px`,
              '--rot': `${p.rot}deg`,
              animation: `hatSlipToss ${p.dur}s cubic-bezier(0.3, 0.1, 0.6, 1) both`
            }}>
            <HatSlip name={p.name} />
          </div>
          )}
        </div>

        {/* hat body */}
        <svg
          viewBox="0 0 260 210"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'block',
            width: '100%',
            filter: 'drop-shadow(0 22px 44px rgba(0,0,0,0.55))',
            transformOrigin: '50% 82%',
            animation: shaking
              ? 'hatShake 0.38s linear infinite'
              : resolveOrLater
              ? 'hatFlick 0.55s ease-out'
              : 'none'
          }}>
          <defs>
            <linearGradient id="apsHatCrown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1E1812" />
              <stop offset="0.55" stopColor="#14100B" />
              <stop offset="1" stopColor="#0F0C08" />
            </linearGradient>
            <linearGradient id="apsHatBand" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8F7440" />
              <stop offset="0.5" stopColor="#C9A96A" />
              <stop offset="1" stopColor="#8F7440" />
            </linearGradient>
            <linearGradient id="apsHatBrim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1B1610" />
              <stop offset="1" stopColor="#100D09" />
            </linearGradient>
          </defs>

          {/* crown */}
          <path
            d="M62 172 C58 122 60 78 66 44 Q130 32 194 44 C200 78 202 122 198 172 Z"
            fill="url(#apsHatCrown)"
            stroke="rgba(244,239,230,0.14)"
            strokeWidth="1"
          />
          {/* mouth */}
          <ellipse cx="130" cy="44" rx="65" ry="13" fill="#070505" stroke="rgba(244,239,230,0.1)" strokeWidth="1" />
          {/* band */}
          <path
            d="M60.5 158 C60 146 60 140 60.6 132 L199.4 132 C200 140 200 146 199.5 158 Z"
            fill="url(#apsHatBand)"
            opacity="0.92"
          />
          {/* brim */}
          <ellipse cx="130" cy="176" rx="126" ry="27" fill="url(#apsHatBrim)" stroke="rgba(244,239,230,0.16)" strokeWidth="1" />
          <ellipse cx="130" cy="172" rx="126" ry="26" fill="url(#apsHatBrim)" stroke="rgba(244,239,230,0.1)" strokeWidth="1" />
        </svg>
      </div>

      {/* Winner slip toss + unfolding card */}
      {tossed && cardStage === 'none' &&
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '30%',
        zIndex: 3,
        transform: 'translateX(-50%)',
        pointerEvents: 'none'
      }}>
        <div style={{ animation: 'hatWinnerToss 0.9s cubic-bezier(0.32, 1.1, 0.5, 1) both' }}>
          <HatSlip name="" style={{ width: 104, height: 34 }} />
        </div>
      </div>
      }

      {cardStage !== 'none' &&
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '30%',
        zIndex: 3,
        transform: 'translateX(-50%) translateY(-50%)',
        pointerEvents: 'none'
      }}>
        <div style={{
          position: 'relative',
          width: 'min(72vw, 620px)',
          minHeight: 'clamp(120px, 22vh, 190px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(1.5rem, 3.5vh, 2.5rem) clamp(1.5rem, 3vw, 2.5rem)',
          background: 'linear-gradient(160deg, #F6EFE0 0%, #EDE2CB 55%, #E3D6B9 100%)',
          borderRadius: 6,
          boxShadow: '0 34px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.6)',
          transformOrigin: '50% 50%',
          transform: `rotate(-1.6deg) scaleY(${cardStage === 'fold' ? 0.26 : 1}) scaleX(${cardStage === 'open2' ? 1 : cardStage === 'open1' ? 0.72 : 0.55})`,
          transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
        }}>
          {/* creases fade as the paper opens */}
          <div aria-hidden style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 1.5,
            background: 'linear-gradient(90deg, transparent, rgba(120,100,60,0.5), transparent)',
            opacity: cardStage === 'open2' ? 0 : 0.9,
            transition: 'opacity 0.5s ease 0.15s'
          }} />
          <div aria-hidden style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 1.5,
            background: 'linear-gradient(180deg, transparent, rgba(120,100,60,0.4), transparent)',
            opacity: cardStage === 'open2' ? 0 : 0.9,
            transition: 'opacity 0.5s ease 0.25s'
          }} />
          <div
            title={names[winnerIdx]}
            style={{
              fontFamily: F.stage,
              fontWeight: 400,
              fontSize: 'clamp(2.2rem, 5.4vw, 4rem)',
              lineHeight: 1.08,
              color: '#221A0E',
              textAlign: 'center',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: cardOpen ? 1 : 0,
              transition: 'opacity 0.45s ease 0.15s'
            }}>
            {names[winnerIdx]}
          </div>
        </div>
      </div>
      }

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
        <KeyboardHint ariaLabel="Release space to draw a name" caption="release to draw" urgent>
          <RetroSpaceKey active />
        </KeyboardHint>
        :
        <KeyboardHint ariaLabel="Press and hold space to shake the hat" caption="hold to shake">
          <RetroSpaceKey />
        </KeyboardHint>
        }
      </div>
      }
    </div>
  );
};

window.HatDraw = HatDraw;
