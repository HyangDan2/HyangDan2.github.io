#!/usr/bin/env python3
"""Format authoring and generated source files; leave notebooks and SVG output intact."""

from pathlib import Path
import argparse
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def format_sources(check=False):
    files = sorted(
        p
        for p in ROOT.rglob('*')
        if p.is_file() and not {'node_modules', '__pycache__', '.git'}.intersection(p.parts)
    )
    web = [
        str(p)
        for p in files
        if p.suffix in {'.html', '.css', '.js', '.mjs', '.json'} and p.name != 'package-lock.json'
    ]
    python = [str(p) for p in files if p.suffix == '.py']
    subprocess.run(
        ['node', str(ROOT / 'tools/format_sources.mjs'), *(['--check'] if check else [])],
        input=json.dumps(web),
        text=True,
        check=True,
    )
    subprocess.run(
        [
            'ruff',
            'format',
            '--config',
            str(ROOT / 'ruff.toml'),
            *(['--check'] if check else []),
            *python,
        ],
        check=True,
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    format_sources(parser.parse_args().check)
