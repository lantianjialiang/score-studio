'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { labAudio, type LabAudio } from '../../music/theory-audio';
import { midiToFreq } from '../../music/theory';
import { mod, pitchLabel } from '../../music/score';

export function Lab({ id, index, title, children, explanation }: {
  id: string; index: number; title: string; explanation: string; children: ReactNode;
}) {
  return <section id={id} className="theory-lab">
    <header><span className="lab-index">{String(index).padStart(2, '0')}</span><h2>{title}</h2></header>
    <p className="lab-intro">{explanation}</p>
    {children}
  </section>;
}

export function useAudioAction() {
  const [error, setError] = useState('');
  const cancel = useRef<() => void>(() => {});
  useEffect(() => () => cancel.current(), []);
  const run = async (action: (audio: LabAudio, signal: AbortSignal) => void) => {
    cancel.current();
    const controller = new AbortController();
    cancel.current = () => controller.abort();
    setError('');
    try {
      const audio = await labAudio();
      if (!controller.signal.aborted) action(audio, controller.signal);
    } catch {
      if (!controller.signal.aborted) setError('声音暂时无法播放，请再试一次。');
    }
  };
  return { run, stop: () => cancel.current(), error };
}

export function later(signal: AbortSignal, callback: () => void, ms: number) {
  if (signal.aborted) return;
  const stop = () => window.clearTimeout(timer);
  const timer = window.setTimeout(() => {
    signal.removeEventListener('abort', stop);
    callback();
  }, ms);
  signal.addEventListener('abort', stop, { once: true });
}

export function Piano({ from = 60, count = 13, marks = {}, onKey, frequencies = false }: {
  from?: number; count?: number; marks?: Record<number, { label: string; kind?: 'root' | 'playing' | 'selected' }>;
  onKey: (midi: number) => void; frequencies?: boolean;
}) {
  const midi = Array.from({ length: count }, (_, i) => from + i);
  const black = (n: number) => [1, 3, 6, 8, 10].includes(mod(n, 12));
  const whites = midi.filter(n => !black(n));
  const keys = midi.map(n => {
    const left = whites.filter(white => white < n).length;
    const mark = marks[n];
    return <button type="button" key={n} className={'piano-key ' + (black(n) ? 'dark ' : 'light ') + (mark?.kind ?? (mark ? 'selected' : ''))}
      style={{ left: (left - (black(n) ? .29 : 0)) / whites.length * 100 + '%', width: (black(n) ? .58 : 1) / whites.length * 100 + '%' }}
      onClick={() => onKey(n)} aria-label={pitchLabel(n) + '，MIDI ' + n} aria-pressed={Boolean(mark)}>
      <span>{pitchLabel(n)}</span>{mark && <strong>{mark.label}</strong>}
    </button>;
  });
  return <div className="piano-wrap">
    {frequencies && <div className="piano-frequencies">{midi.map((n, i) => <span key={n}><strong>{i}</strong>{midiToFreq(n).toFixed(1)} Hz</span>)}</div>}
    <div className="piano" role="group" aria-label="交互钢琴键盘">{keys}</div>
  </div>;
}