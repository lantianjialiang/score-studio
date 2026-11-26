'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { tunings, type Instrument } from '../music/fretboard';
import { beats, pitchLabel, type NoteEvent, type ScoreDocument } from '../music/score';
import { focusNote } from './notation';

const startX = 38;
const top = 27;
const diagramBand = 50;
const stringGap = 12;
const padding = 12;
const fingers = ['空弦', '食指', '中指', '无名指', '小指'];

function FingeringDiagram({ fingering, strings, inline = false }: { fingering: NonNullable<NoteEvent['fingering']>; strings: number; inline?: boolean }) {
  const { fret, string, finger } = fingering;
  const first = Math.max(1, fret - 3);
  const left = 47 - (strings - 1) * 6;
  const right = 94 - left;
  const x = left + (strings - string) * 12;
  const y = fret === 0 ? 8 : 19 + (fret - first + .5) * 12;
  return <svg className={inline ? 'tab-inline-diagram' : 'tab-diagram'} x={inline ? -23 : undefined} y={inline ? 19 : undefined}
    width={inline ? 46 : undefined} height={inline ? 44 : undefined} viewBox={inline ? '10 0 74 72' : '0 0 94 72'} aria-hidden="true">
    {Array.from({ length: strings }, (_, i) => <line key={i} x1={left + i * 12} x2={left + i * 12} y1="19" y2="67" />)}
    {[0, 1, 2, 3, 4].map(i => <line key={i} x1={left} x2={right} y1={19 + i * 12} y2={19 + i * 12} strokeWidth={i === 0 && first === 1 ? 2 : 1} />)}
    {first > 1 && <text x={left - 3} y="29" textAnchor="end" fontSize="10">{first}</text>}
    <circle cx={x} cy={y} r="6" fill={fret === 0 ? 'white' : 'var(--accent)'} stroke="var(--accent)" />
    <text x={x} y={y + 3.4} textAnchor="middle" fontSize="10.5" fontWeight="650" fill={fret === 0 ? 'var(--accent)' : 'white'}>{finger}</text>
  </svg>;
}

const noteWidth = (note: NoteEvent, diagrams: boolean) => Math.max(diagrams ? 46 : 26, 19 + Math.sqrt(beats(note)) * 15);

function arrangeRows(score: ScoreDocument, width: number, diagrams: boolean) {
  const rows: { bars: { bar: ScoreDocument['measures'][number]; width: number }[]; size: number }[] = [];
  for (const bar of score.measures) {
    const minimum = Math.max(84, padding * 2 + bar.notes.reduce((sum, note) => sum + noteWidth(note, diagrams), 0));
    let row = rows.at(-1);
    if (!row || row.size + minimum > width) {
      row = { bars: [], size: startX };
      rows.push(row);
    }
    row.bars.push({ bar, width: minimum });
    row.size += minimum;
  }
  return rows.map(row => {
    const extra = row.bars.length > 1 && row.size > width * .68 ? Math.max(0, width - row.size) / row.bars.length : 0;
    let x = startX;
    return {
      width: row.size + extra * row.bars.length,
      measures: row.bars.map(({ bar, width: minimum }) => {
        const left = x;
        x += minimum + extra;
        let offset = left + padding;
        const weight = bar.notes.reduce((sum, note) => sum + noteWidth(note, diagrams), 0);
        const factor = weight ? (x - left - padding * 2) / weight : 1;
        const notes = bar.notes.map(note => {
          const size = noteWidth(note, diagrams) * factor;
          const center = offset + size / 2;
          offset += size;
          return { note, center };
        });
        return { index: bar.index, left, right: x, notes };
      }),
    };
  });
}

export function Tablature({ score, instrument, active }: { score: ScoreDocument; instrument: Instrument; active: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [printing, setPrinting] = useState(false);
  const [diagrams, setDiagrams] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const labels = tunings[instrument].labels;
  const strings = labels.length;
  const firstString = top + (diagrams ? diagramBand : 0);
  const bottom = firstString + (strings - 1) * stringGap;
  const rows = useMemo(() => arrangeRows(score, printing ? 685 : width, diagrams), [score, width, diagrams, printing]);
  const detail = selected ? score.measures.flatMap(bar => bar.notes).find(note => note.id === selected) : undefined;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(200, Math.floor(element.clientWidth) - 2));
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(element);
    const print = () => flushSync(() => setPrinting(true));
    const endPrint = () => setPrinting(false);
    window.addEventListener('beforeprint', print);
    window.addEventListener('afterprint', endPrint);
    return () => {
      observer.disconnect();
      window.removeEventListener('beforeprint', print);
      window.removeEventListener('afterprint', endPrint);
    };
  }, []);

  useEffect(() => { focusNote(root.current?.querySelector('[data-active="true"]') ?? null); }, [active]);

  return <div className="tab-score" ref={root} aria-label={instrument === 'guitar' ? '吉他六线谱' : '尤克里里四线谱'}>
    <div className="tab-controls">
      <label><input type="checkbox" checked={diagrams} onChange={event => setDiagrams(event.target.checked)} /> 显示指法图</label>
      <span>圈内数字为用指，0 表示空弦</span>
    </div>
    {detail && <div className="tab-detail" aria-label="单音指法">
      {detail.fingering && <FingeringDiagram fingering={detail.fingering} strings={strings} />}
      <div aria-live="polite"><strong>单音指法 · {pitchLabel(detail.midi)}</strong>
        <p>{detail.fingering ? detail.fingering.string + ' 弦 · ' + detail.fingering.fret + ' 品 · ' + fingers[detail.fingering.finger]
          : detail.midi === null ? '此处休止' : '音符超出可按范围'}</p></div>
      <button className="action" onClick={() => setSelected(null)}>收起指法</button>
    </div>}
    <div className="tab-systems">
      {rows.map(row => {
        const sequence = row.measures.flatMap(bar => bar.notes);
        const end = row.width - 1;
        return <svg key={row.measures[0].index} className="tab-system" width={row.width} height={bottom + 17}
          viewBox={'0 0 ' + row.width + ' ' + (bottom + 17)}>
          {labels.map((label, i) => {
            const y = firstString + i * stringGap;
            return <g key={i}>
              <text x="21" y={y + 3.6} textAnchor="end" className="tab-string">{label}</text>
              <line x1="28" x2={end} y1={y} y2={y} className="tab-line" />
            </g>;
          })}
          <line x1="28" x2="28" y1={firstString} y2={bottom} className="tab-barline" />
          {row.measures.map(bar => <g key={bar.index}>
            <text x={bar.left + 4} y="13" className="tab-measure">{bar.index + 1}</text>
            <line x1={bar.right - 1} x2={bar.right - 1} y1={firstString} y2={bottom} className="tab-barline" />
          </g>)}
          {sequence.map(({ center, note }, i) => {
            const finger = note.fingering;
            const y = finger ? firstString + (finger.string - 1) * stringGap : (firstString + bottom) / 2;
            const next = sequence[i + 1];
            const tieEnd = next?.note.midi === note.midi ? next.center - center - 9 : Math.min(19, end - center);
            const isCurrent = note.id === selected;
            return <g key={note.id} transform={'translate(' + center + ',0)'} data-active={note.id === active}
              className="tab-note" role="button" tabIndex={0} aria-pressed={isCurrent}
              aria-label={pitchLabel(note.midi) + (finger ? '，' + finger.string + ' 弦 ' + finger.fret + ' 品' : '')}
              onClick={() => setSelected(note.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(note.id); }
              }}>
              <rect className="note-bg" x={diagrams ? -19 : -12} y={diagrams ? 18 : firstString - 8} width={diagrams ? 38 : 24} height={diagrams ? bottom - 10 : bottom - firstString + 16} rx="5" />
              {diagrams && finger && <FingeringDiagram fingering={finger} strings={strings} inline />}
              <rect className="tab-fret-bg" x="-9" y={y - 8} width="18" height="16" rx="3" />
              <text className="tab-fret" textAnchor="middle" y={y + 4.5}>{finger ? finger.fret : note.midi === null ? '–' : '×'}</text>
              {note.isTieStart && tieEnd > 10 && <path d={'M 8 ' + (y - 7) + ' Q ' + ((tieEnd + 8) / 2) + ' ' + (y - 16) + ' ' + tieEnd + ' ' + (y - 7)}
                stroke="currentColor" fill="none" />}
            </g>;
          })}
        </svg>;
      })}
    </div>
  </div>;
}
