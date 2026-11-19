import { computeNoteFrequency, NoteId } from './musicData';

interface ActiveVoice {
  note: NoteId;
  oscMain: OscillatorNode;
  oscHarmonic: OscillatorNode;
  lfoGain: GainNode;
  voiceGain: GainNode;
  breathSource: AudioBufferSourceNode;
  breathGain: GainNode;
  baseFreq: number;
}

class OcarinaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbInput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private voices = new Map<NoteId, ActiveVoice>();
  private muted = false;
  private vibratoAmount = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);

      // Subtle temple acoustic delay network (zero external impulse files)
      this.reverbInput = this.ctx.createGain();
      this.reverbInput.gain.value = 0.24;

      const delay1 = this.ctx.createDelay(0.5);
      delay1.delayTime.value = 0.14;
      const delay2 = this.ctx.createDelay(0.5);
      delay2.delayTime.value = 0.23;

      const fb1 = this.ctx.createGain();
      fb1.gain.value = 0.28;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;

      this.reverbInput.connect(delay1);
      delay1.connect(lp);
      lp.connect(delay2);
      delay2.connect(fb1);
      fb1.connect(delay1);
      delay1.connect(this.masterGain);
      delay2.connect(this.masterGain);

      // Pre-generate short breath noise buffer
      const length = Math.floor(this.ctx.sampleRate * 1.2);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startNote(note: NoteId, semitoneShift = 0): void {
    if (this.voices.has(note)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.reverbInput || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const freq = computeNoteFrequency(note, semitoneShift);

    // Ceramic Ocarina tone: pure sine fundamental + gentle triangle overtone + subtle breath
    const oscMain = ctx.createOscillator();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(freq * 0.985, now);
    oscMain.frequency.exponentialRampToValueAtTime(freq, now + 0.032);

    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(freq * 2, now);

    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.085;

    // Warm low-pass filter on tone
    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = freq * 4.2;

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1.8 + this.vibratoAmount * 7.5;
    lfo.connect(lfoGain);
    lfoGain.connect(oscMain.frequency);

    // Breath air chiff
    const breathSource = ctx.createBufferSource();
    breathSource.buffer = this.noiseBuffer;
    breathSource.loop = true;

    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = freq * 1.45;
    breathFilter.Q.value = 3.2;

    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.001, now);
    breathGain.gain.linearRampToValueAtTime(0.055, now + 0.025);
    breathGain.gain.exponentialRampToValueAtTime(0.018, now + 0.14);

    // Main ADSR envelope
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.36, now + 0.035);
    voiceGain.gain.exponentialRampToValueAtTime(0.28, now + 0.12);

    oscMain.connect(toneFilter);
    oscHarmonic.connect(harmGain);
    harmGain.connect(toneFilter);
    toneFilter.connect(voiceGain);

    breathSource.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(voiceGain);

    voiceGain.connect(this.masterGain);
    voiceGain.connect(this.reverbInput);

    oscMain.start(now);
    oscHarmonic.start(now);
    lfo.start(now);
    breathSource.start(now);

    this.voices.set(note, {
      note,
      oscMain,
      oscHarmonic,
      lfoGain,
      voiceGain,
      breathSource,
      breathGain,
      baseFreq: freq,
    });
  }

  public updateBend(semitoneShift: number, vibratoAmount: number): void {
    this.vibratoAmount = vibratoAmount;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices.values()) {
      const targetFreq = computeNoteFrequency(voice.note, semitoneShift);
      voice.oscMain.frequency.setTargetAtTime(targetFreq, now, 0.015);
      voice.oscHarmonic.frequency.setTargetAtTime(targetFreq * 2, now, 0.015);
      voice.lfoGain.gain.setTargetAtTime(1.8 + vibratoAmount * 8.5, now, 0.02);
    }
  }

  public stopNote(note: NoteId): void {
    const voice = this.voices.get(note);
    if (!voice || !this.ctx) return;
    this.voices.delete(note);

    const now = this.ctx.currentTime;
    voice.voiceGain.gain.cancelScheduledValues(now);
    voice.voiceGain.gain.setValueAtTime(Math.max(0.0001, voice.voiceGain.gain.value), now);
    voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    const stopAt = now + 0.18;
    try {
      voice.oscMain.stop(stopAt);
      voice.oscHarmonic.stop(stopAt);
      voice.breathSource.stop(stopAt);
    } catch {
      // Ignore already-stopped nodes
    }
  }

  public stopAllNotes(): void {
    for (const id of Array.from(this.voices.keys())) {
      this.stopNote(id);
    }
  }

  public playSongFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.reverbInput || this.muted) return;
    const notes = [587.33, 739.99, 880.0, 1174.66];
    const now = ctx.currentTime;
    notes.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = hz;
      const start = now + idx * 0.095;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      gain.connect(this.reverbInput!);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  }

  public playMissSfx(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.14);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }
}

export const audioEngine = new OcarinaAudioEngine();
