"""Install the bundled skill into a chosen project without overwriting anything."""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path


def ignore_generated(directory: str, names: list[str]) -> set[str]:
    skip = set(shutil.ignore_patterns("node_modules", "__pycache__", ".venv", ".remotion", "output", "out", ".validation", "*.log")(directory, names))
    if Path(directory).name == "public":
        skip.add("audio")
    if Path(directory).name == "src":
        skip.add("audio-config.json")
    return skip


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, type=Path, help="Target project directory")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent / "skills" / "vibe-science-video"
    destination = args.project.expanduser().resolve() / ".agents" / "skills" / source.name
    if not (source / "SKILL.md").is_file():
        parser.error("Incomplete download: missing skills/vibe-science-video/SKILL.md")
    if destination == source or source in destination.parents or destination in source.parents:
        parser.error("Choose a separate project outside the downloaded skill folder.")
    if destination.exists():
        parser.error(f"Already exists; keeping it unchanged: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=ignore_generated)
    print(f"Installed: {destination}")
    print("Open the target project in your agent and invoke $vibe-science-video.")


if __name__ == "__main__":
    main()
