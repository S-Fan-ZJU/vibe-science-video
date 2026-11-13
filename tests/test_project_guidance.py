"""Portable project discovery checks; uses only temporary local files."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "vibe-science-video" / "scripts"
sys.path.insert(0, str(SCRIPTS))
from project_guidance import START, END, ensure_project_guidance


class ProjectGuidanceTests(unittest.TestCase):
    def test_standalone_cli_adds_entry_without_installing_or_downloading(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "existing-video-细胞膜"
            result = subprocess.run([sys.executable, "-X", "utf8", str(SCRIPTS / "project_guidance.py"),
                "--project", str(project)], capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["status"], "added")
            self.assertEqual(Path(report["file"]), project / "AGENTS.md")
            self.assertEqual(report["warnings"], [])
            self.assertEqual([p.name for p in project.iterdir()], ["AGENTS.md"])

    def test_new_project_entry_and_repeat_are_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "new-project"
            first = ensure_project_guidance(project)
            data = (project / "AGENTS.md").read_bytes()
            self.assertEqual(first["status"], "added")
            self.assertEqual(data.count(START), 1)
            self.assertEqual(data.count(END), 1)
            second = ensure_project_guidance(project)
            self.assertEqual(second["status"], "unchanged")
            self.assertEqual((project / "AGENTS.md").read_bytes(), data)

    def test_existing_instructions_and_assets_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            instructions = b"\xef\xbb\xbf# Existing rules\r\n\r\nKeep original preferences."
            (project / "AGENTS.md").write_bytes(instructions)
            assets = project / "assets" / "models"
            assets.mkdir(parents=True)
            inventory = b'[{"id":"existing","note":"do not replace"}]\n'
            (assets / "inventory.json").write_bytes(inventory)
            model = b"existing-model-payload"
            (assets / "original.glb").write_bytes(model)
            ensure_project_guidance(project)
            changed = (project / "AGENTS.md").read_bytes()
            self.assertTrue(changed.startswith(instructions))
            self.assertNotEqual(changed, instructions)
            self.assertEqual((assets / "inventory.json").read_bytes(), inventory)
            self.assertEqual((assets / "original.glb").read_bytes(), model)

    def test_partial_markers_are_rejected_without_modification(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            data = b"# User notes\n" + START + b"\nunfinished block\n"
            (project / "AGENTS.md").write_bytes(data)
            with self.assertRaisesRegex(ValueError, "managed markers"):
                ensure_project_guidance(project)
            self.assertEqual((project / "AGENTS.md").read_bytes(), data)

    def test_override_is_reported_without_changing_it(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            data = b"# Effective user-specific instructions\n"
            (project / "AGENTS.override.md").write_bytes(data)
            report = ensure_project_guidance(project)
            self.assertEqual(len(report["warnings"]), 1)
            self.assertEqual((project / "AGENTS.override.md").read_bytes(), data)

    def test_install_preserves_existing_guide_and_refuses_skill_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "project-模型"
            project.mkdir()
            data = b"# Existing project\nUse the current animation framework.\n"
            (project / "AGENTS.md").write_bytes(data)
            command = [sys.executable, "-X", "utf8", str(ROOT / "install.py"), "--project", str(project)]
            first = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(first.returncode, 0, first.stderr)
            installed = project / ".agents" / "skills" / "vibe-science-video" / "SKILL.md"
            self.assertTrue(installed.is_file())
            self.assertIn(f"Installed: {installed.parent}", first.stdout)
            guide = (project / "AGENTS.md").read_bytes()
            self.assertTrue(guide.startswith(data))
            installed.write_text("user-modified skill", encoding="utf-8")
            second = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertNotEqual(second.returncode, 0)
            self.assertEqual(installed.read_text(encoding="utf-8"), "user-modified skill")
            self.assertEqual((project / "AGENTS.md").read_bytes(), guide)

    def test_init_creates_empty_library_and_usable_entry(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "new-video-模型"
            command = [sys.executable, "-X", "utf8", str(SCRIPTS / "init_project.py"), str(project)]
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(Path(report["created"]), project)
            self.assertEqual(report["project_guidance"]["status"], "added")
            self.assertEqual(json.loads((project / "assets/models/inventory.json").read_text(encoding="utf-8")), [])
            for relative in ["AGENTS.md", "assets/models/README.md", "planning/asset-plan.md", "film/package.json"]:
                self.assertTrue((project / relative).is_file(), relative)
            self.assertFalse(list((project / "assets/models").glob("*.glb")))
            guide = (project / "AGENTS.md").read_bytes()
            again = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertNotEqual(again.returncode, 0)
            self.assertEqual((project / "AGENTS.md").read_bytes(), guide)


if __name__ == "__main__":
    unittest.main()
