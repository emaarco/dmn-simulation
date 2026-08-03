# Contributing

Thanks for your interest in `@emaarco/dmn-js-simulation`! Contributions of all
kinds are welcome — bug reports, feature ideas, docs, and code.

## Getting started

```bash
git clone https://github.com/emaarco/dmn-js-simulation.git
cd dmn-js-simulation
npm install
npm test
```

The repository is an npm-workspaces monorepo:

- `packages/dmn-js-simulation` — the published library
- `packages/example` — an example dmn-js modeler

## Scripts

```bash
npm test              # unit tests (Vitest)
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run lint:deps     # dependency-cruiser architecture check
npm run build         # build the library (Rollup → ESM + CJS + d.ts + CSS)
npm run dev           # run the example modeler (Vite)
npm run test:e2e      # Playwright E2E against the example app
```

## Ground rules

- **Conventional Commits.** Commit messages and PR titles follow
  [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`, `chore:`). Releases and the changelog are
  generated from them via release-please.
- **Keep the layering intact.** The library is split into `domain/` (pure
  evaluation, no dmn-js/DOM), `adapter/`, `simulation/`, `ui/` and
  `integration/`. Imports only ever point "down"; `npm run lint:deps`
  (dependency-cruiser) enforces this in CI.
- **Add tests.** Evaluation logic and hit policies are covered by Vitest unit
  tests; please extend them for any behavior change.

## Before opening a PR

```bash
npm run typecheck
npm run lint
npm run lint:deps
npm test
npm run build
```

All of these run in CI on Node 20 and 22 (which also runs the Playwright E2E suite).

## Reporting bugs / requesting features

Use the GitHub issue templates. For decision-logic bugs, attaching the `.dmn`
file and the inputs you simulated is the fastest path to a fix.
