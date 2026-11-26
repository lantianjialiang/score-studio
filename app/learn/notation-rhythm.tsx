'use client';

import { useMemo, useState } from 'react';
import { parseJianpu, keyPitch, pitchLabel } from '../../music/score';
import { Jianpu, Staff } from '../notation';
import { Lab, useAudioAction } from './shared';

const circle = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const sharps = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const flats = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const notesGuide = [
  ['1–7', '相对于主音的音级'], ['上点 / 下点', '升 / 降一个八度（频率 ×2 / ÷2）'],
  ['下划线', '每加一条，时值减半'], ['右边的短横线', '每条延长一个四分音符时值'], ['右侧附点', '加上原时值的一半'],
];

export function KeySignatureMacro() {
  const [index, setIndex] = useState(0);
  const key = circle[index];
  const fifths = index <= 6 ? index : index - 12;
  const alterations = (fifths >= 0 ? sharps : flats).slice(0, Math.abs(fifths));
  const melody = useMemo(() => parseJianpu('1=' + key + ' 4/4\n1 2 3 4 | 5 6 7 1\''), [key]);
  const offset = keyPitch(key);
  const audio = useAudioAction();
  return <Lab id="keys" index={4} title="调号与简谱" explanation="五线谱的线和间按七个音名循环。调号告诉你哪些音名默认升降。简谱把主音写成 1，移调时同一组数字可对应不同的实际音高。">
    <div className="circle-panel">
      <svg className="fifths" viewBox="0 0 270 270" aria-label="五度圈">
        <circle cx="135" cy="135" r="99" fill="none" stroke="#e0d8f3" strokeWidth="2" />
        <text x="135" y="129" textAnchor="middle" fontSize="24" fontWeight="700">{key}</text>
        <text x="135" y="153" textAnchor="middle" fill="#64677a" fontSize="12">{Math.abs(fifths)} 个{fifths < 0 ? '降号' : '升号'}</text>
        {circle.map((name, i) => {
          const theta = i * Math.PI / 6 - Math.PI / 2;
          return <g key={name} className="fifth-button" transform={'translate(' + (135 + 99 * Math.cos(theta)) + ' ' + (135 + 99 * Math.sin(theta)) + ')'}
            role="button" aria-label={name + ' 大调'} aria-pressed={index === i} tabIndex={0}
            onClick={() => setIndex(i)} onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIndex(i); }
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setIndex((i + (e.key === 'ArrowRight' ? 1 : 11)) % 12); }
            }}>
            <circle r="17" /><text textAnchor="middle" y="4.5">{name}</text>
          </g>;
        })}
      </svg>
      <div className="circle-actions">
        <button className="action" onClick={() => setIndex((index + 11) % 12)}>逆时针</button>
        <button className="action" onClick={() => setIndex((index + 1) % 12)}>顺时针</button>
        <button className="action primary" onClick={() => void audio.run(engine => engine.note(60 + offset))}>试听主音</button>
      </div>
    </div>
    <div className="notation-trio">
      <div><h3>五线谱</h3><Staff score={melody} active={null} /></div>
      <div><h3>音高映射</h3><pre>{'const TONIC = ' + (60 + offset) + '; // ' + pitchLabel(60 + offset) + '\nconst OFFSET = ' + offset + ';\n' +
        (alterations.length ? alterations.map(note => '// ' + note + ' → ' + note + (fifths > 0 ? '♯' : '♭')).join('\n') : '// 无默认升降号')}</pre></div>
      <div><h3>数字简谱 · 1={key}</h3><Jianpu score={melody} active={null} /></div>
    </div>
    <dl className="symbol-guide">{notesGuide.map(([symbol, definition]) => <div key={symbol}><dt>{symbol}</dt><dd>{definition}</dd></div>)}</dl>
    {audio.error && <p role="alert">{audio.error}</p>}
  </Lab>;
}

const meters = { '4/4': [2, 0, 1, 0], '3/4': [2, 0, 0], '6/8': [2, 0, 0, 1, 0, 0] };
const lengths = ['全音符', '二分音符', '四分音符', '八分音符'];

export function RhythmGridLab() {
  const [split, setSplit] = useState(0);
  const [tempo, setTempo] = useState(94);
  const [meter, setMeter] = useState<keyof typeof meters>('4/4');
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [cell, setCell] = useState(-1);
  const audio = useAudioAction();
  const blockAudio = useAudioAction();
  const beats = meters[meter];
  const duration = 60 / tempo;
  function stop() {
    audio.stop(); setPlaying(false); setStep(-1);
  }
  function start() {
    void audio.run(({ Tone, beat }, signal) => {
      const transport = Tone.getTransport();
      let count = 0;
      const loop = new Tone.Loop(time => {
        const index = count++ % beats.length;
        beat(beats[index], time);
        Tone.getDraw().schedule(() => { if (!signal.aborted) setStep(index); }, time);
      }, duration * (meter === '6/8' ? .5 : 1)).start(0);
      signal.addEventListener('abort', () => { loop.dispose(); transport.stop(); transport.position = 0; }, { once: true });
      setPlaying(true);
      transport.start();
    });
  }
  return <Lab id="rhythm" index={5} title="节奏、时值与拍号" explanation="一个全音符可平分成两个二分音符，再平分成四个四分音符。拍号负责组织重音，BPM 决定它们走得多快。">
    <div className="lab-result"><strong>{lengths[split]} · 全音符时值的 1/{2 ** split}</strong>
      <div className="lab-buttons"><button className="action" disabled={split === 0} onClick={() => { blockAudio.stop(); setCell(-1); setSplit(split - 1); }}>合并一层</button>
        <button className="action" disabled={split === 3} onClick={() => { blockAudio.stop(); setCell(-1); setSplit(split + 1); }}>平分一层</button></div></div>
    <div className="rhythm-blocks">{Array.from({ length: 2 ** split }, (_, i) => <button key={i} aria-pressed={cell === i} onClick={() => {
      setCell(i); void blockAudio.run(engine => engine.note(67, duration * 4 / 2 ** split));
    }}>{2 ** split <= 4 ? (4 / 2 ** split) + ' 拍' : '½'}</button>)}</div>
    <p className="lab-small">点色块试听一次。一个附点把原时值乘以 1.5。</p>
    <div className="lab-controls">
      <label>拍号 <select value={meter} onChange={e => { stop(); setMeter(e.target.value as keyof typeof meters); }}>
        {Object.keys(meters).map(key => <option key={key}>{key}</option>)}</select></label>
      <label>速度 <strong>{tempo} BPM</strong><input type="range" min="45" max="180" value={tempo} onChange={e => { stop(); setTempo(+e.target.value); }} /></label>
      <button className="action primary" onClick={playing ? stop : start}>{playing ? '停止节拍' : '播放节拍'}</button>
    </div>
    <div className="accent-grid" aria-label="节拍重音">{beats.map((level, i) => <span key={i} data-level={level} data-current={step === i}>{i + 1}<small>{level === 2 ? '强' : level === 1 ? '次强' : '弱'}</small></span>)}</div>
    <p className="lab-small">四分音符 = {duration.toFixed(2)} 秒{meter === '6/8' ? '，八分音符 = ' + (duration / 2).toFixed(2) + ' 秒。每三格为一组。' : '。'}</p>
    {(audio.error || blockAudio.error) && <p role="alert">{audio.error || blockAudio.error}</p>}
  </Lab>;
}