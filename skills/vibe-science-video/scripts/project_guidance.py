"""Add a portable project entry point while preserving existing instructions."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


START = b"<!-- vibe-science-video:project-guidance:start -->"
END = b"<!-- vibe-science-video:project-guidance:end -->"
GUIDANCE = """<!-- vibe-science-video:project-guidance:start -->
## 科学视频与本地模型复用

- 科学视频任务可明确调用 `$vibe-science-video`，或读取项目内 `.agents/skills/vibe-science-video/SKILL.md`。若尚未安装，先从下载包运行 `python install.py --project <本项目路径>`；这里的入口本身不会安装软件或下载模型。
- 制作新片、重新确定视觉方案或新增／替换画面素材时，先查看已有的 `assets/models/README.md`、`assets/models/inventory.json` 和 `planning/asset-plan.md`。路径不存在时先确认现有素材位置；空索引不表示项目必然没有模型。单纯字幕等局部修订无需重新盘点全库。
- 按本片科学对象、结构范围、已确认风格与画面需要选择候选，合适时优先复用，再决定是否建模或下载。保留 2D、3D 与混合表达的选择，不为使用素材改变科学事实。
- 选中模型后核对对应 `source.json`、署名和许可，检查部件、尺度、材质、动画及已有预览。按链着色不一定能独立驱动；可加载模型不等于已经完成机制动画。
- 在 `planning/asset-plan.md` 或项目已有素材清单记录选用文件、用途及关键候选不适用的原因。保留原件，在场景中调整展示；新增素材与实际检查结果同步到模型索引和项目接续记录。
<!-- vibe-science-video:project-guidance:end -->
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
        warnings.append("AGENTS.override.md exists and can take precedence over AGENTS.md; add the model-library entry to the effective instructions before relying on automatic discovery.")
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
