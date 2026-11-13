# Vibe Knowledge video

**先明确用途，再把知识做成适合观众的视频。**

面向 Codex 等编程代理的中文知识视频 skill。支持科学、历史、数学、心理、经济、人文等题材，从需求、事实核查、叙事分镜到二维／三维画面、声音、成片验收与交付。

它基于 [Vibe Science Video](https://github.com/S-Fan-ZJU/vibe-science-video) 的成熟流程和工具整理，保留科学机制制作的经验，增加按用途选择风格、8 条参考视频的表达方法与跨对话接续。Vibe Science Video 侧重科研与科学机制；Vibe Knowledge video 提供面向不同知识题材的制作入口，两者可并存。

## 每条视频先确认什么

1. **用途与受众**：用在哪里，给谁看，知识基础和观看目标是什么。
2. **风格与参考**：科研／教学、大众科普、娱乐传播或混合；采用和不采用哪些参考特点。
3. **节奏与声音**：节奏快慢、音乐／旁白／音效的存在感，以及卡点、闪烁的开关与强度。

本次已提供的信息直接记录，只补问缺项。用途或风格缺失时，先询问再定分镜、视觉和配乐；可先整理资料与核验事实。同一影片的普通修订沿用已确认方向。所有风格都需要准确的事实和清楚的因果，鲜艳、闪烁、三维与快节奏均是可选手法。

## 包含的内容

| 内容 | 用途 |
|---|---|
| [Skill 入口](skills/vibe-knowledge-video/SKILL.md) | 任务路由、需求确认、制作与交付流程 |
| [用途与风格](skills/vibe-knowledge-video/references/style-and-purpose.md) | 可直接使用的询问方式、可独立组合的表现维度 |
| [故事与证据](skills/vibe-knowledge-video/references/story-and-evidence.md) | 跨领域事实表、叙事、问题链、字幕阅读 |
| [参考分析](skills/vibe-knowledge-video/references/reference-analysis.md) | 8 条参考的时间码与可迁移方法、证据范围、新参考的分析流程 |
| [视觉](skills/vibe-knowledge-video/references/visual-direction.md)与[声音](skills/vibe-knowledge-video/references/music-and-timing.md) | 图解、路径、对象延续、三维空间、可选三级音乐响应 |
| [模型复用](skills/vibe-knowledge-video/references/model-library.md) | 发现本地候选、核对结构与来源，按内容选择 |
| [制作与验收](skills/vibe-knowledge-video/references/production-and-qa.md) | 可复现渲染、完整解码、观看试听、局部修复 |
| [工具](skills/vibe-knowledge-video/references/tools.md)和[模板](skills/vibe-knowledge-video/templates) | 初始化、安装、素材扫描、抽帧、音频分析、时间轴和媒体检查 |
| [12 秒技术实验](skills/vibe-knowledge-video/assets/starter/README.md) | 沿用原 Remotion＋Three 双条件动作，验证工程与导出，可换音乐或静音 |

参考视频和其音轨没有打包。原科研案例与柏林样片是经验来源，参考中建议的全部通用图解组件并未实现；12 秒实验也不是“换文案就能生成任意题材”的成片模板。具体边界在各手册中说明。

## 使用方式

需要 Python 3.11 或兼容版本；运行实验另需 Node.js 22.13+、npm 与浏览器渲染环境。阅读和编辑制作记录不需要安装影音依赖。

新建视频项目时，在本包根目录执行：

```sh
python skills/vibe-knowledge-video/scripts/init_project.py ../my-knowledge-video
python install.py --project ../my-knowledge-video
```

先初始化再安装：初始化器拒绝覆盖现有目录，安装器拒绝替换同名 skill。已有视频项目只运行 `install.py --project 项目路径`，然后沿用已有工程。Windows 可使用 `py -3.11` 或可用 Python 的完整路径。

也可把整个 `skills/vibe-knowledge-video` 复制到目标项目的 `.agents/skills/`，然后在目标项目根目录补接续入口：

```sh
python .agents/skills/vibe-knowledge-video/scripts/project_guidance.py --project .
```

工具保留已有项目指引；若项目使用 `AGENTS.override.md`，按提示把入口合并到实际生效文件。新项目的 `planning/brief.md` 记录需求，`planning/project-state.md` 记录进度，`references/README.md` 引导存放参考及分析。新对话从项目文件接续，不依赖旧聊天全文。

给代理的一句话：

```text
请使用 $vibe-knowledge-video，做一条关于【主题】的视频。
先读项目已有记录，再补问本次用途、受众、风格与声画强度。
我已经提供的要求直接记录；每次完成后更新项目状态，保留旧版本。
```

信息已经明确时可以直接给完整任务书：

```text
请使用 $vibe-knowledge-video 制作一条面向高中生的历史课堂视频。
主题：【主题】；资料：【路径或链接】。
用途：课堂解释；风格：清晰图解与地图叙事；节奏适中。
使用中文字幕和轻背景音乐，无旁白、无音乐闪烁。
先交 15 秒样片。需求和已有参考写入项目记录。
```

选择“内部检查后连续完成全片”即可在已确认范围内持续制作；选择“先看样片”就在样片处交付。制作授权不自动包含操作外部发布账号。

## 验证与能力边界

[VALIDATION.md](VALIDATION.md) 记录本包实际执行的工具、安装、技术实验和行为检查。完整解码、选帧、连续观看、实际试听、用户认可分别记录，不能相互替代。

音频、时间轴和媒体工具需要 `skills/vibe-knowledge-video/requirements.txt` 中的依赖。实验工程的依赖版本锁定在其 lockfile 中；按实验 README 安装和运行。替换音乐后重新分析；改时长、画幅或帧率时同步检查布局、音频和事件参数。

本包提供制作方法、模板和工具，需要代理针对题材完成创作。它不保证一次生成成功、任意设备性能或平台传播效果，也不捆绑模型库中的第三方三维素材。

## 来源与许可

原创代码与文档沿用 [MIT](LICENSE)，保留原作者 Sizhe Fan 署名。原案例参考 BGM 作为可选技术实验素材保留，独立许可未核实，不属于 MIT，也不作为新视频的默认配乐。自定义音乐和静音均可使用。详见 [NOTICE](NOTICE.md)。

当前版本提供 skill 包与可运行实验；网站展示可在此基础上另行建设。
