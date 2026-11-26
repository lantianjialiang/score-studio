import { beats, durations, type Measure, type NoteEvent, type ScoreDocument } from './score';

const majors = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const minors = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
const steps = ['C', 'C', 'D', 'E', 'E', 'F', 'F', 'G', 'A', 'A', 'B', 'B'];
const alters = [0, 1, 0, -1, 0, 0, 1, 0, -1, 0, -1, 0];
const types = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th' };
const rhythm = (Object.keys(durations) as NoteEvent['duration'][]).flatMap(duration => [0, 1, 2].map(dots => ({
  duration, dots, ticks: beats({ id: '', midi: null, duration, dots }) * 16,
}))).sort((a, b) => b.ticks - a.ticks);

type Span = { start: number; end: number; midi: number | null; tie?: boolean };
export type ImportedScore = { score: ScoreDocument; notice: string };

function fillBar(spans: Span[], length: number, index: number): Measure {
  const notes: NoteEvent[] = [];
  let cursor = 0;
  const append = (until: number, midi: number | null, tie = false) => {
    while (until - cursor >= 4) {
      const value = rhythm.find(item => item.ticks <= until - cursor)!;
      cursor += value.ticks;
      notes.push({ id: index + '-' + notes.length, midi, duration: value.duration, dots: value.dots,
        isTieStart: midi !== null && (until - cursor >= 4 || tie) });
    }
  };
  for (const span of spans.toSorted((a, b) => a.start - b.start || (b.midi ?? -1) - (a.midi ?? -1))) {
    if (span.start < cursor) continue;
    append(span.start, null);
    append(Math.min(span.end, length), span.midi, span.tie);
  }
  append(length, null);
  return { index, notes };
}

const snap = (quarter: number) => Math.round(quarter * 4) * 4;
const xmlTicks = (quarter: number) => Math.round(quarter * 16);
const number = (node: ParentNode | null, selector: string, fallback = 0) => Number(node?.querySelector(selector)?.textContent ?? fallback);
const child = (node: Element, tag: string) => [...node.children].find(element => element.localName === tag);
const validMeter = (top: number, bottom: number) => Number.isInteger(top) && top > 0 && top <= 32 && [1, 2, 4, 8, 16].includes(bottom);

export function fromMusicXml(xml: string, fallback: string): ImportedScore {
  const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
  if (root.localName !== 'score-partwise') throw new Error('需要有效的 score-partwise MusicXML 文件。');
  const part = child(root, 'part');
  if (!part) throw new Error('MusicXML 里没有可用声部。');
  const bars = [...part.children].filter(element => element.localName === 'measure');
  if (!bars.length || bars.length > 2000) throw new Error('小节数量需要在 1 到 2000 之间。');
  const meter = bars[0].querySelector('attributes > time');
  const numerator = number(meter, 'beats', 4);
  const denominator = number(meter, 'beat-type', 4);
  if (!validMeter(numerator, denominator)) throw new Error('此拍号暂不受支持。');
  const key = bars[0].querySelector('attributes > key');
  const signature = (key?.querySelector('mode')?.textContent === 'minor' ? minors : majors)[number(key, 'fifths') + 7] ?? 'C';
  const tempo = Number(part.querySelector('sound[tempo]')?.getAttribute('tempo') ?? part.querySelector('per-minute')?.textContent ?? 100);
  let divisions = 1;
  let simplified = root.querySelectorAll(':scope > part').length > 1 || part.querySelectorAll('sound[tempo]').length > 1;
  const firstVoice = part.querySelector('note > voice')?.textContent ?? '1';
  const firstStaff = part.querySelector('note > staff')?.textContent ?? '1';
  const measures = bars.map((bar, index) => {
    let time = 0;
    let last = 0;
    let end = 0;
    const spans: Span[] = [];
    for (const node of bar.children) {
      if (node.localName === 'attributes') {
        divisions = Math.max(1, number(node, 'divisions', divisions));
        if (index && (node.querySelector('time, key'))) simplified = true;
      }
      const duration = number(node, 'duration') / divisions;
      if (node.localName === 'backup') { time -= duration; continue; }
      if (node.localName === 'forward') { time += duration; end = Math.max(end, time); continue; }
      if (node.localName !== 'note') continue;
      const chord = Boolean(child(node, 'chord'));
      if (!chord) { last = time; time += duration; }
      end = Math.max(end, last + duration);
      if ((child(node, 'voice')?.textContent ?? '1') !== firstVoice || (child(node, 'staff')?.textContent ?? '1') !== firstStaff) {
        simplified = true;
        continue;
      }
      if (!duration) { simplified = true; continue; }
      const step = node.querySelector('pitch > step')?.textContent ?? '';
      const pitchClass: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const midi = step in pitchClass ? 12 * (number(node, 'pitch > octave') + 1) + pitchClass[step] + number(node, 'pitch > alter') : null;
      if (midi !== null && (!Number.isInteger(midi) || midi < 0 || midi > 127)) throw new Error('MusicXML 含有超出支持范围的音高。');
      const start = xmlTicks(last);
      const finish = xmlTicks(last + duration);
      if (chord || Math.abs(start - last * 16) > .001 || Math.abs(finish - (last + duration) * 16) > .001) simplified = true;
      spans.push({ start, end: Math.max(start + 4, finish), midi, tie: Boolean(node.querySelector('tie[type=start]')) });
    }
    const length = xmlTicks(end || numerator * 4 / denominator);
    if (!Number.isFinite(length) || length > 2048) throw new Error('MusicXML 中有无效的小节时值。');
    return fillBar(spans, Math.max(4, length), index);
  });
  const title = root.querySelector('work-title, movement-title, credit-words')?.textContent?.trim() || fallback;
  return { score: { id: crypto.randomUUID(), title, tempo: tempo > 0 && Number.isFinite(tempo) ? tempo : 100,
    timeSignature: { numerator, denominator }, keySignature: signature, measures },
    notice: simplified ? '已按主旋律导入，重叠音符取最高音。变拍、变调和复杂时值已简化。' : '' };
}

export async function importScore(file: File): Promise<ImportedScore> {
  if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB。');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const name = file.name.replace(/\.[^.]+$/, '');
  if (extension === 'musicxml' || extension === 'xml') return fromMusicXml(await file.text(), name);
  if (extension === 'mxl') {
    const { unzipSync, strFromU8 } = await import('fflate');
    let total = 0;
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
      total += entry.originalSize;
      if (total > 25 * 1024 * 1024) throw new Error('压缩乐谱解包后超过 25 MB。');
      return entry.name === 'META-INF/container.xml' || /\.(musicxml|xml)$/i.test(entry.name);
    } });
    const container = entries['META-INF/container.xml'];
    const path = container && new DOMParser().parseFromString(strFromU8(container), 'text/xml')
      .querySelector('rootfile')?.getAttribute('full-path');
    const data = path ? entries[path] : entries[Object.keys(entries).find(key => !key.startsWith('META-INF/')) ?? ''];
    if (!data) throw new Error('MXL 压缩包中找不到乐谱。');
    return fromMusicXml(strFromU8(data), name);
  }
  if (extension !== 'mid' && extension !== 'midi') throw new Error('请选择 MusicXML、MXL、MIDI、PNG 或 JPG 文件。');
  const { Midi } = await import('@tonejs/midi');
  const midi = new Midi(await file.arrayBuffer());
  const tracks = midi.tracks.filter(track => track.channel !== 9 && track.notes.length);
  if (!tracks.length) throw new Error('MIDI 文件没有可导入的旋律音轨。');
  const [numerator, denominator] = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  if (!validMeter(numerator, denominator)) throw new Error('此拍号暂不受支持。');
  const size = numerator * 64 / denominator;
  const bins: Span[][] = [];
  let simplified = tracks.length > 1 || midi.header.tempos.length > 1 || midi.header.timeSignatures.length > 1 || midi.header.keySignatures.length > 1;
  let previousEnd = 0;
  const sorted = tracks[0].notes.toSorted((a, b) => a.ticks - b.ticks || b.midi - a.midi);
  for (const note of sorted) {
    let start = snap(note.ticks / midi.header.ppq);
    const end = Math.max(start + 4, snap((note.ticks + note.durationTicks) / midi.header.ppq));
    if (!Number.isFinite(end) || end > size * 2000) throw new Error('MIDI 超过 2000 小节或包含无效时值。');
    if (start < previousEnd) { simplified = true; continue; }
    if (Math.abs(start - note.ticks / midi.header.ppq * 16) > .001 ||
        Math.abs(end - (note.ticks + note.durationTicks) / midi.header.ppq * 16) > .001) simplified = true;
    previousEnd = end;
    while (start < end) {
      const index = Math.floor(start / size);
      const barEnd = Math.min(end, (index + 1) * size);
      (bins[index] ??= []).push({ start: start - index * size, end: barEnd - index * size, midi: note.midi, tie: barEnd < end });
      start = barEnd;
    }
  }
  const key = midi.header.keySignatures[0];
  return { score: { id: crypto.randomUUID(), title: midi.name || name, tempo: midi.header.tempos[0]?.bpm || 100,
    keySignature: key ? key.key + (key.scale === 'minor' ? 'm' : '') : 'C', timeSignature: { numerator, denominator },
    measures: Array.from({ length: bins.length }, (_, index) => fillBar(bins[index] ?? [], size, index)) },
    notice: simplified ? '已提取第一条旋律音轨，重叠音符已简化。时值按十六分音符对齐。' : '' };
}

export function toMusicXml(score: ScoreDocument) {
  const keys = score.keySignature.endsWith('m') ? minors : majors;
  const fifths = keys.includes(score.keySignature) ? keys.indexOf(score.keySignature) - 7 : 0;
  const flat = fifths < 0;
  const proper = flat ? ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'] : steps;
  const accidental = flat ? [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0] : alters;
  let previous: NoteEvent | undefined;
  const bars = score.measures.map((bar, i) => '<measure number="' + (i + 1) + '">' + (i ? '' :
    '<attributes><divisions>16</divisions><key><fifths>' + fifths + '</fifths></key><time><beats>' + score.timeSignature.numerator +
    '</beats><beat-type>' + score.timeSignature.denominator + '</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>') +
    bar.notes.map(note => {
      const pitch = note.midi === null ? '<rest/>' : '<pitch><step>' + proper[note.midi % 12] + '</step><alter>' +
        accidental[note.midi % 12] + '</alter><octave>' + (Math.floor(note.midi / 12) - 1) + '</octave></pitch>';
      const stop = Boolean(note.midi !== null && previous?.isTieStart && previous.midi === note.midi);
      const tie = stop || note.isTieStart ? '<notations>' + (stop ? '<tied type="stop"/>' : '') + (note.isTieStart ? '<tied type="start"/>' : '') + '</notations>' : '';
      previous = note;
      return '<note>' + pitch + '<duration>' + beats(note) * 16 + '</duration>' + (stop ? '<tie type="stop"/>' : '') +
        (note.isTieStart ? '<tie type="start"/>' : '') + '<type>' + types[note.duration] + '</type>' + '<dot/>'.repeat(note.dots) + tie + '</note>';
    }).join('') + '</measure>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1">' + bars + '</part></score-partwise>';
}
