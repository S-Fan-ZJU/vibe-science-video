"""Create a separate runnable video workspace; never overwrite an existing folder."""
from __future__ import annotations
import argparse
import json
import shutil
from pathlib import Path

from project_guidance import ensure_project_guidance


def ignore_generated(directory: str, names: list[str]) -> set[str]:
    skip = set(shutil.ignore_patterns("node_modules", "__pycache__", ".remotion", "output", "out", ".validation", "*.log")(directory, names))
    if Path(directory).name == "public":
        skip.add("audio")
    if Path(directory).name == "src":
        skip.add("audio-config.json")
    return skip


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[1]
    destination = args.destination.expanduser().resolve()
    starter = skill / "assets" / "starter"
    if destination.exists():
        parser.error(f"Destination exists; choose a new folder: {destination}")
    if skill == destination or skill in destination.parents:
        parser.error("Create your video outside the installed skill directory.")
    if not (starter / "package.json").is_file():
        parser.error("Incomplete skill download: missing runnable starter.")
    model_templates = {"model-library-README.md": "README.md", "model-inventory.json": "inventory.json"}
    for template in (*model_templates, "asset-plan.md"):
        if not (skill / "templates" / template).is_file():
            parser.error(f"Incomplete skill download: missing templates/{template}")
    shutil.copytree(starter, destination / "film", ignore=ignore_generated)
    for name in ("sources", "output", "qa", "assets/music", "assets/models", "references/videos", "references/analysis"):
        (destination / name).mkdir(parents=True, exist_ok=True)
    shutil.copytree(skill / "templates", destination / "planning", ignore=shutil.ignore_patterns(*model_templates))
    for template, filename in model_templates.items():
        shutil.copy2(skill / "templates" / template, destination / "assets" / "models" / filename)
    music = skill / "assets" / "music"
    for file in music.iterdir():
        if file.is_file():
            shutil.copy2(file, destination / "assets" / "music" / file.name)
    (destination / "PROJECT.md").write_text(
        "# 新知识视频项目\n\n先读 AGENTS.md、planning/project-state.md 和 planning/brief.md，再让制作代理使用已安装的 $vibe-knowledge-video。\n"
        "\n每条新片先确认用途、受众、风格和节奏／声音／闪烁；本次已有信息直接记录，只问缺项，不能从实验或上一条推定风格。\n"
        "\nfilm/ 是可选的 12 秒 3D 技术实验，不是已完成的知识成片。需要验证环境时按 film/README.md 运行；所有输出保存在 output/。\n"
        "\nassets/music/reference-bgm.m4a 仅为实验参考，新片配乐按本次需求选择，允许静音。自定义音乐需重新分析，不沿用案例卡点。\n"
        "\n参考及拆解保存在 references/；每次重要交付或反馈更新 planning/project-state.md，保留旧版本。\n",
        encoding="utf-8")
    (destination / "planning" / "project-state.md").write_text(
        "# 项目状态\n\n## 当前阶段\n\n已初始化工程；新片用途、受众、风格与声画强度尚待本次任务确认，未制作新片、未渲染或试听。\n"
        "\n## 接续入口\n\n- [需求与确认记录](brief.md)：记录用户要求及确认依据，不将模板选项当成已确认。\n"
        "- [参考与拆解](../references/README.md)：按新题材选择相关方法。\n"
        "- [素材方案](asset-plan.md)：记录实际选用、改造和不适用原因。\n"
        "- [技术实验说明](../film/README.md)：仅用于环境验证，双条件动作和配乐不是新片默认。\n"
        "\n## 交付与反馈\n\n暂无新片交付。后续记录版本、源代码、最终音轨／静音选择、成片、QA、用户反馈及待办；区分已确认、已实现待评价和建议未实现。\n",
        encoding="utf-8")
    (destination / "references" / "README.md").write_text(
        "# 参考视频与拆解\n\n将参考媒体放在 videos/，分析与抽帧证据放在 analysis/。本目录初始为空，不代表已有视频完成分析。\n"
        "\n每份记录写明来源、文件、时间段、观察到的手法、证据范围，以及在本片采用／不采用的特点。参考用于表达学习，知识事实与素材使用范围需分别核验。\n"
        "\n先按本片用途、受众和已确认风格选参考。鲜明配色、强卡点、音乐闪烁只是可选手法；保持科研、大众科普、娱乐传播或混合表达的选择。\n"
        "\n新对话先读本索引与 planning/project-state.md，再查相关分析；不要把间隔抽帧写成全片观看或主观试听。\n",
        encoding="utf-8")
    guidance = ensure_project_guidance(destination)
    print(json.dumps({"created": str(destination), "project_guidance": guidance, "next": "Install the skill into this project, then read AGENTS.md, film/README.md and planning/brief.md"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
