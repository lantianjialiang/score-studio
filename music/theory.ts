import { mod } from './score';
import { tunings, type Instrument } from './fretboard';

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const safeGain = (frequency: number, base = .19) => base * .55 ** Math.max(0, Math.log2(frequency / 440));
export const steps = { major: [2, 2, 1, 2, 2, 2, 1], minor: [2, 1, 2, 2, 1, 2, 2] };
export const pitchClasses = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const scaleNotes = (root: number, mode: keyof typeof steps) => steps[mode].reduce<number[]>((notes, size) => [...notes, notes.at(-1)! + size], [root]);
export const intervals = ['纯一度', '小二度', '大二度', '小三度', '大三度', '纯四度', '三全音', '纯五度', '小六度', '大六度', '小七度', '大七度', '纯八度'];
export const stringRatio = (fret: number) => 2 ** (-fret / 12);

export function fretPositions(midi: number, instrument: Instrument) {
  return tunings[instrument].pitches.flatMap((open, index) => {
    const fret = midi - open;
    return fret < 0 || fret > 12 ? [] : [{ string: index + 1, fret, beginner: fret <= 3 }];
  });
}

export function chordShape(root: number, mode: keyof typeof steps, instrument: Instrument) {
  const pitches = tunings[instrument].pitches;
  const chord = [root, root + (mode === 'major' ? 4 : 3), root + 7].map(pitch => mod(pitch, 12));
  const options = pitches.map(open => [null, ...Array.from({ length: 7 }, (_, fret) => fret).filter(fret => chord.includes(mod(open + fret, 12)))]);
  let winner: (number | null)[] = [];
  let lowest = Infinity;
  function choose(shape: (number | null)[]) {
    const string = shape.length;
    if (string < pitches.length) { options[string].forEach(fret => choose([...shape, fret])); return; }
    const played = shape.flatMap((fret, i) => fret === null ? [] : [{ fret, pitch: pitches[i] + fret }]);
    if (new Set(played.map(note => mod(note.pitch, 12))).size !== 3) return;
    const frets = played.map(note => note.fret).filter(Boolean);
    const span = frets.length ? Math.max(...frets) - Math.min(...frets) : 0;
    if (span > 3) return;
    const bass = Math.min(...played.map(note => note.pitch));
    const cost = (pitches.length - played.length) * 3 + span * 4 + frets.reduce((sum, fret) => sum + fret * .5, 0)
      + Math.max(0, ...frets) * 2 + (mod(bass, 12) === chord[0] ? 0 : 2);
    if (cost < lowest) { lowest = cost; winner = shape; }
  }
  choose([]);
  return winner;
}