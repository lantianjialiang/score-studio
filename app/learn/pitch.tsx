'use client';

import { useEffect, useRef, useState } from 'react';
import { intervals, midiToFreq, pitchClasses, scaleNotes, steps } from '../../music/theory';
import { pitchLabel } from '../../music/score';
import { Lab, Piano, later, useAudioAction } from './shared';

const ratios = [
  ['同度', 1, 1], ['八度', 2, 1], ['纯五度', 3, 2], ['纯四度', 4, 3], ['大三度', 5, 4], ['三全音', 45, 32],
] as const;
const whites = [60, 62, 64, 65, 67, 69, 71, 72];

export function PitchRatioLab() {
  const [a, setA] = useState(220);
  const [b, setB] = useState(330);
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useAudioAction();
  useEffect(() => {
    const node = canvas.current!;
    const context = node.getContext('2d');
    if (!context) return;
    const paint = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = node.clientWidth;
      const height = node.clientHeight;
      node.width = width * ratio;
      node.height = height * ratio;
      context.scale(ratio, ratio);
      const colors = ['#6248bd', '#137e79', '#9e4c16'];
      for (let row = 0; row < 3; row++) {
        const mid = (row * 2 + 1) * height / 6;
        context.strokeStyle = '#e4deee';
        context.beginPath();
        context.moveTo(0, mid); context.lineTo(width, mid); context.stroke();
        context.strokeStyle = colors[row]; context.lineWidth = 1.65;
        context.beginPath();
        for (let x = 0; x < width; x++) {
          const t = x / width * .02;
          const s1 = Math.sin(2 * Math.PI * a * t);
          const s2 = Math.sin(2 * Math.PI * b * t);
          const y = mid - (row === 0 ? s1 : row === 1 ? s2 : (s1 + s2) / 2) * height / 9;
          if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.stroke();
      }
    };
    const observer = new ResizeObserver(paint);
    observer.observe(node);
    paint();
    return () => observer.disconnect();
  }, [a, b]);
  return <Lab id="pitch" index={1} title="音高与音程" explanation="频率表示声波每秒振动多少次。比较两个音的音程，要看频率的比值。简单的整数比会让波形更经常回到同一相位。">
    <div className="lab-controls">
      <label>基频 <strong>{a} Hz</strong><input type="range" min="110" max="440" value={a} onChange={e => setA(+e.target.value)} /></label>
      <label>对比频率 <strong>{b.toFixed(1)} Hz</strong><input type="range" min="55" max="1100" step=".1" value={b} onChange={e => setB(+e.target.value)} /></label>
    </div>
    <div className="lab-buttons">{ratios.map(([label, n, d]) => <button className="action" key={label} onClick={() => setB(a * n / d)}>{label} {n}:{d}</button>)}</div>
    <figure className="wave-figure"><figcaption>基频（紫） · 对比频率（绿） · 叠加波（橙） · 20 ms</figcaption>
      <canvas ref={canvas} aria-label="两条正弦波及叠加波，时域为 20 毫秒" />
    </figure>
    <div className="lab-result"><output>频率比 {(b / a).toFixed(4)} : 1</output><button className="action primary" onClick={() => void audio.run(engine => engine.frequencies([a, b]))}>试听双音</button></div>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}

export function OctaveCounter() {
  const [pair, setPair] = useState<[number, number]>([60, 67]);
  const [chooseStart, setChooseStart] = useState(true);
  const [walk, setWalk] = useState(-1);
  const audio = useAudioAction();
  const delta = Math.abs(pair[1] - pair[0]);
  const marks = Object.fromEntries(whites.map((note, i) => [note, { label: String(i + 1), kind: walk === i ? 'playing' : undefined }] as const));
  pair.forEach((midi, i) => {
    if (walk >= 0) return;
    const degree = whites.indexOf(midi) + 1;
    marks[midi] = { label: (degree ? degree + ' · ' : '') + (i === 0 ? '起点' : '终点'), kind: 'playing' };
  });
  return <Lab id="octave" index={2} title="为什么叫八度" explanation="从 C 数到下一个 C，包含首尾共有八个白键。两者之间是十二个半音，每走一个半音，频率乘以约 1.0595。">
    <Piano marks={marks} frequencies onKey={midi => {
      setWalk(-1);
      setPair(chooseStart ? [midi, pair[1]] : [pair[0], midi]);
      setChooseStart(!chooseStart);
      void audio.run(engine => engine.note(midi));
    }} />
    <p className="lab-small">点两次键选择区间。下一次选择{chooseStart ? '起点' : '终点'}。</p>
    <div className="lab-result"><output>{pitchLabel(pair[0])} → {pitchLabel(pair[1])} · {delta} 个半音 · ×{(2 ** (delta / 12)).toFixed(3)} · {intervals[delta]}</output>
      <button className="action primary" onClick={() => void audio.run((engine, signal) => {
        whites.forEach((midi, i) => later(signal, () => { setWalk(i); engine.note(midi, .24); }, i * 300));
        later(signal, () => setWalk(-1), 2400);
      })}>从一数到八</button></div>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}

export function ScaleTemplateSwitch() {
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [root, setRoot] = useState(60);
  const [compare, setCompare] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const audio = useAudioAction();
  const base = compare ? mode === 'major' ? 60 : 69 : root;
  const notes = scaleNotes(base, mode);
  const marks = Object.fromEntries(notes.map((midi, i) => [midi, {
    label: i === 0 ? '主音' : String(i + 1), kind: midi === active ? 'playing' : i === 0 ? 'root' : 'selected',
  }] as const));
  const sharedMarks = Object.fromEntries(whites.slice(0, 7).map(midi => [midi, {
    label: midi === 60 ? 'C 主音' : midi === 69 ? 'A 主音' : '●',
    kind: active !== null && active % 12 === midi % 12 ? 'playing' : midi === 60 || midi === 69 ? 'root' : 'selected',
  }] as const));
  return <Lab id="scales" index={3} title="自然大调与自然小调" explanation="从主音出发，按全音（两半音）或半音（一步）走满一个八度。大调的第三音离主音四个半音，自然小调是三个半音。">
    <div className="lab-controls">
      <label>音阶 <select value={mode} onChange={e => { audio.stop(); setActive(null); setMode(e.target.value as typeof mode); }}>
        <option value="major">自然大调</option><option value="minor">自然小调</option></select></label>
      <label>主音 <select disabled={compare} value={base % 12} onChange={e => { audio.stop(); setActive(null); setRoot(60 + +e.target.value); }}>
        {pitchClasses.map((name, i) => <option value={i} key={name}>{name}</option>)}
      </select></label>
      <label><input type="checkbox" checked={compare} onChange={e => { audio.stop(); setActive(null); setCompare(e.target.checked); }} /> 对比 C 大调与 A 小调</label>
    </div>
    {compare && <p className="lab-small">把不同八度的同名音放在一起，两者使用同一组七个键。按「演示音阶」听它们分别从 C 或 A 开始。</p>}
    <Piano from={60} count={compare ? 12 : 25} marks={compare ? sharedMarks : marks} onKey={midi => { setActive(midi); void audio.run(engine => engine.note(midi)); }} />
    <svg className="scale-arcs" viewBox="0 0 560 54" role="img" aria-label={steps[mode].join('、') + ' 半音'}>
      {steps[mode].map((step, i) => {
        const x = 22 + i * 75;
        const color = step === 2 ? '#137e79' : '#9e4c16';
        return <g key={i}><path d={'M' + x + ' 37 q36 -' + (step === 2 ? '35' : '20') + ' 72 0'} stroke={color} fill="none" strokeWidth="2" />
          <text x={x + 36} y="50" textAnchor="middle" fill={color} fontSize="12">{step === 2 ? '全音 W' : '半音 H'}</text></g>;
      })}
    </svg>
    <div className="lab-result"><output>{steps[mode].join(' – ')}</output><button className="action primary" onClick={() => void audio.run((engine, signal) => {
      notes.forEach((midi, i) => later(signal, () => { setActive(midi); engine.note(midi, .24); }, i * 305));
      later(signal, () => setActive(null), notes.length * 305);
    })}>演示音阶</button></div>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}
