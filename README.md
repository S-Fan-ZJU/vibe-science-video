# Vibe Science Video

**把一个科学问题，做成值得看完的动画。**

面向 Codex 等编程代理的中文制作 skill。把论文阅读、抓人的开场、机制动画、音乐卡点、3D 动效、成片检查和发布封面连成一套可执行流程。

[看作品展示](https://s-fan-zju.github.io/vibe-science-video/) · [下载完整包](https://github.com/S-Fan-ZJU/vibe-science-video/archive/refs/heads/main.zip) · [阅读 Skill](skills/vibe-science-video/SKILL.md) · [快速开始](#快速开始)

[![查看案例展示](docs/media/poster.jpg)](https://s-fan-zju.github.io/vibe-science-video/)

新增三段独立机制动画：**棱镜分光、主动降噪、多米诺势能**。每段 18 秒，提供完整 1080p60 源工程，网站可直接播放轻量版。[观看新样片](https://s-fan-zju.github.io/vibe-science-video/#gallery) · [运行和修改工程](examples/gallery/README.md)

源于《把细菌，变成药》的实际制作、反馈和修订。原片已由作者发布到 B 站与抖音；这里展示的是该项目片段，不是只改一次标题就能生成的通用模板。作者反馈收到同学好评；本仓库没有使用未经验证的播放量或留存率来宣传效果。

## 下载后能得到什么

| 内容 | 解决的问题 |
|---|---|
| **完整制作 skill** | 先讲清什么、怎么吸引人、每一幕怎样解释，而不只要求“高级一点” |
| **六份制作手册** | 科学证据、故事结构、立体视觉、音乐与卡点、导出检查、封面发布 |
| **可运行的 3D 实验工程** | 双钥匙、真实孔洞、机械动作、关键词揭晓；可预览与渲染 |
| **默认 BGM＋自定义入口** | 本案例用过的音乐随包提供；换曲后重新分析与编排 |
| **三个检查工具** | 音乐瞬态分析、字幕与事件时间检查、视频完整解码与抽帧 |
| **五种工作模板** | 任务说明、事实表、分镜、验收与修订定位 |
| **真实失败案例** | 为什么“看着高级”仍像 demo、03 卡点失误、30 秒穿模、67 秒锁孔问题，以及修复办法 |

默认适合面向普通观众的 **字幕＋BGM＋关键音效** 视频，二维或三维均可，时长由内容决定。旁白、竖屏、不同风格都可覆盖默认值。不会把所有题材锁成 60 秒、某种配色、某首音乐或同一个癌症故事。

它帮助你减少返工，不承诺零修改、一次提示词就能得到爆款。真正可迁移的部分是：**明确的创作决策、可运行的起点，以及交付前能发现问题的检查。**

## 快速开始

### 1. 下载并安装

下载 ZIP 解压，或：

```sh
git clone https://github.com/S-Fan-ZJU/vibe-science-video.git
cd vibe-science-video
python skills/vibe-science-video/scripts/init_project.py ../my-science-video
python install.py --project ../my-science-video
```

先创建新视频工程，再把 `skills/vibe-science-video/` 安装到它的 `.agents/skills/`，保留原下载包。**同一个新项目必须先 init、再 install**；初始化器拒绝覆盖已存在的目录。已有项目只运行 `install.py`，由代理沿用已有工程；目标已有同名 skill 时会停止，不覆盖旧版本。Windows 若 `python` 无法运行，可使用已安装的 Python 3 的 `py` 或完整路径；无需管理员权限。

也可手动复制整个 `skills/vibe-science-video` 文件夹到项目的 `.agents/skills/`。项目级发现方式见 [官方文档](https://learn.chatgpt.com/docs/build-skills)。在其他支持 Agent Skills 的代理里，将整个 skill 放入该产品规定的目录，或要求代理明确读取它的 `SKILL.md`；无需依赖本人的电脑目录。

### 2. 打开新项目，把这段话交给代理

```text
请使用 $vibe-science-video，读取这个项目中的资料，为普通观众制作一条高质量知识动画。

主题／资料：填写选题、PDF 或原始来源链接
观众：普通观众
表达：中文字幕＋BGM＋关键音效，不加旁白
时长：以讲清楚为准，约 2–4 分钟，可合理调整
音乐：先使用 skill 随包的参考 BGM，也支持我稍后提供自定义音乐
目标：第一幕就有明确冲突；设置多个会兑现的疑问；关键动作卡在声音瞬态上；
      有空间关系的机制用真实立体动作展示；转场与知识关系一致。
流程：先完成事实表、分镜，以及前 15 秒＋最难机制＋一个转场的验证。
授权：内部检查通过后继续制作全片，无须逐阶段等待我；缺关键资料时再询问。
交付：可播放 MP4、可编辑工程、实际时间轴、音乐与来源记录、检查结果、
      16:9 / 4:3 / 3:4 封面，以及标题、简介、标签。所有输出保存在项目中。
```

如果你希望先看样片，把授权一行改成“样片完成后等我确认，再扩展全片”。已经有成片需要改，只给出文件和问题时间点，skill 也可以进入修订流程。不要为一处声音问题重写整部影片。

### 3. 想先确认电脑能运行？

从下载包根目录执行（目标目录须尚不存在）：

```sh
python skills/vibe-science-video/scripts/init_project.py ../video-lab
```

然后打开新目录 `video-lab/film/README.md`，按其中命令安装依赖、准备音乐、预览并导出。实验工程用于确认技术链路及学习 3D 卡点，**不等于你的选题已被写成完整脚本**。

## 怎么做到接近案例质量

**先把抽象要求变成可观察的画面。** “要有冲击力”落实为动作前的蓄势、接触帧、结构变化、镜头响应和声音反馈；“要有深度”落实为条件、因果、失败情况与下一层问题。

| 制作关口 | 通过标准 |
|---|---|
| 内容 | 每个重要说法可追溯；不同研究策略不拼成一个全能系统 |
| 开场 | 第一幅画面就看得懂主体与事件；提出观众在意的矛盾，随后兑现承诺 |
| 节奏 | 缩短字幕读完后的空等，不把所有句子硬裁成同样长度 |
| 爆点 | 看得见的结果帧对齐声音目标；动画起步通常要更早 |
| 画面 | 主体有材质、光照、层级与空间关系；不是用粒子替代机制解释 |
| 转场 | 前一场的对象、方向或遮挡自然接到下一场；检查边界前后帧 |
| 声音 | 提示音可辨、音乐暂时让位，最终编码后没有削波或错位 |
| 导出 | 检查最终编码文件，机器完整解码与人工视听分开记录 |

不会把预览不卡、脚本通过、局部截图正常，写成“全片已人工逐帧验收”。

## 手册导航

- [Skill 入口](skills/vibe-science-video/SKILL.md)：代理开始任务时读。
- [选题、证据与叙事](skills/vibe-science-video/references/story-and-evidence.md)：论文如何变成可视化问题链。
- [视觉、3D 与转场](skills/vibe-science-video/references/visual-direction.md)：主体、材质、镜头与接触动作。
- [音乐、卡点与声音](skills/vibe-science-video/references/music-and-timing.md)：为什么对齐动画起点仍然会“没卡上”。
- [制作与验收](skills/vibe-science-video/references/production-and-qa.md)：从样片到编码成片，怎样验证。
- [封面与发布](skills/vibe-science-video/references/publishing.md)：标题承诺、裁切、平台与包装。
- [真实案例复盘](skills/vibe-science-video/references/case-study.md)：本次做对的事与曾经失败的地方。
- [工具与数据格式](skills/vibe-science-video/references/tools.md)：实际可运行命令、输入输出、检查边界。
- [制作模板](skills/vibe-science-video/templates/)：新任务直接复制。
- [默认 BGM](skills/vibe-science-video/assets/music/README.md)：来源、案例分析与替换方法。

## 环境与成本

阅读手册不需要安装软件。运行实验工程需要 Node.js 与 npm；运行音频和媒体检查工具需要 Python 3.11 或兼容版本以及 `requirements.txt` 中的依赖。首次安装需联网下载包和渲染浏览器，之后本地工程可离线运行。

AI 代理、图片生成、外部素材或云渲染可能分别收费，本包不包含这些服务。没有图片生成工具也可以使用程序化材质和几何体；若其表现不够，明确说明需要什么素材，不用低质量占位图冒充完成。

高质量 3D 的 4K60 渲染可能耗时较长。先用 1080p 小段验证再渲染全片；普通电脑可先交付 1080p30。GPU 渲染、视频编码与并发数是不同选项，别仅凭电脑有独显就宣布“全程 GPU 加速”。

Remotion 官方工程实践可作为补充，在视频工程目录运行 `npx remotion skills add`。本 skill 的完整方法与示例不要求先安装另外两个 skill。相关安装方式见 [Remotion 官方说明](https://www.remotion.dev/docs/ai/skills)。

## 音乐与许可证

原创代码和文档采用 [MIT](LICENSE)。用户指定的参考 BGM 随包提供，保留来源；其独立再分发许可尚未核实，**不属于 MIT，也不宣称“免版权”**。制作公开或商业作品时可直接换成自己有权使用的音乐。详见 [NOTICE](NOTICE.md)。

## 测试与反馈

测试记录见 [VALIDATION.md](VALIDATION.md)。工具的自动检查只是辅助；不同选题的科学事实和最终视听效果仍需结合实际内容判断。

发现问题时，在 [Issues](https://github.com/S-Fan-ZJU/vibe-science-video/issues) 提供系统、操作步骤、报错或问题时间点。不要上传账号密钥、私人论文附件或未获许可的研究数据。

---

**English:** A Chinese-first, portable agent skill for cinematic science explainers: evidence-led storytelling, beat-aligned visible events, meaningful 3D motion, audio design, rendering QA and publishing. Includes a runnable Remotion lab, CLI checks and a real project showcase. Original code/docs are MIT; third-party reference music is separately identified. This is a production workflow, not a one-prompt quality guarantee.
