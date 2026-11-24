---
title: Development and contributing
description: Run the project locally, what CI checks, and how to send a pull request.
---

## Development

```sh
npm install
npm run dev        # playground with demo components
npm run dev:site   # landing page with the same playground inside
npm run build:site # build the site into dist-site
npm test           # vitest
npm run test:coverage
npm run test:e2e   # playwright, the panel in a real browser
npm run typecheck  # vue-tsc
npm run lint
npm run build
```

Tests mount real Vue applications in jsdom and cover the whole path: from a ref changing
to the registry recording it with the correct reason. The overlay is verified against a
stubbed 2d context, the panel through `@vue/test-utils`.

What jsdom cannot do by design — layout and dragging, a real keyboard, the clipboard, picking
a file, `prefers-color-scheme` — is covered by Playwright in `e2e/` against a small fixture
app. Logic is not duplicated there: it stays in the unit tests.

CI runs lint, types and tests on Node 20/22/24, separately verifies installation and
building under pnpm, yarn and bun, and then installs the packed tarball into a clean
project with each of the four managers, exercising both the ESM and the CJS entry point.

Releases go to npm on a `v*` tag through trusted publishing: there are no tokens in
repository secrets — npm exchanges the Actions OIDC token for one-time credentials and
attaches provenance itself.

## Contributing

Bug reports, ideas and pull requests are welcome — see
[CONTRIBUTING.md](https://github.com/dadashi44/vue-why-render/blob/main/CONTRIBUTING.md)
for the development setup and what a pull request should include.
