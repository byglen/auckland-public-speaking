// tophat.jsx — the hat (a bowler).
// The oldest draw ritual there is. Every name is written on a slip and dropped
// in (a roll-call the room can watch). Hold Space to shake the hat — slips leap
// and flash names — release, and one folded slip is tossed out, sits for a
// beat, then unfolds in two real folds to show the winner's name in ink.
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

// ─── FOLDED SHEET ─────────────────────────────────────────────────────────────
// The winner's name is written on a sheet folded in four: left half over right,
// then top half down over bottom. Each quadrant is a window onto the full sheet
// so the name lines up across the creases; each flap has a blank paper back.
// Flaps are real 3D hinges — the top half lifts toward the room first, then the
// left half swings open and the name is uncovered from the right edge inward.
const PAPER_FRONT = 'linear-gradient(160deg, #F6EFE0 0%, #EDE2CB 55%, #E3D6B9 100%)';
const PAPER_BACK = 'linear-gradient(200deg, #E4D9C2 0%, #D9CDB3 100%)';
const FACE = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden'
};

function SheetWindow({ col, row, name, F }) {
  return (
    <div style={{ ...FACE, overflow: 'hidden', background: PAPER_FRONT, boxShadow: 'inset 0 0 0 1px rgba(120,100,60,0.18)' }}>
      <div style={{
        position: 'absolute',
        width: '200%',
        height: '200%',
        left: col ? '-100%' : 0,
        top: row ? '-100%' : 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3%'
      }}>
        <div aria-hidden style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(120,100,60,0.28)' }} />
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(120,100,60,0.28)' }} />
        <div
          title={name}
          style={{
            fontFamily: F.stage,
            fontWeight: 700,
            fontSize: 'clamp(2.2rem, 5.4vw, 4rem)',
            letterSpacing: '0',
            lineHeight: 1.08,
            color: '#221A0E',
            textAlign: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
          {name}
        </div>
      </div>
    </div>
  );
}

function PaperBack({ flip }) {
  return (
    <div style={{
      ...FACE,
      background: PAPER_BACK,
      boxShadow: 'inset 0 0 0 1px rgba(120,100,60,0.25), inset 0 -6px 14px rgba(120,100,60,0.12)',
      transform: flip
    }} />
  );
}

function FoldedSheet({ name, topOpen, leftOpen, F }) {
  const LIFTED = '0 18px 40px rgba(0,0,0,0.5)';
  const FLAT = '0 1px 2px rgba(0,0,0,0.12)';
  const leftFlap = {
    position: 'absolute',
    left: 0,
    width: '50%',
    transformOrigin: '100% 50%',
    transformStyle: 'preserve-3d',
    transform: `translateZ(1px) rotateY(${leftOpen ? 0 : 180}deg)`,
    boxShadow: leftOpen ? FLAT : LIFTED,
    transition: 'transform 1s cubic-bezier(0.7, 0, 0.25, 1), box-shadow 1s ease'
  };
  return (
    <div style={{ perspective: 1400, perspectiveOrigin: '50% 60%' }}>
      <div style={{
        position: 'relative',
        width: 'min(60vw, 540px)',
        height: 'clamp(170px, 27vh, 250px)',
        transformStyle: 'preserve-3d'
      }}>
        {/* soft shadow under the whole sheet once it lies open */}
        <div aria-hidden style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 4,
          boxShadow: '0 34px 80px rgba(0,0,0,0.6)',
          transform: 'translateZ(-2px)',
          opacity: leftOpen ? 1 : 0,
          transition: 'opacity 0.7s ease 0.6s'
        }} />
        {/* bottom-right quadrant — the base everything folds onto */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: '50%', height: '50%', transformStyle: 'preserve-3d', boxShadow: leftOpen ? FLAT : LIFTED, transition: 'box-shadow 1s ease' }}>
          <SheetWindow col={1} row={1} name={name} F={F} />
        </div>

        {/* bottom-left flap, hinged on the centre crease */}
        <div style={{ ...leftFlap, top: '50%', height: '50%' }}>
          <SheetWindow col={0} row={1} name={name} F={F} />
          <PaperBack flip="rotateY(180deg)" />
        </div>

        {/* top half — lifts up around the horizontal crease; carries the top-left flap with it */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '50%',
          transformOrigin: '50% 100%',
          transformStyle: 'preserve-3d',
          transform: `translateZ(2px) rotateX(${topOpen ? 0 : -180}deg)`,
          transition: 'transform 0.72s cubic-bezier(0.45, 0, 0.2, 1)'
        }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, width: '50%', height: '100%', transformStyle: 'preserve-3d', boxShadow: topOpen ? FLAT : LIFTED, transition: 'box-shadow 0.72s ease' }}>
            <SheetWindow col={1} row={0} name={name} F={F} />
          </div>
          {/* the packet's outer face while the top half is still folded down */}
          <div style={{
            ...FACE,
            left: '50%',
            width: '50%',
            background: PAPER_BACK,
            boxShadow: 'inset 0 0 0 1px rgba(120,100,60,0.25)',
            transform: 'rotateX(180deg) translateZ(0.5px)'
          }} />
          <div style={{ ...leftFlap, top: 0, height: '100%' }}>
            <SheetWindow col={0} row={0} name={name} F={F} />
            <PaperBack flip="rotateY(180deg)" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A small count pill: the number in cream, the word in a quiet tone. */
function TallyPill({ value, label }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: '0.42em',
      padding: '0.42rem 0.9rem 0.42rem 0.8rem',
      borderRadius: 999,
      border: '1px solid rgba(205,228,254,0.14)',
      background: 'rgba(205,228,254,0.04)',
      fontFamily: "'Theinhardt', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontSize: '0.88rem',
      fontWeight: 500,
      letterSpacing: '0.01em',
      color: 'rgba(205,228,254,0.58)',
      whiteSpace: 'nowrap'
    }}>
      <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1.08rem', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</span>
      {label}
    </span>
  );
}

const HatDraw = ({ names, winnerIdx, spinKey, onComplete, doneCount = 0 }) => {
  const theme = window.APS_THEME;
  const C = theme.C;
  const F = theme.F;
  const KeyboardHint = window.KeyboardHint;
  const RetroSpaceKey = window.RetroSpaceKey;

  const N = names.length;

  const [hudPhase, setHudPhase] = useState('wait'); // wait | boost | hold | resolve | landed
  const [pops, setPops] = useState([]); // shaken slips leaping from the hat
  const [cardStage, setCardStage] = useState('none'); // none | toss | hold | open1 | open2 | present

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
    setCardStage('none');

    // wait → boost (shaking; a tap runs it for 3s on its own) → hold (space kept
    // down past 500ms: shake until release) → resolve → landed
    let mode = 'wait';
    let cancelled = false;
    let popTimer = null;
    let holdTimer = null;
    let autoTimer = null;
    let downAt = 0;
    let popCount = 0;
    let cursor = 0;
    const inFlight = new Set(); // names currently in the air — one slip per name, never more
    const timers = [];

    function spawnPop() {
      if (cancelled || (mode !== 'boost' && mode !== 'hold')) return;
      // next name in the shuffled order whose slip isn't already airborne;
      // with every name in flight there is simply nothing more to throw
      let name = null;
      for (let i = 0; i < shakeOrder.length; i++) {
        const candidate = shakeOrder[(cursor + i) % shakeOrder.length];
        if (!inFlight.has(candidate)) { name = candidate; cursor = (cursor + i + 1) % shakeOrder.length; break; }
      }
      if (name == null) return;
      inFlight.add(name);
      popCount += 1;
      const id = popCount;
      const pop = {
        id,
        name,
        dx: (rng() - 0.5) * 260,
        peak: -(160 + rng() * 150),
        rot: (rng() - 0.5) * 110,
        dur: 0.85 + rng() * 0.3
      };
      setPops((prev) => [...prev, pop]);
      timers.push(setTimeout(() => {
        inFlight.delete(name);
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, pop.dur * 1000 + 120));
    }

    function startShake() {
      mode = 'boost';
      setHudPhase('boost');
      spawnPop();
      popTimer = setInterval(spawnPop, 150);
    }

    function beginResolve() {
      if (mode !== 'boost' && mode !== 'hold') return;
      mode = 'resolve';
      setHudPhase('resolve');
      if (popTimer) clearInterval(popTimer);
      if (holdTimer) clearTimeout(holdTimer);
      if (autoTimer) clearTimeout(autoTimer);
      // one decisive toss: packet out (0.76s), a held beat, then the two unfolds
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('toss'); }, 140));
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('hold'); }, 900));
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('open1'); }, 1360));
      timers.push(setTimeout(() => { if (!cancelled) setCardStage('open2'); }, 2360));
      // then the sheet grows and squares up (0.8s), holds so the room can read
      // it (5s), and the app moves on to the question flow by itself
      timers.push(setTimeout(() => {
        if (!cancelled) {
          mode = 'present';
          setCardStage('present');
          setHudPhase('landed');
        }
      }, 3440));
      timers.push(setTimeout(finish, 9240));
    }

    let finished = false;
    function finish() {
      if (cancelled || finished) return;
      finished = true;
      mode = 'done';
      onCompleteRef.current && onCompleteRef.current();
    }

    function onKd(e) {
      if (e.code !== 'Space') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) { e.preventDefault(); return; }
      if (mode === 'present') { e.preventDefault(); finish(); return; } // host skips the hold
      if (mode !== 'wait') return;
      e.preventDefault();
      downAt = performance.now();
      startShake();
      // kept down past half a second → the host is driving; shake until release
      holdTimer = setTimeout(() => {
        if (!cancelled && mode === 'boost') {
          mode = 'hold';
          setHudPhase('hold');
        }
      }, 500);
    }
    function onKu(e) {
      if (e.code !== 'Space') return;
      if (mode === 'hold') {
        e.preventDefault();
        beginResolve();
        return;
      }
      if (mode !== 'boost') return;
      e.preventDefault();
      // a tap: let the hat shake itself for three seconds, then draw
      if (holdTimer) clearTimeout(holdTimer);
      if (!autoTimer) {
        autoTimer = setTimeout(() => { if (!cancelled) beginResolve(); }, Math.max(0, 3000 - (performance.now() - downAt)));
      }
    }
    function onHidden() {
      if (document.hidden && (mode === 'boost' || mode === 'hold')) beginResolve();
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
      if (holdTimer) clearTimeout(holdTimer);
      if (autoTimer) clearTimeout(autoTimer);
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, names.join('|')]);

  const shaking = hudPhase === 'boost' || hudPhase === 'hold';
  const resolveOrLater = hudPhase === 'resolve' || hudPhase === 'landed';
  const topOpen = cardStage === 'open1' || cardStage === 'open2' || cardStage === 'present';
  const leftOpen = cardStage === 'open2' || cardStage === 'present';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* Shaking: the room dims to a vignette and an ember glow breathes under the hat */}
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 70% 62% at 50% 58%, transparent 30%, rgba(0,0,0,0.45) 100%)',
        opacity: shaking ? 1 : 0,
        transition: 'opacity 0.7s ease',
        pointerEvents: 'none'
      }} />
      <div aria-hidden style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 72% 66% at 50% 60%, rgba(233,79,46,0.22) 0%, rgba(233,79,46,0.07) 42%, transparent 72%)',
        opacity: shaking ? 1 : 0,
        animation: shaking ? 'hatGlowPulse 1.6s ease-in-out infinite' : 'none',
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none'
      }} />

      {/* Tally — two quiet pills, top right, in step with the Menu pill top left */}
      <div style={{
        position: 'absolute',
        top: 'clamp(0.85rem, 2vh, 1.35rem)',
        right: 'clamp(0.85rem, 2vw, 1.35rem)',
        display: 'flex',
        gap: '0.5rem',
        opacity: hudPhase === 'landed' ? 0 : 1,
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none'
      }}>
        <TallyPill value={N} label="in the hat" />
        {doneCount > 0 && <TallyPill value={doneCount} label="spoken" />}
      </div>

      {/* The hat — a bowler, upside down, resting on its dome with the opening up.
          Drawn in two layers with the slips sandwiched between them: the far
          side of the brim and the dark interior sit behind the slips, the near
          lip of the brim and the crown wall sit in front — so a slip visibly
          drops into the hole and is swallowed by the near wall. */}
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: '26vh',
        transform: `translateX(-50%) scale(${shaking ? 1.03 : cardStage === 'present' ? 0.92 : 1})`,
        opacity: cardStage === 'present' ? 0.28 : 1,
        transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease',
        width: 'min(40vh, 420px)',
        pointerEvents: 'none'
      }}>
        {/* ground shadow under the dome */}
        <div aria-hidden style={{
          position: 'absolute',
          left: '50%',
          bottom: -10,
          transform: 'translateX(-50%)',
          width: '70%',
          height: 34,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)'
        }} />

        <div style={{
          position: 'relative',
          filter: 'drop-shadow(0 22px 34px rgba(0,0,0,0.55))',
          transformOrigin: '50% 30%',
          animation: shaking
            ? 'hatShake 0.36s ease-in-out infinite'
            : resolveOrLater
            ? 'hatFlick 0.55s ease-out'
            : 'none'
        }}>
          <svg aria-hidden viewBox="0 0 260 190" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id="apsBowlerBrim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1B1611" />
                <stop offset="0.55" stopColor="#2A231C" />
                <stop offset="1" stopColor="#3B322A" />
              </linearGradient>
              <radialGradient id="apsBowlerMouth" cx="0.5" cy="0.42" r="0.72">
                <stop offset="0" stopColor="#050403" />
                <stop offset="0.72" stopColor="#0B0907" />
                <stop offset="1" stopColor="#201A14" />
              </radialGradient>
            </defs>
            {/* far side of the brim: edge thickness, then the face */}
            <path d="M30 68 C30 84 76 94 130 94 C184 94 230 84 230 68 C230 58 184 50 130 50 C76 50 30 58 30 68 Z" fill="#0B0908" />
            <path
              d="M30 64 C30 80 76 90 130 90 C184 90 230 80 230 64 C230 54 184 46 130 46 C76 46 30 54 30 64 Z"
              fill="url(#apsBowlerBrim)"
              stroke="rgba(205,228,254,0.22)"
              strokeWidth="1"
            />
            {/* the hole, and the inner wall catching a little light at the back */}
            <ellipse cx="130" cy="64" rx="62" ry="13" fill="url(#apsBowlerMouth)" />
            <ellipse cx="130" cy="66.5" rx="58.5" ry="11" fill="#070605" />
            <path d="M68 64 A62 13 0 0 1 192 64" fill="none" stroke="rgba(205,228,254,0.34)" strokeWidth="1.2" />
          </svg>

          {/* slips layer — anchored inside the crown, so drop-ins are swallowed
              by the near wall and shaken slips leap up through the opening */}
          <div style={{ position: 'absolute', left: '50%', top: '58%', zIndex: 1 }}>
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

          <svg viewBox="0 0 260 190" style={{ position: 'relative', zIndex: 2, display: 'block', width: '100%', overflow: 'visible' }}>
            <defs>
              <radialGradient id="apsBowlerDome" cx="0.36" cy="0.3" r="0.78">
                <stop offset="0" stopColor="#4E4338" />
                <stop offset="0.38" stopColor="#2C251E" />
                <stop offset="0.8" stopColor="#17120E" />
                <stop offset="1" stopColor="#0F0C09" />
              </radialGradient>
              <linearGradient id="apsBowlerBand" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#B8321A" />
                <stop offset="0.32" stopColor="#F05A38" />
                <stop offset="0.52" stopColor="#E94F2E" />
                <stop offset="1" stopColor="#A82C15" />
              </linearGradient>
            </defs>

            {/* the crown — straight-ish sides, soft corners, a flatter top (now underneath) */}
            <path
              d="M68 64 C63 92 61 126 65 146 C69 164 96 171 130 171 C164 171 191 164 195 146 C199 126 197 92 192 64 A62 13 0 0 1 68 64 Z"
              fill="url(#apsBowlerDome)"
              stroke="rgba(205,228,254,0.14)"
              strokeWidth="1"
            />
            {/* thin grosgrain band just under the brim */}
            <path d="M62 92 A68 14 0 0 0 198 92 L198.5 104 A68.5 14 0 0 1 61.5 104 Z" fill="url(#apsBowlerBand)" />
            <path d="M62 92 A68 14 0 0 0 198 92" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            <path d="M176 94 L186 93.2 L186.6 103.4 L176.6 104.2 Z" fill="#B4321B" opacity="0.85" />
            {/* shadow the brim throws onto the dome */}
            <path d="M63 90 A67 14 0 0 0 197 90" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="6" />

            {/* near side of the brim: the lip between the hole and the front edge */}
            <path d="M30 68 C30 84 76 94 130 94 C184 94 230 84 230 68 L192 68 A62 13 0 0 1 68 68 L30 68 Z" fill="#0B0908" />
            <path
              d="M30 64 C30 80 76 90 130 90 C184 90 230 80 230 64 L192 64 A62 13 0 0 1 68 64 L30 64 Z"
              fill="url(#apsBowlerBrim)"
              stroke="rgba(205,228,254,0.22)"
              strokeWidth="1"
            />
            <path d="M52 82 C86 92 174 92 208 82" fill="none" stroke="rgba(205,228,254,0.16)" strokeWidth="2" strokeLinecap="round" />
            <path d="M68 64 A62 13 0 0 0 192 64" fill="none" stroke="rgba(205,228,254,0.34)" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* Winner: a folded packet flies out of the opening, sits for a beat, then
          unfolds in two real folds — top flap up, then the left half swings open
          and the name is there. */}
      {cardStage !== 'none' &&
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '27%',
        zIndex: 3,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }}>
        <div style={{ animation: 'hatWinnerToss 0.76s cubic-bezier(0.3, 1.05, 0.5, 1) both' }}>
          <div style={{
            animation: cardStage === 'hold' ? 'hatPacketFidget 0.55s ease-in-out infinite' : 'none',
            // cancel the toss's resting tilt and grow, so the name sits square and large
            transform: cardStage === 'present' ? 'rotate(2deg) scale(1.42)' : 'none',
            transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)'
          }}>
            <FoldedSheet name={names[winnerIdx]} topOpen={topOpen} leftOpen={leftOpen} F={F} />
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
        opacity: hudPhase === 'wait' || hudPhase === 'boost' || hudPhase === 'hold' ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none'
      }}>
        {hudPhase === 'hold' ?
        <KeyboardHint ariaLabel="Release space to draw a name" caption="release to draw a name" urgent>
          <RetroSpaceKey active />
        </KeyboardHint>
        : hudPhase === 'boost' ?
        <span style={{
          fontFamily: F.ui,
          fontWeight: 700,
          fontSize: 'clamp(1.14rem, 2.16vw, 1.32rem)',
          letterSpacing: '0.32em',
          paddingLeft: '0.32em',
          textTransform: 'uppercase',
          color: C.pulseRedSoft,
          animation: 'pulseBig 0.9s ease-in-out infinite'
        }}>
          Shaking
        </span>
        :
        <KeyboardHint ariaLabel="Hold space to shake the hat" caption="to shake the hat">
          <RetroSpaceKey label="HOLD SPACE" />
        </KeyboardHint>
        }
      </div>
      }
    </div>
  );
};

window.HatDraw = HatDraw;
