import { beats, transpose, type NoteEvent, type ScoreDocument } from './score';

export const tunings = {
  guitar: { pitches: [64, 59, 55, 50, 45, 40], labels: ['E', 'B', 'G', 'D', 'A', 'E'], maxFret: 20 },
  ukulele: { pitches: [69, 64, 60, 67], labels: ['A', 'E', 'C', 'G'], maxFret: 15 },
};

export type Instrument = keyof typeof tunings;
export type FingeringMode = 'direct' | 'easy';
type Fingering = NonNullable<NoteEvent['fingering']>;
type Path = { position: Fingering; cost: number; previous?: Path; noteId: string };

export function solveFretboard(score: ScoreDocument, instrument: Instrument, mode: FingeringMode) {
  const { pitches, maxFret } = tunings[instrument];
  const easy = mode === 'easy';
  const notes = score.measures.flatMap(bar => bar.notes).filter(note => note.midi !== null);
  const low = Math.min(...notes.map(note => note.midi!));
  const high = Math.max(...notes.map(note => note.midi!));
  const positions = Array.from({ length: 128 }, (_, midi) => pitches.flatMap((open, i): Fingering[] => {
    const fret = midi - open;
    if (fret < 0 || fret > maxFret) return [];
    return [{ instrument, string: i + 1, fret, finger: Math.min(fret, 4) as Fingering['finger'] }];
  }));

  function findPath(shift: number) {
    const ends: Path[] = [];
    let row: Path[] = [];
    let unavailable = 0;
    let cost = 0;
    let previousNote: NoteEvent | undefined;
    function finishRun() {
      if (!row.length) return;
      const last = row.reduce((best, path) => path.cost < best.cost ? path : best);
      cost += last.cost;
      ends.push(last);
      row = [];
    }
    for (const note of notes) {
      const candidates = positions[note.midi! + shift];
      if (!candidates.length) {
        unavailable++;
        finishRun();
        previousNote = undefined;
        continue;
      }
      const prior = row;
      const rapid = previousNote && beats(previousNote) <= .5 ? 1.5 : 1;
      row = candidates.map((position): Path => {
        const fret = position.fret;
        const base = easy ? (fret > 4 ? 24 + 4 * (fret - 4) : [0, .2, .4, .6, 2][fret])
          : fret > 3 ? 18 + fret * 2 : fret * .7;
        let bestCost = Infinity;
        let previous: Path | undefined;
        for (const path of prior) {
          const from = path.position;
          const distance = Math.abs(position.string - from.string);
          const hand = Math.abs(Math.max(0, fret - 4) - Math.max(0, from.fret - 4));
          const movement = easy
            ? rapid * ((distance > 0 ? 15 + distance : 0) + hand * 7 +
              (from.finger && position.finger && from.finger !== position.finger ? 18 : 0))
            : 1.3 * hand + .35 * distance;
          if (path.cost + movement < bestCost) {
            bestCost = path.cost + movement;
            previous = path;
          }
        }
        return { position, cost: base + (previous ? bestCost : 0), previous, noteId: note.id };
      });
      previousNote = note;
    }
    finishRun();
    return { shift, cost, unavailable, ends };
  }

  let best = findPath(0);
  if (easy && notes.length) {
    // Include an octave near the instrument when a score is far from its normal register.
    const center = Math.round((Math.min(...pitches) + 7 - (low + high) / 2) / 12) * 12;
    const candidates = new Set([0, ...Array.from({ length: 25 }, (_, i) => i - 12),
      ...Array.from({ length: 13 }, (_, i) => center + i - 6)]);
    const effort = (path: ReturnType<typeof findPath>) => path.cost + notes.length * (path.shift ? .3 + .045 * Math.abs(path.shift) : 0);
    for (const shift of candidates) {
      if (shift === 0 || low + shift < 0 || high + shift > 127) continue;
      const path = findPath(shift);
      if (path.unavailable < best.unavailable || (path.unavailable === best.unavailable && effort(path) < effort(best))) best = path;
    }
  }
  const chosen = new Map<string, Fingering>();
  for (const end of best.ends) {
    for (let path: Path | undefined = end; path; path = path.previous) chosen.set(path.noteId, path.position);
  }
  let stringChanges = 0;
  let fingerChanges = 0;
  let highFrets = 0;
  let previous: Fingering | undefined;
  for (const note of notes) {
    const finger = chosen.get(note.id);
    if (finger && previous && finger.string !== previous.string) stringChanges++;
    if (finger?.finger && previous?.finger && finger.finger !== previous.finger) fingerChanges++;
    if (finger && finger.fret > 4) highFrets++;
    previous = finger;
  }
  const shifted = best.shift ? transpose(score, best.shift) : score;
  return {
    shift: best.shift, unavailable: best.unavailable, stringChanges, fingerChanges, highFrets,
    score: { ...shifted, measures: shifted.measures.map(bar => ({
      ...bar, notes: bar.notes.map(note => ({ ...note, fingering: chosen.get(note.id) })),
    })) },
  };
}
