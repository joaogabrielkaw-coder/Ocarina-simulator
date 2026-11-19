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
  tiltX: Spring1D; // forward/back pitch
  tiltZ: Spring1D; // left/right roll
  yaw: Spring1D;
  bounceY: Spring1D;
  pointerTiltX: number; // -1..1 from mouse/analog stick
  pointerTiltY: number; // -1..1 from mouse/analog stick
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
    tiltX: { value: 0, velocity: 0, target: 0 },
    tiltZ: { value: 0, velocity: 0, target: 0 },
    yaw: { value: 0, velocity: 0, target: 0 },
    bounceY: { value: 0, velocity: 0, target: 0 },
    pointerTiltX: 0,
    pointerTiltY: 0,
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
    // Pressing a hole on the right (+hx) rolls right (-tiltZ), pressing front (+hz) pitches forward (+tiltX)
    state.tiltZ.velocity -= hx * 2.6 * impulseStrength;
    state.tiltX.velocity += hz * 2.4 * impulseStrength;
    state.yaw.velocity += hx * 0.9 * impulseStrength;
    state.bounceY.velocity -= 0.72 * impulseStrength;
    hole.velocity += 6.5 * impulseStrength;
  } else {
    hole.velocity -= 3.0;
  }
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

  // Target resting tilt responds gently to pointer drag / analog stick tilt
  state.tiltX.target = state.pointerTiltY * 0.22;
  state.tiltZ.target = -state.pointerTiltX * 0.28;
  state.yaw.target = state.pointerTiltX * 0.18;
  state.bounceY.target = heldNotesCount > 0 ? -0.025 : 0;

  stepSpring1D(state.tiltX, 145, 11, clampedDt);
  stepSpring1D(state.tiltZ, 145, 11, clampedDt);
  stepSpring1D(state.yaw, 110, 10, clampedDt);
  stepSpring1D(state.bounceY, 180, 13, clampedDt);

  const targetBreath = heldNotesCount > 0 ? 1 : 0;
  state.breathPressure += (targetBreath - state.breathPressure) * (1 - Math.exp(-14 * clampedDt));

  // Vibrato from pointer/stick tilt magnitude or held breath shimmer
  const stickMag = Math.min(1, Math.hypot(state.pointerTiltX, state.pointerTiltY));
  const targetVibrato = heldNotesCount > 0 ? Math.max(0.12, stickMag * 0.95) : 0;
  state.vibratoIntensity += (targetVibrato - state.vibratoIntensity) * (1 - Math.exp(-10 * clampedDt));

  // Subtle ambient breath resonance micro-motion when holding a note
  if (heldNotesCount > 0) {
    state.bounceY.value += Math.sin(elapsed * 28) * 0.0012 * state.breathPressure;
  }
}
