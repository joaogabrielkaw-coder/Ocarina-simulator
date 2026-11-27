import { NOTE_ORDER, NoteId, OCARINA_NOTES } from './musicData';

export interface Spring1D {
  value: number;
  velocity: number;
  target: number;
}

export function stepSpring1D(
  spring: Spring1D,
  stiffness: number,
  damping: number,
  dt: number,
): void {
  const force = (spring.target - spring.value) * stiffness;
  spring.velocity += force * dt;
  spring.velocity *= Math.exp(-damping * dt);
  spring.value += spring.velocity * dt;
}

export interface OcarinaPhysicsState {
  holes: Record<NoteId, Spring1D>;
  sharpValve: Spring1D; // R / Shift (+1 semitone)
  flatValve: Spring1D; // Z / Alt / C (-1 semitone)
  pitchBend: Spring1D; // Control Stick Y / Q & E (-2..+2 semitones)
  tiltX: Spring1D; // forward/back pitch
  tiltZ: Spring1D; // left/right roll
  yaw: Spring1D;
  bounceY: Spring1D;
  pointerTiltX: number; // -1..1 from mouse/analog stick
  pointerTiltY: number; // -1..1 from mouse/analog stick
  explicitVibrato: boolean;
  vibratoIntensity: number; // 0..1
  breathPressure: number; // 0..1
}

export function createOcarinaPhysicsState(): OcarinaPhysicsState {
  const holes = {} as Record<NoteId, Spring1D>;
  for (const id of NOTE_ORDER) {
    holes[id] = { value: 0, velocity: 0, target: 0 };
  }
  return {
    holes,
    sharpValve: { value: 0, velocity: 0, target: 0 },
    flatValve: { value: 0, velocity: 0, target: 0 },
    pitchBend: { value: 0, velocity: 0, target: 0 },
    tiltX: { value: 0, velocity: 0, target: 0 },
    tiltZ: { value: 0, velocity: 0, target: 0 },
    yaw: { value: 0, velocity: 0, target: 0 },
    bounceY: { value: 0, velocity: 0, target: 0 },
    pointerTiltX: 0,
    pointerTiltY: 0,
    explicitVibrato: false,
    vibratoIntensity: 0,
    breathPressure: 0,
  };
}

/**
 * Applies physical finger-press torque and vertical recoil onto the suspended Ocarina body
 * based on the 3D hole position (x, z).
 */
export function applyHoleTouchImpulse(
  state: OcarinaPhysicsState,
  note: NoteId,
  pressed: boolean,
  impulseStrength = 1,
): void {
  const hole = state.holes[note];
  hole.target = pressed ? 1 : 0;

  if (pressed) {
    const [hx, , hz] = OCARINA_NOTES[note].holePos;
    state.tiltZ.velocity -= hx * 2.6 * impulseStrength;
    state.tiltX.velocity += hz * 2.4 * impulseStrength;
    state.yaw.velocity += hx * 0.9 * impulseStrength;
    state.bounceY.velocity -= 0.72 * impulseStrength;
    hole.velocity += 6.5 * impulseStrength;
  } else {
    hole.velocity -= 3.0;
  }
}

export function setModifierValves(
  state: OcarinaPhysicsState,
  semitoneShift: number,
  pitchBendTarget: number,
  explicitVibrato: boolean,
): void {
  state.sharpValve.target = semitoneShift > 0 ? 1 : 0;
  state.flatValve.target = semitoneShift < 0 ? 1 : 0;
  state.pitchBend.target = Math.max(-2, Math.min(2, pitchBendTarget));
  state.explicitVibrato = explicitVibrato;
}

export function stepOcarinaPhysics(
  state: OcarinaPhysicsState,
  heldNotesCount: number,
  dt: number,
  elapsed: number,
): void {
  const clampedDt = Math.min(dt, 0.05);

  for (const id of NOTE_ORDER) {
    stepSpring1D(state.holes[id], 420, 22, clampedDt);
  }
  stepSpring1D(state.sharpValve, 380, 20, clampedDt);
  stepSpring1D(state.flatValve, 380, 20, clampedDt);
  stepSpring1D(state.pitchBend, 210, 16, clampedDt);

  // Target resting tilt responds gently to pointer drag / analog stick / pitch bend
  state.tiltX.target = state.pointerTiltY * 0.22 - state.pitchBend.value * 0.1;
  state.tiltZ.target = -state.pointerTiltX * 0.28 + (state.sharpValve.value - state.flatValve.value) * 0.08;
  state.yaw.target = state.pointerTiltX * 0.18;
  state.bounceY.target = heldNotesCount > 0 ? -0.025 : 0;

  stepSpring1D(state.tiltX, 145, 11, clampedDt);
  stepSpring1D(state.tiltZ, 145, 11, clampedDt);
  stepSpring1D(state.yaw, 110, 10, clampedDt);
  stepSpring1D(state.bounceY, 180, 13, clampedDt);

  const targetBreath = heldNotesCount > 0 ? 1 : 0;
  state.breathPressure += (targetBreath - state.breathPressure) * (1 - Math.exp(-14 * clampedDt));

  const stickMag = Math.min(1, Math.hypot(state.pointerTiltX, state.pointerTiltY));
  const vibratoBase = state.explicitVibrato ? 0.92 : Math.max(0.12, stickMag * 0.95);
  const targetVibrato = heldNotesCount > 0 ? vibratoBase : 0;
  state.vibratoIntensity += (targetVibrato - state.vibratoIntensity) * (1 - Math.exp(-10 * clampedDt));

  if (heldNotesCount > 0) {
    state.bounceY.value += Math.sin(elapsed * 28) * 0.0012 * state.breathPressure;
    if (state.explicitVibrato) {
      state.tiltX.value += Math.sin(elapsed * 34) * 0.014;
    }
  }
}
