# 谱间 · 乐谱工作室

在浏览器里导入乐谱、对照谱面和分段练习。项目范围与数据结构见 [需求文档](requirement.md)。

## 发布到 GitHub Pages

建议仓库名为 **`score-studio`**。如果使用这个名字，发布后地址为 `https://<GitHub 用户名>.github.io/score-studio/`，乐理入门在 `/score-studio/learn/`。

1. 在 GitHub 创建空仓库 `score-studio`。使用 GitHub Free 时可创建公开仓库。
2. 提交本地改动，再把 `main` 推送到该仓库。把下方的 `YOUR_GITHUB_USERNAME` 换成实际用户名。
3. 打开仓库的 **Settings → Pages**，把 **Build and deployment → Source** 设为 **GitHub Actions**。然后到 **Actions → Deploy to GitHub Pages → Run workflow**，选择 `main` 运行首次部署。

```powershell
git add .
git commit -m "准备 GitHub Pages 部署"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/score-studio.git
git push -u origin main
```

之后每次推送 `main` 都会触发 [Pages 工作流](.github/workflows/pages.yml)。也可以到 **Actions → Deploy to GitHub Pages → Run workflow** 手动部署。部署完成后，从 **Settings → Pages** 打开实际站点地址。工作流会读取 Pages 的站点路径，仓库改名或使用根路径时会在下一次构建中使用新的路径。[GitHub Pages 发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

| 功能 | GitHub Pages 静态版 | 本地服务器版 |
| --- | --- | --- |
| 曲库、乐理实验、简谱录入、MusicXML/MXL/MIDI 导入、谱面转换、播放、打印、MP3 导出 | 支持 | 支持 |
| 我的乐谱 | 保存在当前浏览器，清除站点数据后会移除 | 保存在 Next.js 服务器，可在不同浏览器打开 |
| 图片识别 | 使用服务器版处理图片 | 启动 FastAPI 并配置识别服务后可用 |

可在本地检查静态产物。以下命令将生成 `out/`，其中包含首页、乐理页和音色资源。

```powershell
$env:PAGES_BASE_PATH = '/score-studio'
npm run build:pages
Remove-Item Env:PAGES_BASE_PATH
```

## 本地运行

需要 Node.js 22.11 或更高版本。以下命令在 PowerShell 中执行。

```powershell
npm ci --ignore-scripts
npm run dev
```

打开 http://127.0.0.1:3000。前端可独立运行，示例曲、简谱、结构化文件导入和合成播放无需后端。

```powershell
npm run check
npm run build
npm start
```

## 启用图片识别

在另一终端中运行以下命令。Python 需为 3.11 或更高版本。

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
$env:OMR_API_KEY = '填写识别服务密钥'
$env:OMR_MODEL = '填写支持图片输入和 JSON 输出的模型名称'
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

识别使用兼容 Chat Completions 的服务，默认地址为 `https://api.openai.com/v1`。使用其他服务时，在启动 FastAPI 前设置 `OMR_API_BASE`。Next.js 默认代理到 `http://127.0.0.1:8000`，也可通过 `OMR_BACKEND_URL` 指定 FastAPI 地址。密钥只在 FastAPI 进程中使用。识别时，后台会把上传的图片发送给配置的服务。

PNG 或 JPG 上传后，打开校对区域，逐个修改音高、时值或附点。点击「应用乐谱」后，改动会同步到四种谱面和播放器。置信度是识别模型的估计。

## 使用约定

- 手录简谱、导入乐谱和示例曲都可保存到「我的乐谱」，打开后可编辑曲名和简谱内容，也可删除。服务器版默认写入项目的 `.data/scores`，可通过 `SCORE_STORAGE_DIR` 指定持久化目录。同一服务器的访问者共用该乐谱库。
- 吉他与尤克里里 TAB 默认在每个音符上方对齐显示单音指法图。取消「显示指法图」可切换为紧凑 TAB。
- 每种乐器可分别选择「直接转换」或「简化指法」。直接转换按当前音高排指法。简化指法保留旋律和节奏，尝试适合该乐器的调，并优先低品位、少换弦和少换指。谱面标注实际移调及换弦次数，播放、打印和 MP3 使用选定的 TAB 版本。
- 点击「打印谱子」可预览排版，再选择「打印或另存为 PDF」。打印保留当前谱面与指法图设置。分屏模式下，两种谱面分别起页。
- 「导出 MP3」以曲名为文件名下载整首谱子，使用当前主视图的适配音高、播放速度和音色。导出限 20 分钟，循环、节拍器和预备拍仅用于练习。另存为 PDF 时，页面标题设为曲名，默认文件名由浏览器提供。
- 示例曲库包含 121 首可搜索的曲目。「公版流行与拉格泰姆」收录早期流行歌曲旋律和公版拉格泰姆练习谱，来源见曲名下方。民歌和童谣参考 [CC0 简谱图集](https://github.com/AuroraAeon/pd-jianpu-sheets)。古典作品取自 [Pianovera MIDI 曲库](https://pianovera.com/en/midi/)，转换为单声部练习选段。
- 从工作室顶部进入「交互式乐理入门」（`/learn`），可以试听音程和音阶、比较拍号、构建和弦、查指板同音位置，以及观察 MIDI 指令与音色切换。

- 简谱示例 `1=C 4/4 BPM=96` 换行后输入 `1 1 5 5 | 6 6 5:h`。空格分隔音符，`|` 分小节，`0` 表示休止，`-` 延续前一个音符。时值可用 `:w`、`:h`、`:q`、`:8`、`:16`，支持附点 `.`、升降记号 `#` / `b` 和八度标记 `'` / `,`。
- `ScoreDocument` 表示单声部乐谱。多声部 MusicXML 取第一声部，MIDI 取第一条非打击乐音轨，重叠音符会简化。速度、拍号和调号采用曲首设置。
- 指法优先选择空弦和前三品。超出乐器音域时尝试整曲八度移位，并在指法谱中显示结果。选中指法谱作为主视图时，播放其适配音高。
- 钢琴和民谣吉他的音色从 [MIDI.js Soundfonts](https://gleitz.github.io/midi-js-soundfonts/) 加载，加载期间用 Tone.js 合成播放。尤克里里使用 [FreePats CC0 录音](https://github.com/freepats/ukulele1)。
- 打开 A–B 循环后，可拖选小节编号，或通过起止小节菜单设置范围。
