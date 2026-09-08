#!/usr/bin/env python3
"""Optional authoring helper. Output HTML works without Python or a build."""

from pathlib import Path
from html import escape
import json, subprocess, re
from content import CHAPTERS as FOUNDATION, table, note, eq
from content_more import CHAPTERS as MODELS, MATH_SECTIONS, GLOSSARY
from content_advanced import sections_for

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = FOUNDATION + MODELS
LABS = [
    dict(
        slug='regression',
        title='회귀 곡선 실험실',
        en='Regression studio',
        icon='ƒ',
        desc='차수와 정규화를 바꾸며 학습·검증 오차를 비교합니다.',
        chapter=1,
        fn='regression',
        primary='예측 곡선과 관측',
        secondary='잔차로 다시 보기',
        legend='● 학습 관측 · 주황 실선: 학습 곡선 · 회색 점선: 생성식 · 음영: 외삽',
        controls=[
            ('degree', '다항식 차수', 1, 9, 1, 3),
            ('n', '학습 표본 수', 12, 100, 4, 32),
            ('noise', '잡음 표준편차 (ms)', 0, 2, 0.1, 0.7),
            ('ridge', '정규화 α', 0, 5, 0.1, 0),
        ],
        notes='''<p>합성 부하 x ~ Uniform(0,1), 지연 y = 3 + 2x + 7x³ + ε, ε ~ N(0,σ²). 훈련 시드 1729, 검증 시드 1730, 검증 관측 120개. 브라우저는 Mulberry32와 Box–Muller 난수를 사용합니다.</p><p>기저는 z=2x−1의 0차부터 d차까지입니다. 잔차 제곱합 + αΣθⱼ²를 Householder QR로 최소화하며 절편은 벌점에서 제외합니다. 검증 오차는 0≤x≤1에서만 측정합니다. 음영 구간은 데이터가 없으므로 예측의 외삽입니다.</p><ol><li>표본 12개에서 1차, 3차, 9차를 비교하세요.</li><li>같은 데이터에 α를 늘리고 검증 오차가 개선되는지 확인하세요.</li><li>관측이 많아져도 외삽이 안전해지는지 곡선을 살펴보세요.</li></ol>''',
    ),
    dict(
        slug='gradient-descent',
        title='경사하강 경로 실험실',
        en='Optimization studio',
        icon='∇',
        desc='학습률과 곡률을 바꾸며 수렴과 진동을 관찰합니다.',
        chapter=2,
        fn='descent',
        primary='손실 지형 위의 이동',
        secondary='반복별 손실',
        legend='초록 큰 점: 시작 · 주황 선과 점: 이동 · 짙은 점: 최소점 · 옅은 타원: 등손실선',
        controls=[
            ('rate', '학습률 η', 0.01, 0.6, 0.01, 0.15),
            ('curvature', 'v 방향 곡률 κ', 1, 12, 1, 6),
            ('x', '시작 u', -4, 4, 0.5, 3),
            ('y', '시작 v', -3, 3, 0.5, 2),
            ('steps', '최대 갱신 수', 5, 100, 5, 45),
            ('scaled', '축 보정', False),
        ],
        notes='''<p>J(u,v) = (u²+κv²)/2. 보정하지 않은 갱신은 [u,v] ← [u,v]−η[u,κv]. 이 문제의 전역 수렴 범위는 0&lt;η&lt;2/max(1,κ)입니다. 축 보정은 기울기에 diag(1,1/κ)를 곱하므로 수렴 범위가 0&lt;η&lt;2로 바뀝니다.</p><p>좌표와 손실은 무차원입니다. 원래 좌표 창 밖의 경로는 잘라 표시하지만 손실 그래프는 log10 축으로 모든 실행 단계를 포함합니다. 손실이 10⁻¹⁰ 아래면 수렴, 10¹²를 넘으면 발산으로 중단합니다.</p><ol><li>κ=6에서 η=.15와 .4를 비교하세요.</li><li>같은 시작점과 학습률에서 축 보정을 켜 보세요.</li><li>원점에서 시작하면 종료 상태가 어떤 의미인지 확인하세요.</li></ol>''',
    ),
    dict(
        slug='pca',
        title='PCA 압축 실험실',
        en='Projection studio',
        icon='↗',
        desc='여섯 채널을 압축하고 보존 분산과 복원 오차를 확인합니다.',
        chapter=4,
        fn='pca',
        primary='관측과 복원 · 첫 두 채널',
        secondary='성분 수와 재구성 오차',
        legend='회색 원: 관측 · 초록 사각: 복원 · 아래 주황 점: 선택한 성분 수',
        controls=[
            ('k', '남길 성분 수', 1, 6, 1, 2),
            ('noise', '채널 잡음 σ', 0, 1, 0.05, 0.35),
            ('correlation', '잠재 요인 상관 ρ', 0, 0.95, 0.05, 0.8),
        ],
        notes='''<p>시드 431, 관측 180개. 독립 표준정규 a,b로 z₁=a, z₂=ρa+√(1−ρ²)b를 만들고 xⱼ=2Aⱼ₁z₁+Aⱼ₂z₂+σεⱼ를 생성합니다. A의 행은 [1,.1], [.8,.4], [−.4,.9], [.2,−.8], [.6,.6], [−.7,.2]입니다. εⱼ는 독립 표준정규이며 모든 값은 무차원입니다.</p><p>중심화한 6×6 공분산을 대칭 Jacobi 고유분해로 풉니다. 공분산 분모는 N, 표시 오차는 관측당 특징 오차 제곱합입니다. 주황 점의 오차와 버린 고유값 합을 비교하며, 전체 6채널에서 복원한 결과 중 첫 두 채널만 그림에 표시합니다.</p><ol><li>성분 1개와 2개를 비교하세요.</li><li>6개 성분에서 복원 오차를 확인하세요.</li><li>잡음을 늘리고 큰 설명분산이 깨끗한 신호 복원을 보장하는지 생각해 보세요.</li></ol>''',
    ),
    dict(
        slug='clustering',
        title='GMM 군집 실험실',
        en='Mixture studio',
        icon='∴',
        desc='초기화와 반복 횟수를 바꾸며 소속 확률을 관찰합니다.',
        chapter=5,
        fn='clustering',
        primary='성분 타원과 소속',
        secondary='EM 로그우도',
        legend='색·원/사각: 최대 책임값 성분 · 타원: 성분별 Mahalanobis 거리 2 · 번호는 임의',
        controls=[
            ('k', '성분 수 K', 1, 4, 1, 3),
            ('steps', '최대 EM 갱신', 0, 60, 1, 20),
            ('seed', '초기화 시드', 1, 60, 1, 29),
        ],
        notes='''<p>240개 합성 요청, 데이터 시드 812. 성분 비율 [.45,.35,.20]. 독립 표준정규 a,b로 각 성분을 [−1.4+.65a, −.5+.5a+.6b], [1.2+.7a,1.1−.35a+.45b], [.7+.4a,−1.35+.7b]에서 생성합니다. 좌표는 표준화된 요청 특징을 가정하는 무차원 값입니다.</p><p>초기 평균은 관측에서 선택하고 초기 공분산은 전체 표본 공분산, 초기 혼합비는 균등합니다. 완전 공분산 EM을 사용하며 대각에 10⁻⁶을 더합니다. 로그우도 증가량 절댓값이 10⁻⁶ 아래면 종료합니다. 감소가 10⁻⁵를 넘거나 비정상 수치가 있으면 갱신하지 않고 중단합니다.</p><p>책임값이 가장 큰 성분으로 색칠하지만 소속을 확정한 것은 아닙니다. 최대 책임값 0.7 미만인 관측 수를 함께 표시합니다. 이 기준은 관찰을 위한 값이며 모델의 정확도를 뜻하지 않습니다. 로그우도는 현재 관측의 적합도이며 최종 예측 성능이 아닙니다.</p>''',
    ),
]
LABS.append(
    dict(
        slug='svm',
        title='SVM 분류 경계 실험실',
        en='Margin studio',
        icon='±',
        desc='C와 데이터 조건을 바꾸며 경계·마진·서포트 벡터를 확인합니다.',
        chapter=6,
        fn='svmExperiment',
        primary='학습 관측과 결정 경계',
        secondary='원·쌍대 목적값과 수렴',
        legend='초록 원: −1 · 주황 사각: +1 · 짙은 실선: 결정 경계 · 점선: f=±1 · 원 테두리: 서포트 벡터 · 보라 테두리: 추가 이상치',
        controls=[
            ('logC', 'C = 10의 지수', -2, 1, 0.25, 0),
            ('overlap', '클래스 겹침 σ', 0, 1.5, 0.05, 0.65),
            ('featureScale', '두 번째 특징 배율', 1, 8, 1, 1),
            ('seed', '데이터 시드', 1, 60, 1, 17),
            ('standardize', '훈련 기준 표준화', True),
            ('outlier', '이상치 추가', False),
        ],
        notes="""<p>선형 soft-margin SVM의 목적은 ½‖w‖² + CΣmax(0,1−yᵢ(wᵀxᵢ+b))입니다. 절편에는 벌점을 주지 않습니다. C는 .01~10이며 위 슬라이더는 log10(C)를 조절합니다. 커널은 사용하지 않습니다.</p><p>균형 라벨 −1,+1 각각 24개로 훈련하고, 독립 시드의 160개로 검증합니다. 독립 표준정규 a,b에서 x₁=1.15y+σa, x₂=s(.55y+.3a+.8b)를 생성합니다. 모두 무차원 합성 특징입니다. 훈련 시드는 선택한 값, 검증 시드는 그 값+10000입니다. 이상치를 켜면 훈련에 좌표 [−2.6,−1.6s], 라벨 +1을 하나 추가합니다.</p><p>표준화는 훈련 관측의 평균·표준편차만 사용합니다. 그래프는 비교를 위해 항상 원래 특징 좌표로 환산해 표시합니다. 마진 폭 2/‖w‖는 학습 좌표의 거리이므로 표준화 전후 수치를 같은 단위로 비교하면 안 됩니다. 특징 배율만 바꾸고 표준화하면 같은 예측이 나오는지 확인해 보세요.</p><p>두 쌍대 계수를 함께 갱신해 Σαᵢyᵢ=0과 0≤αᵢ≤C를 유지합니다. 최대 8000회 갱신, 상대 원·쌍대 차이 ≤10⁻⁵와 KKT 위반 ≤10⁻³일 때 수렴으로 표시합니다. 미수렴 결과는 현재 반복의 근사치입니다. 테두리는 αᵢ&gt;10⁻⁷인 관측이며 soft margin에서는 마진 내부나 오분류 관측도 포함할 수 있습니다.</p><ol><li>겹침을 낮춘 뒤 C에 따른 마진을 비교하세요.</li><li>이상치를 추가하고 C를 크게 해 경계 변화를 보세요.</li><li>특징 배율을 높인 뒤 표준화를 켜고 끄세요.</li><li>정확도와 혼동행렬을 함께 읽으세요. 반복 비교하는 검증 정확도는 최종 테스트 성능이 아닙니다.</li></ol>""",
    )
)


def header(prefix):
    return f'''<a class="skip" href="#content">본문으로 건너뛰기</a><header class="site-header"><div class="wrap header-inner"><a class="brand" href="{prefix}main.html" aria-label="HD2Lab 홈"><i aria-hidden="true"></i>HD2Lab<small>LEARNING ARCHIVE</small></a><nav class="site-nav" aria-label="주 메뉴"><a href="{prefix}main.html#curriculum">학습 목차</a><a href="{prefix}main.html#labs">실험실</a><a href="{prefix}appendix/references.html">참고자료</a></nav></div></header>'''


def page(
    path, title, body, scripts=(), description='수학에서 모델까지, HD2Lab의 개인적인 머신러닝 공부.'
):
    prefix = '../' if '/' in path else ''
    footer = f'''<footer class="footer"><div class="wrap footer-inner"><div class="brand">HD2Lab<small>LEARNING ARCHIVE</small></div><p>개념을 연결하고, 계산으로 확인하는 학습 기록.<br>합성 데이터 · 직접 작성한 설명과 실험</p><a href="{prefix}appendix/references.html">참고자료 및 제작 정보 ↗</a></div></footer>'''
    html = f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{escape(description, quote=True)}"><meta name="theme-color" content="#18312e"><title>{escape(title)} | HD2Lab</title><link rel="icon" type="image/svg+xml" href="{prefix}../assets/favicon.svg"><link rel="stylesheet" href="{prefix}assets/css/base.css"><script defer src="{prefix}assets/js/navigation.js"></script>{''.join(f'<script defer src="{prefix}assets/js/{s}"></script>' for s in scripts)}</head><body>{header(prefix)}{body}{footer}</body></html>'''
    target = ROOT / 'i18n/source-html' / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding='utf-8')


def hero(title, en, desc, meta=()):
    return f'''<div class="page-hero"><div class="wrap"><div class="eyebrow">{en}</div><h1>{title}</h1><p>{desc}</p><div class="meta">{''.join(f'<span>{m}</span>' for m in meta)}</div></div></div>'''


def article(path, title, en, desc, sections, meta=(), tail='', sources='mml'):
    toc = (
        '<details class="toc" open><summary>이 페이지의 흐름</summary><ol>'
        + ''.join(f'<li><a href="#{id}">{heading}</a></li>' for id, heading, _ in sections)
        + '</ol></details>'
    )
    body = (
        hero(title, en, desc, meta)
        + '<main tabindex="-1" id="content" class="wrap article-layout">'
        + toc
        + '<article>'
        + ''.join(
            f'<section id="{id}"><h2>{heading}</h2>{text}</section>'
            for id, heading, text in sections
        )
    )
    body += (
        f'<p class="sources">더 읽기: <a href="../appendix/references.html#{sources}">관련 개념의 참고자료</a> · <a href="../appendix/glossary.html">용어와 기호</a></p><button class="print-button" type="button" data-print>이 페이지 인쇄 / PDF 저장</button>'
        + tail
        + '</article></main>'
    )
    page(path, title, body, description=desc)


def figure(svg, caption):
    return (
        '<figure class="figure" tabindex="0" aria-label="계산 결과 그래프. 좁은 화면에서는 좌우로 스크롤">'
        + svg
        + '<figcaption>'
        + caption
        + '</figcaption></figure>'
    )


def main():
    defaults = json.loads(
        subprocess.check_output(
            [
                'node',
                '-e',
                """const f=require('./i18n/source-js/figures.js');const out={};for(const n of ['regression','descent','pca','clustering','svmExperiment']){const d=f[n]();delete d.data;out[n]=d;}out.svm=f.svm();console.log(JSON.stringify(out));""",
            ],
            cwd=ROOT,
            text=True,
        )
    )
    # All overview art is authored SVG. The diagram illustrates relationships, not data.
    art = '''<svg viewBox="0 0 450 330" role="img" aria-label="관측을 모델로 연결하고 실험 결과로 되돌아오는 학습 구조"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#3c574e"/></pattern></defs><rect width="450" height="330" fill="url(#dots)"/><path d="M70 150L225 85L380 150L225 250Z M70 150H380M225 85V250" stroke="#658a74" fill="none"/><ellipse cx="225" cy="160" rx="105" ry="65" fill="none" stroke="#99ba83" transform="rotate(-25 225 160)"/><ellipse cx="225" cy="160" rx="105" ry="65" fill="none" stroke="#577c68" transform="rotate(25 225 160)"/><g fill="#d5eb99"><circle cx="70" cy="150" r="7"/><circle cx="225" cy="85" r="7"/><circle cx="380" cy="150" r="7"/><circle cx="225" cy="250" r="7"/><circle cx="225" cy="160" r="12"/></g><g fill="#ebf3df" font-family="monospace" font-size="12" text-anchor="middle"><text x="70" y="130">DATA</text><text x="225" y="58">MATHEMATICS</text><text x="380" y="130">MODEL</text><text x="225" y="280">EXPERIMENT</text></g></svg>'''
    cards = ''.join(
        f'''<a class="card" href="chapters/{c['slug']}.html"><span class="num">CHAPTER {i + 1:02}</span><span class="arrow" aria-hidden="true">↗</span><h3>{c['title']}</h3><p>{c['question']}</p><span class="tags">{c['tags']}</span></a>'''
        for i, c in enumerate(CHAPTERS)
    )
    labs = ''.join(
        f'''<a class="lab-card" href="labs/{l['slug']}.html"><span class="lab-icon" aria-hidden="true">{l['icon']}</span><div><h3>{l['title']}</h3><p>{l['desc']}</p></div></a>'''
        for l in LABS
    )
    body = f'''<main tabindex="-1" id="content"><section class="hero wrap"><div class="hero-grid"><div><div class="eyebrow">HD2Lab / Study collection 01</div><h1>개인적인<br>머신러닝 공부<span style="color:var(--teal)">.</span></h1><p class="lead">수학에서 모델까지,<br>설명하고 실험하는 학습 기록.</p><p class="muted">공식의 의미를 연결하고, 심화 사례와 비교 그림으로 확인합니다.<br>예측 · 최적화 · 확률 · 압축 · 군집 · 분류</p><div class="hero-actions"><a class="button" href="chapters/01-data-and-models.html">첫 장부터 읽기 <span aria-hidden="true">↗</span></a><a class="button secondary" href="#labs">실험부터 시작하기</a></div><div class="stats"><div><strong>07</strong><span>연결된 학습 장</span></div><div><strong>21</strong><span>심화 계산 사례</span></div><div><strong>28</strong><span>새 비교 도표</span></div></div></div><div class="hero-art"><div class="eyebrow">From observation to understanding</div>{art}<p>관측 → 수학적 표현 → 모델 → 실험 → 새로운 질문</p></div></div></section>
<section id="curriculum" class="section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">01 / Learning path</div><h2>하나의 질문에서, 다음 개념으로.</h2></div><p>각 장은 기초부터 심화 사례 3개로 이어집니다. 단계별 풀이와 새 비교 도표 4개로 실패 사례·조건 변화·해석의 한계를 살펴봅니다.</p></div><div class="card-grid">{cards}<a class="card" href="appendix/mathematics.html"><span class="num">REFERENCE NOTES</span><span class="arrow" aria-hidden="true">↗</span><h3>수학을 다시 펼치기</h3><p>기저와 투영부터 행렬 분해, 확률과 제약 최적화까지.</p><span class="tags">계산 예제 · 유도 · 복습</span></a><a class="card" href="appendix/glossary.html"><span class="num">LANGUAGE OF MODELS</span><span class="arrow" aria-hidden="true">↗</span><h3>용어와 기호</h3><p>같은 단어의 다른 의미를 구분하고 수식의 기호를 확인합니다.</p><span class="tags">25개 용어 · 공통 표기</span></a></div></div></section>
<section id="labs" class="section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">02 / Interactive experiments</div><h2>설정을 바꾸면, 이해도 달라집니다.</h2></div><p>모든 계산은 이 브라우저 안에서 실행됩니다. 같은 설정은 같은 결과를 만들며, 관찰 조건과 해석의 범위를 함께 표시합니다.</p></div><div class="lab-grid">{labs}</div></div></section>
<section class="section"><div class="wrap two-col"><div><div class="eyebrow">03 / How to study</div><h2>먼저 예상하고,<br>계산한 뒤 설명하기.</h2><p class="muted">Python 배열 기초를 알고 있다면 첫 장부터 시작하세요. 수학이 낯설면 부록을 곁에 두고, 결과를 본 뒤 예상과 달랐던 이유를 적어 보세요.</p></div><div class="note"><strong>이 자료의 구성</strong><p>설명과 예제는 이 사이트를 위해 새로 작성했습니다. 합성 데이터로 모델을 계산하고, 조건을 바꿔 비교합니다. 5개 브라우저 실험실과 실행 결과가 담긴 심화 Notebook을 제공합니다. 관측 조건, 해석의 한계, 참고 문헌과 코드 검증 방법을 함께 제공합니다.</p><a href="appendix/references.html">참고자료 · 제작 및 재현 정보 ↗</a></div></div></section></main>'''
    page('main.html', '개인적인 머신러닝 공부', body)
    (ROOT / 'i18n/source-html/index.html').write_text(
        '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=main.html"><title>HD2Lab 학습 자료</title><link rel="icon" type="image/svg+xml" href="../assets/favicon.svg"></head><body><p><a href="main.html">HD2Lab · 개인적인 머신러닝 공부로 이동</a></p></body></html>''',
        encoding='utf-8',
    )
    source_ids = ['evaluation', 'linear', 'mml', 'probability', 'pca', 'gmm', 'svm']
    for i, c in enumerate(CHAPTERS):
        sections = list(c['sections'])
        if c['lab']:
            lab = next(l for l in LABS if l['slug'] == c['lab'])
            snap = defaults[lab['fn']]
            sid, heading, text = sections[-1]
            text = (
                figure(
                    snap['svg'],
                    '기본 설정에서 직접 계산한 결과. 아래 실험실에서 설정을 변경할 수 있습니다.',
                )
                + text
            )
            text += (
                f'<a class="callout-link" href="../labs/{c["lab"]}.html">{lab["title"]} 열기 →</a>'
            )
            sections[-1] = (sid, heading, text)
        if i == 6:
            sid, heading, text = sections[2]
            sections[2] = (
                sid,
                heading,
                text
                + figure(
                    defaults['svm'],
                    '해석적으로 구한 경계 x₁=0과 두 마진 x₁=±1. 좌표는 표준화 특징.',
                ),
            )
        advanced = sections_for(i + 1)
        sid, heading, text = sections[0]
        text += (
            '<nav class="study-route" aria-label="심화 학습 바로가기"><strong>기본 개념 다음에는 심화 사례 3개 · 새 도표 4개</strong>'
            + ''.join(f'<a href="#{key}">{title}</a>' for key, title, _ in advanced)
            + '</nav>'
        )
        sections[0] = (sid, heading, text)
        sections.extend(advanced)
        prev = f'{CHAPTERS[i - 1]["slug"]}.html' if i else '../main.html'
        nextpath = f'{CHAPTERS[i + 1]["slug"]}.html' if i < 6 else '../appendix/mathematics.html'
        tail = f'<nav class="next-prev" aria-label="학습 순서"><a href="{prev}">← 이전: {CHAPTERS[i - 1]["title"] if i else "전체 목차"}</a><a href="{nextpath}">다음: {CHAPTERS[i + 1]["title"] if i < 6 else "수학 부록"} →</a></nav>'
        article(
            f'chapters/{c["slug"]}.html',
            c['title'],
            f'Chapter {i + 1:02} / {c["en"]}',
            c['question'] + ' ' + c['desc'],
            sections,
            [c['prereq'], c['tags'], '심화 사례 3 · 새 도표 4'],
            tail,
            source_ids[i],
        )
    for l in LABS:
        controls = ''
        for control in l['controls']:
            name, label, *rest = control
            if len(rest) == 1:
                controls += f'<div class="control"><label for="{name}"><input id="{name}" name="{name}" type="checkbox" {"checked" if rest[0] else ""} disabled> {label}</label></div>'
            else:
                lo, hi, step, value = rest
                controls += f'<div class="control"><label for="{name}">{label}<output for="{name}">{value}</output></label><input id="{name}" name="{name}" type="range" min="{lo}" max="{hi}" step="{step}" value="{value}" disabled></div>'
        snap = defaults[l['fn']]
        body = hero(
            l['title'], l['en'], l['desc'], ['합성 데이터', '브라우저 계산', '재현 가능한 설정']
        )
        body += f'''<main tabindex="-1" id="content" class="wrap"><div class="lab-layout"><form class="controls" data-lab="{l['slug']}" aria-label="실험 설정">{controls}<button type="reset" disabled>기본 설정으로 초기화</button></form><div><p class="eyebrow" id="mode">기본 설정의 사전 계산 결과 {snap.get("state", "")}</p><div id="metrics" class="metrics">{snap['metrics']}</div><div class="plot-panel"><h2>{l['primary']}</h2><p class="scroll-hint">그래프를 좌우로 이동해 축과 값을 읽을 수 있습니다.</p><div id="primary-plot" class="graph-scroll" tabindex="0" aria-label="주 그래프, 좌우 스크롤 가능">{snap['svg']}</div><p class="legend">{l['legend']}</p></div><div class="plot-panel"><h2>{l['secondary']}</h2><div id="secondary-plot" class="graph-scroll" tabindex="0" aria-label="보조 그래프, 좌우 스크롤 가능">{snap['secondary']}</div></div><div id="experiment-details">{snap.get("details", "")}</div><p id="status" class="experiment-status" role="status" aria-live="polite">{snap['status']}</p><noscript><p class="note">JavaScript가 꺼져 있습니다. 위 그림은 기본 설정의 계산 결과이며 설정을 바꾸려면 JavaScript가 필요합니다.</p></noscript></div></div><section class="lab-notes"><h2>실험 조건과 읽는 방법</h2>{l['notes']}<a class="callout-link" href="../chapters/{CHAPTERS[l['chapter']]['slug']}.html">관련 개념과 유도 읽기 →</a><p class="sources"><a href="../assets/js/math-core.js" download>계산 코드 다운로드</a> · <a href="../appendix/references.html#reproduce">구현·검증 정보</a></p></section></main>'''
        page(
            f'labs/{l["slug"]}.html',
            l['title'],
            body,
            ['math-core.js', 'svm-core.js', 'figures.js', 'labs.js'],
        )
    article(
        'appendix/mathematics.html',
        '수학을 다시 펼치기',
        'Appendix / Mathematical notes',
        '본문의 수학을 작은 계산과 함께 정리합니다. 가정과 조건을 확인하며 읽어 보세요.',
        MATH_SECTIONS,
        ['6개 수학 주제', '복습 문제'],
    )
    glossary_sections = [
        (
            'symbols',
            '공통 기호',
            table(
                ['기호', '뜻'],
                [
                    ['N, D', '표본 수, 특징 수'],
                    ['X, xᵢ', '관측 행렬, i번째 관측의 열벡터'],
                    ['θ, w, b', '모델 파라미터, 가중치, 스칼라 절편'],
                    ['Φ', '기저 변환을 적용한 설계행렬'],
                    ['μ, Σ, σ²', '평균, 공분산, 분산'],
                    ['λ, σⱼ', '문맥에 따라 고유값·승수, j번째 특잇값'],
                    ['η, α, C', '학습률, 회귀 벌점, SVM 침범 비용'],
                    ['K, k', '혼합 성분 수, PCA에서 선택한 성분 수'],
                    ['ᵀ, ‖·‖F', '전치, Frobenius 노름'],
                ],
            )
            + note(
                '기호는 문맥과 함께',
                'Σ는 공분산 또는 합 기호처럼 모양이 겹칠 수 있습니다. 각 식의 정의를 먼저 확인하세요. SVD의 Σ는 특잇값 행렬입니다.',
            ),
        ),
        ('terms', '용어 사전', table(['용어', '설명'], GLOSSARY)),
    ]
    article(
        'appendix/glossary.html',
        '용어와 기호',
        'Appendix / Glossary',
        '읽다가 멈춘 단어를 다시 확인하는 작은 사전.',
        glossary_sections,
        ['25개 용어'],
    )
    references = [
        (
            'mml',
            '수학적 배경',
            '''<p><a href="https://mml-book.github.io/">Mathematics for Machine Learning — 저자 공식 사이트</a><br>Marc Peter Deisenroth, A. Aldo Faisal, Cheng Soon Ong, Cambridge University Press, 2020.</p><p>선형대수, 기하, 행렬 분해, 미분, 확률, 최적화를 더 깊이 공부하기 위한 문헌입니다. 이 사이트의 문장·예제·코드·그림은 별도로 작성했으며 교재의 도표나 연습문제를 복제하지 않았습니다.</p>''',
        ),
        (
            'evaluation',
            '평가와 데이터 누출',
            '''<p><a href="https://scikit-learn.org/stable/common_pitfalls.html">scikit-learn 공식 문서: Common pitfalls</a>와 <a href="https://scikit-learn.org/stable/modules/model_evaluation.html">Model evaluation</a>. 훈련에서만 전처리를 적합하는 원칙, 평가 지표와 누출 개념을 확인합니다. 본문의 시간 변화·사후 특징·비용 사례는 별도 설계한 합성 실험입니다.</p>''',
        ),
        (
            'probability',
            '확률분포와 수치 확인',
            '''<p><a href="https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.beta.html">SciPy 공식 문서: Beta distribution</a>. 밀도 정의와 CDF·분위수의 의미를 확인합니다. Beta–Bernoulli 갱신과 가우시안 예측 분산은 본문에서 유도했으며 다운로드 계산에는 SciPy를 사용하지 않습니다.</p>''',
        ),
        (
            'linear',
            '회귀와 정규화',
            '''<p><a href="https://scikit-learn.org/stable/modules/linear_model.html">scikit-learn 공식 문서: Linear Models</a>. 최소제곱과 Ridge 목적함수, 특징 확장과 구현 참고. 브라우저는 scikit-learn을 호출하지 않고 직접 작성한 QR 계산을 사용합니다.</p>''',
        ),
        (
            'pca',
            'PCA와 행렬 분해',
            '''<p><a href="https://scikit-learn.org/stable/modules/decomposition.html#pca">scikit-learn 공식 문서: PCA</a>. 중심화, 설명분산, 압축의 개념과 실제 라이브러리 사용을 비교할 때 참고하세요.</p>''',
        ),
        (
            'gmm',
            '혼합모형과 EM',
            '''<p><a href="https://scikit-learn.org/stable/modules/mixture.html">scikit-learn 공식 문서: Gaussian mixture models</a>. 공분산 형태와 혼합모형의 적합, 성분 수 선택에 관한 구현 참고입니다.</p>''',
        ),
        (
            'svm',
            '분류와 마진',
            '''<p><a href="https://scikit-learn.org/stable/modules/svm.html">scikit-learn 공식 문서: Support Vector Machines</a>. 선형·커널 SVM과 결정 함수의 사용법을 확인할 수 있습니다.</p>''',
        ),
        (
            'reproduce',
            '제작과 재현',
            '''<p>HD2Lab의 학습 아카이브를 위해 설명·합성 사례·JavaScript 계산·SVG 도표를 새로 작성했습니다. AI 작성 지원을 사용했으며 공개 문헌 대조, 계산 테스트와 화면 검증으로 검토합니다. 개인의 학습 경험이나 실제 서비스 수행 이력을 대신 작성하지 않습니다.</p><p>브라우저 런타임 의존성은 없습니다. 수식은 HTML의 위·아래첨자와 유니코드로 표현하며, 그래프는 SVG입니다. 실험은 모두 로컬에서 실행되고 입력을 전송하거나 저장하지 않습니다. JavaScript가 꺼지면 기본 설정에서 계산한 정적 결과를 표시합니다.</p><p><a href="../downloads/study-examples.py" download>7개 장 Python 예제 다운로드</a> · <a href="../downloads/study-examples.ipynb" download>Jupyter Notebook 다운로드</a> · <a href="../assets/js/math-core.js" download>브라우저 수치 코드</a></p><p><a href="../downloads/advanced-experiments.ipynb" download>심화 Notebook · 28개 그림 출력</a> · <a href="../downloads/advanced-experiments.py" download>심화 계산 Python</a> · <a href="../downloads/advanced-figures.py" download>그림 재생성 Python</a> · <a href="../downloads/advanced-results.json" download>심화 수치 결과</a></p><p>심화 그림 28개는 NumPy 2.2.6과 Matplotlib 3.10.5로 사전 계산한 SVG입니다. Notebook의 모든 셀을 실행하면 같은 실험과 그림을 다시 생성합니다. Matplotlib은 제작 도구이며 웹 런타임에는 포함하지 않습니다. <a href="https://matplotlib.org/stable/project/license.html">Matplotlib 라이선스</a> · <a href="https://numpy.org/doc/stable/license.html">NumPy 라이선스</a>.</p><p>Python 계산 예제에는 NumPy, 심화 그림 재생성에는 Matplotlib도 필요합니다. Python과 JavaScript는 난수 생성기가 달라 같은 숫자의 시드라도 표본은 일치하지 않습니다. 별도 검증에서는 브라우저가 생성한 동일한 배열을 NumPy에 전달해 계산을 비교합니다.</p><p>참고 링크 확인: 2026-09-08. 외부 의존 코드·폰트·이미지를 번들하지 않았습니다. 공개 문헌의 저작권은 각 저작권자에게 있으며 이 사이트 전체에 대한 이용허락은 별도로 정하지 않았습니다.</p>''',
        ),
    ]
    article(
        'appendix/references.html',
        '참고자료와 제작 정보',
        'Appendix / References',
        '표준 개념의 근거와 이 사이트의 작성·계산 범위를 정리합니다.',
        references,
        ['공식 문헌', '재현 정보'],
    )
    examples = []
    for c in CHAPTERS:
        for _, _, html in c['sections']:
            from html import unescape

            examples.extend(
                (c['title'], unescape(s))
                for s in re.findall(r'<pre><code>(.*?)</code></pre>', html, re.S)
            )
    (ROOT / 'i18n/source-downloads/study-examples.py').write_text(
        '# HD2Lab: independent worked examples. Requires NumPy.\n'
        + ''.join('\n# ' + title + '\n' + snippet + '\n' for title, snippet in examples),
        encoding='utf-8',
    )
    cells = [
        dict(
            cell_type='markdown',
            metadata={},
            source=[
                '# HD2Lab · 개인적인 머신러닝 공부\n',
                'NumPy로 실행하는 장별 예제. 브라우저 실험과 난수 생성기가 다르므로 표본은 다릅니다.',
            ],
        )
    ]
    for title, snippet in examples:
        cells.extend(
            [
                dict(cell_type='markdown', metadata={}, source=['## ' + title]),
                dict(
                    cell_type='code',
                    metadata={},
                    execution_count=None,
                    outputs=[],
                    source=snippet.splitlines(keepends=True),
                ),
            ]
        )
    notebook = dict(
        cells=cells,
        metadata={
            'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
            'language_info': {'name': 'python', 'version': '3'},
        },
        nbformat=4,
        nbformat_minor=5,
    )
    for i, cell in enumerate(cells):
        cell['id'] = f'hd2lab-{i:02}'
    (ROOT / 'i18n/source-downloads/study-examples.ipynb').write_text(
        json.dumps(notebook, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print('Rendered 17 canonical HTML pages + Python/Notebook examples.')


if __name__ == '__main__':
    main()
    import sys

    if '--source-only' not in sys.argv:
        from localize_site import build

        build()
