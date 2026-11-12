# 三段可运行的机制动画

网站展示的三段新样片都有完整源码，各 18 秒、1920×1080、60 fps，中文字幕＋配乐＋原创提示音。它们用于展示不同知识点如何形成开场、推演、揭晓和转场；不是把任意论文自动替换成同一套内容的模板。

| 选择的 composition | 内容 | 主要源码 |
| --- | --- | --- |
| `PrismReveal` | 白光为什么能分成不同颜色 | [Prism.tsx](src/Prism.tsx) |
| `NoiseCancellation` | 反相声压如何减弱耳边噪声 | [Noise.tsx](src/Noise.tsx) |
| `DominoEnergy` | 多米诺的能量从哪里来 | [Domino.tsx](src/Domino.tsx) |

## 从下载到成片

下载整个仓库并解压，保留 `examples/` 与 `skills/` 的相对位置。需要 Node.js 24、可用的 Chromium 渲染环境和中文字体（Windows 的微软雅黑、macOS 的苹方或 Linux 的 Noto Sans CJK）。在 `examples/gallery` 文件夹中运行：

```sh
npm ci
npm run setup
npm run check
npm run preview
```

在预览中选择任一 composition。导出：

```sh
npm run render -- PrismReveal
npm run render -- NoiseCancellation
npm run render -- DominoEnergy
```

每次导出自动创建新的 `out/<时间>-<片名>-<随机标识>/`，保留之前的成片。首次渲染会从 Remotion 官方下载配套浏览器。Windows 显卡环境可在 PowerShell 设置 `$env:REMOTION_GL='angle'` 后渲染；这是可选配置，不应复制为所有平台的强制要求。

关键帧截图：

```sh
npm run still -- PrismReveal --frame=504
```

## 音乐与卡点

默认音乐取自仓库已有参考 BGM，从原音轨 8.8 秒裁入。已分析到的候选起音位于原音轨 17.194376 秒，即成片的 8.394376 秒；三段的主要可见揭晓和提示音落在 8.4 秒（第 504 帧），量化偏差约 5.6 毫秒。起音检测不能替代人工试听，也不代表每个鼓点或段落都天然适合每种内容。

`Score.tsx` 在揭晓附近短暂压低音乐，叠加 `setup.mjs` 原创合成的双音提示与低频击打，并按成片时长淡出。素材与配置由 setup 生成，不把用户本地路径写入源码。

替换音乐：

```sh
npm run setup -- --bgm "path/to/my-music.wav" --trim 0 --force
```

自定义音乐至少需要从裁入点起覆盖 18 秒。更换后须重新分析、试听并调整视觉和声音的时间；不要沿用默认音轨的卡点结论。默认 BGM 的来源和使用边界见 [NOTICE.md](../../NOTICE.md)，不因包含在工程中而自动取得商业发行授权。

## 修改时先保持因果关系

- 棱镜：先展示同束白光，再按波长展开。正常色散下紫光偏折大于红光；角距为便于观看作了夸张，不能据图读数。
- 主动降噪：环境噪声仍存在，耳边合成声压变小。画面标明理想单频示意；实际效果与频率、佩戴和系统延迟有关。
- 多米诺：竖起时已经储存重力势能。前一张触发后一张释放自身能量，并非把手指的能量凭空放大。

详细事实与分镜依据见 [Prism-notes.md](Prism-notes.md)、[Noise-notes.md](Noise-notes.md)、[Domino-notes.md](Domino-notes.md)。

## 网页版与验收

网站使用 1280×720、60 fps 的轻量副本，保留全部帧及同一条 AAC 音轨。可安装仓库 Python requirements 后执行：

```sh
python scripts/export_web.py out/<job>/PrismReveal.mp4 out/web-preview/prism-reveal.mp4
python ../../skills/vibe-science-video/scripts/inspect_media.py out/web-preview/prism-reveal.mp4 --output out/web-preview/qa-prism.json --fps 60 --width 1280 --height 720 --duration 18 --contact-sheet out/web-preview/qa-prism.jpg
```

导出检查只覆盖文件完整性、时间戳、音轨和抽帧等机械条件；发布前还应查看开场、揭晓前后、转场和落版，试听提示音，检查遮挡与知识表达。成片与源码的交付记录保存在仓库 [VALIDATION.md](../../VALIDATION.md)。
