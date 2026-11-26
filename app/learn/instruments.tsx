'use client';

import { useMemo, useRef, useState } from 'react';
import { examples } from '../../music/examples';
import { tunings, type Instrument } from '../../music/fretboard';
import { parseJianpu, pitchLabel } from '../../music/score';
import { timeline } from '../../music/playback';
import { chordShape, fretPositions, midiToFreq, pitchClasses, stringRatio } from '../../music/theory';
import type { LabVoice } from '../../music/theory-audio';
import { Lab, Piano, later, useAudioAction } from './shared';

const names = { guitar: '吉他', ukulele: '尤克里里' } as const;
const instruments = ['guitar', 'ukulele'] as const;

function Shape({ instrument, shape }: { instrument: Instrument; shape: (number | null)[] }) {
  const open = tunings[instrument].pitches.toReversed();
  const layout = shape.toReversed();
  return <figure className="chord-shape">
    <figcaption>{names[instrument]}</figcaption>
    {shape.length ? <svg viewBox="0 0 134 147" role="img" aria-label={names[instrument] + '和弦指法，' +
      shape.map((fret, i) => (i + 1) + ' 弦 ' + (fret === null ? '不弹' : fret + ' 品')).join('，')}>
      {Array.from({ length: 7 }, (_, fret) => <line key={fret} x1="18" x2="116" y1={35 + fret * 16} y2={35 + fret * 16} stroke={fret === 0 ? '#343247' : '#beb7ce'} strokeWidth={fret === 0 ? 3 : 1} />)}
      {open.map((midi, i) => {
        const x = 18 + i * 98 / (open.length - 1);
        const fret = layout[i];
        return <g key={i}>
          <line x1={x} x2={x} y1="35" y2="131" stroke="#beb7ce"/>
          <text x={x} y="12" textAnchor="middle" fontSize="10">{pitchLabel(midi)}</text>
          {fret ? <circle cx={x} cy={27 + fret * 16} r="5.3" fill="#5940b2"/> :
            <text x={x} y="27" textAnchor="middle" fontSize="11">{fret === 0 ? '○' : '×'}</text>}
        </g>;
      })}
    </svg> : <p>当前配置下无低把位指法。</p>}
  </figure>;
}

export function ChordBuilderLab() {
  const [root, setRoot] = useState(60);
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [voice, setVoice] = useState<Instrument>('guitar');
  const [active, setActive] = useState<number | null>(null);
  const audio = useAudioAction();
  const chord = [root, root + (mode === 'major' ? 4 : 3), root + 7];
  const shapes = useMemo(() => ({
    guitar: chordShape(root, mode, 'guitar'), ukulele: chordShape(root, mode, 'ukulele'),
  }), [root, mode]);
  const marks = Object.fromEntries(chord.map((n, i) => [n, { label: ['根音', '三音', '五音'][i],
    kind: n === active ? 'playing' : i === 0 ? 'root' : 'selected' }] as const));
  function play(sweep: boolean) {
    void audio.run((engine, signal) => {
      const pitches = shapes[voice].flatMap((fret, i) => fret === null ? [] : [tunings[voice].pitches[i] + fret]).sort((a, b) => a - b);
      const notes = pitches.length ? pitches : chord;
      notes.forEach((midi, i) => later(signal, () => { engine.note(midi, .9, voice); setActive(chord.find(n => n % 12 === midi % 12) ?? null); }, sweep ? i * 150 : 0));
      later(signal, () => setActive(null), (sweep ? notes.length * 150 : 0) + 900);
    });
  }
  return <Lab id="chords" index={6} title="从音阶构建三和弦" explanation="在音阶里隔一个取一个，就得到第 1、3、5 级。大三和弦的相邻跨度是 4 + 3 个半音，小三和弦是 3 + 4。">
    <div className="lab-controls">
      <label>和弦类型 <select value={mode} onChange={e => { audio.stop(); setActive(null); setMode(e.target.value as typeof mode); }}>
        <option value="major">大三和弦</option><option value="minor">小三和弦</option></select></label>
      <label>试听指法 <select value={voice} onChange={e => { audio.stop(); setActive(null); setVoice(e.target.value as Instrument); }}>
        {instruments.map(kind => <option key={kind} value={kind}>{names[kind]}</option>)}</select></label>
    </div>
    <Piano from={60} count={25} marks={marks} onKey={midi => {
      const next = 60 + midi % 12;
      setRoot(next); setActive(null);
      void audio.run((engine, signal) => [next, next + (mode === 'major' ? 4 : 3), next + 7].forEach((note, i) => {
        later(signal, () => { setActive(note); engine.note(note, .22); }, i * 260);
        if (i === 2) later(signal, () => setActive(null), 800);
      }));
    }} />
    <div className="lab-result"><output>{pitchClasses[root % 12]}{mode === 'minor' ? 'm' : ''} · {chord.map(pitchLabel).join(' → ')} · {mode === 'major' ? '+4 / +3' : '+3 / +4'}</output>
      <div className="lab-buttons"><button className="action primary" onClick={() => play(false)}>同时发声</button><button className="action" onClick={() => play(true)}>琶音试听</button></div></div>
    <div className="shape-pair">{instruments.map(kind => <Shape key={kind} instrument={kind} shape={shapes[kind]} />)}</div>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}

export function FretboardMapper() {
  const [midi, setMidi] = useState(64);
  const [chosen, setChosen] = useState<{ type: Instrument; string: number; fret: number } | null>(null);
  const audio = useAudioAction();
  return <Lab id="frets" index={7} title="琴弦物理与同音异位" explanation="每升一品，有效弦长乘以 2⁻¹/¹²，音高升一个半音。吉他一弦空弦和二弦五品都能弹 E4。">
    <Piano from={40} count={42} marks={{ [midi]: { label: '当前', kind: 'playing' } }} onKey={n => {
      setMidi(n); setChosen(null); void audio.run(engine => engine.note(n));
    }} />
    <div className="lab-result"><output>{pitchLabel(midi)} · MIDI {midi} · {midiToFreq(midi).toFixed(1)} Hz</output>
      {chosen && <span>{names[chosen.type]} {chosen.string} 弦 {chosen.fret} 品 · 有效弦长 {(stringRatio(chosen.fret) * 100).toFixed(1)}%</span>}</div>
    {instruments.map(type => {
      const positions = fretPositions(midi, type);
      const best = Math.min(...positions.filter(pos => pos.beginner).map(pos => pos.fret));
      return <div className="fret-map" key={type}>
        <h3>{names[type]} <small>{positions.length} 个同音位置</small></h3>
        <div className="fret-scroll"><div className="fret-grid" aria-label={names[type] + '指板'}>
          <span>弦</span>{Array.from({ length: 13 }, (_, fret) => <span key={fret}>{fret === 0 ? '空' : fret}</span>)}
          {tunings[type].pitches.map((open, i) => <div className="fret-row" key={i}>
            <span>{i + 1} {pitchLabel(open)}</span>
            {Array.from({ length: 13 }, (_, fret) => <button key={fret} type="button" data-match={open + fret === midi}
              data-easy={open + fret === midi && fret === best} aria-label={names[type] + ' ' + (i + 1) + ' 弦 ' + fret + ' 品 ' + pitchLabel(open + fret)}
              onClick={() => { setMidi(open + fret); setChosen({ type, string: i + 1, fret }); void audio.run(engine => engine.note(open + fret, .45, type)); }}><span /></button>)}
          </div>)}
        </div></div>
      </div>;
    })}
    <p className="lab-small">紫点标出同音位置，金色圆环标出优先考虑的低把位。</p>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}

const melody = timeline(parseJianpu(examples[1].source, examples[1].title).measures.slice(0, 4));
const midiVoices: Record<LabVoice, string> = { piano: '钢琴', guitar: '原声吉他', ukulele: '尤克里里', chip: '8-bit 合成器' };
const velocity = 95;
const secondsPerBeat = .5;
const timestamp = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + (seconds % 60).toFixed(2).padStart(5, '0');

export function MidiInspector() {
  const [voice, setVoice] = useState<LabVoice>('piano');
  const nextVoice = useRef<LabVoice>('piano');
  const [events, setEvents] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const audio = useAudioAction();
  function play() {
    if (playing) { audio.stop(); setPlaying(false); setActive(null); return; }
    void audio.run((engine, signal) => {
      setEvents([]); setPlaying(true);
      const write = (time: number, message: string) => {
        setEvents(previous => [...previous, '[' + timestamp(time) + '] ' + message]);
        if (log.current) requestAnimationFrame(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; });
      };
      melody.events.forEach(({ note, offset, length, continuation }) => {
        if (note.midi === null || continuation) return;
        const midi = note.midi;
        const start = offset * secondsPerBeat;
        const end = (offset + length) * secondsPerBeat - .02;
        later(signal, () => {
          setActive(note.id); engine.note(midi, end - start, nextVoice.current);
          write(start, 'NOTE_ON  ' + midi + ' (' + pitchLabel(midi) + ' · ' + midiToFreq(midi).toFixed(1) + ' Hz)  VELOCITY ' + velocity);
        }, start * 1000);
        later(signal, () => write(end, 'NOTE_OFF ' + midi + ' (' + pitchLabel(midi) + ')'), end * 1000);
      });
      later(signal, () => { setPlaying(false); setActive(null); }, melody.length * secondsPerBeat * 1000);
    });
  }
  return <Lab id="midi" index={8} title="MIDI 指令与音色" explanation="MIDI 记录何时按键、音高、力度和松键时间。合成器读取同一组指令，可以换成不同音色播放。">
    <div className="lab-controls"><label>音色 <select value={voice} onChange={e => {
      nextVoice.current = e.target.value as LabVoice; setVoice(nextVoice.current);
    }}>{Object.entries(midiVoices).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button className="action primary" onClick={play}>{playing ? '停止 MIDI' : '播放《欢乐颂》片段'}</button></div>
    <div className="roll-and-log">
      <div className="piano-roll" role="img" aria-label="欢乐颂前四小节钢琴卷帘">
        {[67, 65, 64, 62, 60].map((midi, i) => <span key={midi} className="roll-lane" style={{ top: i * 20 + '%' }}>{pitchLabel(midi)}</span>)}
        <div className="roll-notes">
          {melody.events.map(({ note, offset, length }) => note.midi !== null && <span className="roll-note" key={note.id}
            data-current={note.id === active} style={{ left: offset / melody.length * 100 + '%', width: length / melody.length * 100 + '%',
              top: [67, 65, 64, 62, 60].indexOf(note.midi) * 20 + 4 + '%' }} />)}
        </div>
      </div>
      <div className="midi-log" ref={log} aria-label="MIDI 指令流" tabIndex={0}>
        {events.length ? events.map((line, i) => <code key={i}>{line}</code>) : <code>等待播放 · NOTE_ON / NOTE_OFF</code>}
      </div>
    </div>
    <p className="lab-small">播放中切换音色，下一次按键指令就会用新音色发声。</p>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}