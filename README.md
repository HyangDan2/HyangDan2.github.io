# HD2Lab Web-HQ

HD2Lab HQ: the English-language entry point for EduHub and GameHub, with an About dialog and email contact. Research archives and education authoring documentation remain available in this repository.

[Live website](https://hyangdan2.github.io)

- [HQ](index.html)
- [EduHub](https://hyangdan2.github.io/EduHub/)
- [GameHub](https://hyangdan2.github.io/GameHub/)
- [Stock and ETF analysis](analysis.html)
- [Machine Learning Study — Korean](https://hyangdan2.github.io/EDPilot0001/)
- [Education authoring Harness Guide](docs/education-harness-guide.md)

MLStudy is now maintained and built independently in the sibling `EDPilot0001/`
project: [source repository](https://github.com/HyangDan2/EDPilot0001).
Its Korean-only site is deployed through that repository's GitHub Pages workflow.
Web-HQ retains the education authoring guide and the public site link.

Serve Web-HQ locally:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The HQ and analysis pages use static HTML,
CSS, and JavaScript and share `assets/favicon.svg`.
