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
// `auto(ctx)` advances automatically when the host completes the step's action. Steps without
// `auto` (e.g. "Manage your speakers") advance via an explicit onWalkAdvance callback.
// `allow` names the single action the host may take while the step is active — everything else
// in the UI is locked so the walk-through stays focused on one thing at a time.
const WALK_STEPS = [
  {
    title: "Set tonight's question",
    body: [
      'Use "Pick random" or type your own. Keep it interesting and easy for first-timers to answer.',
      'Tip: press "Pick random" as many times as you like to cycle through fresh suggestions.'
    ],
    auto: (c) => c.screen === SCREEN.HOME,
  },
  {
    title: 'Add your speakers',
    body: [
      'Start typing a name — or ask the guest to type their own — then press Enter.',
      'Always ask people first, especially first-timers.'
    ],
    allow: 'addSpeaker',
    auto: (c) => c.count >= 1,
  },
  {
    title: 'Mark a first-timer',
    body: [`Press ${window.kbd('F')} to flag the last speaker you added so they are not picked in the first two draws. They get a gold "FT" badge.`],
    allow: 'markFT',
    auto: (c) => c.hasFT,
  },
  {
    title: 'Add a few more',
    body: ['Add three more names so the wheel has plenty of options.'],
    allow: 'addMore',
    progress: (c) => ({ current: Math.max(0, c.count - c.addMoreBaseline), target: 3 }),
    auto: (c) => c.count - c.addMoreBaseline >= 3,
  },
  {
    title: 'Manage your speakers',
    body: [
      'Open Speakers with the Speakers button in the top right.',
      'Try it: unmark a first-timer, mark someone as done, remove a name, or add a new one.'
    ],
    allow: 'manage',
    highlightSpeakers: true,
  },
  {
    title: 'Show everyone how it works',
    body: [`Press ${window.kbd('D')} to switch into demo mode. It loads sample speakers so you can demonstrate the app without using real names.`],
    allow: 'demo',
    auto: (c) => c.demoMode,
  },
  {
    title: 'Your real list is safe',
    body: [`Press ${window.kbd('D')} again and your real speakers come straight back — nothing is lost.`],
    allow: 'demo',
    auto: (c) => !c.demoMode,
  },
  {
    title: 'Run a draw',
    body: [`Switch back to demo mode (${window.kbd('D')}), then press Space to start spinning the wheel.`],
    allow: 'draw',
    auto: (c) => c.screen === SCREEN.DRAWING,
  },
  {
    title: 'Spin the wheel',
    body: ['Hold Space to spin at full speed, then release to let it land on a speaker.'],
    auto: (c) => c.drawPhase === 'reveal',
  },
  {
    title: 'Give it up!',
    body: ['Press Space to move on to choosing a question.'],
    allow: 'revealAdvance',
    auto: (c) => c.screen === SCREEN.QSELECT,
  },
  {
    title: 'Pick a question',
    body: ['Use the arrow keys to browse: the Question of the Night, three random questions, and "Yolo mode" — a surprise mystery question. Press Space to choose.'],
    auto: (c) => c.screen === SCREEN.SPEECH || c.screen === SCREEN.YOLO_PREP,
  },
  {
    title: 'Explaining the timer',
    body: [
      'In demo mode the timer jumps ahead to simulate a full speech. Use this moment to explain how timing works for speakers.',
      'Press Space to end the speech.'
    ],
    auto: (c) => c.speechPhase === 'feedback',
  },
  {
    title: 'Feedback time',
    body: ['In demo mode the feedback timer runs in real time. Use it to explain what good, constructive feedback sounds like.'],
    auto: (c) => c.screen === SCREEN.DRAWING || c.screen === SCREEN.HOME,
  },
  {
    title: "You're ready to go",
    body: [`Press ${window.kbd('D')} to switch back to your real speakers — and the night begins.`],
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
  const walkProgress = activeWalkStep?.progress ? activeWalkStep.progress(walkCtx) : null;

  // Host walk-through — advance the current step once its action is complete
  useEffect(() => {
    if (!walkthrough || walkCoachDismissed) return;
    const step = WALK_STEPS[walkStep];
    if (!step || !step.auto) return;
    if (step.auto(walkCtx)) {
      setWalkStep((s) => Math.min(WALK_STEPS.length - 1, s + 1));
    }
  }, [walkthrough, walkCoachDismissed, walkStep, screen, participants, demoMode, drawPhase, speechPhase]);

  // Explicit advance for steps with no automatic trigger (e.g. "Manage your speakers").
  const handleWalkAdvance = useCallback((forAllow) => {
    setWalkStep((s) => {
      if (forAllow && WALK_STEPS[s]?.allow !== forAllow) return s;
      return Math.min(WALK_STEPS.length - 1, s + 1);
    });
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
        <SetupScreen onComplete={handleSetupDone} />
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
          highlightSpeakers={highlightSpeakers}
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
          title: WALK_STEPS[walkStep].title,
          body: WALK_STEPS[walkStep].body,
          stepNumber: walkStep + 1,
          totalSteps: WALK_STEPS.length,
          isLast: !!WALK_STEPS[walkStep].last,
          onExit: handleWalkFinish,
          showSkip: walkCompletedOnce && !WALK_STEPS[walkStep].last,
          onSkip: handleWalkFinish,
          progress: walkProgress
        })
      }
      {walkthrough && walkCoachDismissed && window.WalkthroughRestartButton &&
        React.createElement(window.WalkthroughRestartButton, { onRestart: handleWalkRestart })
      }
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
