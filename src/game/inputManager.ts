import { GRID_15_NOTES, GridNoteSpec, NoteId } from './musicData';

export interface InputCallbacks {
  onNotePress: (note: NoteId) => void;
  onNoteRelease: (note: NoteId) => void;
  onGridNotePress?: (spec: GridNoteSpec) => void;
  onGridNoteRelease?: (spec: GridNoteSpec) => void;
  onSemitoneChange: (shift: number) => void;
  onPitchBendChange?: (shift: number) => void;
  onVibratoToggle?: (active: boolean) => void;
  onAnalogTilt: (tx: number, ty: number) => void;
  onStartOrConfirm: () => void;
  onPauseToggle: () => void;
  onMuteToggle: () => void;
  onRestart: () => void;
  onScoreboardToggle: () => void;
  onGamepadStatus: (connected: boolean, name: string | null) => void;
}

// Canonical Zelda 5-note directional + Space controls (never conflicts with 3x5 Q-B keys)
const KEY_TO_ZELDA_NOTE: Record<string, NoteId> = {
  Space: 'A',
  ArrowDown: 'DOWN',
  ArrowRight: 'RIGHT',
  ArrowLeft: 'LEFT',
  ArrowUp: 'UP',
};

const CODE_TO_GRID_NOTE: Record<string, GridNoteSpec> = Object.fromEntries(
  GRID_15_NOTES.map((item) => [item.keyCode, item]),
);

const MODIFIER_KEYS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'Equal',
  'BracketRight',
  'Minus',
  'BracketLeft',
]);

export class UnifiedInputManager {
  private callbacks: InputCallbacks;
  private heldKeys = new Set<string>();
  private keyNotes = new Set<NoteId>();
  private gridKeyNotes = new Set<string>();
  private gamepadNotes = new Set<NoteId>();
  private prevGpButtons = new Map<number, boolean>();
  private gamepadConnected = false;
  private rafId = 0;
  private disposed = false;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    this.bindEvents();
    this.pollGamepad();
  }

  private isTypingInInput(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
  }

  private emitSemitone(shift: number): void {
    this.callbacks.onSemitoneChange?.(shift);
    this.callbacks.onPitchBendChange?.(shift);
  }

  private computeKeyboardSemitone(): number {
    let shift = 0;
    if (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight')) shift += 1;
    if (this.heldKeys.has('AltLeft') || this.heldKeys.has('AltRight')) shift -= 1;
    if (this.heldKeys.has('Equal') || this.heldKeys.has('BracketRight')) shift += 2;
    if (this.heldKeys.has('Minus') || this.heldKeys.has('BracketLeft')) shift -= 2;
    return Math.max(-2, Math.min(2, shift));
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isTypingInInput(e.target)) return;

    const state = document.body.dataset.state;
    if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      if (!e.repeat) {
        this.callbacks.onStartOrConfirm?.();
      }
      return;
    }

    if (e.repeat) return;

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      this.callbacks.onPauseToggle?.();
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      this.callbacks.onMuteToggle?.();
      return;
    }
    if (e.code === 'F2') {
      e.preventDefault();
      this.callbacks.onRestart?.();
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      this.callbacks.onScoreboardToggle?.();
      return;
    }

    this.heldKeys.add(e.code);

    if (e.code === 'Semicolon' || e.code === 'Backslash') {
      this.callbacks.onVibratoToggle?.(true);
      return;
    }

    if (MODIFIER_KEYS.has(e.code)) {
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault();
      }
      this.emitSemitone(this.computeKeyboardSemitone());
      return;
    }

    const gridSpec = CODE_TO_GRID_NOTE[e.code];
    if (gridSpec) {
      e.preventDefault();
      if (!this.gridKeyNotes.has(gridSpec.id)) {
        this.gridKeyNotes.add(gridSpec.id);
        this.callbacks.onGridNotePress?.(gridSpec);
      }
      return;
    }

    const note = KEY_TO_ZELDA_NOTE[e.code];
    if (note) {
      e.preventDefault();
      if (!this.keyNotes.has(note)) {
        this.keyNotes.add(note);
        this.callbacks.onNotePress?.(note);
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);

    if (e.code === 'Semicolon' || e.code === 'Backslash') {
      this.callbacks.onVibratoToggle?.(false);
    }

    if (MODIFIER_KEYS.has(e.code)) {
      this.emitSemitone(this.computeKeyboardSemitone());
    }

    const gridSpec = CODE_TO_GRID_NOTE[e.code];
    if (gridSpec && this.gridKeyNotes.has(gridSpec.id)) {
      this.gridKeyNotes.delete(gridSpec.id);
      this.callbacks.onGridNoteRelease?.(gridSpec);
    }

    const note = KEY_TO_ZELDA_NOTE[e.code];
    if (note) {
      let stillHeld = false;
      for (const code of this.heldKeys) {
        if (KEY_TO_ZELDA_NOTE[code] === note) {
          stillHeld = true;
          break;
        }
      }
      if (!stillHeld && this.keyNotes.has(note)) {
        this.keyNotes.delete(note);
        this.callbacks.onNoteRelease?.(note);
      }
    }
  };

  public clearAllHeld = (): void => {
    this.heldKeys.clear();
    for (const note of Array.from(this.keyNotes)) {
      this.callbacks.onNoteRelease?.(note);
    }
    this.keyNotes.clear();
    for (const id of Array.from(this.gridKeyNotes)) {
      const spec = GRID_15_NOTES.find((g) => g.id === id);
      if (spec) this.callbacks.onGridNoteRelease?.(spec);
    }
    this.gridKeyNotes.clear();
    for (const note of Array.from(this.gamepadNotes)) {
      this.callbacks.onNoteRelease?.(note);
    }
    this.gamepadNotes.clear();
    this.callbacks.onVibratoToggle?.(false);
    this.emitSemitone(0);
  };

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.clearAllHeld();
    }
  };

  private handleGamepadConnected = (e: GamepadEvent): void => {
    this.gamepadConnected = true;
    this.callbacks.onGamepadStatus?.(true, e.gamepad.id.slice(0, 28));
  };

  private handleGamepadDisconnected = (): void => {
    this.gamepadConnected = false;
    this.callbacks.onGamepadStatus?.(false, null);
    this.clearAllHeld();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearAllHeld);
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  private pollGamepad = (): void => {
    if (this.disposed) return;

    const pads = navigator.getGamepads?.();
    let activePad: Gamepad | null = null;
    if (pads) {
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i]!.connected) {
          activePad = pads[i];
          break;
        }
      }
    }

    if (activePad) {
      if (!this.gamepadConnected) {
        this.gamepadConnected = true;
        this.callbacks.onGamepadStatus?.(true, activePad.id.slice(0, 28));
      }

      const desiredNotes = new Set<NoteId>();
      const b = activePad.buttons;

      if (b[0]?.pressed) desiredNotes.add('A');
      if (b[1]?.pressed || b[15]?.pressed) desiredNotes.add('RIGHT');
      if (b[2]?.pressed || b[14]?.pressed) desiredNotes.add('LEFT');
      if (b[3]?.pressed || b[12]?.pressed) desiredNotes.add('UP');
      if (b[13]?.pressed) desiredNotes.add('DOWN');

      const rx = activePad.axes[2] ?? 0;
      const ry = activePad.axes[3] ?? 0;
      if (rx > 0.55) desiredNotes.add('RIGHT');
      if (rx < -0.55) desiredNotes.add('LEFT');
      if (ry < -0.55) desiredNotes.add('UP');
      if (ry > 0.55) desiredNotes.add('DOWN');

      const lx = Math.abs(activePad.axes[0] ?? 0) > 0.14 ? (activePad.axes[0] ?? 0) : 0;
      const ly = Math.abs(activePad.axes[1] ?? 0) > 0.14 ? (activePad.axes[1] ?? 0) : 0;
      if (lx !== 0 || ly !== 0) {
        this.callbacks.onAnalogTilt?.(lx, ly);
      }

      let gpShift = 0;
      if (b[5]?.pressed) gpShift += 1;
      if (b[4]?.pressed || b[6]?.pressed) gpShift -= 1;
      if (ly < -0.65) gpShift += 2;
      else if (ly > 0.65) gpShift -= 2;

      if (gpShift !== 0) {
        this.emitSemitone(Math.max(-2, Math.min(2, gpShift)));
      } else if (this.heldKeys.size === 0) {
        this.emitSemitone(0);
      }

      const startPressed = Boolean(b[9]?.pressed);
      if (startPressed && !this.prevGpButtons.get(9)) {
        if (document.body.dataset.state === 'title') {
          this.callbacks.onStartOrConfirm?.();
        } else {
          this.callbacks.onPauseToggle?.();
        }
      }
      this.prevGpButtons.set(9, startPressed);

      for (const note of desiredNotes) {
        if (!this.gamepadNotes.has(note)) {
          this.gamepadNotes.add(note);
          this.callbacks.onNotePress?.(note);
        }
      }
      for (const note of Array.from(this.gamepadNotes)) {
        if (!desiredNotes.has(note)) {
          this.gamepadNotes.delete(note);
          this.callbacks.onNoteRelease?.(note);
        }
      }
    }

    this.rafId = requestAnimationFrame(this.pollGamepad);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearAllHeld);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }
}
