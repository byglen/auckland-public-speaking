// screens.jsx — all screen components for Auckland Public Speaking app
const { useState, useEffect, useRef, useCallback } = React;

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: '#0b0b14',
  surface: '#16162a',
  border: '#2a2a48',
  accent: '#2f72f8', // electric blue
  accentD: '#1a58d4',
  gold: '#d4a84b',
  dim: '#5060a0',
  text: '#f0f0f8',
  muted: '#9090c0',
  pulseRed: '#ff4040',
  pulseRedSoft: '#ff7878'
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.floor(Math.abs(secs) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Pick a draw winner; first-timers excluded from draws 1–2 unless no one else is eligible. */
function pickDrawWinner(pool, spokenCount) {
  if (!pool.length) return { winner: null, winnerIdx: -1 };
  let eligible = pool;
  if (spokenCount < 2) {
    const regular = pool.filter((p) => !p.firstTimer);
    if (regular.length > 0) eligible = regular;
  }
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const winnerIdx = pool.findIndex((p) => p.name === pick.name);
  return { winner: pick, winnerIdx };
}

/** Smoothly ramp a numeric display value (e.g. timer fast-forward in demo mode). */
function animateSecs(from, to, durationMs, onFrame, onDone) {
  const start = performance.now();
  let raf;
  const step = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 2.2);
    const v = from + (to - from) * eased;
    onFrame(v);
    if (t < 1) raf = requestAnimationFrame(step);
    else {
      onFrame(to);
      onDone && onDone();
    }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Looping smooth jazz — returns a stop() handle */
function startJazzAlarmLoop() {
  if (typeof startJazzLoop !== 'function') return () => {};
  const jazz = startJazzLoop();
  jazz.ensurePlaying().catch(() => {});
  return () => jazz.stop();
}

/** Swallow mouse / touch / trackpad input — keyboard still works (demo & question select). */
function useBlockPointerInput(active) {
  useEffect(() => {
    if (!active) return undefined;
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const opts = { capture: true, passive: false };
    const events = [
      'mousedown', 'mouseup', 'click', 'dblclick',
      'touchstart', 'touchend', 'touchmove',
      'pointerdown', 'pointerup', 'contextmenu', 'wheel'
    ];
    events.forEach((ev) => document.addEventListener(ev, block, opts));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, block, opts));
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}

// ─── SHARED BUTTON ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = 'primary', size = 'md', disabled }) {
  const base = {
    fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 14, border: 'none', fontWeight: 700,
    letterSpacing: '0.04em', transition: 'opacity 0.15s, transform 0.1s',
    opacity: disabled ? 0.35 : 1
  };
  const sizes = {
    sm: { padding: '0.65rem 1.5rem', fontSize: '1.05rem' },
    md: { padding: '1rem 2.5rem', fontSize: '1.3rem' },
    lg: { padding: '1.4rem 3.5rem', fontSize: '1.6rem' },
    xl: { padding: '1.8rem 5rem', fontSize: '2rem' }
  };
  const variants = {
    primary: { background: C.accent, color: '#fff' },
    gold: { background: C.gold, color: '#0b0b14' },
    outline: { background: 'transparent', color: C.accent, border: `2px solid ${C.accent}` },
    ghost: { background: 'transparent', color: C.dim, border: 'none' },
    surface: { background: C.surface, color: C.muted, border: `1.5px solid ${C.border}` }
  };
  return (
    <button onClick={disabled ? undefined : onClick}
    style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {children}
    </button>);

}

// ─── SHARED BRAND ─────────────────────────────────────────────────────────────
function QuestionOfNightBadge({ large = false }) {
  const s = large ? 2 : 1;

  return (
    <span style={{
      background: `${C.gold}20`,
      border: `${1.5 * s}px solid ${C.gold}55`,
      color: C.gold,
      borderRadius: 100,
      padding: `${0.4 * s}rem ${1.25 * s}rem`,
      fontSize: `${1 * s}rem`,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: `${0.45 * s}rem`
    }}>
      <span style={{ fontSize: `${1.05 * s}rem`, lineHeight: 1 }} aria-hidden>★</span>
      Question of the Night
    </span>
  );
}

function FeedbackBadge({ large = false }) {
  const s = large ? 2 : 1;
  const blue = '#4a78d8';

  return (
    <span style={{
      background: `${blue}22`,
      border: `${1.5 * s}px solid ${blue}66`,
      color: blue,
      borderRadius: 100,
      padding: `${0.4 * s}rem ${1.25 * s}rem`,
      fontSize: `${1 * s}rem`,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center'
    }}>
      Feedback
    </span>
  );
}

function QuestionDisplayText({ children, style = {} }) {
  return (
    <div style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      color: C.text,
      textWrap: 'pretty',
      fontFamily: 'Outfit',
      fontWeight: 700,
      letterSpacing: '-0.1px',
      fontSize: 'clamp(3rem, 6.2vw, 7rem)',
      lineHeight: 1.1,
      ...style
    }}>
      <span style={{ maxWidth: 1500 }}>{children}</span>
    </div>
  );
}

function HomeSubduedButton({ children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        background: `${C.surface}cc`,
        border: `1px solid ${C.border}`,
        color: C.muted,
        padding: '0.5rem 0.95rem',
        borderRadius: 9,
        cursor: 'pointer',
        fontSize: '0.98rem',
        fontWeight: 600,
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
        opacity: 0.88
      }}>
      {children}
    </button>
  );
}

function HomeIconButton({ ariaLabel, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        background: `${C.surface}cc`,
        border: `1px solid ${C.border}`,
        color: C.muted,
        padding: '0.48rem 0.58rem',
        borderRadius: 9,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.88,
        lineHeight: 0
      }}>
      {children}
    </button>
  );
}

function QrCodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path fill="currentColor" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm11 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v4h-2v-4zm-4 4h2v2h2v-2h-2z" />
    </svg>
  );
}

function HomeBrandMark() {
  const brandBlue = '#4A76D4';

  return (
    <div
      aria-label="Auckland Public Speaking"
      style={{
        width: 'fit-content',
        background: '#141422',
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        padding: '1.02rem 1.74rem',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        lineHeight: 1.08
      }}>
      <div style={{
        fontSize: 'clamp(1.32rem, 1.68vw + 0.42rem, 1.62rem)',
        fontWeight: 400,
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: '-0.015em'
      }}>
        Auckland
      </div>
      <div style={{
        fontSize: 'clamp(1.32rem, 1.68vw + 0.42rem, 1.62rem)',
        fontWeight: 800,
        color: brandBlue,
        letterSpacing: '-0.015em',
        marginTop: '0.12em'
      }}>
        Public Speaking
      </div>
    </div>
  );
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function SetupScreen({ onComplete }) {
  const [q, setQ] = useState('');
  const taRef = useRef(null);
  const canSubmit = !!q.trim();

  useEffect(() => { taRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Enter' || e.shiftKey || !canSubmit) return;
      e.preventDefault();
      onComplete(q.trim());
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [q, canSubmit, onComplete]);

  const pickRandom = () => {
    const pool = QUESTIONS.filter((x) => x !== q);
    setQ(pool[Math.floor(Math.random() * pool.length)]);
    taRef.current?.focus();
  };

  return (
    <div style={{
      background: `radial-gradient(ellipse 125% 95% at 50% 22%, rgba(212,168,75,0.11) 0%, rgba(212,168,75,0.04) 40%, ${C.bg} 76%)`,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1.5rem 3rem',
        borderBottom: `1px solid ${C.border}`
      }}>
        <HomeBrandMark />
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vh, 4rem) clamp(1.5rem, 5vw, 3rem)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(1.5rem, 3vh, 2.25rem)'
        }}>
          <QuestionOfNightBadge />

          <div style={{ textAlign: 'center', maxWidth: 520 }}>
            <h1 style={{
              color: C.text,
              fontSize: 'clamp(2rem, 3.5vw + 0.75rem, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: 0
            }}>
              Set tonight&apos;s question
            </h1>
            <p style={{
              color: C.muted,
              fontSize: 'clamp(1rem, 1.1vw + 0.35rem, 1.15rem)',
              marginTop: '0.75rem',
              lineHeight: 1.55,
              marginBottom: 0
            }}>
              This appears on the home screen and is offered first when speakers choose.
            </p>
          </div>

          <div style={{
            width: '100%',
            background: C.surface,
            border: `1.5px solid ${canSubmit ? `${C.gold}50` : C.border}`,
            borderRadius: 18,
            transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
            boxShadow: canSubmit ? `0 0 36px ${C.gold}10` : 'none'
          }}>
            <textarea
              ref={taRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type your question here…"
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'transparent',
                border: 'none',
                borderRadius: 18,
                padding: 'clamp(1.25rem, 2.5vw, 1.75rem) clamp(1.25rem, 2.5vw, 1.75rem)',
                color: C.text,
                fontSize: 'clamp(1.2rem, 1.4vw + 0.45rem, 1.45rem)',
                fontFamily: 'inherit',
                fontWeight: 500,
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.5,
                minHeight: '7.5rem'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: '0.85rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            paddingTop: '0.25rem'
          }}>
            <Btn variant="surface" size="md" onClick={pickRandom}>
              Pick random
            </Btn>
            <Btn
              variant="gold"
              size="md"
              disabled={!canSubmit}
              onClick={() => canSubmit && onComplete(q.trim())}
            >
              Continue
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MANAGE SPEAKERS MODAL ────────────────────────────────────────────────────
function ManageSpeakersModal({ participants, onClose, onAdd, onRemove, onSetDone, onSetFirstTimer, onResetAll }) {
  const [newName, setNewName] = useState('');
  const inputRef = useRef(null);
  const pending = participants.filter((p) => !p.done);
  const done = participants.filter((p) => p.done);

  useEffect(() => {
    inputRef.current?.focus();
    const h = (e) => { if (e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const submitAdd = () => {
    const t = newName.trim();
    if (!t) return;
    onAdd(t);
    setNewName('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,4,12,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem'
      }}
      onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Manage speakers"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(85vh, 720px)',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
        <div style={{
          padding: '1.35rem 1.5rem',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ color: C.text, fontSize: '1.35rem', fontWeight: 800 }}>Manage Speakers</div>
            <div style={{ color: C.dim, fontSize: '0.92rem', marginTop: '0.25rem' }}>
              {pending.length} in draw · {done.length} spoken
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', color: C.dim,
              fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem'
            }}>
            ×
          </button>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: '0.5rem' }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
            placeholder="Add a speaker…"
            style={{
              flex: 1, background: C.bg, border: `1.5px solid ${C.border}`,
              borderRadius: 10, padding: '0.65rem 1rem',
              color: C.text, fontSize: '1.05rem', fontFamily: 'inherit', outline: 'none'
            }}
          />
          <Btn variant="primary" size="sm" onClick={submitAdd}>Add</Btn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
          {participants.length === 0 &&
          <div style={{ color: C.dim, textAlign: 'center', padding: '2.5rem 1.5rem', fontSize: '1.05rem' }}>
            No speakers yet — add one above.
          </div>
          }
          {participants.map((p) =>
          <div
            key={p.name}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.65rem 1.5rem',
              borderBottom: `1px solid ${C.border}40`
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: p.done ? C.dim : C.text,
                fontSize: '1.1rem',
                fontWeight: 600,
                textDecoration: p.done ? 'line-through' : 'none'
              }}>
                {p.name}
              </div>
              <div style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '0.15rem',
                color: p.done ? `${C.dim}cc` : p.firstTimer ? C.gold : C.accent
              }}>
                {p.done ? 'Spoken' : p.firstTimer ? 'First timer · In draw' : 'In draw'}
              </div>
            </div>
            {!p.done &&
            <Btn
              variant={p.firstTimer ? 'outline' : 'surface'}
              size="sm"
              onClick={() => onSetFirstTimer(p.name, !p.firstTimer)}>
              {p.firstTimer ? 'Unmark' : 'First timer'}
            </Btn>
            }
            <Btn
              variant="surface"
              size="sm"
              onClick={() => onSetDone(p.name, !p.done)}>
              {p.done ? 'Undo' : 'Mark done'}
            </Btn>
            <button
              type="button"
              aria-label={`Remove ${p.name}`}
              onClick={() => onRemove(p.name)}
              style={{
                background: 'none', border: 'none', color: C.dim,
                fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem 0.4rem',
                lineHeight: 1
              }}>
              ×
            </button>
          </div>
          )}
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem'
        }}>
          <Btn
            variant="outline"
            size="sm"
            disabled={done.length === 0}
            onClick={() => {
              if (done.length === 0) return;
              if (window.confirm(`Mark all ${done.length} speaker${done.length === 1 ? '' : 's'} as not done?`)) {
                onResetAll();
              }
            }}>
            Mark all as not done
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ questionOfNight, participants, firstTimerPulseName, onRegister, onDraw, onEditQuestion, onShowQR, onToggleDemo, demoMode, onAddParticipant, onRemoveParticipant, onSetParticipantDone, onSetParticipantFirstTimer, onResetSpeakers, reopenManage, onReopenManageConsumed }) {
  const [showManage, setShowManage] = useState(false);
  const remaining = participants.filter((p) => !p.done);
  const total = participants.length;
  const done = participants.filter((p) => p.done).length;

  useEffect(() => {
    if (!reopenManage) return;
    setShowManage(true);
    onReopenManageConsumed && onReopenManageConsumed();
  }, [reopenManage, onReopenManageConsumed]);

  // ⌘D — toggle demo mode (sample speakers + accelerated speech timers)
  useEffect(() => {
    if (!onToggleDemo || showManage) return;
    const h = (e) => {
      if (!e.metaKey || e.code !== 'KeyD') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      onToggleDemo();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onToggleDemo, showManage]);

  // Block Space → draw while manage modal is open
  useEffect(() => {
    if (!showManage) return;
    const h = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [showManage]);

  // Listen for any letter key press → launch register screen with that char
  useEffect(() => {
    if (showManage) return;
    const h = (e) => {
      // Skip if modifier keys held, or if user is typing in an input already
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Only single printable characters (letters/numbers/space chars are 1 char keys, but we exclude Space)
      if (e.key.length === 1 && /[a-zA-Z0-9'\-]/.test(e.key)) {
        e.preventDefault();
        onRegister(e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRegister, showManage]);

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {showManage &&
      <ManageSpeakersModal
        participants={participants}
        onClose={() => setShowManage(false)}
        onAdd={(name) => onAddParticipant(name, 'manage')}
        onRemove={onRemoveParticipant}
        onSetDone={onSetParticipantDone}
        onSetFirstTimer={onSetParticipantFirstTimer}
        onResetAll={onResetSpeakers}
      />
      }

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 3rem', borderBottom: `1px solid ${C.border}` }}>
        <HomeBrandMark />
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          {demoMode &&
          <span style={{
            color: C.gold,
            fontSize: '0.95rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            padding: '0.38rem 0.8rem',
            borderRadius: 9,
            border: `1px solid ${C.gold}55`,
            background: `${C.gold}12`
          }}>
            Demo · ⌘D to exit
          </span>
          }
          <HomeSubduedButton ariaLabel="Manage speakers" onClick={() => setShowManage(true)}>
            Speakers
          </HomeSubduedButton>
          <HomeIconButton ariaLabel="WhatsApp QR code" onClick={onShowQR}>
            <QrCodeIcon />
          </HomeIconButton>

        </div>
      </div>

      {/* Centre — wider gutters + scaled type so long questions wrap comfortably */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem clamp(1rem, 3.25vw, 2rem)',
        textAlign: 'center',
        minHeight: 0
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <QuestionOfNightBadge large />
        </div>
        <QuestionDisplayText style={{ margin: '0 auto 4rem', padding: '0 3rem' }}>
          {questionOfNight}
        </QuestionDisplayText>

        {total === 0 &&
        <div style={{ color: C.muted, fontSize: '1.6rem' }}></div>
        }
        {total > 0 && remaining.length === 0 &&
        <div style={{ color: C.gold, fontSize: '2.8rem', fontWeight: 800 }}>All speakers done — great night!</div>
        }
      </div>

      {/* Speaker chips */}
      {total > 0 &&
      <div style={{ padding: '1.25rem 3rem', borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: '0.65rem', justifyContent: 'center' }}>
          {participants.map((p) => {
            const pulsing = firstTimerPulseName === p.name;
            const showFt = p.firstTimer && !p.done;
            return (
        <span key={p.name} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.4rem 1.1rem',
          borderRadius: 100,
          background: pulsing
            ? `${C.gold}30`
            : showFt
            ? `${C.gold}14`
            : p.done ? `${C.dim}20` : `${C.accent}18`,
          border: pulsing || showFt ? `1px solid ${C.gold}44` : '1px solid transparent',
          color: p.done ? C.dim : showFt ? C.gold : C.muted,
          fontSize: '1rem',
          fontWeight: showFt ? 600 : 400,
          textDecoration: p.done ? 'line-through' : 'none',
          animation: pulsing ? 'firstTimerChipPulse 1s ease-out' : undefined
        }}>
              {p.name}
              {showFt &&
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                padding: '0.14rem 0.36rem',
                borderRadius: 4,
                background: `${C.gold}22`,
                border: `1px solid ${C.gold}50`,
                color: C.gold,
                lineHeight: 1
              }}>
                FT
              </span>
              }
            </span>
            );
          })}
        </div>
      }
    </div>);

}

// ─── REGISTRATION SCREEN ──────────────────────────────────────────────────────
function RegistrationScreen({ initialChar = '', onAdd, onDone }) {
  const [name, setName] = useState(initialChar);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const el = inputRef.current;
    if (el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);

  const submit = () => {
    const t = name.trim();
    if (!t) {
      onDone();
      return;
    }
    onAdd(t);
    onDone();
  };

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 6rem', gap: '3rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: C.dim, fontSize: '1.2rem', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '1rem' }}>Add Your Name</div>
        <p style={{ color: C.muted, fontSize: '1.6rem', marginTop: '0.5rem' }}>Type your name, then press <span style={{ color: C.text, fontWeight: 700 }}>Enter</span></p>
      </div>

      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { onDone(); }
        }}
        placeholder="Your name…"
        style={{
          width: '90%',
          maxWidth: 1500,
          background: 'transparent',
          border: 'none',
          borderBottom: `4px solid ${C.accent}`,
          padding: '1.5rem 1rem',
          color: C.text,
          fontSize: 'clamp(5rem, 11vw, 11rem)',
          fontFamily: 'inherit',
          fontWeight: 800,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          outline: 'none',
          caretColor: C.accent
        }} />

      <div style={{ color: C.dim, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Press Esc to cancel
      </div>
    </div>);
}

// ─── QR CODE SCREEN ───────────────────────────────────────────────────────────
function QRScreen({ onBack }) {
  useEffect(() => {
    const h = (e) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onBack]);

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', position: 'relative' }}>
      <div style={{ color: '#25D366', fontSize: '1.4rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1.5rem' }}>
        Join our WhatsApp
      </div>
      <h1 style={{ color: C.text, fontSize: '4rem', fontWeight: 900, margin: 0, marginBottom: '3rem', letterSpacing: '-0.02em', textAlign: 'center' }}>
        Scan to join the group
      </h1>

      <div style={{ background: '#fff', padding: '2.5rem', borderRadius: 28, boxShadow: '0 30px 80px rgba(0,0,0,0.4)' }}>
        <img src="whatsapp-qr.png" alt="WhatsApp group QR code" style={{ display: 'block', width: 520, height: 520, imageRendering: 'pixelated' }} />
      </div>

      <p style={{ color: C.muted, fontSize: '1.5rem', marginTop: '2.5rem', marginBottom: '2rem' }}>
        Open your camera and point it at the code
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
        <Btn variant="surface" size="md" onClick={onBack}>← Back to Home</Btn>
        <span style={{ color: C.dim, fontSize: '0.95rem' }}>Esc / Space / Enter to return</span>
      </div>
    </div>);
}

// ─── RETRO KEY HINTS (shared skeuomorphic keyboard UI) ───────────────────────
const RETRO_KEY_FACE = {
  background: 'linear-gradient(180deg, #eceef4 0%, #d4d8e4 38%, #b8becf 100%)',
  border: '1px solid #949eb4',
  boxShadow: '0 3px 0 #707888, inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -1px 0 rgba(0,0,0,0.08)',
  color: '#2c3344'
};

function RetroSpaceKey({ active = false }) {
  const activeStyle = active ? {
    background: 'linear-gradient(180deg, #ffe8e8 0%, #ffc8c8 38%, #e8a0a0 100%)',
    border: '1px solid #d87878',
    boxShadow: '0 1px 0 #a85858, inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -1px 0 rgba(0,0,0,0.08), 0 0 24px rgba(255,64,64,0.28)',
    color: '#4a1820',
    transform: 'translateY(2px)'
  } : {};
  return (
    <div
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 'clamp(185px, 32.5vw, 285px)',
        height: 'clamp(48px, 6.5vh, 63px)',
        padding: '0 1.5rem',
        borderRadius: 8,
        fontSize: 'clamp(1.1rem, 2.1vw, 1.31rem)',
        fontWeight: 800,
        letterSpacing: '0.22em',
        ...RETRO_KEY_FACE,
        ...activeStyle
      }}>
      SPACE
    </div>
  );
}

function RetroArrowKeys() {
  const square = {
    width: 'clamp(46px, 8vw, 58px)',
    height: 'clamp(46px, 8vw, 58px)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    fontSize: 'clamp(1.15rem, 2.2vw, 1.45rem)',
    fontWeight: 800,
    lineHeight: 1,
    ...RETRO_KEY_FACE
  };
  return (
    <div aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(5px, 1vw, 8px)' }}>
      <div style={square}>←</div>
      <div style={square}>→</div>
    </div>
  );
}

function KeyboardHint({ ariaLabel, caption, children, align = 'center', style, urgent = false }) {
  return (
    <div
      role="status"
      aria-label={ariaLabel || caption}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
        gap: '0.65rem',
        animation: 'pulseBig 2.8s ease-in-out infinite',
        opacity: 0.94,
        ...style
      }}>
      {children}
      {caption &&
      <span style={{
        fontSize: 'clamp(0.95rem, 1.55vw, 1.12rem)',
        fontWeight: 500,
        color: urgent ? C.pulseRedSoft : C.text,
        letterSpacing: '0.02em',
        textAlign: align === 'right' ? 'right' : align === 'left' ? 'left' : 'center'
      }}>
        {caption}
      </span>
      }
    </div>
  );
}

// ─── DRAW ADMIN MENU (top-left) ───────────────────────────────────────────────
function DrawingAdminMenu({ onBackHome, showRespin, onRespin }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: 'clamp(0.85rem, 2vh, 1.35rem)',
        left: 'clamp(0.85rem, 2vw, 1.35rem)',
        zIndex: 60
      }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            background: `${C.surface}cc`,
            border: `1px solid ${C.border}`,
            color: C.muted,
            padding: '0.35rem 0.65rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: 600,
            fontFamily: 'inherit',
            letterSpacing: '0.04em',
            opacity: 0.82
          }}>
          ☰ Menu
        </button>

        {open &&
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 6,
          minWidth: 180,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '0.35rem 0',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)'
        }}>
          {showRespin &&
          <button
            type="button"
            onClick={() => { setOpen(false); onRespin(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontFamily: 'inherit', fontSize: '0.95rem',
              fontWeight: 600, padding: '0.6rem 1rem'
            }}>
            Respin
          </button>
          }
          <button
            type="button"
            onClick={() => { setOpen(false); onBackHome(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.text, fontFamily: 'inherit', fontSize: '0.95rem',
              fontWeight: 600, padding: '0.6rem 1rem'
            }}>
            ← Back to home
          </button>
        </div>
        }
      </div>
    </div>
  );
}

// ─── NEXT SPEAKER CELEBRATION ───────────────────────────────────────────────
const REVEAL_EMOJIS = ['👏', '🙌', '🎉', '✨', '⭐', '💫', '🎊', '👏'];

function seededRevealParticles(seed, count) {
  let s = seed * 9973 + 1;
  const rnd = () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: REVEAL_EMOJIS[i % REVEAL_EMOJIS.length],
    left: `${rnd() * 100}%`,
    bottom: `${-8 + rnd() * 28}%`,
    size: `${1.5 + rnd() * 2.6}rem`,
    delay: `${rnd() * 2.6}s`,
    duration: `${2.6 + rnd() * 3.4}s`,
    variant: i % 3
  }));
}

function SpeakerRevealCelebration({ seed = 0 }) {
  const particles = React.useMemo(() => seededRevealParticles(seed, 34), [seed]);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <div style={{
        position: 'absolute',
        inset: '-25%',
        background: 'radial-gradient(circle at 50% 42%, rgba(212,168,75,0.24) 0%, rgba(255,120,60,0.06) 38%, transparent 62%)',
        animation: 'revealGlowPulse 3.2s ease-in-out infinite'
      }} />
      {particles.map((p) =>
      <div
        key={p.id}
        style={{
          position: 'absolute',
          left: p.left,
          bottom: p.bottom,
          fontSize: p.size,
          lineHeight: 1,
          animation: `applauseDrift${p.variant} ${p.duration} ease-in-out ${p.delay} infinite`,
          filter: 'drop-shadow(0 2px 10px rgba(212,168,75,0.4))',
          willChange: 'transform, opacity'
        }}>
          {p.emoji}
        </div>
      )}
    </div>
  );
}

// ─── SPEAKER ADDED CONFIRMATION ───────────────────────────────────────────────
const SPEAKER_ADDED_HOLD_MS = 2800;

function SpeakerAddedBeat({ name, added, continueAdding = false, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone({ continueAdding: false }), SPEAKER_ADDED_HOLD_MS);
    return () => clearTimeout(t);
  }, [name, onDone]);

  // Enter — skip confirmation and return to add next name
  useEffect(() => {
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 300);
    const h = (e) => {
      if (!armed || e.code !== 'Enter') return;
      e.preventDefault();
      onDone({ continueAdding: true });
    };
    window.addEventListener('keydown', h);
    return () => {
      clearTimeout(arm);
      window.removeEventListener('keydown', h);
    };
  }, [onDone]);

  return (
    <div style={{
      background: C.bg,
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: C.gold,
          fontSize: 'clamp(1rem, 1.6vw + 0.4rem, 1.35rem)',
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 'clamp(1.25rem, 3vh, 2rem)',
          animation: 'fadeSlide 0.55s ease both',
          opacity: 0.92
        }}>
          {added ? "You're on the list" : 'Already registered'}
        </div>
        <div style={{
          fontSize: 'clamp(4rem, 10vw, 9rem)',
          fontWeight: 900,
          color: C.gold,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          animation: 'fadeSlide 0.55s ease 0.1s both',
          filter: 'drop-shadow(0 4px 20px rgba(212,168,75,0.2))'
        }}>
          {name}
        </div>
        <div style={{
          marginTop: 'clamp(1.25rem, 3vh, 2rem)',
          fontSize: 'clamp(1.5rem, 2.8vw + 0.5rem, 2.25rem)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          background: added
            ? `linear-gradient(105deg, #ffe8a8 0%, ${C.gold} 38%, #fff4d0 52%, ${C.gold} 68%, #c8922e 100%)`
            : `linear-gradient(105deg, #c8d0e8 0%, ${C.muted} 45%, #e8ecf8 55%, ${C.muted} 100%)`,
          backgroundSize: '220% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          textTransform: 'lowercase',
          animation: 'revealQuoteIn 0.75s ease 0.55s both, revealShimmer 4.5s linear 1.3s infinite',
          filter: added ? 'drop-shadow(0 3px 20px rgba(212,168,75,0.28))' : 'none'
        }}>
          {added ? 'added.' : 'welcome back.'}
        </div>
        {continueAdding &&
        <p style={{
          marginTop: 'clamp(2rem, 4vh, 2.75rem)',
          color: C.dim,
          fontSize: '0.95rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 600,
          animation: 'fadeSlide 0.55s ease 0.85s both',
          opacity: 0.85
        }}>
          Enter — add another
        </p>
        }
      </div>
    </div>
  );
}

// ─── DRAWING SCREEN ───────────────────────────────────────────────────────────
function DrawingScreen({ participants, onComplete, onBackHome, pickRevealQuoteForSession, demoMode = false }) {
  const [phase, setPhase] = useState('ready');
  const [winner, setWinner] = useState(null);
  const [nameKey, setNameKey] = useState(0);
  const [revealQuote, setRevealQuote] = useState(REVEAL_QUOTES[0]);

  const remaining = participants.filter((p) => !p.done);

  // Lock the participant pool for the spin so React state changes don't reshuffle the wheel mid-animation
  const [spinPool, setSpinPool] = useState([]);
  const [spinWinnerIdx, setSpinWinnerIdx] = useState(-1);
  const [spinKey, setSpinKey] = useState(0);

  const [spinFocusName, setSpinFocusName] = useState('');
  const [spinFocusKey, setSpinFocusKey] = useState(0);
  const spinPointerLastRef = useRef(null);

  /** True once user has released Space after a boost — gates name readout vs hold hint */
  const [spinPastBoost, setSpinPastBoost] = useState(false);
  const spinWasBoostingRef = useRef(false);

  const [spinSpaceHeld, setSpinSpaceHeld] = useState(false);
  const spinSpaceHeldRef = useRef(false);

  useEffect(() => {
    if (phase !== 'spinning') setSpinSpaceHeld(false);
    if (phase !== 'spinning') {
      setSpinPastBoost(false);
      spinWasBoostingRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    spinSpaceHeldRef.current = spinSpaceHeld;
  }, [spinSpaceHeld]);

  const onSpinBoostChange = useCallback((held) => {
    const h = !!held;
    spinSpaceHeldRef.current = h;
    if (spinWasBoostingRef.current && !h) setSpinPastBoost(true);
    spinWasBoostingRef.current = h;
    setSpinSpaceHeld(h);
  }, []);

  const onWheelPointerName = useCallback((name) => {
    if (name == null || name === '') return;
    if (spinSpaceHeldRef.current) return;
    if (spinPointerLastRef.current === name) return;
    spinPointerLastRef.current = name;
    setSpinFocusName(name);
    setSpinFocusKey((k) => k + 1);
  }, []);

  const launchSpinFromPool = useCallback((pool, spokenCount) => {
    if (pool.length === 0) return;
    const { winner: w, winnerIdx } = pickDrawWinner(pool, spokenCount);
    if (winnerIdx < 0 || !w) return;
    setSpinPool(pool);
    setSpinWinnerIdx(winnerIdx);
    setSpinKey((k) => k + 1);
    setWinner(w);
    setPhase('spinning');
    setSpinFocusName('');
    setSpinPastBoost(false);
    spinWasBoostingRef.current = false;
    spinPointerLastRef.current = null;
  }, []);

  const startDraw = useCallback(() => {
    if (phase !== 'ready' || remaining.length === 0) return;
    const spokenCount = participants.filter((p) => p.done).length;
    // One person left — skip wheel, go straight to Next Speaker reveal
    if (remaining.length === 1) {
      const { winner: w } = pickDrawWinner(remaining, spokenCount);
      if (!w) return;
      setWinner(w);
      setRevealQuote(pickRevealQuoteForSession());
      setNameKey((k) => k + 1);
      setPhase('reveal');
      return;
    }
    launchSpinFromPool([...remaining], spokenCount);
  }, [phase, remaining, participants, launchSpinFromPool, pickRevealQuoteForSession]);

  /** Same pool as Draw — nobody is marked done until they browse questions */
  const respinFromReveal = useCallback(() => {
    if (phase !== 'reveal' || remaining.length === 0) return;
    const spokenCount = participants.filter((p) => p.done).length;
    launchSpinFromPool([...remaining], spokenCount);
  }, [phase, remaining, participants, launchSpinFromPool]);

  const onSpinComplete = useCallback(() => {
    setRevealQuote(pickRevealQuoteForSession());
    setNameKey((k) => k + 1);
    setPhase('reveal');
  }, [pickRevealQuoteForSession]);

  /** Demo only — Return skips spin and jumps straight to a random reveal */
  const skipSpinToReveal = useCallback(() => {
    if (!demoMode || phase !== 'spinning' || spinPool.length === 0) return;
    const spokenCount = participants.filter((p) => p.done).length;
    const { winner: w } = pickDrawWinner(spinPool, spokenCount);
    if (!w) return;
    setWinner(w);
    setRevealQuote(pickRevealQuoteForSession());
    setNameKey((k) => k + 1);
    setPhase('reveal');
    setSpinSpaceHeld(false);
    spinWasBoostingRef.current = false;
    setSpinPastBoost(false);
  }, [demoMode, phase, spinPool, participants, pickRevealQuoteForSession]);

  // Skip pre-draw screen — go straight to spin (or reveal if one left)
  useEffect(() => {
    if (remaining.length === 0) return;
    startDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Space on reveal → question picker
  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      if (phase === 'reveal' && winner) onComplete({ name: winner.name });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, winner, onComplete]);

  // Demo mode — Return during spin skips to random reveal
  useEffect(() => {
    if (!demoMode || phase !== 'spinning') return;
    const h = (e) => {
      if (e.code !== 'Enter') return;
      e.preventDefault();
      skipSpinToReveal();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [demoMode, phase, skipSpinToReveal]);

  const adminMenu = (
    <DrawingAdminMenu
      onBackHome={onBackHome}
      showRespin={phase === 'reveal' && remaining.length > 1}
      onRespin={respinFromReveal}
    />
  );

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: phase === 'reveal'
        ? `radial-gradient(ellipse 105% 95% at 50% 44%, rgba(212,168,75,0.2) 0%, rgba(212,168,75,0.07) 38%, ${C.bg} 76%)`
        : spinSpaceHeld
        ? `radial-gradient(ellipse 92% 88% at 50% 38%, rgba(255,64,64,0.22) 0%, #150508 42%, ${C.bg} 88%)`
        : C.bg,
      boxShadow: phase === 'reveal'
        ? 'inset 0 0 120px rgba(212,168,75,0.1)'
        : spinSpaceHeld ? 'inset 0 0 140px rgba(255,64,64,0.12)' : 'none',
      transition: 'background 0.55s ease, box-shadow 0.55s ease'
    }}>

      {phase === 'spinning' && spinSpaceHeld &&
      <div
        aria-hidden
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: 'radial-gradient(circle at 50% -10%, rgba(255,64,64,0.18) 0%, transparent 48%)',
          animation: 'spinHoldPulse 2.4s ease-in-out infinite',
          opacity: 0.9
        }}
      />
      }

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {(phase === 'spinning' || phase === 'reveal') && adminMenu}
      {/* Decorative rings (visible on Next Speaker) */}
      {phase === 'reveal' &&
      <>
        <div style={{ position: 'absolute', width: 800, height: 800, borderRadius: '50%', border: `1px solid ${C.gold}28`, pointerEvents: 'none', animation: 'revealRingPulse 3s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', border: `1px solid ${C.gold}38`, pointerEvents: 'none', animation: 'revealRingPulse 3s ease-in-out 0.45s infinite' }} />
      </>
      }

      {/* ── SPINNING ── */}
      {phase === 'spinning' && spinPool.length > 0 && spinWinnerIdx >= 0 &&
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        flex: 1,
        minHeight: 0,
        padding: 'clamp(0.35rem, 1.5vh, 1rem)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'start',
          width: '100%',
          overflow: 'visible'
        }}>
          <div aria-hidden />
          <div style={{
            flexShrink: 0,
            width: 'min(94vw, min(84vh, 1020px))',
            transition:
              'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), filter 0.38s cubic-bezier(0.25, 0.46, 0.45, 1)',
            transform: spinSpaceHeld ? 'scale(1.035)' : 'scale(1)',
            filter: spinSpaceHeld
              ? 'saturate(1.1) brightness(1.04) drop-shadow(0 0 28px rgba(255,180,115,0.38)) drop-shadow(0 0 64px rgba(70,155,255,0.4)) drop-shadow(0 0 20px rgba(255,64,64,0.2))'
              : 'none'
          }}>
            {window.SpinWheel && React.createElement(window.SpinWheel, {
              names: spinPool.map((p) => p.name),
              winnerIdx: spinWinnerIdx,
              spinKey: spinKey,
              remainingCount: remaining.length,
              onComplete: onSpinComplete,
              onPointerNameChange: onWheelPointerName,
              onSpaceBoostChange: onSpinBoostChange
            })}
          </div>

          <div style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'flex-start',
            paddingLeft: 'clamp(1rem, 2.5vw, 2.75rem)',
            width: 'clamp(200px, 22vw, 320px)',
            minHeight: spinPastBoost ? 'clamp(3rem, 6.2vw, 7rem)' : undefined,
            pointerEvents: 'none',
            zIndex: 50,
            overflow: 'visible'
          }}>
            {spinSpaceHeld ?
            <KeyboardHint
              ariaLabel="Release space to stop"
              caption="release to stop"
              align="center"
              urgent
            >
              <RetroSpaceKey active />
            </KeyboardHint>
            : spinPastBoost && spinFocusName ?
            <div
              key={spinFocusKey}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: 'translateX(-100%)',
                paddingRight: 'clamp(1rem, 2.5vw, 2.75rem)',
                fontFamily: 'Outfit',
                fontSize: 'clamp(2.25rem, 4.5vw, 5rem)',
                fontWeight: 700,
                color: C.gold,
                lineHeight: 1.1,
                letterSpacing: '-0.1px',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                textShadow: '0 4px 32px rgba(0,0,0,0.55), 0 0 56px rgba(212,168,75,0.22)',
                animation: 'spinNameSwap 0.1s cubic-bezier(0.22, 1, 0.36, 1) both',
                willChange: 'transform, opacity'
              }}>
              {spinFocusName}
            </div>
            : spinPastBoost ?
            null
            :
            <KeyboardHint
              ariaLabel="Press and hold space to spin"
              caption="Press and hold"
              align="center"
            >
              <RetroSpaceKey />
            </KeyboardHint>
            }
          </div>
        </div>
      </div>
      }

      {/* ── REVEAL (Next Speaker) — Space / Enter or button → question picker */}
      {phase === 'reveal' && winner &&
      <>
        <SpeakerRevealCelebration seed={nameKey} />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{
          color: C.gold,
          fontSize: 'clamp(1rem, 1.6vw + 0.4rem, 1.35rem)',
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 'clamp(1.25rem, 3vh, 2rem)',
          animation: 'fadeSlide 0.55s ease both',
          opacity: 0.92
        }}>
            Give it up for
          </div>
          <div key={nameKey} style={{
            fontSize: 'clamp(5.5rem, 13vw, 13rem)',
            fontWeight: 900,
            color: C.gold,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            animation: 'revealBounce 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
            filter: 'drop-shadow(0 6px 28px rgba(212,168,75,0.35))'
          }}>
              {winner.name}
            </div>
          {revealQuote &&
          <p
            key={`${nameKey}-quote`}
            style={{
              maxWidth: 'min(720px, 90vw)',
              margin: 'clamp(1.75rem, 3.5vh, 2.5rem) auto 0',
              padding: '0 1rem',
              fontSize: 'clamp(1.215rem, 2.16vw + 0.36rem, 1.71rem)',
              fontWeight: 600,
              lineHeight: 1.45,
              letterSpacing: '-0.015em',
              background: `linear-gradient(105deg, #ffe8a8 0%, ${C.gold} 38%, #fff4d0 52%, ${C.gold} 68%, #c8922e 100%)`,
              backgroundSize: '220% auto',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              animation: 'revealQuoteIn 0.75s ease 0.55s both, revealShimmer 4.5s linear 1.3s infinite',
              filter: 'drop-shadow(0 3px 20px rgba(212,168,75,0.28))'
            }}
          >
            {revealQuote}
          </p>
          }
          <KeyboardHint
            ariaLabel="Press space to continue"
            caption="to continue"
            style={{ marginTop: 'clamp(2rem, 4vh, 3rem)' }}
          >
            <RetroSpaceKey />
          </KeyboardHint>
        </div>
      </>
      }

      </div>

    </div>);

}

// ─── QUESTION SELECT SCREEN ───────────────────────────────────────────────────
function QuestionSelectScreen({
  speakerName,
  questionOfNight,
  usedQuestions,
  onStart,
  selectRestore = null,
  onSelectRestoreConsumed
}) {
  const [idx, setIdx] = useState(0);
  const [options, setOptions] = useState([]);
  const [qKey, setQKey] = useState(0);
  const didRestoreRef = useRef(false);

  useBlockPointerInput(true);

  useEffect(() => {
    didRestoreRef.current = false;
  }, [speakerName]);

  useEffect(() => {
    if (selectRestore?.options?.length && !didRestoreRef.current) {
      setOptions(selectRestore.options);
      setIdx(selectRestore.idx);
      setQKey((k) => k + 1);
      didRestoreRef.current = true;
      onSelectRestoreConsumed && onSelectRestoreConsumed();
      return;
    }
    if (didRestoreRef.current) return;
    const available = QUESTIONS.filter((q) => !usedQuestions.has(q) && q !== questionOfNight);
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([questionOfNight, ...shuffled]);
    setIdx(0);
    setQKey((k) => k + 1);
  }, [speakerName, questionOfNight, usedQuestions, selectRestore, onSelectRestoreConsumed]);

  const isQotN = idx === 0;
  const current = options[idx] || '';
  const qotNUsed = usedQuestions.has(questionOfNight);

  const goLeft = useCallback(() => {setIdx((i) => Math.max(0, i - 1));setQKey((k) => k + 1);}, []);
  const goRight = useCallback(() => {setIdx((i) => Math.min(options.length - 1, i + 1));setQKey((k) => k + 1);}, [options.length]);

  useEffect(() => {
    const h = (e) => {
      if (e.code === 'ArrowLeft') {e.preventDefault();goLeft();}
      if (e.code === 'ArrowRight') {e.preventDefault();goRight();}
      if (e.code === 'Space') {e.preventDefault();if (current) onStart(current, { options, idx });}
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goLeft, goRight, current, onStart, options, idx]);

  if (!options.length) return null;

  const questionSelectBackdrop = isQotN
    ? `radial-gradient(ellipse 125% 95% at 50% 28%, rgba(212,168,75,0.16) 0%, rgba(212,168,75,0.06) 42%, ${C.bg} 78%)`
    : `radial-gradient(ellipse 125% 95% at 50% 28%, rgba(47,114,248,0.14) 0%, rgba(47,114,248,0.05) 42%, ${C.bg} 78%)`;

  return (
    <div style={{
      background: questionSelectBackdrop,
      transition: 'background 0.8s ease',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 6rem',
      position: 'relative'
    }}>

      {/* Badge + pager — top centre */}
      <div style={{
        position: 'absolute',
        top: '2.5rem',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        zIndex: 2
      }}>
        {isQotN ?
        <QuestionOfNightBadge />
        : current ?
        <span style={{
          background: `${C.accent}1a`, border: `1.5px solid ${C.accent}70`,
          color: C.accent, borderRadius: 100, padding: '0.4rem 1.25rem',
          fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          boxShadow: `0 0 28px ${C.accent}18`
        }}>
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }} aria-hidden>🎲</span>
          Random question {idx}
        </span>
        : null
        }

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {options.map((_, i) =>
          <div key={i} aria-hidden style={{
            width: i === idx ? 32 : 10, height: 10, borderRadius: 100,
            background: i === idx ? i === 0 ? C.gold : C.accent : `${C.dim}50`,
            transition: 'all 0.25s'
          }} />
          )}
        </div>
      </div>

      {/* Question text */}
      <QuestionDisplayText
        key={qKey}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 'clamp(12rem, 18vh, 15rem)',
          alignItems: 'center',
          padding: 'clamp(7.5rem, 12vh, 9.5rem) 3rem 0',
          animation: 'fadeSlide 0.22s ease-out'
        }}>
        {current}
      </QuestionDisplayText>

      {/* Keyboard hints */}
      <div style={{
        position: 'absolute',
        bottom: 'clamp(1.5rem, 3vh, 2.5rem)',
        left: 'clamp(1rem, 3vw, 2rem)',
        right: 'clamp(1rem, 3vw, 2rem)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 'clamp(2rem, 5vw, 3.5rem)',
        zIndex: 3
      }}>
        <KeyboardHint ariaLabel="Arrow keys to browse questions" caption="to browse questions">
          <RetroArrowKeys />
        </KeyboardHint>
        <KeyboardHint ariaLabel="Press space to start speech" caption="to start speech">
          <RetroSpaceKey />
        </KeyboardHint>
      </div>
    </div>);

}

// ─── SPEECH SCREEN ────────────────────────────────────────────────────────────
function SpeechScreen({ speakerName, question, onComplete, onBackToQuestions, demoMode = false }) {
  const [phase, setPhase] = useState('speech');
  const [speechSecs, setSpeechSecs] = useState(0);
  const [feedSecs, setFeedSecs] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [timerFastForward, setTimerFastForward] = useState(false);
  const phaseRef = useRef('speech');
  phaseRef.current = phase;

  // Speech timer — normal mode
  useEffect(() => {
    if (phase !== 'speech' || demoMode) return;
    const start = Date.now();
    let alarmFired = false;
    let id;
    const tick = () => {
      const e = (Date.now() - start) / 1000;
      setSpeechSecs(e);
      if (e >= 120 && !alarmFired) {alarmFired = true;}
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase, demoMode]);

  // Speech timer — demo mode: jump to milestones, count +5s at 1:00 & 1:30, then hold at 2:00 (manual → feedback)
  useEffect(() => {
    if (phase !== 'speech' || !demoMode) return;
    setSpeechSecs(0);
    setTimerFastForward(false);

    const cleanups = [];
    let cancelled = false;
    const addCleanup = (fn) => cleanups.push(fn);

    const countFor = (durationSec, fromSecs, onDone) => {
      const start = performance.now();
      let raf;
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = (now - start) / 1000;
        if (elapsed >= durationSec) {
          setSpeechSecs(fromSecs + durationSec);
          onDone();
          return;
        }
        setSpeechSecs(fromSecs + elapsed);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      addCleanup(() => cancelAnimationFrame(raf));
    };

    const jumpTo = (from, to, onDone) => {
      if (cancelled) return;
      setTimerFastForward(true);
      addCleanup(animateSecs(from, to, 720, (v) => setSpeechSecs(v), () => {
        if (cancelled) return;
        setTimerFastForward(false);
        setSpeechSecs(to);
        onDone();
      }));
    };

    const holdFor = (secs, at, onDone) => {
      const t = setTimeout(() => {
        if (cancelled) return;
        setSpeechSecs(at);
        onDone();
      }, secs * 1000);
      addCleanup(() => clearTimeout(t));
    };

    // 0→0:05 → jump 1:00 → count to 1:05 → jump 1:30 → count to 1:35 → jump 2:00 → hold → count on (Space → feedback)
    countFor(5, 0, () => {
      jumpTo(5, 60, () => {
        countFor(5, 60, () => {
          jumpTo(65, 90, () => {
            countFor(5, 90, () => {
              jumpTo(95, 120, () => {
                holdFor(5, 120, () => {
                  if (cancelled) return;
                  const resumeStart = Date.now();
                  let raf;
                  const resumeTick = () => {
                    if (cancelled) return;
                    setSpeechSecs(120 + (Date.now() - resumeStart) / 1000);
                    raf = requestAnimationFrame(resumeTick);
                  };
                  raf = requestAnimationFrame(resumeTick);
                  addCleanup(() => cancelAnimationFrame(raf));
                });
              });
            });
          });
        });
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [phase, demoMode]);

  // Feedback timer — counts up to 2:00 then alarm (demo + real)
  useEffect(() => {
    if (phase !== 'feedback') return;
    const start = Date.now();
    let alarmFired = false;
    let id;
    const tick = () => {
      const e = (Date.now() - start) / 1000;
      setFeedSecs(e);
      if (e >= 120 && !alarmFired) {
        alarmFired = true;
        setPhase('alarm');
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // Smooth jazz when speech runs over 2:00
  useEffect(() => {
    if (phase !== 'speech' || speechSecs < 120) return;
    return startJazzAlarmLoop();
  }, [phase, speechSecs >= 120]);

  // Smooth jazz when feedback runs out (alarm phase)
  useEffect(() => {
    if (phase !== 'alarm') return;
    return startJazzAlarmLoop();
  }, [phase]);

  // Over-time flash
  useEffect(() => {
    if (phase !== 'speech' || speechSecs < 120) return;
    const id = setInterval(() => setFlashOn((f) => !f), 500);
    return () => clearInterval(id);
  }, [phase, speechSecs >= 120]);

  // Key handler — Space advances state machine; Escape returns to question browse (speech or feedback)
  useEffect(() => {
    const h = (e) => {
      if (e.code === 'Escape') {
        if ((phaseRef.current !== 'speech' && phaseRef.current !== 'feedback') || !onBackToQuestions) return;
        e.preventDefault();
        onBackToQuestions();
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      const p = phaseRef.current;
      if (p === 'speech') {setPhase('feedback');setFeedSecs(0);} else
      if (p === 'feedback') {onComplete();} // manual skip → straight to draw
      else if (p === 'alarm') {onComplete();} // timeout alarm → draw
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onComplete, onBackToQuestions]);

  // ── derive visuals ──
  let bgColor = C.bg;
  if (phase === 'speech') {
    if (speechSecs >= 120) bgColor = flashOn ? '#4d0000' : '#280000';else
    if (speechSecs >= 90) bgColor = '#280a00';else
    if (speechSecs >= 60) bgColor = '#1c1000';
  } else if (phase === 'feedback') {
    bgColor = '#090d1a';
  } else if (phase === 'alarm') {
    bgColor = '#1a0000';
  }

  let timerColor = C.text;
  if (phase === 'speech') {
    if (speechSecs >= 120) timerColor = '#ff5050';else
    if (speechSecs >= 90) timerColor = '#ff7030';else
    if (speechSecs >= 60) timerColor = '#ffb040';
  }

  const feedLeft = Math.max(0, 120 - feedSecs);

  return (
    <div style={{
      background: bgColor, height: '100vh', display: 'flex', flexDirection: 'column',
      transition: 'background 1.2s ease', overflow: 'hidden', position: 'relative'
    }}>

      {/* ── ALARM ── */}
      {phase === 'alarm' &&
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem'
      }}>
          <div style={{
          fontSize: 'clamp(4rem, 10vw, 9rem)',
          fontWeight: 900, color: '#ff4040',
          letterSpacing: '-0.02em', lineHeight: 1.1,
          animation: 'pulseBig 0.9s ease-in-out infinite'
        }}>
            Next Speaker, Please!
          </div>
          <KeyboardHint
            ariaLabel="Press space to continue"
            caption="to continue"
            style={{ marginTop: '2.5rem' }}
          >
            <RetroSpaceKey />
          </KeyboardHint>
        </div>
      }

      {/* ── SPEECH + FEEDBACK ── */}
      {phase !== 'alarm' &&
      <>
          {/* Question header */}
          <div style={{
          flexShrink: 0,
          padding: 'clamp(1.25rem, 2.5vh, 1.75rem) clamp(2rem, 4vw, 3rem) clamp(1.25rem, 2.5vh, 1.75rem)',
          display: 'flex', justifyContent: 'center',
          borderBottom: `1px solid ${phase === 'feedback' ? '#1a2a4a' : C.border}`
        }}>
            <div style={{
              maxWidth: 'min(920px, 88%)',
              width: '100%',
              minWidth: 0,
              textAlign: 'center'
            }}>
              <div style={{
              color: C.text,
              fontSize: 'clamp(1.95rem, 3.4vw + 0.85rem, 3.15rem)',
              lineHeight: 1.38,
              fontWeight: 600,
              opacity: 0.95,
              overflowWrap: 'break-word'
            }}>
                {question}
              </div>
            </div>
          </div>

          {/* Timer stage — fills space between question and Space hint */}
          <div style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 'clamp(1rem, 2.5vh, 2rem) clamp(1.5rem, 4vw, 3rem)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'clamp(1.25rem, 3vh, 2rem)'
            }}>
              {phase === 'feedback' && <FeedbackBadge large />}

              <div style={{
                fontSize: 'clamp(10rem, 24vw, 26rem)',
                fontWeight: 900,
                color: phase === 'feedback'
                  ? (feedLeft < 30 ? '#ff8060' : '#4a78d8')
                  : timerColor,
                letterSpacing: '-0.05em',
                lineHeight: 0.9,
                fontVariantNumeric: 'tabular-nums',
                transition: timerFastForward ? 'color 0.35s ease' : 'color 0.8s ease',
                transform: timerFastForward ? 'scale(1.02)' : 'scale(1)',
                filter: timerFastForward ? 'brightness(1.12)' : 'none',
                userSelect: 'none'
              }}>
                {phase === 'feedback' ? fmt(feedLeft) : fmt(speechSecs)}
              </div>

              <div style={{
                minHeight: 'clamp(2rem, 4vh, 2.75rem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {phase === 'speech' && speechSecs >= 60 && speechSecs < 90 &&
                <div style={{ color: '#ffb040', fontSize: '2.2rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  ONE MINUTE
                </div>
                }
                {phase === 'speech' && speechSecs >= 90 && speechSecs < 120 &&
                <div style={{ color: '#ff7030', fontSize: '2.2rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  WRAP IT UP SOON
                </div>
                }
                {phase === 'speech' && speechSecs >= 120 &&
                <div style={{ color: '#ff5050', fontSize: '2.5rem', fontWeight: 800, letterSpacing: '0.08em', animation: 'pulseBig 0.9s ease-in-out infinite' }}>
                  TIME'S UP
                </div>
                }
                {phase === 'feedback' && feedLeft < 30 &&
                <div style={{ color: '#ff8060', fontSize: '2.2rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  ALMOST DONE
                </div>
                }
              </div>
            </div>
          </div>

          {/* Space hint */}
          <div style={{
            flexShrink: 0,
            padding: 'clamp(1.25rem, 3vh, 2rem) clamp(1rem, 3vw, 2rem) clamp(1.75rem, 4vh, 3rem)',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <KeyboardHint
              ariaLabel={phase === 'speech' ? 'Press space to end speech' : 'Press space to finish feedback'}
              caption={phase === 'speech' ? 'to end speech' : 'to finish feedback'}
            >
              <RetroSpaceKey />
            </KeyboardHint>
          </div>
        </>
      }
    </div>);

}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  SetupScreen,
  HomeScreen,
  RegistrationScreen,
  DrawingScreen,
  QuestionSelectScreen,
  SpeechScreen,
  QRScreen,
  SpeakerAddedBeat
});