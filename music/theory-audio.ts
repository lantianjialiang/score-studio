import { createVoice, type Voice } from './playback';
import { midiToFreq, safeGain } from './theory';

export type LabVoice = Voice | 'chip';
type ToneModule = typeof import('tone');
let engine: ReturnType<typeof initialize> | undefined;

async function initialize() {
  const Tone = await import('tone');
  await Tone.start();
  const limiter = new Tone.Limiter(-6).toDestination();
  const voices = new Map<Voice, ReturnType<typeof createVoice>>();
  function tone(frequency: number, duration: number, at: number, type: 'sine' | 'triangle' | 'square') {
    const osc = new Tone.Oscillator(frequency, type);
    const envelope = new Tone.Gain(0).connect(limiter);
    osc.connect(envelope);
    const end = at + duration;
    const gain = safeGain(frequency, type === 'square' ? .06 : .15);
    envelope.gain.setValueAtTime(0, at).linearRampToValueAtTime(gain, at + .016)
      .setValueAtTime(gain, Math.max(at + .016, end - .065)).linearRampToValueAtTime(0, end);
    osc.onstop = () => { osc.dispose(); envelope.dispose(); };
    osc.start(at).stop(end + .025);
  }
  const drum = new Tone.MembraneSynth({ envelope: { attack: .003, decay: .12, sustain: 0, release: .045 } }).connect(limiter);
  drum.volume.value = -17;
  const rim = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: .002, decay: .045, sustain: 0, release: .02 } }).connect(limiter);
  rim.volume.value = -23;
  return {
    Tone,
    frequencies(frequencies: number[], duration = .65) {
      const time = Tone.now();
      frequencies.forEach(frequency => tone(frequency, duration, time, 'sine'));
    },
    note(midi: number, duration = .35, voice?: LabVoice) {
      if (voice && voice !== 'chip') {
        let bank = voices.get(voice);
        if (!bank) { bank = createVoice(Tone, Tone.getContext(), voice, limiter); voices.set(voice, bank); }
        bank.play(midi, duration, Tone.now());
        return;
      }
      tone(midiToFreq(midi), duration, Tone.now(), voice === 'chip' ? 'square' : 'triangle');
    },
    beat(level: number, time: number) {
      if (level > 0) drum.triggerAttackRelease(level === 2 ? 'C2' : 'G2', .10, time, level === 2 ? .9 : .54);
      else rim.triggerAttackRelease(.035, time);
    },
  };
}

export function labAudio() {
  engine ??= initialize().catch(error => { engine = undefined; throw error; });
  return engine;
}
export type LabAudio = Awaited<ReturnType<typeof labAudio>>;
