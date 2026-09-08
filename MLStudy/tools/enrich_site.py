#!/usr/bin/env python3
"""Rebuild advanced numerical results, 28 figures and the executable notebook.
Use a Python environment with NumPy and Matplotlib. Does not render HTML.
"""

from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / 'i18n/source-downloads'
FIGURES = ROOT / 'assets/images/advanced'
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'hd2lab-matplotlib'))
subprocess.run(
    [
        sys.executable,
        str(DOWNLOADS / 'advanced-figures.py'),
        '--output',
        str(FIGURES),
        '--results',
        str(DOWNLOADS / 'advanced-results.json'),
    ],
    check=True,
)
results = json.loads((DOWNLOADS / 'advanced-results.json').read_text())
cells = []


def markdown(text):
    cells.append(dict(cell_type='markdown', metadata={}, source=text.splitlines(keepends=True)))


def code(text, outputs=()):
    cells.append(
        dict(
            cell_type='code',
            metadata={},
            execution_count=sum(c['cell_type'] == 'code' for c in cells) + 1,
            outputs=list(outputs),
            source=text.splitlines(keepends=True),
        )
    )


markdown(
    '# HD2Lab · 심화 머신러닝 실험\n\n7개 장의 21개 심화 사례와 28개 비교 그림. 모든 데이터는 합성입니다. NumPy와 Matplotlib이 필요합니다. 위에서 아래로 실행하면 표의 수치와 그림을 다시 계산합니다. 저장된 출력도 같은 코드로 계산한 스냅샷입니다. 기본 실험실의 데이터와는 다른 실험입니다.\n\n각 함수의 생성식·시드·정규화와 웹 본문의 가정을 함께 확인하세요. 숫자는 라이브러리 버전에 따라 마지막 자릿수가 달라질 수 있습니다.'
)
markdown('## 공통 계산 함수\nNumPy만 사용하는 회귀, EM, 쌍대 SVM과 장별 데이터 생성 함수입니다.')
engine = (DOWNLOADS / 'advanced-experiments.py').read_text().split("if __name__=='__main__':")[0]
code(engine)
markdown(
    '## 공통 그림 함수\n색상과 선·점 모양을 함께 쓰고, 각 축에 단위를 표시합니다. 그림 안 영문 기호는 웹 본문에서 한국어로 설명합니다.'
)
plots = (DOWNLOADS / 'advanced-figures.py').read_text().split('\ndef main():')[0]
code(plots + '\nfrom IPython.display import display, SVG\nfrom io import StringIO\n')
names = [
    '데이터·평가·누출',
    '회귀·정규화·불확실성',
    '최적화·기울기 검증·SGD',
    '확률·추론·의사결정',
    'PCA·단위·반례',
    'GMM·초기화·모델 선택',
    'SVM·KKT·비선형 특징',
]
for i, name in enumerate(names, 1):
    markdown(
        f'## {i:02} / {name}\n결과 JSON의 항목은 웹의 계산 표와 대응합니다. 아래 4개 그림은 사전 계산 출력이며 셀을 실행하면 재생성됩니다.'
    )
    outputs = [
        dict(
            output_type='stream',
            name='stdout',
            text=[json.dumps(results[str(i)], ensure_ascii=False, indent=2) + '\n'],
        )
    ]
    # Sort by the order of draw_chapter's additions, not alphabetically.
    order = {
        1: ['cycle', 'drift', 'leakage', 'threshold'],
        2: ['ridge', 'selection', 'curves', 'bootstrap'],
        3: ['paths', 'convergence', 'gradient', 'noise'],
        4: ['posterior', 'base-rate', 'predictive', 'decision'],
        5: ['spectrum', 'reconstruction', 'scaling', 'counterexample'],
        6: ['initialization', 'model-selection', 'responsibility', 'collapse'],
        7: ['boundaries', 'cost', 'kkt', 'feature-map'],
    }
    for slug in order[i]:
        svg = (FIGURES / f'{i:02}-{slug}.svg').read_text()
        outputs.append(
            dict(
                output_type='display_data',
                metadata={},
                data={'image/svg+xml': [svg], 'text/plain': ['HD2Lab calculated figure']},
            )
        )
    code(
        f'''result = EXPERIMENTS[{i - 1}]()
print(json.dumps(result['summary'], ensure_ascii=False, indent=2))
for name, fig in draw_chapter({i}, result):
    buffer = StringIO()
    fig.savefig(buffer, format='svg', metadata={{'Date': None, 'Creator': 'HD2Lab / Matplotlib'}})
    display(SVG(buffer.getvalue()))
    plt.close(fig)
''',
        outputs,
    )
for i, c in enumerate(cells):
    c['id'] = f'hd2lab-advanced-{i:02}'
nb = dict(
    cells=cells,
    metadata={
        'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
        'language_info': {'name': 'python', 'version': '3'},
    },
    nbformat=4,
    nbformat_minor=5,
)
(DOWNLOADS / 'advanced-experiments.ipynb').write_text(
    json.dumps(nb, ensure_ascii=False, indent=1) + '\n', encoding='utf-8'
)
print('Saved advanced results and notebook with 28 computed SVG outputs.')
