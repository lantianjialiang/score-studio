PRD: 智能乐谱识别、转换与交互播放平台1. 系统核心架构与数据流所有功能围绕标准音乐中间层（Music IR）构建，解耦“识别输入”与“指法渲染”。输入层 (Input): 图片/截图 (OMR) $\rightarrow$ MusicXML / MIDI / 文本简谱核心数据层 (Core IR): 标准化 JSON 乐谱树（包含元数据、拍号、调号、小节序列、音符事件 [音高MIDI, 时值, 起始时间, 歌词/和弦]）处理层 (Processors): 移调引擎、吉他/尤克里里指法映射算法（Fretboard Solver）输出层 (Output): 五线谱渲染、数字简谱渲染、六线/四线指法谱（TAB）渲染、Web Audio 实时合成播放2. 技术栈选型建议（供 AI 生成代码遵循）前端框架: Next.js (App Router) + TypeScript + Tailwind CSS乐谱渲染: OpenSheetMusicDisplay (OSMD，用于五线谱/MusicXML渲染) + alphaTab (专精于吉他/尤克里里六线谱/四线谱渲染与同步播放) 或自定义 SVG 渲染器（用于数字简谱）音频引擎: Tone.js + soundfont-player (加载真实钢琴、原声吉他、尤克里里采样音色)后端/AI 识别: Python (FastAPI) 承载 OMR 视觉识别模型（如 oemer 或基于多模态大模型 VLM 的结构化提取）3. 功能模块拆解 (Feature Breakdown)模块 A：多模态乐谱导入与识别 (Input & OMR)A1. 结构化文件导入支持拖拽上传 .musicxml, .mxl, .mid, .midi 文件。前端直接解析并转换为 Core IR。A2. 文本简谱快速录入提供类 Markdown 的简谱输入语法（例如：1 2 3 4 | 5 - - -），实时解析为 Core IR。A3. 截图/图片识别 (OMR)支持上传 PNG/JPG 乐谱截图（五线谱或印刷体简谱）。调用后端识别接口，返回置信度与可编辑的中间数据。关键要求: 必须提供“人工校对视图”，允许用户在识别有误时点击修改音高或时值。模块 B：乐谱转换与智能指法引擎 (Transposition & Tablature Engine)B1. 移调与制式互转支持一键升降调（半音阶调节），自动处理五线谱与简谱的双向同步映射。B2. 吉他/尤克里里简易指法生成 (核心算法)输入: Core IR 中的音符序列 + 乐器配置（吉他 6 弦标准调弦 E2-A2-D3-G3-B3-E4；尤克里里 4 弦标准调弦 G4-C4-E4-A4）。算法约束 (简易模式):低把位优先: 优先映射在 0 ~ 3 品（空弦及前三品），降低初学者按弦难度。自动移调适配: 若原曲音域超出乐器最低音（如低音超出尤克里里 C4），自动提示并执行八度提升（Octave Shift）或自动移至 C 大调/G 大调等简易调性。手指分配提示: 根据品格位置自动标注推荐按弦手指（1=食指, 2=中指, 3=无名指, 4=小指，0=空弦不按）。指法图生成: 同步在谱面上方生成直观的网格按弦图（Chord/Note Diagram），用圆点标出弦位、品格与手指编号。模块 C：多视图渲染引擎 (Rendering Engine)支持在同一个界面无缝切换或分屏对比以下四种视图：五线谱视图 (Standard Notation)数字简谱视图 (Jianpu): 需完整支持高低音点、增减时线、附点、小节线及调号标记（如 1=C）。吉他六线谱 (Guitar TAB) + 直观指法网格尤克里里四线谱 (Ukulele TAB) + 直观指法网格模块 D：交互式乐谱播放器 (Interactive Player)D1. 音画同步: 播放时，乐谱界面需具备平滑滚动与当前音符高亮光标（Cursor）。D2. 练习辅助控制:速度调节（BPM 50% ~ 150% 变速不变调）。节拍器开关（Metronome）与预备拍（Count-in）。区间循环（A-B Loop）：框选特定小节反复练习。音色切换：钢琴 / 民谣吉他 / 尤克里里。4. 核心数据结构规范 (Core IR Schema)AI 编写代码时，所有模块间的数据传递必须严格遵守以下 TypeScript 接口：TypeScriptexport interface ScoreDocument {
  id: string;
  title: string;
  tempo: number; // BPM, e.g., 120
  timeSignature: { numerator: number; denominator: number }; // e.g., 4/4
  keySignature: string; // e.g., "C", "G", "Am"
  measures: Measure[];
}

export interface Measure {
  index: number;
  notes: NoteEvent[];
}

export interface NoteEvent {
  id: string;
  midi: number | null; // MIDI 音高编号 (60 = C4), null 代表休止符
  duration: 'w' | 'h' | 'q' | '8' | '16'; // 全音符、二分、四分、八分、十六分
  dots: number; // 附点数量 (0, 1, 2)
  isTieStart?: boolean;
  // 转换后生成的指法信息
  fingering?: {
    instrument: 'guitar' | 'ukulele';
    string: number; // 弦号 (吉他 1-6, 尤克里里 1-4，1为最细弦)
    fret: number;   // 品格 (0 为空弦)
    finger: 0 | 1 | 2 | 3 | 4; // 0=空弦, 1=食指, 2=中指, 3=无名指, 4=小指
  };
}
5. 分阶段开发执行计划 (AI Execution Milestones)请严格按照以下顺序逐步生成代码与验证，不要一次性输出所有文件：Phase 1: 骨架搭建与核心播放 (MVP)初始化 Next.js + TypeScript 项目。实现 ScoreDocument 数据结构及内置 2 首测试曲目（如《小星星》）。集成 Tone.js 实现基础播放、暂停、BPM 调节与音频合成。Phase 2: 简谱与五线谱渲染 + 文件导入实现自定义 SVG 数字简谱渲染器（核心难点：高低音点与时值下划线对齐）。集成 OSMD 渲染五线谱，实现 .musicxml 和 .mid 文件解析器。Phase 3: 吉他/尤克里里指法转换引擎编写 FretboardSolver 算法：输入 midi 序列，输出低把位（0-3品）最优指法与按弦手指编号。开发带手指编号的直观品格指法图组件（Fretboard Diagram）及 TAB 谱渲染。Phase 4: 截图识别 (OMR) 接入搭建后端文件上传接口，接入视觉识别服务（或封装多模态 LLM API 提取乐谱结构），实现前端“识别 -> 人工微调 -> 渲染”闭环。