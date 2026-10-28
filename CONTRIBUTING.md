# Contributing to Otiyot Press

Thank you for helping make Hebrew learning materials more accessible. Otiyot Press is the publishing arm of the Otiyot+ ecosystem and is based on the work and accessibility goals of [Otiyot+](https://github.com/pragerm26/Otiyot-Plus).

Contributions may include bug reports, accessibility feedback, text/layout corrections, documentation, testing, and code.

## Before contributing

- Review the [README](README.md) to understand the project's purpose and its relationship to Otiyot+.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Check the existing issues before opening a duplicate.
- Do not contribute material you do not have permission to share.
- Do not include private student information or other sensitive personal data in issues or test files.

## Reporting a bug

Open an issue in the repository and include, where relevant:

1. A short, descriptive title.
2. What you were trying to do.
3. Steps to reproduce the problem.
4. What you expected and what actually happened.
5. Browser, operating system, and screen size.
6. The relevant file, page, or text layout.
7. A screenshot or sample only if you have the right to share it and it contains no private information.

For Hebrew-text issues, identify the relevant text and describe the problem with directionality, niqqud, punctuation, spacing, line breaks, or page layout. Please verify quoted source text before reporting a textual error.

## Suggesting a feature or educational resource

Explain the need, the intended audience, how it could improve accessibility or learning, and any relevant limitations. Feedback from students, teachers, parents, and accessibility professionals is particularly useful.

## Code contributions

1. Fork the repository.
2. Create a focused branch for your change.
3. Make the smallest clear change that addresses the issue.
4. Test in a current browser and check both Hebrew right-to-left rendering and any affected English interface text.
5. Check that line breaks, punctuation, niqqud, and page boundaries remain usable.
6. Open a pull request explaining the change, the reason for it, and the tests performed.

There is currently no confirmed automated test or build command documented for this repository. Do not claim that tests passed unless you actually ran them. If you introduce tooling or a test suite, document how to use it.

## Texts, fonts, and third-party material

Otiyot Press is based on Otiyot+ and may share or adapt project code and assets. Preserve existing copyright and license notices. Before adding a font, text edition, image, dataset, or other resource, confirm that its license permits the intended use and record the source and terms in `THIRD_PARTY_NOTICES.md`.

Do not assume that a publicly accessible text or font is automatically free to redistribute.

## Pull requests

A good pull request should:

- Have a clear title and concise description.
- Reference the related issue, if one exists.
- Explain user-facing effects and accessibility implications.
- Include relevant screenshots for visual changes, if appropriate.
- State what you tested and what remains untested.
- Avoid unrelated changes.

Maintainers may request changes, ask questions, or decline contributions that do not fit the project's purpose or cannot be legally or technically verified.

Thank you for contributing.
