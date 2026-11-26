'use client';

import { useEffect, useRef, useState } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { beats, keyPitch, mod, pitchLabel, type NoteEvent, type ScoreDocument } from '../music/score';
import { toMusicXml } from '../music/formats';

export function focusNote(element: Element | null) {
  if (!element) return;
  const box = element.getBoundingClientRect();
  if (box.top < 85 || box.bottom > window.innerHeight - 150 || box.left < 0 || box.right > window.innerWidth) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
}

export function Staff({ score, active }: { score: ScoreDocument; active: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<OpenSheetMusicDisplay | null>(null);
  const [error, setError] = useState(false);
  const cursorIndex = useRef(0);
  useEffect(() => {
    if (!root.current) return;
    const node = document.createElement('div');
    root.current.replaceChildren(node);
    let disposed = false;
    let observer: ResizeObserver | undefined;
    setRenderer(null);
    setError(false);
    void import('opensheetmusicdisplay').then(async ({ OpenSheetMusicDisplay }) => {
      if (disposed) return;
      const osmd = new OpenSheetMusicDisplay(node, {
        backend: 'svg', autoResize: false, drawTitle: false, drawSubtitle: false,
        drawPartNames: false, drawPartAbbreviations: false, followCursor: false,
        cursorsOptions: [{ type: 0, color: '#926de5', alpha: 0.36, follow: false }],
      });
      await osmd.load(toMusicXml(score));
      if (disposed) return;
      let width = -1;
      const render = () => {
        const nextWidth = node.clientWidth;
        if (nextWidth < 100 || nextWidth === width) return;
        width = nextWidth;
        osmd.render();
        cursorIndex.current = 0;
        setRenderer(null);
        requestAnimationFrame(() => { if (!disposed) setRenderer(osmd); });
      };
      render();
      observer = new ResizeObserver(render);
      observer.observe(node);
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; observer?.disconnect(); node.remove(); };
  }, [score]);
  useEffect(() => {
    if (!renderer) return;
    const cursor = renderer.cursor;
    const index = score.measures.flatMap(bar => bar.notes).findIndex(note => note.id === active);
    if (index < 0) { cursor.hide(); return; }
    if (index < cursorIndex.current) { cursor.reset(); cursorIndex.current = 0; }
    while (cursorIndex.current < index) { cursor.next(); cursorIndex.current++; }
    cursor.show();
    focusNote(cursor.cursorElement);
  }, [renderer, active, score]);
  return <div className="staff-wrap">{error && <p role="alert">五线谱渲染失败。</p>}<div className="staff" ref={root} aria-label="五线谱" /></div>;
}

function degree(note: NoteEvent, key: string) {
  if (note.midi === null) return { number: '0', accidental: '', octave: 0 };
  const scale = key.endsWith('m') ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const relative = note.midi - 60 - keyPitch(key);
  const pc = mod(relative, 12);
  const index = scale.findLastIndex(value => value <= pc);
  return { number: index + 1, accidental: pc === scale[index] ? '' : '♯', octave: Math.floor(relative / 12) };
}

export function Jianpu({ score, active, onNote }: { score: ScoreDocument; active: string | null; onNote?: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusNote(root.current?.querySelector('[data-active="true"]') ?? null);
  }, [active]);
  return <div className="notation-grid jianpu-grid" ref={root} aria-label="数字简谱">
    {score.measures.map((bar, index) => {
      let x = 17;
      const symbols = bar.notes.map(note => {
        const pos = x;
        x += 29 + Math.max(0, beats(note) - 1) * 15 + note.dots * 4;
        return { note, pos };
      });
      return <div className="bar" key={bar.index} style={{ flexBasis: Math.max(130, x) }}>
        <span className="bar-index">{index + 1}</span>
        <div className="jianpu-measure">
        <svg className="bar-svg" width={Math.max(130, x)} height={89} aria-label={'第 ' + (index + 1) + ' 小节'}>
          {symbols.map(({ note, pos }) => {
            const glyph = degree(note, score.keySignature);
            const tails = Math.max(0, Math.floor(beats({ ...note, dots: 0 })) - 1);
            const lines = note.duration === '16' ? 2 : note.duration === '8' ? 1 : 0;
            return <g key={note.id} transform={'translate(' + pos + ',0)'} data-active={note.id === active}
              aria-label={pitchLabel(note.midi)} role={onNote ? 'button' : undefined} tabIndex={onNote ? 0 : undefined}
              onClick={onNote ? () => onNote(note.id) : undefined}
              onKeyDown={onNote ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNote(note.id); } } : undefined}>
              <rect className="note-bg" x="-14" y="5" width={26 + tails * 15 + note.dots * 4} height="79" rx="5" />
              <text className="number-note" textAnchor="middle" y="48">{glyph.number}</text>
              <text x="-13" y="47" fontSize="11">{glyph.accidental}</text>
              {Array.from({ length: Math.abs(glyph.octave) }, (_, i) => <circle key={i}
                cx="0" cy={glyph.octave > 0 ? 31 - i * 4 : 56 + lines * 4 + i * 4} r="1.6" fill="currentColor" />)}
              {Array.from({ length: lines }, (_, i) => <line key={i} x1="-6" x2="6" y1={53 + i * 4} y2={53 + i * 4} stroke="currentColor" />)}
              {Array.from({ length: tails }, (_, i) => <line key={i} x1={13 + i * 15} x2={21 + i * 15} y1="42" y2="42" stroke="currentColor" />)}
              {Array.from({ length: note.dots }, (_, i) => <circle key={i} cx={10 + tails * 15 + i * 4} cy="45" r="1.6" fill="currentColor" />)}
              {note.isTieStart && <path d="M 1 21 q 11 -8 22 0" stroke="currentColor" fill="none" />}
            </g>;
          })}
        </svg>
        </div>
      </div>;
    })}
  </div>;
}
