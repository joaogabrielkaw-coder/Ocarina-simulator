import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HudOverlay } from './components/HudOverlay';
import { LeaderboardDrawer } from './components/LeaderboardDrawer';
import { RunSummary, StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { audioEngine } from './game/audioEngine';
import { UnifiedInputManager } from './game/inputManager';
import {
  buildSongSchedule,
  CHALLENGE_SONGS,
  computeAccuracyPercent,
  computeHitPoints,
  evaluateNoteHit,
  GameMode,
  GamePhase,
  GridNoteSpec,
  matchSongSequence,
  NoteId,
  OcarinaSong,
  ScheduledBeatNote,
  TIMING_WINDOW_GOOD,
} from './game/musicData';
import { CameraFocusMode, OcarinaSceneController } from './game/ocarinaScene';
import {
  LeaderboardEntry,
  signInWithGoogle,
  signOutUser,
  submitCloudScore,
  subscribeAuthUser,
  subscribeGlobalLeaderboard,
  updatePlayerNickname,
} from './services/leaderboardService';

const LOCAL_BEST_KEY = 'ocarina_sim_best_score';
const LOCAL_NAME_KEY = 'ocarina_sim_player_name';
const MAX_HALF_HEARTS = 10; // 5 full Zelda-style hearts
const PIXELS_PER_SEC = 220;
const HIT_CURSOR_X = 76;

function readInitialBest(): number {
  try {
    return Number(localStorage.getItem(LOCAL_BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function readInitialName(): string {
  try {
    return localStorage.getItem(LOCAL_NAME_KEY) || 'Músico de Hyrule';
  } catch {
    return 'Músico de Hyrule';
  }
}

function OcarinaGame() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const staffTrackRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OcarinaSceneController | null>(null);
  const inputRef = useRef<UnifiedInputManager | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [mode, setMode] = useState<GameMode>('desafio');
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hearts, setHearts] = useState(MAX_HALF_HEARTS);
  const [songIndex, setSongIndex] = useState(0);
  const [schedule, setSchedule] = useState<ScheduledBeatNote[]>(() =>
    buildSongSchedule(CHALLENGE_SONGS[0], 1.6, 0.9),
  );
  const [heldNotes, setHeldNotes] = useState<NoteId[]>([]);
  const [heldGridIds, setHeldGridIds] = useState<string[]>([]);
  const [lastGridSpec, setLastGridSpec] = useState<GridNoteSpec | null>(null);
  const [semitoneShift, setSemitoneShift] = useState(0);
  const [vibratoActive, setVibratoActive] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ grade: 'perfeito' | 'bom' | 'erro'; id: number } | null>(null);
  const [recognizedSong, setRecognizedSong] = useState<OcarinaSong | null>(null);
  const [recentFreeNotes, setRecentFreeNotes] = useState<NoteId[]>([]);
  const [activeDemoSongId, setActiveDemoSongId] = useState<string | null>(null);
  const [selectedPracticeSong, setSelectedPracticeSong] = useState<OcarinaSong | null>(null);
  const [practiceStepIdx, setPracticeStepIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  const [bestLocalScore, setBestLocalScore] = useState<number>(readInitialBest);
  const [playerName, setPlayerName] = useState<string>(readInitialName);
  const [user, setUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string | null>(null);

  const demoTimersRef = useRef<number[]>([]);

  // Mutable simulation refs so 60Hz loop & callbacks never stale-close
  const simRef = useRef({
    phase: 'title' as GamePhase,
    mode: 'desafio' as GameMode,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hearts: MAX_HALF_HEARTS,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    songsCompleted: 0,
    songIndex: 0,
    songTimeSec: 0,
    semitoneShift: 0,
    heldSet: new Set<NoteId>(),
    heldGridSet: new Set<string>(),
    schedule: buildSongSchedule(CHALLENGE_SONGS[0], 1.6, 0.9),
    recentFreeNotes: [] as NoteId[],
    selectedPracticeSong: null as OcarinaSong | null,
    practiceStepIdx: 0,
    feedbackCounter: 0,
    scoreboardOpen: false,
    playerName: readInitialName(),
  });

  // Sync body[data-state] and camera focus mode
  useEffect(() => {
    document.body.dataset.state = phase;
    simRef.current.phase = phase;
    const camMode: CameraFocusMode = scoreboardOpen
      ? 'scoreboard'
      : phase === 'title'
        ? 'title'
        : 'playing';
    sceneRef.current?.setCameraMode(camMode);
  }, [phase, scoreboardOpen]);

  useEffect(() => {
    simRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    simRef.current.scoreboardOpen = scoreboardOpen;
  }, [scoreboardOpen]);

  useEffect(() => {
    simRef.current.playerName = playerName;
    try {
      localStorage.setItem(LOCAL_NAME_KEY, playerName);
    } catch {
      // Ignore storage quota errors
    }
  }, [playerName]);

  const finishRun = useCallback((victory: boolean) => {
    const s = simRef.current;
    const total = s.perfectCount + s.goodCount + s.missCount;
    const accuracy = computeAccuracyPercent(s.perfectCount, s.goodCount, total);
    const snapshot: RunSummary = {
      score: Math.round(s.score),
      bestCombo: s.bestCombo,
      accuracy,
      songsCompleted: s.songsCompleted,
      victory,
    };

    audioEngine.stopAllNotes();
    s.heldSet.clear();
    s.heldGridSet.clear();
    setHeldNotes([]);
    setHeldGridIds([]);
    setLastGridSpec(null);
    setRunSummary(snapshot);
    setPhase('gameover');
    document.body.dataset.state = 'gameover';

    if (snapshot.score > bestLocalScore) {
      setBestLocalScore(snapshot.score);
      try {
        localStorage.setItem(LOCAL_BEST_KEY, String(snapshot.score));
      } catch {
        // Ignore storage error
      }
    }

    if (victory) {
      audioEngine.playSongFanfare();
      sceneRef.current?.triggerSongAura('#fde047');
    }

    // Attempt cloud save immediately if signed in
    if (user && snapshot.score > 0) {
      setCloudSaving(true);
      setCloudStatusMsg(null);
      void submitCloudScore({
        playerName: s.playerName,
        score: snapshot.score,
        bestCombo: snapshot.bestCombo,
        accuracy: snapshot.accuracy,
        songsCompleted: snapshot.songsCompleted,
      })
        .then((res) => {
          setCloudStatusMsg(
            res.isNewRecord
              ? 'Novo recorde pessoal salvo na nuvem!'
              : 'Pontuação sincronizada com o Placar Global.',
          );
        })
        .catch(() => {
          setCloudStatusMsg('Não foi possível salvar agora. Tente novamente.');
        })
        .finally(() => setCloudSaving(false));
    }
  }, [bestLocalScore, user]);

  const stopDemo = useCallback(() => {
    for (const tid of demoTimersRef.current) {
      window.clearTimeout(tid);
    }
    demoTimersRef.current = [];
    setActiveDemoSongId(null);
    const s = simRef.current;
    for (const note of Array.from(s.heldSet)) {
      sceneRef.current?.pressHoleVisual(note, false);
      audioEngine.stopNote(note);
    }
    s.heldSet.clear();
    setHeldNotes([]);
    s.semitoneShift = 0;
    setSemitoneShift(0);
    sceneRef.current?.setPitchShiftVisual(0);
  }, []);

  const loadSongStage = useCallback((idx: number) => {
    const s = simRef.current;
    const song = CHALLENGE_SONGS[idx];
    const tempoScale = 0.88 + idx * 0.055; // Smooth difficulty ramp across 6 songs
    const nextSched = buildSongSchedule(song, 1.55, tempoScale);
    s.songIndex = idx;
    s.songTimeSec = 0;
    s.schedule = nextSched;
    setSongIndex(idx);
    setSchedule(nextSched);
  }, []);

  const startGame = useCallback(
    (targetMode: GameMode) => {
      stopDemo();
      audioEngine.unlock();
      audioEngine.stopAllNotes();
      inputRef.current?.clearAllHeld();

      const s = simRef.current;
      s.mode = targetMode;
      s.score = 0;
      s.combo = 0;
      s.bestCombo = 0;
      s.hearts = MAX_HALF_HEARTS;
      s.perfectCount = 0;
      s.goodCount = 0;
      s.missCount = 0;
      s.songsCompleted = 0;
      s.heldSet.clear();
      s.heldGridSet.clear();
      s.recentFreeNotes = [];
      s.selectedPracticeSong = null;
      s.practiceStepIdx = 0;

      setMode(targetMode);
      setScore(0);
      setCombo(0);
      setHearts(MAX_HALF_HEARTS);
      setHeldNotes([]);
      setHeldGridIds([]);
      setLastGridSpec(null);
      setRecentFreeNotes([]);
      setRecognizedSong(null);
      setSelectedPracticeSong(null);
      setPracticeStepIdx(0);
      setLastFeedback(null);
      setRunSummary(null);
      setCloudStatusMsg(null);
      setScoreboardOpen(false);
      loadSongStage(0);

      sceneRef.current?.setComboLevel(0);
      document.body.dataset.state = 'playing';
      setPhase('playing');
    },
    [loadSongStage, stopDemo],
  );

  const processPlayingGameplayNote = useCallback((note: NoteId) => {
    const s = simRef.current;
    if (s.phase !== 'playing') return;

    if (s.mode === 'livre') {
      const nextHist = [...s.recentFreeNotes, note].slice(-12);
      s.recentFreeNotes = nextHist;
      setRecentFreeNotes(nextHist);

      // Update practice step progress if a Songbook melody is selected
      if (s.selectedPracticeSong) {
        const targetSeq = s.selectedPracticeSong.sequence;
        if (targetSeq[s.practiceStepIdx] === note) {
          const nextStep = s.practiceStepIdx + 1;
          if (nextStep >= targetSeq.length) {
            s.practiceStepIdx = 0;
            setPracticeStepIdx(0);
          } else {
            s.practiceStepIdx = nextStep;
            setPracticeStepIdx(nextStep);
          }
        } else if (targetSeq[0] === note) {
          s.practiceStepIdx = 1;
          setPracticeStepIdx(1);
        } else {
          s.practiceStepIdx = 0;
          setPracticeStepIdx(0);
        }
      }

      const matched = matchSongSequence(nextHist);
      if (matched) {
        setRecognizedSong(matched);
        audioEngine.playSongFanfare();
        sceneRef.current?.triggerSongAura(matched.auraColor);
        s.recentFreeNotes = [];
      }
      return;
    }

    // Desafio Rhythm Mode: find closest pending matching note within timing window
    let bestItem: ScheduledBeatNote | null = null;
    let bestAbsDelta = Infinity;
    for (const item of s.schedule) {
      if (item.status !== 'pending' || item.note !== note) continue;
      const absDelta = Math.abs(item.targetTimeSec - s.songTimeSec);
      if (absDelta <= TIMING_WINDOW_GOOD && absDelta < bestAbsDelta) {
        bestAbsDelta = absDelta;
        bestItem = item;
      }
    }

    if (bestItem) {
      const grade = evaluateNoteHit(bestAbsDelta);
      bestItem.status = 'hit';
      bestItem.grade = grade;
      s.combo += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      if (grade === 'perfeito') s.perfectCount += 1;
      else s.goodCount += 1;

      const pts = computeHitPoints(grade, s.combo);
      s.score += pts;
      s.feedbackCounter += 1;

      setScore(s.score);
      setCombo(s.combo);
      setLastFeedback({ grade, id: s.feedbackCounter });
      setSchedule([...s.schedule]);
      sceneRef.current?.setComboLevel(s.combo);
    } else {
      s.combo = 0;
      s.missCount += 1;
      s.feedbackCounter += 1;
      setCombo(0);
      setLastFeedback({ grade: 'erro', id: s.feedbackCounter });
      sceneRef.current?.setComboLevel(0);
    }
  }, []);

  const handleNotePress = useCallback(
    (note: NoteId) => {
      if (demoTimersRef.current.length > 0) {
        stopDemo();
      }
      audioEngine.unlock();
      const s = simRef.current;
      if (s.heldSet.has(note)) return;

      s.heldSet.add(note);
      setHeldNotes(Array.from(s.heldSet));
      setLastGridSpec(null);
      sceneRef.current?.pressHoleVisual(note, true);
      audioEngine.startNote(note, s.semitoneShift);

      processPlayingGameplayNote(note);
    },
    [processPlayingGameplayNote, stopDemo],
  );

  const handleNoteRelease = useCallback((note: NoteId) => {
    const s = simRef.current;
    if (!s.heldSet.has(note)) return;
    s.heldSet.delete(note);
    setHeldNotes(Array.from(s.heldSet));
    sceneRef.current?.pressHoleVisual(note, false);
    audioEngine.stopNote(note);
  }, []);

  const handleGridNotePress = useCallback(
    (spec: GridNoteSpec) => {
      if (demoTimersRef.current.length > 0) {
        stopDemo();
      }
      audioEngine.unlock();
      const s = simRef.current;
      if (s.heldGridSet.has(spec.id)) return;

      s.heldGridSet.add(spec.id);
      setHeldGridIds(Array.from(s.heldGridSet));
      setLastGridSpec(spec);
      sceneRef.current?.pressHoleVisual(spec.mappedHole, true);
      audioEngine.startCustomNote(`grid_${spec.id}`, spec.frequencyHz, s.semitoneShift);

      const hintMap: Record<string, NoteId> = {
        A: 'A',
        '▼': 'DOWN',
        '▶': 'RIGHT',
        '◀': 'LEFT',
        '▲': 'UP',
      };
      const gameplayNote = spec.zeldaHint ? hintMap[spec.zeldaHint] ?? spec.mappedHole : spec.mappedHole;
      processPlayingGameplayNote(gameplayNote);
    },
    [processPlayingGameplayNote, stopDemo],
  );

  const handleGridNoteRelease = useCallback((spec: GridNoteSpec) => {
    const s = simRef.current;
    if (!s.heldGridSet.has(spec.id)) return;
    s.heldGridSet.delete(spec.id);
    setHeldGridIds(Array.from(s.heldGridSet));
    if (s.heldGridSet.size === 0) {
      setLastGridSpec(null);
    }
    sceneRef.current?.pressHoleVisual(spec.mappedHole, false);
    audioEngine.stopCustomNote(`grid_${spec.id}`);
  }, []);

  const handleSemitoneChange = useCallback((shift: number) => {
    simRef.current.semitoneShift = shift;
    setSemitoneShift(shift);
    sceneRef.current?.setPitchShiftVisual(shift);
    audioEngine.updateBend(shift, sceneRef.current?.getVibratoIntensity() ?? 0);
  }, []);

  const handleVibratoToggle = useCallback((active: boolean) => {
    setVibratoActive(active);
    audioEngine.setVibratoOverride(active);
  }, []);

  const handleSelectPracticeSong = useCallback((song: OcarinaSong | null) => {
    simRef.current.selectedPracticeSong = song;
    simRef.current.practiceStepIdx = 0;
    setSelectedPracticeSong(song);
    setPracticeStepIdx(0);
  }, []);

  const handlePlayDemo = useCallback(
    (song: OcarinaSong) => {
      stopDemo();
      audioEngine.unlock();
      setActiveDemoSongId(song.id);
      setRecognizedSong(null);
      simRef.current.selectedPracticeSong = song;
      simRef.current.practiceStepIdx = 0;
      setSelectedPracticeSong(song);
      setPracticeStepIdx(0);

      let maxEndMs = 0;
      song.demoSteps.forEach((step) => {
        const startMs = Math.round(step.startSec * 1000);
        const endMs = Math.round((step.startSec + step.durationSec) * 1000);
        maxEndMs = Math.max(maxEndMs, endMs);

        const tStart = window.setTimeout(() => {
          const shift = step.semitone ?? 0;
          simRef.current.semitoneShift = shift;
          setSemitoneShift(shift);
          sceneRef.current?.setPitchShiftVisual(shift);
          simRef.current.heldSet.add(step.note);
          setHeldNotes(Array.from(simRef.current.heldSet));
          sceneRef.current?.pressHoleVisual(step.note, true);
          audioEngine.startNote(step.note, shift);
        }, startMs);

        const tEnd = window.setTimeout(() => {
          simRef.current.heldSet.delete(step.note);
          setHeldNotes(Array.from(simRef.current.heldSet));
          sceneRef.current?.pressHoleVisual(step.note, false);
          audioEngine.stopNote(step.note);
        }, endMs);

        demoTimersRef.current.push(tStart, tEnd);
      });

      const tFinish = window.setTimeout(() => {
        demoTimersRef.current = [];
        setActiveDemoSongId(null);
        simRef.current.semitoneShift = 0;
        setSemitoneShift(0);
        sceneRef.current?.setPitchShiftVisual(0);
        setRecognizedSong(song);
        audioEngine.playSongFanfare();
        sceneRef.current?.triggerSongAura(song.auraColor);
      }, maxEndMs + 180);

      demoTimersRef.current.push(tFinish);
    },
    [stopDemo],
  );

  const handlePauseToggle = useCallback(() => {
    const s = simRef.current;
    if (s.phase === 'playing') {
      stopDemo();
      audioEngine.stopAllNotes();
      inputRef.current?.clearAllHeld();
      setPhase('paused');
      document.body.dataset.state = 'paused';
    } else if (s.phase === 'paused') {
      setPhase('playing');
      document.body.dataset.state = 'playing';
    }
  }, [stopDemo]);

  const handleMuteToggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioEngine.setMuted(next);
      return next;
    });
  }, []);

  // Mount Three.js Scene & Input Manager ONCE
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const scene = new OcarinaSceneController({
      onHolePress: (n) => handleNotePress(n),
      onHoleRelease: (n) => handleNoteRelease(n),
      onDragTilt: () => {
        audioEngine.updateBend(
          simRef.current.semitoneShift,
          sceneRef.current?.getVibratoIntensity() ?? 0,
        );
      },
    });
    scene.mount(canvasMountRef.current);
    sceneRef.current = scene;

    const input = new UnifiedInputManager({
      onNotePress: (n) => handleNotePress(n),
      onNoteRelease: (n) => handleNoteRelease(n),
      onGridNotePress: (spec) => handleGridNotePress(spec),
      onGridNoteRelease: (spec) => handleGridNoteRelease(spec),
      onSemitoneChange: (shift) => handleSemitoneChange(shift),
      onVibratoToggle: (active) => handleVibratoToggle(active),
      onAnalogTilt: (tx, ty) => {
        sceneRef.current?.setPointerTilt(tx, ty);
        audioEngine.updateBend(
          simRef.current.semitoneShift,
          sceneRef.current?.getVibratoIntensity() ?? 0,
        );
      },
      onStartOrConfirm: () => {
        if (simRef.current.phase === 'title') {
          startGame('desafio');
        }
      },
      onPauseToggle: () => handlePauseToggle(),
      onMuteToggle: () => handleMuteToggle(),
      onRestart: () => {
        if (simRef.current.phase !== 'title') {
          startGame(simRef.current.mode);
        }
      },
      onScoreboardToggle: () => setScoreboardOpen((o) => !o),
      onGamepadStatus: (connected, name) => setGamepadName(connected ? name : null),
    });
    inputRef.current = input;

    // Support ?autostart=1 for instant gameplay testing
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame('desafio');
    }

    return () => {
      stopDemo();
      input.dispose();
      scene.dispose();
      audioEngine.stopAllNotes();
    };
  }, [
    handleGridNotePress,
    handleGridNoteRelease,
    handleMuteToggle,
    handleNotePress,
    handleNoteRelease,
    handlePauseToggle,
    handleSemitoneChange,
    handleVibratoToggle,
    startGame,
    stopDemo,
  ]);

  // 60Hz Rhythm Chart Simulation Loop (Zero React setState unless discrete miss/song clear occurs)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const stepRhythm = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const s = simRef.current;
      if (s.phase === 'playing' && s.mode === 'desafio' && !s.scoreboardOpen) {
        s.songTimeSec += dt;

        // Smoothly translate musical staff track DOM node without React re-renders
        if (staffTrackRef.current) {
          const offsetPx = HIT_CURSOR_X - s.songTimeSec * PIXELS_PER_SEC;
          staffTrackRef.current.style.transform = `translate3d(${offsetPx.toFixed(1)}px, 0, 0)`;
        }

        // Check missed notes past timing window
        let missedAny = false;
        let allResolved = true;
        for (const item of s.schedule) {
          if (item.status === 'pending') {
            if (s.songTimeSec > item.targetTimeSec + TIMING_WINDOW_GOOD) {
              item.status = 'missed';
              missedAny = true;
              s.missCount += 1;
              s.combo = 0;
              s.hearts = Math.max(0, s.hearts - 1);
            } else {
              allResolved = false;
            }
          }
        }

        if (missedAny) {
          audioEngine.playMissSfx();
          s.feedbackCounter += 1;
          setCombo(0);
          setHearts(s.hearts);
          setLastFeedback({ grade: 'erro', id: s.feedbackCounter });
          setSchedule([...s.schedule]);
          sceneRef.current?.setComboLevel(0);

          if (s.hearts <= 0) {
            finishRun(false);
          }
        } else if (allResolved && s.schedule.length > 0) {
          const lastNoteEnd = s.schedule[s.schedule.length - 1].targetTimeSec + 0.55;
          if (s.songTimeSec >= lastNoteEnd) {
            // Song Completed!
            const currentSong = CHALLENGE_SONGS[s.songIndex];
            s.songsCompleted += 1;
            s.score += 500;
            s.hearts = Math.min(MAX_HALF_HEARTS, s.hearts + 2);
            setScore(s.score);
            setHearts(s.hearts);
            audioEngine.playSongFanfare();
            sceneRef.current?.triggerSongAura(currentSong.auraColor);

            if (s.songIndex + 1 >= CHALLENGE_SONGS.length) {
              finishRun(true);
            } else {
              loadSongStage(s.songIndex + 1);
            }
          }
        }
      }

      rafId = requestAnimationFrame(stepRhythm);
    };

    rafId = requestAnimationFrame(stepRhythm);
    return () => cancelAnimationFrame(rafId);
  }, [finishRun, loadSongStage]);

  // Firebase Auth & Cloud Leaderboard Subscription
  useEffect(() => {
    const unsubAuth = subscribeAuthUser((u) => {
      setUser(u);
      if (u?.displayName && !localStorage.getItem(LOCAL_NAME_KEY)) {
        setPlayerName(u.displayName.slice(0, 24));
      }
    });

    const unsubBoard = subscribeGlobalLeaderboard(
      (entries) => {
        setLeaderboard(entries);
        setLeaderboardLoading(false);
        sceneRef.current?.updateLeaderboardTexture(entries);
      },
      () => {
        setLeaderboardLoading(false);
      },
    );

    return () => {
      unsubAuth();
      unsubBoard();
    };
  }, []);

  const handleSignInAndSave = async () => {
    try {
      const signedUser = await signInWithGoogle();
      setUser(signedUser);
      const nameToUse = playerName.trim().length >= 2 ? playerName.trim() : signedUser.displayName || 'Viajante';
      if (runSummary && runSummary.score > 0) {
        setCloudSaving(true);
        const res = await submitCloudScore({
          playerName: nameToUse,
          score: runSummary.score,
          bestCombo: runSummary.bestCombo,
          accuracy: runSummary.accuracy,
          songsCompleted: runSummary.songsCompleted,
        });
        setCloudStatusMsg(
          res.isNewRecord
            ? 'Novo recorde salvo no Placar Global!'
            : 'Pontuação sincronizada na nuvem.',
        );
      }
    } catch (err) {
      console.error('Sign-in or save failed:', err);
      setCloudStatusMsg('Falha ao conectar com o Google.');
    } finally {
      setCloudSaving(false);
    }
  };

  const cloudTopScore = leaderboard.length > 0 ? leaderboard[0].score : null;

  return (
    <main
      className={`relative h-[100dvh] w-screen overflow-hidden bg-[#04060f] ${
        crtEnabled ? 'crt-active' : ''
      }`}
    >
      {/* Isolated WebGL Mount Container (Never re-renders on React HUD updates) */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />
      {crtEnabled && (
        <div
          data-testid="crt-tv-overlay"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
        >
          <div className="crt-phosphor-scanlines absolute inset-0" />
          <div className="crt-scan-beam absolute inset-x-0 h-24" />
          <div className="crt-tube-glass absolute inset-[2px] sm:inset-[4px]" />
        </div>
      )}

      {phase === 'title' && !scoreboardOpen && (
        <TitleOverlay
          onStart={(m) => startGame(m)}
          onOpenScoreboard={() => setScoreboardOpen((o) => !o)}
          bestLocalScore={bestLocalScore}
          cloudTopScore={cloudTopScore}
        />
      )}

      {phase !== 'title' && (
        <HudOverlay
          mode={mode}
          score={score}
          combo={combo}
          hearts={hearts}
          maxHearts={MAX_HALF_HEARTS}
          activeSong={CHALLENGE_SONGS[songIndex]}
          songIndex={songIndex}
          totalSongs={CHALLENGE_SONGS.length}
          heldNotes={heldNotes}
          heldGridIds={heldGridIds}
          lastGridSpec={lastGridSpec}
          semitoneShift={semitoneShift}
          vibratoActive={vibratoActive}
          lastFeedback={lastFeedback}
          recognizedSong={recognizedSong}
          recentFreeNotes={recentFreeNotes}
          activeDemoSongId={activeDemoSongId}
          selectedPracticeSong={selectedPracticeSong}
          practiceStepIdx={practiceStepIdx}
          muted={muted}
          crtEnabled={crtEnabled}
          scoreboardOpen={scoreboardOpen}
          gamepadName={gamepadName}
          schedule={schedule}
          staffTrackRef={staffTrackRef}
          onSwitchMode={(m) => startGame(m)}
          onToggleScoreboard={() => setScoreboardOpen((o) => !o)}
          onToggleMute={handleMuteToggle}
          onToggleCrt={() => setCrtEnabled((prev) => !prev)}
          onPause={handlePauseToggle}
          onGridPress={handleGridNotePress}
          onGridRelease={handleGridNoteRelease}
          onSemitoneChange={handleSemitoneChange}
          onVibratoToggle={handleVibratoToggle}
          onSelectPracticeSong={handleSelectPracticeSong}
          onPlayDemo={handlePlayDemo}
          onStopDemo={stopDemo}
        />
      )}

      {!scoreboardOpen && (
        <StatusModal
          phase={phase}
          summary={runSummary}
          bestLocalScore={bestLocalScore}
          user={user}
          cloudSaving={cloudSaving}
          cloudStatusMsg={cloudStatusMsg}
          onResume={handlePauseToggle}
          onRestart={() => startGame(mode)}
          onReturnTitle={() => {
            stopDemo();
            audioEngine.stopAllNotes();
            setScoreboardOpen(false);
            setPhase('title');
            document.body.dataset.state = 'title';
          }}
          onOpenScoreboard={() => setScoreboardOpen(true)}
          onSignInAndSave={() => void handleSignInAndSave()}
        />
      )}

      <LeaderboardDrawer
        open={scoreboardOpen}
        entries={leaderboard}
        loading={leaderboardLoading}
        user={user}
        playerName={playerName}
        onChangePlayerName={setPlayerName}
        onSaveNickname={async (n) => {
          await updatePlayerNickname(n);
        }}
        onSignIn={async () => {
          await handleSignInAndSave();
        }}
        onSignOut={async () => {
          await signOutUser();
        }}
        onClose={() => setScoreboardOpen(false)}
      />
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <OcarinaGame />
    </ErrorBoundary>
  );
}
