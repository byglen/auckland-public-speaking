// app.jsx — main state machine for Auckland Public Speaking
const { useState, useEffect, useCallback, useRef } = React;

// Demo speakers — clearly fictional / famous figures (never real attendee names)
const DEMO_SPEAKER_NAMES = [
  'Sherlock', 'Gandalf', 'Ringo', 'Spock', 'Yoda',
  'Paddington', 'Pikachu', 'Snoopy', 'Tintin', 'Shrek',
  'Bowie', 'Gatsby', 'Picasso', 'Mozart'
];

const SCREEN = {
  SETUP:    'setup',
  HOME:     'home',
  REGISTER: 'register',
  DRAWING:  'drawing',
  QSELECT:  'qselect',
  YOLO_PREP:'yolo_prep',
  SPEECH:   'speech',
  QR:       'qr',
};

function pickYoloQuestion(questionOfNight, usedQuestions, carouselOptions) {
  const YOLO_SLOT = window.YOLO_SLOT;
  const carouselRandoms = carouselOptions.filter(
    (o) => o !== YOLO_SLOT && o !== questionOfNight
  );
  const exclude = new Set([questionOfNight, ...carouselRandoms, ...usedQuestions]);
  let pool = QUESTIONS.filter((q) => !exclude.has(q));
  if (!pool.length) pool = QUESTIONS.filter((q) => !usedQuestions.has(q));
  if (!pool.length) pool = [...QUESTIONS];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Host walk-through — contextual coach steps that advance as the host performs each real action.
// Each card is punchy: a short `title` plus an optional `cue` ({ keys, text }) that emphasises the
// single key press / action that matters. `auto(ctx)` advances automatically when the host completes
// the step's action; steps without `auto` (e.g. open/close Manage Speakers) advance via the explicit
// onWalkAdvance callback. `allow` names the single action the host may take while the step is active —
// everything else in the UI is locked (and shakes the card) so the walk-through stays focused.
const CMD = window.IS_MAC ? '\u2318' : 'Ctrl';

// After a speaker is added the host sits on the full-screen "added" celebration, which
// covers the coach. We hold the walk-through step advance until they're back on home and
// wait this long before flipping the step — so the coach's step-change pop is actually seen.
const WALK_STEP_LANDING_DELAY_MS = 700;

const WALK_STEPS = [
  {
    title: "Pick tonight's question",
    body: ['Hit "Pick random" or type your own — keep it easy for first-timers.'],
    auto: (c) => c.screen === SCREEN.HOME,
  },
  {
    title: 'Add your first speaker',
    body: ['Type a name, or let the guest type their own.'],
    cue: { keys: ['Enter'], text: 'to add them' },
    cueWhen: (c) => c.screen === SCREEN.REGISTER,
    allow: 'addSpeaker',
    auto: (c) => c.count >= 1,
  },
  {
    title: 'Mark them a first-timer',
    body: ['Keeps them out of the first two draws and adds a gold FT badge.'],
    cue: { keys: [CMD, 'F'], text: 'flags the last speaker added' },
    allow: 'markFT',
    auto: (c) => c.hasFT,
  },
  {
    title: 'Add two more',
    titleFor: (c) => (c.count - c.addMoreBaseline >= 1 ? 'Add one more' : 'Add two more'),
    body: ['Give the wheel a few options to spin.'],
    allow: 'addMore',
    progress: (c) => ({ current: Math.max(0, c.count - c.addMoreBaseline), target: 2 }),
    auto: (c) => c.count - c.addMoreBaseline >= 2,
  },
  {
    title: 'Open your speaker list',
    body: ['Tap the Speakers button, highlighted in the top right of this screen, to mark people done, remove them, or add more.'],
    allow: 'manage',
    highlightSpeakers: true,
  },
  {
    title: 'Close it to continue',
    body: ['Every change saves automatically.'],
    cue: { keys: ['Esc'], text: 'or tap Done' },
    allow: 'closeManage',
  },
  {
    title: 'Try demo mode',
    body: ['Demonstrate the app without using real names.'],
    cue: { keys: [CMD, 'D'], text: 'loads sample speakers' },
    allow: 'demo',
    auto: (c) => c.demoMode,
  },
  {
    title: 'Your real list is safe',
    body: ['Toggle demo off and your real speakers come straight back.'],
    cue: { keys: [CMD, 'D'], text: 'brings everyone back' },
    allow: 'demo',
    auto: (c) => !c.demoMode,
  },
  {
    title: 'Run a draw',
    body: ['Turn demo back on, then spin the wheel.'],
    cue: { keys: ['Space'], text: 'to start spinning' },
    cueWhen: (c) => c.demoMode,
    allow: 'draw',
    auto: (c) => c.screen === SCREEN.DRAWING,
  },
  {
    title: 'Spin it',
    body: ['Let it slow down and land on a speaker.', 'In demo mode, press Enter to end the spin instantly.'],
    cue: { keys: ['Space'], text: 'hold, then release' },
    auto: (c) => c.drawPhase === 'reveal',
  },
  {
    title: 'Give it up!',
    body: ['Time to choose their question.'],
    cue: { keys: ['Space'], text: 'to continue' },
    allow: 'revealAdvance',
    auto: (c) => c.screen === SCREEN.QSELECT,
  },
  {
    title: 'Pick a question',
    body: ['Question of the night, three randoms, or Yolo mode.'],
    cue: { keys: ['\u2190', '\u2192'], text: 'browse · Space to pick' },
    auto: (c) => c.screen === SCREEN.SPEECH || c.screen === SCREEN.YOLO_PREP,
  },
  {
    title: 'Explain the timer',
    body: ['Demo fast-forwards the speech so you can explain timing.'],
    cue: { keys: ['Space'], text: 'to end it' },
    auto: (c) => c.speechPhase === 'feedback',
  },
  {
    title: 'Feedback time',
    body: ['Demo runs feedback in real time — show what good feedback sounds like.'],
    auto: (c) => c.screen === SCREEN.DRAWING || c.screen === SCREEN.HOME,
  },
  {
    title: "You're all set",
    body: ['Switch back to your real speakers and start the night.'],
    cue: { keys: [CMD, 'D'], text: 'back to real speakers' },
    last: true,
  },
];

function App() {
  const [screen,          setScreen]          = useState(SCREEN.SETUP);
  const [questionOfNight, setQuestionOfNight] = useState('');
  const [participants,    setParticipants]    = useState([]);
  const [currentSpeaker,  setCurrentSpeaker]  = useState(null);
  const [usedQuestions,   setUsedQuestions]   = useState(new Set());
  const [selectedQ,       setSelectedQ]       = useState(null);
  const [registerSeed,    setRegisterSeed]    = useState('');
  const [demoMode,        setDemoMode]        = useState(false);
  const [walkthrough,     setWalkthrough]     = useState(() => {
    try { return new URLSearchParams(window.location.search).has('walkthrough'); }
    catch (e) { return false; }
  });
  const [walkStep,        setWalkStep]        = useState(0);
  const [walkCoachDismissed, setWalkCoachDismissed] = useState(false);
  const [walkCompletedOnce, setWalkCompletedOnce]   = useState(false);
  const [walkNudge,       setWalkNudge]       = useState(0);
  const addMoreBaselineRef     = useRef(0);
  const addMoreBaselineStepRef = useRef(-1);
  const [drawPhase,       setDrawPhase]       = useState(null);
  const [speechPhase,     setSpeechPhase]     = useState(null);
  const [addedFlash,      setAddedFlash]      = useState(null);
  const [reopenManage,    setReopenManage]    = useState(false);
  const [questionSelectState, setQuestionSelectState] = useState(null);
  const [yoloPrepQuestion, setYoloPrepQuestion] = useState(null);
  const [usedRevealQuotes, setUsedRevealQuotes] = useState(new Set());
  const usedRevealQuotesRef = useRef(usedRevealQuotes);
  usedRevealQuotesRef.current = usedRevealQuotes;
  const realParticipantsRef = useRef([]);
  const lastAddedParticipantRef = useRef(null);
  const firstTimerPulseTimerRef = useRef(null);
  const [firstTimerPulseName, setFirstTimerPulseName] = useState(null);

  const pickRevealQuoteForSession = useCallback(() => {
    const quote = pickRevealQuote(usedRevealQuotesRef.current);
    setUsedRevealQuotes((prev) => new Set([...prev, quote]));
    return quote;
  }, []);

  const remaining = participants.filter(p => !p.done);

  // The single action the host may take during the active walk-through step (null = no walk-through).
  const walkAllow = walkthrough && !walkCoachDismissed
    ? (WALK_STEPS[walkStep]?.allow ?? null)
    : null;
  const highlightSpeakers = walkthrough && !walkCoachDismissed && !!WALK_STEPS[walkStep]?.highlightSpeakers;

  // Space on home → draw. During the walk-through this is locked until the "Run a draw"
  // step, and only works from the demo list (so real speakers are never spun).
  useEffect(() => {
    if (screen !== SCREEN.HOME) return;
    if (walkthrough && !(walkAllow === 'draw' && demoMode)) return;
    const h = e => {
      if (e.code === 'Space' && remaining.length > 0) {
        e.preventDefault();
        setScreen(SCREEN.DRAWING);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, remaining.length, walkthrough, walkAllow, demoMode]);

  const handleSetupDone = useCallback(q => {
    setQuestionOfNight(q);
    setScreen(SCREEN.HOME);
  }, []);

  const handleAddParticipant = useCallback((name, returnTo = null) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    let added = false;
    setParticipants(prev => {
      if (prev.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      added = true;
      lastAddedParticipantRef.current = trimmed;
      return [...prev, { name: trimmed, done: false, firstTimer: false }];
    });
    setAddedFlash({ name: trimmed, added, returnTo });
    return added;
  }, []);

  const dismissAddedFlash = useCallback(({ continueAdding = false } = {}) => {
    setAddedFlash((flash) => {
      if (!flash) return null;
      const { returnTo } = flash;
      setTimeout(() => {
        if (continueAdding && returnTo === 'register') {
          setRegisterSeed('');
          setScreen(SCREEN.REGISTER);
        } else if (continueAdding && returnTo === 'manage') {
          setScreen(SCREEN.HOME);
          setReopenManage(true);
        } else {
          setRegisterSeed('');
          setScreen(SCREEN.HOME);
        }
      }, 0);
      return null;
    });
  }, []);

  const handleRemoveParticipant = useCallback(name => {
    setParticipants(prev => prev.filter(p => p.name !== name));
  }, []);

  const handleSetParticipantDone = useCallback((name, done) => {
    setParticipants(prev =>
      prev.map(p => {
        if (p.name !== name) return p;
        if (done) return { ...p, done: true };
        return { ...p, done: false, firstTimer: false };
      })
    );
  }, []);

  const triggerFirstTimerPulse = useCallback((name) => {
    if (!name) return;
    if (firstTimerPulseTimerRef.current) clearTimeout(firstTimerPulseTimerRef.current);
    setFirstTimerPulseName(name);
    firstTimerPulseTimerRef.current = setTimeout(() => {
      setFirstTimerPulseName((current) => (current === name ? null : current));
      firstTimerPulseTimerRef.current = null;
    }, 1000);
  }, []);

  const handleSetParticipantFirstTimer = useCallback((name, firstTimer) => {
    setParticipants((prev) => {
      const p = prev.find((x) => x.name === name);
      if (!p) return prev;
      if (firstTimer && !p.firstTimer && !p.done) {
        queueMicrotask(() => triggerFirstTimerPulse(name));
      }
      return prev.map((x) => x.name === name ? { ...x, firstTimer: !!firstTimer } : x);
    });
  }, [triggerFirstTimerPulse]);

  const handleMarkLastAddedFirstTimer = useCallback(() => {
    const name = lastAddedParticipantRef.current;
    if (!name) return;
    setParticipants((prev) => {
      const p = prev.find((x) => x.name === name);
      if (!p || p.done) return prev;
      if (!p.firstTimer) queueMicrotask(() => triggerFirstTimerPulse(name));
      return prev.map((x) => x.name === name ? { ...x, firstTimer: true } : x);
    });
  }, [triggerFirstTimerPulse]);

  // ⌘F / Ctrl+F — mark last added speaker as first timer (home, registration, or added confirmation)
  useEffect(() => {
    const active = screen === SCREEN.HOME || screen === SCREEN.REGISTER || addedFlash;
    if (!active) return;
    if (walkAllow && walkAllow !== 'markFT') return;
    const h = (e) => {
      if (!window.cmdPressed(e) || e.code !== 'KeyF') return;
      e.preventDefault();
      handleMarkLastAddedFirstTimer();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, addedFlash, handleMarkLastAddedFirstTimer, walkAllow]);

  const handleResetSpeakers = useCallback(() => {
    setParticipants(prev => prev.map(p => ({ ...p, done: false, firstTimer: false })));
  }, []);

  const handleToggleDemo = useCallback(() => {
    setDemoMode((wasDemo) => {
      if (!wasDemo) {
        setParticipants((current) => {
          realParticipantsRef.current = current.map((p) => ({ ...p }));
          return DEMO_SPEAKER_NAMES.map((name) => ({ name, done: false }));
        });
        return true;
      }
      setParticipants((realParticipantsRef.current ?? []).map((p) => ({ ...p })));
      return false;
    });
  }, []);

  // Capture the speaker count the first time the "Add a few more" step becomes active so
  // the step can show live progress ("Added N of 3") relative to that baseline.
  if (walkthrough && WALK_STEPS[walkStep]?.allow === 'addMore' && addMoreBaselineStepRef.current !== walkStep) {
    addMoreBaselineRef.current = participants.length;
    addMoreBaselineStepRef.current = walkStep;
  }

  const walkCtx = {
    screen,
    count: participants.length,
    hasFT: participants.some((p) => p.firstTimer && !p.done),
    demoMode,
    drawPhase,
    speechPhase,
    addMoreBaseline: addMoreBaselineRef.current
  };

  const activeWalkStep = walkthrough ? WALK_STEPS[walkStep] : null;
  const walkTitle = activeWalkStep
    ? (activeWalkStep.titleFor ? activeWalkStep.titleFor(walkCtx) : activeWalkStep.title)
    : '';
  const walkProgress = activeWalkStep?.progress ? activeWalkStep.progress(walkCtx) : null;
  const walkCue = activeWalkStep?.cue && (!activeWalkStep.cueWhen || activeWalkStep.cueWhen(walkCtx))
    ? activeWalkStep.cue
    : null;

  // Host walk-through — advance the current step once its action is complete.
  // For the "add speaker" steps the host is briefly on the celebratory "added" beat
  // (which covers the coach), so we hold the advance until the beat clears and they're
  // back on home, then wait a small beat — that way the coach's step-change pop is seen.
  useEffect(() => {
    if (!walkthrough || walkCoachDismissed) return;
    const step = WALK_STEPS[walkStep];
    if (!step || !step.auto) return;
    if (!step.auto(walkCtx)) return;
    if (addedFlash) return; // wait for the "speaker added" beat to clear first
    const advance = () => setWalkStep((s) => Math.min(WALK_STEPS.length - 1, s + 1));
    const isAddStep = step.allow === 'addSpeaker' || step.allow === 'addMore';
    if (isAddStep && screen === SCREEN.HOME) {
      const t = setTimeout(advance, WALK_STEP_LANDING_DELAY_MS);
      return () => clearTimeout(t);
    }
    advance();
  }, [walkthrough, walkCoachDismissed, walkStep, screen, participants, demoMode, drawPhase, speechPhase, addedFlash]);

  // Explicit advance for steps with no automatic trigger (e.g. "Manage your speakers").
  const handleWalkAdvance = useCallback((forAllow) => {
    setWalkStep((s) => {
      if (forAllow && WALK_STEPS[s]?.allow !== forAllow) return s;
      return Math.min(WALK_STEPS.length - 1, s + 1);
    });
  }, []);

  // Off-path — the host tried an action the active step doesn't ask for; shake the coach to refocus.
  const triggerWalkNudge = useCallback(() => {
    setWalkNudge((n) => n + 1);
  }, []);

  // Finish — dismiss the coach panel but stay in walk-through mode so the host can keep using the app.
  const handleWalkFinish = useCallback(() => {
    setWalkCompletedOnce(true);
    setWalkCoachDismissed(true);
  }, []);

  // Restart — bring the coach back from step 1 with a clean slate.
  const handleWalkRestart = useCallback(() => {
    setDemoMode(false);
    setParticipants([]);
    realParticipantsRef.current = [];
    lastAddedParticipantRef.current = null;
    addMoreBaselineRef.current = 0;
    addMoreBaselineStepRef.current = -1;
    setCurrentSpeaker(null);
    setUsedQuestions(new Set());
    setSelectedQ(null);
    setRegisterSeed('');
    setAddedFlash(null);
    setReopenManage(false);
    setQuestionSelectState(null);
    setYoloPrepQuestion(null);
    setUsedRevealQuotes(new Set());
    setFirstTimerPulseName(null);
    setWalkCoachDismissed(false);
    setWalkStep(0);
    setDrawPhase(null);
    setSpeechPhase(null);
    setScreen(SCREEN.SETUP);
  }, []);

  const handleDrawComplete = useCallback(({ name }) => {
    setCurrentSpeaker(name);
    setQuestionSelectState(null);
    setYoloPrepQuestion(null);
    setScreen(SCREEN.QSELECT);
  }, []);

  const handleSpeechStart = useCallback((question, selectSnapshot) => {
    setQuestionSelectState(selectSnapshot);
    setSelectedQ(question);
    setUsedQuestions((prev) => new Set([...prev, question]));
    setYoloPrepQuestion(null);
    setScreen(SCREEN.SPEECH);
  }, []);

  const handleYoloStart = useCallback((selectSnapshot) => {
    const question = pickYoloQuestion(questionOfNight, usedQuestions, selectSnapshot.options);
    setQuestionSelectState(selectSnapshot);
    setUsedQuestions((prev) => new Set([...prev, question]));
    setYoloPrepQuestion(question);
    setScreen(SCREEN.YOLO_PREP);
  }, [questionOfNight, usedQuestions]);

  const handleYoloPrepComplete = useCallback(() => {
    setSelectedQ(yoloPrepQuestion);
    setYoloPrepQuestion(null);
    setScreen(SCREEN.SPEECH);
  }, [yoloPrepQuestion]);

  const handleYoloPrepCancel = useCallback(() => {
    setYoloPrepQuestion(null);
    setScreen(SCREEN.QSELECT);
  }, []);

  const handleSpeechBack = useCallback(() => {
    setUsedQuestions((prev) => {
      const next = new Set(prev);
      if (selectedQ) next.delete(selectedQ);
      return next;
    });
    setSelectedQ(null);
    setScreen(SCREEN.QSELECT);
  }, [selectedQ]);

  const handleSelectRestoreConsumed = useCallback(() => {
    setQuestionSelectState(null);
  }, []);

  const handleSpeechComplete = useCallback(() => {
    setParticipants(prev => {
      const updated = prev.map(p =>
        p.name === currentSpeaker ? { ...p, done: true } : p
      );
      // Go to Draw if anyone is left, otherwise Home
      const stillRemaining = updated.filter(p => !p.done);
      setTimeout(() => {
        setScreen(stillRemaining.length > 0 ? SCREEN.DRAWING : SCREEN.HOME);
      }, 0);
      return updated;
    });
    setCurrentSpeaker(null);
    setSelectedQ(null);
  }, [currentSpeaker]);

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>
      {screen === SCREEN.SETUP && (
        <SetupScreen onComplete={handleSetupDone} hideBrand={walkthrough && !walkCoachDismissed} />
      )}
      {screen === SCREEN.HOME && (
        <HomeScreen
          questionOfNight={questionOfNight}
          participants={participants}
          firstTimerPulseName={firstTimerPulseName}
          demoMode={demoMode}
          onRegister={(seed) => { setRegisterSeed(seed || ''); setScreen(SCREEN.REGISTER); }}
          onDraw={() => setScreen(SCREEN.DRAWING)}
          onEditQuestion={() => setScreen(SCREEN.SETUP)}
          onShowQR={() => setScreen(SCREEN.QR)}
          onToggleDemo={handleToggleDemo}
          onAddParticipant={handleAddParticipant}
          onRemoveParticipant={handleRemoveParticipant}
          onSetParticipantDone={handleSetParticipantDone}
          onSetParticipantFirstTimer={handleSetParticipantFirstTimer}
          onResetSpeakers={handleResetSpeakers}
          reopenManage={reopenManage}
          onReopenManageConsumed={() => setReopenManage(false)}
          walkAllow={walkAllow}
          onWalkAdvance={handleWalkAdvance}
          onWalkNudge={triggerWalkNudge}
          highlightSpeakers={highlightSpeakers}
          hideBrand={walkthrough && !walkCoachDismissed}
        />
      )}
      {screen === SCREEN.REGISTER && (
        <RegistrationScreen
          initialChar={registerSeed}
          onAdd={(name) => handleAddParticipant(name, 'register')}
          onDone={() => { setRegisterSeed(''); setScreen(SCREEN.HOME); }}
        />
      )}
      {screen === SCREEN.QR && (
        <QRScreen onBack={() => setScreen(SCREEN.HOME)} />
      )}
      {screen === SCREEN.DRAWING && (
        <DrawingScreen
          participants={participants}
          onComplete={handleDrawComplete}
          onBackHome={() => setScreen(SCREEN.HOME)}
          pickRevealQuoteForSession={pickRevealQuoteForSession}
          demoMode={demoMode}
          onToggleDemo={handleToggleDemo}
          onPhaseChange={walkthrough ? setDrawPhase : undefined}
          walkAllow={walkAllow}
        />
      )}
      {screen === SCREEN.QSELECT && (
        <QuestionSelectScreen
          speakerName={currentSpeaker}
          questionOfNight={questionOfNight}
          usedQuestions={usedQuestions}
          onStart={handleSpeechStart}
          onStartYolo={handleYoloStart}
          selectRestore={questionSelectState}
          onSelectRestoreConsumed={handleSelectRestoreConsumed}
        />
      )}
      {screen === SCREEN.YOLO_PREP && yoloPrepQuestion && (
        <YoloPrepScreen
          question={yoloPrepQuestion}
          demoMode={demoMode}
          onComplete={handleYoloPrepComplete}
          onCancel={handleYoloPrepCancel}
        />
      )}
      {screen === SCREEN.SPEECH && (
        <SpeechScreen
          speakerName={currentSpeaker}
          question={selectedQ}
          demoMode={demoMode}
          onComplete={handleSpeechComplete}
          onBackToQuestions={handleSpeechBack}
          onPhaseChange={walkthrough ? setSpeechPhase : undefined}
        />
      )}
      {addedFlash && window.SpeakerAddedBeat &&
      <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
        {React.createElement(window.SpeakerAddedBeat, {
          name: addedFlash.name,
          added: addedFlash.added,
          continueAdding: !!addedFlash.returnTo,
          isFirstTimer: !!participants.find((p) => p.name === addedFlash.name)?.firstTimer,
          onDone: dismissAddedFlash,
          suppressAddHints: walkthrough && !walkCoachDismissed && participants.length === 1 && addedFlash.added
        })}
      </div>
      }
      {walkthrough && !walkCoachDismissed && WALK_STEPS[walkStep] && window.WalkthroughCoach &&
        React.createElement(window.WalkthroughCoach, {
          title: walkTitle,
          body: WALK_STEPS[walkStep].body,
          cue: walkCue,
          stepNumber: walkStep + 1,
          totalSteps: WALK_STEPS.length,
          isLast: !!WALK_STEPS[walkStep].last,
          onExit: handleWalkFinish,
          showSkip: walkCompletedOnce && !WALK_STEPS[walkStep].last,
          onSkip: handleWalkFinish,
          progress: walkProgress,
          nudgeKey: walkNudge
        })
      }
      {walkthrough && walkCoachDismissed && window.WalkthroughRestartButton &&
        React.createElement(window.WalkthroughRestartButton, { onRestart: handleWalkRestart })
      }
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
