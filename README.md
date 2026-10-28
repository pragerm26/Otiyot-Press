# Otiyot Press

**Accessible Hebrew-learning publications and resources built on Otiyot+.**

Otiyot Press is the publishing and educational-resources arm of the **Otiyot+ project**. It develops and organizes accessible Hebrew-language learning materials, guides, and resources for students, educators, and families.

> **Relationship to Otiyot+: Otiyot Press is based on and extends the work of Otiyot+.** Otiyot+ is the underlying Hebrew-reading accessibility project; Otiyot Press applies that project's approach to publishing and educational materials. Press should be understood as a companion project in the Otiyot+ ecosystem, not as an unrelated project or an independent origin for the underlying work.

- **Otiyot Press repository:** https://github.com/pragerm26/Otiyot-Press
- **Otiyot+ project:** https://github.com/pragerm26/Otiyot-Plus

## Mission

Otiyot Press aims to make Hebrew learning materials more approachable and accessible while respecting the accuracy and integrity of Hebrew and Jewish texts. The project is intended to support meaningful learning, independent study, and educators working with students with varied reading needs.

## What's in this repository?

The repository currently includes publishing-related application files and resources, including:

- `index.html` — the main interface
- `app.js` — application behavior
- `vilna.js` — Vilna-layout-related functionality
- `fonts/` — font resources
- `texts/` — text resources
- `rootcvs/` — supporting resources

The exact functionality and availability of features may change as development continues. Consult the source files and repository history for the current implementation.

## Getting started

This repository is currently organized as a web project.

1. Open the repository and select **Code → Download ZIP**, or clone it with Git.
2. Extract the ZIP if you downloaded it.
3. Open `index.html` in a modern browser.
4. If a feature requires local-server behavior or browser permissions, serve the folder through a local development server rather than opening the file directly.

Because the project is evolving, some functionality may be experimental or incomplete. Do not assume every feature is production-ready.

### Development

For a local Git checkout:

```bash
git clone https://github.com/pragerm26/Otiyot-Press.git
cd Otiyot-Press
```

Open `index.html` in a browser or use a local static web server. No build command is documented here because the current repository does not define a confirmed build/test workflow. If you add a build system, document its prerequisites and commands in this section.

## Relationship to Otiyot+

Otiyot+ is a Hebrew-reading accessibility project designed to support readers through tools such as niqqud color-coding, a dyslexia-friendly font, adjustable letter spacing, and reading-focus features.

Otiyot Press builds on that broader project and its accessibility-oriented educational goals by focusing on publishing and learning materials. Where Press reuses code, design, text, fonts, or other assets from Otiyot+, those components remain subject to their applicable license and attribution requirements. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`CONTENT_NOTICE.md`](CONTENT_NOTICE.md).

- [Otiyot+ repository](https://github.com/pragerm26/Otiyot-Plus)
- [Otiyot Press repository](https://github.com/pragerm26/Otiyot-Press)

## Accessibility and textual accuracy

Accessibility features are meant to improve presentation and usability, not to silently alter the meaning of source texts. Always verify important Hebrew text, punctuation, niqqud, and page layout against a trusted source—especially before using materials for teaching, publication, or ritual purposes.

Please report accessibility barriers and rendering problems through the repository's issue tracker. When reporting a problem, describe the browser/device, the text or page involved (without sharing private student information), what you expected, and what happened instead.

## Privacy

The project should avoid collecting or exposing personal information unnecessarily. Do not submit private student records, identifying educational information, or other sensitive personal data in public issues. See [`PRIVACY.md`](PRIVACY.md) for the project's intended privacy principles and limitations.

## Contributing and feedback

Suggestions, bug reports, accessibility feedback, documentation improvements, and code contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. All participants are expected to follow the [`Code of Conduct`](CODE_OF_CONDUCT.md).

## Security

Please see [`SECURITY.md`](SECURITY.md) for responsible reporting of security concerns. Do not publish exploit details or sensitive information in a public issue.

## Acknowledgments

Otiyot Press is part of the broader Otiyot+ effort to make Hebrew reading and learning more accessible. See [`ACKNOWLEDGMENTS.md`](ACKNOWLEDGMENTS.md) for credits. Names and organizations should be added only with appropriate permission and accurate descriptions of their contributions.

## License and notices

The repository includes a `LICENSE` file for the project code. Not every file in a repository necessarily has the same license: fonts, source texts, illustrations, datasets, and other third-party materials may have separate terms. Review [`CONTENT_NOTICE.md`](CONTENT_NOTICE.md) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) before reusing those materials.

Otiyot Press is a companion project based on Otiyot+. Please preserve the relevant copyright and license notices when reusing or adapting material.
