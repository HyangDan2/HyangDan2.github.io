# HD2Lab Web-HQ

Personal portfolio, research archive, and education authoring documentation.

[Live website](https://hyangdan2.github.io)

- [Portfolio](index.html)
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

Open `http://localhost:8000/`. The portfolio and analysis pages use static HTML,
CSS, and JavaScript and share `assets/favicon.svg`.
