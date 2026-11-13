# 来源与许可

本包为 **Vibe Knowledge video**，从 `S-Fan-ZJU/vibe-science-video` 的提交 `73d7bdc821f12f7049b2d5e99091e69da64acbea` 整理扩展。保留原制作、模型复用、音频与媒体检查、安装和技术实验代码；增加跨知识领域的用途／风格确认、参考分析和项目接续。原 Science 项目独立保留。

新增方法来自作者知识视频工程的制作记录，以及 8 条参考的间隔抽帧、重点片段和局部音画分析。报告中的观察不表示已完整试听或独立核验参考里的知识结论；原参考视频及其音轨未随包复制。

## 原创代码与方法

本仓库由 Sizhe Fan 将《把细菌，变成药》项目的制作经验整理为可复用 skill，使用 AI 辅助开发和检查。原创代码与本文档采用 MIT 许可。原项目展示图像和案例动画用于说明制作效果，本包未复制展示视频；引用时请保留作者与仓库链接。

本包没有复制原论文 PDF，没有分发系统字体，也没有把依赖库的许可证改为 MIT。

## 随包示例音乐

`skills/vibe-knowledge-video/assets/music/reference-bgm.m4a` 是项目作者提供并指定随包保留的原始音轨，来源为 [B 站参考视频 BV1mLWw6VEux](https://www.bilibili.com/video/BV1mLWw6VEux/)。文件可包含该视频原有声音，不应据此宣称它是干净的商业母带或纯音乐分轨。

截至本包整理时，尚未确认曲名、作曲者或独立的再分发许可证。**音乐及展示视频中包含的该音乐不在本仓库 MIT 许可范围内；广泛使用并不等于已获开放许可。** 本仓库记录来源，不代表音乐作者授权所有下游用途。替换为自己有权使用的 BGM 的步骤见 [音乐说明](skills/vibe-knowledge-video/assets/music/README.md)。如权利人需联系维护者，请使用仓库 Issues。

## 项目来源与致谢

- [Remotion](https://www.remotion.dev/) 与 [官方 Agent Skills](https://www.remotion.dev/docs/ai/skills)：基于当前帧构建动画、预览和离线渲染。本仓库是独立创作流程，并非 Remotion 官方产品。依赖适用各自许可，使用条件请查看 [Remotion 许可](https://www.remotion.dev/docs/license)。
- 本项目早期使用过名为 `vibe-knowledge` 的 Canvas 动画 skill，其选题、节奏与转场工作流提供了启发。本包重新组织了本次项目的实际经验，不包含该第三方 skill 的完整代码或文档；不声称是其官方更新。
- [OpenAI 的 skill 文档](https://learn.chatgpt.com/docs/build-skills)：本包使用标准 `SKILL.md` 和项目级安装方式，不需要专用插件服务。
- 案例依据：Gurbatri CR, Arpaia N, Danino T. *Engineering bacteria as interactive cancer therapies*. Science (2022). [DOI: 10.1126/science.add9667](https://doi.org/10.1126/science.add9667)。公开案例属于研究机制动画，不是治疗服务。
