'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { parseJianpu, transpose, writeJianpu, type ScoreDocument } from '../music/score';
import { exampleCategories, examples, searchKey } from '../music/examples';
import { playScore, voices, type Voice } from '../music/playback';
import { importScore } from '../music/formats';
import { Jianpu, Staff } from './notation';
import { solveFretboard, type Instrument, type FingeringMode } from '../music/fretboard';
import { Tablature } from './tablature';
import { recognize, Review, type Recognition } from './review';
import { libraryRequest, type SavedScore } from '../music/library';

const initialScore = parseJianpu(examples[0].source, examples[0].title);
const labels = { jianpu: '数字简谱', staff: '五线谱', guitar: '吉他六线谱', ukulele: '尤克里里四线谱' };
type View = keyof typeof labels;
const views = Object.keys(labels) as View[];
const isInstrument = (view: View): view is Instrument => view === 'guitar' || view === 'ukulele';
const filename = (title: string) => {
  const cleaned = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/, '');
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned) ? '_' + cleaned : cleaned || '乐谱';
};
type ScoreEntry = Omit<SavedScore, 'updatedAt'>;
type Draft = { title: string; source: string; original?: ScoreEntry };
type Upload = { file: File; error?: string; image: boolean };

export default function Studio() {
  const [score, setScore] = useState<ScoreDocument>(initialScore);
  const [selected, setSelected] = useState(0);
  const [shift, setShift] = useState(0);
  const [speed, setSpeed] = useState(100);
  const [voice, setVoice] = useState<Voice>('piano');
  const [click, setClick] = useState(false);
  const [countIn, setCountIn] = useState(false);
  const [loop, setLoop] = useState(false);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(initialScore.measures.length - 1);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<View>('jianpu');
  const [split, setSplit] = useState(false);
  const [compareView, setCompareView] = useState<View>('staff');
  const [library, setLibrary] = useState<SavedScore[]>([]);
  const [exampleQuery, setExampleQuery] = useState('');
  const [exampleGroup, setExampleGroup] = useState('');
  const [exampleLimit, setExampleLimit] = useState(12);
  const [modes, setModes] = useState<Record<Instrument, FingeringMode>>({ guitar: 'easy', ukulele: 'easy' });
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<SavedScore['origin']>('示例');
  const [originalSource, setOriginalSource] = useState<string | undefined>(examples[0].source);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [dragging, setDragging] = useState(false);
  const [review, setReview] = useState<{ result: Recognition; image: File } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const playback = useRef<AbortController | null>(null);
  const importRequest = useRef<AbortController | null>(null);
  const loopAnchor = useRef<number | null>(null);
  const display = useMemo(() => shift ? transpose(score, shift) : score, [score, shift]);
  const guitar = useMemo(() => solveFretboard(display, 'guitar', modes.guitar), [display, modes.guitar]);
  const ukulele = useMemo(() => solveFretboard(display, 'ukulele', modes.ukulele), [display, modes.ukulele]);
  const arrangements = { guitar, ukulele };
  const playbackScore = isInstrument(view) ? arrangements[view].score : display;
  const example = examples[selected];
  const query = searchKey(exampleQuery);
  const matchedExamples = examples.filter(example => {
    return (!exampleGroup || example.category === exampleGroup) &&
      [example.title, example.subtitle, example.alias].some(value => searchKey(value).includes(query));
  });
  const preview = useMemo(() => {
    if (!draft?.source.trim()) return null;
    try {
      const original = draft.original;
      const parsed = original?.source === draft.source ? original.score : parseJianpu(draft.source);
      return { score: { ...parsed, title: draft.title.trim() || '简谱预览' }, error: '' };
    } catch (problem) { return { score: null, error: (problem as Error).message }; }
  }, [draft]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshLibrary(controller.signal);
    try {
      const guitar = localStorage.getItem('mymusic.guitar.fingering');
      const ukulele = localStorage.getItem('mymusic.ukulele.fingering');
      setModes({ guitar: guitar === 'direct' ? 'direct' : 'easy', ukulele: ukulele === 'direct' ? 'direct' : 'easy' });
    } catch { /* The current session can still choose either mode. */ }
    return () => {
      controller.abort();
      playback.current?.abort();
      importRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    const original = document.title;
    const setPrintTitle = () => { document.title = filename(score.title); };
    const restoreTitle = () => { document.title = original; };
    if (printPreview) setPrintTitle();
    window.addEventListener('beforeprint', setPrintTitle);
    window.addEventListener('afterprint', printPreview ? setPrintTitle : restoreTitle);
    return () => {
      window.removeEventListener('beforeprint', setPrintTitle);
      window.removeEventListener('afterprint', printPreview ? setPrintTitle : restoreTitle);
      restoreTitle();
    };
  }, [score.title, printPreview]);

  async function refreshLibrary(signal?: AbortSignal) {
    setLibraryError('');
    try { setLibrary(await libraryRequest<SavedScore[]>('/api/scores', { signal, cache: 'no-store' })); }
    catch {
      if (!signal?.aborted) setLibraryError('无法连接服务器乐谱库。');
    }
  }

  function clearUpload() {
    importRequest.current?.abort();
    importRequest.current = null;
    setUpload(null);
  }

  function stop() {
    playback.current?.abort();
    setPlaying(false);
    setActive(null);
  }

  function load(next: ScoreDocument, options: { example?: number; saved?: SavedScore } = {}) {
    const { example = -1, saved } = options;
    stop();
    clearUpload();
    setScore(next);
    setSelected(example);
    setSavedId(saved?.score.id ?? null);
    setOrigin(saved?.origin ?? (example >= 0 ? '示例' : '导入'));
    setOriginalSource(saved?.source ?? examples[example]?.source);
    setDraft(null);
    setDeleting(false);
    setShift(0);
    setFrom(0);
    setTo(next.measures.length - 1);
    setError('');
    setNotice('');
    setReview(null);
  }

  function currentEntry(): ScoreEntry {
    return { score: display, origin, source: !shift && originalSource !== undefined ? originalSource : writeJianpu(display) };
  }

  async function saveEntry(entry: ScoreEntry, id = savedId ?? crypto.randomUUID()) {
    if (libraryBusy) return;
    setLibraryBusy(true);
    setError('');
    try {
      const next = await libraryRequest<SavedScore>('/api/scores?id=' + id, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...entry, score: { ...entry.score, id } }),
      });
      load(next.score, { saved: next });
      setNotice('已保存到服务器。');
      setLibrary(entries => [next, ...entries.filter(item => item.score.id !== id)]);
    } catch (problem) { setError((problem as Error).message || '服务器保存乐谱失败。'); }
    finally { setLibraryBusy(false); }
  }

  function startDraft(editCurrent: boolean) {
    if (draft && !editCurrent && !draft.original) return;
    clearUpload();
    stop();
    setError('');
    setNotice('');
    setDeleting(false);
    setReview(null);
    const original = editCurrent ? currentEntry() : undefined;
    setDraft({ title: original?.score.title ?? '', source: original?.source ?? '', original });
  }

  async function deleteScore() {
    if (libraryBusy) return;
    setLibraryBusy(true);
    setError('');
    try {
      if (savedId) {
        await libraryRequest('/api/scores?id=' + savedId, { method: 'DELETE' });
        setLibrary(entries => entries.filter(item => item.score.id !== savedId));
      }
      load(initialScore, { example: 0 });
      setNotice(savedId ? '已从服务器乐谱库中删除。' : '已移除当前乐谱。');
    } catch (problem) { setError((problem as Error).message || '服务器删除乐谱失败。'); }
    finally { setLibraryBusy(false); }
  }

  async function openFile(file?: File) {
    if (!file || libraryBusy) return;
    clearUpload();
    const request = new AbortController();
    importRequest.current = request;
    const image = /\.(png|jpe?g)$/i.test(file.name) || /^image\/(png|jpeg)$/.test(file.type);
    setUpload({ file, image });
    try {
      if (image) {
        stop();
        const result = await recognize(file, request.signal);
        if (!request.signal.aborted) {
          setReview({ result, image: file });
          setDraft(null);
          setDeleting(false);
          setUpload(null);
        }
        return;
      }
      const imported = await importScore(file);
      if (request.signal.aborted) return;
      load(imported.score);
      setNotice(imported.notice);
    } catch (problem) {
      if (!request.signal.aborted) setUpload({ file, image, error: (problem as Error).message || '导入失败，请重试。' });
    } finally {
      if (importRequest.current === request) importRequest.current = null;
    }
  }

  async function toggle() {
    if (playing) {
      playback.current?.abort();
      setPlaying(false);
      return;
    }
    const run = new AbortController();
    playback.current = run;
    setPlaying(true);
    setError('');
    try {
      await playScore(playbackScore, { speed: speed / 100, voice, click, countIn: countIn && !active, loop,
        start: loop ? from : 0, end: loop ? to : display.measures.length - 1, resume: active,
      }, setActive, stop, run.signal);
    } catch {
      if (!run.signal.aborted) {
        stop();
        setError('无法启动音频，请再次尝试。');
      }
    }
  }

  function changeShift(next: number) {
    try { transpose(score, next); }
    catch (problem) { setError((problem as Error).message); return; }
    stop();
    setError('');
    setShift(next);
  }

  function selectLoop(a: number, b: number) {
    setFrom(Math.min(a, b));
    setTo(Math.max(a, b));
  }

  async function downloadMp3() {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const { exportMp3 } = await import('../music/export-mp3');
      const blob = await exportMp3(playbackScore, speed / 100, voice);
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = filename(playbackScore.title) + '.mp3';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problem) { setError((problem as Error).message || '无法导出 MP3。'); }
    finally { setExporting(false); }
  }

  return <div className={'studio' + (printPreview ? ' print-preview' : '')}>
    <header className="masthead">
      <div className="brand"><span className="brand-mark" aria-hidden="true">♪</span><span>谱间</span></div>
      <span className="masthead-label">乐谱工作室</span>
      <Link href="/learn" className="learn-link">交互式乐理入门</Link>
    </header>
    <aside className="sidebar">
      <h2>导入乐谱</h2>
      <div className={'drop-zone ' + (dragging ? 'dragging' : '')}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); void openFile(event.dataTransfer.files[0]); }}>
        <button className="import-button" disabled={libraryBusy} onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true">↑</span> 上传或拖入文件
        </button>
        <small>MusicXML · MXL · MIDI · PNG · JPG</small>
        <input ref={fileInput} type="file" hidden accept=".musicxml,.xml,.mxl,.mid,.midi,.png,.jpg,.jpeg" onChange={event => {
          void openFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }} />
      </div>
      <button className="text-button" disabled={libraryBusy} aria-expanded={Boolean(draft && !draft.original)} onClick={() => startDraft(false)}>＋ 输入简谱</button>
      <section className="library" aria-label="我的乐谱">
        <h2>我的乐谱</h2>
        {libraryError && <div className="library-error"><p role="status">{libraryError}</p><button className="action" onClick={() => void refreshLibrary()}>重新加载</button></div>}
        {!libraryError && library.length === 0 && <p>保存后，乐谱会出现在这里。</p>}
        {library.map(entry => <button key={entry.score.id} disabled={libraryBusy} className={'track ' + (savedId === entry.score.id ? 'selected' : '')}
          onClick={() => load(entry.score, { saved: entry })}>
          <span className="track-icon" aria-hidden="true">♫</span>
          <span><strong>{entry.score.title}</strong><small>{entry.origin} · {entry.score.measures.length} 小节</small></span>
        </button>)}
      </section>
      <section className="examples-library" aria-label="示例曲库">
        <h2>示例曲库 · {examples.length} 首</h2>
        <input type="search" aria-label="搜索示例曲目" placeholder="搜索曲名或作曲家" value={exampleQuery} onChange={event => {
          setExampleQuery(event.target.value); setExampleLimit(12);
        }} />
        <select aria-label="示例曲目分类" value={exampleGroup} onChange={event => { setExampleGroup(event.target.value); setExampleLimit(12); }}>
          <option value="">全部分类</option>
          {exampleCategories.map(category => <option key={category}>{category}</option>)}
        </select>
        {(query || exampleGroup) && <p className="examples-empty" aria-live="polite">找到 {matchedExamples.length} 首</p>}
        <div className="examples-list">
          {matchedExamples.slice(0, exampleLimit).map(example => {
            const index = examples.indexOf(example);
            return <button key={example.slug} disabled={libraryBusy} className={'track ' + (selected === index ? 'selected' : '')}
              onClick={() => load(parseJianpu(example.source, example.title), { example: index })}>
              <span className="track-icon" aria-hidden="true">♫</span>
              <span><strong>{example.title}</strong><small>{example.subtitle}</small></span>
            </button>;
          })}
        </div>
        {!matchedExamples.length && <p className="examples-empty">没有找到匹配的曲目。</p>}
        {matchedExamples.length > exampleLimit && <button className="action examples-more" onClick={() => setExampleLimit(exampleLimit + 12)}>
          显示更多（{matchedExamples.length - exampleLimit}）
        </button>}
      </section>
    </aside>
    <main className="main">
      {printPreview && <div className="print-actions">
        <button className="action" onClick={() => setPrintPreview(false)}>返回工作室</button>
        <span>打印预览</span>
        <button className="action primary" onClick={() => { document.title = filename(score.title); window.print(); }}>打印或另存为 PDF</button>
      </div>}
      <div className="workspace-heading">
        <div><h1>{score.title}</h1><p>{example ? example.subtitle + ' · ' : ''}{score.measures.length} 小节 · {score.tempo} BPM</p>
          {example?.url && <a className="example-source" href={example.url} target="_blank" rel="noreferrer">{example.credit}</a>}
        </div>
        <div className="workspace-actions">
          {!draft && !review && <>
            <button className="action" disabled={libraryBusy} onClick={() => startDraft(true)}>编辑乐谱</button>
            {(!savedId || shift !== 0) && <button className="action primary" disabled={libraryBusy} onClick={() => void saveEntry(currentEntry())}>{libraryBusy ? '正在保存…' : '保存乐谱'}</button>}
            {selected < 0 && <button className="action danger" disabled={libraryBusy} aria-expanded={deleting} onClick={() => setDeleting(!deleting)}>{savedId ? '删除乐谱' : '移除乐谱'}</button>}
          </>}
          <button className="action" onClick={() => {
            stop();
            setPrintPreview(true);
            window.scrollTo(0, 0);
          }}>打印谱子</button>
          <button className="action" title="按当前速度、移调和音色导出整首" disabled={exporting} onClick={() => void downloadMp3()}>{exporting ? '正在导出…' : '导出 MP3'}</button>
          <div className="transpose"><span>移调</span><button aria-label="降低半音" onClick={() => changeShift(shift - 1)}>−</button>
            <output>{shift > 0 ? '+' : ''}{shift}</output><button aria-label="升高半音" onClick={() => changeShift(shift + 1)}>+</button></div>
        </div>
      </div>
      {deleting && <div className="action-banner">
        <span>{savedId ? '从我的乐谱中删除《' + score.title + '》？' : '移除当前未保存的乐谱？'}</span>
        <button className="action" disabled={libraryBusy} onClick={() => setDeleting(false)}>取消</button>
        <button className="action danger" disabled={libraryBusy} onClick={() => void deleteScore()}>{savedId ? '确认删除' : '确认移除'}</button>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {upload && <div className={'action-banner ' + (upload.error ? 'upload-error' : '')}>
        <div role={upload.error ? 'alert' : 'status'}>
          <strong>{upload.file.name}</strong>
          <p>{upload.error ?? (upload.image ? '正在识别图片…' : '正在导入乐谱…')}</p>
        </div>
        {upload.error && <button className="action" onClick={() => void openFile(upload.file)}>重试</button>}
        <button className="action" onClick={clearUpload}>{upload.error ? '关闭提示' : '取消导入'}</button>
      </div>}
      {review && <Review key={review.result.score.id} result={review.result} image={review.image}
        onApply={next => load(next)} onCancel={() => setReview(null)} />}
      {draft && <form className="editor score-editor" onSubmit={event => {
        event.preventDefault();
        if (!preview?.score || !draft.title.trim()) return;
        const entry = { score: preview.score, source: draft.source, origin: draft.original?.origin ?? '简谱' } as const;
        void saveEntry(entry, draft.original ? undefined : crypto.randomUUID());
      }}>
        <h2>{draft.original ? '编辑乐谱' : '新建简谱'}</h2>
        <label htmlFor="score-title">曲名</label>
        <input id="score-title" required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
        <label htmlFor="jianpu-text">简谱内容</label>
        <p>例如 1=C 4/4 BPM=100，换行后输入 1 2 3 4 | 5:h 0:h。0 表示休止，~ 表示连到下一个同音。</p>
        <textarea id="jianpu-text" rows={4} value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })} />
        {preview?.error && <p className="error" role="alert">{preview.error}</p>}
        {preview?.score && <div className="draft-preview" aria-label="简谱预览">
          <Jianpu score={{ ...preview.score, measures: preview.score.measures.slice(0, 4) }} active={null} />
        </div>}
        <div className="editor-actions">
          <button type="button" className="action" disabled={libraryBusy} onClick={() => setDraft(null)}>{draft.original ? '取消编辑' : '放弃草稿'}</button>
          <button className="action primary" disabled={libraryBusy || !preview?.score || !draft.title.trim()}>{libraryBusy ? '正在保存…' : draft.original && savedId ? '保存修改' : '保存简谱'}</button>
        </div>
      </form>}
      <div className="view-bar">
        <div className="views" aria-label="乐谱视图">
          {views.map(kind => <button key={kind} aria-pressed={view === kind} onClick={() => {
            if (isInstrument(view) || isInstrument(kind)) stop();
            if (kind === compareView) setCompareView(view);
            setView(kind);
          }}>{labels[kind]}</button>)}
        </div>
        <div className="compare-controls">
          {split && <select aria-label="对照视图" value={compareView} onChange={event => setCompareView(event.target.value as View)}>
            {views.filter(kind => kind !== view).map(kind => <option key={kind} value={kind}>{labels[kind]}</option>)}
          </select>}
          <button className="compare" aria-pressed={split} onClick={() => setSplit(!split)}>◫ 分屏对照</button>
        </div>
      </div>
      <div className={'papers ' + (split ? 'split' : '')}>
        {(split ? [view, compareView] : [view]).map(kind => <section key={kind} className="paper">
          <h2>{score.title}</h2>
          <p className="paper-meta">1={isInstrument(kind) ? arrangements[kind].score.keySignature : display.keySignature}　{display.timeSignature.numerator}/{display.timeSignature.denominator}　♩ = {score.tempo}</p>
          {kind === 'jianpu' && <Jianpu score={display} active={active} />}
          {kind === 'staff' && <Staff score={display} active={active} />}
          {isInstrument(kind) && <>
            <div className="arrangement-toolbar">
              <label>指法设置 <select aria-label={labels[kind] + '指法设置'} value={modes[kind]} onChange={event => {
                if (view === kind) stop();
                const mode = event.target.value as FingeringMode;
                setModes(previous => ({ ...previous, [kind]: mode }));
                try { localStorage.setItem('mymusic.' + kind + '.fingering', mode); } catch { /* Keep the session setting. */ }
              }}>
                <option value="direct">直接转换</option><option value="easy">简化指法</option>
              </select></label>
              <p>{modes[kind] === 'easy' ? '优先低品位和少换弦，保留旋律节奏' : '按当前音高逐音转换'}</p>
            </div>
            <p className="arrangement-note">
              {modes[kind] === 'easy' ? '简化指法 · ' : '直接转换 · '}
              {arrangements[kind].shift !== 0 && ('为方便按弦，已整体' + (arrangements[kind].shift > 0 ? '升高' : '降低') + ' ' + Math.abs(arrangements[kind].shift) + ' 个半音 · ')}
              换弦 {arrangements[kind].stringChanges} 次 · 换按弦手指 {arrangements[kind].fingerChanges} 次 · 高于 4 品 {arrangements[kind].highFrets} 音
              {arrangements[kind].unavailable > 0 && (' · × 标出 ' + arrangements[kind].unavailable + ' 个超出音域的音符')}
            </p>
            <Tablature score={arrangements[kind].score} instrument={kind} active={active} />
          </>}
        </section>)}
      </div>
    </main>
    <footer className="player">
      <div className="transport"><button className="play" aria-label={playing ? '暂停' : '播放'} onClick={toggle}>{playing ? 'Ⅱ' : '▶'}</button>
        <button onClick={stop} aria-label="停止">■</button><span className="player-bpm">{Math.round(speed * display.tempo / 100)} BPM</span></div>
      <label className="speed">速度 <input aria-label="播放速度" type="range" min="50" max="150" step="1" value={speed}
        onChange={event => { stop(); setSpeed(Number(event.target.value)); }} /><output>{speed}%</output></label>
      <div className="player-options">
        <button aria-pressed={click} onClick={() => { stop(); setClick(!click); }}>节拍器</button>
        <button aria-pressed={countIn} onClick={() => { stop(); setCountIn(!countIn); }}>预备拍</button>
        <button aria-pressed={loop} onClick={() => { stop(); setLoop(!loop); }}>A–B 循环</button>
        <select aria-label="音色" value={voice} onChange={event => { stop(); setVoice(event.target.value as Voice); }}>
          {Object.entries(voices).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {loop && <div className="loop-range">
        <div className="measure-strip" aria-label="拖动选择循环小节"
          onPointerDown={event => {
            const measure = (event.target as HTMLElement).closest<HTMLElement>('[data-measure]');
            if (!measure || event.button !== 0) return;
            const index = Number(measure.dataset.measure);
            stop();
            loopAnchor.current = index;
            selectLoop(index, index);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (loopAnchor.current === null) return;
            const measure = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-measure]');
            if (measure && event.currentTarget.contains(measure)) selectLoop(loopAnchor.current, Number(measure.dataset.measure));
          }}
          onLostPointerCapture={() => { loopAnchor.current = null; }}>
          {score.measures.map((bar, i) => <button key={bar.index} data-measure={i} aria-label={'循环第 ' + (i + 1) + ' 小节'}
            aria-pressed={i >= from && i <= to} onClick={event => {
              if (event.detail === 0) { stop(); selectLoop(event.shiftKey ? from : i, i); }
            }}>{i + 1}</button>)}
        </div>
        <label>起始小节 <select value={from} onChange={event => { stop(); const start = Number(event.target.value); setFrom(start); setTo(Math.max(start, to)); }}>
          {score.measures.map((bar, i) => <option key={bar.index} value={i}>{i + 1}</option>)}
        </select></label>
        <label>结束小节 <select value={to} onChange={event => { stop(); setTo(Number(event.target.value)); }}>
          {score.measures.map((bar, i) => i >= from && <option key={bar.index} value={i}>{i + 1}</option>)}
        </select></label>
      </div>}
    </footer>
  </div>;
}
