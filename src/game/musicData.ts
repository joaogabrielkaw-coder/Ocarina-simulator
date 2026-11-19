export type NoteId = 'A' | 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'desafio' | 'livre';
export type HitGrade = 'perfeito' | 'bom' | 'erro';

export interface NoteSpec {
  id: NoteId;
  symbol: string;
  label: string;
  pitchName: string;
  frequencyHz: number;
  staffStep: number; // 0 = bottom line (A), 4 = top line (UP)
  colorHex: string;
  glowHex: string;
  keyHint: string;
  holePos: [number, number, number]; // local position on 3D Ocarina body
}

export const OCARINA_NOTES: Record<NoteId, NoteSpec> = {
  A: {
    id: 'A',
    symbol: 'A',
    label: 'Ré (D4)',
    pitchName: 'D4',
    frequencyHz: 293.66,
    staffStep: 0,
    colorHex: '#28b8c5',
    glowHex: '#5eead4',
    keyHint: 'Espaço / Z',
    holePos: [-0.62, 0.25, 0.28],
  },
  DOWN: {
    id: 'DOWN',
    symbol: '▼',
    label: 'Fá (F4)',
    pitchName: 'F4',
    frequencyHz: 349.23,
    staffStep: 1,
    colorHex: '#eab308',
    glowHex: '#fde047',
    keyHint: '↓ / S',
    holePos: [-0.18, 0.30, 0.14],
  },
  RIGHT: {
    id: 'RIGHT',
    symbol: '▶',
    label: 'Lá (A4)',
    pitchName: 'A4',
    frequencyHz: 440.0,
    staffStep: 2,
    colorHex: '#f59e0b',
    glowHex: '#fcd34d',
    keyHint: '→ / D',
    holePos: [0.22, 0.29, 0.20],
  },
  LEFT: {
    id: 'LEFT',
    symbol: '◀',
    label: 'Si (B4)',
    pitchName: 'B4',
    frequencyHz: 493.88,
    staffStep: 3,
    colorHex: '#facc15',
    glowHex: '#fef08a',
    keyHint: '← / A',
    holePos: [0.16, 0.28, -0.22],
  },
  UP: {
    id: 'UP',
    symbol: '▲',
    label: 'Ré5 (D5)',
    pitchName: 'D5',
    frequencyHz: 587.33,
    staffStep: 4,
    colorHex: '#fbbf24',
    glowHex: '#fef3c7',
    keyHint: '↑ / W',
    holePos: [0.54, 0.255, -0.05],
  },
};

export const NOTE_ORDER: NoteId[] = ['A', 'DOWN', 'RIGHT', 'LEFT', 'UP'];

export interface OcarinaSong {
  id: string;
  title: string;
  subtitle: string;
  sequence: NoteId[];
  bpm: number;
  effect: 'auroras' | 'tempestade' | 'galope' | 'floresta' | 'amanhecer' | 'tempo';
  auraColor: string;
  chartBeats: Array<{ note: NoteId; beatOffset: number; durationBeats: number }>;
}

export const OCARINA_SONGS: OcarinaSong[] = [
  {
    id: 'lullaby',
    title: 'Canção Real de Ninar',
    subtitle: 'Melodia Sagrada da Família Real',
    sequence: ['LEFT', 'UP', 'RIGHT', 'LEFT', 'UP', 'RIGHT'],
    bpm: 92,
    effect: 'auroras',
    auraColor: '#60a5fa',
    chartBeats: [
      { note: 'LEFT', beatOffset: 0, durationBeats: 1.0 },
      { note: 'UP', beatOffset: 1.5, durationBeats: 0.75 },
      { note: 'RIGHT', beatOffset: 2.5, durationBeats: 1.5 },
      { note: 'LEFT', beatOffset: 4.5, durationBeats: 1.0 },
      { note: 'UP', beatOffset: 6.0, durationBeats: 0.75 },
      { note: 'RIGHT', beatOffset: 7.0, durationBeats: 1.5 },
      { note: 'LEFT', beatOffset: 9.0, durationBeats: 0.8 },
      { note: 'UP', beatOffset: 10.0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 11.0, durationBeats: 1.8 },
    ],
  },
  {
    id: 'epona',
    title: 'Galope da Campina',
    subtitle: 'Chamado dos Ventos Dourados',
    sequence: ['UP', 'LEFT', 'RIGHT', 'UP', 'LEFT', 'RIGHT'],
    bpm: 104,
    effect: 'galope',
    auraColor: '#f59e0b',
    chartBeats: [
      { note: 'UP', beatOffset: 0, durationBeats: 0.8 },
      { note: 'LEFT', beatOffset: 1.0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 2.0, durationBeats: 1.4 },
      { note: 'UP', beatOffset: 3.8, durationBeats: 0.8 },
      { note: 'LEFT', beatOffset: 4.8, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 5.8, durationBeats: 1.4 },
      { note: 'UP', beatOffset: 7.5, durationBeats: 0.7 },
      { note: 'LEFT', beatOffset: 8.4, durationBeats: 0.7 },
      { note: 'RIGHT', beatOffset: 9.3, durationBeats: 0.9 },
      { note: 'DOWN', beatOffset: 10.4, durationBeats: 1.5 },
    ],
  },
  {
    id: 'saria',
    title: 'Melodia da Floresta',
    subtitle: 'Eco Ancestral de Kokiri',
    sequence: ['DOWN', 'RIGHT', 'LEFT', 'DOWN', 'RIGHT', 'LEFT'],
    bpm: 112,
    effect: 'floresta',
    auraColor: '#34d399',
    chartBeats: [
      { note: 'DOWN', beatOffset: 0, durationBeats: 0.6 },
      { note: 'RIGHT', beatOffset: 0.8, durationBeats: 0.6 },
      { note: 'LEFT', beatOffset: 1.6, durationBeats: 1.0 },
      { note: 'DOWN', beatOffset: 2.8, durationBeats: 0.6 },
      { note: 'RIGHT', beatOffset: 3.6, durationBeats: 0.6 },
      { note: 'LEFT', beatOffset: 4.4, durationBeats: 1.0 },
      { note: 'DOWN', beatOffset: 5.6, durationBeats: 0.6 },
      { note: 'RIGHT', beatOffset: 6.4, durationBeats: 0.6 },
      { note: 'LEFT', beatOffset: 7.2, durationBeats: 0.7 },
      { note: 'UP', beatOffset: 8.1, durationBeats: 0.8 },
      { note: 'LEFT', beatOffset: 9.1, durationBeats: 1.4 },
    ],
  },
  {
    id: 'storms',
    title: 'Canção da Tempestade',
    subtitle: 'Ritmo Trovejante do Moinho',
    sequence: ['A', 'DOWN', 'UP', 'A', 'DOWN', 'UP'],
    bpm: 120,
    effect: 'tempestade',
    auraColor: '#38bdf8',
    chartBeats: [
      { note: 'A', beatOffset: 0, durationBeats: 0.55 },
      { note: 'DOWN', beatOffset: 0.7, durationBeats: 0.55 },
      { note: 'UP', beatOffset: 1.4, durationBeats: 1.1 },
      { note: 'A', beatOffset: 2.8, durationBeats: 0.55 },
      { note: 'DOWN', beatOffset: 3.5, durationBeats: 0.55 },
      { note: 'UP', beatOffset: 4.2, durationBeats: 1.1 },
      { note: 'UP', beatOffset: 5.6, durationBeats: 0.6 },
      { note: 'RIGHT', beatOffset: 6.4, durationBeats: 0.6 },
      { note: 'LEFT', beatOffset: 7.2, durationBeats: 0.6 },
      { note: 'DOWN', beatOffset: 8.0, durationBeats: 0.7 },
      { note: 'A', beatOffset: 8.9, durationBeats: 1.4 },
    ],
  },
  {
    id: 'sun',
    title: 'Canção do Sol Dourado',
    subtitle: 'Luz Eterna do Amanhecer',
    sequence: ['RIGHT', 'DOWN', 'UP', 'RIGHT', 'DOWN', 'UP'],
    bpm: 126,
    effect: 'amanhecer',
    auraColor: '#fde047',
    chartBeats: [
      { note: 'RIGHT', beatOffset: 0, durationBeats: 0.6 },
      { note: 'DOWN', beatOffset: 0.75, durationBeats: 0.6 },
      { note: 'UP', beatOffset: 1.5, durationBeats: 1.1 },
      { note: 'RIGHT', beatOffset: 2.8, durationBeats: 0.6 },
      { note: 'DOWN', beatOffset: 3.55, durationBeats: 0.6 },
      { note: 'UP', beatOffset: 4.3, durationBeats: 1.1 },
      { note: 'RIGHT', beatOffset: 5.7, durationBeats: 0.5 },
      { note: 'UP', beatOffset: 6.35, durationBeats: 0.5 },
      { note: 'LEFT', beatOffset: 7.0, durationBeats: 0.5 },
      { note: 'RIGHT', beatOffset: 7.65, durationBeats: 0.5 },
      { note: 'DOWN', beatOffset: 8.3, durationBeats: 0.6 },
      { note: 'UP', beatOffset: 9.1, durationBeats: 1.4 },
    ],
  },
  {
    id: 'time',
    title: 'Canção do Tempo',
    subtitle: 'Portal do Templo Sagrado',
    sequence: ['RIGHT', 'A', 'DOWN', 'RIGHT', 'A', 'DOWN'],
    bpm: 132,
    effect: 'tempo',
    auraColor: '#c084fc',
    chartBeats: [
      { note: 'RIGHT', beatOffset: 0, durationBeats: 0.7 },
      { note: 'A', beatOffset: 0.9, durationBeats: 0.9 },
      { note: 'DOWN', beatOffset: 2.0, durationBeats: 0.7 },
      { note: 'RIGHT', beatOffset: 2.9, durationBeats: 0.7 },
      { note: 'A', beatOffset: 3.8, durationBeats: 0.9 },
      { note: 'DOWN', beatOffset: 4.9, durationBeats: 0.7 },
      { note: 'RIGHT', beatOffset: 5.8, durationBeats: 0.55 },
      { note: 'LEFT', beatOffset: 6.5, durationBeats: 0.55 },
      { note: 'UP', beatOffset: 7.2, durationBeats: 0.55 },
      { note: 'LEFT', beatOffset: 7.9, durationBeats: 0.55 },
      { note: 'RIGHT', beatOffset: 8.6, durationBeats: 0.7 },
      { note: 'A', beatOffset: 9.5, durationBeats: 1.5 },
    ],
  },
];

export function computeNoteFrequency(note: NoteId, semitoneShift: number): number {
  const base = OCARINA_NOTES[note].frequencyHz;
  if (semitoneShift === 0) return base;
  return base * Math.pow(2, semitoneShift / 12);
}

/**
 * Checks if the tail of recentNotes matches any canonical Ocarina song sequence.
 */
export function matchSongSequence(recentNotes: NoteId[]): OcarinaSong | null {
  for (const song of OCARINA_SONGS) {
    const seq = song.sequence;
    if (recentNotes.length < seq.length) continue;
    const offset = recentNotes.length - seq.length;
    let matched = true;
    for (let i = 0; i < seq.length; i++) {
      if (recentNotes[offset + i] !== seq[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return song;
  }
  return null;
}

export const TIMING_WINDOW_PERFECT = 0.115; // seconds
export const TIMING_WINDOW_GOOD = 0.255; // seconds

export function evaluateNoteHit(absDeltaSeconds: number): HitGrade {
  if (absDeltaSeconds <= TIMING_WINDOW_PERFECT) return 'perfeito';
  if (absDeltaSeconds <= TIMING_WINDOW_GOOD) return 'bom';
  return 'erro';
}

export function computeHitPoints(grade: HitGrade, comboAfterHit: number): number {
  if (grade === 'erro') return 0;
  const base = grade === 'perfeito' ? 150 : 90;
  const multiplier = Math.min(4, 1 + Math.floor(comboAfterHit / 5) * 0.5);
  return Math.round(base * multiplier);
}

export function computeAccuracyPercent(perfectCount: number, goodCount: number, totalResolved: number): number {
  if (totalResolved <= 0) return 100;
  const weighted = perfectCount + goodCount * 0.7;
  const pct = (weighted / totalResolved) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

export interface ScheduledBeatNote {
  uid: number;
  note: NoteId;
  targetTimeSec: number;
  durationSec: number;
  status: 'pending' | 'hit' | 'missed';
  grade?: HitGrade;
}

export function buildSongSchedule(
  song: OcarinaSong,
  startTimeSec: number,
  tempoScale = 1,
): ScheduledBeatNote[] {
  const secPerBeat = 60 / (song.bpm * tempoScale);
  return song.chartBeats.map((b, idx) => ({
    uid: idx,
    note: b.note,
    targetTimeSec: startTimeSec + b.beatOffset * secPerBeat,
    durationSec: Math.max(0.22, b.durationBeats * secPerBeat),
    status: 'pending',
  }));
}

export interface LeaderboardPayload {
  uid: string;
  playerName: string;
  score: number;
  bestCombo: number;
  accuracy: number;
  songsCompleted: number;
  mode: 'desafio';
  isPublic: true;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Enforces exact firebase-blueprint.json bounds & validation constraints prior to Firestore writes.
 */
export function sanitizeLeaderboardPayload(input: {
  uid: string;
  playerName: string;
  score: number;
  bestCombo: number;
  accuracy: number;
  songsCompleted: number;
}): LeaderboardPayload | null {
  const uid = input.uid.trim();
  if (!uid || uid.length > 128 || !VALID_ID_REGEX.test(uid)) {
    return null;
  }

  let cleanName = input.playerName.replace(/\s+/g, ' ').trim();
  if (cleanName.length < 2) {
    cleanName = 'Viajante';
  }
  if (cleanName.length > 24) {
    cleanName = cleanName.slice(0, 24).trim();
  }
  if (cleanName.length < 2) {
    cleanName = 'Viajante';
  }

  const score = Math.max(0, Math.min(9999999, Math.round(input.score)));
  const bestCombo = Math.max(0, Math.min(9999, Math.round(input.bestCombo)));
  const accuracy = Math.max(0, Math.min(100, Math.round(input.accuracy * 10) / 10));
  const songsCompleted = Math.max(0, Math.min(999, Math.round(input.songsCompleted)));

  return {
    uid,
    playerName: cleanName,
    score,
    bestCombo,
    accuracy,
    songsCompleted,
    mode: 'desafio',
    isPublic: true,
  };
}
