# Contributing

Thanks for your interest in vue-why-render! Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/dadashi44/vue-why-render/issues) and include:

- the versions of `vue-why-render`, `vue` and, if relevant, `pinia`, `vue-router` or `nuxt`;
- what the panel showed and what you expected instead;
- ideally a minimal reproduction — a small repository or a StackBlitz project.

A wrong or missing reason is a bug too: the whole point of the package is to name the cause
correctly, so such reports are especially valuable.

## Suggesting a feature

Open an issue first and describe the problem you are trying to solve, not only the solution.
That way we can agree on the approach before you spend time on code.

## Development setup

Requires Node 20 or newer.

```sh
git clone https://github.com/dadashi44/vue-why-render.git
cd vue-why-render
npm install
npm run dev        # playground with demo components
```

Before opening a pull request, make sure everything passes locally:

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e   # needs Playwright browsers: npx playwright install chromium
npm run build
```

## Pull requests

- Keep a pull request focused on one change; split unrelated fixes into separate ones.
- Add or update tests. Logic is covered by unit tests in `test/` (vitest + jsdom); only what
  jsdom cannot do — layout, dragging, a real keyboard, the clipboard — goes to `e2e/`.
- Update the README if the change is visible to users. The README exists in three languages
  (`README.md`, `docs/README.ru.md`, `docs/README.zh-CN.md`); if you cannot translate,
  update the English one and say so in the pull request — that is fine.
- There is no need to touch `CHANGELOG.md` — the maintainer updates it when preparing a release.
- The package must stay out of production builds and add no runtime dependencies.
  If a change needs a new dependency, discuss it in an issue first.

## Releases

Releases are published by the maintainer: a `v*` tag triggers the release workflow, which
publishes to npm with provenance through trusted publishing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
