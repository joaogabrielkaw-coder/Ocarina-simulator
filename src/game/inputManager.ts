import { NoteId } from './musicData';

export interface InputCallbacks {
  onNotePress: (note: NoteId) => void;
  onNoteRelease: (note: NoteId) => void;
  onSemitoneChange: (shift: number) => void;
  onAnalogTilt: (tx: number, ty: number) => void;
  onStartOrConfirm: () => void;
  onPauseToggle: () => void;
  onMuteToggle: () => void;
  onRestart: () => void;
  onScoreboardToggle: () => void;
  onGamepadStatus: (connected: boolean, name: string | null) => void;
}

const KEY_TO_NOTE: Record<string, NoteId> = {
  Space: 'A',
  KeyZ: 'A',
  KeyK: 'A',
  ArrowDown: 'DOWN',
  KeyS: 'DOWN',
  KeyJ: 'DOWN',
  ArrowRight: 'RIGHT',
  KeyD: 'RIGHT',
  KeyL: 'RIGHT',
  ArrowLeft: 'LEFT',
  KeyA: 'LEFT',
  KeyH: 'LEFT',
  ArrowUp: 'UP',
  KeyW: 'UP',
  KeyI: 'UP',
};

export class UnifiedInputManager {
  private callbacks: InputCallbacks;
  private heldKeys = new Set<string>();
  private keyNotes = new Set<NoteId>();
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

  private computeKeyboardSemitone(): number {
    const sharp = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
    const flat = this.heldKeys.has('AltLeft') || this.heldKeys.has('KeyC');
    if (sharp && !flat) return 1;
    if (flat && !sharp) return -1;
    return 0;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isTypingInInput(e.target)) return;

    const state = document.body.dataset.state;
    if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      if (!e.repeat) {
        this.callbacks.onStartOrConfirm();
      }
      return;
    }

    if (e.repeat) return;

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      this.callbacks.onPauseToggle();
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      this.callbacks.onMuteToggle();
      return;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      this.callbacks.onRestart();
      return;
    }
    if (e.code === 'KeyT') {
      e.preventDefault();
      this.callbacks.onScoreboardToggle();
      return;
    }

    this.heldKeys.add(e.code);

    if (
      e.code === 'ShiftLeft' ||
      e.code === 'ShiftRight' ||
      e.code === 'AltLeft' ||
      e.code === 'KeyC'
    ) {
      this.callbacks.onSemitoneChange(this.computeKeyboardSemitone());
      return;
    }

    const note = KEY_TO_NOTE[e.code];
    if (note) {
      e.preventDefault();
      if (!this.keyNotes.has(note)) {
        this.keyNotes.add(note);
        this.callbacks.onNotePress(note);
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);

    if (
      e.code === 'ShiftLeft' ||
      e.code === 'ShiftRight' ||
      e.code === 'AltLeft' ||
      e.code === 'KeyC'
    ) {
      this.callbacks.onSemitoneChange(this.computeKeyboardSemitone());
    }

    const note = KEY_TO_NOTE[e.code];
    if (note) {
      // Only release if no other held key maps to the same note
      let stillHeld = false;
      for (const code of this.heldKeys) {
        if (KEY_TO_NOTE[code] === note) {
          stillHeld = true;
          break;
        }
      }
      if (!stillHeld && this.keyNotes.has(note)) {
        this.keyNotes.delete(note);
        this.callbacks.onNoteRelease(note);
      }
    }
  };

  public clearAllHeld = (): void => {
    this.heldKeys.clear();
    for (const note of Array.from(this.keyNotes)) {
      this.callbacks.onNoteRelease(note);
    }
    this.keyNotes.clear();
    for (const note of Array.from(this.gamepadNotes)) {
      this.callbacks.onNoteRelease(note);
    }
    this.gamepadNotes.clear();
    this.callbacks.onSemitoneChange(0);
  };

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.clearAllHeld();
    }
  };

  private handleGamepadConnected = (e: GamepadEvent): void => {
    this.gamepadConnected = true;
    this.callbacks.onGamepadStatus(true, e.gamepad.id.slice(0, 28));
  };

  private handleGamepadDisconnected = (): void => {
    this.gamepadConnected = false;
    this.callbacks.onGamepadStatus(false, null);
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
        this.callbacks.onGamepadStatus(true, activePad.id.slice(0, 28));
      }

      const desiredNotes = new Set<NoteId>();
      const b = activePad.buttons;

      // Face buttons + D-Pad
      if (b[0]?.pressed) desiredNotes.add('A');
      if (b[1]?.pressed || b[15]?.pressed) desiredNotes.add('RIGHT');
      if (b[2]?.pressed || b[13]?.pressed) desiredNotes.add('DOWN');
      if (b[3]?.pressed || b[12]?.pressed) desiredNotes.add('UP');
      if (b[14]?.pressed) desiredNotes.add('LEFT');

      // Right Analog Stick (C-Buttons equivalent on N64/modern controller)
      const rx = activePad.axes[2] ?? 0;
      const ry = activePad.axes[3] ?? 0;
      if (rx > 0.55) desiredNotes.add('RIGHT');
      if (rx < -0.55) desiredNotes.add('LEFT');
      if (ry < -0.55) desiredNotes.add('UP');
      if (ry > 0.55) desiredNotes.add('DOWN');

      // Left Analog Stick -> Physical Ocarina tilt & pitch vibrato
      const lx = Math.abs(activePad.axes[0] ?? 0) > 0.14 ? (activePad.axes[0] ?? 0) : 0;
      const ly = Math.abs(activePad.axes[1] ?? 0) > 0.14 ? (activePad.axes[1] ?? 0) : 0;
      if (lx !== 0 || ly !== 0) {
        this.callbacks.onAnalogTilt(lx, ly);
      }

      // Bumpers -> Semitone bend
      if (b[5]?.pressed) this.callbacks.onSemitoneChange(1);
      else if (b[4]?.pressed) this.callbacks.onSemitoneChange(-1);

      // Start button (index 9) edge trigger
      const startPressed = Boolean(b[9]?.pressed);
      if (startPressed && !this.prevGpButtons.get(9)) {
        if (document.body.dataset.state === 'title') {
          this.callbacks.onStartOrConfirm();
        } else {
          this.callbacks.onPauseToggle();
        }
      }
      this.prevGpButtons.set(9, startPressed);

      // Reconcile held gamepad notes
      for (const note of desiredNotes) {
        if (!this.gamepadNotes.has(note)) {
          this.gamepadNotes.add(note);
          this.callbacks.onNotePress(note);
        }
      }
      for (const note of Array.from(this.gamepadNotes)) {
        if (!desiredNotes.has(note)) {
          this.gamepadNotes.delete(note);
          this.callbacks.onNoteRelease(note);
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
