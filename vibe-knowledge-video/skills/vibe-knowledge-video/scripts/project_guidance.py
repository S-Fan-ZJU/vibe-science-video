"""Add a portable project entry point while preserving existing instructions."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


START = b"<!-- vibe-knowledge-video:project-guidance:start -->"
END = b"<!-- vibe-knowledge-video:project-guidance:end -->"
GUIDANCE = """<!-- vibe-knowledge-video:project-guidance:start -->
## 知识视频制作、需求确认与项目接续

- 知识视频任务可明确调用 `$vibe-knowledge-video`，或读取项目内 `.agents/skills/vibe-knowledge-video/SKILL.md`；科学、历史、数学、人文等题材均适用。若尚未安装，先从下载包运行 `python install.py --project <本项目路径>`；这个入口本身不会安装软件或下载素材。
- 开始工作先读 `planning/brief.md`、`planning/project-state.md` 和 `references/README.md`；已有项目采用其他位置时，先找到实际需求、状态、参考分析和最新交付清单，不覆盖已有记录。按本次题材查阅相关参考拆解，不要求用户重复已保存的信息，也不假设新对话自带旧聊天全文。
- 每条新视频在定分镜、视觉、配乐和开始制作前，先确认用途／观看场景、受众与知识基础、风格方向、节奏、音乐／旁白／音效及卡点／闪烁强度。本次已经给出的信息直接记录，只补问缺项；用途或风格仍缺失时等待回答，可先整理资料和核验事实。允许无 BGM、关闭闪烁或自定义混合风格，不能仅凭上一条或一批参考决定新片审美。
- 将本片确认及来源写入 `planning/brief.md`；参考中采用和不采用的特征写入参考记录。科研表达与娱乐传播保持相同的事实准确标准；鲜艳、闪烁、三维和强卡点都是按用途选择的手法。同一影片的常规修订沿用已确认方向，用途或风格变化时只确认相关项。
- 制作新片、重新确定视觉方案或新增／替换画面素材时，先查看已有的 `assets/models/README.md`、`assets/models/inventory.json` 和 `planning/asset-plan.md`。路径不存在时先确认现有素材位置；空索引不表示项目必然没有模型。单纯字幕等局部修订无需重新盘点全库。
- 按本片对象、结构／地理／年代范围、已确认风格与画面需要选择候选，合适时优先复用，再决定是否建模或下载。保留 2D、3D 与混合表达的选择，不为使用素材改变事实。现有双条件 3D 实验只验证技术链路，不是任意题材的固定片头。
- 选中模型后核对对应 `source.json`、署名和许可，检查部件、尺度、材质、动画及已有预览。按链着色不一定能独立驱动；可加载模型不等于已经完成机制动画。
- 在 `planning/asset-plan.md` 或项目已有素材清单记录选用文件、用途及关键候选不适用的原因。保留原件，在场景中调整展示；新增素材与实际检查结果同步到模型索引和项目接续记录。
- 每次有重要交付、用户反馈或方向变化，更新项目状态并链接当前源代码、音轨、输出和检查报告，保留旧版本。区分用户已确认、已实现待评价、尚未实施；完整解码、选帧检查、连续观看与实际试听分别记录。制作授权不自动包含公开发布。
<!-- vibe-knowledge-video:project-guidance:end -->
"""


def ensure_project_guidance(project: Path) -> dict:
    """Append one block only; never rewrite an existing block or surrounding bytes."""
    project = project.expanduser().resolve()
    if project.exists() and not project.is_dir():
        raise ValueError(f"Project is not a directory: {project}")
    target = project / "AGENTS.md"
    if target.is_symlink():
        raise ValueError(f"Keeping linked instructions unchanged; add the project entry manually: {target}")
    existing = target.read_bytes() if target.exists() else b""
    try:
        existing.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(f"Existing instructions are not UTF-8; keeping them unchanged: {target}") from exc
    start_count, end_count = existing.count(START), existing.count(END)
    if start_count or end_count:
        if start_count != 1 or end_count != 1 or existing.index(START) >= existing.index(END):
            raise ValueError(f"Incomplete or duplicate managed markers; keeping instructions unchanged: {target}")
        status = "unchanged"
    else:
        newline = b"\r\n" if b"\r\n" in existing else b"\n"
        separator = b"" if not existing else (newline if existing.endswith(b"\n") else newline * 2)
        prefix = b"# Project instructions\n\n" if not existing else b""
        block = GUIDANCE.encode("utf-8").replace(b"\n", newline)
        project.mkdir(parents=True, exist_ok=True)
        with target.open("ab") as handle:
            handle.write(prefix + separator + block)
        status = "added"
    warnings = []
    if (project / "AGENTS.override.md").is_file():
        warnings.append("AGENTS.override.md exists and can take precedence over AGENTS.md; add this knowledge-video entry to the effective instructions before relying on automatic discovery.")
    return {"file": str(target), "status": status, "warnings": warnings}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, type=Path, help="Project root receiving the AGENTS.md entry")
    args = parser.parse_args()
    try:
        result = ensure_project_guidance(args.project)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
