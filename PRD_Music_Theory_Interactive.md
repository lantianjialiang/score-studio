PRD: 交互式乐理基础与声学可视化模块 (Module E - 完整版)1. 模块定位与架构规范产品定位： 面向零基础与理工科思维用户的“去玄学化”乐理互动科普中心（路由 /learn），同时作为主站“乐谱转换与指法生成引擎”的前置原理说明书。核心理念： 剥离历史命名包袱，用物理频率（Hz）、数学比例、对数映射、二进制切分与数字信号指令解释乐理，所有概念均配备实时发声、动态波形/键盘/指板联动与可拖拽参数交互。技术栈约束： Next.js (App Router) + TypeScript + Tailwind CSS + Tone.js（音频合成）+ HTML5 Canvas / SVG（声学波形、五度圈与弦乐指板绘制）。音频安全与听感约束（全局强制）： 人类对中高频纯正弦波极为敏感，所有调用 Tone.Oscillator 的纯音实验组件必须内置频率依赖增益衰减（Frequency-dependent Gain Scaling），440 Hz 以上自动按对数衰减输出增益，并通过 Tone.Limiter(-6) 限制主总线峰值，防止刺耳啸叫。2. 信息架构与 8 个交互单元规范模块按照 “纵向音高物理 $\rightarrow$ 横向时间节奏 $\rightarrow$ 多音和声结构 $\rightarrow$ 乐器物理映射 $\rightarrow$ 数字化协议” 的逻辑编排：单元 1：音高与音程 —— 频率的标量与比值通俗解释（文案要点）：音高 (Pitch) = 声波每秒振动的次数（Hz），数值越大声音越尖。音程 (Interval) = 两个声音频率的比值（除法），而非减法。比例越简单（如 $2:1$, $3:2$），波形重合越整齐，听起来越“协和”。交互组件 (PitchRatioLab.tsx)：双滑块频率发生器： 基频 $f_1$（默认 220 Hz）与对比频 $f_2$，提供整数比快捷吸附按钮（1:1 同度、2:1 八度、3:2 纯五度、4:3 纯四度、5:4 大三度、45:32 三全音）。实时双波形叠加 Canvas： 同步绘制两列正弦波及它们的时域叠加合成波。整数比时波峰周期对齐（视觉稳定）；复杂比例时波形剧烈抖动（直观呈现不协和）。双音试听： 点击播放输出双正弦波（带高频增益衰减保护）。单元 2：为什么叫“八度”？—— 包含首尾的台阶计数法通俗解释（文案要点）：物理上频率翻倍（$\times 2$），但古人记谱采用“包含首尾（1-based）”数台阶，从第 1 个白键数到下一个同名白键刚好占据 8 个位置（Octave）。十二平均律： 为了让所有调自由切换，人们把 $2:1$ 的八度在指数上均切成 12 个半音，相邻两键频率固定乘以 $2^{1/12} \approx 1.0595$。交互组件 (OctaveCounter.tsx)：双标尺交互钢琴键盘（1 个八度，12 键）：键盘上方标尺（物理/程序员视角）：显示频率值（261.6 Hz $\rightarrow$ 523.2 Hz）与 0-based 半音索引（0 ~ 12）。键盘下方标尺（传统乐理视角）：白键依次高亮 1度, 2度, 3度... 8度 跳跃动画。区间对比卡： 点击任意两键连线并显示对比：“程序员视角：+7 个半音（频率 $\times 1.498$）” vs “乐理视角：纯五度”。单元 3：大调、小调与“自然” —— 步长数组模板通俗解释（文案要点）：音阶 = 从 12 个键里挑 7 个键的“步长规律”（全音 W = 2 步，半音 H = 1 步）。自然 (Natural) = 默认原生态配置，不加额外临时修改（钢琴纯白键）。大调 vs 小调 = 两套不同的步长模板。第 3 音距离起点 4 半音（宽跨度、明亮）为大调；3 半音（窄跨度、忧郁）为小调。交互组件 (ScaleTemplateSwitch.tsx)：步长模板切换器： 一键切换 [自然大调: 2-2-1-2-2-2-1] 与 [自然小调: 2-1-2-2-1-2-2]。动态步进动画： 点击“演示音阶”，光标在虚拟钢琴键上逐个跳动播音，跨 2 键绘制绿色圆弧（全音 W），紧邻键绘制橙色短弧（半音 H）。同源对比开关： 勾选“对比 C 大调与 A 小调”，高亮展示两者占用的钢琴键集合完全重合，仅红色“主音锚点”不同。单元 4：调号与简谱映射 —— 五线谱的“全局宏定义”通俗解释（文案要点）：五线谱只有 7 条轨道（对应 7 个白键）。换起点（移调）导致必须频繁弹黑键时，在谱头画 # 或 b，等价于代码顶部的全局替换声明（Macro）。简谱的降维打击： 简谱采用首调唱名法，只需在左上角写 1 = G 声明基准零点，直接省去所有调号，用 4 个基础视觉符号即可表达音高与时值：简谱视觉元素底层数学与逻辑含义示例数字 1 ~ 7相对当前调主音的音阶索引（0-based 偏移查表）1 = 主音（Do）上方 / 下方圆点频率翻倍或减半（MIDI 编号 ±12 个半音）$\dot{1}$ = 高八度，$1$ 下面加点 = 低八度底部横线（减时线）时值二进制折半（每加一条线时长 $\div 2$）$\underline{5}$ = 八分音符，$\underline{\underline{5}}$ = 十六分音符右侧横线（增时线）时值线性延长（每加一条短横线增加 1 拍）5 - - - = 全音符（共 4 拍）交互组件 (KeySignatureMacro.tsx)：可旋转五度圈转盘（Circle of Fifths）： 点击外圈调名（C, G, D, F, Bb...）。三屏实时联动： 左侧动态增减五线谱谱头 #/b 符号；中间显示等效代码宏（const OFFSET = +7; // F -> F#）；右侧保持简谱数字不变，仅左上角标签跳变为 1 = G。单元 5：节奏、时值与拍号 —— 时间的二进制切分与周期重音通俗解释（文案要点）：BPM（速度）： 每分钟节拍数，决定 1 拍的物理绝对时长（$T = 60 / \text{BPM}$ 秒）。音符时值： 严格遵循二进制树状分裂（全音符 = 1，二分 = 1/2，四分 = 1/4，八分 = 1/8），附点 = 原时值 $\times 1.5$。拍号（如 4/4 vs 3/4）： 时间轴上的周期性模算术与重音分组（4/4 为“强-弱-次强-弱”方正进行感，3/4 为“强-弱-弱”圆舞曲旋转感）。交互组件 (RhythmGridLab.tsx)：时间块二进制分裂器： 一根固定长度的时间条，点击分裂按钮可逐级切分为 1 个全音符 $\rightarrow$ 2 个二分 $\rightarrow$ 4 个四分 $\rightarrow$ 8 个八分，点击任意色块单独试听时长占比。节拍重音步进器： 切换 4/4、3/4、6/8 拍号与 BPM 滑块，触发鼓组合成音（底鼓=强拍，击边=弱拍）配合方块脉冲动画。单元 6：和弦的构建逻辑 —— 泛音列的立体打包通俗解释（文案要点）：和弦 (Chord) = 3 个或以上不同频率的声波同时叠加发声。三和弦构建算法（隔一取一）： 在自然音阶数组里每隔一个音取一个，即取索引 [0, 2, 4]（第 1 音根音 + 第 3 音三音 + 第 5 音五音）。大三和弦 vs 小三和弦： 根音到三音跨 4 半音 + 三音到五音跨 3 半音 = 明亮大三和弦（如 C）；跨度反过来（3 + 4）= 忧郁小三和弦（如 Am）。交互组件 (ChordBuilderLab.tsx)：音阶跳格器： 在虚拟钢琴上点选任意根音，动画自动跳过相邻键高亮第 1、3、5 级音符，并展示半音跨度标记（+4 / +3）。弦乐指法实时生成： 右侧同步渲染该和弦对应的吉他 6 弦按弦图与尤克里里 4 弦按弦图，提供“柱式同时发声”与“琶音依次扫弦”两个试听按钮。单元 7：琴弦物理与同音异位 —— 为什么同一个音有多种按法？通俗解释（文案要点）：弦长与频率： 琴弦越短、越细、张力越大，振动频率越高。吉他/尤克里里每往琴身移动 1 个品格（Fret），有效弦长缩短为原来的 $2^{-1/12}$，音高精确升高 1 个半音（MIDI +1）。同音异位（Unison）： 钢琴上一个频率只有唯一按键，但弦乐器上同一个频率（MIDI 编号）会出现在多根弦的不同品格上（例如吉他 2 弦 5 品与 1 弦空弦均为 E4 = MIDI 64）。主站的指法转换引擎正是通过算法在多个同音位置中寻找“0~3品低把位、跨度最小”的最优解。交互组件 (FretboardMapper.tsx)：钢琴-吉他-尤克里里三端同步指板： 点击钢琴上任意一个琴键，下方虚拟吉他指板（6弦12品）与尤克里里指板（4弦12品）同时亮起所有能发出该频率的品格圆点。最优指法高亮： 距离琴头最近的低把位圆点（0~3 品）以金色光环标记为“推荐初学者位置”，点击任意品格圆点可试听对应弦的拨弦音色。单元 8：MIDI —— 乐器的数字控制指令集通俗解释（文案要点）：MIDI 不是录音音频（MP3），而是“带时间戳的动作指令本”（记录何时按下哪个键、力度多大、何时松开）。音高被编码为 0 ~ 127 的整数（60 = 中央 C），因此文件极小，且播放时可以随时替换不同乐器的采样音色——这正是本网站实现“一份乐谱无缝切换钢琴、吉他、尤克里里播放”的核心中间层原理。交互组件 (MidiInspector.tsx)：迷你钢琴卷帘窗（Piano Roll）+ 实时指令流监视器： 展示一段 4 小节经典旋律（如《欢乐颂》）的矩形色块时间轴，播放时右侧终端风格面板实时滚动输出指令流：
[00:01.20] NOTE_ON  | Pitch: 64 (E4 / 329.6Hz) | Velocity: 95音色热替换器： 提供“钢琴 / 原声吉他 / 尤克里里 / 8-bit 合成器”切换按钮，点击后同一组 MIDI 数据瞬间切换音色播放。3. 目录结构与核心数学内核规范Plaintextsrc/
├── app/learn/
│   └── page.tsx                    # 交互式乐理学习主页面（左侧目录锚点 + 8个交互卡片流）
├── components/theory-lab/
│   ├── PitchRatioLab.tsx           # 单元1：双正弦波叠加 Canvas + 频率比发生器
│   ├── OctaveCounter.tsx           # 单元2：双标尺交互钢琴键盘（Hz/索引 vs 度数）
│   ├── ScaleTemplateSwitch.tsx     # 单元3：全半音步长弧线动画 + 大小调对比
│   ├── KeySignatureMacro.tsx       # 单元4：五度圈转盘 + 五线谱/代码/简谱符号联动
│   ├── RhythmGridLab.tsx           # 单元5：时间块二进制分裂器 + 拍号重音鼓点
│   ├── ChordBuilderLab.tsx         # 单元6：音阶跳格器 + 吉他/尤克里里和弦指法图
│   ├── FretboardMapper.tsx         # 单元7：钢琴-吉他-尤克里里同音异位三联动指板
│   └── MidiInspector.tsx           # 单元8：钢琴卷帘窗 + 实时 MIDI 指令日志 + 音色热替换
└── lib/
    ├── audio-engine.ts             # Tone.js 单例封装（含高频等响度衰减与 Limiter 保护）
    └── music-math.ts               # 纯函数音乐数学库
核心数学与物理映射库 (src/lib/music-math.ts)TypeScript// 1. MIDI 编号转物理频率 (Hz)
export const midiToFreq = (midi: number): number => {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

// 2. 高频等响度安全增益计算（防止 440Hz 以上正弦波刺耳）
export const getSafeGainForFreq = (freq: number, baseGain = 0.35): number => {
  if (freq <= 440) return baseGain;
  // 每升高一个八度衰减约 45% 振幅
  const octavesAbove = Math.log2(freq / 440);
  return Math.max(0.05, baseGain * Math.pow(0.55, octavesAbove));
};

// 3. 音阶步长模板常量
export const SCALE_PATTERNS = {
  MAJOR: [2, 2, 1, 2, 2, 2, 1], // 自然大调
  MINOR: [2, 1, 2, 2, 1, 2, 2], // 自然小调
} as const;

// 4. 标准空弦 MIDI 编号定义（1弦到最粗弦）
export const INSTRUMENT_TUNINGS = {
  guitar: [64, 59, 55, 50, 45, 40],  // E4, B3, G3, D3, A2, E2
  ukulele: [69, 64, 60, 67],         // A4, E4, C4, G4
} as const;

// 5. 查找某 MIDI 音高在指板上的所有同音异位 (stringIndex: 0-based, fret: 0~12)
export const findFretPositions = (
  targetMidi: number,
  tuning: readonly number[],
  maxFret = 12
): Array<{ stringNum: number; fret: number; isBeginnerFriendly: boolean }> => {
  const positions: Array<{ stringNum: number; fret: number; isBeginnerFriendly: boolean }> = [];
  tuning.forEach((openMidi, idx) => {
    const fret = targetMidi - openMidi;
    if (fret >= 0 && fret <= maxFret) {
      positions.push({
        stringNum: idx + 1,
        fret,
        isBeginnerFriendly: fret <= 3, // 0-3品优先推荐
      });
    }
  });
  return positions;
};
4. 分步执行指令 (AI Execution Steps)请按以下顺序逐步生成与验证代码，避免单次输出过长导致截断：Step 1（内核与音频安全层）： 创建 src/lib/music-math.ts 与 src/lib/audio-engine.ts（实现 Tone.start() 首次交互解锁、频率增益衰减与多乐器合成器切换）。Step 2（声学与音阶组件 1~3）： 实现 PitchRatioLab.tsx、OctaveCounter.tsx 与 ScaleTemplateSwitch.tsx（抽离通用的 InteractivePiano.tsx 子组件供后续复用）。Step 3（记谱与节奏组件 4~5）： 实现 KeySignatureMacro.tsx（含简谱符号对照表与五度圈 SVG）与 RhythmGridLab.tsx（二进制时值分裂与 Tone.Loop 节拍器）。Step 4（和声、指板与 MIDI 组件 6~8）： 实现 ChordBuilderLab.tsx、FretboardMapper.tsx 与 MidiInspector.tsx，最后在 src/app/learn/page.tsx 完成整体组装，并在主站乐谱转换器导航栏添加“交互式乐理入门”入口。