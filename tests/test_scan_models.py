"""Model discovery tests use generated fixtures and require no external assets."""
from pathlib import Path
import hashlib
import json
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'skills/vibe-science-video/scripts'
sys.path.insert(0, str(SCRIPTS))
from scan_models import scan


def make_glb(path, instances=2):
    document = {'asset': {'version': '2.0'}, 'accessors': [{'count': 3, 'componentType': 5126, 'type': 'VEC3'}],
                'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
                'nodes': [{'mesh': 0} for _ in range(instances)],
                'scenes': [{'nodes': list(range(instances))}], 'materials': [{}],
                'animations': [], 'skins': [], 'images': [{'uri': 'texture.png'}]}
    payload = json.dumps(document).encode()
    payload += b' ' * (-len(payload) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, len(payload)+20) + struct.pack('<II',len(payload),0x4E4F534A) + payload)


class ModelScanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.library = self.root/'assets/models'

    def tearDown(self):
        self.temp.cleanup()

    def test_missing_and_empty_library(self):
        self.assertEqual(scan(self.root)['libraryStatus'], 'missing')
        self.assertEqual(scan(self.root)['summary']['candidateModels'], 0)
        self.library.mkdir(parents=True)
        self.assertEqual(scan(self.root)['libraryStatus'], 'empty')
        self.assertEqual(scan(self.root)['summary']['candidateModels'], 0)

    def test_glb_scene_instances_and_sidecar(self):
        file = self.library/'molecule/model.glb'
        make_glb(file, instances=3)
        (file.parent/'source.json').write_text('{"license": "unknown"}')
        record = scan(self.root)['models'][0]
        self.assertEqual(record['status'], 'candidate')
        self.assertEqual(record['glb']['meshDefinitionTriangles'], 1)
        self.assertEqual(record['glb']['sceneTriangles'], 3)
        self.assertEqual(record['glb']['externalResourceUris'], ['texture.png'])
        self.assertFalse(record['glb']['externalResourcesChecked'])
        self.assertEqual(record['licenseStatus'], 'not_verified')
        self.assertIn('assets/models/molecule/source.json', record['metadataFiles'])

    def test_truncated_glb_not_candidate(self):
        file = self.library/'bad.glb'
        make_glb(file)
        file.write_bytes(file.read_bytes()[:-8])
        report = scan(self.root)
        self.assertEqual(report['models'][0]['status'], 'invalid')
        self.assertEqual(report['summary']['candidateModels'], 0)
        self.assertEqual(report['summary']['invalidModels'], 1)

    def test_missing_indexed_file_and_project_relative_candidate(self):
        self.library.mkdir(parents=True)
        indexed = self.root/'assets/reused/external-to-library.glb'
        make_glb(indexed)
        (self.library/'inventory.json').write_text(json.dumps([
            {'path':'lost.glb'}, {'path':'assets/reused/external-to-library.glb'}]))
        report = scan(self.root)
        self.assertEqual(report['summary']['candidateModels'], 1)
        self.assertEqual(report['summary']['indexedCandidates'], 1)
        self.assertEqual(report['missingIndexedFiles'][0]['path'],'assets/models/lost.glb')
        self.assertTrue(report['models'][0]['indexed'])

    def test_index_traversal_and_absolute_rejected(self):
        self.library.mkdir(parents=True)
        (self.library/'inventory.json').write_text(json.dumps([
            {'path':'../../secrets.glb'}, {'path':'C:\\private\\m.glb'},
            {'path':'/private/m.glb'}, {'path':'https://example.test/m.glb'}]))
        report = scan(self.root)
        self.assertEqual(report['models'], [])
        self.assertEqual(len(report['excluded']), 4)

    def test_symlink_escape_not_followed(self):
        self.library.mkdir(parents=True)
        with tempfile.TemporaryDirectory() as external:
            secret = Path(external)/'outside.glb'
            make_glb(secret)
            try:
                (self.library/'outside.glb').symlink_to(secret)
            except (OSError, NotImplementedError):
                self.skipTest('Symlink creation unavailable')
            report=scan(self.root)
            self.assertEqual(report['models'],[])
            self.assertEqual(len(report['excluded']),1)

    def test_no_asset_mutations_and_output_exclusive(self):
        model = self.library/'model.glb'
        make_glb(model)
        inventory = self.library/'inventory.json'
        inventory.write_text('[{"path":"model.glb"}]')
        source = self.library/'source.json'
        source.write_text('{"title":"Existing notes"}')
        originals={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in [model,inventory,source]}
        output=self.root/'report.json'
        command=[sys.executable,'-X','utf8',str(SCRIPTS/'scan_models.py'),'--project',str(self.root),'--output',str(output)]
        first=subprocess.run(command,capture_output=True,text=True,encoding='utf-8')
        self.assertEqual(first.returncode,0,first.stderr)
        saved=output.read_bytes()
        reported=json.loads(first.stdout)
        self.assertEqual(reported,json.loads(saved))
        self.assertEqual(reported['summary']['candidateModels'],1)
        second=subprocess.run(command,capture_output=True,text=True,encoding='utf-8')
        self.assertNotEqual(second.returncode,0)
        self.assertEqual(output.read_bytes(),saved)
        for path,digest in originals.items():
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)


if __name__ == '__main__':
    unittest.main()
