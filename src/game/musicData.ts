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
  midiNote: number; // D4=62, F4=65, A4=69, B4=71, D5=74
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
    midiNote: 62,
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
    midiNote: 65,
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
    midiNote: 69,
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
    midiNote: 71,
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
    midiNote: 74,
    staffStep: 4,
    colorHex: '#fbbf24',
    glowHex: '#fef3c7',
    keyHint: '↑ / W',
    holePos: [0.54, 0.255, -0.05],
  },
};

export const NOTE_ORDER: NoteId[] = ['A', 'DOWN', 'RIGHT', 'LEFT', 'UP'];

export interface GridNoteSpec {
  id: string;
  label: string;
  keyLabel: string;
  keyCode: string;
  frequencyHz: number;
  midiNote: number;
  mappedHole: NoteId;
  zeldaHint?: string;
}

/**
 * Exact 3x5 keypad layout from the reference screenshot:
 * Row 1: D6(Q) E6(W) F6(E) G6(R) A6(T)
 * Row 2: F5(A) G5(S) A5(D) B5(F) C6(G)
 * Row 3: A4(Z) B4(X) C5(C) D5(V) E5(B)
 */
export const GRID_15_NOTES: GridNoteSpec[] = [
  // Row 1
  { id: 'D6', label: 'D6', keyLabel: 'Q', keyCode: 'KeyQ', frequencyHz: 1174.66, midiNote: 86, mappedHole: 'UP', zeldaHint: '▲' },
  { id: 'E6', label: 'E6', keyLabel: 'W', keyCode: 'KeyW', frequencyHz: 1318.51, midiNote: 88, mappedHole: 'UP' },
  { id: 'F6', label: 'F6', keyLabel: 'E', keyCode: 'KeyE', frequencyHz: 1396.91, midiNote: 89, mappedHole: 'UP' },
  { id: 'G6', label: 'G6', keyLabel: 'R', keyCode: 'KeyR', frequencyHz: 1567.98, midiNote: 91, mappedHole: 'RIGHT' },
  { id: 'A6', label: 'A6', keyLabel: 'T', keyCode: 'KeyT', frequencyHz: 1760.0, midiNote: 93, mappedHole: 'RIGHT' },
  // Row 2
  { id: 'F5', label: 'F5', keyLabel: 'A', keyCode: 'KeyA', frequencyHz: 698.46, midiNote: 77, mappedHole: 'DOWN', zeldaHint: '▼' },
  { id: 'G5', label: 'G5', keyLabel: 'S', keyCode: 'KeyS', frequencyHz: 783.99, midiNote: 79, mappedHole: 'DOWN' },
  { id: 'A5', label: 'A5', keyLabel: 'D', keyCode: 'KeyD', frequencyHz: 880.0, midiNote: 81, mappedHole: 'RIGHT', zeldaHint: '▶' },
  { id: 'B5', label: 'B5', keyLabel: 'F', keyCode: 'KeyF', frequencyHz: 987.77, midiNote: 83, mappedHole: 'LEFT', zeldaHint: '◀' },
  { id: 'C6', label: 'C6', keyLabel: 'G', keyCode: 'KeyG', frequencyHz: 1046.5, midiNote: 84, mappedHole: 'LEFT' },
  // Row 3
  { id: 'A4', label: 'A4', keyLabel: 'Z', keyCode: 'KeyZ', frequencyHz: 440.0, midiNote: 69, mappedHole: 'RIGHT' },
  { id: 'B4', label: 'B4', keyLabel: 'X', keyCode: 'KeyX', frequencyHz: 493.88, midiNote: 71, mappedHole: 'LEFT' },
  { id: 'C5', label: 'C5', keyLabel: 'C', keyCode: 'KeyC', frequencyHz: 523.25, midiNote: 72, mappedHole: 'A' },
  { id: 'D5', label: 'D5', keyLabel: 'V', keyCode: 'KeyV', frequencyHz: 587.33, midiNote: 74, mappedHole: 'A', zeldaHint: 'A' },
  { id: 'E5', label: 'E5', keyLabel: 'B', keyCode: 'KeyB', frequencyHz: 659.25, midiNote: 76, mappedHole: 'DOWN' },
];

const CHROMATIC_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function getMidiNoteName(midiNote: number, semitoneShift = 0): string {
  const midi = midiNote + Math.round(semitoneShift);
  const name = CHROMATIC_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function getMusicalNoteName(note: NoteId, semitoneShift = 0): string {
  return getMidiNoteName(OCARINA_NOTES[note].midiNote, semitoneShift);
}

export interface DemoNoteStep {
  note: NoteId;
  semitone?: number;
  startSec: number;
  durationSec: number;
}

export interface OcarinaSong {
  id: string;
  title: string;
  subtitle: string;
  category: 'principal' | 'templo';
  sequence: NoteId[];
  bpm: number;
  effect: 'auroras' | 'tempestade' | 'galope' | 'floresta' | 'amanhecer' | 'tempo';
  auraColor: string;
  chartBeats: Array<{ note: NoteId; beatOffset: number; durationBeats: number }>;
  demoSteps: DemoNoteStep[];
}

export const OCARINA_SONGS: OcarinaSong[] = [
  {
    id: 'lullaby',
    title: 'Canção Real de Ninar',
    subtitle: 'Melodia da Família Real de Hyrule',
    category: 'principal',
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
    demoSteps: [
      { note: 'LEFT', startSec: 0.0, durationSec: 0.78 },
      { note: 'UP', startSec: 0.85, durationSec: 0.36 },
      { note: 'RIGHT', startSec: 1.25, durationSec: 0.95 },
      { note: 'LEFT', startSec: 2.35, durationSec: 0.78 },
      { note: 'UP', startSec: 3.2, durationSec: 0.36 },
      { note: 'RIGHT', startSec: 3.6, durationSec: 0.95 },
      { note: 'LEFT', startSec: 4.7, durationSec: 0.75 },
      { note: 'UP', startSec: 5.52, durationSec: 0.36 },
      { note: 'RIGHT', semitone: 2, startSec: 5.95, durationSec: 0.55 },
      { note: 'UP', startSec: 6.56, durationSec: 0.38 },
      { note: 'RIGHT', startSec: 7.0, durationSec: 1.15 },
    ],
  },
  {
    id: 'epona',
    title: 'Canção de Epona',
    subtitle: 'Chamado da Campina Lon Lon',
    category: 'principal',
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
    demoSteps: [
      { note: 'UP', startSec: 0.0, durationSec: 0.34 },
      { note: 'LEFT', startSec: 0.38, durationSec: 0.34 },
      { note: 'RIGHT', startSec: 0.76, durationSec: 0.85 },
      { note: 'UP', startSec: 1.72, durationSec: 0.34 },
      { note: 'LEFT', startSec: 2.1, durationSec: 0.34 },
      { note: 'RIGHT', startSec: 2.48, durationSec: 0.85 },
      { note: 'UP', startSec: 3.44, durationSec: 0.34 },
      { note: 'LEFT', startSec: 3.82, durationSec: 0.34 },
      { note: 'RIGHT', startSec: 4.2, durationSec: 0.55 },
      { note: 'LEFT', startSec: 4.82, durationSec: 0.45 },
      { note: 'RIGHT', startSec: 5.34, durationSec: 1.0 },
    ],
  },
  {
    id: 'saria',
    title: 'Canção de Saria',
    subtitle: 'Eco da Floresta Perdida',
    category: 'principal',
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
    demoSteps: [
      { note: 'DOWN', startSec: 0.0, durationSec: 0.24 },
      { note: 'RIGHT', startSec: 0.28, durationSec: 0.24 },
      { note: 'LEFT', startSec: 0.56, durationSec: 0.48 },
      { note: 'DOWN', startSec: 1.12, durationSec: 0.24 },
      { note: 'RIGHT', startSec: 1.4, durationSec: 0.24 },
      { note: 'LEFT', startSec: 1.68, durationSec: 0.48 },
      { note: 'DOWN', startSec: 2.24, durationSec: 0.24 },
      { note: 'RIGHT', startSec: 2.52, durationSec: 0.24 },
      { note: 'LEFT', startSec: 2.8, durationSec: 0.26 },
      { note: 'UP', semitone: 2, startSec: 3.1, durationSec: 0.36 },
      { note: 'LEFT', startSec: 3.52, durationSec: 0.55 },
      { note: 'RIGHT', startSec: 4.12, durationSec: 0.26 },
      { note: 'LEFT', startSec: 4.44, durationSec: 0.26 },
      { note: 'RIGHT', semitone: -2, startSec: 4.76, durationSec: 0.26 },
      { note: 'DOWN', semitone: -1, startSec: 5.08, durationSec: 0.9 },
    ],
  },
  {
    id: 'storms',
    title: 'Canção da Tempestade',
    subtitle: 'Ritmo do Moinho de Kakariko',
    category: 'principal',
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
    demoSteps: [
      { note: 'A', startSec: 0.0, durationSec: 0.22 },
      { note: 'DOWN', startSec: 0.26, durationSec: 0.22 },
      { note: 'UP', startSec: 0.52, durationSec: 0.68 },
      { note: 'A', startSec: 1.32, durationSec: 0.22 },
      { note: 'DOWN', startSec: 1.58, durationSec: 0.22 },
      { note: 'UP', startSec: 1.84, durationSec: 0.68 },
      { note: 'UP', semitone: 2, startSec: 2.66, durationSec: 0.36 },
      { note: 'UP', semitone: 1, startSec: 3.06, durationSec: 0.2 },
      { note: 'UP', semitone: 2, startSec: 3.3, durationSec: 0.2 },
      { note: 'UP', semitone: 1, startSec: 3.54, durationSec: 0.2 },
      { note: 'LEFT', semitone: 1, startSec: 3.78, durationSec: 0.22 },
      { note: 'RIGHT', startSec: 4.04, durationSec: 0.85 },
    ],
  },
  {
    id: 'sun',
    title: 'Canção do Sol',
    subtitle: 'Luz do Amanhecer no Cemitério',
    category: 'principal',
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
    demoSteps: [
      { note: 'RIGHT', startSec: 0.0, durationSec: 0.24 },
      { note: 'DOWN', startSec: 0.28, durationSec: 0.24 },
      { note: 'UP', startSec: 0.56, durationSec: 0.72 },
      { note: 'RIGHT', startSec: 1.42, durationSec: 0.24 },
      { note: 'DOWN', startSec: 1.7, durationSec: 0.24 },
      { note: 'UP', startSec: 1.98, durationSec: 0.72 },
      { note: 'RIGHT', startSec: 2.84, durationSec: 0.22 },
      { note: 'LEFT', startSec: 3.1, durationSec: 0.22 },
      { note: 'UP', startSec: 3.36, durationSec: 0.24 },
      { note: 'UP', semitone: 2, startSec: 3.64, durationSec: 0.9 },
    ],
  },
  {
    id: 'time',
    title: 'Canção do Tempo',
    subtitle: 'Portal do Templo do Tempo',
    category: 'principal',
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
    demoSteps: [
      { note: 'RIGHT', startSec: 0.0, durationSec: 0.42 },
      { note: 'A', startSec: 0.46, durationSec: 0.82 },
      { note: 'DOWN', startSec: 1.34, durationSec: 0.42 },
      { note: 'RIGHT', startSec: 1.8, durationSec: 0.42 },
      { note: 'A', startSec: 2.26, durationSec: 0.82 },
      { note: 'DOWN', startSec: 3.14, durationSec: 0.42 },
      { note: 'RIGHT', startSec: 3.62, durationSec: 0.24 },
      { note: 'LEFT', semitone: 1, startSec: 3.9, durationSec: 0.24 },
      { note: 'RIGHT', startSec: 4.18, durationSec: 0.42 },
      { note: 'DOWN', startSec: 4.64, durationSec: 0.42 },
      { note: 'DOWN', semitone: -1, startSec: 5.1, durationSec: 0.24 },
      { note: 'DOWN', semitone: 2, startSec: 5.38, durationSec: 0.24 },
      { note: 'A', startSec: 5.66, durationSec: 1.0 },
    ],
  },
  // 6 Temple Warp Melodies
  {
    id: 'minuet',
    title: 'Minueto da Floresta',
    subtitle: 'Teleporte · Templo da Floresta',
    category: 'templo',
    sequence: ['A', 'UP', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT'],
    bpm: 108,
    effect: 'floresta',
    auraColor: '#4ade80',
    chartBeats: [
      { note: 'A', beatOffset: 0, durationBeats: 0.8 },
      { note: 'UP', beatOffset: 1.0, durationBeats: 0.8 },
      { note: 'LEFT', beatOffset: 2.0, durationBeats: 0.7 },
      { note: 'RIGHT', beatOffset: 2.9, durationBeats: 0.7 },
      { note: 'LEFT', beatOffset: 3.8, durationBeats: 0.7 },
      { note: 'RIGHT', beatOffset: 4.7, durationBeats: 1.4 },
    ],
    demoSteps: [
      { note: 'A', startSec: 0.0, durationSec: 0.36 },
      { note: 'UP', startSec: 0.42, durationSec: 0.54 },
      { note: 'LEFT', startSec: 1.02, durationSec: 0.36 },
      { note: 'RIGHT', startSec: 1.44, durationSec: 0.36 },
      { note: 'LEFT', startSec: 1.86, durationSec: 0.36 },
      { note: 'RIGHT', startSec: 2.28, durationSec: 1.0 },
    ],
  },
  {
    id: 'bolero',
    title: 'Bolero do Fogo',
    subtitle: 'Teleporte · Cratera da Montanha',
    category: 'templo',
    sequence: ['DOWN', 'A', 'DOWN', 'A', 'RIGHT', 'DOWN', 'RIGHT', 'DOWN'],
    bpm: 116,
    effect: 'amanhecer',
    auraColor: '#fb7185',
    chartBeats: [
      { note: 'DOWN', beatOffset: 0, durationBeats: 0.6 },
      { note: 'A', beatOffset: 0.7, durationBeats: 0.6 },
      { note: 'DOWN', beatOffset: 1.4, durationBeats: 0.6 },
      { note: 'A', beatOffset: 2.1, durationBeats: 0.6 },
      { note: 'RIGHT', beatOffset: 2.8, durationBeats: 0.6 },
      { note: 'DOWN', beatOffset: 3.5, durationBeats: 0.6 },
      { note: 'RIGHT', beatOffset: 4.2, durationBeats: 0.6 },
      { note: 'DOWN', beatOffset: 4.9, durationBeats: 1.2 },
    ],
    demoSteps: [
      { note: 'DOWN', startSec: 0.0, durationSec: 0.28 },
      { note: 'A', startSec: 0.32, durationSec: 0.28 },
      { note: 'DOWN', startSec: 0.64, durationSec: 0.28 },
      { note: 'A', startSec: 0.96, durationSec: 0.28 },
      { note: 'RIGHT', startSec: 1.28, durationSec: 0.28 },
      { note: 'DOWN', startSec: 1.6, durationSec: 0.28 },
      { note: 'RIGHT', startSec: 1.92, durationSec: 0.28 },
      { note: 'DOWN', startSec: 2.24, durationSec: 0.95 },
    ],
  },
  {
    id: 'serenade',
    title: 'Serenata da Água',
    subtitle: 'Teleporte · Lago Hylia',
    category: 'templo',
    sequence: ['A', 'DOWN', 'RIGHT', 'RIGHT', 'LEFT'],
    bpm: 98,
    effect: 'auroras',
    auraColor: '#38bdf8',
    chartBeats: [
      { note: 'A', beatOffset: 0, durationBeats: 0.8 },
      { note: 'DOWN', beatOffset: 1.0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 2.0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 3.0, durationBeats: 0.8 },
      { note: 'LEFT', beatOffset: 4.0, durationBeats: 1.6 },
    ],
    demoSteps: [
      { note: 'A', startSec: 0.0, durationSec: 0.44 },
      { note: 'DOWN', startSec: 0.48, durationSec: 0.44 },
      { note: 'RIGHT', startSec: 0.96, durationSec: 0.44 },
      { note: 'RIGHT', startSec: 1.44, durationSec: 0.44 },
      { note: 'LEFT', startSec: 1.92, durationSec: 1.2 },
    ],
  },
  {
    id: 'requiem',
    title: 'Réquiem do Espírito',
    subtitle: 'Teleporte · Colosso do Deserto',
    category: 'templo',
    sequence: ['A', 'DOWN', 'A', 'RIGHT', 'DOWN', 'A'],
    bpm: 94,
    effect: 'galope',
    auraColor: '#fb923c',
    chartBeats: [
      { note: 'A', beatOffset: 0, durationBeats: 0.9 },
      { note: 'DOWN', beatOffset: 1.1, durationBeats: 0.6 },
      { note: 'A', beatOffset: 1.9, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 2.9, durationBeats: 0.8 },
      { note: 'DOWN', beatOffset: 3.9, durationBeats: 0.8 },
      { note: 'A', beatOffset: 4.9, durationBeats: 1.6 },
    ],
    demoSteps: [
      { note: 'A', startSec: 0.0, durationSec: 0.56 },
      { note: 'DOWN', startSec: 0.62, durationSec: 0.34 },
      { note: 'A', startSec: 1.0, durationSec: 0.46 },
      { note: 'RIGHT', startSec: 1.52, durationSec: 0.46 },
      { note: 'DOWN', startSec: 2.04, durationSec: 0.46 },
      { note: 'A', startSec: 2.56, durationSec: 1.15 },
    ],
  },
  {
    id: 'nocturne',
    title: 'Noturno das Sombras',
    subtitle: 'Teleporte · Templo das Sombras',
    category: 'templo',
    sequence: ['LEFT', 'RIGHT', 'RIGHT', 'A', 'LEFT', 'RIGHT', 'DOWN'],
    bpm: 102,
    effect: 'tempo',
    auraColor: '#a855f7',
    chartBeats: [
      { note: 'LEFT', beatOffset: 0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 1.0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 2.0, durationBeats: 0.7 },
      { note: 'A', beatOffset: 2.9, durationBeats: 0.7 },
      { note: 'LEFT', beatOffset: 3.8, durationBeats: 0.7 },
      { note: 'RIGHT', beatOffset: 4.7, durationBeats: 0.7 },
      { note: 'DOWN', beatOffset: 5.6, durationBeats: 1.6 },
    ],
    demoSteps: [
      { note: 'LEFT', startSec: 0.0, durationSec: 0.5 },
      { note: 'RIGHT', startSec: 0.56, durationSec: 0.5 },
      { note: 'RIGHT', startSec: 1.12, durationSec: 0.34 },
      { note: 'A', startSec: 1.5, durationSec: 0.34 },
      { note: 'LEFT', startSec: 1.88, durationSec: 0.34 },
      { note: 'RIGHT', startSec: 2.26, durationSec: 0.34 },
      { note: 'DOWN', startSec: 2.64, durationSec: 1.15 },
    ],
  },
  {
    id: 'prelude',
    title: 'Prelúdio da Luz',
    subtitle: 'Teleporte · Templo da Luz',
    category: 'templo',
    sequence: ['UP', 'RIGHT', 'UP', 'RIGHT', 'LEFT', 'UP'],
    bpm: 106,
    effect: 'amanhecer',
    auraColor: '#fef08a',
    chartBeats: [
      { note: 'UP', beatOffset: 0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 1.0, durationBeats: 0.8 },
      { note: 'UP', beatOffset: 2.0, durationBeats: 0.8 },
      { note: 'RIGHT', beatOffset: 3.0, durationBeats: 0.8 },
      { note: 'LEFT', beatOffset: 4.0, durationBeats: 0.8 },
      { note: 'UP', beatOffset: 5.0, durationBeats: 1.6 },
    ],
    demoSteps: [
      { note: 'UP', startSec: 0.0, durationSec: 0.44 },
      { note: 'RIGHT', startSec: 0.48, durationSec: 0.44 },
      { note: 'UP', startSec: 0.96, durationSec: 0.44 },
      { note: 'RIGHT', startSec: 1.44, durationSec: 0.44 },
      { note: 'LEFT', startSec: 1.92, durationSec: 0.44 },
      { note: 'UP', startSec: 2.4, durationSec: 1.2 },
    ],
  },
];

export const CHALLENGE_SONGS: OcarinaSong[] = OCARINA_SONGS.filter(
  (s) => s.category === 'principal',
);

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
