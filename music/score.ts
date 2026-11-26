export interface ScoreDocument {
  id: string;
  title: string;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  keySignature: string;
  measures: Measure[];
}

export interface Measure {
  index: number;
  notes: NoteEvent[];
}

export interface NoteEvent {
  id: string;
  midi: number | null;
  duration: 'w' | 'h' | 'q' | '8' | '16';
  dots: number;
  isTieStart?: boolean;
  fingering?: {
    instrument: 'guitar' | 'ukulele';
    string: number;
    fret: number;
    finger: 0 | 1 | 2 | 3 | 4;
  };
}

export const durations = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 } as const;
export const pitchNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const mod = (n: number, divisor: number) => ((n % divisor) + divisor) % divisor;
export const beats = (note: NoteEvent) => durations[note.duration] * (2 - 2 ** -note.dots);
export const keyPitch = (key: string) => mod((natural[key[0]] ?? 0) + (key[1] === '#' ? 1 : key[1] === 'b' ? -1 : 0), 12);
export const pitchLabel = (midi: number | null) => midi === null ? '休止' : pitchNames[midi % 12] + (Math.floor(midi / 12) - 1);
const scaleFor = (key: string) => key.endsWith('m') ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];

export function writeJianpu(score: ScoreDocument): string {
  const scale = scaleFor(score.keySignature);
  const { numerator, denominator } = score.timeSignature;
  const bars = score.measures.map(bar => bar.notes.map(note => {
    let pitch = '0';
    if (note.midi !== null) {
      const relative = note.midi - 60 - keyPitch(score.keySignature);
      const pc = mod(relative, 12);
      const step = scale.findLastIndex(value => value <= pc);
      const octave = Math.floor(relative / 12);
      pitch = (pc === scale[step] ? '' : '#') + (step + 1) + (octave > 0 ? "'" : ',').repeat(Math.abs(octave));
    }
    return pitch + (note.duration === 'q' ? '' : ':' + note.duration) + '.'.repeat(note.dots) + (note.isTieStart && note.midi !== null ? '~' : '');
  }).join(' '));
  return '1=' + score.keySignature + ' ' + numerator + '/' + denominator + ' BPM=' + score.tempo + '\n' + bars.join(' | ');
}

export function transpose(score: ScoreDocument, steps: number): ScoreDocument {
  const notes = score.measures.flatMap(measure => measure.notes);
  if (notes.some(note => note.midi !== null && (note.midi + steps < 0 || note.midi + steps > 127))) {
    throw new Error('移调后有音符超出 MIDI 音域。');
  }
  return {
    ...score, keySignature: pitchNames[mod(keyPitch(score.keySignature) + steps, 12)] + (score.keySignature.endsWith('m') ? 'm' : ''),
    measures: score.measures.map(measure => ({ ...measure, notes: measure.notes.map(note => ({
      ...note, midi: note.midi === null ? null : note.midi + steps, fingering: undefined,
    })) })),
  };
}

export function parseJianpu(source: string, title = '我的乐谱'): ScoreDocument {
  let keySignature = 'C';
  let tempo = 100;
  let timeSignature = { numerator: 4, denominator: 4 };
  const body = source.replace(/(?:1=([A-G][#b]?m?)|BPM=(\d+(?:\.\d+)?)|(\d+)\/(\d+))/gi, (_, key, bpm, top, bottom) => {
    if (key) keySignature = key[0].toUpperCase() + key.slice(1);
    if (bpm) tempo = Number(bpm);
    if (top) timeSignature = { numerator: Number(top), denominator: Number(bottom) };
    return '';
  });
  if (tempo < 20 || tempo > 400 || timeSignature.numerator < 1 || timeSignature.numerator > 32 ||
    ![1, 2, 4, 8, 16].includes(timeSignature.denominator)) throw new Error('请检查 BPM 和拍号。');
  const scale = scaleFor(keySignature);
  let previous: NoteEvent | undefined;
  const measures = body.split('|').filter(bar => bar.trim()).map((bar, index) => {
    const notes: NoteEvent[] = [];
    for (const token of bar.trim().split(/\s+/)) {
      if (token === '-') {
        if (!previous) throw new Error('延音线前需要有音符。');
        if (previous.midi !== null) previous.isTieStart = true;
        previous = { id: index + '-' + notes.length, midi: previous.midi, duration: 'q', dots: 0 };
        notes.push(previous);
        continue;
      }
      const parts = /^([#b]?)([0-7])([',]*)(?::(w|h|q|8|16))?(\.{0,2})(~?)$/.exec(token);
      if (!parts) throw new Error('无法解析简谱符号 ' + token);
      const [, accidental, degree, octave, duration, dots, tie] = parts;
      const shift = [...octave].reduce((total, mark) => total + (mark === "'" ? 12 : -12), 0);
      const midi = degree === '0' ? null : 60 + keyPitch(keySignature) + scale[Number(degree) - 1] + shift +
        (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
      if (midi !== null && (midi < 0 || midi > 127)) throw new Error('简谱音高超出 MIDI 音域。');
      previous = { id: index + '-' + notes.length, midi, duration: (duration || 'q') as NoteEvent['duration'], dots: dots.length };
      if (tie && midi !== null) previous.isTieStart = true;
      notes.push(previous);
    }
    return { index, notes };
  });
  if (!measures.length) throw new Error('请输入至少一个音符。');
  return { id: crypto.randomUUID(), title, tempo, keySignature, timeSignature, measures };
}
