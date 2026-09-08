# HD2Lab Web-HQ

Personal portfolio and static research / learning libraries.

[Live website](https://hyangdan2.github.io)

- [Portfolio](index.html)
- [Stock and ETF analysis](analysis.html)
- [Machine Learning Study](MLStudy/index.html) — English by default, with Korean and Japanese editions and light/dark themes.
- [MLStudy documentation](MLStudy/README.md)

Serve the repository root locally:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. MLStudy pages include a return link to Web-HQ. The site uses static HTML, CSS, and JavaScript; no build is needed for browsing.

To regenerate MLStudy pages after editing their sources, see [the authoring guide](MLStudy/harnessguide.md).

All pages share [assets/favicon.svg](assets/favicon.svg), referenced relative to each HTML file. MLStudy source formatting and build prerequisites are documented in its authoring guide. Its current deployment bundle is `output/hd2lab-webhq-site/`, containing `MLStudy/` and `assets/` for installation at the Web-HQ repository root.
