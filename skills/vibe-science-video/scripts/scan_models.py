"""Discover local model candidates without modifying assets or fetching resources.

Inventory paths beginning with assets/ are project-relative; other paths are
relative to assets/models/. Absolute paths and traversal are rejected. The
report is a discovery aid, not a render, scientific, or license validation.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import struct

MODEL_EXTENSIONS = {'.glb', '.gltf', '.obj', '.stl', '.fbx', '.blend'}
JSON_LIMIT = 16 * 1024 * 1024


class InspectionLimit(ValueError):
    """A bounded metadata inspection could not be completed."""


def inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root)
        return True
    except (ValueError, OSError, RuntimeError):
        return False


def checked_index(value, entries, label):
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value < len(entries):
        raise ValueError(f'Invalid {label} index')
    return entries[value]


def inspect_glb(path: Path) -> dict:
    """Read GLB metadata only; do not decode images or run imported content."""
    size = path.stat().st_size
    with path.open('rb') as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise ValueError('Truncated GLB header')
        magic, version, declared = struct.unpack('<4sII', header)
        if magic != b'glTF' or version != 2 or declared != size:
            raise ValueError('GLB magic, version, or declared length does not match')
        document, bin_length, chunks = None, 0, 0
        while stream.tell() < size:
            chunk_header = stream.read(8)
            if len(chunk_header) != 8:
                raise ValueError('Truncated GLB chunk header')
            length, kind = struct.unpack('<II', chunk_header)
            if length % 4 or stream.tell() + length > size:
                raise ValueError('Invalid GLB chunk range or alignment')
            if chunks == 0 and kind != 0x4E4F534A:
                raise ValueError('First GLB chunk must contain JSON')
            if kind == 0x4E4F534A:
                if document is not None:
                    raise ValueError('Duplicate GLB JSON chunk')
                if length > JSON_LIMIT:
                    raise InspectionLimit('GLB JSON exceeds 16 MiB inspection limit')
                document = json.loads(stream.read(length).decode('utf-8'))
            else:
                if kind == 0x004E4942:
                    bin_length += length
                stream.seek(length, 1)
            chunks += 1
    if not isinstance(document, dict) or document.get('asset', {}).get('version') != '2.0':
        raise ValueError('Missing glTF 2.0 asset metadata')
    buffers = document.get('buffers', [])
    for buffer in buffers:
        length = buffer['byteLength']
        if not isinstance(length, int) or length < 0:
            raise ValueError('Invalid buffer length')
        if not buffer.get('uri') and length > bin_length:
            raise ValueError('Embedded buffer exceeds BIN chunk')
    for view in document.get('bufferViews', []):
        buffer = checked_index(view['buffer'], buffers, 'buffer')
        offset, length = view.get('byteOffset', 0), view['byteLength']
        if not isinstance(offset, int) or not isinstance(length, int) or min(offset, length) < 0 or offset + length > buffer['byteLength']:
            raise ValueError('bufferView exceeds declared buffer')
    accessors = document.get('accessors', [])
    mesh_triangles = []
    for mesh in document.get('meshes', []):
        triangles = 0
        for primitive in mesh['primitives']:
            accessor_id = primitive.get('indices', primitive.get('attributes', {}).get('POSITION'))
            count = checked_index(accessor_id, accessors, 'accessor')['count']
            if not isinstance(count, int) or count < 0:
                raise ValueError('Invalid primitive accessor count')
            mode = primitive.get('mode', 4)
            if mode == 4:
                if count % 3:
                    raise ValueError('Triangle primitive count is not divisible by three')
                triangles += count // 3
            elif mode in (5, 6):
                triangles += max(0, count - 2)
            elif mode not in (0, 1, 2, 3):
                raise ValueError('Invalid primitive mode')
        mesh_triangles.append(triangles)
    nodes = document.get('nodes', [])

    def count_node(index, ancestors):
        node = checked_index(index, nodes, 'node')
        if index in ancestors:
            raise ValueError('Cycle in scene nodes')
        own = checked_index(node['mesh'], mesh_triangles, 'mesh') if 'mesh' in node else 0
        return own + sum(count_node(child, ancestors | {index}) for child in node.get('children', []))

    scenes = document.get('scenes', [])
    scene_triangles = None
    if scenes:
        scene = checked_index(document.get('scene', 0), scenes, 'scene')
        scene_triangles = sum(count_node(index, set()) for index in scene.get('nodes', []))
    external = [item['uri'] for group in ('buffers', 'images') for item in document.get(group, [])
                if isinstance(item.get('uri'), str) and not item['uri'].startswith('data:')]
    return {'headerLengthValid': True, 'meshDefinitions': len(mesh_triangles),
            'meshDefinitionTriangles': sum(mesh_triangles), 'sceneTriangles': scene_triangles,
            'animations': len(document.get('animations', [])), 'skins': len(document.get('skins', [])),
            'materials': len(document.get('materials', [])), 'externalResourceUris': external,
            'externalResourcesChecked': False}


def scan(project: Path) -> dict:
    root = project.expanduser().resolve()
    if not root.is_dir():
        raise ValueError('Project directory does not exist')
    library = root / 'assets/models'
    report = {'schemaVersion': 1, 'library': 'assets/models', 'libraryStatus': 'missing',
              'models': [], 'missingIndexedFiles': [], 'excluded': [], 'errors': [],
              'summary': {'candidateModels': 0, 'indexedCandidates': 0, 'invalidModels': 0, 'deferredModels': 0,
                          'missingIndexedFiles': 0, 'excludedReferences': 0},
              'limits': 'Counts are files, including source/conversion duplicates, not unique scientific models. Prefer indexed candidates when appropriate. Discovery and limited GLB metadata checks only; no rendering, scientific validation, external-resource fetch, or license verification.'}
    if not inside(library, root) or library.is_symlink():
        report['libraryStatus'] = 'excluded'
        report['excluded'].append({'path': 'assets/models', 'reason': 'Library symlink or path escapes project'})
        report['summary']['excludedReferences'] = 1
        return report
    if not library.is_dir():
        return report
    report['libraryStatus'] = 'empty'
    found = {}
    for directory, directories, files in os.walk(library, followlinks=False):
        base = Path(directory)
        retained = []
        for name in directories:
            child = base / name
            if not child.is_symlink() and inside(child, root):
                retained.append(name)
            else:
                report['excluded'].append({'path': child.relative_to(root).as_posix(), 'reason': 'Linked directory not scanned'})
        directories[:] = retained
        for name in files:
            path = base / name
            if path.suffix.lower() not in MODEL_EXTENSIONS:
                continue
            relative = path.relative_to(root).as_posix()
            if path.is_symlink() or not inside(path, root):
                report['excluded'].append({'path': relative, 'reason': 'Linked file not read'})
                continue
            found[relative] = {'path': relative, 'indexed': False}
    inventory = library / 'inventory.json'
    if inventory.is_file() and inside(inventory, root) and not inventory.is_symlink():
        report['inventory'] = inventory.relative_to(root).as_posix()
        try:
            if inventory.stat().st_size > JSON_LIMIT:
                raise ValueError('Inventory exceeds 16 MiB metadata limit')
            entries = json.loads(inventory.read_text(encoding='utf-8-sig'))
            if isinstance(entries, dict):
                entries = entries.get('models', entries.get('assets'))
            if not isinstance(entries, list):
                raise ValueError('Inventory must be an array or an object with models/assets array')
            for index, entry in enumerate(entries):
                value = entry.get('path') if isinstance(entry, dict) else None
                if not isinstance(value, str) or not value:
                    report['errors'].append(f'Inventory entry {index}: missing relative path')
                    continue
                normalized = value.replace('\\', '/')
                parts = normalized.split('/')
                if normalized.startswith('/') or PureWindowsPath(value).drive or '..' in parts or ':' in normalized:
                    report['excluded'].append({'inventoryEntry': index, 'path': value, 'reason': 'Absolute or traversal path rejected'})
                    continue
                normalized = PurePosixPath(normalized).as_posix()
                parts = normalized.split('/')
                path = (root if parts[0] == 'assets' else library) / normalized
                if not inside(path, root) or path.is_symlink():
                    report['excluded'].append({'inventoryEntry': index, 'path': value, 'reason': 'Linked path or path escapes project'})
                    continue
                relative = path.relative_to(root).as_posix()
                if not path.is_file():
                    report['missingIndexedFiles'].append({'path': relative, 'inventoryEntry': index})
                    continue
                if path.suffix.lower() not in MODEL_EXTENSIONS:
                    report['excluded'].append({'path': relative, 'reason': 'Unsupported model extension'})
                    continue
                found.setdefault(relative, {'path': relative})['indexed'] = True
        except (ValueError, OSError, UnicodeError) as error:
            report['errors'].append(f'Inventory: {error}')
    for relative, record in sorted(found.items()):
        path = root / relative
        record.update(bytes=path.stat().st_size, format=path.suffix[1:].lower(), status='candidate', licenseStatus='not_verified')
        sidecars = []
        parent = path.parent
        while parent != root:
            for name in ('source.json', 'README.md'):
                candidate = parent / name
                if candidate.is_file() and not candidate.is_symlink() and inside(candidate, root):
                    sidecars.append(candidate.relative_to(root).as_posix())
            if parent == library:
                break
            parent = parent.parent
        record['metadataFiles'] = sidecars
        if path.suffix.lower() == '.glb':
            try:
                record['glb'] = inspect_glb(path)
            except InspectionLimit as error:
                record['status'] = 'deferred'
                record['inspection'] = str(error)
            except (ValueError, OSError, UnicodeError, KeyError, TypeError, AttributeError, RecursionError) as error:
                record['status'] = 'invalid'
                record['errors'] = [str(error)]
        else:
            record['inspection'] = 'File discovered; format contents not inspected'
        report['models'].append(record)
    if found:
        report['libraryStatus'] = 'populated'
    report['summary'] = {'candidateModels': sum(m['status'] == 'candidate' for m in report['models']),
                         'indexedCandidates': sum(m['status'] == 'candidate' and m['indexed'] for m in report['models']),
                         'invalidModels': sum(m['status'] == 'invalid' for m in report['models']),
                         'deferredModels': sum(m['status'] == 'deferred' for m in report['models']),
                         'missingIndexedFiles': len(report['missingIndexedFiles']),
                         'excludedReferences': len(report['excluded'])}
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True, type=Path)
    parser.add_argument('--output', type=Path, help='New JSON report; existing files are never overwritten')
    args = parser.parse_args()
    try:
        result = scan(args.project)
        serialized = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
        if args.output:
            target = args.output.expanduser()
            if target.suffix.lower() != '.json' or target.name.lower() in {'inventory.json', 'source.json'}:
                raise ValueError('Choose a separate .json report, not inventory.json or source.json')
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('x', encoding='utf-8', newline='\n') as stream:
                stream.write(serialized)
        print(serialized, end='')
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
