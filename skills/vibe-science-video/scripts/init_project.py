"""Create a separate runnable video workspace; never overwrite an existing folder."""
from __future__ import annotations
import argparse
import json
import shutil
from pathlib import Path


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
    shutil.copytree(starter, destination / "film", ignore=ignore_generated)
    for name in ("sources", "output", "qa", "assets/music"):
        (destination / name).mkdir(parents=True, exist_ok=True)
    shutil.copytree(skill / "templates", destination / "planning")
    music = skill / "assets" / "music"
    for file in music.iterdir():
        if file.is_file():
            shutil.copy2(file, destination / "assets" / "music" / file.name)
    (destination / "PROJECT.md").write_text(
        "# 新视频项目\n\n先填写 planning/brief.md，再让制作代理读取已安装的 $vibe-science-video。\n"
        "\nfilm/ 是 3D 节奏实验起点，不是完整科学成片。所有输出保存在 output/。\n"
        "\n运行 film/README.md 的安装与音频准备步骤；默认音乐位于 assets/music/reference-bgm.m4a。\n"
        "\n自定义音乐需要重新分析，不沿用案例卡点。保留旧版本，完成事实表和分镜再扩展影片。\n",
        encoding="utf-8")
    print(json.dumps({"created": str(destination), "next": "Read film/README.md and planning/brief.md"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
