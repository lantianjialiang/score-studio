'use client';

import { useEffect, useState } from 'react';
import { beats, pitchLabel, type NoteEvent, type ScoreDocument } from '../music/score';
import { Jianpu } from './notation';

export type Recognition = { score: ScoreDocument; confidence: number; notes: Record<string, number> };
const lengths: Record<NoteEvent['duration'], string> = { w: '全音符', h: '二分音符', q: '四分音符', '8': '八分音符', '16': '十六分音符' };

export async function recognize(file: File, signal: AbortSignal): Promise<Recognition> {
  if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB。');
  const data = new FormData();
  data.set('file', file);
  const response = await fetch('/api/recognize', { method: 'POST', body: data, signal }).catch(problem => {
    if (signal.aborted) throw problem;
    throw new Error('连接中断，请检查网络后重试。');
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.score?.measures?.[0]?.notes?.length) {
    throw new Error(typeof result?.detail === 'string' ? result.detail : '图片识别失败，请重试或换一张图片。');
  }
  return result;
}

export function Review({ result, image, onApply, onCancel }: {
  result: Recognition; image: File; onApply: (score: ScoreDocument) => void; onCancel: () => void;
}) {
  const [score, setScore] = useState(result.score);
  const [selected, setSelected] = useState(result.score.measures[0].notes[0].id);
  const [preview, setPreview] = useState('');
  const [changed, setChanged] = useState(new Set<string>());
  const note = score.measures.flatMap(bar => bar.notes).find(item => item.id === selected)!;
  const bar = score.measures.find(item => item.notes.includes(note))!;
  const percent = (value: number) => Math.round(value * 100) + '%';

  useEffect(() => {
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function update(patch: Partial<NoteEvent>) {
    setChanged(old => new Set(old).add(selected));
    setScore(previous => ({ ...previous, measures: previous.measures.map(measure => ({
      ...measure, notes: measure.notes.map(item => item.id === selected ? { ...item, ...patch } : item),
    })) }));
  }

  function apply() {
    const sequence = score.measures.flatMap(item => item.notes);
    const invalid = new Set(sequence.filter((item, i) => item.isTieStart &&
      (item.midi === null || item.midi !== sequence[i + 1]?.midi)).map(item => item.id));
    onApply({ ...score, measures: score.measures.map(item => ({
      ...item, notes: item.notes.map(event => invalid.has(event.id) ? { ...event, isTieStart: false } : event),
    })) });
  }

  return <section className="editor review">
    <div className="review-header"><div><h2>识别校对</h2><p>识别置信度 {percent(result.confidence)} · 点选音符进行修正</p></div>
      <div><button onClick={onCancel}>取消</button><button className="primary" onClick={apply}>应用乐谱</button></div></div>
    <div className="review-body">
      {preview && <img src={preview} alt="待校对的原始乐谱" />}
      <div>
        <Jianpu score={score} active={selected} onNote={setSelected} />
        <div className="note-edit">
          <div><strong>第 {bar.index + 1} 小节 · {pitchLabel(note.midi)}</strong><p>{changed.has(selected) ? '已手动修改' : '音符置信度 ' + percent(result.notes[selected] ?? 0)}</p></div>
          <label>音高<select value={note.midi ?? 'rest'} onChange={event => update({ midi: event.target.value === 'rest' ? null : Number(event.target.value) })}>
            <option value="rest">休止</option>
            {Array.from({ length: 128 }, (_, midi) => <option key={midi} value={midi}>{pitchLabel(midi)}（{midi}）</option>)}
          </select></label>
          <label>时值<select value={note.duration} onChange={event => update({ duration: event.target.value as NoteEvent['duration'] })}>
            {Object.entries(lengths).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>附点<select value={note.dots} onChange={event => update({ dots: Number(event.target.value) })}>
            {[0, 1, 2].map(value => <option key={value}>{value}</option>)}
          </select></label>
          <span>{beats(note)} 个四分音符时长</span>
        </div>
      </div>
    </div>
  </section>;
}
