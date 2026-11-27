import Link from 'next/link';
import type { Metadata } from 'next';
import { basePath, staticPages } from '../../music/deployment';
import { OctaveCounter, PitchRatioLab, ScaleTemplateSwitch } from './pitch';
import { KeySignatureMacro, RhythmGridLab } from './notation-rhythm';
import { ChordBuilderLab, FretboardMapper, MidiInspector } from './instruments';
import './theory.css';

export const metadata: Metadata = { title: '交互式乐理入门 · 谱间', description: '用声音、键盘和指板理解乐理' };
const topics = [
  ['pitch', '音高与音程'], ['octave', '八度与半音'], ['scales', '自然大小调'], ['keys', '调号与简谱'],
  ['rhythm', '节奏与拍号'], ['chords', '构建三和弦'], ['frets', '弦长与指板'], ['midi', 'MIDI 与音色'],
];
export default function LearnPage() {
  const HomeLink = staticPages ? 'a' : Link;
  const home = staticPages ? basePath + '/' : '/';
  return <div className="learn-page">
    <header className="masthead">
      <HomeLink href={home} className="brand"><span className="brand-mark" aria-hidden="true">♪</span>谱间</HomeLink>
      <HomeLink href={home} className="masthead-label">返回乐谱工作室</HomeLink>
    </header>
    <div className="learn-layout">
      <nav className="learn-nav" aria-label="乐理目录">
        <strong>课程目录</strong>
        {topics.map(([id, label], index) => <a key={id} href={'#' + id}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a>)}
      </nav>
      <main>
        <header className="learn-intro"><h1>交互式乐理入门</h1><p>拖动频率滑块，点按钢琴和指板。八个实验从一个音讲到一整段 MIDI 旋律。</p></header>
        <PitchRatioLab />
        <OctaveCounter />
        <ScaleTemplateSwitch />
        <KeySignatureMacro />
        <RhythmGridLab />
        <ChordBuilderLab />
        <FretboardMapper />
        <MidiInspector />
      </main>
    </div>
  </div>;
}
