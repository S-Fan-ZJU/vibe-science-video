# 可移植工具：节奏、时间轴和导出检查

这些工具在本地读写文件，不会上传音频、读取账号或调用付费服务。它们把可机械验证的部分变成报告；**不会替你判断动画是否吸引人、科学解释是否成立，或观众是否真的读得完。**

## 1. 安装与运行位置

下面命令假设当前目录是已下载的 `skills/vibe-science-video`，或项目中的 `.agents/skills/vibe-science-video`。输入可以是相对路径或绝对路径；包含空格的路径要加引号。输出位置由你指定，通常放在视频项目的 `output/qa/`。

使用 Python 3.11 或更新版本。已实测环境是 Windows、Python 3.11.2，以及 `requirements.txt` 中锁定的四个库：PyAV、NumPy、SciPy、Pillow。没有依赖系统 FFmpeg 可执行文件，也没有使用 librosa。

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

macOS / Linux 将 `.venv/Scripts/python.exe` 换成 `.venv/bin/python`。下面简写为 `python`；如果没有激活虚拟环境，请用实际的虚拟环境 Python 路径替换。确认 `python --version` 指向预期环境。

若目标 Python 或系统没有对应版本的二进制包，换用有支持的 Python 版本，或建立新的兼容依赖锁并重跑测试；不要无声地修改版本后继续声称“已验证”。

每个工具都有 `--help`。默认拒绝覆盖已有输出；使用新版本文件名，或明确加 `--force`。任何工具都不应该把输出指向输入文件。失败退出码为 `2`；成功为 `0`。

## 2. 分析 BGM：先找候选，再试听确认

支持本地 WAV、MP3、M4A 以及含音轨的视频，实际支持格式以 PyAV 的解码能力为准。仅分析第一条音轨。提供原音乐或已经剪辑、循环、交叉淡化后的最终音乐都可以，但**动作设计必须绑定最终音乐版本**。

```powershell
python scripts/analyze_bgm.py "my-project/assets/audio/bgm-final.m4a" --output "my-project/output/qa/bgm-analysis-v1.json"
```

报告包含：

| 字段 | 解释和用途 |
|---|---|
| `source.sha256` | 音频内容指纹。更换、剪辑或重新编码后，原事件表需复核 |
| `decoded_duration_seconds` | 完整解码的采样时长 |
| `tempo_candidates` | 周期性估计的 BPM 候选；分数是相对得分，不是置信概率 |
| `local_tempo_candidates` | 局部时间窗的候选，用来发现整体 BPM 无法解释的变化 |
| `onset_candidates` | 瞬态时间、强度和突出程度；可能来自鼓、琴、效果音或其他声音 |
| `energy_windows` | 每 0.25 秒的 RMS 能量，辅助判断安静和推进区域 |
| `energy_change_candidates` | 能量改变的位置建议，不是自动识别的主歌、副歌或小节 |
| `analysis_hop_seconds` / `analysis_window_seconds` | 分析时间步长和窗口，帮助理解时刻估计误差 |

默认以 22,050 Hz 单声道、2,048 点窗口、256 点步长估计。窗口会平滑瞬态；它给出的点不能直接当成毫秒级真值。单声道峰值也不能用于最终混音限幅，因为双声道相位、采样峰值和真峰值是不同问题。

**使用方式：** 先从能量曲线找可讲清机制的段落，再挑少数候选，试听每个点前后约 1 秒，结合波形确认到底是声音起音、能量峰还是余响。把选定的声音时刻量化为输出帧，再让接触、断裂、揭晓等可见结果落在该帧。不要把每个检测出的瞬态都变成闪光。

长音乐默认最多解码 1,800 秒，避免误读大型媒体文件；需要更长时可显式设置 `--max-seconds`。节拍范围可用 `--min-bpm` 和 `--max-bpm` 调整。

### 默认 BGM 与自定义音乐

- 原项目参考曲在 `assets/music/reference-bgm.m4a`，其来源、使用说明和案例节奏资料由音乐目录及项目 README 记录。
- 对这份原始参考文件，工具实测时长约 **181.952 秒**，最高周期候选约 **111.657 BPM**，还有约 **55.791 BPM** 的半拍候选。这些值只描述本文件，不是 Vibe 视频统一节奏。
- starter 的演示会截取一段音乐；默认使用原曲约 **5.533333 秒**起点。原曲与演示时间轴不能直接共用绝对秒数。
- starter 的默认可见激活帧为 **432 / 60 = 7.2 秒**，预备动作从第 **408** 帧开始；该点配有原创建模提示音。BGM 目标、提示音和画面三者仍要在最终导出中一起复核。
- 自定义方式：在复制出来的 starter 内执行 `npm run setup -- --bgm "自己的音乐.m4a" --trim 0`；参数以 starter README / `--help` 为准。如果已有生成的音频，选择新项目或明确用 `--force` 重新生成。
- 更换后必须重新分析最终 BGM，重新挑选事件，调整动作提前量和字幕段落。只替换文件、保留旧卡点，不算完成自定义音乐适配。

## 3. 时间轴检查：对准结果帧，检查阅读负担

`templates/timeline.json` 是独立结构示例，不是对参考 BGM 的卡点承诺。它与 starter 的具体动作时刻可以不同。

```powershell
python scripts/check_timeline.py "my-project/timeline.json" --output "my-project/output/qa/timeline-v1.json"
```

可选地绑定音乐指纹：

```powershell
python scripts/check_timeline.py "my-project/timeline.json" --music-analysis "my-project/output/qa/bgm-analysis-v1.json" --output "my-project/output/qa/timeline-bound-v1.json"
```

文件结构：

```json
{
  "schema_version": 1,
  "fps": 60,
  "duration_frames": 720,
  "music": {"sha256": "这里填写最终音乐分析报告中的64位SHA256"},
  "captions": [
    {"id": "c1", "start_frame": 0, "end_frame": 180, "text": "两个条件，缺一不可。"}
  ],
  "events": [
    {"id": "unlock", "animation_start_frame": 408, "visible_peak_frame": 432,
     "audio_peak_frame": 432, "tolerance_frames": 2}
  ]
}
```

上面的指纹文字是说明，正式文件请填写真实值或删去可选的 `music`。示意时间也要换成你的最终动画数据。

规则：

- 所有事件帧与字幕起止帧都是整数。时间段采用 `[start_frame, end_frame)`，最后一帧为 `duration_frames - 1`。
- `captions` 代表一条主字幕轨；场景标签、同时存在的物体注释放在场景数据中。主字幕重叠会失败。
- `animation_start_frame` 是准备动作开始；`visible_peak_frame` 是观众真正看见接触、打开或揭晓的帧；`audio_peak_frame` 是试听确认的声音强调帧。
- `visible_peak_frame - audio_peak_frame` 为正，表示画面晚于声音。超出事件自己的 `tolerance_frames` 会失败。默认容差 2 帧不是所有效果的审美规范，可按动作和创作意图指定。
- 字幕速度按 Unicode 字母与数字计数，排除空白和标点。默认每秒 6 字的警告线面向简短中文字幕，不能直接用于英文或高术语密度字幕。
- 停留超过 6 秒、少于 0.8 秒或文字阅读速度偏快，只给 `WARN`，不是自动删字或压缩时长。结合画面是否继续解释、文字进入动画是否遮挡和手机尺寸阅读做判断。
- `FAIL` 包括越界、重叠、无效结构、动作先后错误、超容差事件，以及与输入分析报告不一致的音乐指纹。
- 默认 `WARN` 的退出码仍为 0；只有确实需要在自动流程中拦截所有警告时才加 `--warnings-as-errors`。

可调诊断阈值：`--max-cps 6 --max-dwell 6 --min-dwell 0.8`。这些检查读取的是作者填写的时间轴，不会查看导出画面的真实结果帧；时间轴写对了、动画实现错了，仍可能通过。

## 4. 导出检查：完整解码，再看抽帧

```powershell
python scripts/inspect_media.py "my-project/output/film-v1.mp4" --output "my-project/output/qa/media-v1.json" --fps 60 --width 1920 --height 1080 --duration 12 --contact-sheet "my-project/output/qa/contact-v1.jpg"
```

请用真实预期值替换示例的 12 秒和 1080p。检查 4K 母版时用 `--width 3840 --height 2160`。`--duration` 配合 `--fps` 会同时检查精确帧数，因此应传入 `duration_frames / fps`，不要只写四舍五入后的分秒。

工具会完整解码第一条视频和第一条音轨，核对：

- 视频编码信息、尺寸、平均帧率、实际解码帧数与时长。
- 帧时间戳是否存在、递增、符合预期固定帧间隔。
- 音轨是否存在、能否解码、时间戳是否递增、是否几乎静音。
- 解码后的采样峰值与达到满幅的样本数。
- 音视频起止范围是否明显不同，允许普通 AAC 编码延迟和尾部填充。
- 文件 SHA-256，帮助确认检查的是最终交付文件。

默认要求有音轨。静音的画面测试或展示片可显式加 `--allow-no-audio`；不要对正式有音乐成片使用这个参数来隐藏漏音轨问题。

抽帧拼图默认 12 张，可用 `--contact-count 8` 调整，范围 1–48。拼图在全片均匀取样，仅用于快速扫查；关键事件前后、转场边界、遮挡穿模最严重时刻仍要另行取帧或逐段播放。

**报告范围必须如实转述：** “完整解码通过，检查了 12 张抽帧”不等于“完整主观观看确认无问题”。视频里物体穿模、中文缺字、科学表述错误、提示音被 BGM 掩盖，都可能通过这个工具。这里的采样峰值也不是过采样真峰值或综合响度；需要后者时使用相应音频测量工具。

## 5. 本工具集的回归验证

从仓库根目录运行：

```powershell
python -m unittest discover -s tests -v
```

测试在 `.validation/` 下生成合成音频与两秒视频，结束后清理临时夹。它们验证节拍候选是否能找回已知周期、静音不会凭空生出节拍、字幕嵌套重叠和卡点偏移是否被检出、更换音乐指纹是否被拒绝、缺音轨是否显式失败、完整解码是否发现尺寸/帧率不符，以及已有报告不会被覆盖。测试不需要原始私人项目，也不访问网络。

若只下载了单个 skill 文件夹，仓库级测试不在安装目标中；可从公开仓库下载完整源码运行。用户的项目初始化和安装入口由仓库 README 说明；不要把这些质量检查工具误当成自动创作整部影片的程序。
