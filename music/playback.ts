import { beats, type ScoreDocument } from './score';

export type Voice = 'piano' | 'guitar' | 'ukulele';
export const voices: Record<Voice, string> = { piano: '钢琴', guitar: '民谣吉他', ukulele: '尤克里里' };

export function createVoice(Tone: typeof import('tone'), context: import('tone').BaseContext, voice: Voice,
  destination?: import('tone').ToneAudioNode) {
  const raw = context.rawContext as AudioContext;
  const output = destination ?? context.destination;
  const synth = new Tone.PolySynth({
    context, voice: Tone.Synth,
    options: {
      oscillator: { type: voice === 'piano' ? 'triangle' : voice === 'guitar' ? 'fatsine' : 'sine' },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0.27, release: 0.12 },
    },
  }).connect(output);
  synth.volume.value = -11;
  let sample: import('soundfont-player').Player | undefined;
  let ukulele: InstanceType<typeof Tone.Sampler> | undefined;
  let disposed = false;
  const sampleOutput = destination && voice !== 'ukulele' ? raw.createGain() : undefined;
  if (sampleOutput && destination) Tone.connect(sampleOutput, destination);
  const ready = voice === 'ukulele' ? new Promise<void>(resolve => {
    ukulele = new Tone.Sampler({
      context, urls: { C4: 'C4.flac', E4: 'E4.flac', G4: 'G4.flac', A4: 'A4.flac', 'C#5': 'Cs5.flac', F5: 'F5.flac', A5: 'A5.flac', C6: 'C6.flac' },
      baseUrl: '/soundfonts/ukulele/', release: 0.16, onload: resolve, onerror: () => resolve(),
    }).connect(output);
    ukulele.volume.value = -3;
  }) : import('soundfont-player').then(({ default: Soundfont }) => {
    const name = voice === 'piano' ? 'acoustic_grand_piano' : 'acoustic_guitar_steel';
    return Soundfont.instrument(raw, name, sampleOutput ? { destination: sampleOutput } : undefined);
  }).then(bank => { if (disposed) bank.stop(); else sample = bank; }).catch(() => undefined);

  return {
    ready,
    disablePendingSamples() { disposed = true; },
    play(midi: number, duration: number, at: number) {
      const frequency = Tone.Frequency(midi, 'midi').toFrequency();
      if (sample?.play(String(midi), at, { duration, gain: 0.7 })) return;
      if (!disposed && ukulele?.loaded) ukulele.triggerAttackRelease(frequency, duration, at);
      else synth.triggerAttackRelease(frequency, duration, at);
    },
    dispose() {
      disposed = true;
      sample?.stop();
      sampleOutput?.disconnect();
      ukulele?.dispose();
      synth.dispose();
    },
  };
}

export function timeline(bars: ScoreDocument['measures']) {
  let length = 0;
  const notes = bars.flatMap(bar => bar.notes.map(note => {
    const event = { note, offset: length };
    length += beats(note);
    return event;
  }));
  const events = notes.map(({ note, offset }, index) => {
    const continuation = index > 0 && notes[index - 1].note.isTieStart && notes[index - 1].note.midi === note.midi;
    let length = beats(note);
    if (!continuation && note.isTieStart) {
      for (let next = index + 1; next < notes.length && notes[next - 1].note.isTieStart && notes[next].note.midi === note.midi; next++) {
        length += beats(notes[next].note);
      }
    }
    return { note, offset, length, continuation };
  });
  return { length, events };
}

export async function playScore(
  score: ScoreDocument, options: { speed: number; start: number; end: number; loop: boolean; click: boolean; countIn: boolean; voice: Voice; resume: string | null },
  onNote: (id: string | null) => void, onEnd: () => void, signal: AbortSignal,
) {
  const Tone = await import('tone');
  if (signal.aborted) return;
  await Tone.start();
  if (signal.aborted) return;

  const context = Tone.getContext();
  const raw = context.rawContext;
  const instrument = createVoice(Tone, context, options.voice);
  const tick = new Tone.MembraneSynth({ envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.04 } }).toDestination();
  tick.volume.value = -14;
  const timers = new Set<number>();
  const stop = () => {
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
    instrument.dispose();
    tick.dispose();
    signal.removeEventListener('abort', stop);
  };
  signal.addEventListener('abort', stop, { once: true });

  const later = (at: number, fn: () => void) => {
    const timer = window.setTimeout(() => { timers.delete(timer); fn(); }, Math.max(0, (at - raw.currentTime) * 1000));
    timers.add(timer);
  };
  const unit = 60 / (score.tempo * options.speed);
  const pulse = 4 / score.timeSignature.denominator;
  const count = score.timeSignature.numerator;
  const bars = score.measures.slice(options.start, options.end + 1);
  const { length, events: noteEvents } = timeline(bars);
  let barStart = 0;
  const clicks = bars.flatMap(bar => {
    const barLength = bar.notes.reduce((sum, note) => sum + beats(note), 0);
    const events = Array.from({ length: Math.ceil(barLength / pulse) }, (_, beat) => ({ offset: barStart + beat * pulse, accent: beat === 0 }));
    barStart += barLength;
    return events;
  });
  function cycle(at: number, skip = 0) {
    for (const event of noteEvents) {
      if (event.offset < skip) continue;
      const time = at + event.offset * unit;
      later(time - 0.12, () => {
        if (event.note.midi === null || (event.continuation && event.offset !== skip)) return;
        const start = Math.max(time, raw.currentTime);
        const duration = event.length * unit * 0.98;
        instrument.play(event.note.midi, duration, start);
      });
      later(time, () => onNote(event.note.id));
    }
    if (options.click) clicks.forEach(event => {
      if (event.offset < skip) return;
      const time = at + event.offset * unit;
      later(time - 0.12, () => tick.triggerAttackRelease(event.accent ? 'C5' : 'C4', '32n', Math.max(raw.currentTime, time)));
    });
    const end = at + length * unit;
    if (options.loop && length > 0) later(end - 0.12, () => cycle(end));
    else later(end, () => { stop(); onEnd(); });
  }
  const start = raw.currentTime + 0.15;
  if (options.countIn) {
    for (let beat = 0; beat < count; beat++) {
      tick.triggerAttackRelease(beat ? 'C4' : 'C5', '32n', start + beat * pulse * unit);
    }
  }
  const skip = noteEvents.find(event => event.note.id === options.resume)?.offset ?? 0;
  cycle(start + (options.countIn ? count * pulse * unit : 0) - skip * unit, skip);
}
