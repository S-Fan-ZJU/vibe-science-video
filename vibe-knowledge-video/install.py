"""Install the bundled skill and append its project entry without replacing existing files."""
from __future__ import annotations
import argparse
import shutil
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent / "skills" / "vibe-knowledge-video" / "scripts"
sys.path.insert(0, str(SCRIPTS))
from project_guidance import ensure_project_guidance


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
    source = Path(__file__).resolve().parent / "skills" / "vibe-knowledge-video"
    destination = args.project.expanduser().resolve() / ".agents" / "skills" / source.name
    if not (source / "SKILL.md").is_file():
        parser.error("Incomplete download: missing skills/vibe-knowledge-video/SKILL.md")
    if destination == source or source in destination.parents or destination in source.parents:
        parser.error("Choose a separate project outside the downloaded skill folder.")
    if destination.exists():
        parser.error(f"Already exists; keeping it unchanged: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=ignore_generated)
    print(f"Installed: {destination}")
    try:
        guidance = ensure_project_guidance(args.project)
    except (OSError, ValueError) as exc:
        parser.error(f"Skill installed, but project guidance was not changed: {exc}")
    print(f"Project instructions ({guidance['status']}): {guidance['file']}")
    for warning in guidance["warnings"]:
        print(f"Warning: {warning}")
    print("Open the target project in your agent and invoke $vibe-knowledge-video.")


if __name__ == "__main__":
    main()
