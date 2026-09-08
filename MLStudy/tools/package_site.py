#!/usr/bin/env python3
"""Create an allowlisted GitHub Pages folder and zip. Never include source PDFs."""

from pathlib import Path
import hashlib, json, shutil, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output'
DEST = OUT / 'hd2lab-webhq-site'
files = [ROOT / 'index.html', ROOT / 'main.html']
for folder in ['chapters', 'labs', 'appendix']:
    files.extend(sorted((ROOT / folder).glob('*.html')))
files.extend(
    ROOT / p
    for p in [
        'assets/css/base.css',
        'assets/js/navigation.js',
        'assets/js/preferences.js',
        'assets/js/entry.js',
        'assets/js/math-core.js',
        'assets/js/svm-core.js',
        'assets/js/figures.js',
        'assets/js/labs.js',
        'downloads/study-examples.py',
        'downloads/study-examples.ipynb',
    ]
)
files.extend(sorted((ROOT / 'assets/images/advanced').glob('*.svg')))
files.extend(
    ROOT / 'downloads' / p
    for p in [
        'advanced-experiments.py',
        'advanced-figures.py',
        'advanced-experiments.ipynb',
        'advanced-results.json',
    ]
)
for lang in ('ko', 'ja'):
    for folder, pattern in [
        ('', '*.html'),
        ('chapters', '*.html'),
        ('labs', '*.html'),
        ('appendix', '*.html'),
        ('assets/js', '*.js'),
        ('downloads', '*.py'),
        ('downloads', '*.ipynb'),
        ('downloads', '*.json'),
    ]:
        files.extend(sorted((ROOT / lang / folder).glob(pattern)))
files.append(ROOT.parent / 'assets/favicon.svg')
expected = {str(p.relative_to(ROOT.parent)) for p in files} | {'.nojekyll', 'manifest.json'}
if DEST.exists():
    unexpected = {str(p.relative_to(DEST)) for p in DEST.rglob('*') if p.is_file()} - expected
    if unexpected:
        raise SystemExit(
            'Unexpected files in managed output; review before packaging: ' + str(unexpected)
        )
DEST.mkdir(parents=True, exist_ok=True)
manifest = {}
for p in files:
    if not p.is_file():
        raise SystemExit('Missing runtime file: ' + str(p))
    relative = p.relative_to(ROOT.parent)
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(p, target)
    manifest[str(relative)] = hashlib.sha256(p.read_bytes()).hexdigest()
(DEST / '.nojekyll').write_text('')
(DEST / 'manifest.json').write_text(
    json.dumps({'project': 'HD2Lab', 'files_sha256': manifest}, indent=2) + '\n'
)
zip_path = OUT / 'hd2lab-webhq-static.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in sorted(expected):
        z.write(DEST / name, name)
with zipfile.ZipFile(zip_path) as z:
    assert set(z.namelist()) == expected
    assert not any(name.lower().endswith('.pdf') for name in z.namelist())
    assert z.testzip() is None
print(
    json.dumps(
        {
            'folder': str(DEST),
            'zip': str(zip_path),
            'files': len(expected),
            'bytes': zip_path.stat().st_size,
        }
    )
)
